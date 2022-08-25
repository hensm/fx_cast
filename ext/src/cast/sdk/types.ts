"use strict";

/**
 * Keep in sync with bridge types at:
 *   app/src/bridge/components/cast/types.ts
 */

import type { SenderApplication, Volume, Image } from "./classes";
import type { MediaInfo, QueueItem } from "./media/classes";
import type {
    IdleReason,
    PlayerState,
    RepeatMode,
    ResumeState
} from "./media/enums";

export interface MediaStatus {
    activeTrackIds?: number[];
    currentItemId?: number;
    mediaSessionId: number;
    media?: MediaInfo;
    playbackRate: number;
    playerState: PlayerState;
    idleReason?: IdleReason;
    items?: QueueItem[];
    currentTime: Nullable<number>;
    supportedMediaCommands: number;
    repeatMode?: RepeatMode;
    volume: Volume;
    customData: unknown;
}

export interface ReceiverApplication {
    appId: string;
    appType?: string;
    displayName: string;
    iconUrl: string;
    isIdleScreen: boolean;
    launchedFromCloud: boolean;
    namespaces: Array<{ name: string }>;
    sessionId: string;
    statusText: string;
    transportId: string;
    universalAppId: string;
}

export interface ReceiverStatus {
    applications?: ReceiverApplication[];
    isActiveInput?: boolean;
    isStandBy?: boolean;
    volume: Volume;
}

export interface CastSessionUpdatedDetails {
    sessionId: string;
    statusText: string;
    namespaces: Array<{ name: string }>;
    volume: Volume;
}

export interface CastSessionCreatedDetails extends CastSessionUpdatedDetails {
    appId: string;
    appImages: Image[];
    displayName: string;
    receiverId: string;
    receiverFriendlyName: string;
    senderApps: SenderApplication[];
    transportId: string;
}

/** supportedMediaCommands bitflag returned in MEDIA_STATUS messages */
export enum _MediaCommand {
    PAUSE = 1,
    SEEK = 2,
    STREAM_VOLUME = 4,
    STREAM_MUTE = 8,
    QUEUE_NEXT = 64,
    QUEUE_PREV = 128,
    QUEUE_SHUFFLE = 256,
    QUEUE_SKIP_AD = 512,
    QUEUE_REPEAT_ALL = 1024,
    QUEUE_REPEAT_ONE = 2048,
    QUEUE_REPEAT = 3072,
    EDIT_TRACKS = 4096,
    PLAYBACK_RATE = 8192
}

interface ReqBase {
    requestId: number;
}

// NS: urn:x-cast:com.google.cast.receiver
export type SenderMessage =
    | (ReqBase & { type: "LAUNCH"; appId: string })
    | (ReqBase & { type: "STOP"; sessionId: string })
    | (ReqBase & { type: "GET_STATUS" })
    | (ReqBase & { type: "GET_APP_AVAILABILITY"; appId: string[] })
    | (ReqBase & { type: "SET_VOLUME"; volume: Partial<Volume> });

export type ReceiverMessage =
    | (ReqBase & { type: "RECEIVER_STATUS"; status: ReceiverStatus })
    | (ReqBase & { type: "LAUNCH_ERROR"; reason: string });

interface MediaReqBase extends ReqBase {
    mediaSessionId: number;
    customData?: unknown;
}

// NS: urn:x-cast:com.google.cast.media
export type SenderMediaMessage =
    | (MediaReqBase & { type: "PLAY" })
    | (MediaReqBase & { type: "PAUSE" })
    | {
          type: "MEDIA_GET_STATUS";
          mediaSessionId?: number;
          customData?: unknown;
          requestId: number;
      }
    | {
          type: "GET_STATUS";
          mediaSessionId?: number;
          customData?: unknown;
          requestId: number;
      }
    | (MediaReqBase & { type: "STOP" })
    | (MediaReqBase & { type: "MEDIA_SET_VOLUME"; volume: Volume })
    | (MediaReqBase & { type: "SET_VOLUME"; volume: Volume })
    | (MediaReqBase & { type: "SET_PLAYBACK_RATE"; playbackRate: number })
    | (ReqBase & {
          type: "LOAD";
          activeTrackIds?: Nullable<number[]>;
          atvCredentials?: string;
          atvCredentialsType?: string;
          autoplay?: Nullable<boolean>;
          currentTime?: Nullable<number>;
          customData?: unknown;
          media: MediaInfo;
          sessionId?: Nullable<string>;
      })
    | (MediaReqBase & {
          type: "SEEK";
          resumeState?: Nullable<ResumeState>;
          currentTime?: Nullable<number>;
      })
    | (MediaReqBase & {
          type: "EDIT_TRACKS_INFO";
          activeTrackIds?: Nullable<number[]>;
          textTrackStyle?: Nullable<string>;
      })
    // QueueLoadRequest
    | (MediaReqBase & {
          type: "QUEUE_LOAD";
          items: QueueItem[];
          startIndex: number;
          repeatMode: string;
          sessionId?: Nullable<string>;
      })
    // QueueInsertItemsRequest
    | (MediaReqBase & {
          type: "QUEUE_INSERT";
          items: QueueItem[];
          insertBefore?: Nullable<number>;
          sessionId?: Nullable<string>;
      })
    // QueueUpdateItemsRequest
    | (MediaReqBase & {
          type: "QUEUE_UPDATE";
          items: QueueItem[];
          sessionId?: Nullable<string>;
      })
    // QueueJumpRequest
    | (MediaReqBase & {
          type: "QUEUE_UPDATE";
          jump?: Nullable<number>;
          currentItemId?: Nullable<number>;
          sessionId?: Nullable<string>;
      })
    // QueueRemoveItemsRequest
    | (MediaReqBase & {
          type: "QUEUE_REMOVE";
          itemIds: number[];
          sessionId?: Nullable<string>;
      })
    // QueueReorderItemsRequest
    | (MediaReqBase & {
          type: "QUEUE_REORDER";
          itemIds: number[];
          insertBefore?: Nullable<number>;
          sessionId?: Nullable<string>;
      })
    // QueueSetPropertiesRequest
    | (MediaReqBase & {
          type: "QUEUE_UPDATE";
          repeatMode?: Nullable<string>;
          sessionId?: Nullable<string>;
      });

export type ReceiverMediaMessage =
    | (MediaReqBase & { type: "MEDIA_STATUS"; status: MediaStatus[] })
    | (MediaReqBase & { type: "INVALID_PLAYER_STATE" })
    | (MediaReqBase & { type: "LOAD_FAILED" })
    | (MediaReqBase & { type: "LOAD_CANCELLED" })
    | (MediaReqBase & { type: "INVALID_REQUEST" });
