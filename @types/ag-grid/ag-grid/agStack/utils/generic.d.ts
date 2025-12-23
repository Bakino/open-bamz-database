/**
 * If value is undefined, null or blank, returns null, otherwise returns the value
 * @param {T} value
 * @returns {T | null}
 */
export declare function _makeNull<T>(value?: T): T | null;
export declare function _exists(value: string | null | undefined): value is string;
export declare function _exists<T>(value: T): value is NonNullable<T>;
export declare function _missing<T>(value: T | null | undefined): value is Exclude<undefined | null, T>;
export declare function _toStringOrNull(value: any): string | null;
export declare function _jsonEquals<T1, T2>(val1: T1, val2: T2): boolean;
export type DefaultComparatorOptions = {
    accentedCompare?: boolean;
    transform?: (val: any) => any;
};
export declare function _defaultComparator(valueA: any, valueB: any, options?: DefaultComparatorOptions): number;
