/**
 * DNS-SD browser implementation for macOS and Linux.
 *
 * Uses the dns_sd.h API (Apple's mDNSResponder on macOS and Avahi's compatibility layer for that
 * API (libdns_sd) on Linux) to browse for and resolve DNS-SD services.
 *
 * Address resolution uses POSIX getaddrinfo() on both platforms rather than DNSServiceGetAddrInfo,
 * which is not available in libdns_sd.
 */

#include "dns_sd_platform_browser.h"
#include "utils.h"

#include <dns_sd.h>

#include <atomic>
#include <cstring>
#include <set>
#include <thread>

struct DnsSdPlatformBrowser::Impl {
    struct ResolveContext;

    std::string service_type;
    DnsSdPlatformBrowserDelegate& delegate;

    DNSServiceRef browse_ref;
    std::atomic<bool> is_started;
    std::thread event_loop_thread;

    std::mutex pending_resolves_mutex;
    std::set<ResolveContext*> pending_resolves;

    Impl(const std::string& service_type, DnsSdPlatformBrowserDelegate& delegate)
        : service_type(service_type)
        , delegate(delegate)
        , browse_ref(nullptr)
        , is_started(false)
    {
    }

    ~Impl() { stop(); }

    void start();
    void stop();
    void event_loop();

    // dns_sd callbacks
    static void DNSSD_API browse_callback(DNSServiceRef, DNSServiceFlags, uint32_t,
        DNSServiceErrorType, const char*, const char*, const char*, void*);

    static void DNSSD_API resolve_callback(DNSServiceRef, DNSServiceFlags, uint32_t,
        DNSServiceErrorType, const char*, const char*, uint16_t, uint16_t, const unsigned char*,
        void*);
};

struct DnsSdPlatformBrowser::Impl::ResolveContext {
    Impl* impl;
    std::string service_name;
    DNSServiceRef resolve_ref;
    bool destroyed;

    ResolveContext()
        : impl(nullptr)
        , resolve_ref(nullptr)
        , destroyed(false)
    {
    }
    ~ResolveContext()
    {
        if (resolve_ref)
            DNSServiceRefDeallocate(resolve_ref);
    }
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

    DNSServiceErrorType err = DNSServiceBrowse(&browse_ref, 0, kDNSServiceInterfaceIndexAny,
        service_type.c_str(), nullptr, browse_callback, this);

    if (err != kDNSServiceErr_NoError) {
        ERROR_LOG("browse failed with error %d", err);
        is_started = false;
        return;
    }

    DEBUG_LOG("browse started for %s", service_type.c_str());
    // Poll on background thread
    event_loop_thread = std::thread(&Impl::event_loop, this);
}

void DnsSdPlatformBrowser::Impl::stop()
{
    if (!is_started)
        return;
    is_started = false;

    if (event_loop_thread.joinable()) {
        event_loop_thread.join();
    }

    // Clean up pending resolves
    {
        std::scoped_lock lock(pending_resolves_mutex);
        for (auto* ctx : pending_resolves) {
            delete ctx;
        }
        pending_resolves.clear();
    }

    DNSServiceRefDeallocate(browse_ref);
}

/**
 * Background thread that waits for DNS-SD socket events. When data is available, calls
 * DNSServiceProcessResult to trigger the registered callbacks.
 */
