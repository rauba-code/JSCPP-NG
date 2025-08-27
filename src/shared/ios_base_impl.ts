import { CRuntime, MemberObject } from "../rt";
import { ArithmeticProperties, ArithmeticVariable, PointerVariable, variables } from "../variables";
import * as common from "./common";
import * as ios_base from "./ios_base";
import * as unixapi from "../shared/unixapi";
import { StringVariable } from "./string_utils";

function pad(rt: CRuntime, s: string, pmode: number, width: number, chr: number): string {
    if (width < 0) {
        return s;
    }
    switch (pmode) {
        case ios_base.iomanip_token_mode.left:
            return s.padEnd(width, String.fromCharCode(chr));
        case ios_base.iomanip_token_mode.right:
            return s.padStart(width, String.fromCharCode(chr));
        case ios_base.iomanip_token_mode.internal:
            rt.raiseException("Not yet implemented: internal");
        default:
            rt.raiseException("Invalid position_mode value");
    }
}

export function defineOstream(rt: CRuntime, name: string, moreMembers: MemberObject[]) {
    rt.defineStruct("{global}", name, [
        {
            name: "fd",
            variable: variables.uninitArithmetic("I32", "SELF"),
        },
        {
            name: "eofbit",
            variable: variables.arithmetic("BOOL", 0, "SELF"),
        },
        {
            name: "badbit",
            variable: variables.arithmetic("BOOL", 0, "SELF"),
        },
        {
            name: "failbit",
            variable: variables.arithmetic("BOOL", 0, "SELF"),
        },
        {
            name: "base",
            variable: variables.arithmetic("I8", 10, "SELF"),
        },
        {
            name: "fill",
            variable: variables.arithmetic("I8", 32, "SELF"),
        },
        {
            name: "precision",
            variable: variables.arithmetic("I8", -1, "SELF"),
        },
        {
            name: "width",
            variable: variables.arithmetic("I8", -1, "SELF"),
        },
        {
            name: "float_display_mode",
            variable: variables.arithmetic("I8", ios_base.iomanip_token_mode.defaultfloat, "SELF"),
        },
        {
            name: "position_mode",
            variable: variables.arithmetic("I8", ios_base.iomanip_token_mode.right, "SELF"),
        },
        {
            name: "boolalpha",
            variable: variables.arithmetic("BOOL", 0, "SELF"),
        },
        ...moreMembers
    ]);

    common.regOps(rt, [{
        op: "o(_<<_)",
        type: `FUNCTION LREF CLASS ${name} < > ( LREF CLASS ${name} < > PTR I8 )`,
        default(rt: CRuntime, _templateTypes: [], l: ios_base.OStreamVariable, r: PointerVariable<ArithmeticVariable>): ios_base.OStreamVariable {
            const iptr = variables.asInitIndexPointerOfElem(r, variables.uninitArithmetic("I8", null)) ??
                rt.raiseException("Variable is not an initialised index pointer");
            if (l.v.members.width.v.value >= 0) {
                const padded = pad(rt, rt.getStringFromCharArray(iptr), l.v.members.position_mode.v.value, l.v.members.width.v.value, l.v.members.fill.v.value);
                unixapi.write(rt, [], l.v.members.fd, rt.getCharArrayFromString(padded));
                variables.arithmeticAssign(l.v.members.width, -1, rt.raiseException);
            } else {
                unixapi.write(rt, [], l.v.members.fd, iptr);
            }
            return l;
        }
    },
    {
        op: "o(_<<_)",
        type: `FUNCTION LREF CLASS ${name} < > ( LREF CLASS ${name} < > CLREF CLASS string < > )`,
        default(rt: CRuntime, _templateTypes: [], l: ios_base.OStreamVariable, r: StringVariable): ios_base.OStreamVariable {
            const iptr = variables.asInitIndexPointerOfElem(r.v.members._ptr, variables.uninitArithmetic("I8", null));
            if (iptr === null) {
                return l;
            }
            if (l.v.members.width.v.value >= 0) {
                const padded = pad(rt, rt.getStringFromCharArray(iptr, r.v.members._size.v.value), l.v.members.position_mode.v.value, l.v.members.width.v.value, l.v.members.fill.v.value);
                unixapi.write(rt, [], l.v.members.fd, rt.getCharArrayFromString(padded));
                variables.arithmeticAssign(l.v.members.width, -1, rt.raiseException);
            } else {
                unixapi.write(rt, [], l.v.members.fd, iptr);
            }
            return l;
        }
    },
    {
        op: "o(_<<_)",
        type: `FUNCTION LREF CLASS ${name} < > ( LREF CLASS ${name} < > Arithmetic )`,
        default(rt: CRuntime, _templateTypes: [], l: ios_base.OStreamVariable, r: ArithmeticVariable): ios_base.OStreamVariable {
            const num = rt.arithmeticValue(r);
            const numProperties = variables.arithmeticProperties[r.t.sig];
            function numstr(rt: CRuntime, l: ios_base.OStreamVariable, num: number, numProperties: ArithmeticProperties): string {
                if (r.t.sig === "I8") {
                    return rt.getStringFromCharArray(variables.indexPointer(variables.arrayMemory(r.t, [r.v]), 0, false, null));
                }
                if (r.t.sig === "BOOL" && l.v.members.boolalpha.v.value === 1) {
                    return num !== 0 ? "true" : "false";
                }
                if (numProperties.isFloat) {
                    const prec = l.v.members.precision.v.value;
                    switch (l.v.members.float_display_mode.v.value) {
                        case ios_base.iomanip_token_mode.fixed:
                            return prec >= 0 ? num.toFixed(prec) : num.toFixed();
                        case ios_base.iomanip_token_mode.scientific:
                            return prec >= 0 ? num.toExponential(prec) : num.toExponential();
                        case ios_base.iomanip_token_mode.hexfloat:
                            rt.raiseException("Not yet implemented: hexfloat")
                        case ios_base.iomanip_token_mode.defaultfloat:
                            return prec >= 0 ? num.toFixed(prec - 1).replace(/0+$/, "").replace(/\.$/, "") : num.toString();
                        default:
                            rt.raiseException("Invalid float_display_mode value")
                    }
                } else {
                    const base = l.v.members.base.v.value;
                    if (base !== 8 && base !== 10 && base !== 16) {
                        rt.raiseException("Invalid base value")
                    }
                    if (base === 10 || num >= 0) {
                        return num.toString(base);
                    } else {
                        return ((numProperties.maxv + 1 - numProperties.minv) + num).toString(base);
                    }
                }
            }

            const ns = numstr(rt, l, num, numProperties);
            const padded = pad(rt, ns, l.v.members.position_mode.v.value, l.v.members.width.v.value, l.v.members.fill.v.value);
            const str = rt.getCharArrayFromString(padded);
            variables.arithmeticAssign(l.v.members.width, -1, rt.raiseException);
            unixapi.write(rt, [], l.v.members.fd, str);
            return l;
        }
    },
    {
        op: "o(!_)",
        type: `FUNCTION BOOL ( LREF CLASS ${name} < > )`,
        default(_rt: CRuntime, _templateTypes: [], _this: ios_base.OStreamVariable) {
            const failbit = _this.v.members.failbit.v.value;
            const badbit = _this.v.members.badbit.v.value;
            return variables.arithmetic("BOOL", failbit | badbit, null);
        }
    },
    {
        op: "o(_bool)",
        type: `FUNCTION BOOL ( LREF CLASS ${name} < > )`,
        default(_rt: CRuntime, _templateTypes: [], _this: ios_base.OStreamVariable): ArithmeticVariable {
            const failbit = _this.v.members.failbit.v.value;
            const badbit = _this.v.members.badbit.v.value;
            return variables.arithmetic("BOOL", (failbit !== 0 || badbit !== 0) ? 0 : 1, null);
        }
    },
    ]);
}
