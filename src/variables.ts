import { CRuntime } from "./rt"

const arithmeticSig = {
    "I8": {},
    "U8": {},
    "I16": {},
    "U16": {},
    "I32": {},
    "U32": {},
    "I64": {},
    "U64": {},
    "F32": {},
    "F64": {},
    "BOOL": {},
} as const;

export interface ArithmeticProperties {
    name: string,
    isSigned: boolean,
    isFloat: boolean,
    bytes: number,
    minv: number,
    maxv: number,
    asSigned: ArithmeticSig
}

const arithmeticProperties: { [x in ArithmeticSig]: ArithmeticProperties } = {
    "I8": {
        name: "signed char",
        isSigned: true,
        isFloat: false,
        bytes: 1,
        minv: -128,
        maxv: 127,
        asSigned: "I8",
    },
    "U8": {
        name: "unsigned char",
        isSigned: false,
        isFloat: false,
        bytes: 1,
        minv: 0,
        maxv: 255,
        asSigned: "I8",
    },
    "I16": {
        name: "short int",
        isSigned: true,
        isFloat: false,
        bytes: 2,
        minv: -32768,
        maxv: 32767,
        asSigned: "I16",
    },
    "U16": {
        name: "unsigned short int",
        isSigned: false,
        isFloat: false,
        bytes: 2,
        minv: 0,
        maxv: 65535,
        asSigned: "I16",
    },
    "I32": {
        name: "long int",
        isSigned: true,
        isFloat: false,
        bytes: 4,
        minv: -2147483648,
        maxv: 2147483647,
        asSigned: "I32",
    },
    "U32": {
        name: "unsigned long int",
        isSigned: false,
        isFloat: false,
        bytes: 4,
        minv: 0,
        maxv: 4294967295,
        asSigned: "I32",
    },
    "I64": {
        name: "long long int",
        isSigned: true,
        isFloat: false,
        bytes: 8,
        minv: -9223372036854775808,
        maxv: 9223372036854775807,
        asSigned: "I64",
    },
    "U64": {
        name: "unsigned long long int",
        isSigned: false,
        isFloat: false,
        bytes: 8,
        minv: 0,
        maxv: 18446744073709551615,
        asSigned: "I64",
    },
    "F32": {
        name: "float",
        isSigned: true,
        isFloat: true,
        bytes: 4,
        minv: -3.4028235E+38,
        maxv: 3.4028235E+38,
        asSigned: "F32",
    },
    "F64": {
        name: "double",
        isSigned: true,
        isFloat: true,
        bytes: 8,
        minv: -10E+308,
        maxv: 10E+308,
        asSigned: "F64",
    },
    "BOOL": {
        name: "bool",
        isSigned: false,
        isFloat: false,
        bytes: 1,
        minv: 0,
        maxv: 1,
        asSigned: "I8",
    },
};

export type ArithmeticSig = keyof (typeof arithmeticSig);

const defaultArithmeticResolutionMap: { [x: string]: ArithmeticSig } = {
    "char": "I8",
    "signed char": "I8",
    "unsigned char": "U8",
    "wchar_t": "I32",
    "unsigned wchar_t": "U32",
    "short": "I16",
    "short int": "I16",
    "signed short": "I16",
    "signed short int": "I16",
    "unsigned short": "U16",
    "unsigned short int": "U16",
    "int": "I32",
    "signed int": "I32",
    "unsigned int": "U32",
    "long": "I32",
    "long int": "I32",
    "signed long": "I32",
    "signed long int": "I32",
    "unsigned long": "U32",
    "unsigned long int": "U32",
    "long long": "I64",
    "long long int": "I64",
    "signed long long": "I64",
    "signed long long int": "I64",
    "unsigned long long": "U64",
    "unsigned long long int": "U64",
    "bool": "BOOL",
    "float": "F32",
    "double": "F64",
    "long double": "F64",
}

export interface ArithmeticType {
    sig: ArithmeticSig,
}

