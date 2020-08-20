"use strict";

/**
 * Reads a SubRip file and outputs text content as WebVTT.
 */
export async function convertSrtToVtt (srtFilePath: string) {
    const fileStream = fs.createReadStream(
            srtFilePath, { encoding: "utf-8" });

    let fileContents = "";
    for await (let chunk of fileStream) {
        // Omit BOM if present
        if (!fileContents && chunk[0] === "\uFEFF") {
            chunk = chunk.slice(1);
        }

        // Normalize line endings
        fileContents += chunk.replace(/$\r\n/gm, "\n");
    }


    let vttText = "WEBVTT\n";

    /**
     * Matches a caption group within an SubRip file. Match groups
     * are the index (followed by a new line), the time range
     * (followed by a new line), then any text content until a blank
     * line.
     */
    const REGEX_CAPTION = /(?:(\d+)\n(\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}))\n((?:.+)\n?)*/g;

    /**
     * WebVTT is very similar to SubRip, the main differences being
     * the "WEBVTT" specifier and optional metadata at the head of
     * the file, the optional caption indicies and the timecode
     * millisecond separator.
     */
    for (const groups of fileContents.matchAll(REGEX_CAPTION)) {
        const captionSource = groups[0];
        const captionIndex = groups[1];
        const captionTime = groups[2];
        const captionText = groups[3];

        vttText += `\n${captionIndex}\n`;
        vttText += `${captionTime.replace(/,/g, ".")}\n`;

        if (captionText) {
            vttText += `${captionText}`;
        }
    }

    return vttText;
}
