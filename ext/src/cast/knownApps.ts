"use strict";

const _ = browser.i18n.getMessage;

export interface KnownApp {
    name: string;
    matches?: string;
}

/**
 * TODO: Just keep a list of IDs and cache names from the Google API:
 * https://clients3.google.com/cast/chromecast/device/app?a=[appId]
 *
 * Also, localization since the API supports it.
 */
export default {
    // Web-supported
    "CA5E8412": { name: "Netflix", matches: "https://www.netflix.com/*" },
    "233637DE": { name: "YouTube", matches: "https://www.youtube.com/*" },
    "CC32E753": { name: "Spotify", matches: "https://open.spotify.com/*" },
    "5E81F6DB": {
        name: "BBC iPlayer",
        matches: "https://www.bbc.co.uk/iplayer*"
    },
    "B3DCF968": { name: "Twitch", matches: "https://www.twitch.tv/*" },
    "B88B034A": {
        name: "Dailymotion",
        matches: "https://www.dailymotion.com/*"
    },
    "C3DE6BC2": { name: "Disney+", matches: "https://www.disneyplus.com/*" },
    "B143C57E": { name: "SoundCloud", matches: "https://soundcloud.com/*" },

    // Misc
    "9AC194DC": { name: "Plex" },

    "CC1AD845": { name: _("popupMediaTypeAppMedia") }
} as Record<string, KnownApp>;
