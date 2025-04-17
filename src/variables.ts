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
    readonly name: string,
    readonly isSigned: boolean,
    readonly isFloat: boolean,
    readonly bytes: number,
    readonly minv: number,
    readonly maxv: number,
    readonly asSigned: ArithmeticSig
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

// convenience specialisation types of the ArithmeticType

export interface I8Type { readonly sig: "I8" };
export interface I16Type { readonly sig: "I16" };
export interface I32Type { readonly sig: "I32" };
export interface I64Type { readonly sig: "I64" };
export interface U8Type { readonly sig: "U8" };
export interface U16Type { readonly sig: "U16" };
export interface U32Type { readonly sig: "U32" };
export interface U64Type { readonly sig: "U64" };
export interface F32Type { readonly sig: "F32" };
export interface F64Type { readonly sig: "F64" };
export interface BoolType { readonly sig: "BOOL" };
export type IntegerType = I8Type | I16Type | I32Type | I64Type | U8Type | U16Type | U32Type | U64Type;
export type FloatType = F32Type | F64Type;

export interface ArithmeticType {
    readonly sig: ArithmeticSig,
}

export interface PointerType {
    readonly sig: "PTR",
    readonly pointee: ObjectType | FunctionType | VoidType, // OBJECT | FUNCTION | VOID
}

/** This includes both "class" and "struct" types */
export interface ClassType {
    readonly sig: "CLASS",
    readonly identifier: string,
    readonly templateSpec: ObjectType[],
    readonly memberOf: ClassType | null,
}

/** Templated specialisation of the `ClassType` */
export interface AbstractTemplatedClassType<TMemberOf extends (ClassType | null), T extends ObjectType[]> {
    readonly sig: "CLASS",
    readonly identifier: string,
    readonly templateSpec: T,
    readonly memberOf: TMemberOf,
}

export interface FunctionType {
    readonly sig: "FUNCTION",
    readonly fulltype: string[],
}

export interface StaticArrayType<TElem extends ObjectType> {
    readonly sig: "ARRAY",
    readonly object: TElem,
    readonly size: number,
}

export interface DynamicArrayType<TElem extends ObjectType> {
    readonly sig: "ARRAY",
    readonly object: TElem,
    readonly size: "DYNAMIC",
}

export type ArrayType<TVElem extends ObjectType> = StaticArrayType<TVElem> | DynamicArrayType<TVElem>

export interface IndexPointerType<TElem extends ObjectType> {
    readonly sig: "INDEXPTR",
    readonly array: ArrayType<TElem>;
}

export interface VoidType {
    readonly sig: "VOID",
}

/** Any type that a variable can have */
export type ObjectType = ArithmeticType | ClassType | PointerType | ArrayType<any> | IndexPointerType<any>;

/** Any type that a variable can have + direct function type + void type.
  * Do not use this for checking variables, use `ObjectType` instead. */
export type AnyType = ObjectType | FunctionType | VoidType;

/** Variable type with specified value type (lvalue or non-lvalue).
  * Intended to be implicitly cast from Variable | Function types. */
export interface MaybeLeft<T extends ObjectType> {
    readonly t: T,
    readonly v: { readonly lvHolder: LValueHolder<any> }
}

/** Variable type with specified value type (lvalue or non-lvalue)
  * and a c-v qualifier (const or volatile).
  * Intended to be implicitly cast from Variable | Function types. */
export interface MaybeLeftCV<T extends ObjectType> {
    readonly t: T,
    readonly v: { readonly lvHolder: LValueHolder<any>, readonly isConst: boolean }
}

export interface UnboundValue<VSelf extends Variable> {
    readonly lvHolder: LValueIndexHolder<VSelf>;
    readonly isConst: boolean;
    state: "UNBOUND";
}

export interface UninitValue<VSelf extends Variable> {
    readonly lvHolder: LValueHolder<VSelf>;
    readonly isConst: boolean;
    state: "UNINIT";
}

export interface InitValue<VSelf extends Variable> {
    readonly lvHolder: LValueHolder<VSelf>;
    readonly isConst: boolean;
    state: "INIT";
}

export type LValueIndexHolder<VSelf extends Variable> = { readonly array: ArrayValue<VSelf>, readonly index: number };

export type LValueHolder<VSelf extends Variable> = LValueIndexHolder<VSelf> | "SELF" | null;

