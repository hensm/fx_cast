"use strict";

import React, { useEffect, useState } from "react";

export function getNextEllipsis(ellipsis: string): string {
    if (ellipsis === "") return ".";
    if (ellipsis === ".") return "..";
    if (ellipsis === "..") return "...";
    if (ellipsis === "...") return "";

    return "";
}

export interface LoadingIndicatorProps {
    text: string;
    duration?: number;
}
export function LoadingIndicator(props: LoadingIndicatorProps) {
    const [ellipsis, setEllipsis] = useState("");

    useEffect(() => {
        const interval = window.setInterval(() => {
            setEllipsis(prev => getNextEllipsis(prev));
        }, props.duration ?? 500);

        return () => {
            window.clearInterval(interval);
        };
    }, []);

    return (
        <div className="loading">
            {props.text}
            {ellipsis}
        </div>
    );
}
