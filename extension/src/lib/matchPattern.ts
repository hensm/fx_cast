const WILDCARD_SCHEMES = ["http", "https", "ws", "wss"];

export const REMOTE_MATCH_PATTERN_REGEX =
    /^(?:(?:(\*|https?|wss?|ftp):\/\/(\*|(?:\*\.(?:[^\/\*:]\.?)+(?:[^\.])|[^\/\*:]*))?)(\/.*)|<all_urls>)$/;

/**
 * Partial implementation of WebExtension match patterns. Only handles
 * remote patterns, as we don't need local matching and it's more
 * complex to implement.
 */
export class RemoteMatchPattern {
    private partScheme: string;
    private partHost: string;
    private partPath: string;

    /** Matching schemes */
    private schemes: string[] = [];

    /** Base domain for subdomain matching */
    private domain?: string;
    /** Host part includes subdomain wildcard */
    private matchSubdomains = false;

    constructor(public pattern: string) {
        // Parse match pattern parts
        const matches = pattern.match(REMOTE_MATCH_PATTERN_REGEX);
        if (!matches) {
            throw new Error("Invalid match pattern");
        }

        [, this.partScheme, this.partHost, this.partPath] = matches;

        if (pattern === "<all_urls>") {
            this.schemes = WILDCARD_SCHEMES;
            return;
        }

        // Scheme
        this.schemes =
            this.partScheme === "*" ? WILDCARD_SCHEMES : [this.partScheme];

        // Host
        if (this.partHost.startsWith("*.")) {
            this.domain = this.partHost.slice(2);
            this.matchSubdomains = true;
        } else if (this.partHost !== "*") {
            this.domain = this.partHost;
        }
    }

    /**
     * Test domain string against match pattern.
     */
    private matchesDomain(domain: string) {
        // If wildcard or exact match
        if (this.partHost === "*" || this.domain === domain) {
            return true;
        }

        if (this.matchSubdomains) {
            // Should exist here
            if (!this.domain) return false;

            // Starting offset of pattern in url host string
            const offset = domain.length - this.domain.length;
            if (
                offset > 0 &&
                domain[offset - 1] === "." &&
                domain.slice(offset) === this.domain
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Tests URL string against match pattern and returns boolean
     * result.
     */
    matches(urlString: string) {
        let url: URL;
        try {
            url = new URL(urlString);
        } catch (err) {
            return false;
        }

        // If URL does not have a matching scheme
        if (!this.schemes.includes(url.protocol.slice(0, -1))) {
            return false;
        }

        // If pattern host is not a wildcard
        if (!this.matchesDomain(url.hostname)) {
            return false;
        }

        const urlPath = `${url.pathname}${url.search}`;

        // If pattern path is not a wildcard
        if (this.partPath !== "/*") {
            // And if paths don't match
            if (this.partPath !== urlPath) {
                const specialChars = ".+*?^${}()|[]\\";

                /**
                 * Create regular expression from pattern path, escaping
                 * any special characters.
                 */
                let pathRegexString = "";
                for (const c of this.partPath) {
                    if (c === "*") {
                        pathRegexString += ".*";
                    } else {
                        if (specialChars.includes(c)) {
                            pathRegexString += "\\";
                        }

                        pathRegexString += c;
                    }
                }

                // Test compiled expression against path
                if (!new RegExp(`^${pathRegexString}$`).test(urlPath)) {
                    return false;
                }
            }
        }

        return true;
    }
}
