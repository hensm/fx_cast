"use strict";

browser.runtime.getPlatformInfo()
    .then(platformInfo => {
        const link = document.createElement("link");
        link.rel = "stylesheet";

        switch (platformInfo.os) {
            case "mac": {
                link.href = "platform_styles/style_mac.css";
                break;
            }

            case "linux": {
                link.href = "platform_styles/style_linux.css";

                const input = document.createElement("input");
                const inputWrapper = document.createElement("div");

                inputWrapper.append(input);
                document.documentElement.append(inputWrapper);

                input.type = "text";
                const textInputHeight = window.getComputedStyle(input).height;
                input.type = "number";
                const numberInputHeight = window.getComputedStyle(input).height;

                inputWrapper.remove();

                if (numberInputHeight !== textInputHeight) {
                    const style = document.createElement("style");
                    style.textContent = `
                        input[type="number"] {
                            height: ${textInputHeight};
                        }
                    `;

                    document.body.append(style);
                }
            }
        }

        if (link.href) {
            document.head.append(link);
        }
    });
