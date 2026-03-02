/**
 * DNS-SD browser implementation for Windows.
 *
 * Uses the DnsService* functions of the Windows DNS API (windns.h) available on Windows 10+ without
 * any third-party dependencies like Bonjour.
 */

#include "dns_sd_platform_browser.h"

#define NOMINMAX

#include "utils.h"

#include <windns.h>

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <map>
#include <thread>

namespace {

/** Convert a wide string to a UTF-8 std::string. */
std::string wide_to_utf8(const wchar_t* wide)
{
    if (!wide)
        return "";
    int len = WideCharToMultiByte(CP_UTF8, 0, wide, -1, nullptr, 0, nullptr, nullptr);
    if (len <= 0)
        return "";
    std::string result(len - 1, '\0');
    WideCharToMultiByte(CP_UTF8, 0, wide, -1, &result[0], len, nullptr, nullptr);
    return result;
}

/** Convert a UTF-8 std::string to a wide string. */
std::wstring utf8_to_wide(const std::string& utf8)
{
    if (utf8.empty())
        return L"";
    int len = MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), -1, nullptr, 0);
    if (len <= 0)
        return L"";
    std::wstring result(len - 1, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), -1, &result[0], len);
    return result;
}

} // anonymous namespace

struct DnsSdPlatformBrowser::Impl {
    /* Service type for browse operation. */
    std::string service_type;
    /* Delegate to receive browser events. */
    DnsSdPlatformBrowserDelegate& delegate;

    /** Represents the current browse operation. */
    struct BrowseContext {
        /** Query name (owns storage for `request.QueryName`). */
        std::wstring query_name;
        DNS_SERVICE_BROWSE_REQUEST request;
        DNS_SERVICE_CANCEL cancel;

        BrowseContext()
            : request {}
            , cancel {}
        {
        }
    };
    /* Whether browse operation is ongoing. */
    std::atomic<bool> is_started;
    BrowseContext browse;

    /** Represents a resolve operation triggered by the current browse operation. */
    struct ResolveContext {
        Impl* impl;
        DWORD ttl;
        std::string service_name;
        std::wstring query_name;
        DNS_SERVICE_RESOLVE_REQUEST resolve_request;
        DNS_SERVICE_CANCEL resolve_cancel;

        ResolveContext()
            : impl(nullptr)
            , ttl(0)
            , resolve_request {}
            , resolve_cancel {}
        {
        }
    };
    // Stored contexts for ongoing resolve operations (keyed by service name)
    std::map<std::string, ResolveContext*> active_resolves;
    std::mutex active_resolves_mutex;

    // The Windows DNS API doesn't have a builtin mechanism to notify us when a service disappears,
    // so we keep a record of found services (keyed by service name) and expire them (emitting a
    // `service_down` event) based on their TTL unless they're refreshed by a subsequent browse
    // callback.
    std::map<std::string, std::chrono::steady_clock::time_point> expiring_services;
    std::mutex expiring_services_mutex;
    std::thread expiry_thread;
    std::condition_variable expiry_cv;

    Impl(const std::string& type, DnsSdPlatformBrowserDelegate& del)
        : service_type(type)
        , delegate(del)
        , is_started(false)
    {
    }

    ~Impl() { stop(); }

    void start();
    void stop();
    void expiry_loop();

    static void WINAPI browse_callback(DWORD status, PVOID context, PDNS_RECORD query_results);

    static void WINAPI resolve_callback(
        DWORD status, PVOID context, PDNS_SERVICE_INSTANCE service_instance);
};

DnsSdPlatformBrowser::DnsSdPlatformBrowser(
    const std::string& service_type, DnsSdPlatformBrowserDelegate& delegate)
    : impl_(std::make_unique<Impl>(service_type, delegate))
{
}

DnsSdPlatformBrowser::~DnsSdPlatformBrowser() = default;

void DnsSdPlatformBrowser::start() { impl_->start(); }

void DnsSdPlatformBrowser::stop() { impl_->stop(); }

