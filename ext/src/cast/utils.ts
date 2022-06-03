import { ReceiverDevice, ReceiverDeviceCapabilities } from "../types";
import { Capability } from "./sdk/enums";

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
