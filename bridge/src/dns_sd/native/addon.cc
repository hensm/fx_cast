#include "dns_sd_browser.h"

// Module init
Napi::Object init(Napi::Env env, Napi::Object exports)
{
    DnsSdBrowser::init(env, exports);
    return exports;
}

NODE_API_MODULE(dns_sd, init)
