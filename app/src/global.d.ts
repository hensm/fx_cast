declare type Nullable<T> = T | null;

declare type DistributiveOmit<T, K extends keyof any> = T extends any
    ? Omit<T, K>
    : never;
