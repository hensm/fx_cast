#include "dns_sd_browser.h"

DnsSdBrowser::DnsSdBrowser(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<DnsSdBrowser>(info)
    , browser_(nullptr)
    , started_(false)
{
    Napi::Env env = info.Env();
    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsFunction()) {
        Napi::TypeError::New(env, "Expected (serviceType: string, callback: Function)")
            .ThrowAsJavaScriptException();
        return;
    }
    service_type_ = info[0].As<Napi::String>().Utf8Value();
    tsfn_ = Napi::ThreadSafeFunction::New(
        env, info[1].As<Napi::Function>(), "DnsSdBrowserCallback", 0, 1);
}

DnsSdBrowser::~DnsSdBrowser()
{
    if (browser_) {
        browser_->stop();
        browser_.reset();
    }
    if (started_) {
        tsfn_.Release();
        started_ = false;
    }
}

Napi::Object DnsSdBrowser::init(Napi::Env env, Napi::Object exports)
{
    Napi::Function func = DefineClass(env, "DnsSdBrowser",
        {
            InstanceMethod("start", &DnsSdBrowser::start),
            InstanceMethod("stop", &DnsSdBrowser::stop),
        });

    exports.Set("DnsSdBrowser", func);
    return exports;
}

Napi::Value DnsSdBrowser::start(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();

    if (started_) {
        return env.Undefined();
    }
    started_ = true;

    tsfn_.Unref(env);

    browser_ = std::make_unique<DnsSdPlatformBrowser>(service_type_, *this);
    browser_->start();
    return env.Undefined();
}

Napi::Value DnsSdBrowser::stop(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();

    if (!started_) {
        return env.Undefined();
    }

    if (browser_) {
        browser_->stop();
        browser_.reset();
    }

    tsfn_.Release();
    started_ = false;

    return env.Undefined();
}

void DnsSdBrowser::on_service_up(const DnsSdService& service)
{
    auto data = std::make_unique<DnsSdService>(service);

    napi_status status = tsfn_.NonBlockingCall(
        data.get(), [](Napi::Env env, Napi::Function js_callback, DnsSdService* raw) {
            std::unique_ptr<DnsSdService> owned(raw);

            Napi::Object obj = Napi::Object::New(env);
            obj.Set("name", Napi::String::New(env, owned->name));
            obj.Set("host", Napi::String::New(env, owned->host));
            obj.Set("port", Napi::Number::New(env, owned->port));
            if (!owned->address4.empty())
                obj.Set("address4", Napi::String::New(env, owned->address4));
            if (!owned->address6.empty())
                obj.Set("address6", Napi::String::New(env, owned->address6));

            Napi::Object txt = Napi::Object::New(env);
            for (const auto& [key, value] : owned->txt_record) {
                txt.Set(key, Napi::String::New(env, value));
            }
            obj.Set("txtRecord", txt);

            js_callback.Call({ Napi::String::New(env, "serviceUp"), obj });
        });
    if (status == napi_ok)
        data.release();
}

void DnsSdBrowser::on_service_down(const std::string& name)
{
    auto data = std::make_unique<std::string>(name);

    napi_status status = tsfn_.NonBlockingCall(
        data.get(), [](Napi::Env env, Napi::Function js_callback, std::string* raw) {
            std::unique_ptr<std::string> owned(raw);
            js_callback.Call(
                { Napi::String::New(env, "serviceDown"), Napi::String::New(env, *owned) });
        });
    if (status == napi_ok)
        data.release();
}