export interface PointerType {
    sig: "PTR",
    pointee: ObjectType | FunctionType | VoidType, // OBJECT | FUNCTION | VOID
}

// this includes both "class" and "struct" types
export interface ClassType {
    sig: "CLASS",
    identifier: string,
    templateSpec: ObjectType[],
    memberOf: ClassType | null,
}

export interface FunctionType {
    sig: "FUNCTION",
    fulltype: string[],
}

export interface StaticArrayType {
    sig: "ARRAY",
    object: ObjectType,
    size: number,
}

export interface DynamicArrayType {
    sig: "DYNARRAY",
    object: ObjectType,
}

export interface IndexPointerType {
    sig: "INDEXPTR",
    array: StaticArrayType | DynamicArrayType;
}

export interface VoidType {
    sig: "VOID",
}

/** Any type that a variable can have */
export type ObjectType = ArithmeticType | ClassType | PointerType | StaticArrayType | DynamicArrayType | IndexPointerType;

/** Any type that a variable can have + direct function type + void type.
  * Do not use this for checking variables, use `ObjectType` instead. */
export type AnyType = ObjectType | FunctionType | VoidType;

/** Variable type with specified value type (lvalue or non-lvalue).
  * Intended to be cast from Variable | Function types. */
export interface MaybeLeft<T> {
    t: T,
    left: boolean,
}

/** Variable type with specified value type (lvalue or non-lvalue)
  * and a c-v qualifier (const or volatile).
  * Intended to be cast from Variable | Function types. */
export interface MaybeLeftCV<T> {
    t: T,
    left: boolean,
    readonly: boolean,
}

export interface ArithmeticValue {
    value: number
}

export interface ArrayValue {
    values: ObjectValue[],
}

export interface ClassValue {
    members: { [name: string]: Variable };
}

export interface PointerValue {
    pointee: ObjectValue | FunctionValue | "VOID";
}

export interface IndexPointerValue {
    index: number,
    pointee: ArrayValue,
}

export interface FunctionValue {
    target: CFunction | null;
    name: string;
    bindThis: ClassVariable | null;
}
export type ObjectValue = ArithmeticValue | ArrayValue | ClassValue | PointerValue | IndexPointerValue;

export interface ArithmeticVariable {
    left: boolean;
    readonly: boolean;
    t: ArithmeticType;
    v: ArithmeticValue;
}
export interface ArithmeticVariable1 {
    readonly: boolean;
    v: ArithmeticValue;
}

export interface StaticArrayVariable {
    left: boolean;
    readonly: boolean;
    t: StaticArrayType;
    v: ArrayValue;
}
export interface DynamicArrayVariable {
    left: boolean;
    readonly: boolean;
    t: DynamicArrayType;
    v: ArrayValue;
}
export interface Function {
    left: boolean;
    readonly: boolean;
    t: FunctionType;
    v: FunctionValue;
}
export interface ClassVariable {
    left: boolean;
    readonly: boolean;
    t: ClassType;
    v: ClassValue;
}
export interface PointerVariable {
    left: boolean;
    readonly: boolean;
    t: PointerType;
    v: PointerValue;
}
// alias to 'PTR [t.array.object]' in typecheck notation
export interface IndexPointerVariable {
    left: boolean;
    readonly: boolean;
    t: IndexPointerType;
    v: IndexPointerValue;
}

// Equals to 'Object' in typecheck notation
export type Variable = ArithmeticVariable | StaticArrayVariable | DynamicArrayVariable | ClassVariable | PointerVariable | IndexPointerVariable;

export type CFunction = (rt: CRuntime, _this: Variable, ...args: Variable[]) => Variable | Generator<unknown,any,unknown>;

