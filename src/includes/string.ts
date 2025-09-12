import { asResult } from "../interpreter";
import { CRuntime, OpSignature } from "../rt";
import * as common from "../shared/common";
import { strcmp, StringType, StringVariable, strncmp } from "../shared/string_utils";
import { ArithmeticVariable, ClassType, Gen, InitArithmeticValue, InitArithmeticVariable, InitIndexPointerVariable, InitPointerVariable, MaybeLeft, PointerVariable, ResultOrGen, variables } from "../variables";

export = {
    load(rt: CRuntime) {
        rt.include("cstddef");
        rt.defineStruct("{global}", "string", [
            {
                name: "_ptr",
                variable: variables.uninitPointer(variables.arithmeticType("I8"), null, "SELF"),
            },
            {
                name: "_size",
                variable: variables.arithmetic("I64", 0, "SELF")
            }
        ], {})

        function cmpOverloads(op: OpSignature, fn: (strcmpRetv: number) => boolean): common.OpHandler[] {
            return [{
                op,
                type: "FUNCTION BOOL ( CLREF CLASS string < > CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes: [], l: StringVariable, r: StringVariable): InitArithmeticVariable {
                    const lptr = variables.asInitIndexPointerOfElem(l.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    const rptr = variables.asInitIndexPointerOfElem(r.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    return variables.arithmetic("BOOL", fn(strncmp(rt, lptr, rptr, l.v.members._size.v.value)) ? 1 : 0, null);
                }
            },
            {
                op,
                type: "FUNCTION BOOL ( CLREF CLASS string < > PTR I8 )",
                default(rt: CRuntime, _templateTypes: [], l: StringVariable, r: PointerVariable<ArithmeticVariable>): InitArithmeticVariable {
                    const lptr = variables.asInitIndexPointerOfElem(l.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    const rptr = variables.asInitIndexPointerOfElem(r, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    return variables.arithmetic("BOOL", fn(strcmp(rt, lptr, rptr)) ? 1 : 0, null);
                }
            },
            {
                op,
                type: "FUNCTION BOOL ( PTR I8 CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes: [], l: PointerVariable<ArithmeticVariable>, r: StringVariable): InitArithmeticVariable {
                    const lptr = variables.asInitIndexPointerOfElem(l, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    const rptr = variables.asInitIndexPointerOfElem(r.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    return variables.arithmetic("BOOL", fn(strcmp(rt, lptr, rptr)) ? 1 : 0, null);
                }
            }];
        }

        common.regOps(rt, [
            {
                op: "o(_=_)",
                type: "FUNCTION LREF CLASS string < > ( LREF CLASS string < > PTR I8 )",
                default(rt: CRuntime, _templateTypes: [], l: StringVariable, _r: PointerVariable<ArithmeticVariable>): StringVariable {
                    const r = variables.asInitIndexPointerOfElem(_r, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    let i: number = 0;
                    while (rt.arithmeticValue(variables.arrayMember(r.v.pointee, r.v.index + i)) !== 0) {
                        i++;
                    }
                    variables.arithmeticAssign(rt, l.v.members._size, i);
                    variables.indexPointerAssign(rt, l.v.members._ptr, r.v.pointee, r.v.index);

                    return l;
                }
            },
            {
                op: "o(_=_)",
                type: "FUNCTION LREF CLASS string < > ( LREF CLASS string < > CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes: [], l: StringVariable, r: StringVariable): StringVariable {
                    const rptr = variables.asInitIndexPointerOfElem(r.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    variables.arithmeticAssign(rt, l.v.members._size, r.v.members._size.v.value);
                    variables.indexPointerAssign(rt, l.v.members._ptr, rptr.v.pointee, rptr.v.index);

                    return l;
                }
            },
            ...cmpOverloads("o(_==_)", (x) => x == 0),
            ...cmpOverloads("o(_!=_)", (x) => x != 0),
            ...cmpOverloads("o(_>=_)", (x) => x >= 0),
            ...cmpOverloads("o(_<=_)", (x) => x <= 0),
            ...cmpOverloads("o(_>_)", (x) => x > 0),
            ...cmpOverloads("o(_<_)", (x) => x < 0),
            {
                op: "o(_[_])",
                type: "FUNCTION LREF I8 ( LREF CLASS string < > I64 )",
                default(rt: CRuntime, _templateTypes: [], l: StringVariable, _idx: ArithmeticVariable): ArithmeticVariable {
                    const idx = rt.arithmeticValue(_idx);
                    if (idx < 0 || idx >= l.v.members._size.v.value) {
                        return variables.uninitArithmetic("I8", "SELF"); // C++11 behaviour
                    }
                    const lptr = variables.asInitIndexPointerOfElem(l.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    return variables.arrayMember(lptr.v.pointee, lptr.v.index + idx) as ArithmeticVariable;
                }
            },
            {
                op: "o(_+_)",
                type: "FUNCTION CLASS string < > ( CLREF CLASS string < > CLREF CLASS string < > )",
                *default(rt: CRuntime, _templateTypes: [], l: StringVariable, r: StringVariable): Gen<StringVariable> {
                    const strYield = rt.defaultValue2(thisType, "SELF") as ResultOrGen<StringVariable>;
                    const str = asResult(strYield) ?? (yield* strYield as Gen<StringVariable>);
                    const { ptr, size } = strConcat(rt, l, r.v.members._ptr, r.v.members._size.v.value);
                    str.v.members._ptr = ptr;
                    str.v.members._size.v.value = size;
                    return str;
                }
            },
            {
                op: "o(_+_)",
                type: "FUNCTION CLASS string < > ( CLREF CLASS string < > I8 )",
                *default(rt: CRuntime, _templateTypes: [], l: StringVariable, r: ArithmeticVariable): Gen<StringVariable> {
                    const strYield = rt.defaultValue2(thisType, "SELF") as ResultOrGen<StringVariable>;
                    const str = asResult(strYield) ?? (yield* strYield as Gen<StringVariable>);
                    const memory = variables.arrayMemory<ArithmeticVariable>(variables.arithmeticType("I8"), []);
                    memory.values.push(variables.arithmetic("I8", rt.arithmeticValue(r), { array: memory, index: 0 }).v);
                    memory.values.push(variables.arithmetic("I8", 0, { array: memory, index: 0 }).v);
                    const { ptr, size } = strConcat(rt, l, variables.indexPointer(memory, 0, true, null), 1);
                    str.v.members._ptr = ptr;
                    str.v.members._size.v.value = size;
                    return str;
                }
            },
            {
                op: "o(_+=_)",
                type: "FUNCTION LREF CLASS string < > ( LREF CLASS string < > CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes: [], l: StringVariable, r: StringVariable): StringVariable {
                    const { ptr, size } = strConcat(rt, l, r.v.members._ptr, r.v.members._size.v.value);
                    l.v.members._ptr = ptr;
                    l.v.members._size.v.value = size;
                    return l;
                }
            },
            {
                op: "o(_+=_)",
                type: "FUNCTION LREF CLASS string < > ( LREF CLASS string < > I8 )",
                default(rt: CRuntime, _templateTypes: [], l: StringVariable, r: ArithmeticVariable): StringVariable {
                    const lptr = variables.asInitIndexPointerOfElem(l.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    lptr.v.pointee.values[lptr.v.pointee.values.length - 1].state = "INIT";
                    (lptr.v.pointee.values[lptr.v.pointee.values.length - 1] as InitArithmeticValue).value = rt.arithmeticValue(r);
                    lptr.v.pointee.values.push(variables.arithmetic("I8", 0, { array: lptr.v.pointee, index: lptr.v.pointee.values.length }).v);
                    l.v.members._size.v.value++;
                    return l;
                }
            },
        ]);
        function strConcat(rt: CRuntime, l: StringVariable, _r: PointerVariable<ArithmeticVariable>, rsz: number): { size: number, ptr: InitIndexPointerVariable<ArithmeticVariable> } {
            const lptr = variables.asInitIndexPointerOfElem(l.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
            const lsz = l.v.members._size.v.value;
            const rptr = variables.asInitIndexPointerOfElem(_r, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
            const memory = variables.arrayMemory<ArithmeticVariable>(variables.arithmeticType("I8"), []);
            for (let i = 0; i < lsz; i++) {
                const chr = rt.arithmeticValue(variables.arrayMember(lptr.v.pointee, lptr.v.index + i));
                memory.values.push(variables.arithmetic("I8", chr, { array: memory, index: memory.values.length }).v);
            }
            for (let i = 0; i < rsz; i++) {
                const chr = rt.arithmeticValue(variables.arrayMember(rptr.v.pointee, rptr.v.index + i));
                memory.values.push(variables.arithmetic("I8", chr, { array: memory, index: memory.values.length }).v);
            }
            memory.values.push(variables.arithmetic("I8", 0, { array: memory, index: memory.values.length }).v);
            return { size: memory.values.length - 1, ptr: variables.indexPointer(memory, 0, false, "SELF") };

        }
        const thisType = (rt.simpleType(["string"]) as MaybeLeft<StringType>).t;
        const ctorHandlers: common.OpHandler[] = [
            {
                op: "o(_ctor)",
                type: "FUNCTION CLASS string < > ( PTR I8 )",
                *default(rt: CRuntime, _templateTypes: [ClassType], _r: PointerVariable<ArithmeticVariable>): Gen<StringVariable> {
                    const lYield = rt.defaultValue2(thisType, "SELF") as ResultOrGen<StringVariable>;
                    const l = asResult(lYield) ?? (yield* lYield as Gen<StringVariable>);
                    const r = variables.asInitIndexPointerOfElem(_r, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    let i: number = 0;
                    while (rt.arithmeticValue(variables.arrayMember(r.v.pointee, r.v.index + i)) !== 0) {
                        i++;
                    }
                    variables.arithmeticAssign(rt, l.v.members._size, i);
                    variables.indexPointerAssign(rt, l.v.members._ptr, r.v.pointee, r.v.index);

                    return l;
                }
            }
        ];
        for (const ctorHandler of ctorHandlers) {
            rt.regFunc(ctorHandler.default, thisType, ctorHandler.op, rt.typeSignature(ctorHandler.type), [-1]);
        }

        common.regMemberFuncs(rt, "string", [
            {
                op: "empty",
                type: "FUNCTION BOOL ( CLREF CLASS string < > )",
                default(_rt: CRuntime, _templateTypes: [], l: StringVariable): InitArithmeticVariable {
                    return variables.arithmetic("BOOL", l.v.members._size.v.value === 0 ? 1 : 0, null);
                }
            },
            {
                op: "begin",
                type: "FUNCTION PTR I8 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes: [], l: StringVariable): InitIndexPointerVariable<ArithmeticVariable> {
                    const lptr = variables.asInitIndexPointerOfElem(l.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    return variables.indexPointer(lptr.v.pointee, lptr.v.index, false, null);
                }
            },
            {
                op: "substr",
                type: "FUNCTION CLASS string < > ( CLREF CLASS string < > I32 I32 )",
                *default(rt: CRuntime, _templateTypes: [], l: StringVariable, pos: InitArithmeticVariable, count: InitArithmeticVariable): Gen<StringVariable> {
                    const lptr = variables.asInitIndexPointerOfElem(l.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    const strYield = rt.defaultValue2(thisType, "SELF") as ResultOrGen<StringVariable>;
                    const str = asResult(strYield) ?? (yield* strYield as Gen<StringVariable>);
                    if (l.v.members._size.v.value < pos.v.value) {
                        rt.raiseException(`string::substr(): start position (${pos.v.value}) is greater than the size of string (${l.v.members._size.v.value})`);
                    }
                    str.v.members._ptr = variables.indexPointer(lptr.v.pointee, lptr.v.index + pos.v.value, false, "SELF");
                    str.v.members._size.v.value = count.v.value === -1 ? l.v.members._size.v.value - pos.v.value : Math.min(l.v.members._size.v.value - pos.v.value, count.v.value);
                    return str;
                }
            },
            {
                op: "substr",
                type: "FUNCTION CLASS string < > ( CLREF CLASS string < > I32 )",
                *default(rt: CRuntime, _templateTypes: [], l: StringVariable, pos: InitArithmeticVariable): Gen<StringVariable> {
                    const lptr = variables.asInitIndexPointerOfElem(l.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    const strYield = rt.defaultValue2(thisType, "SELF") as ResultOrGen<StringVariable>;
                    const str = asResult(strYield) ?? (yield* strYield as Gen<StringVariable>);
                    if (l.v.members._size.v.value < pos.v.value) {
                        rt.raiseException(`string::substr(): start position (${pos.v.value}) is greater than the size of string (${l.v.members._size.v.value})`);
                    }
                    str.v.members._ptr = variables.indexPointer(lptr.v.pointee, lptr.v.index + pos.v.value, false, "SELF");
                    str.v.members._size.v.value = l.v.members._size.v.value - pos.v.value;
                    return str;
                }
            },
            {
                op: "substr",
                type: "FUNCTION CLASS string < > ( CLREF CLASS string < > )",
                *default(rt: CRuntime, _templateTypes: [], l: StringVariable): Gen<StringVariable> {
                    const lptr = variables.asInitIndexPointerOfElem(l.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    const strYield = rt.defaultValue2(thisType, "SELF") as ResultOrGen<StringVariable>;
                    const str = asResult(strYield) ?? (yield* strYield as Gen<StringVariable>);
                    str.v.members._ptr = variables.indexPointer(lptr.v.pointee, lptr.v.index, false, "SELF");
                    str.v.members._size.v.value = l.v.members._size.v.value;
                    return str;
                }
            },
            {
                op: "replace",
                type: "FUNCTION LREF CLASS string < > ( LREF CLASS string < > I32 I32 CLREF CLASS string < > )",
                *default(rt: CRuntime, _templateTypes: [], l: StringVariable, pos: InitArithmeticVariable, count: InitArithmeticVariable, r: StringVariable): Gen<StringVariable> {
                    const lptr = variables.asInitIndexPointerOfElem(l.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    const rptr = variables.asInitIndexPointerOfElem(r.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    const lsz = l.v.members._size.v.value;
                    const rsz = r.v.members._size.v.value;
                    l.v.members._ptr = variables.indexPointer(variables.arrayMemory<ArithmeticVariable>(variables.arithmeticType("I8"), []), 0, false, "SELF");
                    l.v.members._size.v.value = 0;
                    {
                        const { size, ptr } = strConcat(rt, l, lptr, pos.v.value)
                        l.v.members._ptr = ptr;
                        l.v.members._size.v.value = size;
                    }
                    {
                        const { size, ptr } = strConcat(rt, l, rptr, rsz)
                        l.v.members._ptr = ptr;
                        l.v.members._size.v.value = size;
                    }
                    {
                        const start = pos.v.value + count.v.value;
                        const { size, ptr } = strConcat(rt, l, variables.indexPointer(lptr.v.pointee, lptr.v.index + start, false, null), lsz - start);
                        l.v.members._ptr = ptr;
                        l.v.members._size.v.value = size;
                    }
                    return l;
                }
            },
            {
                op: "end",
                type: "FUNCTION PTR I8 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes: [], l: StringVariable): InitIndexPointerVariable<ArithmeticVariable> {
                    const lptr = variables.asInitIndexPointerOfElem(l.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    return variables.indexPointer(lptr.v.pointee, lptr.v.index + l.v.members._size.v.value, false, null);
                }
            },
            {
                op: "front",
                type: "FUNCTION LREF I8 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes: [], l: StringVariable): ArithmeticVariable {
                    if (l.v.members._size.v.value === 0) {
                        return variables.uninitArithmetic("I8", "SELF"); // C++11 behaviour
                    }
                    const lptr = variables.asInitIndexPointerOfElem(l.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    return variables.arrayMember(lptr.v.pointee, lptr.v.index) as ArithmeticVariable;
                }
            },
            {
                op: "back",
                type: "FUNCTION LREF I8 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes: [], l: StringVariable): ArithmeticVariable {
                    const size = l.v.members._size.v.value;
                    if (size === 0) {
                        return variables.uninitArithmetic("I8", "SELF"); // C++11 behaviour
                    }
                    const lptr = variables.asInitIndexPointerOfElem(l.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    return variables.arrayMember(lptr.v.pointee, lptr.v.index + size - 1) as ArithmeticVariable;
                }
            },
            {
                op: "data",
                type: "FUNCTION PTR I8 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes: [], l: StringVariable): InitPointerVariable<ArithmeticVariable> {
                    const size = l.v.members._size.v.value;
                    if (size === 0) {
                        return variables.directPointer(variables.uninitArithmetic("I8", "SELF"), null); // C++11 behaviour
                    }
                    return variables.asInitIndexPointerOfElem(l.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                }
            },
            {
                op: "c_str",
                type: "FUNCTION PTR I8 ( CLREF CLASS string < > )",
                default(_rt: CRuntime, _templateTypes: [], l: StringVariable): PointerVariable<ArithmeticVariable> {
                    return l.v.members._ptr;
                }
            },
            {
                op: "length",
                type: "FUNCTION I64 ( CLREF CLASS string < > )",
                default(_rt: CRuntime, _templateTypes: [], l: StringVariable): InitArithmeticVariable {
                    return variables.arithmetic("I64", l.v.members._size.v.value, null);
                }
            },
            {
                op: "size",
                type: "FUNCTION I64 ( CLREF CLASS string < > )",
                default(_rt: CRuntime, _templateTypes: [], l: StringVariable): InitArithmeticVariable {
                    return variables.arithmetic("I64", l.v.members._size.v.value, null);
                }
            },
        ]);

        const whitespaceChars = [9, 10, 32];
        const ascii_plusSign: number = 0x2B;
        const ascii_minusSign: number = 0x2D;
        const ascii_0: number = 0x30;
        const ascii_9: number = 0x39;
        const ascii_fullStop: number = 0x2E;
        const ascii_e: number = 0x65;

        function stox(rt: CRuntime, l: StringVariable, mode: "I32" | "I64" | "F32" | "F64"): InitArithmeticVariable | null {
            const lptr = variables.asInitIndexPointerOfElem(l.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
            const limits = variables.arithmeticProperties[mode];
            let chr: number;
            let ci: number = -1;
            while ((chr = rt.arithmeticValue(variables.arrayMember(lptr.v.pointee, lptr.v.index + ++ci))) !== 0) {
                if (!whitespaceChars.includes(chr)) {
                    break;
                }
            }
            if (chr === 0) {
                return null;
            }
            let mult: number = 1;
            switch (chr) {
                case ascii_plusSign:
                    chr = rt.arithmeticValue(variables.arrayMember(lptr.v.pointee, lptr.v.index + ++ci));
                    mult = 1;
                    break;
                case ascii_minusSign:
                    chr = rt.arithmeticValue(variables.arrayMember(lptr.v.pointee, lptr.v.index + ++ci));
                    mult = -1;
                    break;
                case 0:
                    return null;
            }
            let x: number = 0;
            while (chr >= ascii_0 && chr <= ascii_9) {
                x *= 10;
                x += chr - ascii_0;
                chr = rt.arithmeticValue(variables.arrayMember(lptr.v.pointee, lptr.v.index + ++ci));
            }
            if (limits.isFloat && chr === ascii_fullStop) {
                chr = rt.arithmeticValue(variables.arrayMember(lptr.v.pointee, lptr.v.index + ++ci));
                let q = 0.1;
                while (chr >= ascii_0 && chr <= ascii_9) {
                    x += q * (chr - ascii_0);
                    q *= 0.1;
                    chr = rt.arithmeticValue(variables.arrayMember(lptr.v.pointee, lptr.v.index + ++ci));
                }
            }
            if (limits.isFloat && chr === ascii_e) {
                let emul = 1;
                chr = rt.arithmeticValue(variables.arrayMember(lptr.v.pointee, lptr.v.index + ++ci));
                switch (chr) {
                    case ascii_plusSign:
                        chr = rt.arithmeticValue(variables.arrayMember(lptr.v.pointee, lptr.v.index + ++ci));
                        emul = 1;
                        break;
                    case ascii_minusSign:
                        chr = rt.arithmeticValue(variables.arrayMember(lptr.v.pointee, lptr.v.index + ++ci));
                        emul = -1;
                        break;
                    case 0:
                        return null;
                }
                let ex = 0;
                while (chr >= ascii_0 && chr <= ascii_9) {
                    ex *= 10;
                    ex += chr - ascii_0;
                    chr = rt.arithmeticValue(variables.arrayMember(lptr.v.pointee, lptr.v.index + ++ci));
                }
                if (ex === 0) {
                    return null;
                }
                x *= Math.pow(10, ex * emul);
            }
            x *= mult;
            if (x >= limits.minv && x <= limits.maxv) {
                return variables.arithmetic(mode, x, null);
            } else {
                rt.raiseException("stoi/stof/stod: The number is out of range.")
            }
        }

        function* integer_to_string(rt: CRuntime, l: ArithmeticVariable): Gen<StringVariable> {
            const memory = variables.arrayMemory<ArithmeticVariable>(variables.arithmeticType("I8"), []);
            let x = rt.arithmeticValue(l);
            if (x < 0) {
                memory.values.push(variables.arithmetic("I8", ascii_minusSign, { array: memory, index: memory.values.length }).v);
                x = -x;
            }
            if (x === 0) {
                memory.values.push(variables.arithmetic("I8", ascii_0, { array: memory, index: memory.values.length }).v);
            } else {
                let digits = new Array<number>();
                while (x > 0) {
                    digits.push(x % 10);
                    x = Math.floor(x / 10);
                }
                for (const d of digits.reverse()) {
                    memory.values.push(variables.arithmetic("I8", ascii_0 + d, { array: memory, index: memory.values.length }).v);
                }
            }
            memory.values.push(variables.arithmetic("I8", 0, { array: memory, index: memory.values.length }).v);
            const strYield = rt.defaultValue2(thisType, "SELF") as ResultOrGen<StringVariable>;
            const str = asResult(strYield) ?? (yield* strYield as Gen<StringVariable>);
            str.v.members._ptr = variables.indexPointer(memory, 0, false, "SELF");
            str.v.members._size.v.value = memory.values.length - 1;
            return str;

        }

        common.regGlobalFuncs(rt, [
            {
                op: "stoi",
                type: "FUNCTION I32 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes: [], l: StringVariable): InitArithmeticVariable {
                    return stox(rt, l, "I32") ?? rt.raiseException("stoi: Invalid argument (expected a string containing a number)");

                }
            },
            {
                op: "stol",
                type: "FUNCTION I32 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes: [], l: StringVariable): InitArithmeticVariable {
                    return stox(rt, l, "I32") ?? rt.raiseException("stol: Invalid argument (expected a string containing a number)");

                }
            },
            {
                op: "stoll",
                type: "FUNCTION I64 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes: [], l: StringVariable): InitArithmeticVariable {
                    return stox(rt, l, "I64") ?? rt.raiseException("stoll: Invalid argument (expected a string containing a number)");

                }
            },
            {
                op: "stof",
                type: "FUNCTION F32 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes: [], l: StringVariable): InitArithmeticVariable {
                    return stox(rt, l, "F32") ?? rt.raiseException("stoll: Invalid argument (expected a string containing a number)");

                }
            },
            {
                op: "stod",
                type: "FUNCTION F64 ( CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes: [], l: StringVariable): InitArithmeticVariable {
                    return stox(rt, l, "F64") ?? rt.raiseException("stoll: Invalid argument (expected a string containing a number)");

                }
            },
            {
                op: "to_string",
                type: "FUNCTION CLASS string < > ( I32 )",
                *default(rt: CRuntime, _templateTypes: [], l: ArithmeticVariable): Gen<StringVariable> {
                    return yield* integer_to_string(rt, l);
                }
            },
            {
                op: "to_string",
                type: "FUNCTION CLASS string < > ( U32 )",
                *default(rt: CRuntime, _templateTypes: [], l: ArithmeticVariable): Gen<StringVariable> {
                    return yield* integer_to_string(rt, l);
                }
            },
            {
                op: "to_string",
                type: "FUNCTION CLASS string < > ( I64 )",
                *default(rt: CRuntime, _templateTypes: [], l: ArithmeticVariable): Gen<StringVariable> {
                    return yield* integer_to_string(rt, l);
                }
            },
            {
                op: "to_string",
                type: "FUNCTION CLASS string < > ( U64 )",
                *default(rt: CRuntime, _templateTypes: [], l: ArithmeticVariable): Gen<StringVariable> {
                    return yield* integer_to_string(rt, l);
                }
            }
        ])

    }
}


