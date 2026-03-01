{
    "targets": [
        {
            "target_name": "dns_sd",
            "cflags!": ["-fno-exceptions"],
            "cflags_cc!": ["-fno-exceptions"],
            "defines": ["NAPI_VERSION=8", "NAPI_DISABLE_CPP_EXCEPTIONS"],
            "include_dirs": ["<!@(node -p \"require('node-addon-api').include\")"],
            "conditions": [
                [
                    "OS=='mac'",
                    {
                        "sources": [
                            "src/dns_sd/native/addon.cc",
                            "src/dns_sd/native/dns_sd_browser.cc",
                            "src/dns_sd/native/dns_sd_platform_browser_unix.cc",
                        ],
                        "cflags_cc": ["-std=c++20"],
                        "xcode_settings": {
                            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
                            "CLANG_CXX_LANGUAGE_STANDARD": "c++20",
                            "CLANG_CXX_LIBRARY": "libc++",
                            "MACOSX_DEPLOYMENT_TARGET": "10.15",
                        },
                    },
                ],
                [
                    "OS=='linux'",
                    {
                        "sources": [
                            "src/dns_sd/native/addon.cc",
                            "src/dns_sd/native/dns_sd_browser.cc",
                            "src/dns_sd/native/dns_sd_platform_browser_unix.cc",
                        ],
                        "cflags_cc": ["-std=c++20"],
                        "libraries": ["-ldns_sd"],
                    },
                ],
                [
                    "OS=='win'",
                    {
                        "sources": [
                            "src/dns_sd/native/addon.cc",
                            "src/dns_sd/native/dns_sd_browser.cc",
                            "src/dns_sd/native/dns_sd_platform_browser_win.cc",
                        ],
                        "libraries": ["dnsapi.lib", "ws2_32.lib"],
                        "msvs_settings": {
                            "VCCLCompilerTool": {
                                "ExceptionHandling": 1,
                                "AdditionalOptions": ["/std:c++20"],
                            }
                        },
                        "defines": ["UNICODE", "_UNICODE", "WIN32_LEAN_AND_MEAN"],
                    },
                ],
            ],
        }
    ]
}  # type: ignore
