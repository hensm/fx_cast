"use strict";

import { bindPropertyDescriptor
       , clonePropsDescriptor
       , getPropertyDescriptor
       , makeGetterDescriptor
       , makeValueDescriptor } from "./descriptorUtils";

// Injected by content loader
declare const iconAirPlayAudio: string;
declare const iconAirPlayVideo: string;
declare const mediaOverlayTitle: string;


/**
 * Intercept and store references to shadow root nodes created by
 * calls to `attachShadow`. Used to reference shadow roots, even when
 * created in closed mode without exposing them to other page scripts.
 */
const internalShadowRoots = new WeakMap<Element, ShadowRoot>();
const _attachShadow = Element.prototype.attachShadow;
Element.prototype.attachShadow = function (init) {
    const shadowRoot = _attachShadow.call(this, init);
    internalShadowRoots.set(this, shadowRoot);
    return shadowRoot;
};



function getShadowRootFromNode (node: Node): ShadowRoot | undefined {
    // Don't touch our custom element
    if (node instanceof PlayerElement) {
        return;
    }

    return internalShadowRoots.get(node as Element);
}


const DQS_XPATH_EXPRESSION = `//*[contains(name(), "-")]`;

/**
 * Return the first matching querySelector result on any ShadowRoot
 * nodes present in the document.
 */
function deepQuerySelector (selector: string): Element | null {
    const result = document.evaluate(
            DQS_XPATH_EXPRESSION, document, null
          , XPathResult.ORDERED_NODE_ITERATOR_TYPE);

    let node: Node | null;
    while (node = result.iterateNext()) {
        const shadowRoot = getShadowRootFromNode(node);
        if (!shadowRoot) {
            continue;
        }

        const queryResult = shadowRoot.querySelector(selector);
        if (queryResult) {
            return queryResult;
        }
    }

    return null;
}

/**
 * Collect and return the results of querySelectorAll on any
 * ShadowRoot nodes present in the document.
 */
function deepQuerySelectorAll (selector: string): Node[] {
    const result = document.evaluate(
            DQS_XPATH_EXPRESSION, document, null
          , XPathResult.ORDERED_NODE_ITERATOR_TYPE);

    const nodes: Node[] = [];

    let node: Node | null;
    while (node = result.iterateNext()) {
        const shadowRoot = getShadowRootFromNode(node);
        if (shadowRoot) {
            nodes.push(...shadowRoot.querySelectorAll(selector));
        }
    }

    return nodes;
}


const mediaElementTypes = [
    HTMLMediaElement
  , HTMLVideoElement
  , HTMLAudioElement
];

const mediaElementEvents = [
    "abort", "canplay", "canplaythrough", "durationchange", "emptied"
  , "encrypted", "ended", "error", "interruptbegin", "interruptend"
  , "loadeddata", "loadedmetadata", "loadstart", "mozaudioavailable", "pause"
  , "play", "playing", "progress", "ratechange", "seeked", "seeking", "stalled"
  , "suspend", "timeupdate", "volumechange", "waiting"
];

const mediaElementAttributes = mediaElementTypes
    .flatMap(type => Object.getOwnPropertyNames(type.prototype))
    .concat(mediaElementEvents.map(ev => `on${ev}`));


/**
 * Opaque wrapper around the media element to provide an overlay without
 * author interference. Relevant properties, attributes, events and
 * functions are proxied to the internal media element.
 */
class PlayerElement extends HTMLElement {
    constructor () {
        super();

        const shadowRoot = this.attachShadow({ mode: "closed" });
        const { host } = shadowRoot;

        let iconUrl;
        switch (this.constructor) {
            // URL variables injected ahead of current script

            case AudioPlayerElement: { iconUrl = iconAirPlayAudio; break; }
            case VideoPlayerElement: { iconUrl = iconAirPlayVideo; break; }
        }

        shadowRoot.innerHTML = `
            <style>
                :host {
                    display: inline-flex;
                    font: menu;
                    position: relative;
                }

                :host[hidden],
                .overlay[hidden] {
                    display: none;
                }

                video {
                    width: 100%;
                }

                .overlay {
                    align-items: center;
                    background-color: rgba(0, 0, 0, 0.85);
                    color: white;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    justify-content: center;
                    left: 0;
                    pointer-events: none;
                    position: absolute;
                    top: 0;
                    width: 100%;
                }
                .overlay__icon {
                    background-image: url("${iconUrl}");
                    height: 125px;
                    width: 125px;
                }
                .overlay__text {
                    font-size: 18px;
                }
            </style>

            <div class="overlay" hidden>
                <div class="overlay__icon"></div>
                <div class="overlay__text">
                    ${mediaOverlayTitle}
                </div>
            </div>
        `;

        const videoElement = _createElement.call(document, "video");

        for (const attr of mediaElementAttributes) {
            if (host.hasOwnProperty(attr)) {
                // @ts-ignore
                videoElement[attr] = host[attr];
            }
        }

        /**
         * Page scripts need to be able to read/write attributes, event
         * listeners, etc... on the media element, but since it's hidden
         * within the shadow DOM, these properties must be proxied.
         */
        Object.defineProperties(host, clonePropsDescriptor(videoElement, [
                "attributes", "setAttribute", "removeAttribute", "setAttribute"
              , "addEventListener", "removeEventListener", "hasEventListener"
              , ...mediaElementAttributes as any ]));

        shadowRoot.prepend(videoElement);
    }
}

