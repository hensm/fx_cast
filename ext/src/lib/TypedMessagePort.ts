/**
 * Provides a typed interface to MessagePort objects.
 */
export interface TypedMessagePort<T> extends MessagePort {
    postMessage(message: T, transfer: Transferable[]): void;
    postMessage(message: T, options?: StructuredSerializeOptions): void;
}