export const variables = {
    voidType(): VoidType {
        return { sig: "VOID" };
    },
    arithmeticType(sig: ArithmeticSig): ArithmeticType {
        return { sig };
    },
    pointerType(pointee: ObjectType | FunctionType | VoidType): PointerType {
        return { sig: "PTR", pointee };
    },
    classType(identifier: string, templateSpec: ObjectType[], memberOf: ClassType | null): ClassType {
        return { sig: "CLASS", identifier, templateSpec, memberOf };
    },
    staticArrayType(object: ObjectType, size: number): StaticArrayType {
        return { sig: "ARRAY", object, size };
    },
    dynamicArrayType(object: ObjectType): DynamicArrayType {
        return { sig: "DYNARRAY", object };
    },
    indexPointerType(array: StaticArrayType | DynamicArrayType): IndexPointerType {
        return { sig: "INDEXPTR", array };
    },
    functionType(fulltype: string[]): FunctionType {
        return { sig: "FUNCTION", fulltype };
    },
    arithmetic(sig: ArithmeticSig, value: number, left: boolean = false, readonly: boolean = false): ArithmeticVariable {
        return { t: variables.arithmeticType(sig), v: { value }, left, readonly };
    },
    pointer(pointee: Variable | Function | "VOID", left: boolean = false, readonly: boolean = false): PointerVariable {
        const t = variables.pointerType((pointee as Variable | Function).t ?? variables.voidType());
        const val = (pointee as Variable | Function).v ?? "VOID";
        return { t, v: { pointee: val }, left, readonly };
    },
    indexPointer(array: StaticArrayVariable | DynamicArrayVariable, index: number, left: boolean = false, readonly: boolean = false): IndexPointerVariable {
        const t = variables.indexPointerType(array.t);
        return { t, v: { pointee: array.v, index }, left, readonly };
    },
    class(t: ClassType, members: { [name: string]: Variable }, left: boolean = false, readonly: boolean = false): ClassVariable {
        return { t, v: { members }, left, readonly };
    },
    staticArray(objectType: ObjectType, values: ObjectValue[], left: boolean = false, readonly: boolean = false): StaticArrayVariable {
        return { t: variables.staticArrayType(objectType, values.length), v: { values }, left, readonly };
    },
    dynamicArray(objectType: ObjectType, values: ObjectValue[], left: boolean = false, readonly: boolean = false): DynamicArrayVariable {
        return { t: variables.dynamicArrayType(objectType), v: { values }, left, readonly };
    },
    function(fulltype: string[], name: string, target: CFunction | null, bindThis: ClassVariable | null, left: boolean = false, readonly: boolean = false): Function {
        return { t: variables.functionType(fulltype), v: { name, target, bindThis }, left, readonly };
    },
    deref(object: PointerVariable): Variable | Function | "VOID" {
        if (variables.asVoidType(object.t.pointee) !== null) {
            return "VOID";
        }
        return {
            t: (object.t.pointee as ObjectType | FunctionType),
            v: (object.v.pointee as ObjectValue | FunctionValue),
            left: false, readonly: false
        } as Variable | Function;
    },
    clone(object: Variable, left: boolean = false, readonly: boolean = false): Variable {
        const branch: { [sig in string]: () => Variable } = {
            "ARITHMETIC": () => {
                const x = object as ArithmeticVariable;
                return variables.arithmetic(x.t.sig, x.v.value, left, readonly)
            },
            "PTR": () => {
                const x = object as PointerVariable;
                return variables.pointer(variables.deref(x), left, readonly);
            },
            "INDEXPTR": () => {
                const x = object as IndexPointerVariable;
                const array = { t: x.t.array, v: x.v.pointee, left: false, readonly: false } as StaticArrayVariable | DynamicArrayVariable;
                return variables.indexPointer(array, x.v.index, left, readonly);
            },
            "ARRAY": () => {
                throw new Error("not yet implemented");
            },
            "DYNARRAY": () => {
                throw new Error("cannot clone dynamic arrays directly");
            },
            "CLASS": () => {
                throw new Error("not yet implemented");
            },
            "FUNCTION": () => {
                throw new Error("not yet implemented");
            },
        }
        if (!object.readonly && readonly) {
            throw new Error("Cannot convert from volatile variable to a constant");
        }
        const where = (object.t.sig in arithmeticSig) ? "ARITHMETIC" : object.t.sig;
        return branch[where]();
    },
    asVoidType(type: AnyType): VoidType | null {
        return (type.sig === "VOID") ? type as VoidType : null;
    },
    asArithmeticType(type: AnyType): ArithmeticType | null {
        return (type.sig in arithmeticSig) ? type as ArithmeticType : null;
    },
    asPointerType(type: AnyType): PointerType | null {
        return (type.sig === "PTR") ? type as PointerType : null;
    },
    asIndexPointerType(type: AnyType): IndexPointerType | null {
        return (type.sig === "INDEXPTR") ? type as IndexPointerType : null;
    },
    asStaticArrayType(type: AnyType): StaticArrayType | null {
        return (type.sig === "ARRAY") ? type as StaticArrayType : null;
    },
    asDynamicArrayType(type: AnyType): DynamicArrayType | null {
        return (type.sig === "DYNARRAY") ? type as DynamicArrayType : null;
    },
    asClassType(type: AnyType): ClassType | null {
        return (type.sig === "CLASS") ? type as ClassType : null;
    },
    asFunctionType(type: AnyType): FunctionType | null {
        return (type.sig === "FUNCTION") ? type as FunctionType : null;
    },
    asArithmetic(x: Variable | Function): ArithmeticVariable | null {
        return (x.t.sig in arithmeticSig) ? x as ArithmeticVariable : null;
    },
    asPointer(x: Variable | Function): PointerVariable | null {
        return (x.t.sig === "PTR") ? x as PointerVariable : null;
    },
    asIndexPointer(x: Variable | Function): IndexPointerVariable | null {
        return (x.t.sig === "INDEXPTR") ? x as IndexPointerVariable : null;
    },
    asStaticArray(x: Variable | Function): StaticArrayVariable | null {
        return (x.t.sig === "ARRAY") ? x as StaticArrayVariable : null;
    },
    asDynamicArray(x: Variable | Function): DynamicArrayVariable | null {
        return (x.t.sig === "DYNARRAY") ? x as DynamicArrayVariable : null;
    },
    asClass(x: Variable | Function): ClassVariable | null {
        return (x.t.sig === "CLASS") ? x as ClassVariable : null;
    },
    asFunction(x: Variable | Function): Function | null {
        return (x.t.sig === "FUNCTION") ? x as Function : null;
    },
    arithmeticTypesEqual(lhs: ArithmeticType, rhs: ArithmeticType): boolean {
        return lhs.sig === rhs.sig;
    },
    pointerTypesEqual(lhs: PointerType, rhs: PointerType): boolean {
        return variables.typesEqual(lhs.pointee, rhs.pointee);
    },
    classTypesEqual(lhs: ClassType, rhs: ClassType): boolean {
        if (lhs.identifier !== rhs.identifier) {
            return false;
        }
        if (lhs.memberOf !== null && rhs.memberOf !== null) {
            if (variables.classTypesEqual(lhs.memberOf, rhs.memberOf)) {
                return false;
            }
        } else if (!(lhs.memberOf === null && rhs.memberOf === null)) {
            return false;
        }
        if (lhs.templateSpec.length !== rhs.templateSpec.length) {
            return false;
        }
        for (let i = 0; i < lhs.templateSpec.length; i++) {
            if (!variables.typesEqual(lhs.templateSpec[i], rhs.templateSpec[i])) {
                return false;
            }
        }
        return true;
    },
    indexPointerTypesEqual(lhs: IndexPointerType, rhs: IndexPointerType): boolean {
        const ls: StaticArrayType | null = variables.asStaticArrayType(lhs.array);
        const rs: StaticArrayType | null = variables.asStaticArrayType(rhs.array);
        const ld: DynamicArrayType | null = variables.asDynamicArrayType(lhs.array);
        const rd: DynamicArrayType | null = variables.asDynamicArrayType(rhs.array);
        if (ls !== null && rs !== null) {
            return variables.staticArrayTypesEqual(ls, rs);
        } else if (ld !== null && rd !== null) {
            return variables.dynamicArrayTypesEqual(ld, rd);
        }
        return false;
    },
    staticArrayTypesEqual(lhs: StaticArrayType, rhs: StaticArrayType): boolean {
        return variables.typesEqual(lhs.object, rhs.object);
    },
    dynamicArrayTypesEqual(lhs: DynamicArrayType, rhs: DynamicArrayType): boolean {
        return variables.typesEqual(lhs.object, rhs.object);
    },
    functionTypesEqual(lhs: FunctionType, rhs: FunctionType): boolean {
        if (lhs.fulltype.length !== rhs.fulltype.length) {
            return false;
        }
        for (let i = 0; i < lhs.fulltype.length; i++) {
            if (lhs.fulltype[i] !== rhs.fulltype[i]) {
                return false;
            }
        }
        return true;
    },
    typesEqual(lhs: AnyType, rhs: AnyType): boolean {
        if (lhs.sig !== rhs.sig) {
            return false;
        }
        if (lhs.sig in arithmeticSig || lhs.sig === "VOID") {
            return true;
        }
        const branch: { [sig: string]: () => boolean } = {
            "PTR": () => {
                return variables.pointerTypesEqual(lhs as PointerType, rhs as PointerType);
            },
            "INDEXPTR": () => {
                return variables.indexPointerTypesEqual(lhs as IndexPointerType, rhs as IndexPointerType);
            },
            "ARRAY": () => {
                return variables.staticArrayTypesEqual(lhs as StaticArrayType, rhs as StaticArrayType);
            },
            "DYNARRAY": () => {
                return variables.dynamicArrayTypesEqual(lhs as DynamicArrayType, rhs as DynamicArrayType);
            },
            "CLASS": () => {
                return variables.classTypesEqual(lhs as ClassType, rhs as ClassType);
            },
            "FUNCTION": () => {
                return variables.functionTypesEqual(lhs as FunctionType, rhs as FunctionType);
            },
        }
        return branch[lhs.sig]();
    },
    toStringSequence(type: AnyType, left: boolean): string[] {
        let result = new Array<string>();
        if (left) {
            result.push("LREF");
        }
        toStringSequenceInner(type, result);
        return result;
    },
    arithmeticSig: arithmeticSig,
    arithmeticProperties: arithmeticProperties,
    defaultArithmeticResolutionMap: defaultArithmeticResolutionMap,
} as const;

