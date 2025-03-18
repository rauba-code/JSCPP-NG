import { CRuntime } from "./rt"

export const arithmeticSig = {
    "I8": "signed char",
    "U8": "unsigned char",
    "I16": "short int",
    "U16": "unsigned short int",
    "I32": "long int",
    "U32": "unsigned long int",
    "I64": "long long int",
    "U64": "unsigned long long int",
    "F32": "float",
    "F64": "double",
    "BOOL": "bool",
    "INTEGRAL": "<integer literal>",
    "FLOAT": "<floating-point literal>",
    "ARITHMETIC": "<arithmetic literal>",
} as const;

export type ArithmeticSig = keyof (typeof arithmeticSig);

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

export interface ArrayType {
    sig: "ARRAY",
    object: ObjectType,
    size: number | null,
}

export interface ArrayElementType {
    sig: "ARRELEM",
    array: ArrayType;
}

export interface VoidType {
    sig: "VOID",
}

export type ObjectType = ArithmeticType | ClassType | PointerType | ArrayType | ArrayElementType;


export interface ArithmeticValue {
    value: number
}

export interface ArrayValue {
    values: Variable[],
}

export interface ClassValue {
    members?: { [name: string]: Variable };
}

export interface PointerValue {
    pointee: Variable | Function | "VOID";
}

export interface ArrayElementValue {
    index: number,
    array: ArrayValue,
}

export interface FunctionValue {
    target: CFunction | null;
    name: string;
    bindThis: Variable | null;
}
export type ObjectValue = ArithmeticValue | ArrayValue | ClassValue | PointerValue | ArrayElementValue | FunctionValue;

export interface ArithmeticVariable {
    left: boolean;
    readonly: boolean;
    t: ArithmeticType;
    v: ArithmeticValue;
}
export interface ArrayVariable {
    left: boolean;
    readonly?: boolean;
    t: ArrayType;
    v: ArrayValue;
}
export interface Function {
    left: boolean;
    readonly?: boolean;
    t: FunctionType;
    v: FunctionValue;
}
export interface ClassVariable {
    left: boolean;
    readonly?: boolean;
    t: ClassType;
    v: ClassValue;
}
export interface PointerVariable {
    left: boolean;
    readonly?: boolean;
    t: PointerType;
    v: PointerValue;
}
// does not exist in typecheck notation
export interface ArrayElementVariable {
    left: false;
    readonly?: boolean;
    t: ArrayElementType;
    v: ArrayElementValue;
}

// Equals to 'Object' in typecheck notation
export type Variable = ArithmeticVariable | ArrayVariable | ClassVariable | PointerVariable | ArrayElementVariable;

export type CFunction = (rt: CRuntime, _this: Variable, ...args: Variable[]) => Variable | null;

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
    arrayType(object: ObjectType, size: number | null): ArrayType {
        return { sig: "ARRAY", object, size };
    },
    arrayElementType(array: ArrayType): ArrayElementType {
        return { sig: "ARRELEM", array };
    },
    functionType(fulltype: string[]): FunctionType {
        return { sig: "FUNCTION", fulltype };
    },
    arithmetic(sig: ArithmeticSig, value: number, left: boolean = false, readonly: boolean = false): ArithmeticVariable {
        return { t: this.arithmeticType(sig), v: { value }, left, readonly };
    },
    pointer(pointee: Variable | Function | "VOID", left: boolean = false, readonly: boolean = false): PointerVariable {
        const t = this.pointerType((pointee as Variable | Function).t ?? this.voidType);
        return { t, v: { pointee }, left, readonly };
    },
    class(t: ClassType, members: { [name: string]: Variable }, left: boolean = false, readonly: boolean = false): ClassVariable {
        return { t, v: { members }, left, readonly };
    },
    array(objectType: ObjectType, values: Variable[], left: boolean = false, readonly: boolean = false): ArrayVariable {
        return { t: this.arrayType(objectType, values.length), v: { values }, left, readonly };
    }
} as const;
