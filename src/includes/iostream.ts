import { CRuntime } from "../rt";
import * as common from "../shared/common";
import * as ios_base_impl from "../shared/ios_base_impl";
import { ArithmeticBigVariable, ArithmeticNumVariable, ClassVariable, Gen, InitArithmeticBigVariable, InitArithmeticNumValue, InitArithmeticNumVariable, InitPointerVariable, MaybeLeft, PointerVariable, variables } from "../variables";
import * as unixapi from "../shared/unixapi";
import * as utf8 from "../utf8";
import { IStreamType, IStreamVariable, OStreamType, OStreamVariable } from "../shared/ios_base";
import { sizeUntilNull, StringVariable } from "../shared/string_utils";

export = {
    load(rt: CRuntime) {

        rt.include("cctype"); // gcc-specific
        rt.include("string");
        rt.include("cstdio"); // gcc-specific
        rt.include("iomanip"); // ensure manipulators like boolalpha are available via <iostream>
        const charType = variables.arithmeticNumType("I8");
        rt.defineStruct("{global}", "istream", [
            {
                name: "buf",
                variable: variables.indexPointer<ArithmeticNumVariable>(variables.arrayMemory(charType, []), 0, false, "SELF")
            },
            {
                name: "fd",
                variable: variables.uninitArithmeticNum("I32", "SELF"),
            },
            {
                name: "eofbit",
                variable: variables.arithmeticNum("BOOL", 0, "SELF"),
            },
            {
                name: "badbit",
                variable: variables.arithmeticNum("BOOL", 0, "SELF"),
            },
            {
                name: "failbit",
                variable: variables.arithmeticNum("BOOL", 0, "SELF"),
            },
            {
                name: "boolalpha",
                variable: variables.arithmeticNum("BOOL", 0, "SELF"),
            },
            {
                name: "skipws",
                variable: variables.arithmeticNum("BOOL", 1, "SELF"),
            },
        ], {});
        const cinType = rt.simpleType(["istream"]) as MaybeLeft<IStreamType>;
        const cin = variables.clone(rt, rt.defaultValue(cinType.t, "SELF") as IStreamVariable, "SELF", false);
        cin.v.members.fd.v.value = unixapi.FD_STDIN;

        rt.addToNamespace("std", "cin", cin, true);

        ios_base_impl.defineOstream(rt, "ostream", []);
        const coutType = rt.simpleType(["ostream"]) as MaybeLeft<OStreamType>;
        const cout = variables.clone(rt, rt.defaultValue(coutType.t, "SELF") as OStreamVariable, "SELF", false);
        cout.v.members.fd.v.value = unixapi.FD_STDOUT;

        rt.addToNamespace("std", "cout", cout, true);

        if (!("ws_t" in rt.typeMap)) {
            const endl = rt.getCharArrayFromString("\n");
            rt.addToNamespace("std", "endl", endl, true);

            rt.defineStruct("{global}", "ws_t", [], {});
            const ws: ClassVariable = {
                t: {
                    sig: "CLASS",
                    identifier: "ws_t",
                    memberOf: null,
                    templateSpec: [],
                },
                v: {
                    isConst: true,
                    lvHolder: "SELF",
                    members: {},
                    state: "INIT"
                }
            }
            rt.addToNamespace("std", "ws", ws, true);
        }

        function readChar(rt: CRuntime, l: IStreamVariable): Gen<InitArithmeticNumVariable> {
            const stdio = rt.stdio();
            stdio.cinStop();

            const retv = variables.uninitArithmeticNum("I32", null);
            const inputPromise: Promise<[boolean, IStreamVariable, ArithmeticNumVariable]> = new Promise((resolve) => {
                let result = l.v.members.buf;
                // + 1 because of trailing '\0'
                if (result.v.index + 1 >= result.v.pointee.values.length) {
                    stdio.getInput().then((result) => {
                        variables.indexPointerAssign(rt, l.v.members.buf, rt.getCharArrayFromString(result.concat("\n")).v.pointee, 0);
                        if (rt.config.printStdin === true) {
                            unixapi.write(rt, [], variables.arithmeticNum("I32", unixapi.FD_STDOUT, null), l.v.members.buf, variables.arithmeticNum("I32", sizeUntilNull(rt, l.v.members.buf), null));
                        }
                        resolve([false, l, retv]);
                    }, () => {
                        l.v.members.eofbit.v.value = 1;
                        l.v.members.failbit.v.value = 1;
                        try {
                            rt.raiseException("Unexpected end of input");
                        } catch (err) {
                            stdio.promiseError(err);
                        }
                    });
                } else {
                    resolve([true, l, retv]);
                }
            });
            inputPromise.then(([_is_raw, l, retv]) => {
                let buf = l.v.members.buf;
                if (l.v.members.eofbit.v.value === 1 || buf.v.pointee.values.length <= buf.v.index) {
                    l.v.members.eofbit.v.value = 1;
                    l.v.members.failbit.v.value = 1;
                    return variables.arithmeticNum("I32", -1, null);
                }
                const topv = rt.arithmeticNumValue2(variables.arrayMember(buf.v.pointee, buf.v.index));

                //variables.arithmeticAssign(retv, topv, rt.raiseException);
                retv.v.state = "INIT";
                (retv.v as InitArithmeticNumValue).value = topv;
                stdio.cinProceed();
            }).catch((err) => {
                stdio.promiseError(err);
            })
            function* stubGenerator() {
                yield retv as InitArithmeticNumVariable;
                return retv as InitArithmeticNumVariable;
            }
            return stubGenerator();
        }

        const whitespaceChars = [0, 9, 10, 32];

        common.regOps(rt, [{
            op: "o(_>>_)",
            type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > LREF Arithmetic )",
            *default(rt: CRuntime, _templateTypes: [], l: IStreamVariable, r: ArithmeticNumVariable | ArithmeticBigVariable): Gen<IStreamVariable> {
                const eofbit = l.v.members.eofbit;
                const failbit = l.v.members.failbit;
                const buf = l.v.members.buf;
                let char: InitArithmeticNumVariable;
                while (true) {
                    char = yield* readChar(rt, l);
                    if (eofbit.v.value === 1 || failbit.v.value === 1) {
                        failbit.v.value = 1;
                        return l;
                    }
                    if (l.v.members.skipws.v.value === 0 || !(whitespaceChars.includes(char.v.value))) {
                        break;
                    }
                    variables.indexPointerAssignIndex(rt, buf, buf.v.index + 1);
                }
                if (r.t.sig === "I8") {
                    variables.arithmeticNumAssign(rt, r as ArithmeticNumVariable, char.v.value);
                    variables.indexPointerAssignIndex(rt, buf, buf.v.index + 1);
                    const stdio = rt.stdio();
                    if (stdio.isMochaTest) {
                        stdio.write(String.fromCodePoint(char.v.value) + "\n");
                    }
                } else {
                    let wordValues: number[] = [];
                    while (!(whitespaceChars.includes(char.v.value))) {
                        wordValues.push(char.v.value);
                        variables.indexPointerAssignIndex(rt, buf, buf.v.index + 1);
                        char = yield* readChar(rt, l);
                        if (eofbit.v.value === 1 || failbit.v.value === 1) {
                            failbit.v.value = 1;
                            return l;
                        }
                    }
                    if (wordValues.length === 0) {
                        failbit.v.value = 1;
                        return l;
                    }
                    const wordString = utf8.fromUtf8CharArray(new Uint8Array(wordValues));
                    const stdio = rt.stdio();
                    if (stdio.isMochaTest) {
                        stdio.write(wordString + "\n");
                    }

                    // Special handling for reading into BOOL: accept "true"/"false" (case-insensitive),
                    // and also numeric 0/1 (or any non-zero as true) for user convenience.
                    let handled = false;
                    if (r.t.sig === "BOOL") {
                        const ws = wordString.trim().toLowerCase();
                        if (ws === "true" || ws === "false") {
                            variables.arithmeticNumAssign(rt, r as ArithmeticNumVariable, ws === "true" ? 1 : 0);
                            handled = true;
                        }
                    }

                    if (!handled) {
                        if (r.t.sig in variables.arithmeticNumSig) {
                            const num = Number.parseFloat(wordString);
                            if (Number.isNaN(num)) {
                                l.v.members.failbit.v.value = 1;
                                return l;
                            }
                            variables.arithmeticNumAssign(rt, r as ArithmeticNumVariable, num);
                        } else {
                            let num : bigint;
                            try {
                                num = BigInt(wordString);
                            } catch (e) {
                                l.v.members.failbit.v.value = 1;
                                return l;
                            }
                            variables.arithmeticBigAssign(rt, r as ArithmeticBigVariable, num);
                            rt.adjustArithmeticBigValue(r as InitArithmeticBigVariable);
                        }
                    }

                }
                rt.adjustArithmeticNumValue((r as InitArithmeticNumVariable));
                return l;
            }
        },
        {
            op: "o(_>>_)",
            type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > PTR I8 )",
            *default(rt: CRuntime, _templateTypes: [], l: IStreamVariable, _r: PointerVariable<ArithmeticNumVariable>): Gen<IStreamVariable> {
                const r = variables.asInitIndexPointerOfElem(_r, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                const eofbit = l.v.members.eofbit;
                const failbit = l.v.members.failbit;
                const buf = l.v.members.buf;
                let char: InitArithmeticNumVariable;
                while (true) {
                    char = yield* readChar(rt, l);
                    if (eofbit.v.value === 1 || failbit.v.value === 1) {
                        failbit.v.value = 1;
                        return l;
                    }
                    if (!(whitespaceChars.includes(char.v.value))) {
                        break;
                    }
                    variables.indexPointerAssignIndex(rt, buf, buf.v.index + 1);
                }

                let i = 0;
                while (!(whitespaceChars.includes(char.v.value))) {
                    variables.arithmeticNumValueAssign(rt, (rt.unbound(variables.arrayMember(r.v.pointee, r.v.index + i)) as ArithmeticNumVariable).v, char.v.value)
                    i++;
                    variables.indexPointerAssignIndex(rt, buf, buf.v.index + 1);
                    char = yield* readChar(rt, l);
                    if (eofbit.v.value === 1 || failbit.v.value === 1) {
                        failbit.v.value = 1;
                        return l;
                    }
                }
                variables.arithmeticNumValueAssign(rt, (rt.unbound(variables.arrayMember(r.v.pointee, r.v.index + i)) as ArithmeticNumVariable).v, 0)
                if (i === 0) {
                    failbit.v.value = 1;
                    return l;
                }

                return l;
            }
        },
        {
            op: "o(_>>_)",
            type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > CLREF CLASS ws_t < > )",
            *default(rt: CRuntime, _templateTypes: [], l: IStreamVariable, _r: ClassVariable): Gen<IStreamVariable> {
                const eofbit = l.v.members.eofbit;
                const failbit = l.v.members.failbit;
                const buf = l.v.members.buf;
                let char: InitArithmeticNumVariable;
                while (true) {
                    char = yield* readChar(rt, l);
                    if (eofbit.v.value === 1 || failbit.v.value === 1) {
                        failbit.v.value = 1;
                        return l;
                    }
                    if (!(whitespaceChars.includes(char.v.value))) {
                        break;
                    }
                    variables.indexPointerAssignIndex(rt, buf, buf.v.index + 1);
                }


                return l;
            }
        },
        {
            op: "o(_>>_)",
            type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > CLREF CLASS string < > )",
            *default(rt: CRuntime, _templateTypes: [], l: IStreamVariable, r: StringVariable): Gen<IStreamVariable> {
                const memory = variables.arrayMemory<ArithmeticNumVariable>(variables.arithmeticNumType("I8"), []);
                const eofbit = l.v.members.eofbit;
                const failbit = l.v.members.failbit;
                const buf = l.v.members.buf;
                let char: InitArithmeticNumVariable;
                while (true) {
                    char = yield* readChar(rt, l);
                    if (eofbit.v.value === 1 || failbit.v.value === 1) {
                        failbit.v.value = 1;
                        return l;
                    }
                    if (!(whitespaceChars.includes(char.v.value))) {
                        break;
                    }
                    variables.indexPointerAssignIndex(rt, buf, buf.v.index + 1);
                }

                let i = 0;
                while (!(whitespaceChars.includes(char.v.value))) {
                    memory.values.push(variables.arithmeticNum("I8", char.v.value, { array: memory, index: memory.values.length }).v);
                    i++;
                    variables.indexPointerAssignIndex(rt, buf, buf.v.index + 1);
                    char = yield* readChar(rt, l);
                    if (eofbit.v.value === 1 || failbit.v.value === 1) {
                        failbit.v.value = 1;
                        return l;
                    }
                }
                memory.values.push(variables.arithmeticNum("I8", 0, { array: memory, index: memory.values.length }).v);
                r.v.members._ptr = variables.indexPointer(memory, 0, false, "SELF");
                r.v.members._size.v.value = memory.values.length - 1;
                if (i === 0) {
                    failbit.v.value = 1;
                    return l;
                }

                return l;
            }
        },
        ]);

        function _getline(rt: CRuntime, l: IStreamVariable, _s: InitPointerVariable<ArithmeticNumVariable>, _count: ArithmeticNumVariable, _delim: ArithmeticNumVariable): IStreamVariable {
            const stdio = rt.stdio();
            stdio.cinStop();

            const inputPromise: Promise<[boolean, IStreamVariable]> = new Promise((resolve) => {
                let result = l.v.members.buf;
                // + 1 because of trailing '\0'
                if (result.v.index + 1 >= result.v.pointee.values.length) {
                    stdio.getInput().then((result) => {
                        variables.indexPointerAssign(rt, l.v.members.buf, rt.getCharArrayFromString(result.concat("\n")).v.pointee, 0);
                        resolve([false, l]);
                    }, () => {
                        l.v.members.eofbit.v.value = 1;
                        l.v.members.failbit.v.value = 1;
                        try {
                            rt.raiseException("Unexpected end of input");
                        } catch (err) {
                            stdio.promiseError(err);
                        }
                    });
                } else {
                    resolve([true, l]);
                }
            });
            inputPromise.then(([is_raw, l]) => {
                let b = l.v.members.buf;
                const count = rt.arithmeticNumValue(_count);
                const delim = rt.arithmeticNumValue(_delim);
                const s = variables.asInitIndexPointerOfElem(_s, variables.uninitArithmeticNum("I8", null));
                if (s === null) {
                    rt.raiseException("Not an index pointer");
                }
                const oldiptr = variables.clone(rt, b, "SELF", false);
                if (b.v.index >= b.v.pointee.values.length) {
                    l.v.members.eofbit.v.value = 1;
                }
                let cnt = 0;
                while (cnt < count - 1) {
                    const si = rt.unbound(variables.arrayMember(s.v.pointee, s.v.index + cnt)) as ArithmeticNumVariable;
                    const bi = rt.arithmeticNumValue2(variables.arrayMember(b.v.pointee, b.v.index));
                    if (bi === delim || bi === 0) {
                        // consume the delimiter
                        variables.indexPointerAssignIndex(rt, b, b.v.index + 1);
                        variables.arithmeticNumAssign(rt, si, 0);
                        break;
                    }
                    variables.arithmeticNumAssign(rt, si, bi);
                    variables.indexPointerAssignIndex(rt, b, b.v.index + 1);
                    cnt++;
                }
                if (cnt === 0) {
                    l.v.members.failbit.v.value = 1;
                }

                if (!is_raw) {
                    unixapi.write(rt, [], variables.arithmeticNum("I32", unixapi.FD_STDOUT, null), oldiptr, variables.arithmeticNum("I32", sizeUntilNull(rt, oldiptr), null));
                }


                stdio.cinProceed();
            }).catch((err) => {
                //console.log(err);
                stdio.promiseError(err);
            })
            return l;
        }
        function _getlineStr(rt: CRuntime, l: IStreamVariable, s: StringVariable, _delim: ArithmeticNumVariable): IStreamVariable {
            const stdio = rt.stdio();
            stdio.cinStop();

            const inputPromise: Promise<[boolean, IStreamVariable]> = new Promise((resolve) => {
                let result = l.v.members.buf;
                // + 1 because of trailing '\0'
                if (result.v.index + 1 >= result.v.pointee.values.length) {
                    stdio.getInput().then((result) => {
                        variables.indexPointerAssign(rt, l.v.members.buf, rt.getCharArrayFromString(result.concat("\n")).v.pointee, 0);
                        resolve([false, l]);
                    }, () => {
                        l.v.members.eofbit.v.value = 1;
                        l.v.members.failbit.v.value = 1;
                        try {
                            rt.raiseException("Unexpected end of input");
                        } catch (err) {
                            stdio.promiseError(err);
                        }
                    });
                } else {
                    resolve([true, l]);
                }
            });
            inputPromise.then(([is_raw, l]) => {
                let b = l.v.members.buf;
                const delim = rt.arithmeticValue(_delim);
                const i8type = s.v.members._ptr.t.pointee;
                const oldiptr = variables.clone(rt, b, "SELF", false);
                if (b.v.index >= b.v.pointee.values.length) {
                    l.v.members.eofbit.v.value = 1;
                    l.v.members.failbit.v.value = 1;
                    return;
                }
                let cnt = 0;
                const memory = variables.arrayMemory<ArithmeticNumVariable>(i8type, []);
                while (true) {
                    const bi = rt.arithmeticNumValue2(variables.arrayMember(b.v.pointee, b.v.index));
                    if (bi === delim || bi === 0) {
                        // consume the delimiter
                        variables.indexPointerAssignIndex(rt, b, b.v.index + 1);
                        break;
                    }
                    memory.values.push(variables.arithmeticNum(i8type.sig, bi, { array: memory, index: cnt }).v);
                    variables.indexPointerAssignIndex(rt, b, b.v.index + 1);
                    cnt++;
                }
                memory.values.push(variables.arithmeticNum(i8type.sig, 0, { array: memory, index: cnt }).v);
                if (cnt === 0) {
                    l.v.members.failbit.v.value = 1;
                }
                variables.indexPointerAssign(rt, s.v.members._ptr, memory, 0);
                s.v.members._size.v.value = cnt;

                if (!is_raw) {
                    unixapi.write(rt, [], variables.arithmeticNum("I32", unixapi.FD_STDOUT, null), oldiptr, variables.arithmeticNum("I32", sizeUntilNull(rt, oldiptr), null));
                }


                stdio.cinProceed();
            }).catch((err) => {
                //console.log(err);
                stdio.promiseError(err);
            })
            return l;
        }

        common.regMemberFuncs(rt, "istream", [
            {
                op: "get",
                type: "FUNCTION I32 ( LREF CLASS istream < > )",
                *default(rt: CRuntime, _templateTypes: [], l: IStreamVariable): Gen<ArithmeticNumVariable> {
                    const retv = yield* readChar(rt, l);
                    const buf = l.v.members.buf;
                    variables.indexPointerAssignIndex(rt, buf, buf.v.index + 1);
                    return retv;
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > PTR I8 I32 I8 )",
                default(rt: CRuntime, _templateTypes: [], l: IStreamVariable, _s: InitPointerVariable<ArithmeticNumVariable>, _count: ArithmeticNumVariable, _delim: ArithmeticNumVariable): IStreamVariable {
                    return _getline(rt, l, _s, _count, _delim);
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > PTR I8 I32 )",
                default(rt: CRuntime, _templateTypes: [], l: IStreamVariable, _s: InitPointerVariable<ArithmeticNumVariable>, _count: ArithmeticNumVariable): IStreamVariable {
                    return _getline(rt, l, _s, _count, variables.arithmeticNum("I8", 10, "SELF"));
                }
            }
        ]);

        common.regGlobalFuncs(rt, [
            {
                op: "getline",
                type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > CLREF CLASS string < > I8 )",
                default(rt: CRuntime, _templateTypes: [], input: IStreamVariable, str: StringVariable, delim: ArithmeticNumVariable) {
                    _getlineStr(rt, input, str, delim);
                    return input;
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes: [], input: IStreamVariable, str: StringVariable) {
                    _getlineStr(rt, input, str, variables.arithmeticNum("I8", 10, null));
                    return input;
                }
            },
        ]);

    }
}
