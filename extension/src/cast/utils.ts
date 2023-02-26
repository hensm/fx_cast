import { ReceiverDevice, ReceiverDeviceCapabilities } from "../types";
import { Receiver } from "./sdk/classes";
import { Capability, ReceiverType } from "./sdk/enums";
import { MediaCommand } from "./sdk/media/enums";
import { _MediaCommand } from "./sdk/types";

/**
 * Check receiver device capabilities bitflags against array of
 * capability strings requested by the sender application.
 */
export function hasRequiredCapabilities(
    receiverDevice: ReceiverDevice,
    requiredCapabilities: Capability[] = []
) {
    const { capabilities } = receiverDevice;
    return requiredCapabilities.every(capability => {
        switch (capability) {
            case Capability.AUDIO_IN:
                return capabilities & ReceiverDeviceCapabilities.AUDIO_IN;
            case Capability.AUDIO_OUT:
                return capabilities & ReceiverDeviceCapabilities.AUDIO_OUT;
            case Capability.MULTIZONE_GROUP:
                return (
                    capabilities & ReceiverDeviceCapabilities.MULTIZONE_GROUP
                );
            case Capability.VIDEO_IN:
                return capabilities & ReceiverDeviceCapabilities.VIDEO_IN;
            case Capability.VIDEO_OUT:
                return capabilities & ReceiverDeviceCapabilities.VIDEO_OUT;
        }
    });
}

/** Convert capabilities bitflags to string array. */
export function convertCapabilitiesFlags(flags: ReceiverDeviceCapabilities) {
    const capabilities: Capability[] = [];
    if (flags & ReceiverDeviceCapabilities.VIDEO_OUT)
        capabilities.push(Capability.VIDEO_OUT);
    if (flags & ReceiverDeviceCapabilities.VIDEO_IN)
        capabilities.push(Capability.VIDEO_IN);
    if (flags & ReceiverDeviceCapabilities.AUDIO_OUT)
        capabilities.push(Capability.AUDIO_OUT);
    if (flags & ReceiverDeviceCapabilities.AUDIO_IN)
        capabilities.push(Capability.AUDIO_IN);

    if (flags & ReceiverDeviceCapabilities.MULTIZONE_GROUP)
        capabilities.push(Capability.MULTIZONE_GROUP);

    return capabilities;
}

/** Convert media commands bitflags to string array. */
export function convertSupportedMediaCommandsFlags(flags: _MediaCommand) {
    const supportedMediaCommands: string[] = [];
    if (flags & _MediaCommand.PAUSE) {
        supportedMediaCommands.push(MediaCommand.PAUSE);
    }
    if (flags & _MediaCommand.SEEK) {
        supportedMediaCommands.push(MediaCommand.SEEK);
    }
    if (flags & _MediaCommand.STREAM_VOLUME) {
        supportedMediaCommands.push(MediaCommand.STREAM_VOLUME);
    }
    if (flags & _MediaCommand.STREAM_MUTE) {
        supportedMediaCommands.push(MediaCommand.STREAM_MUTE);
    }
    if (flags & _MediaCommand.QUEUE_NEXT) {
        supportedMediaCommands.push("queue_next");
    }
    if (flags & _MediaCommand.QUEUE_PREV) {
        supportedMediaCommands.push("queue_prev");
    }

    return supportedMediaCommands;
}

interface GetEstimatedTimeOpts {
    currentTime: number;
    lastUpdateTime: number;
    playbackRate?: number;
    duration?: Nullable<number>;
}
export function getEstimatedTime(opts: GetEstimatedTimeOpts) {
    let estimatedTime =
        opts.currentTime +
        (opts.playbackRate ?? 1) * ((Date.now() - opts.lastUpdateTime) / 1000);

    // Enforce valid range
    if (estimatedTime < 0) {
        estimatedTime = 0;
    } else if (opts.duration && estimatedTime > opts.duration) {
        estimatedTime = opts.duration;
    }

    return estimatedTime;
}

/**
 * Create `chrome.cast.Receiver` object from receiver device info.
 */
export function createReceiver(device: ReceiverDevice) {
    const receiver = new Receiver(
        device.id,
        device.friendlyName,
        convertCapabilitiesFlags(device.capabilities)
    );

    // Currently only supports CAST receivers
    receiver.receiverType = ReceiverType.CAST;

    return receiver;
}