export interface InitArithmeticValue extends InitValue<ArithmeticVariable> {
    value: number;
}

export interface ArrayValue<VElem extends Variable> extends InitValue<ArrayVariable<VElem>> {
    readonly values: VElem["v"][];
}

export interface ClassValue extends InitValue<ClassVariable> {
    members: { [name: string]: Variable };
}

export interface InitPointerValue extends InitValue<PointerVariable> {
    pointee: ObjectValue | FunctionValue | "VOID";
};

export interface InitIndexPointerValue<VElem extends Variable> extends InitValue<IndexPointerVariable<VElem>> {
    index: number,
    pointee: ArrayValue<VElem>,
}

export type ArithmeticValue = InitArithmeticValue | UninitValue<ArithmeticVariable>;

export type PointerValue = InitPointerValue | UninitValue<PointerVariable>;

export type IndexPointerValue<VElem extends Variable> = InitIndexPointerValue<VElem> | UninitValue<IndexPointerVariable<VElem>>;

export type MaybeUnboundArithmeticValue = ArithmeticValue | UnboundValue<ArithmeticVariable>;

export type MaybeUnboundClassValue = ClassValue | UnboundValue<ClassVariable>;

export type MaybeUnboundPointerValue = PointerValue | UnboundValue<PointerVariable>;

export type MaybeUnboundIndexPointerValue<VElem extends Variable> = IndexPointerValue<VElem> | UnboundValue<IndexPointerVariable<VElem>>;

export interface FunctionValue {
    readonly lvHolder: "SELF" | null;
    readonly isConst: boolean;
    readonly state: "INIT";
    target: CFunction | null;
    name: string;
    bindThis: ClassVariable | null;
}

export type ObjectValue = ArithmeticValue | ArrayValue<any> | ClassValue | PointerValue | IndexPointerValue<any>;
export type InitObjectValue = InitArithmeticValue | ArrayValue<any> | ClassValue | InitPointerValue | InitIndexPointerValue<any>;
export type MaybeUnboundObjectValue = MaybeUnboundArithmeticValue | ArrayValue<any> | PointerValue | MaybeUnboundClassValue | MaybeUnboundPointerValue | MaybeUnboundIndexPointerValue<any>;

/** Determiner of referee. 
  * > `null` for non-lvalues, e.g., `6`, `"hello"`, `{ 2, -3 }` `(int)x`, `sin(x)`, etc.;
  * > `"SELF"` for independent variables in the stack, e.g., `x` (given `float x = -47.3;`);
  * > > The type of `&x` would then be `int*` (a.k.a. `PointerVariable`);
  * > > `int *z = &x; z++;` would cause an undefined behaviour;
  * > `IndexPointerValue` for array members, e.g. `a[1]` (given `int a[] = {1, 2, 3}`). 
  * > > Likewise, the type of `&x` would then be `int*` (but it's `IndexPointerVariable` in the runtime);
  * > > `int *w = &a[1]; w++;` would be okay and it would point to a[2];
*/

export interface AbstractVariable<TType, TValue> {
    readonly t: TType,
    v: TValue,
}

export type ArithmeticVariable = AbstractVariable<ArithmeticType, ArithmeticValue>;
export type StaticArrayVariable<VElem extends Variable> = AbstractVariable<StaticArrayType<VElem["t"]>, ArrayValue<VElem>>;
export type DynamicArrayVariable<VElem extends Variable> = AbstractVariable<DynamicArrayType<VElem["t"]>, ArrayValue<VElem>>;
export type ArrayVariable<VElem extends Variable> = StaticArrayVariable<VElem> | DynamicArrayVariable<VElem>;
export type Function = AbstractVariable<FunctionType, FunctionValue>;
export type ClassVariable = AbstractVariable<ClassType, ClassValue>;
export type PointerVariable = AbstractVariable<PointerType, PointerValue>;
export type IndexPointerVariable<VElem extends Variable> = AbstractVariable<IndexPointerType<VElem["t"]>, IndexPointerValue<VElem>>;

export type InitArithmeticVariable = AbstractVariable<ArithmeticType, InitArithmeticValue>;
export type InitClassVariable = AbstractVariable<ClassType, ClassValue>;
export type InitPointerVariable = AbstractVariable<PointerType, InitPointerValue>;
export type InitIndexPointerVariable<VElem extends Variable> = AbstractVariable<IndexPointerType<VElem["t"]>, InitIndexPointerValue<VElem>>;