void DnsSdPlatformBrowser::Impl::event_loop()
{
    while (is_started) {
        int max_fd = 0;
        fd_set read_fds;
        FD_ZERO(&read_fds);

        // Add the browse socket
        int browse_fd = DNSServiceRefSockFD(browse_ref);
        FD_SET(browse_fd, &read_fds);
        max_fd = browse_fd;

        // Add resolve sockets
        {
            std::scoped_lock lock(pending_resolves_mutex);
            for (auto* ctx : pending_resolves) {
                int fd = DNSServiceRefSockFD(ctx->resolve_ref);
                FD_SET(fd, &read_fds);
                if (fd > max_fd)
                    max_fd = fd;
            }
        }

        struct timeval tv {
            .tv_sec = 0, .tv_usec = 250000
        }; // 250ms
        int result = select(max_fd + 1, &read_fds, nullptr, nullptr, &tv);
        if (result <= 0 || !is_started)
            continue;

        // Process browse ref
        if (FD_ISSET(browse_fd, &read_fds)) {
            DNSServiceProcessResult(browse_ref);
        }

        // Process resolve refs
        {
            std::scoped_lock lock(pending_resolves_mutex);
            for (auto it = pending_resolves.begin(); it != pending_resolves.end();) {
                auto* ctx = *it;
                int fd = DNSServiceRefSockFD(ctx->resolve_ref);
                if (FD_ISSET(fd, &read_fds)) {
                    DNSServiceProcessResult(ctx->resolve_ref);
                }
                if (ctx->destroyed) {
                    it = pending_resolves.erase(it);
                    delete ctx;
                } else {
                    ++it;
                }
            }
        }
    }
}

void DNSSD_API DnsSdPlatformBrowser::Impl::browse_callback(DNSServiceRef, DNSServiceFlags flags,
    uint32_t interface_index, DNSServiceErrorType error_code, const char* service_name,
    const char* reg_type, const char* reply_domain, void* context)
{
    if (error_code != kDNSServiceErr_NoError)
        return;

    auto* impl = static_cast<Impl*>(context);
    if (!impl->is_started)
        return;

    if (flags & kDNSServiceFlagsAdd) {
        DEBUG_LOG("browse found: %s (ifindex=%u)", service_name, interface_index);
        // New service found, resolve it
        auto* ctx = new ResolveContext();
        ctx->impl = impl;
        ctx->service_name = service_name;

        if (DNSServiceResolve(&ctx->resolve_ref, 0, interface_index, service_name, reg_type,
                reply_domain, resolve_callback, ctx)
            != kDNSServiceErr_NoError) {
            delete ctx;
            return;
        }
        std::scoped_lock lock(impl->pending_resolves_mutex);
        impl->pending_resolves.insert(ctx);
    } else {
        // Service disappeared
        DEBUG_LOG("service removed: %s", service_name);
        impl->delegate.on_service_down(service_name);
    }
}

void DNSSD_API DnsSdPlatformBrowser::Impl::resolve_callback(DNSServiceRef, DNSServiceFlags,
    uint32_t, DNSServiceErrorType error_code, const char*, const char* hosttarget, uint16_t port,
    uint16_t txt_len, const unsigned char* txt_record, void* context)
{
    auto* ctx = static_cast<ResolveContext*>(context);
    if (error_code != kDNSServiceErr_NoError || !ctx->impl->is_started) {
        ctx->destroyed = true;
        return;
    }

    DnsSdService service;
    service.name = ctx->service_name;
    service.host = hosttarget;
    service.port = ntohs(port);

    // Parse TXT record into key-value map
    {
        uint16_t count = TXTRecordGetCount(txt_len, txt_record);
        for (uint16_t i = 0; i < count; i++) {
            char key[256];
            uint8_t value_len = 0;
            const void* value = nullptr;
            auto err = TXTRecordGetItemAtIndex(
                txt_len, txt_record, i, sizeof(key), key, &value_len, &value);
            if (err == kDNSServiceErr_NoError) {
                service.txt_record[key] = (value && value_len > 0)
                    ? std::string(static_cast<const char*>(value), value_len)
                    : "";
            }
        }
    }

    // Resolve v4/v6 addresses via getaddrinfo
    resolve_addresses(hosttarget, service.address4, service.address6);

    DEBUG_LOG("resolved: %s -> %s:%d (%s / %s)", service.name.c_str(), service.host.c_str(),
        service.port, service.address4.c_str(), service.address6.c_str());
    ctx->impl->delegate.on_service_up(service);
    ctx->destroyed = true;
}