function toStringSequenceInner(type: AnyType, result: string[]): void {
    if (type.sig in arithmeticSig || type.sig === "VOID") {
        result.push(type.sig);
        return;
    }
    const branch: { [sig: string]: () => void } = {
        "PTR": () => {
            result.push("PTR");
            toStringSequenceInner((type as PointerType).pointee, result);
        },
        "INDEXPTR": () => {
            result.push("PTR"); // sic!
            toStringSequenceInner((type as IndexPointerType).array.object, result);
        },
        "ARRAY": () => {
            result.push("ARRAY");
            toStringSequenceInner((type as StaticArrayType).object, result);
            result.push(String((type as StaticArrayType).size));
        },
        "DYNARRAY": () => {
            throw new Error("Dynamic array cannot be a direct variable type");
        },
        "CLASS": () => {
            if ((type as ClassType).memberOf !== null) {
                result.push("MEMBER");
                toStringSequenceInner((type as ClassType).memberOf, result);
            }
            result.push("CLASS");
            result.push((type as ClassType).identifier);
            result.push("<");
            (type as ClassType).templateSpec.forEach((x: ObjectType) => {
                toStringSequenceInner(x, result);
            });
            result.push(">");
        },
        "FUNCTION": () => {
            result.push("FUNCTION");
            result = result.concat(...(type as FunctionType).fulltype);
        },
    }
    branch[type.sig]();
}
