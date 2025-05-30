import { Table } from './Table';
type LuaType = undefined | boolean | number | string | Function | Table;
interface Config {
    LUA_PATH?: string;
    fileExists?: (path: string) => boolean;
    loadFile?: (path: string) => string;
    stdin?: string;
    stdout?: (data: string) => void;
    osExit?: (code: number) => void;
}
declare function type(v: LuaType): 'string' | 'number' | 'boolean' | 'function' | 'nil' | 'table';
declare function tostring(v: LuaType): string;
declare function posrelat(pos: number, len: number): number;
declare function coerceToBoolean(val: LuaType): boolean;
declare function coerceToNumber(val: LuaType, errorMessage?: string): number;
declare function coerceToString(val: LuaType, errorMessage?: string): string;
declare function coerceArgToNumber(value: LuaType, funcName: string, index: number): number;
declare function coerceArgToString(value: LuaType, funcName: string, index: number): string;
declare function coerceArgToTable(value: LuaType, funcName: string, index: number): Table;
declare function coerceArgToFunction(value: LuaType, funcName: string, index: number): Function;
declare const ensureArray: <T>(value: T | T[]) => T[];
declare const hasOwnProperty: (obj: Record<string, unknown> | unknown[], key: string | number) => boolean;
export { LuaType, Config, type, tostring, posrelat, coerceToBoolean, coerceToNumber, coerceToString, coerceArgToNumber, coerceArgToString, coerceArgToTable, coerceArgToFunction, ensureArray, hasOwnProperty };
//# sourceMappingURL=utils.d.ts.map