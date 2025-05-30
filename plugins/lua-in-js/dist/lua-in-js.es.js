import { parse as parse$1 } from 'luaparse';
import { sprintf } from 'printj';

class LuaError extends Error {
    constructor(message) {
        super();
        this.message = message;
    }
    toString() {
        return `LuaError: ${this.message}`;
    }
}

class Table {
    constructor(initialiser) {
        this.numValues = [undefined];
        this.strValues = {};
        this.keys = [];
        this.values = [];
        this.metatable = null;
        if (initialiser === undefined)
            return;
        if (typeof initialiser === 'function') {
            initialiser(this);
            return;
        }
        if (Array.isArray(initialiser)) {
            this.insert(...initialiser);
            return;
        }
        for (const key in initialiser) {
            if (hasOwnProperty(initialiser, key)) {
                let value = initialiser[key];
                if (value === null)
                    value = undefined;
                this.set(key, value);
            }
        }
    }
    get(key) {
        const value = this.rawget(key);
        if (value === undefined && this.metatable) {
            const mm = this.metatable.get('__index');
            if (mm instanceof Table) {
                return mm.get(key);
            }
            if (typeof mm === 'function') {
                const v = mm.call(undefined, this, key);
                return v instanceof Array ? v[0] : v;
            }
        }
        return value;
    }
    rawget(key) {
        switch (typeof key) {
            case 'string':
                if (hasOwnProperty(this.strValues, key)) {
                    return this.strValues[key];
                }
                break;
            case 'number':
                if (key > 0 && key % 1 === 0) {
                    return this.numValues[key];
                }
        }
        const index = this.keys.indexOf(tostring(key));
        return index === -1 ? undefined : this.values[index];
    }
    getMetaMethod(name) {
        return this.metatable && this.metatable.rawget(name);
    }
    set(key, value) {
        const mm = this.metatable && this.metatable.get('__newindex');
        if (mm) {
            const oldValue = this.rawget(key);
            if (oldValue === undefined) {
                if (mm instanceof Table) {
                    return mm.set(key, value);
                }
                if (typeof mm === 'function') {
                    return mm(this, key, value);
                }
            }
        }
        this.rawset(key, value);
    }
    setFn(key) {
        return v => this.set(key, v);
    }
    rawset(key, value) {
        switch (typeof key) {
            case 'string':
                this.strValues[key] = value;
                return;
            case 'number':
                if (key > 0 && key % 1 === 0) {
                    this.numValues[key] = value;
                    return;
                }
        }
        const K = tostring(key);
        const index = this.keys.indexOf(K);
        if (index > -1) {
            this.values[index] = value;
            return;
        }
        this.values[this.keys.length] = value;
        this.keys.push(K);
    }
    insert(...values) {
        this.numValues.push(...values);
    }
    toObject() {
        const outputAsArray = Object.keys(this.strValues).length === 0 && this.getn() > 0;
        const result = outputAsArray ? [] : {};
        for (let i = 1; i < this.numValues.length; i++) {
            const propValue = this.numValues[i];
            const value = propValue instanceof Table ? propValue.toObject() : propValue;
            if (outputAsArray) {
                const res = result;
                res[i - 1] = value;
            }
            else {
                const res = result;
                res[String(i - 1)] = value;
            }
        }
        for (const key in this.strValues) {
            if (hasOwnProperty(this.strValues, key)) {
                const propValue = this.strValues[key];
                const value = propValue instanceof Table ? propValue.toObject() : propValue;
                const res = result;
                res[key] = value;
            }
        }
        return result;
    }
    getn() {
        const vals = this.numValues;
        const keys = [];
        for (const i in vals) {
            if (hasOwnProperty(vals, i)) {
                keys[i] = true;
            }
        }
        let j = 0;
        while (keys[j + 1]) {
            j += 1;
        }
        if (j > 0 && vals[j] === undefined) {
            let i = 0;
            while (j - i > 1) {
                const m = Math.floor((i + j) / 2);
                if (vals[m] === undefined) {
                    j = m;
                }
                else {
                    i = m;
                }
            }
            return i;
        }
        return j;
    }
}

const FLOATING_POINT_PATTERN = /^[-+]?[0-9]*\.?([0-9]+([eE][-+]?[0-9]+)?)?$/;
const HEXIDECIMAL_CONSTANT_PATTERN = /^(-)?0x([0-9a-fA-F]*)\.?([0-9a-fA-F]*)$/;
function type(v) {
    const t = typeof v;
    switch (t) {
        case 'undefined':
            return 'nil';
        case 'number':
        case 'string':
        case 'boolean':
        case 'function':
            return t;
        case 'object':
            if (v instanceof Table)
                return 'table';
            if (v instanceof Function)
                return 'function';
    }
}
function tostring(v) {
    if (v instanceof Table) {
        const mm = v.getMetaMethod('__tostring');
        if (mm)
            return mm(v)[0];
        return valToStr(v, 'table: 0x');
    }
    if (v instanceof Function) {
        return valToStr(v, 'function: 0x');
    }
    return coerceToString(v);
    function valToStr(v, prefix) {
        const s = v.toString();
        if (s.indexOf(prefix) > -1)
            return s;
        const str = prefix + Math.floor(Math.random() * 0xffffffff).toString(16);
        v.toString = () => str;
        return str;
    }
}
function posrelat(pos, len) {
    if (pos >= 0)
        return pos;
    if (-pos > len)
        return 0;
    return len + pos + 1;
}
function throwCoerceError(val, errorMessage) {
    if (!errorMessage)
        return undefined;
    throw new LuaError(`${errorMessage}`.replace(/%type/gi, type(val)));
}
function coerceToBoolean(val) {
    return !(val === false || val === undefined);
}
function coerceToNumber(val, errorMessage) {
    if (typeof val === 'number')
        return val;
    switch (val) {
        case undefined:
            return undefined;
        case 'inf':
            return Infinity;
        case '-inf':
            return -Infinity;
        case 'nan':
            return NaN;
    }
    const V = `${val}`;
    if (V.match(FLOATING_POINT_PATTERN)) {
        return parseFloat(V);
    }
    const match = V.match(HEXIDECIMAL_CONSTANT_PATTERN);
    if (match) {
        const [, sign, exponent, mantissa] = match;
        let n = parseInt(exponent, 16) || 0;
        if (mantissa)
            n += parseInt(mantissa, 16) / Math.pow(16, mantissa.length);
        if (sign)
            n *= -1;
        return n;
    }
    if (errorMessage === undefined)
        return undefined;
    throwCoerceError(val, errorMessage);
}
function coerceToString(val, errorMessage) {
    if (typeof val === 'string')
        return val;
    switch (val) {
        case undefined:
        case null:
            return 'nil';
        case Infinity:
            return 'inf';
        case -Infinity:
            return '-inf';
    }
    if (typeof val === 'number') {
        return Number.isNaN(val) ? 'nan' : `${val}`;
    }
    if (typeof val === 'boolean') {
        return `${val}`;
    }
    if (errorMessage === undefined)
        return 'nil';
    throwCoerceError(val, errorMessage);
}
function coerceArg(value, coerceFunc, typ, funcName, index) {
    return coerceFunc(value, `bad argument #${index} to '${funcName}' (${typ} expected, got %type)`);
}
function coerceArgToNumber(value, funcName, index) {
    return coerceArg(value, coerceToNumber, 'number', funcName, index);
}
function coerceArgToString(value, funcName, index) {
    return coerceArg(value, coerceToString, 'string', funcName, index);
}
function coerceArgToTable(value, funcName, index) {
    if (value instanceof Table) {
        return value;
    }
    else {
        const typ = type(value);
        throw new LuaError(`bad argument #${index} to '${funcName}' (table expected, got ${typ})`);
    }
}
function coerceArgToFunction(value, funcName, index) {
    if (value instanceof Function) {
        return value;
    }
    else {
        const typ = type(value);
        throw new LuaError(`bad argument #${index} to '${funcName}' (function expected, got ${typ})`);
    }
}
const ensureArray = (value) => (value instanceof Array ? value : [value]);
const hasOwnProperty = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

var utils = /*#__PURE__*/Object.freeze({
    __proto__: null,
    type: type,
    tostring: tostring,
    posrelat: posrelat,
    coerceToBoolean: coerceToBoolean,
    coerceToNumber: coerceToNumber,
    coerceToString: coerceToString,
    coerceArgToNumber: coerceArgToNumber,
    coerceArgToString: coerceArgToString,
    coerceArgToTable: coerceArgToTable,
    coerceArgToFunction: coerceArgToFunction,
    ensureArray: ensureArray,
    hasOwnProperty: hasOwnProperty
});