export type MaybeUnboundArithmeticVariable = AbstractVariable<ArithmeticType, MaybeUnboundArithmeticValue>;
export type MaybeUnboundClassVariable = AbstractVariable<ClassType, MaybeUnboundClassValue>;
export type MaybeUnboundPointerVariable = AbstractVariable<PointerType, MaybeUnboundPointerValue>;
export type MaybeUnboundIndexPointerVariable<VElem extends Variable> = AbstractVariable<IndexPointerType<VElem["t"]>, MaybeUnboundIndexPointerValue<VElem>>;

// Equals to 'Object' in typecheck notation
export type Variable = ArithmeticVariable | ArrayVariable<any> | ClassVariable | PointerVariable | IndexPointerVariable<any>;
export type InitVariable = InitArithmeticVariable | ArrayVariable<any> | InitClassVariable | InitPointerVariable | InitIndexPointerVariable<any>;
export type MaybeUnboundVariable = MaybeUnboundArithmeticVariable | ArrayVariable<any> | MaybeUnboundClassVariable | MaybeUnboundPointerVariable | MaybeUnboundIndexPointerVariable<any>;

export type CFunction = (rt: CRuntime, ...args: Variable[]) => InitVariable | Generator<unknown, InitVariable, unknown>;

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
    staticArrayType<TElem extends ObjectType>(object: TElem, size: number): StaticArrayType<TElem> {
        return { sig: "ARRAY", object, size };
    },
    dynamicArrayType<TElem extends ObjectType>(object: TElem): DynamicArrayType<TElem> {
        return { sig: "ARRAY", object, size: "DYNAMIC" };
    },
    indexPointerType<TElem extends ObjectType>(array: ArrayType<TElem>): IndexPointerType<TElem> {
        return { sig: "INDEXPTR", array };
    },
    functionType(fulltype: string[]): FunctionType {
        return { sig: "FUNCTION", fulltype };
    },
    uninitArithmetic(sig: ArithmeticSig, lvHolder: LValueHolder<ArithmeticVariable>, isConst: boolean = false): ArithmeticVariable {
        return { t: variables.arithmeticType(sig), v: { lvHolder, state: "UNINIT", isConst } };
    },
    arithmetic(sig: ArithmeticSig, value: number, lvHolder: LValueHolder<ArithmeticVariable>, isConst: boolean = false): InitArithmeticVariable {
        return { t: variables.arithmeticType(sig), v: { lvHolder, state: "INIT", value, isConst } };
    },
    uninitPointer(object: AnyType, lvHolder: LValueHolder<PointerVariable>, isConst: boolean = false): PointerVariable {
        return { t: variables.pointerType(object), v: { lvHolder, state: "UNINIT", isConst } };
    },
    pointer(pointee: Variable | Function | "VOID", lvHolder: LValueHolder<PointerVariable>, isConst: boolean = false): InitPointerVariable {
        const t = variables.pointerType((pointee as Variable | Function).t ?? variables.voidType());
        const val = (pointee as Variable | Function).v ?? pointee;
        return { t, v: { lvHolder, state: "INIT", pointee: val, isConst } };
    },
    indexPointer<VElem extends Variable>(array: ArrayVariable<VElem>, index: number, lvHolder: LValueHolder<IndexPointerVariable<VElem>>, isConst: boolean = false): InitIndexPointerVariable<VElem> {
        const t = variables.indexPointerType(array.t);
        return { t, v: { lvHolder, state: "INIT", pointee: array.v, index, isConst } };
    },
    class(t: ClassType, members: { [name: string]: Variable }, lvHolder: LValueHolder<ClassVariable>, isConst: boolean = false): InitClassVariable {
        return { t, v: { lvHolder, state: "INIT", members, isConst } };
    },
    staticArray<VElem extends Variable>(objectType: VElem["t"], values: VElem["v"][], lvHolder: LValueHolder<StaticArrayVariable<VElem>>, isConst: boolean = false): StaticArrayVariable<VElem> {
        return { t: variables.staticArrayType(objectType, values.length), v: { lvHolder, state: "INIT", values, isConst } };
    },
    dynamicArray<VElem extends Variable>(objectType: VElem["t"], values: VElem["v"][], lvHolder: LValueHolder<DynamicArrayVariable<VElem>>, isConst: boolean = false): DynamicArrayVariable<VElem> {
        return { t: variables.dynamicArrayType(objectType), v: { lvHolder, state: "INIT", values, isConst } };
    },
    function(fulltype: string[], name: string, target: CFunction | null, bindThis: ClassVariable | null, lvHolder: "SELF" | null): Function {
        return { t: variables.functionType(fulltype), v: { lvHolder, state: "INIT", name, target, bindThis, isConst: true } };
    },
    deref(object: MaybeUnboundPointerVariable, onError: (x: string) => never): Variable | Function {
        if (variables.asVoidType(object.t.pointee) !== null) {
            onError("Attempted dereference of a void* type (not yet implemented)");
        }
        if (object.v.state === "UNINIT") {
            onError("Attempted dereference of an uninitialised value (segmentation fault)");
        }
        if (object.v.state === "UNBOUND") {
            onError("Attempted dereference of an out-of-bounds array element (segmentation fault)");
        }
        return {
            t: (object.t.pointee as ObjectType | FunctionType),
            v: (object.v.pointee as ObjectValue | FunctionValue),
            left: false, readonly: false
        } as Variable | Function;
    },
    /** Create a new variable with the same type and value as the original one */
    clone<TVar extends Variable>(object: TVar, lvHolder: LValueHolder<TVar>, isConst: boolean = false, onError: (x: string) => never): TVar {
        if (object.v.state === "UNINIT") {
            onError("Attempted clone of an uninitialised value");
        }
        type BranchKey = "ARITHMETIC" | "PTR" | "INDEXPTR" | "ARRAY" | "CLASS" | "FUNCTION";
        const branch: { [sig in BranchKey]: () => Variable } = {
            "ARITHMETIC": () => {
                const x = object as InitArithmeticVariable;
                return variables.arithmetic(x.t.sig, x.v.value, lvHolder as LValueHolder<InitArithmeticVariable>, isConst)
            },
            "PTR": () => {
                const x = object as InitPointerVariable;
                return variables.pointer(variables.deref(x, onError), lvHolder as LValueHolder<InitPointerVariable>, isConst);
            },
            "INDEXPTR": () => {
                const x = object as InitIndexPointerVariable<Variable>;
                const array = { t: x.t.array, v: x.v.pointee, left: false, readonly: false } as ArrayVariable<Variable>;
                return variables.indexPointer(array, x.v.index, lvHolder as LValueHolder<InitIndexPointerVariable<Variable>>, isConst);
            },
            "ARRAY": () => {
                onError("not yet implemented (you might be doing something wrong here)");
            },
            "CLASS": () => {
                const x = object as InitClassVariable;
                const members = Object.fromEntries(Object.entries(x.v.members).map(([k, v]: [string, Variable]) => [k, variables.clone(v, "SELF", false, onError)]));
                return variables.class(x.t, members, lvHolder as LValueHolder<InitClassVariable>, isConst);
            },
            "FUNCTION": () => {
                onError("not yet implemented");
            },
        }
        if (!object.v.isConst && isConst) {
            onError("Cannot clone from a volatile variable to a constant");
        }
        const where: BranchKey = (object.t.sig in arithmeticSig) ? "ARITHMETIC" : object.t.sig as BranchKey;
        return branch[where]() as TVar;
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
    asIndexPointerType(type: AnyType): IndexPointerType<ObjectType> | null {
        return (type.sig === "INDEXPTR") ? type as IndexPointerType<ObjectType> : null;
    },
    asIndexPointerOfElemType<TElem extends ObjectType>(type: AnyType, elem: TElem): IndexPointerType<TElem> | null {
        return (type.sig === "INDEXPTR" && variables.typesEqual((type as IndexPointerType<ObjectType>).array.object, elem)) ? type as IndexPointerType<TElem> : null;
    },
    asArrayType(type: AnyType): ArrayType<ObjectType> | null {
        return (type.sig === "ARRAY") ? type as ArrayType<ObjectType> : null;
    },
    asArrayOfElemType<TElem extends ObjectType>(type: AnyType, elem: TElem): ArrayType<TElem> | null {
        return (type.sig === "ARRAY" && variables.typesEqual(type.object as AnyType, elem)) ? type as ArrayType<TElem> : null;
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
    asInitArithmetic(x: Variable | Function): InitArithmeticVariable | null {
        return (x.t.sig in arithmeticSig && x.v.state === "INIT") ? x as InitArithmeticVariable : null;
    },
    asPointer(x: Variable | Function): PointerVariable | null {
        return (x.t.sig === "PTR") ? x as PointerVariable : null;
    },
    asInitPointer(x: Variable | Function): InitPointerVariable | null {
        return (x.t.sig === "PTR" && x.v.state === "INIT") ? x as InitPointerVariable : null;
    },
    asIndexPointer(x: Variable | Function): IndexPointerVariable<Variable> | null {
        return (x.t.sig === "INDEXPTR") ? x as IndexPointerVariable<Variable> : null;
    },
    asInitIndexPointer(x: Variable | Function): InitIndexPointerVariable<Variable> | null {
        return (x.t.sig === "INDEXPTR" && x.v.state === "INIT") ? x as InitIndexPointerVariable<Variable> : null;
    },
    asIndexPointerOfElem<VElem extends Variable>(x: Variable | Function, elem: VElem): IndexPointerVariable<VElem> | null {
        return (x.t.sig === "INDEXPTR" && variables.typesEqual((x as IndexPointerVariable<Variable>).t.array.object, elem.t)) ? x as IndexPointerVariable<VElem> : null;
    },
    asInitIndexPointerOfElem<VElem extends Variable>(x: Variable | Function, elem: VElem): InitIndexPointerVariable<VElem> | null {
        return (x.t.sig === "INDEXPTR" && variables.typesEqual((x as IndexPointerVariable<Variable>).t.array.object, elem.t) && x.v.state === "INIT") ? x as InitIndexPointerVariable<VElem> : null;
    },
    asArray(x: Variable | Function): ArrayVariable<Variable> | null {
        return (x.t.sig === "ARRAY") ? x as ArrayVariable<Variable> : null;
    },
    asArrayOfElem<VElem extends Variable>(x: Variable | Function, elem: VElem): ArrayVariable<VElem> | null {
        return (x.t.sig === "ARRAY" && variables.typesEqual((x as ArrayVariable<Variable>).t.object, elem.t)) ? x as ArrayVariable<VElem> : null;
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
    indexPointerTypesEqual(lhs: IndexPointerType<ObjectType>, rhs: IndexPointerType<ObjectType>): boolean {
        return lhs.array.size === rhs.array.size && variables.typesEqual(lhs.array.object, rhs.array.object);
    },
    arrayTypesEqual(lhs: ArrayType<ObjectType>, rhs: ArrayType<ObjectType>): boolean {
        return lhs.size === rhs.size && variables.typesEqual(lhs.object, rhs.object);
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
        type BranchKey = "PTR" | "INDEXPTR" | "ARRAY" | "CLASS" | "FUNCTION";
        const branch: { [sig in BranchKey]: () => boolean } = {
            "PTR": () => {
                return variables.pointerTypesEqual(lhs as PointerType, rhs as PointerType);
            },
            "INDEXPTR": () => {
                return variables.indexPointerTypesEqual(lhs as IndexPointerType<ObjectType>, rhs as IndexPointerType<ObjectType>);
            },
            "ARRAY": () => {
                return variables.arrayTypesEqual(lhs as ArrayType<ObjectType>, rhs as ArrayType<ObjectType>);
            },
            "CLASS": () => {
                return variables.classTypesEqual(lhs as ClassType, rhs as ClassType);
            },
            "FUNCTION": () => {
                return variables.functionTypesEqual(lhs as FunctionType, rhs as FunctionType);
            },
        }
        return branch[lhs.sig as BranchKey]();
    },
    arithmeticAssign(lhs: ArithmeticVariable, value: number, onError: (x: string) => never): void {
        checkAssignable(lhs.v, onError);
        lhs.v.state = "INIT";
        (lhs.v as InitArithmeticValue).value = value;
    },
    arithmeticValueAssign(lv: ArithmeticValue, value: number, onError: (x: string) => never): void {
        checkAssignable(lv, onError);
        lv.state = "INIT";
        (lv as InitArithmeticValue).value = value;
    },
    pointerAssign(lhs: PointerVariable, pointee: Variable | Function | "VOID", onError: (x: string) => never): void {
        checkAssignable(lhs.v, onError);
        lhs.v.state = "INIT";
        const pointeeType = pointee === "VOID" ? variables.voidType() : pointee.t;
        if (!variables.typesEqual(lhs.t.pointee, pointeeType)) {
            const expected = variables.toStringSequence(lhs.t.pointee, false, onError).join(" ");
            const received = variables.toStringSequence(pointeeType, false, onError).join(" ");
            onError(`expected type '${expected}', got '${received}'`)
        }
        (lhs.v as InitPointerValue).pointee = pointee === "VOID" ? "VOID" : pointee.v;
    },
    indexPointerAssign<VElem extends Variable>(lhs: IndexPointerVariable<VElem>, array: ArrayVariable<VElem>, index: number, onError: (x: string) => never): void {
        checkAssignable(lhs.v, onError);
        lhs.v.state = "INIT";
        if (!variables.typesEqual(lhs.t.array.object, array.t.object)) {
            const expected = variables.toStringSequence(lhs.t.array.object, false, onError).join(" ");
            const received = variables.toStringSequence(array.t.object, false, onError).join(" ");
            onError(`expected type '${expected}', got '${received}'`)
        }
        (lhs.v as InitIndexPointerValue<VElem>).pointee = array.v;
        (lhs.v as InitIndexPointerValue<VElem>).index = index;
    },
    indexPointerAssignIndex(lhs: IndexPointerVariable<Variable>, index: number, onError: (x: string) => never): void {
        checkAssignable(lhs.v, onError);
        lhs.v.state = "INIT";
        (lhs.v as InitIndexPointerValue<Variable>).index = index;
    },
    arrayMember(lhs: ArrayVariable<Variable>, index: number): MaybeUnboundVariable {
        if (index >= 0 && index < lhs.v.values.length) {
            return { t: lhs.t.object, v: lhs.v.values[index] } as Variable;
        }
        return { t: lhs.t.object as ArithmeticType, v: { lvHolder: { array: lhs.v, index } as LValueIndexHolder<Variable>, isConst: false, state: "UNBOUND" } as UnboundValue<ArithmeticVariable> };
    },
    toStringSequence(type: AnyType, left: boolean, onError: (x: string) => never): string[] {
        let result = new Array<string>();
        if (left) {
            result.push("LREF");
        }
        toStringSequenceInner(type, result, onError);
        return result;
    },
    arithmeticSig: arithmeticSig,
    arithmeticProperties: arithmeticProperties,
    defaultArithmeticResolutionMap: defaultArithmeticResolutionMap,
} as const;

function checkAssignable(v: MaybeUnboundObjectValue, onError: (x: string) => never): void {
    if (v.lvHolder === null) {
        onError("Attempted assignment to a non-lvalue object (assignment to a calculated value not bound by any variable)");
    }
    if (v.isConst) {
        onError("Attempted assignment to a constant value");
    }
    if (v.state === "UNBOUND") {
        onError("Attempted assignment to an array element whose index is out of bounds (segmentation fault)");
    }
}

function toStringSequenceInner(type: AnyType, result: string[], onError: (x: string) => never): void {
    if (type.sig in arithmeticSig || type.sig === "VOID") {
        result.push(type.sig);
        return;
    }
    type BranchKey = "PTR" | "INDEXPTR" | "ARRAY" | "CLASS" | "FUNCTION";
    const branch: { [sig in BranchKey]: () => void } = {
        "PTR": () => {
            result.push("PTR");
            toStringSequenceInner((type as PointerType).pointee, result, onError);
        },
        "INDEXPTR": () => {
            result.push("PTR"); // sic!
            toStringSequenceInner((type as IndexPointerType<ObjectType>).array.object, result, onError);
        },
        "ARRAY": () => {
            result.push("ARRAY");
            toStringSequenceInner((type as ArrayType<ObjectType>).object, result, onError);
            result.push(String((type as ArrayType<ObjectType>).size));
        },
        "CLASS": () => {
            const classType = type as ClassType;
            if (classType.memberOf !== null) {
                result.push("MEMBER");
                toStringSequenceInner(classType.memberOf, result, onError);
            }
            result.push("CLASS");
            result.push((type as ClassType).identifier);
            result.push("<");
            classType.templateSpec.forEach((x: ObjectType) => {
                toStringSequenceInner(x, result, onError);
            });
            result.push(">");
        },
        "FUNCTION": () => {
            result.push("FUNCTION");
            result = result.concat(...(type as FunctionType).fulltype);
        },
    }
    branch[type.sig as BranchKey]();
}
