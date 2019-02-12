"use strict";

export function getNextEllipsis (ellipsis) {
    return do {
             if (ellipsis === "")    ".";
        else if (ellipsis === ".")   "..";
        else if (ellipsis === "..")  "...";
        else if (ellipsis === "...") "";
    };
}
