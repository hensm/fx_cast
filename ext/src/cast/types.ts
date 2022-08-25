"use strict";

import type { Error as Error_ } from "./sdk/classes";
import type Media from "./sdk/media/Media";

export type SuccessCallback = () => void;
export type ErrorCallback = (err: Error_) => void;

export type MediaListener = (media: Media) => void;
export type MessageListener = (namespace: string, message: string) => void;
export type UpdateListener = (isAlive: boolean) => void;
export type LoadSuccessCallback = (media: Media) => void;
