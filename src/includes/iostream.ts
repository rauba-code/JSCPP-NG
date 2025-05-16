import { CRuntime, OpSignature } from "../rt";
import { sizeNonSpace, skipSpace } from "../shared/string_utils";
import { ArithmeticProperties, ArithmeticVariable, InitArithmeticVariable, InitPointerVariable, MaybeLeft, PointerVariable, Variable, variables } from "../variables";
import * as unixapi from "../shared/unixapi";
import { iomanip_token_mode, IStreamType, IStreamVariable, OStreamType, OStreamVariable } from "../shared/ios_base";

export = {
    load(rt: CRuntime) {
        const charType = variables.arithmeticType("I8");
        rt.defineStruct("{global}", "istream", [
            {
                name: "buf",
                variable: variables.indexPointer<ArithmeticVariable>(variables.arrayMemory(charType, []), 0, false, "SELF")
            },
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
        ]);
        const cinType = rt.simpleType(["istream"]) as MaybeLeft<IStreamType>;
        const cin = variables.clone(rt.defaultValue(cinType.t, "SELF") as IStreamVariable, "SELF", false, rt.raiseException);
        variables.arithmeticAssign(cin.v.members.fd, unixapi.FD_STDIN, rt.raiseException);

        rt.addToNamespace("std", "cin", cin);

        type OpHandler = {
            type: string,
            op: OpSignature,
            default: ((rt: CRuntime, ...args: Variable[]) => Variable)
        };

        rt.defineStruct("{global}", "ostream", [
            {
                name: "fd",
                variable: variables.uninitArithmetic("I32", "SELF"),
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
                variable: variables.arithmetic("I8", iomanip_token_mode.defaultfloat, "SELF"),
            },
            {
                name: "position_mode",
                variable: variables.arithmetic("I8", iomanip_token_mode.right, "SELF"),
            },
        ]);
        const coutType = rt.simpleType(["ostream"]) as MaybeLeft<OStreamType>;
        const cout = variables.clone(rt.defaultValue(coutType.t, "SELF") as OStreamVariable, "SELF", false, rt.raiseException);
        variables.arithmeticAssign(cout.v.members.fd, unixapi.FD_STDOUT, rt.raiseException);

        rt.addToNamespace("std", "cout", cout);

        const endl = rt.getCharArrayFromString("\n");
        rt.addToNamespace("std", "endl", endl);

        function pad(rt: CRuntime, s: string, pmode: number, width: number, chr: number): string {
            if (width < 0) {
                return s;
            }
            switch (pmode) {
                case iomanip_token_mode.left:
                    return s.padEnd(width, String.fromCharCode(chr));
                case iomanip_token_mode.right:
                    return s.padStart(width, String.fromCharCode(chr));
                case iomanip_token_mode.internal:
                    rt.raiseException("Not yet implemented: internal");
                default:
                    rt.raiseException("Invalid position_mode value");
            }
        }

        const opHandlers: OpHandler[] = [{
            op: "o(_>>_)",
            type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > LREF Arithmetic )",
            default(rt: CRuntime, l: IStreamVariable, r: ArithmeticVariable): IStreamVariable {
                const stdio = rt.stdio();
                stdio.cinStop();

                const inputPromise: Promise<[boolean]> = new Promise((resolve) => {
                    let result = l.v.members.buf;
                    if (result.v.index + 1 >= result.v.pointee.values.length) {
                        stdio.getInput().then((result) => {
                            variables.indexPointerAssign(l.v.members.buf, rt.getCharArrayFromString(result.concat("\n")).v.pointee, 0, rt.raiseException);
                            resolve([false]);
                        });
                    } else {
                        resolve([true]);
                    }
                });
                inputPromise.then(([is_raw]) => {
                    const buf = l.v.members.buf;
                    //const fd = l.v.members.fd;
                    const eofbit = l.v.members.eofbit;
                    const failbit = l.v.members.failbit;
                    //const badbit = l.v.members.badbit;
                    if (eofbit.v.value) {
                        failbit.v.value = 1;
                        return l;
                    }
                    const oldptr = variables.clone(buf, "SELF", false, rt.raiseException);
                    if (buf.v.pointee.values.length <= buf.v.index) {
                        variables.arithmeticAssign(eofbit, 1, rt.raiseException);
                    }
                    skipSpace(rt, buf);
                    const len = sizeNonSpace(rt, buf);
                    const strseq = rt.getStringFromCharArray(buf, len);
                    const num = Number.parseFloat(strseq);
                    if (Number.isNaN(num)) {
                        variables.arithmeticAssign(l.v.members.failbit, 1, rt.raiseException);
                        stdio.cinProceed();
                        return;
                    }
                    variables.arithmeticAssign(r, num, rt.raiseException);
                    rt.adjustArithmeticValue((r as InitArithmeticVariable));
                    variables.arithmeticAssign(l.v.members.failbit, (len === 0) ? 1 : 0, rt.raiseException);
                    variables.indexPointerAssignIndex(l.v.members.buf, l.v.members.buf.v.index + len, rt.raiseException);

                    if (stdio.isMochaTest) {
                        stdio.write(rt.arithmeticValue(r).toString() + "\n");
                    } else if (!is_raw) {
                        stdio.write(rt.getStringFromCharArray(oldptr));
                    }

                    stdio.cinProceed();
                }).catch((err) => {
                    //console.log(err);
                    stdio.promiseError(err.message);
                })
                return l;
            }

        },
        {
            op: "o(_<<_)",
            type: "FUNCTION LREF CLASS ostream < > ( LREF CLASS ostream < > PTR I8 )",
            default(rt: CRuntime, l: OStreamVariable, r: PointerVariable<ArithmeticVariable>): OStreamVariable {
                const iptr = variables.asInitIndexPointerOfElem(r, variables.uninitArithmetic("I8", null));
                if (iptr === null) {
                    rt.raiseException("Variable is not an initialised index pointer");
                }
                if (l.v.members.width.v.value >= 0) {
                    const padded = pad(rt, rt.getStringFromCharArray(iptr), l.v.members.position_mode.v.value, l.v.members.width.v.value, l.v.members.fill.v.value);
                    unixapi.write(rt, l.v.members.fd, rt.getCharArrayFromString(padded));
                    variables.arithmeticAssign(l.v.members.width, -1, rt.raiseException);
                } else {
                    unixapi.write(rt, l.v.members.fd, iptr);
                }
                return l;
            }
        },
        {
            op: "o(_<<_)",
            type: "FUNCTION LREF CLASS ostream < > ( LREF CLASS ostream < > Arithmetic )",
            default(rt: CRuntime, l: OStreamVariable, r: ArithmeticVariable): OStreamVariable {
                const num = rt.arithmeticValue(r);
                const numProperties = variables.arithmeticProperties[r.t.sig];
                function numstr(rt: CRuntime, l: OStreamVariable, num: number, numProperties: ArithmeticProperties): string {
                    if (numProperties.isFloat) {
                        const prec = l.v.members.precision.v.value;
                        switch (l.v.members.float_display_mode.v.value) {
                            case iomanip_token_mode.fixed:
                                return prec >= 0 ? num.toFixed(prec) : num.toFixed();
                            case iomanip_token_mode.scientific:
                                return prec >= 0 ? num.toExponential(prec) : num.toExponential();
                            case iomanip_token_mode.hexfloat:
                                rt.raiseException("Not yet implemented: hexfloat")
                            case iomanip_token_mode.defaultfloat:
                                return num.toString();
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
                unixapi.write(rt, l.v.members.fd, str);
                return l;
            }
        }
        ];

        opHandlers.forEach((x) => {
            rt.regFunc(x.default, "{global}", x.op, rt.typeSignature(x.type));
        })


        type FunHandler = {
            type: string,
            op: string,
            default: ((rt: CRuntime, ...args: Variable[]) => Variable)
        };
        function _getline(rt: CRuntime, l: IStreamVariable, _s: InitPointerVariable<ArithmeticVariable>, _count: ArithmeticVariable, _delim: ArithmeticVariable): IStreamVariable {
            const stdio = rt.stdio();
            stdio.cinStop();

            const inputPromise: Promise<[boolean, IStreamVariable]> = new Promise((resolve) => {
                let result = l.v.members.buf;
                // + 1 because of trailing '\0'
                if (result.v.index + 1 >= result.v.pointee.values.length) {
                    stdio.getInput().then((result) => {
                        variables.indexPointerAssign(l.v.members.buf, rt.getCharArrayFromString(result.concat("\n")).v.pointee, 0, rt.raiseException);
                        resolve([false, l]);
                    });
                } else {
                    resolve([true, l]);
                }
            });
            inputPromise.then(([is_raw, l]) => {
                let b = l.v.members.buf;
                const count = rt.arithmeticValue(_count);
                const delim = rt.arithmeticValue(_delim);
                const s = variables.asInitIndexPointerOfElem(_s, variables.uninitArithmetic("I8", null));
                if (s === null) {
                    rt.raiseException("Not an index pointer");
                }
                const oldiptr = variables.clone(b, "SELF", false, rt.raiseException);
                if (b.v.index >= b.v.pointee.values.length) {
                    variables.arithmeticAssign(l.v.members.eofbit, 1, rt.raiseException);
                }
                let cnt = 0;
                while (cnt < count - 1) {
                    const si = rt.unbound(variables.arrayMember(s.v.pointee, s.v.index + cnt)) as ArithmeticVariable;
                    const bi = rt.arithmeticValue(variables.arrayMember(b.v.pointee, b.v.index));
                    if (bi === delim || bi === 0) {
                        // consume the delimiter
                        variables.indexPointerAssignIndex(b, b.v.index + 1, rt.raiseException);
                        variables.arithmeticAssign(si, 0, rt.raiseException);
                        break;
                    }
                    variables.arithmeticAssign(si, bi, rt.raiseException);
                    variables.indexPointerAssignIndex(b, b.v.index + 1, rt.raiseException);
                    cnt++;
                }
                if (cnt === 0) {
                    variables.arithmeticAssign(l.v.members.failbit, 1, rt.raiseException);
                }

                if (!is_raw) {
                    unixapi.write(rt, variables.arithmetic("I32", unixapi.FD_STDOUT, null), oldiptr);
                }


                stdio.cinProceed();
            }).catch((err) => {
                //console.log(err);
                stdio.promiseError(err.message);
            })
            return l;
        }

        const cinHandlers: FunHandler[] = [
            {
                op: "get",
                type: "FUNCTION I32 ( LREF CLASS istream < > )",
                default(rt: CRuntime, l: IStreamVariable): InitArithmeticVariable {
                    /*const stdio = rt.stdio();
                    stdio.cinStop();
                    const inputPromise: Promise<[boolean]> = new Promise((resolve) => {
                        let result = l.v.members.buf;
                        if (result.v.index >= result.v.pointee.values.length) {
                            stdio.getInput().then((result) => {
                                variables.indexPointerAssign(l.v.members.buf, rt.getCharArrayFromString(result).v.pointee, 0, rt.raiseException);
                                resolve([false]);
                            });
                        } else {
                            resolve([true]);
                        }
                    });
                    try {
                        const [is_raw] = await inputPromise;*/
                    let b = l.v.members.buf;
                    if (b.v.pointee.values.length <= b.v.index) {
                        variables.arithmeticAssign(l.v.members.eofbit, 1, rt.raiseException);
                        variables.arithmeticAssign(l.v.members.failbit, 1, rt.raiseException);
                        return variables.arithmetic("I32", -1, null);
                    }
                    const top = rt.unbound(variables.arrayMember(b.v.pointee, b.v.index));
                    variables.indexPointerAssignIndex(l.v.members.buf, l.v.members.buf.v.index + 1, rt.raiseException);

                    /*if (stdio.isMochaTest) {
                        stdio.write(String(rt.arithmeticValue(top)) + "\n");
                    } else if (!is_raw) {
                        stdio.write(String(rt.arithmeticValue(top)) + "\n");
                    }*/

                    //stdio.cinProceed();
                    return variables.clone((rt.expectValue(top) as InitArithmeticVariable), null, false, rt.raiseException);
                    /*} catch (err) {
                        console.log(err);
                        stdio.promiseError(err.message);
                        return variables.arithmetic("I32", -1, null);
                    }*/
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > PTR I8 I32 I8 )",
                default(rt: CRuntime, l: IStreamVariable, _s: InitPointerVariable<ArithmeticVariable>, _count: ArithmeticVariable, _delim: ArithmeticVariable): IStreamVariable {
                    return _getline(rt, l, _s, _count, _delim);
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > PTR I8 I32 )",
                default(rt: CRuntime, l: IStreamVariable, _s: InitPointerVariable<ArithmeticVariable>, _count: ArithmeticVariable): IStreamVariable {
                    return _getline(rt, l, _s, _count, variables.arithmetic("I8", 10, "SELF"));
                }
            }
        ]

        cinHandlers.forEach((x) => {
            rt.regFunc(x.default, cin.t, x.op, rt.typeSignature(x.type));
        })
    }
}
