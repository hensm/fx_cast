"use strict";

/**
 * Walk up the prototype chain until the specified property
 * descriptor is found, otherwise return undefined.
 */
export function getPropertyDescriptor(
    target: any,
    prop: string | number | symbol
): PropertyDescriptor | undefined {
    let desc: PropertyDescriptor | undefined;
    while (!desc && target !== null) {
        desc = Object.getOwnPropertyDescriptor(target, prop);
        if (!desc) target = Object.getPrototypeOf(target);
    }

    return desc;
}

/**
 * Bind either the getter/setter functions or the value function
 * to a target object.
 */
export function bindPropertyDescriptor(
    desc: PropertyDescriptor,
    target: any
): PropertyDescriptor {
    if (typeof desc.value === "function") {
        desc.value = desc.value.bind(target);
    } else {
        if (desc.get) desc.get = desc.get.bind(target);
        if (desc.set) desc.set = desc.set.bind(target);
    }

    return desc;
}

/**
 * For each attribute handler, fetch the property descriptor (which may
 * be further up in the prototype chain), re-bind it to the target
 * element and collect them into a property descriptor map.
 */
export function clonePropsDescriptor<T>(
    target: T,
    props: any[]
): PropertyDescriptorMap {
    return props.reduce<PropertyDescriptorMap>((descriptorMap, prop) => {
        const desc = getPropertyDescriptor(target, prop);
        if (desc) {
            bindPropertyDescriptor(desc, target);
            descriptorMap[prop as any] = desc;
        }

        return descriptorMap;
    }, {});
}

export function makeGetterDescriptor(val: any): PropertyDescriptor {
    return {
        enumerable: true,
        configurable: true,
        get() {
            return val;
        }
    };
}

export function makeValueDescriptor(val: any): PropertyDescriptor {
    return {
        enumerable: true,
        configurable: true,
        writable: true,
        value: val
    };
}
