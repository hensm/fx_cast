import { ReceiverDevice, ReceiverDeviceCapabilities } from "../types";
import { Receiver } from "./sdk/classes";
import { Capability, ReceiverType } from "./sdk/enums";

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

export function convertCapabilitiesFlags(flags: ReceiverDeviceCapabilities) {
    // Convert capabilities bitflag to string array
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

interface GetEstimatedTimeOpts {
    currentTime: number;
    lastUpdateTime: number;
    duration?: Nullable<number>;
}
export function getEstimatedTime(opts: GetEstimatedTimeOpts) {
    let estimatedTime =
        opts.currentTime + (Date.now() - opts.lastUpdateTime) / 1000;

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
