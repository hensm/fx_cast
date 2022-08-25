import { writable } from "svelte/store";
import type { ReceiverDevice } from "../../types";

export default writable<ReceiverDevice[]>([]);
