import logger from "./logger";
import { TypedStorageArea } from "./TypedStorageArea";

// Bundle UA info at time of build (as a fallback)
import bundledUaInfo from "../../../docs/ua.json";

const UA_INFO_ENDPOINT = "https://hensm.github.io/fx_cast/ua.json";

interface UaInfo {
    version: 1;
    platforms: {
        [key: string]: string;
    };
}

const uaInfoStorage = new TypedStorageArea<{
    uaInfo: UaInfo | undefined;
    uaInfoUpdated: number | undefined;
}>(browser.storage.local);

async function fetchUaInfo(): Promise<UaInfo | null> {
    try {
        const res: UaInfo = await fetch(UA_INFO_ENDPOINT).then(r => r.json());
        if (typeof res.version !== "number" || res.version !== 1) {
            throw logger.error(
                `UA info version mismatch (got ${res.version}, expected 1)`
            );
        } else if (
            typeof res.platforms !== "object" ||
            res.platforms === null
        ) {
            throw logger.error("UA info platforms missing or invalid");
        }
        return res;
    } catch (err) {
        logger.error("Failed to fetch UA info:", err);
        return null;
    }
}

export async function cacheUaInfo() {
    const { uaInfoUpdated } = await uaInfoStorage.get("uaInfoUpdated");

    // If never updated or updated more than 24 hours ago
    if (!uaInfoUpdated || (Date.now() - uaInfoUpdated) / 1000 >= 86400) {
        logger.info("Fetching updated Chrome User-Agent strings...");
        const uaInfo = await fetchUaInfo();
        if (uaInfo) {
            await uaInfoStorage.set({ uaInfo, uaInfoUpdated: Date.now() });
        }
    }
}

/** Get a chrome user */
export async function getChromeUserAgentString(
    platform: string,
    opts?: { hybridFirefoxVersion?: string }
) {
    const { uaInfo } = await uaInfoStorage.get("uaInfo");
    if (!uaInfo) {
        logger.warn("UA info not cached (using bundled version)");
    }
    const maybeBundledUaInfo = uaInfo ?? (bundledUaInfo as UaInfo);
    const userAgentString = maybeBundledUaInfo.platforms[platform];
    if (userAgentString) {
        // Return hybrid UA (mostly Firefox UA) if requested
        if (opts?.hybridFirefoxVersion) {
            // Sans-patch (e.g. "145.0.1" -> "145.0")
            const firefoxMajorMinorVersionMatch =
                opts.hybridFirefoxVersion.match(/^\d+\.\d+/);
            const componentMatch = userAgentString.match(
                /Mozilla\/5.0 \(([^\(]+)\) (.+)/
            );
            if (firefoxMajorMinorVersionMatch && componentMatch) {
                const [rv] = firefoxMajorMinorVersionMatch;
                const [, platformComponent, browserComponent] = componentMatch;
                // Extract Chrome/xxx part
                const chromeVersionMatch = browserComponent.match(
                    /(?<= )Chrome\/[^ ]+(?= )/
                );
                if (chromeVersionMatch) {
                    const [chromeVersion] = chromeVersionMatch;
                    return `Mozilla/5.0 (${platformComponent}; rv:${rv}) ${chromeVersion} Gecko/20100101 Firefox/${rv}`;
                }
            }
        } else {
            return userAgentString;
        }
    }
}