void DnsSdPlatformBrowser::Impl::start()
{
    if (is_started)
        return;
    is_started = true;

    WSADATA wsa_data;
    WSAStartup(MAKEWORD(2, 2), &wsa_data);

    // Windns expects service name with a .local suffix
    browse.query_name = utf8_to_wide(service_type + ".local");

    browse.request.Version = DNS_QUERY_REQUEST_VERSION1;
    browse.request.InterfaceIndex = 0;
    browse.request.QueryName = browse.query_name.c_str();
    browse.request.pBrowseCallback = browse_callback;
    browse.request.pQueryContext = this;

    DNS_STATUS status = DnsServiceBrowse(&browse.request, &browse.cancel);
    if (status != DNS_REQUEST_PENDING && status != ERROR_SUCCESS) {
        ERROR_LOG("browse failed with status %lu", status);
        is_started = false;
        return;
    }

    DEBUG_LOG("browse started for %s", service_type.c_str());

    // Start expiry loop on background thread
    expiry_thread = std::thread(&Impl::expiry_loop, this);
}

void DnsSdPlatformBrowser::Impl::stop()
{
    if (!is_started)
        return;
    is_started = false;

    // Cancel browse operation
    DnsServiceBrowseCancel(&browse.cancel);

    // Cancel active resolve operation(s). We make a copy of the map here to avoid a deadlock when
    // DnsServiceResolveCancel invokes the resolve callback with an ERROR_CANCELLED status.
    std::map<std::string, ResolveContext*> resolves_to_cancel;
    {
        std::scoped_lock lock(active_resolves_mutex);
        resolves_to_cancel = active_resolves;
    }
    for (auto& [name, ctx] : resolves_to_cancel) {
        DnsServiceResolveCancel(&ctx->resolve_cancel);
    }

    // Wake and join expiry thread
    expiry_cv.notify_all();
    if (expiry_thread.joinable())
        expiry_thread.join();
    {
        std::scoped_lock lock(expiring_services_mutex);
        expiring_services.clear();
    }

    WSACleanup();
}

void DnsSdPlatformBrowser::Impl::expiry_loop()
{
    std::unique_lock lock(expiring_services_mutex);
    while (is_started) {
        // Check for expired services and calculate the next expiry time (if any) from the tracked
        // expiring services.
        std::chrono::steady_clock::time_point now = std::chrono::steady_clock::now();
        std::chrono::steady_clock::time_point next_expiry
            = std::chrono::steady_clock::time_point::max();
        for (auto it = expiring_services.begin(); it != expiring_services.end();) {
            auto& [name, expires_at] = *it;
            if (expires_at <= now) {
                // Service expired without a new browse result, so we should treat this as the
                // service becoming unavailable and emit a `service_down` event.
                DEBUG_LOG("service expired: %s", name.c_str());
                std::string expired_name = name;
                it = expiring_services.erase(it);
                lock.unlock();
                delegate.on_service_down(expired_name);
                lock.lock();
            } else {
                // Update expiry time if this service expires sooner than the current next_expiry.
                auto expiry_s
                    = std::chrono::duration_cast<std::chrono::seconds>(expires_at - now).count();
                DEBUG_LOG("service %s expires in %llds", name.c_str(), expiry_s);
                if (expires_at < next_expiry)
                    next_expiry = expires_at;
                ++it;
            }
        }

        if (next_expiry == std::chrono::steady_clock::time_point::max()) {
            // Wait until browse operation stopped (which subsequently ends the loop at this
            // iteration) or a new service is added (which updates the expiry time).
            expiry_cv.wait(lock, [&] { return !is_started || !expiring_services.empty(); });
        } else {
            // Wait until the next service expiry time
            expiry_cv.wait_until(lock, next_expiry);
        }
    }
}