class Scope {
    constructor(variables = {}) {
        this._variables = variables;
    }
    get(key) {
        return this._variables[key];
    }
    set(key, value) {
        if (hasOwnProperty(this._variables, key) || !this.parent) {
            this.setLocal(key, value);
        }
        else {
            this.parent.set(key, value);
        }
    }
    setLocal(key, value) {
        this._variables[key] = value;
    }
    setVarargs(args) {
        this._varargs = args;
    }
    getVarargs() {
        return this._varargs || (this.parent && this.parent.getVarargs()) || [];
    }
    extend() {
        const innerVars = Object.create(this._variables);
        const scope = new Scope(innerVars);
        scope.parent = this;
        return scope;
    }
}

const isBlock = (node) => node.type === 'IfClause' ||
    node.type === 'ElseifClause' ||
    node.type === 'ElseClause' ||
    node.type === 'WhileStatement' ||
    node.type === 'DoStatement' ||
    node.type === 'RepeatStatement' ||
    node.type === 'FunctionDeclaration' ||
    node.type === 'ForNumericStatement' ||
    node.type === 'ForGenericStatement' ||
    node.type === 'Chunk';
class MemExpr extends String {
    constructor(base, property) {
        super();
        this.base = base;
        this.property = property;
    }
    get() {
        return `__lua.get(${this.base}, ${this.property})`;
    }
    set(value) {
        return `${this.base}.set(${this.property}, ${value})`;
    }
    setFn() {
        return `${this.base}.setFn(${this.property})`;
    }
    toString() {
        return this.get();
    }
    valueOf() {
        return this.get();
    }
}
const UNI_OP_MAP = {
    not: 'not',
    '-': 'unm',
    '~': 'bnot',
    '#': 'len'
};
const BIN_OP_MAP = {
    '+': 'add',
    '-': 'sub',
    '*': 'mul',
    '%': 'mod',
    '^': 'pow',
    '/': 'div',
    '//': 'idiv',
    '&': 'band',
    '|': 'bor',
    '~': 'bxor',
    '<<': 'shl',
    '>>': 'shr',
    '..': 'concat',
    '~=': 'neq',
    '==': 'eq',
    '<': 'lt',
    '<=': 'le',
    '>': 'gt',
    '>=': 'ge'
};
const generate = (node) => {
    switch (node.type) {
        case 'LabelStatement': {
            return `case '${node.label.name}': label = undefined`;
        }
        case 'BreakStatement': {
            return 'break';
        }
        case 'GotoStatement': {
            return `label = '${node.label.name}'; continue`;
        }
        case 'ReturnStatement': {
            const args = parseExpressions(node.arguments);
            return `return ${args}`;
        }
        case 'IfStatement': {
            const clauses = node.clauses.map(clause => generate(clause));
            return clauses.join(' else ');
        }
        case 'IfClause':
        case 'ElseifClause': {
            const condition = expression(node.condition);
            const body = parseBody(node);
            return `if (__lua.bool(${condition})) {\n${body}\n}`;
        }
        case 'ElseClause': {
            const body = parseBody(node);
            return `{\n${body}\n}`;
        }
        case 'WhileStatement': {
            const condition = expression(node.condition);
            const body = parseBody(node);
            return `while(${condition}) {\n${body}\n}`;
        }
        case 'DoStatement': {
            const body = parseBody(node);
            return `\n${body}\n`;
        }
        case 'RepeatStatement': {
            const condition = expression(node.condition);
            const body = parseBody(node);
            return `do {\n${body}\n} while (!(${condition}))`;
        }
        case 'LocalStatement': {
            return parseAssignments(node);
        }
        case 'AssignmentStatement': {
            return parseAssignments(node);
        }
        case 'CallStatement': {
            return generate(node.expression);
        }
        case 'FunctionDeclaration': {
            const getFuncDef = (params) => {
                const paramStr = params.join(';\n');
                const body = parseBody(node, paramStr);
                const argsStr = params.length === 0 ? '' : '...args';
                const returnStr = node.body.findIndex(node => node.type === 'ReturnStatement') === -1 ? '\nreturn []' : '';
                return `(${argsStr}) => {\n${body}${returnStr}\n}`;
            };
            const params = node.parameters.map(param => {
                if (param.type === 'VarargLiteral') {
                    return `$${nodeToScope.get(param)}.setVarargs(args)`;
                }
                return `$${nodeToScope.get(param)}.setLocal('${param.name}', args.shift())`;
            });
            if (node.identifier === null)
                return getFuncDef(params);
            if (node.identifier.type === 'Identifier') {
                const scope = nodeToScope.get(node.identifier);
                const setStr = node.isLocal ? 'setLocal' : 'set';
                return `$${scope}.${setStr}('${node.identifier.name}', ${getFuncDef(params)})`;
            }
            const identifier = generate(node.identifier);
            if (node.identifier.indexer === ':') {
                params.unshift(`$${nodeToScope.get(node)}.setLocal('self', args.shift())`);
            }
            return identifier.set(getFuncDef(params));
        }
        case 'ForNumericStatement': {
            const varName = node.variable.name;
            const start = expression(node.start);
            const end = expression(node.end);
            const step = node.step === null ? 1 : expression(node.step);
            const init = `let ${varName} = ${start}, end = ${end}, step = ${step}`;
            const cond = `step > 0 ? ${varName} <= end : ${varName} >= end`;
            const after = `${varName} += step`;
            const varInit = `$${nodeToScope.get(node.variable)}.setLocal('${varName}', ${varName});`;
            const body = parseBody(node, varInit);
            return `for (${init}; ${cond}; ${after}) {\n${body}\n}`;
        }
        case 'ForGenericStatement': {
            const iterators = parseExpressions(node.iterators);
            const variables = node.variables
                .map((variable, index) => {
                return `$${nodeToScope.get(variable)}.setLocal('${variable.name}', res[${index}])`;
            })
                .join(';\n');
            const body = parseBody(node, variables);
            return `for (let [iterator, table, next] = ${iterators}, res = __lua.call(iterator, table, next); res[0] !== undefined; res = __lua.call(iterator, table, res[0])) {\n${body}\n}`;
        }
        case 'Chunk': {
            const body = parseBody(node);
            return `'use strict'\nconst $0 = __lua.globalScope\nlet vars\nlet vals\nlet label\n\n${body}`;
        }
        case 'Identifier': {
            return `$${nodeToScope.get(node)}.get('${node.name}')`;
        }
        case 'StringLiteral': {
            const S = node.value
                .replace(/([^\\])?\\(\d{1,3})/g, (_, pre, dec) => `${pre || ''}${String.fromCharCode(dec)}`)
                .replace(/\\/g, '\\\\')
                .replace(/`/g, '\\`');
            return `\`${S}\``;
        }
        case 'NumericLiteral': {
            return node.value.toString();
        }
        case 'BooleanLiteral': {
            return node.value ? 'true' : 'false';
        }
        case 'NilLiteral': {
            return 'undefined';
        }
        case 'VarargLiteral': {
            return `$${nodeToScope.get(node)}.getVarargs()`;
        }
        case 'TableConstructorExpression': {
            if (node.fields.length === 0)
                return 'new __lua.Table()';
            const fields = node.fields
                .map((field, index, arr) => {
                if (field.type === 'TableKey') {
                    return `t.rawset(${generate(field.key)}, ${expression(field.value)})`;
                }
                if (field.type === 'TableKeyString') {
                    return `t.rawset('${field.key.name}', ${expression(field.value)})`;
                }
                if (field.type === 'TableValue') {
                    if (index === arr.length - 1 && ExpressionReturnsArray(field.value)) {
                        return `t.insert(...${generate(field.value)})`;
                    }
                    return `t.insert(${expression(field.value)})`;
                }
            })
                .join(';\n');
            return `new __lua.Table(t => {\n${fields}\n})`;
        }
        case 'UnaryExpression': {
            const operator = UNI_OP_MAP[node.operator];
            const argument = expression(node.argument);
            if (!operator) {
                throw new Error(`Unhandled unary operator: ${node.operator}`);
            }
            return `__lua.${operator}(${argument})`;
        }
        case 'BinaryExpression': {
            const left = expression(node.left);
            const right = expression(node.right);
            const operator = BIN_OP_MAP[node.operator];
            if (!operator) {
                throw new Error(`Unhandled binary operator: ${node.operator}`);
            }
            return `__lua.${operator}(${left}, ${right})`;
        }
        case 'LogicalExpression': {
            const left = expression(node.left);
            const right = expression(node.right);
            const operator = node.operator;
            if (operator === 'and') {
                return `__lua.and(${left},${right})`;
            }
            if (operator === 'or') {
                return `__lua.or(${left},${right})`;
            }
            throw new Error(`Unhandled logical operator: ${node.operator}`);
        }
        case 'MemberExpression': {
            const base = expression(node.base);
            return new MemExpr(base, `'${node.identifier.name}'`);
        }
        case 'IndexExpression': {
            const base = expression(node.base);
            const index = expression(node.index);
            return new MemExpr(base, index);
        }
        case 'CallExpression':
        case 'TableCallExpression':
        case 'StringCallExpression': {
            const functionName = expression(node.base);
            const args = node.type === 'CallExpression'
                ? parseExpressionList(node.arguments).join(', ')
                : expression(node.type === 'TableCallExpression' ? node.arguments : node.argument);
            if (functionName instanceof MemExpr && node.base.type === 'MemberExpression' && node.base.indexer === ':') {
                return `__lua.call(${functionName}, ${functionName.base}, ${args})`;
            }
            return `__lua.call(${functionName}, ${args})`;
        }
        default:
            throw new Error(`No generator found for: ${node.type}`);
    }
};
const parseBody = (node, header = '') => {
    const scope = nodeToScope.get(node);
    const scopeDef = scope === undefined ? '' : `const $${scope} = $${scopeToParentScope.get(scope)}.extend();`;
    const body = node.body.map(statement => generate(statement)).join(';\n');
    const goto = nodeToGoto.get(node);
    if (goto === undefined)
        return `${scopeDef}\n${header}\n${body}`;
    const gotoHeader = `L${goto}: do { switch(label) { case undefined:`;
    const gotoParent = gotoToParentGoto.get(goto);
    const def = gotoParent === undefined ? '' : `break; default: continue L${gotoParent}\n`;
    const footer = `${def}} } while (label)`;
    return `${scopeDef}\n${gotoHeader}\n${header}\n${body}\n${footer}`;
};
const expression = (node) => {
    const v = generate(node);
    if (ExpressionReturnsArray(node))
        return `${v}[0]`;
    return v;
};
const parseExpressions = (expressions) => {
    if (expressions.length === 1 && ExpressionReturnsArray(expressions[0])) {
        return generate(expressions[0]);
    }
    return `[${parseExpressionList(expressions).join(', ')}]`;
};
const parseExpressionList = (expressions) => {
    return expressions.map((node, index, arr) => {
        const value = generate(node);
        if (ExpressionReturnsArray(node)) {
            return index === arr.length - 1 ? `...${value}` : `${value}[0]`;
        }
        return value;
    });
};
const parseAssignments = (node) => {
    const lines = [];
    const valFns = [];
    const useTempVar = node.variables.length > 1 && node.init.length > 0 && !node.init.every(isLiteral);
    for (let i = 0; i < node.variables.length; i++) {
        const K = node.variables[i];
        const V = node.init[i];
        const initStr = useTempVar ? `vars[${i}]` : V === undefined ? 'undefined' : expression(V);
        if (K.type === 'Identifier') {
            const setStr = node.type === 'LocalStatement' ? 'setLocal' : 'set';
            lines.push(`$${nodeToScope.get(K)}.${setStr}('${K.name}', ${initStr})`);
        }
        else {
            const name = generate(K);
            if (useTempVar) {
                lines.push(`vals[${valFns.length}](${initStr})`);
                valFns.push(name.setFn());
            }
            else {
                lines.push(name.set(initStr));
            }
        }
    }
    for (let i = node.variables.length; i < node.init.length; i++) {
        const init = node.init[i];
        if (isCallExpression(init)) {
            lines.push(generate(init));
        }
    }
    if (useTempVar) {
        lines.unshift(`vars = ${parseExpressions(node.init)}`);
        if (valFns.length > 0) {
            lines.unshift(`vals = [${valFns.join(', ')}]`);
        }
    }
    return lines.join(';\n');
};
const isCallExpression = (node) => {
    return node.type === 'CallExpression' || node.type === 'StringCallExpression' || node.type === 'TableCallExpression';
};
const ExpressionReturnsArray = (node) => {
    return isCallExpression(node) || node.type === 'VarargLiteral';
};
const isLiteral = (node) => {
    return (node.type === 'StringLiteral' ||
        node.type === 'NumericLiteral' ||
        node.type === 'BooleanLiteral' ||
        node.type === 'NilLiteral' ||
        node.type === 'TableConstructorExpression');
};
const checkGoto = (ast) => {
    const gotoInfo = [];
    let gotoScope = 0;
    const gotoScopeMap = new Map();
    const getNextGotoScope = (() => {
        let id = 0;
        return () => {
            id += 1;
            return id;
        };
    })();
    const check = (node) => {
        if (isBlock(node)) {
            createGotoScope();
            for (let i = 0; i < node.body.length; i++) {
                const n = node.body[i];
                switch (n.type) {
                    case 'LocalStatement': {
                        gotoInfo.push({
                            type: 'local',
                            name: n.variables[0].name,
                            scope: gotoScope
                        });
                        break;
                    }
                    case 'LabelStatement': {
                        if (gotoInfo.find(node => node.type === 'label' && node.name === n.label.name && node.scope === gotoScope)) {
                            throw new Error(`label '${n.label.name}' already defined`);
                        }
                        gotoInfo.push({
                            type: 'label',
                            name: n.label.name,
                            scope: gotoScope,
                            last: node.type !== 'RepeatStatement' &&
                                node.body.slice(i).every(n => n.type === 'LabelStatement')
                        });
                        break;
                    }
                    case 'GotoStatement': {
                        gotoInfo.push({
                            type: 'goto',
                            name: n.label.name,
                            scope: gotoScope
                        });
                        break;
                    }
                    case 'IfStatement': {
                        n.clauses.forEach(n => check(n));
                        break;
                    }
                    default: {
                        check(n);
                    }
                }
            }
            destroyGotoScope();
        }
    };
    check(ast);
    function createGotoScope() {
        const parent = gotoScope;
        gotoScope = getNextGotoScope();
        gotoScopeMap.set(gotoScope, parent);
    }
    function destroyGotoScope() {
        gotoScope = gotoScopeMap.get(gotoScope);
    }
    for (let i = 0; i < gotoInfo.length; i++) {
        const goto = gotoInfo[i];
        if (goto.type === 'goto') {
            const label = gotoInfo
                .filter(node => node.type === 'label' && node.name === goto.name && node.scope <= goto.scope)
                .sort((a, b) => Math.abs(goto.scope - a.scope) - Math.abs(goto.scope - b.scope))[0];
            if (!label) {
                throw new Error(`no visible label '${goto.name}' for <goto>`);
            }
            const labelI = gotoInfo.findIndex(n => n === label);
            if (labelI > i) {
                const locals = gotoInfo
                    .slice(i, labelI)
                    .filter(node => node.type === 'local' && node.scope === label.scope);
                if (!label.last && locals.length > 0) {
                    throw new Error(`<goto ${goto.name}> jumps into the scope of local '${locals[0].name}'`);
                }
            }
        }
    }
};
const visitNode = (node, visitProp, nextScope, isNewScope, nextGoto) => {
    const VP = (node, partOfBlock = true) => {
        if (!node)
            return;
        const S = partOfBlock === false && isNewScope ? scopeToParentScope.get(nextScope) : nextScope;
        if (Array.isArray(node)) {
            node.forEach(n => visitProp(n, S, nextGoto));
        }
        else {
            visitProp(node, S, nextGoto);
        }
    };
    switch (node.type) {
        case 'LocalStatement':
        case 'AssignmentStatement':
            VP(node.variables);
            VP(node.init);
            break;
        case 'UnaryExpression':
            VP(node.argument);
            break;
        case 'BinaryExpression':
        case 'LogicalExpression':
            VP(node.left);
            VP(node.right);
            break;
        case 'FunctionDeclaration':
            VP(node.identifier, false);
            VP(node.parameters);
            VP(node.body);
            break;
        case 'ForGenericStatement':
            VP(node.variables);
            VP(node.iterators, false);
            VP(node.body);
            break;
        case 'IfClause':
        case 'ElseifClause':
        case 'WhileStatement':
        case 'RepeatStatement':
            VP(node.condition, false);
        case 'Chunk':
        case 'ElseClause':
        case 'DoStatement':
            VP(node.body);
            break;
        case 'ForNumericStatement':
            VP(node.variable);
            VP(node.start, false);
            VP(node.end, false);
            VP(node.step, false);
            VP(node.body);
            break;
        case 'ReturnStatement':
            VP(node.arguments);
            break;
        case 'IfStatement':
            VP(node.clauses);
            break;
        case 'MemberExpression':
            VP(node.base);
            VP(node.identifier);
            break;
        case 'IndexExpression':
            VP(node.base);
            VP(node.index);
            break;
        case 'LabelStatement':
            VP(node.label);
            break;
        case 'CallStatement':
            VP(node.expression);
            break;
        case 'GotoStatement':
            VP(node.label);
            break;
        case 'TableConstructorExpression':
            VP(node.fields);
            break;
        case 'TableKey':
        case 'TableKeyString':
            VP(node.key);
        case 'TableValue':
            VP(node.value);
            break;
        case 'CallExpression':
            VP(node.base);
            VP(node.arguments);
            break;
        case 'TableCallExpression':
            VP(node.base);
            VP(node.arguments);
            break;
        case 'StringCallExpression':
            VP(node.base);
            VP(node.argument);
    }
};
const scopeToParentScope = new Map();
const nodeToScope = new Map();
const gotoToParentGoto = new Map();
const nodeToGoto = new Map();
const setExtraInfo = (ast) => {
    let scopeID = 0;
    let gotoID = 0;
    const visitProp = (node, prevScope, prevGoto) => {
        let nextScope = prevScope;
        let nextGoto = prevGoto;
        if (isBlock(node)) {
            if (node.body.findIndex(n => n.type === 'LocalStatement' || (n.type === 'FunctionDeclaration' && n.isLocal)) !== -1 ||
                (node.type === 'FunctionDeclaration' &&
                    (node.parameters.length > 0 || (node.identifier && node.identifier.type === 'MemberExpression'))) ||
                node.type === 'ForNumericStatement' ||
                node.type === 'ForGenericStatement') {
                scopeID += 1;
                nextScope = scopeID;
                nodeToScope.set(node, scopeID);
                scopeToParentScope.set(scopeID, prevScope);
            }
            if (node.body.findIndex(s => s.type === 'LabelStatement' || s.type === 'GotoStatement') !== -1) {
                nextGoto = gotoID;
                nodeToGoto.set(node, gotoID);
                if (node.type !== 'Chunk' && node.type !== 'FunctionDeclaration') {
                    gotoToParentGoto.set(gotoID, prevGoto);
                }
                gotoID += 1;
            }
        }
        else if (node.type === 'Identifier' || node.type === 'VarargLiteral') {
            nodeToScope.set(node, prevScope);
        }
        visitNode(node, visitProp, nextScope, prevScope !== nextScope, nextGoto);
    };
    visitProp(ast, scopeID, gotoID);
};
const parse = (data) => {
    const ast = parse$1(data.replace(/^#.*/, ''), {
        scope: false,
        comments: false,
        luaVersion: '5.3',
        encodingMode: 'x-user-defined'
    });
    checkGoto(ast);
    setExtraInfo(ast);
    return generate(ast).toString();
};

const ROSETTA_STONE = {
    '([^a-zA-Z0-9%(])-': '$1*?',
    '([^%])-([^a-zA-Z0-9?])': '$1*?$2',
    '([^%])\\.': '$1[\\s\\S]',
    '(.)-$': '$1*?',
    '%a': '[a-zA-Z]',
    '%A': '[^a-zA-Z]',
    '%c': '[\x00-\x1f]',
    '%C': '[^\x00-\x1f]',
    '%d': '\\d',
    '%D': '[^d]',
    '%l': '[a-z]',
    '%L': '[^a-z]',
    '%p': '[.,"\'?!;:#$%&()*+-/<>=@\\[\\]\\\\^_{}|~]',
    '%P': '[^.,"\'?!;:#$%&()*+-/<>=@\\[\\]\\\\^_{}|~]',
    '%s': '[ \\t\\n\\f\\v\\r]',
    '%S': '[^ \t\n\f\v\r]',
    '%u': '[A-Z]',
    '%U': '[^A-Z]',
    '%w': '[a-zA-Z0-9]',
    '%W': '[^a-zA-Z0-9]',
    '%x': '[a-fA-F0-9]',
    '%X': '[^a-fA-F0-9]',
    '%([^a-zA-Z])': '\\$1'
};
function translatePattern(pattern) {
    let tPattern = pattern.replace(/\\/g, '\\\\');
    for (const i in ROSETTA_STONE) {
        if (hasOwnProperty(ROSETTA_STONE, i)) {
            tPattern = tPattern.replace(new RegExp(i, 'g'), ROSETTA_STONE[i]);
        }
    }
    let nestingLevel = 0;
    for (let i = 0, l = tPattern.length; i < l; i++) {
        if (i && tPattern.substr(i - 1, 1) === '\\') {
            continue;
        }
        const character = tPattern.substr(i, 1);
        if (character === '[' || character === ']') {
            if (character === ']') {
                nestingLevel -= 1;
            }
            if (nestingLevel > 0) {
                tPattern = tPattern.substr(0, i) + tPattern.substr(i + 1);
                i -= 1;
                l -= 1;
            }
            if (character === '[') {
                nestingLevel += 1;
            }
        }
    }
    return tPattern;
}
function byte(s, i, j) {
    const S = coerceArgToString(s, 'byte', 1);
    const I = i === undefined ? 1 : coerceArgToNumber(i, 'byte', 2);
    const J = j === undefined ? I : coerceArgToNumber(j, 'byte', 3);
    return S.substring(I - 1, J)
        .split('')
        .map(c => c.charCodeAt(0));
}
function char(...bytes) {
    return bytes
        .map((b, i) => {
        const B = coerceArgToNumber(b, 'char', i);
        return String.fromCharCode(B);
    })
        .join('');
}
function find(s, pattern, init, plain) {
    const S = coerceArgToString(s, 'find', 1);
    const P = coerceArgToString(pattern, 'find', 2);
    const INIT = init === undefined ? 1 : coerceArgToNumber(init, 'find', 3);
    const PLAIN = plain === undefined ? false : coerceArgToNumber(plain, 'find', 4);
    if (!PLAIN) {
        const regex = new RegExp(translatePattern(P));
        const index = S.substr(INIT - 1).search(regex);
        if (index < 0)
            return;
        const match = S.substr(INIT - 1).match(regex);
        const result = [index + INIT, index + INIT + match[0].length - 1];
        match.shift();
        return [...result, ...match];
    }
    const index = S.indexOf(P, INIT - 1);
    return index === -1 ? undefined : [index + 1, index + P.length];
}
function format(formatstring, ...args) {
    const PATTERN = /%%|%([-+ #0]*)?(\d*)?(?:\.(\d*))?(.)/g;
    let i = -1;
    return formatstring.replace(PATTERN, (format, flags, width, precision, modifier) => {
        if (format === '%%')
            return '%';
        if (!modifier.match(/[AEGXacdefgioqsux]/)) {
            throw new LuaError(`invalid option '%${format}' to 'format'`);
        }
        if (flags && flags.length > 5) {
            throw new LuaError(`invalid format (repeated flags)`);
        }
        if (width && width.length > 2) {
            throw new LuaError(`invalid format (width too long)`);
        }
        if (precision && precision.length > 2) {
            throw new LuaError(`invalid format (precision too long)`);
        }
        i += 1;
        const arg = args[i];
        if (arg === undefined) {
            throw new LuaError(`bad argument #${i} to 'format' (no value)`);
        }
        if (/A|a|E|e|f|G|g/.test(modifier)) {
            return sprintf(format, coerceArgToNumber(arg, 'format', i));
        }
        if (/c|d|i|o|u|X|x/.test(modifier)) {
            return sprintf(format, coerceArgToNumber(arg, 'format', i));
        }
        if (modifier === 'q') {
            return `"${arg.replace(/([\n"])/g, '\\$1')}"`;
        }
        if (modifier === 's') {
            return sprintf(format, tostring(arg));
        }
        return sprintf(format, arg);
    });
}
function gmatch(s, pattern) {
    const S = coerceArgToString(s, 'gmatch', 1);
    const P = translatePattern(coerceArgToString(pattern, 'gmatch', 2));
    const reg = new RegExp(P, 'g');
    const matches = S.match(reg);
    return () => {
        const match = matches.shift();
        if (match === undefined)
            return [];
        const groups = new RegExp(P).exec(match);
        groups.shift();
        return groups.length ? groups : [match];
    };
}
function gsub(s, pattern, repl, n) {
    let S = coerceArgToString(s, 'gsub', 1);
    const N = n === undefined ? Infinity : coerceArgToNumber(n, 'gsub', 3);
    const P = translatePattern(coerceArgToString(pattern, 'gsub', 2));
    const REPL = (() => {
        if (typeof repl === 'function')
            return strs => {
                const ret = repl(strs[0])[0];
                return ret === undefined ? strs[0] : ret;
            };
        if (repl instanceof Table)
            return strs => repl.get(strs[0]).toString();
        return strs => `${repl}`.replace(/%([0-9])/g, (_, i) => strs[i]);
    })();
    let result = '';
    let count = 0;
    let match;
    let lastMatch;
    while (count < N && S && (match = S.match(P))) {
        const prefix = match[0].length > 0 ? S.substr(0, match.index) : lastMatch === undefined ? '' : S.substr(0, 1);
        lastMatch = match[0];
        result += `${prefix}${REPL(match)}`;
        S = S.substr(`${prefix}${lastMatch}`.length);
        count += 1;
    }
    return `${result}${S}`;
}
function len(s) {
    const str = coerceArgToString(s, 'len', 1);
    return str.length;
}
function lower(s) {
    const str = coerceArgToString(s, 'lower', 1);
    return str.toLowerCase();
}
function match(s, pattern, init = 0) {
    let str = coerceArgToString(s, 'match', 1);
    const patt = coerceArgToString(pattern, 'match', 2);
    const ini = coerceArgToNumber(init, 'match', 3);
    str = str.substr(ini);
    const matches = str.match(new RegExp(translatePattern(patt)));
    if (!matches) {
        return;
    }
    else if (!matches[1]) {
        return matches[0];
    }
    matches.shift();
    return matches;
}
function rep(s, n, sep) {
    const str = coerceArgToString(s, 'rep', 1);
    const num = coerceArgToNumber(n, 'rep', 2);
    const SEP = sep === undefined ? '' : coerceArgToString(sep, 'rep', 3);
    return Array(num)
        .fill(str)
        .join(SEP);
}
function reverse(s) {
    const str = coerceArgToString(s, 'reverse', 1);
    return str
        .split('')
        .reverse()
        .join('');
}
function sub(s, i = 1, j = -1) {
    const S = coerceArgToString(s, 'sub', 1);
    let start = posrelat(coerceArgToNumber(i, 'sub', 2), S.length);
    let end = posrelat(coerceArgToNumber(j, 'sub', 3), S.length);
    if (start < 1)
        start = 1;
    if (end > S.length)
        end = S.length;
    if (start <= end)
        return S.substr(start - 1, end - start + 1);
    return '';
}
function upper(s) {
    const S = coerceArgToString(s, 'upper', 1);
    return S.toUpperCase();
}
const libString = new Table({
    byte,
    char,
    find,
    format,
    gmatch,
    gsub,
    len,
    lower,
    match,
    rep,
    reverse,
    sub,
    upper
});
const metatable = new Table({ __index: libString });

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function ipairsIterator(table, index) {
    if (index === undefined) {
        throw new LuaError('Bad argument #2 to ipairs() iterator');
    }
    const nextIndex = index + 1;
    const numValues = table.numValues;
    if (!numValues[nextIndex] || numValues[nextIndex] === undefined)
        return undefined;
    return [nextIndex, numValues[nextIndex]];
}
const _VERSION = 'Lua 5.3';
function assert(v, m) {
    if (coerceToBoolean(v))
        return [v, m];
    const msg = m === undefined ? 'Assertion failed!' : coerceArgToString(m, 'assert', 2);
    throw new LuaError(msg);
}
function collectgarbage() {
    return [];
}
function error(message) {
    const msg = coerceArgToString(message, 'error', 1);
    throw new LuaError(msg);
}
function getmetatable(table) {
    if (table instanceof Table && table.metatable) {
        const mm = table.metatable.rawget('__metatable');
        return mm ? mm : table.metatable;
    }
    if (typeof table === 'string') {
        return metatable;
    }
}
function ipairs(t) {
    const table = coerceArgToTable(t, 'ipairs', 1);
    const mm = table.getMetaMethod('__pairs') || table.getMetaMethod('__ipairs');
    return mm ? mm(table).slice(0, 3) : [ipairsIterator, table, 0];
}
function next(table, index) {
    const TABLE = coerceArgToTable(table, 'next', 1);
    let found = index === undefined;
    if (found || (typeof index === 'number' && index > 0)) {
        const numValues = TABLE.numValues;
        const keys = Object.keys(numValues);
        let i = 1;
        if (!found) {
            const I = keys.indexOf(`${index}`);
            if (I >= 0) {
                found = true;
                i += I;
            }
        }
        if (found) {
            for (i; keys[i] !== undefined; i++) {
                const key = Number(keys[i]);
                const value = numValues[key];
                if (value !== undefined)
                    return [key, value];
            }
        }
    }
    for (const i in TABLE.strValues) {
        if (hasOwnProperty(TABLE.strValues, i)) {
            if (!found) {
                if (i === index)
                    found = true;
            }
            else if (TABLE.strValues[i] !== undefined) {
                return [i, TABLE.strValues[i]];
            }
        }
    }
    for (const i in TABLE.keys) {
        if (hasOwnProperty(TABLE.keys, i)) {
            const key = TABLE.keys[i];
            if (!found) {
                if (key === index)
                    found = true;
            }
            else if (TABLE.values[i] !== undefined) {
                return [key, TABLE.values[i]];
            }
        }
    }
}
function pairs(t) {
    const table = coerceArgToTable(t, 'pairs', 1);
    const mm = table.getMetaMethod('__pairs');
    return mm ? mm(table).slice(0, 3) : [next, table, undefined];
}
function pcall(f, ...args) {
    if (typeof f !== 'function') {
        throw new LuaError('Attempt to call non-function');
    }
    try {
        return [true, ...f(...args)];
    }
    catch (e) {
        return [false, e && e.toString()];
    }
}
function rawequal(v1, v2) {
    return v1 === v2;
}
function rawget(table, index) {
    const TABLE = coerceArgToTable(table, 'rawget', 1);
    return TABLE.rawget(index);
}
function rawlen(v) {
    if (v instanceof Table)
        return v.getn();
    if (typeof v === 'string')
        return v.length;
    throw new LuaError('attempt to get length of an unsupported value');
}
function rawset(table, index, value) {
    const TABLE = coerceArgToTable(table, 'rawset', 1);
    if (index === undefined)
        throw new LuaError('table index is nil');
    TABLE.rawset(index, value);
    return TABLE;
}
function select(index, ...args) {
    if (index === '#') {
        return args.length;
    }
    if (typeof index === 'number') {
        const pos = posrelat(Math.trunc(index), args.length);
        return args.slice(pos - 1);
    }
    throw new LuaError(`bad argument #1 to 'select' (number expected, got ${type(index)})`);
}
function setmetatable(table, metatable) {
    const TABLE = coerceArgToTable(table, 'setmetatable', 1);
    if (TABLE.metatable && TABLE.metatable.rawget('__metatable')) {
        throw new LuaError('cannot change a protected metatable');
    }
    TABLE.metatable = metatable === null || metatable === undefined ? null : coerceArgToTable(metatable, 'setmetatable', 2);
    return TABLE;
}
function tonumber(e, base) {
    const E = coerceToString(e).trim();
    const BASE = base === undefined ? 10 : coerceArgToNumber(base, 'tonumber', 2);
    if (BASE !== 10 && E === 'nil') {
        throw new LuaError("bad argument #1 to 'tonumber' (string expected, got nil)");
    }
    if (BASE < 2 || BASE > 36) {
        throw new LuaError(`bad argument #2 to 'tonumber' (base out of range)`);
    }
    if (E === '')
        return;
    if (BASE === 10)
        return coerceToNumber(E);
    const pattern = new RegExp(`^${BASE === 16 ? '(0x)?' : ''}[${CHARS.substr(0, BASE)}]*$`, 'gi');
    if (!pattern.test(E))
        return;
    return parseInt(E, BASE);
}
function xpcall(f, msgh, ...args) {
    if (typeof f !== 'function' || typeof msgh !== 'function') {
        throw new LuaError('Attempt to call non-function');
    }
    try {
        return [true, ...f(...args)];
    }
    catch (e) {
        return [false, msgh(e)[0]];
    }
}
function createG(cfg, execChunk) {
    function print(...args) {
        const output = args.map(arg => tostring(arg)).join('\t');
        cfg.stdout(output);
    }
    function load(chunk, _chunkname, _mode, env) {
        let C = '';
        if (chunk instanceof Function) {
            let ret = ' ';
            while (ret !== '' && ret !== undefined) {
                C += ret;
                ret = chunk()[0];
            }
        }
        else {
            C = coerceArgToString(chunk, 'load', 1);
        }
        let parsed;
        try {
            parsed = parse(C);
        }
        catch (e) {
            return [undefined, e.message];
        }
        return () => execChunk(env || _G, parsed);
    }
    function dofile(filename) {
        const res = loadfile(filename);
        if (Array.isArray(res) && res[0] === undefined) {
            throw new LuaError(res[1]);
        }
        const exec = res;
        return exec();
    }
    function loadfile(filename, mode, env) {
        const FILENAME = filename === undefined ? cfg.stdin : coerceArgToString(filename, 'loadfile', 1);
        if (!cfg.fileExists) {
            throw new LuaError('loadfile requires the config.fileExists function');
        }
        if (!cfg.fileExists(FILENAME))
            return [undefined, 'file not found'];
        if (!cfg.loadFile) {
            throw new LuaError('loadfile requires the config.loadFile function');
        }
        return load(cfg.loadFile(FILENAME), FILENAME, mode, env);
    }
    const _G = new Table({
        _VERSION,
        assert,
        dofile,
        collectgarbage,
        error,
        getmetatable,
        ipairs,
        load,
        loadfile,
        next,
        pairs,
        pcall,
        print,
        rawequal,
        rawget,
        rawlen,
        rawset,
        select,
        setmetatable,
        tonumber,
        tostring,
        type,
        xpcall
    });
    return _G;
}

const maxinteger = Number.MAX_SAFE_INTEGER;
const mininteger = Number.MIN_SAFE_INTEGER;
const huge = Infinity;
const pi = Math.PI;
let randomSeed = 1;
function getRandom() {
    randomSeed = (16807 * randomSeed) % 2147483647;
    return randomSeed / 2147483647;
}
function abs(x) {
    const X = coerceArgToNumber(x, 'abs', 1);
    return Math.abs(X);
}
function acos(x) {
    const X = coerceArgToNumber(x, 'acos', 1);
    return Math.acos(X);
}
function asin(x) {
    const X = coerceArgToNumber(x, 'asin', 1);
    return Math.asin(X);
}
function atan(y, x) {
    const Y = coerceArgToNumber(y, 'atan', 1);
    const X = x === undefined ? 1 : coerceArgToNumber(x, 'atan', 2);
    return Math.atan2(Y, X);
}
function atan2(y, x) {
    return atan(y, x);
}
function ceil(x) {
    const X = coerceArgToNumber(x, 'ceil', 1);
    return Math.ceil(X);
}
function cos(x) {
    const X = coerceArgToNumber(x, 'cos', 1);
    return Math.cos(X);
}
function cosh(x) {
    const X = coerceArgToNumber(x, 'cosh', 1);
    return (exp(X) + exp(-X)) / 2;
}
function deg(x) {
    const X = coerceArgToNumber(x, 'deg', 1);
    return (X * 180) / Math.PI;
}
function exp(x) {
    const X = coerceArgToNumber(x, 'exp', 1);
    return Math.exp(X);
}
function floor(x) {
    const X = coerceArgToNumber(x, 'floor', 1);
    return Math.floor(X);
}
function fmod(x, y) {
    const X = coerceArgToNumber(x, 'fmod', 1);
    const Y = coerceArgToNumber(y, 'fmod', 2);
    return X % Y;
}
function frexp(x) {
    let X = coerceArgToNumber(x, 'frexp', 1);
    if (X === 0) {
        return [0, 0];
    }
    const delta = X > 0 ? 1 : -1;
    X *= delta;
    const exponent = Math.floor(Math.log(X) / Math.log(2)) + 1;
    const mantissa = X / Math.pow(2, exponent);
    return [mantissa * delta, exponent];
}
function ldexp(m, e) {
    const M = coerceArgToNumber(m, 'ldexp', 1);
    const E = coerceArgToNumber(e, 'ldexp', 2);
    return M * Math.pow(2, E);
}
function log(x, base) {
    const X = coerceArgToNumber(x, 'log', 1);
    if (base === undefined) {
        return Math.log(X);
    }
    else {
        const B = coerceArgToNumber(base, 'log', 2);
        return Math.log(X) / Math.log(B);
    }
}
function log10(x) {
    const X = coerceArgToNumber(x, 'log10', 1);
    return Math.log(X) / Math.log(10);
}
function max(...args) {
    const ARGS = args.map((n, i) => coerceArgToNumber(n, 'max', i + 1));
    return Math.max(...ARGS);
}
function min(...args) {
    const ARGS = args.map((n, i) => coerceArgToNumber(n, 'min', i + 1));
    return Math.min(...ARGS);
}
function modf(x) {
    const X = coerceArgToNumber(x, 'modf', 1);
    const intValue = Math.floor(X);
    const mantissa = X - intValue;
    return [intValue, mantissa];
}
function pow(x, y) {
    const X = coerceArgToNumber(x, 'pow', 1);
    const Y = coerceArgToNumber(y, 'pow', 2);
    return Math.pow(X, Y);
}
function rad(x) {
    const X = coerceArgToNumber(x, 'rad', 1);
    return (Math.PI / 180) * X;
}
function random(min, max) {
    if (min === undefined && max === undefined)
        return getRandom();
    const firstArg = coerceArgToNumber(min, 'random', 1);
    const MIN = max !== undefined ? firstArg : 1;
    const MAX = max !== undefined ? coerceArgToNumber(max, 'random', 2) : firstArg;
    if (MIN > MAX)
        throw new Error("bad argument #2 to 'random' (interval is empty)");
    return Math.floor(getRandom() * (MAX - MIN + 1) + MIN);
}
function randomseed(x) {
    randomSeed = coerceArgToNumber(x, 'randomseed', 1);
}
function sin(x) {
    const X = coerceArgToNumber(x, 'sin', 1);
    return Math.sin(X);
}
function sinh(x) {
    const X = coerceArgToNumber(x, 'sinh', 1);
    return (exp(X) - exp(-X)) / 2;
}
function sqrt(x) {
    const X = coerceArgToNumber(x, 'sqrt', 1);
    return Math.sqrt(X);
}
function tan(x) {
    const X = coerceArgToNumber(x, 'tan', 1);
    return Math.tan(X);
}
function tanh(x) {
    const X = coerceArgToNumber(x, 'tanh', 1);
    return (exp(X) - exp(-X)) / (exp(X) + exp(-X));
}
function tointeger(x) {
    const X = coerceToNumber(x);
    if (X === undefined)
        return undefined;
    return Math.floor(X);
}
function type$1(x) {
    const X = coerceToNumber(x);
    if (X === undefined)
        return undefined;
    if (tointeger(X) === X)
        return 'integer';
    return 'float';
}
function ult(m, n) {
    const M = coerceArgToNumber(m, 'ult', 1);
    const N = coerceArgToNumber(n, 'ult', 2);
    const toUnsigned = (n) => n >>> 0;
    return toUnsigned(M) < toUnsigned(N);
}
const libMath = new Table({
    abs,
    acos,
    asin,
    atan,
    atan2,
    ceil,
    cos,
    cosh,
    deg,
    exp,
    floor,
    fmod,
    frexp,
    huge,
    ldexp,
    log,
    log10,
    max,
    min,
    maxinteger,
    mininteger,
    modf,
    pi,
    pow,
    rad,
    random,
    randomseed,
    sin,
    sinh,
    sqrt,
    tan,
    tanh,
    tointeger,
    type: type$1,
    ult
});

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const DATE_FORMAT_HANDLERS = {
    '%': () => '%',
    Y: (date, utc) => `${utc ? date.getUTCFullYear() : date.getFullYear()}`,
    y: (date, utc) => DATE_FORMAT_HANDLERS.Y(date, utc).substr(-2),
    b: (date, utc) => DATE_FORMAT_HANDLERS.B(date, utc).substr(0, 3),
    B: (date, utc) => MONTHS[utc ? date.getUTCMonth() : date.getMonth()],
    m: (date, utc) => `0${(utc ? date.getUTCMonth() : date.getMonth()) + 1}`.substr(-2),
    U: (date, utc) => getWeekOfYear(date, 0, utc),
    W: (date, utc) => getWeekOfYear(date, 1, utc),
    j: (date, utc) => {
        let result = utc ? date.getUTCDate() : date.getDate();
        const month = utc ? date.getUTCMonth() : date.getMonth();
        const year = utc ? date.getUTCFullYear() : date.getFullYear();
        result += DAYS_IN_MONTH.slice(0, month).reduce((sum, n) => sum + n, 0);
        if (month > 1 && year % 4 === 0) {
            result += 1;
        }
        return `00${result}`.substr(-3);
    },
    d: (date, utc) => `0${utc ? date.getUTCDate() : date.getDate()}`.substr(-2),
    a: (date, utc) => DATE_FORMAT_HANDLERS.A(date, utc).substr(0, 3),
    A: (date, utc) => DAYS[utc ? date.getUTCDay() : date.getDay()],
    w: (date, utc) => `${utc ? date.getUTCDay() : date.getDay()}`,
    H: (date, utc) => `0${utc ? date.getUTCHours() : date.getHours()}`.substr(-2),
    I: (date, utc) => `0${(utc ? date.getUTCHours() : date.getHours()) % 12 || 12}`.substr(-2),
    M: (date, utc) => `0${utc ? date.getUTCMinutes() : date.getMinutes()}`.substr(-2),
    S: (date, utc) => `0${utc ? date.getUTCSeconds() : date.getSeconds()}`.substr(-2),
    c: (date, utc) => date.toLocaleString(undefined, utc ? { timeZone: 'UTC' } : undefined),
    x: (date, utc) => {
        const m = DATE_FORMAT_HANDLERS.m(date, utc);
        const d = DATE_FORMAT_HANDLERS.d(date, utc);
        const y = DATE_FORMAT_HANDLERS.y(date, utc);
        return `${m}/${d}/${y}`;
    },
    X: (date, utc) => {
        const h = DATE_FORMAT_HANDLERS.H(date, utc);
        const m = DATE_FORMAT_HANDLERS.M(date, utc);
        const s = DATE_FORMAT_HANDLERS.S(date, utc);
        return `${h}:${m}:${s}`;
    },
    p: (date, utc) => ((utc ? date.getUTCHours() : date.getHours()) < 12 ? 'AM' : 'PM'),
    Z: (date, utc) => {
        if (utc)
            return 'UTC';
        const match = date.toString().match(/[A-Z][A-Z][A-Z]/);
        return match ? match[0] : '';
    }
};
function isDST(date) {
    const year = date.getFullYear();
    const jan = new Date(year, 0);
    return date.getTimezoneOffset() !== jan.getTimezoneOffset();
}
function getWeekOfYear(date, firstDay, utc) {
    const dayOfYear = parseInt(DATE_FORMAT_HANDLERS.j(date, utc), 10);
    const jan1 = new Date(date.getFullYear(), 0, 1, 12);
    const offset = (8 - (utc ? jan1.getUTCDay() : jan1.getDay()) + firstDay) % 7;
    return `0${Math.floor((dayOfYear - offset) / 7) + 1}`.substr(-2);
}
function date(input = '%c', time) {
    const utc = input.substr(0, 1) === '!';
    const string = utc ? input.substr(1) : input;
    const date = new Date();
    if (time) {
        date.setTime(time * 1000);
    }
    if (string === '*t') {
        return new Table({
            year: parseInt(DATE_FORMAT_HANDLERS.Y(date, utc), 10),
            month: parseInt(DATE_FORMAT_HANDLERS.m(date, utc), 10),
            day: parseInt(DATE_FORMAT_HANDLERS.d(date, utc), 10),
            hour: parseInt(DATE_FORMAT_HANDLERS.H(date, utc), 10),
            min: parseInt(DATE_FORMAT_HANDLERS.M(date, utc), 10),
            sec: parseInt(DATE_FORMAT_HANDLERS.S(date, utc), 10),
            wday: parseInt(DATE_FORMAT_HANDLERS.w(date, utc), 10) + 1,
            yday: parseInt(DATE_FORMAT_HANDLERS.j(date, utc), 10),
            isdst: isDST(date)
        });
    }
    return string.replace(/%[%YybBmUWjdaAwHIMScxXpZ]/g, f => DATE_FORMAT_HANDLERS[f[1]](date, utc));
}
function setlocale(locale = 'C') {
    if (locale === 'C')
        return 'C';
}
function time(table) {
    let now = Math.round(Date.now() / 1000);
    if (!table)
        return now;
    const year = table.rawget('year');
    const month = table.rawget('month');
    const day = table.rawget('day');
    const hour = table.rawget('hour') || 12;
    const min = table.rawget('min');
    const sec = table.rawget('sec');
    if (year)
        now += year * 31557600;
    if (month)
        now += month * 2629800;
    if (day)
        now += day * 86400;
    if (hour)
        now += hour * 3600;
    if (min)
        now += min * 60;
    if (sec)
        now += sec;
    return now;
}
function difftime(t2, t1) {
    const T2 = coerceArgToNumber(t2, 'difftime', 1);
    const T1 = coerceArgToNumber(t1, 'difftime', 2);
    return T2 - T1;
}
const getLibOS = (cfg) => {
    function exit(code) {
        if (!cfg.osExit)
            throw new LuaError('os.exit requires the config.osExit function');
        let CODE = 0;
        if (typeof code === 'boolean' && code === false)
            CODE = 1;
        else if (typeof code === 'number')
            CODE = code;
        cfg.osExit(CODE);
    }
    return new Table({
        date,
        exit,
        setlocale,
        time,
        difftime
    });
};

const getLibPackage = (execModule, cfg) => {
    const LUA_DIRSEP = '/';
    const LUA_PATH_SEP = ';';
    const LUA_PATH_MARK = '?';
    const LUA_EXEC_DIR = '!';
    const LUA_IGMARK = '-';
    const LUA_PATH = cfg.LUA_PATH;
    const config = [LUA_DIRSEP, LUA_PATH_SEP, LUA_PATH_MARK, LUA_EXEC_DIR, LUA_IGMARK].join('\n');
    const loaded = new Table();
    const preload = new Table();
    const searchpath = (name, path, sep, rep) => {
        if (!cfg.fileExists) {
            throw new LuaError('package.searchpath requires the config.fileExists function');
        }
        let NAME = coerceArgToString(name, 'searchpath', 1);
        const PATH = coerceArgToString(path, 'searchpath', 2);
        const SEP = sep === undefined ? '.' : coerceArgToString(sep, 'searchpath', 3);
        const REP = rep === undefined ? '/' : coerceArgToString(rep, 'searchpath', 4);
        NAME = NAME.replace(SEP, REP);
        const paths = PATH.split(';').map(template => template.replace('?', NAME));
        for (const path of paths) {
            if (cfg.fileExists(path))
                return path;
        }
        return [undefined, `The following files don't exist: ${paths.join(' ')}`];
    };
    const searchers = new Table([
        (moduleName) => {
            const res = preload.rawget(moduleName);
            if (res === undefined) {
                return [undefined];
            }
            return [res];
        },
        (moduleName) => {
            const res = searchpath(moduleName, libPackage.rawget('path'));
            if (Array.isArray(res) && res[0] === undefined) {
                return [res[1]];
            }
            if (!cfg.loadFile) {
                throw new LuaError('package.searchers requires the config.loadFile function');
            }
            return [(moduleName, path) => execModule(cfg.loadFile(path), moduleName), res];
        }
    ]);
    function _require(modname) {
        const MODNAME = coerceArgToString(modname, 'require', 1);
        const module = loaded.rawget(MODNAME);
        if (module)
            return module;
        const searcherFns = searchers.numValues.filter(fn => !!fn);
        for (const searcher of searcherFns) {
            const res = searcher(MODNAME);
            if (res[0] !== undefined && typeof res[0] !== 'string') {
                const loader = res[0];
                const result = loader(MODNAME, res[1]);
                const module = result === undefined ? true : result;
                loaded.rawset(MODNAME, module);
                return module;
            }
        }
        throw new LuaError(`Module '${MODNAME}' not found!`);
    }
    const libPackage = new Table({
        path: LUA_PATH,
        config,
        loaded,
        preload,
        searchers,
        searchpath
    });
    return { libPackage, _require };
};

function getn(table) {
    const TABLE = coerceArgToTable(table, 'getn', 1);
    return TABLE.getn();
}
function concat(table, sep = '', i = 1, j) {
    const TABLE = coerceArgToTable(table, 'concat', 1);
    const SEP = coerceArgToString(sep, 'concat', 2);
    const I = coerceArgToNumber(i, 'concat', 3);
    const J = j === undefined ? maxn(TABLE) : coerceArgToNumber(j, 'concat', 4);
    return []
        .concat(TABLE.numValues)
        .splice(I, J - I + 1)
        .join(SEP);
}
function insert(table, pos, value) {
    const TABLE = coerceArgToTable(table, 'insert', 1);
    const POS = value === undefined ? TABLE.numValues.length : coerceArgToNumber(pos, 'insert', 2);
    const VALUE = value === undefined ? pos : value;
    TABLE.numValues.splice(POS, 0, undefined);
    TABLE.set(POS, VALUE);
}
function maxn(table) {
    const TABLE = coerceArgToTable(table, 'maxn', 1);
    return TABLE.numValues.length - 1;
}
function move(a1, f, e, t, a2) {
    const A1 = coerceArgToTable(a1, 'move', 1);
    const F = coerceArgToNumber(f, 'move', 2);
    const E = coerceArgToNumber(e, 'move', 3);
    const T = coerceArgToNumber(t, 'move', 4);
    const A2 = a2 === undefined ? A1 : coerceArgToTable(a2, 'move', 5);
    if (E >= F) {
        if (F <= 0 && E >= Number.MAX_SAFE_INTEGER + F)
            throw new LuaError('too many elements to move');
        const n = E - F + 1;
        if (T > Number.MAX_SAFE_INTEGER - n + 1)
            throw new LuaError('destination wrap around');
        if (T > E || T <= F || A2 !== A1) {
            for (let i = 0; i < n; i++) {
                const v = A1.get(F + i);
                A2.set(T + i, v);
            }
        }
        else {
            for (let i = n - 1; i >= 0; i--) {
                const v = A1.get(F + i);
                A2.set(T + i, v);
            }
        }
    }
    return A2;
}
function pack(...args) {
    const table = new Table(args);
    table.rawset('n', args.length);
    return table;
}
function remove(table, pos) {
    const TABLE = coerceArgToTable(table, 'remove', 1);
    const max = TABLE.getn();
    const POS = pos === undefined ? max : coerceArgToNumber(pos, 'remove', 2);
    if (POS > max || POS < 0) {
        return;
    }
    const vals = TABLE.numValues;
    const result = vals.splice(POS, 1)[0];
    let i = POS;
    while (i < max && vals[i] === undefined) {
        delete vals[i];
        i += 1;
    }
    return result;
}
function sort(table, comp) {
    const TABLE = coerceArgToTable(table, 'sort', 1);
    let sortFunc;
    if (comp) {
        const COMP = coerceArgToFunction(comp, 'sort', 2);
        sortFunc = (a, b) => (coerceToBoolean(COMP(a, b)[0]) ? -1 : 1);
    }
    else {
        sortFunc = (a, b) => (a < b ? -1 : 1);
    }
    const arr = TABLE.numValues;
    arr.shift();
    arr.sort(sortFunc).unshift(undefined);
}
function unpack(table, i, j) {
    const TABLE = coerceArgToTable(table, 'unpack', 1);
    const I = i === undefined ? 1 : coerceArgToNumber(i, 'unpack', 2);
    const J = j === undefined ? TABLE.getn() : coerceArgToNumber(j, 'unpack', 3);
    return TABLE.numValues.slice(I, J + 1);
}
const libTable = new Table({
    getn,
    concat,
    insert,
    maxn,
    move,
    pack,
    remove,
    sort,
    unpack
});

const binaryArithmetic = (left, right, metaMethodName, callback) => {
    const mm = (left instanceof Table && left.getMetaMethod(metaMethodName)) ||
        (right instanceof Table && right.getMetaMethod(metaMethodName));
    if (mm)
        return mm(left, right)[0];
    const L = coerceToNumber(left, 'attempt to perform arithmetic on a %type value');
    const R = coerceToNumber(right, 'attempt to perform arithmetic on a %type value');
    return callback(L, R);
};
const binaryBooleanArithmetic = (left, right, metaMethodName, callback) => {
    if ((typeof left === 'string' && typeof right === 'string') ||
        (typeof left === 'number' && typeof right === 'number')) {
        return callback(left, right);
    }
    return binaryArithmetic(left, right, metaMethodName, callback);
};
const bool = (value) => coerceToBoolean(value);
const and = (l, r) => coerceToBoolean(l) ? r : l;
const or = (l, r) => coerceToBoolean(l) ? l : r;
const not = (value) => !bool(value);
const unm = (value) => {
    const mm = value instanceof Table && value.getMetaMethod('__unm');
    if (mm)
        return mm(value)[0];
    return -1 * coerceToNumber(value, 'attempt to perform arithmetic on a %type value');
};
const bnot = (value) => {
    const mm = value instanceof Table && value.getMetaMethod('__bnot');
    if (mm)
        return mm(value)[0];
    return ~coerceToNumber(value, 'attempt to perform arithmetic on a %type value');
};
const len$1 = (value) => {
    if (value instanceof Table) {
        const mm = value.getMetaMethod('__len');
        if (mm)
            return mm(value)[0];
        return value.getn();
    }
    if (typeof value === 'string')
        return value.length;
    throw new LuaError('attempt to get length of an unsupported value');
};
const add = (left, right) => binaryArithmetic(left, right, '__add', (l, r) => l + r);
const sub$1 = (left, right) => binaryArithmetic(left, right, '__sub', (l, r) => l - r);
const mul = (left, right) => binaryArithmetic(left, right, '__mul', (l, r) => l * r);
const mod = (left, right) => binaryArithmetic(left, right, '__mod', (l, r) => {
    if (r === 0 || r === -Infinity || r === Infinity || isNaN(l) || isNaN(r))
        return NaN;
    const absR = Math.abs(r);
    let result = Math.abs(l) % absR;
    if (l * r < 0)
        result = absR - result;
    if (r < 0)
        result *= -1;
    return result;
});
const pow$1 = (left, right) => binaryArithmetic(left, right, '__pow', Math.pow);
const div = (left, right) => binaryArithmetic(left, right, '__div', (l, r) => {
    if (r === undefined)
        throw new LuaError('attempt to perform arithmetic on a nil value');
    return l / r;
});
const idiv = (left, right) => binaryArithmetic(left, right, '__idiv', (l, r) => {
    if (r === undefined)
        throw new LuaError('attempt to perform arithmetic on a nil value');
    return Math.floor(l / r);
});
const band = (left, right) => binaryArithmetic(left, right, '__band', (l, r) => l & r);
const bor = (left, right) => binaryArithmetic(left, right, '__bor', (l, r) => l | r);
const bxor = (left, right) => binaryArithmetic(left, right, '__bxor', (l, r) => l ^ r);
const shl = (left, right) => binaryArithmetic(left, right, '__shl', (l, r) => l << r);
const shr = (left, right) => binaryArithmetic(left, right, '__shr', (l, r) => l >> r);
const concat$1 = (left, right) => {
    const mm = (left instanceof Table && left.getMetaMethod('__concat')) ||
        (right instanceof Table && right.getMetaMethod('__concat'));
    if (mm)
        return mm(left, right)[0];
    const L = coerceToString(left, 'attempt to concatenate a %type value');
    const R = coerceToString(right, 'attempt to concatenate a %type value');
    return `${L}${R}`;
};
const neq = (left, right) => !eq(left, right);
const eq = (left, right) => {
    const mm = right !== left &&
        left instanceof Table &&
        right instanceof Table &&
        left.metatable === right.metatable &&
        left.getMetaMethod('__eq');
    if (mm)
        return !!mm(left, right)[0];
    return left === right;
};
const lt = (left, right) => binaryBooleanArithmetic(left, right, '__lt', (l, r) => l < r);
const le = (left, right) => binaryBooleanArithmetic(left, right, '__le', (l, r) => l <= r);
const gt = (left, right) => !le(left, right);
const ge = (left, right) => !lt(left, right);
const operators = {
    bool,
    and,
    or,
    not,
    unm,
    bnot,
    len: len$1,
    add,
    sub: sub$1,
    mul,
    mod,
    pow: pow$1,
    div,
    idiv,
    band,
    bor,
    bxor,
    shl,
    shr,
    concat: concat$1,
    neq,
    eq,
    lt,
    le,
    gt,
    ge,
};

const call = (f, ...args) => {
    if (f instanceof Function)
        return ensureArray(f(...args));
    const mm = f instanceof Table && f.getMetaMethod('__call');
    if (mm)
        return ensureArray(mm(f, ...args));
    throw new LuaError(`attempt to call an uncallable type`);
};
const stringTable = new Table();
stringTable.metatable = metatable;
const get = (t, v) => {
    if (t instanceof Table)
        return t.get(v);
    if (typeof t === 'string')
        return stringTable.get(v);
    throw new LuaError(`no table or metatable found for given type`);
};
const execChunk = (_G, chunk, chunkName) => {
    const exec = new Function('__lua', chunk);
    const globalScope = new Scope(_G.strValues).extend();
    if (chunkName)
        globalScope.setVarargs([chunkName]);
    const res = exec(Object.assign(Object.assign({ globalScope }, operators), { Table,
        call,
        get }));
    return res === undefined ? [undefined] : res;
};
function createEnv(config = {}) {
    const cfg = Object.assign({ LUA_PATH: './?.lua', stdin: '', stdout: console.log }, config);
    const _G = createG(cfg, execChunk);
    const { libPackage, _require } = getLibPackage((content, moduleName) => execChunk(_G, parse(content), moduleName)[0], cfg);
    const loaded = libPackage.get('loaded');
    const loadLib = (name, value) => {
        _G.rawset(name, value);
        loaded.rawset(name, value);
    };
    loadLib('_G', _G);
    loadLib('package', libPackage);
    loadLib('math', libMath);
    loadLib('table', libTable);
    loadLib('string', libString);
    loadLib('os', getLibOS(cfg));
    _G.rawset('require', _require);
    const parse$1 = (code) => {
        const script = parse(code);
        return {
            exec: () => execChunk(_G, script)[0]
        };
    };
    const parseFile = (filename) => {
        if (!cfg.fileExists)
            throw new LuaError('parseFile requires the config.fileExists function');
        if (!cfg.loadFile)
            throw new LuaError('parseFile requires the config.loadFile function');
        if (!cfg.fileExists(filename))
            throw new LuaError('file not found');
        return parse$1(cfg.loadFile(filename));
    };
    return {
        parse: parse$1,
        parseFile,
        loadLib
    };
}

export { LuaError, Table, createEnv, utils };
//# sourceMappingURL=lua-in-js.es.js.map
