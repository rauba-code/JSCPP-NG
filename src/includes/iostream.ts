import { CRuntime } from "../rt";
import { sizeNonSpace, skipSpace } from "../shared/string_utils";
import * as common from "../shared/common";
import * as ios_base_impl from "../shared/ios_base_impl";
import { ArithmeticVariable, Gen, InitArithmeticVariable, InitPointerVariable, MaybeLeft, ResultOrGen, variables } from "../variables";
import * as unixapi from "../shared/unixapi";
import { IStreamType, IStreamVariable, OStreamType, OStreamVariable } from "../shared/ios_base";

/*function *read(rt: CRuntime, fd: InitArithmeticVariable, buf: PointerVariable<PointerVariable<ArithmeticVariable>>): ResultOrGen<ArithmeticVariable> {
    if (fd.v.value === unixapi.FD_STDIN) {


    } else {
        rt.raiseException("Not yet implemented");
    }
}*/

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

        const endl = rt.getCharArrayFromString("\n");
        rt.addToNamespace("std", "endl", endl);

        common.regOps(rt, [{
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
                    stdio.promiseError(err.message);
                })
                return l;
            }
        }]);

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

        common.regMemberFuncs(rt, "istream", [
            {
                op: "get",
                type: "FUNCTION I32 ( LREF CLASS istream < > )",
                default(rt: CRuntime, l: IStreamVariable): Gen<ArithmeticVariable> {
                    const stdio = rt.stdio();
                    stdio.cinStop();

                    const retv = variables.arithmetic("I32", -2, null);
                    const inputPromise: Promise<[boolean, IStreamVariable, ArithmeticVariable]> = new Promise((resolve) => {
                        debugger;
                        let result = l.v.members.buf;
                        // + 1 because of trailing '\0'
                        if (result.v.index + 1 >= result.v.pointee.values.length) {
                            stdio.getInput().then((result) => {
                                variables.indexPointerAssign(l.v.members.buf, rt.getCharArrayFromString(result.concat("\n")).v.pointee, 0, rt.raiseException);
                                resolve([false, l, retv]);
                            });
                        } else {
                            resolve([true, l, retv]);
                        }
                    });
                    inputPromise.then(([_is_raw, l, retv]) => {
                        let b = l.v.members.buf;
                        if (b.v.pointee.values.length <= b.v.index) {
                            variables.arithmeticAssign(l.v.members.eofbit, 1, rt.raiseException);
                            variables.arithmeticAssign(l.v.members.failbit, 1, rt.raiseException);
                            return variables.arithmetic("I32", -1, null);
                        }
                        const top = rt.unbound(variables.arrayMember(b.v.pointee, b.v.index));
                        variables.indexPointerAssignIndex(l.v.members.buf, l.v.members.buf.v.index + 1, rt.raiseException);

                        retv.v = variables.clone((rt.expectValue(top) as InitArithmeticVariable), null, false, rt.raiseException).v;
                        stdio.cinProceed();
                    }).catch((err) => {
                        //console.log(err);
                        stdio.promiseError(err.message);
                    })
                    debugger;
                    function *stubGenerator() {
                        yield retv;
                        return retv;
                    }
                    return stubGenerator();
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
    }
}
