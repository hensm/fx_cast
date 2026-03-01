#ifndef DNS_SD_BROWSER_H
#define DNS_SD_BROWSER_H

#include "dns_sd_platform_browser.h"

#include <memory>
#include <napi.h>
#include <string>

class DnsSdBrowser : public Napi::ObjectWrap<DnsSdBrowser>, public DnsSdPlatformBrowserDelegate {
public:
    static Napi::Object init(Napi::Env env, Napi::Object exports);
    DnsSdBrowser(const Napi::CallbackInfo& info);
    ~DnsSdBrowser();

    // DnsSdPlatformBrowserDelegate
    void on_service_up(const DnsSdService& service) override;
    void on_service_down(const std::string& name) override;

private:
    Napi::Value start(const Napi::CallbackInfo& info);
    Napi::Value stop(const Napi::CallbackInfo& info);

    std::string service_type_;
    Napi::ThreadSafeFunction tsfn_;
    std::unique_ptr<DnsSdPlatformBrowser> browser_;
    bool started_;
};

#endif // DNS_SD_BROWSER_H
