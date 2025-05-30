import { LuaType } from './utils';
type MetaMethods = '__unm' | '__bnot' | '__len' | '__add' | '__sub' | '__mul' | '__mod' | '__pow' | '__div' | '__idiv' | '__band' | '__bor' | '__bxor' | '__shl' | '__shr' | '__concat' | '__eq' | '__lt' | '__le' | '__index' | '__newindex' | '__call' | '__pairs' | '__ipairs' | '__tostring';
declare class Table {
    numValues: LuaType[];
    strValues: Record<string, LuaType>;
    keys: string[];
    values: LuaType[];
    metatable: Table | null;
    constructor(initialiser?: Record<string, LuaType> | LuaType[] | ((t: Table) => void));
    get(key: LuaType): LuaType;
    rawget(key: LuaType): LuaType;
    getMetaMethod(name: MetaMethods): Function;
    set(key: LuaType, value: LuaType): LuaType;
    setFn(key: string): (v: LuaType) => void;
    rawset(key: LuaType, value: LuaType): void;
    insert(...values: LuaType[]): void;
    toObject(): unknown[] | Record<string, unknown>;
    getn(): number;
}
export { MetaMethods, Table };
//# sourceMappingURL=Table.d.ts.map