class AudioPlayerElement extends PlayerElement {}
class VideoPlayerElement extends PlayerElement {
    set overlayHidden (val: boolean) {
        const shadowRoot = internalShadowRoots.get(this);
        (shadowRoot.querySelector(".overlay") as HTMLDivElement).hidden = val;
    }
    get overlayHidden () {
        const shadowRoot = internalShadowRoots.get(this);
        return (shadowRoot.querySelector(".overlay") as HTMLDivElement).hidden;
    }
}

try {
    customElements.define("audio-player-element", AudioPlayerElement);
    customElements.define("video-player-element", VideoPlayerElement);
} catch (err) {
    if (err instanceof DOMException
     && err.code === DOMException.NOT_SUPPORTED_ERR) {
        // Script already injected
    }
}


// Original functions
const _createElement = document.createElement;
const _createElementNS = document.createElementNS;

/**
 * Intercepts `<audio>`/`<video>` element creation and returns a wrapped
 * custom element version that imitates the original. Otherwise, returns
 * the result of the original.
 */
function createElement (
        tagName: string
      , options?: ElementCreationOptions) {

    // Normalize formatting
    const lowerTagName = tagName.toLowerCase();
    const upperTagName = tagName.toUpperCase();

    if (lowerTagName === "audio" || lowerTagName === "video") {
        const fakeElement = _createElement.call(document
              , `${lowerTagName}-player-element`) as HTMLMediaElement;

        // Ensure all references to the element name match tagName
        Object.defineProperties(fakeElement, {
            tagName: makeGetterDescriptor(upperTagName)
          , nodeName: makeGetterDescriptor(upperTagName)
          , localName: makeGetterDescriptor(lowerTagName)
        });

        return fakeElement;
    }

    return _createElement.call(document, tagName, options);
}

/**
 * If the namespace matches the current document, redirect to the
 * patched `createElement` function, otherwise return the result of the
 * original.
 */
function createElementNS (
        namespaceURI: string
      , qualifiedName: string
      , options?: ElementCreationOptions) {

    if (namespaceURI === document.namespaceURI) {
        return createElement(qualifiedName, options);
    }

    return _createElementNS.call(document
          , namespaceURI, qualifiedName, options);
}

/**
 * Attempt to hide function source from page scripts by returning the
 * toString/toSource values of the native function.
 */
Object.defineProperties(createElement, clonePropsDescriptor(
        _createElement, ["toString", "toSource"]));
Object.defineProperties(createElement, clonePropsDescriptor(
        _createElementNS, ["toString", "toSource"]));

// Re-define element creation functions
Object.defineProperties(document, {
    createElement: makeValueDescriptor(createElement)
  , createElementNS: makeValueDescriptor(createElementNS)
});


/**
 * Takes a media element, creates a `PlayerElement` via the patched
 * `createElement` function, fetches the shadow root and copies any
 * attributes before swapping with the original element in-place.
 */
function wrapMediaElement (mediaElement: HTMLMediaElement) {
    const wrappedMedia = document.createElement(mediaElement.tagName);
    const shadowRoot = internalShadowRoots.get(wrappedMedia);

    if (!shadowRoot) {
        console.error("err: Failed to fetch shadow root!");
        return;
    }

    /**
     * Copy attributes, any non-media specific attributes are set to the
     * wrapper element for identification (id, class, etc...) or styling.
     */
    for (const attr of mediaElement.attributes) {
        if (mediaElementAttributes.includes(attr.name)) {
            wrappedMedia.setAttribute(attr.name, attr.value);
        } else {
            /**
             * Since the wrapped element has a patched `setAttribute`
             * method, need to call the original from the `HTMLElement`
             * prototype, otherwise attributes will be set on the
             * internal media element instead.
             */
            HTMLElement.prototype.setAttribute.call(
                    wrappedMedia, attr.name, attr.value);
        }
    }

    /**
     * Clone and append any HTMLSourceElement children to the
     * internal media element within the wrapped media shadow root.
     */
    for (const source of mediaElement.getElementsByTagName("source")) {
        const internalMedia = shadowRoot.querySelector("audio,video");
        if (!internalMedia) {
            console.error("err: Failed to fetch internal video element!");
            return;
        }

        internalMedia.appendChild(source.cloneNode());
    }

    // Replace media element on page with wrapped media
    mediaElement.replaceWith(wrappedMedia);
}

/*function* joinIterables (...iterables: Array<Iterable<any>>) {
    for (const iterable of iterables) {
        for (const item of iterable) {
            yield item;
        }
    }
}*/

/**
 * Find all media elements (both in the main DOM and any shadow DOMs)
 * and wrap them.
 */
document.addEventListener("DOMContentLoaded", () => {
    const mediaSelector = "audio,video";

    setTimeout(() => {
        const mediaElements = document.querySelectorAll(mediaSelector);
        const deepMediaElements = deepQuerySelectorAll(mediaSelector);

        for (const mediaElement of [...Array.from(mediaElements), ...deepMediaElements]) {
            wrapMediaElement(mediaElement as HTMLMediaElement);
        }
    });
});