void WINAPI DnsSdPlatformBrowser::Impl::browse_callback(
    DWORD status, PVOID context, PDNS_RECORD query_results)
{
    auto* impl = static_cast<Impl*>(context);

    ScopeGuard free_records { [&] {
        if (query_results)
            DnsRecordListFree(query_results, DnsFreeRecordList);
    } };

    if (!impl->is_started)
        return;
    if (status != ERROR_SUCCESS || !query_results)
        return;

    // Walk the record chain for PTR records (representing service instances)
    for (PDNS_RECORD record = query_results; record; record = record->pNext) {
        if (record->wType != DNS_TYPE_PTR)
            continue;

        std::string instance_name = wide_to_utf8(record->Data.PTR.pNameHost);

        // Strip everything after (and including) the first dot to get the service name
        size_t first_dot_index = instance_name.find('.');
        std::string service_name = (first_dot_index != std::string::npos)
            ? instance_name.substr(0, first_dot_index)
            : instance_name;

        // If we've already resolved this service, just refresh its TTL expiry without starting
        // another resolve operation.
        {
            std::scoped_lock lock(impl->expiring_services_mutex);
            if (impl->expiring_services.count(service_name) > 0) {
                impl->expiring_services[service_name]
                    = std::chrono::steady_clock::now() + std::chrono::seconds(record->dwTtl);
                DEBUG_LOG("refreshed TTL for %s (ttl=%lu)", service_name.c_str(), record->dwTtl);
                impl->expiry_cv.notify_one();
                continue;
            }
        }

        // Ensure we don't have an active resolve operation for this service already
        {
            std::scoped_lock lock(impl->active_resolves_mutex);
            if (impl->active_resolves.count(service_name) > 0) {
                DEBUG_LOG("resolve already in progress for %s, skipping", service_name.c_str());
                continue;
            }
        }

        DEBUG_LOG("browse found: %s (ttl=%lu)", instance_name.c_str(), record->dwTtl);

        // Create a new resolve context for this service
        auto* resolve_ctx = new ResolveContext();
        resolve_ctx->impl = impl;
        resolve_ctx->ttl = record->dwTtl;
        resolve_ctx->service_name = std::move(service_name);
        resolve_ctx->query_name = utf8_to_wide(instance_name);

        // Populate resolve request
        resolve_ctx->resolve_request.Version = DNS_QUERY_REQUEST_VERSION1;
        resolve_ctx->resolve_request.InterfaceIndex = 0;
        resolve_ctx->resolve_request.QueryName = resolve_ctx->query_name.data();
        resolve_ctx->resolve_request.pResolveCompletionCallback = resolve_callback;
        resolve_ctx->resolve_request.pQueryContext = resolve_ctx;

        // Start the resolve operation
        {
            std::scoped_lock lock(impl->active_resolves_mutex);
            DNS_STATUS resolve_status
                = DnsServiceResolve(&resolve_ctx->resolve_request, &resolve_ctx->resolve_cancel);
            switch (resolve_status) {
            case ERROR_SUCCESS:
            case DNS_REQUEST_PENDING:
                impl->active_resolves[resolve_ctx->service_name] = resolve_ctx;
                break;
            default:
                delete resolve_ctx;
                break;
            }
        }
    }
}

void WINAPI DnsSdPlatformBrowser::Impl::resolve_callback(
    DWORD status, PVOID context, PDNS_SERVICE_INSTANCE service_instance)
{
    auto* resolve_ctx = static_cast<ResolveContext*>(context);
    auto* impl = resolve_ctx->impl;

    ScopeGuard defer { [&] {
        if (service_instance)
            DnsServiceFreeInstance(service_instance);
        {
            std::scoped_lock lock(impl->active_resolves_mutex);
            impl->active_resolves.erase(resolve_ctx->service_name);
        }
        delete resolve_ctx;
    } };

    // If the browse operation is still active and we got a valid result, emit a service_up event
    if (impl->is_started && status == ERROR_SUCCESS && service_instance) {
        DnsSdService service;
        service.name = resolve_ctx->service_name;
        service.host = wide_to_utf8(service_instance->pszHostName);
        service.port = service_instance->wPort;

        // Extract TXT record key-value pairs
        if (service_instance->dwPropertyCount > 0 && service_instance->keys
            && service_instance->values) {
            for (DWORD i = 0; i < service_instance->dwPropertyCount; i++) {
                if (service_instance->keys[i]) {
                    std::string key = wide_to_utf8(service_instance->keys[i]);
                    std::string value;
                    if (service_instance->values[i])
                        value = wide_to_utf8(service_instance->values[i]);
                    service.txt_record[key] = value;
                }
            }
        }

        // The v4Address/v6Address fields of DNS_SERVICE_INSTANCE don't seem to be populated
        // reliably, but getaddrinfo seems to work consistently in my testing, so we'll just use
        // that approach across all platforms.
        resolve_addresses(service.host, service.address4, service.address6);

        if (impl->is_started) {
            // Schedule service expiry
            {
                std::scoped_lock svc_lock(impl->expiring_services_mutex);
                impl->expiring_services[service.name]
                    = std::chrono::steady_clock::now() + std::chrono::seconds(resolve_ctx->ttl);
            }
            impl->expiry_cv.notify_one();

            DEBUG_LOG("resolved: %s -> %s:%d (%s / %s, ttl=%lus)", service.name.c_str(),
                service.host.c_str(), service.port, service.address4.c_str(),
                service.address6.c_str(), resolve_ctx->ttl);

            // Emit service_up event with merged addresses
            impl->delegate.on_service_up(service);
        }
    }
}
