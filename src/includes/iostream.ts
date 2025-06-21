import { CRuntime } from "../rt";
import * as common from "../shared/common";
import * as ios_base_impl from "../shared/ios_base_impl";
import { ArithmeticVariable, Gen, InitArithmeticValue, InitArithmeticVariable, InitPointerVariable, MaybeLeft, PointerVariable, variables } from "../variables";
import * as unixapi from "../shared/unixapi";
import * as utf8 from "../utf8";
import { IStreamType, IStreamVariable, OStreamType, OStreamVariable } from "../shared/ios_base";
import { StringVariable } from "../shared/string_utils";

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

        ios_base_impl.defineOstream(rt, "ostream", []);
        const coutType = rt.simpleType(["ostream"]) as MaybeLeft<OStreamType>;
        const cout = variables.clone(rt.defaultValue(coutType.t, "SELF") as OStreamVariable, "SELF", false, rt.raiseException);
        variables.arithmeticAssign(cout.v.members.fd, unixapi.FD_STDOUT, rt.raiseException);

        rt.addToNamespace("std", "cout", cout);

        if (!rt.varAlreadyDefined("endl")) {
            const endl = rt.getCharArrayFromString("\n");
            rt.addToNamespace("std", "endl", endl);
        }

        function readChar(rt: CRuntime, l: IStreamVariable): Gen<InitArithmeticVariable> {
            const stdio = rt.stdio();
            stdio.cinStop();

            const retv = variables.uninitArithmetic("I32", null);
            const inputPromise: Promise<[boolean, IStreamVariable, ArithmeticVariable]> = new Promise((resolve) => {
                let result = l.v.members.buf;
                // + 1 because of trailing '\0'
                if (result.v.index + 1 >= result.v.pointee.values.length) {
                    stdio.getInput().then((result) => {
                        variables.indexPointerAssign(l.v.members.buf, rt.getCharArrayFromString(result.concat("\n")).v.pointee, 0, rt.raiseException);
                        if (!stdio.isMochaTest) {
                            unixapi.write(rt, variables.arithmetic("I32", unixapi.FD_STDOUT, null), l.v.members.buf);
                        }
                        resolve([false, l, retv]);
                    });
                } else {
                    resolve([true, l, retv]);
                }
            });
            inputPromise.then(([_is_raw, l, retv]) => {
                let buf = l.v.members.buf;
                if (buf.v.pointee.values.length <= buf.v.index) {
                    variables.arithmeticAssign(l.v.members.eofbit, 1, rt.raiseException);
                    variables.arithmeticAssign(l.v.members.failbit, 1, rt.raiseException);
                    return variables.arithmetic("I32", -1, null);
                }
                const topv = rt.arithmeticValue(variables.arrayMember(buf.v.pointee, buf.v.index));

                //variables.arithmeticAssign(retv, topv, rt.raiseException);
                retv.v.state = "INIT";
                (retv.v as InitArithmeticValue).value = topv;
                stdio.cinProceed();
            }).catch((err) => {
                stdio.promiseError(err.message);
            })
            function* stubGenerator() {
                yield retv as InitArithmeticVariable;
                return retv as InitArithmeticVariable;
            }
            return stubGenerator();
        }

        const whitespaceChars = [0, 9, 10, 32];

        common.regOps(rt, [{
            op: "o(_>>_)",
            type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > LREF Arithmetic )",
            *default(rt: CRuntime, l: IStreamVariable, r: ArithmeticVariable): Gen<IStreamVariable> {
                const eofbit = l.v.members.eofbit;
                const failbit = l.v.members.failbit;
                const buf = l.v.members.buf;
                let char: InitArithmeticVariable;
                while (true) {
                    char = yield* readChar(rt, l);
                    if (eofbit.v.value === 1 || failbit.v.value === 1) {
                        failbit.v.value = 1;
                        return l;
                    }
                    if (!(whitespaceChars.includes(char.v.value))) {
                        break;
                    }
                    variables.indexPointerAssignIndex(buf, buf.v.index + 1, rt.raiseException);
                }
                if (r.t.sig === "I8") {
                    variables.arithmeticAssign(r, char.v.value, rt.raiseException);
                    variables.indexPointerAssignIndex(buf, buf.v.index + 1, rt.raiseException);
                    const stdio = rt.stdio();
                    if (stdio.isMochaTest) {
                        stdio.write(String.fromCodePoint(char.v.value) + "\n");
                    }
                } else {
                    let wordValues: number[] = [];
                    while (!(whitespaceChars.includes(char.v.value))) {
                        wordValues.push(char.v.value);
                        variables.indexPointerAssignIndex(buf, buf.v.index + 1, rt.raiseException);
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
                    const num = Number.parseFloat(wordString);
                    const stdio = rt.stdio();
                    if (stdio.isMochaTest) {
                        stdio.write(wordString + "\n");
                    }
                    if (Number.isNaN(num)) {
                        variables.arithmeticAssign(l.v.members.failbit, 1, rt.raiseException);
                        return l;
                    }
                    variables.arithmeticAssign(r, num, rt.raiseException);

                }
                rt.adjustArithmeticValue((r as InitArithmeticVariable));
                return l;
            }
        },
        {
            op: "o(_>>_)",
            type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > PTR I8 )",
            *default(rt: CRuntime, l: IStreamVariable, _r: PointerVariable<ArithmeticVariable>): Gen<IStreamVariable> {
                const r = variables.asInitIndexPointerOfElem(_r, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                const eofbit = l.v.members.eofbit;
                const failbit = l.v.members.failbit;
                const buf = l.v.members.buf;
                let char: InitArithmeticVariable;
                while (true) {
                    char = yield* readChar(rt, l);
                    if (eofbit.v.value === 1 || failbit.v.value === 1) {
                        failbit.v.value = 1;
                        return l;
                    }
                    if (!(whitespaceChars.includes(char.v.value))) {
                        break;
                    }
                    variables.indexPointerAssignIndex(buf, buf.v.index + 1, rt.raiseException);
                }

                let i = 0;
                while (!(whitespaceChars.includes(char.v.value))) {
                    variables.arithmeticValueAssign((rt.unbound(variables.arrayMember(r.v.pointee, r.v.index + i)) as ArithmeticVariable).v, char.v.value, rt.raiseException)
                    i++;
                    variables.indexPointerAssignIndex(buf, buf.v.index + 1, rt.raiseException);
                    char = yield* readChar(rt, l);
                    if (eofbit.v.value === 1 || failbit.v.value === 1) {
                        failbit.v.value = 1;
                        return l;
                    }
                }
                variables.arithmeticValueAssign((rt.unbound(variables.arrayMember(r.v.pointee, r.v.index + i)) as ArithmeticVariable).v, 0, rt.raiseException)
                if (i === 0) {
                    failbit.v.value = 1;
                    return l;
                }
                /*const stdio = rt.stdio();
                if (stdio.isMochaTest) {
                    stdio.write(wordString + "\n");
                }*/

                return l;
            }
        },
        {
            op: "o(_>>_)",
            type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > CLREF CLASS string < > )",
            *default(rt: CRuntime, l: IStreamVariable, _r: PointerVariable<ArithmeticVariable>): Gen<IStreamVariable> {
                const r = variables.asInitIndexPointerOfElem(_r, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                const eofbit = l.v.members.eofbit;
                const failbit = l.v.members.failbit;
                const buf = l.v.members.buf;
                let char: InitArithmeticVariable;
                while (true) {
                    char = yield* readChar(rt, l);
                    if (eofbit.v.value === 1 || failbit.v.value === 1) {
                        failbit.v.value = 1;
                        return l;
                    }
                    if (!(whitespaceChars.includes(char.v.value))) {
                        break;
                    }
                    variables.indexPointerAssignIndex(buf, buf.v.index + 1, rt.raiseException);
                }

                let i = 0;
                while (!(whitespaceChars.includes(char.v.value))) {
                    variables.arithmeticValueAssign((rt.unbound(variables.arrayMember(r.v.pointee, r.v.index + i)) as ArithmeticVariable).v, char.v.value, rt.raiseException)
                    i++;
                    variables.indexPointerAssignIndex(buf, buf.v.index + 1, rt.raiseException);
                    char = yield* readChar(rt, l);
                    if (eofbit.v.value === 1 || failbit.v.value === 1) {
                        failbit.v.value = 1;
                        return l;
                    }
                }
                variables.arithmeticValueAssign((rt.unbound(variables.arrayMember(r.v.pointee, r.v.index + i)) as ArithmeticVariable).v, 0, rt.raiseException)
                if (i === 0) {
                    failbit.v.value = 1;
                    return l;
                }
                /*const stdio = rt.stdio();
                if (stdio.isMochaTest) {
                    stdio.write(wordString + "\n");
                }*/

                return l;
            }
        }
        ]);

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
        function _getlineStr(rt: CRuntime, l: IStreamVariable, s: StringVariable, _delim: ArithmeticVariable): IStreamVariable {
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
                const delim = rt.arithmeticValue(_delim);
                const i8type = s.v.members._ptr.t.pointee;
                const oldiptr = variables.clone(b, "SELF", false, rt.raiseException);
                if (b.v.index >= b.v.pointee.values.length) {
                    variables.arithmeticAssign(l.v.members.eofbit, 1, rt.raiseException);
                    variables.arithmeticAssign(l.v.members.failbit, 1, rt.raiseException);
                    return;
                }
                let cnt = 0;
                const memory = variables.arrayMemory<ArithmeticVariable>(i8type, []);
                while (true) {
                    const bi = rt.arithmeticValue(variables.arrayMember(b.v.pointee, b.v.index));
                    if (bi === delim || bi === 0) {
                        // consume the delimiter
                        variables.indexPointerAssignIndex(b, b.v.index + 1, rt.raiseException);
                        break;
                    }
                    memory.values.push(variables.arithmetic(i8type.sig, bi, { array: memory, index: cnt }).v);
                    variables.indexPointerAssignIndex(b, b.v.index + 1, rt.raiseException);
                    cnt++;
                }
                memory.values.push(variables.arithmetic(i8type.sig, 0, { array: memory, index: cnt }).v);
                if (cnt === 0) {
                    variables.arithmeticAssign(l.v.members.failbit, 1, rt.raiseException);
                }
                variables.indexPointerAssign(s.v.members._ptr, memory, 0, rt.raiseException);
                s.v.members._size.v.value = cnt;

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

        common.regMemberFuncs(rt, "istream", [
            {
                op: "get",
                type: "FUNCTION I32 ( LREF CLASS istream < > )",
                *default(rt: CRuntime, l: IStreamVariable): Gen<ArithmeticVariable> {
                    const retv = yield* readChar(rt, l);
                    const buf = l.v.members.buf;
                    variables.indexPointerAssignIndex(buf, buf.v.index + 1, rt.raiseException);
                    return retv;
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
        ]);

        common.regGlobalFuncs(rt, [
            {
                op: "getline",
                type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > CLREF CLASS string < > I8 )",
                default(rt: CRuntime, input: IStreamVariable, str: StringVariable, delim: ArithmeticVariable) {
                    _getlineStr(rt, input, str, delim);
                    return input;
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > CLREF CLASS string < > )",
                default(rt: CRuntime, input: IStreamVariable, str: StringVariable) {
                    _getlineStr(rt, input, str, variables.arithmetic("I8", 10, null));
                    return input;
                }
            },
        ]);

    }
}
