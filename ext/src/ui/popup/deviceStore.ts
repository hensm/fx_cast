import { writable } from "svelte/store";
import { ReceiverDevice } from "../../types";

export default writable<ReceiverDevice[]>([]);
