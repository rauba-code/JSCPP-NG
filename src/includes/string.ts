import { CRuntime, OpSignature } from "../rt";
import * as common from "../shared/common";
import { strcmp, StringVariable, strncmp } from "../shared/string_utils";
import { ArithmeticVariable, InitArithmeticVariable, InitPointerVariable, PointerVariable, variables } from "../variables";

export = {
    load(rt: CRuntime) {
        rt.defineStruct("{global}", "string", [
            {
                name: "_ptr",
                variable: variables.uninitPointer(variables.arithmeticType("I8"), null, "SELF"),
            },
            {
                name: "_size",
                variable: variables.arithmetic("I64", 0, "SELF")
            }
        ])

        function cmpOverloads(op: OpSignature, fn: (strcmpRetv: number) => boolean): common.OpHandler[] {
            return [{
                op,
                type: "FUNCTION BOOL ( LREF CLASS string < > LREF CLASS string < > )",
                default(rt: CRuntime, l: StringVariable, r: StringVariable): InitArithmeticVariable {
                    const lptr = variables.asInitIndexPointerOfElem(l.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    const rptr = variables.asInitIndexPointerOfElem(r.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    return variables.arithmetic("BOOL", fn(strncmp(rt, lptr, rptr, l.v.members._size.v.value)) ? 1 : 0, null);
                }
            },
            {
                op,
                type: "FUNCTION BOOL ( LREF CLASS string < > PTR I8 )",
                default(rt: CRuntime, l: StringVariable, r: PointerVariable<ArithmeticVariable>): InitArithmeticVariable {
                    const lptr = variables.asInitIndexPointerOfElem(l.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    const rptr = variables.asInitIndexPointerOfElem(r, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    return variables.arithmetic("BOOL", fn(strcmp(rt, lptr, rptr)) ? 1 : 0, null);
                }
            },
            {
                op,
                type: "FUNCTION BOOL ( PTR I8 LREF CLASS string < > )",
                default(rt: CRuntime, l: PointerVariable<ArithmeticVariable>, r: StringVariable): InitArithmeticVariable {
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
                default(rt: CRuntime, l: StringVariable, _r: PointerVariable<ArithmeticVariable>): StringVariable {
                    const r = variables.asInitIndexPointerOfElem(_r, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    let i: number = 0;
                    while (rt.arithmeticValue(variables.arrayMember(r.v.pointee, r.v.index + i)) !== 0) {
                        i++;
                    }
                    variables.arithmeticAssign(l.v.members._size, i, rt.raiseException);
                    variables.indexPointerAssign(l.v.members._ptr, r.v.pointee, r.v.index, rt.raiseException);

                    return l;
                }
            },
            {
                op: "o(_=_)",
                type: "FUNCTION LREF CLASS string < > ( LREF CLASS string < > LREF CLASS string < > )",
                default(rt: CRuntime, l: StringVariable, r: StringVariable): StringVariable {
                    const rptr = variables.asInitIndexPointerOfElem(r.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    variables.arithmeticAssign(l.v.members._size, r.v.members._size.v.value, rt.raiseException);
                    variables.indexPointerAssign(l.v.members._ptr, rptr.v.pointee, rptr.v.index, rt.raiseException);

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
                default(rt: CRuntime, l: StringVariable, _idx: ArithmeticVariable): ArithmeticVariable {
                    const idx = rt.arithmeticValue(_idx);
                    if (idx < 0 || idx >= l.v.members._size.v.value) {
                        return variables.uninitArithmetic("I8", "SELF"); // C++11 behaviour
                    }
                    const lptr = variables.asInitIndexPointerOfElem(l.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    return variables.arrayMember(lptr.v.pointee, lptr.v.index + idx) as ArithmeticVariable;
                }
            },
        ]);

        common.regMemberFuncs(rt, "string", [
            {
                op: "front",
                type: "FUNCTION LREF I8 ( LREF CLASS STRING < > )",
                default(rt: CRuntime, l: StringVariable): ArithmeticVariable {
                    if (l.v.members._size.v.value === 0) {
                        return variables.uninitArithmetic("I8", "SELF"); // C++11 behaviour
                    }
                    const lptr = variables.asInitIndexPointerOfElem(l.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    return variables.arrayMember(lptr.v.pointee, lptr.v.index) as ArithmeticVariable;
                }
            },
            {
                op: "back",
                type: "FUNCTION LREF I8 ( LREF CLASS STRING < > )",
                default(rt: CRuntime, l: StringVariable): ArithmeticVariable {
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
                type: "FUNCTION PTR I8 ( LREF CLASS STRING < > )",
                default(rt: CRuntime, l: StringVariable): InitPointerVariable<ArithmeticVariable> {
                    const size = l.v.members._size.v.value;
                    if (size === 0) {
                        return variables.directPointer(variables.uninitArithmetic("I8", "SELF"), null); // C++11 behaviour
                    }
                    return variables.asInitIndexPointerOfElem(l.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                }
            },
            {
                op: "c_str",
                type: "FUNCTION PTR I8 ( LREF CLASS STRING < > )",
                default(_rt: CRuntime, l: StringVariable): PointerVariable<ArithmeticVariable> {
                    return l.v.members._ptr;
                }
            },
        ])

    }
}


