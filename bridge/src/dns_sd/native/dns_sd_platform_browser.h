#ifndef DNS_SD_PLATFORM_BROWSER_H
#define DNS_SD_PLATFORM_BROWSER_H

#include <map>
#include <memory>
#include <mutex>
#include <string>

/** Represents a resolved DNS-SD service. */
struct DnsSdService {
    std::string name;
    std::string host;
    uint16_t port = 0;
    std::string address4;
    std::string address6;
    std::map<std::string, std::string> txt_record;
};

/** Delegate interface for receiving DNS-SD browser events. */
class DnsSdPlatformBrowserDelegate {
public:
    virtual ~DnsSdPlatformBrowserDelegate() = default;
    virtual void on_service_up(const DnsSdService& service) = 0;
    virtual void on_service_down(const std::string& name) = 0;
};

/**
 * Platform-specific DNS-SD browser.
 * Implemented in dns_sd_platform_browser_unix.cc (macOS/Linux) and dns_sd_platform_browser_win.cc
 * (Windows).
 */
class DnsSdPlatformBrowser {
public:
    DnsSdPlatformBrowser(const std::string& service_type, DnsSdPlatformBrowserDelegate& delegate);
    ~DnsSdPlatformBrowser();

    void start();
    void stop();

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

#endif // DNS_SD_PLATFORM_BROWSER_H
