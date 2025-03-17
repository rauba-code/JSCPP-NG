import { CRuntime } from "./rt"
// Equals to 'Object' in typecheck notation
export interface Variable {
    type: ObjectType,
    value: Object,
}

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
    arrayType: ArrayType;
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
    pointee: ObjectVariable | FunctionVariable | null;
}

export interface ArrayElementValue {
    index: number,
    array: Variable[],
}

export interface FunctionValue {
    target: CFunction | null;
    name: string;
    bindThis: Variable | null;
}

export interface ArithmeticVariable {
    type: ArithmeticType;
    value: ArithmeticValue;
}

export interface ArrayVariable {
    type: ArrayType;
    value: ArrayValue;
}

export type ObjectValue = ArithmeticValue | ArrayValue | ClassValue | PointerValue | ArrayElementValue | FunctionValue;


export type CFunction = (rt: CRuntime, _this: Variable, ...args: Variable[]) => Variable | null;
