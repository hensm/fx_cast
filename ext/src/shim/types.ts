"use strict";

import _Error from "./cast/classes/Error";
import Media from "./cast/media/classes/Media";

export type SuccessCallback = () => void;
export type ErrorCallback = (err: _Error) => void;

export type MediaListener = (media: Media) => void;
export type MessageListener = (namespace: string, message: string) => void;
export type UpdateListener = (isAlive: boolean) => void;
export type LoadSuccessCallback = (media: Media) => void;

export type Callbacks = [ SuccessCallback?, ErrorCallback? ];
export type CallbacksMap = Map<string, Callbacks>;
