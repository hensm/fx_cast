export function getNextEllipsis(ellipsis: string): string {
    if (ellipsis === "") return ".";
    if (ellipsis === ".") return "..";
    if (ellipsis === "..") return "...";
    if (ellipsis === "...") return "";

    return "";
}

/**
 * Template literal tag function, JSON-encodes substitutions.
 */
export function stringify(
    templateStrings: TemplateStringsArray,
    ...substitutions: unknown[]
) {
    let formattedString = "";

    for (const templateString of templateStrings) {
        if (formattedString) {
            formattedString += JSON.stringify(substitutions.shift());
        }

        formattedString += templateString;
    }

    return formattedString;
}

export function loadScript(
    scriptUrl: string,
    doc: Document = document
): Promise<HTMLScriptElement> {
    return new Promise((resolve, reject) => {
        const scriptEl = doc.createElement("script");
        scriptEl.src = scriptUrl;
        (doc.head || doc.documentElement).append(scriptEl);

        scriptEl.addEventListener("load", () => resolve(scriptEl));
        scriptEl.addEventListener("error", () => reject());
    });
}
