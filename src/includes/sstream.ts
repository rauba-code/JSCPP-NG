import { CRuntime } from "../rt";
import { sizeNonSpace, skipSpace, StringVariable } from "../shared/string_utils";
import * as ios_base from "../shared/ios_base";
import * as common from "../shared/common";
import { AbstractVariable, ArithmeticVariable, ClassType, InitArithmeticVariable, InitIndexPointerVariable, InitPointerVariable, MaybeLeft, PointerVariable, variables } from "../variables";

type IStringStreamValue = ios_base.IStreamValue;
type IStringStreamVariable = AbstractVariable<ios_base.OStreamType, IStringStreamValue>;

export = {
    load(rt: CRuntime) {

        for (const structName of ["istringstream", "stringstream"]) {
            const charType = variables.arithmeticType("I8");
            rt.defineStruct("{global}", structName, [
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

            const whitespaceChars = [0, 9, 10, 32];

            common.regOps(rt, [
                {
                    op: "o(!_)",
                    type: `FUNCTION BOOL ( LREF CLASS ${structName} < > )`,
                    default(_rt: CRuntime, _this: IStringStreamVariable) {
                        const failbit = _this.v.members.failbit.v.value;
                        const badbit = _this.v.members.badbit.v.value;
                        return variables.arithmetic("BOOL", failbit | badbit, null);
                    }
                },
                {
                    op: "o(_bool)",
                    type: `FUNCTION BOOL ( LREF CLASS ${structName} < > )`,
                    default(_rt: CRuntime, _this: IStringStreamVariable): ArithmeticVariable {
                        const failbit = _this.v.members.failbit.v.value;
                        const badbit = _this.v.members.badbit.v.value;
                        return variables.arithmetic("BOOL", (failbit !== 0 || badbit !== 0) ? 0 : 1, null);
                    }
                },
                {
                    op: "o(_>>_)",
                    type: `FUNCTION LREF CLASS ${structName} < > ( LREF CLASS ${structName} < > LREF Arithmetic )`,
                    default(_rt: CRuntime, l: IStringStreamVariable, r: ArithmeticVariable): IStringStreamVariable {
                        // TODO: this and istream functions share equal code. Merge into a single shared function
                        const buf = l.v.members.buf;
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
                            variables.arithmeticAssign(failbit, 1, rt.raiseException);
                            return l;
                        }
                        variables.arithmeticAssign(r, num, rt.raiseException);
                        rt.adjustArithmeticValue((r as InitArithmeticVariable));
                        variables.arithmeticAssign(l.v.members.failbit, (len === 0) ? 1 : 0, rt.raiseException);
                        variables.indexPointerAssignIndex(l.v.members.buf, l.v.members.buf.v.index + len, rt.raiseException);

                        const readlen = buf.v.index - oldptr.v.index;
                        if (readlen === 0) {
                            failbit.v.value = 1;
                        } else {
                            variables.indexPointerAssignIndex(buf, buf.v.index + readlen, rt.raiseException);
                        }
                        const buflen = buf.v.pointee.values.length - buf.v.index;

                        if (buflen === 0) {
                            eofbit.v.value = 1;
                        }

                        return l;
                    },
                },
                {
                    op: "o(_>>_)",
                    type: `FUNCTION LREF CLASS istream < > ( LREF CLASS ${structName} < > LREF CLASS string < > )`,
                    default(rt: CRuntime, l: IStringStreamVariable, r: StringVariable): IStringStreamVariable {
                        const eofbit = l.v.members.eofbit;
                        const failbit = l.v.members.failbit;
                        const buf = l.v.members.buf;
                        let char: InitArithmeticVariable;
                        while (true) {
                            char = rt.expectValue(variables.arrayMember(buf.v.pointee, buf.v.index)) as InitArithmeticVariable;
                            if (char.v.value === 0) {
                                eofbit.v.value = 1;
                                failbit.v.value = 1;
                                return l;
                            }
                            if (!(whitespaceChars.includes(char.v.value))) {
                                break;
                            }
                            variables.indexPointerAssignIndex(buf, buf.v.index + 1, rt.raiseException);
                        }

                        let i = 0;
                        const memory = variables.arrayMemory<ArithmeticVariable>(variables.arithmeticType("I8"), []);
                        while (!(whitespaceChars.includes(char.v.value))) {
                            memory.values.push(variables.arithmetic("I8", char.v.value, { array: memory, index: i }).v);
                            variables.indexPointerAssignIndex(buf, buf.v.index + 1, rt.raiseException);
                            char = rt.expectValue(variables.arrayMember(buf.v.pointee, buf.v.index)) as InitArithmeticVariable;
                            i++;
                            if (char.v.value === 0) {
                                eofbit.v.value = 1;
                                break;
                            }
                        }
                        memory.values.push(variables.arithmetic("I8", 0, { array: memory, index: i }).v);

                        variables.indexPointerAssign(r.v.members._ptr, memory, 0, rt.raiseException);
                        r.v.members._size.v.value = i + 1;

                        if (i === 0) {
                            failbit.v.value = 1;
                            return l;
                        }

                        return l;
                    }
                }
            ]);

            const thisType = (rt.simpleType([`${structName}`]) as MaybeLeft<ClassType>).t;

            const ctorHandler: common.OpHandler = {
                op: "o(_ctor)",
                type: `FUNCTION CLASS ${structName} < > ( LREF CLASS string < > )`,
                default(_rt: CRuntime, s: StringVariable): IStringStreamVariable {
                    const result = rt.defaultValue(thisType, "SELF") as IStringStreamVariable;
                    const sbuf = variables.asInitIndexPointer(s.v.members._ptr) as InitIndexPointerVariable<ArithmeticVariable> | null;
                    if (sbuf !== null) {
                        variables.indexPointerAssign(result.v.members.buf, sbuf.v.pointee, sbuf.v.index, rt.raiseException);
                    }

                    return result;
                }
            };

            rt.regFunc(ctorHandler.default, thisType, ctorHandler.op, rt.typeSignature(ctorHandler.type));

            function _getline(rt: CRuntime, l: IStringStreamVariable, _s: InitPointerVariable<ArithmeticVariable>, _count: ArithmeticVariable, _delim: ArithmeticVariable): IStringStreamVariable {
                let b = l.v.members.buf;
                const count = rt.arithmeticValue(_count);
                const delim = rt.arithmeticValue(_delim);
                const s = variables.asInitIndexPointerOfElem(_s, variables.uninitArithmetic("I8", null));
                if (s === null) {
                    rt.raiseException("Not an index pointer");
                }
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
                return l;
            }
            function _getlineStr(rt: CRuntime, l: IStringStreamVariable, s: StringVariable, _delim: ArithmeticVariable): void {
                let b = l.v.members.buf;
                const delim = rt.arithmeticValue(_delim);
                const i8type = s.v.members._ptr.t.pointee;
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
                        //variables.arithmeticAssign(si, 0, rt.raiseException);
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
            }
            common.regMemberFuncs(rt, `${structName}`, [
                {
                    op: "get",
                    type: `FUNCTION I32 ( LREF CLASS ${structName} < > )`,
                    default(rt: CRuntime, l: IStringStreamVariable): InitArithmeticVariable {
                        let b = l.v.members.buf;
                        if (b.v.pointee.values.length <= b.v.index) {
                            variables.arithmeticAssign(l.v.members.eofbit, 1, rt.raiseException);
                            variables.arithmeticAssign(l.v.members.failbit, 1, rt.raiseException);
                            return variables.arithmetic("I32", -1, null);
                        }
                        const top = variables.arrayMember(b.v.pointee, b.v.index);
                        variables.indexPointerAssignIndex(l.v.members.buf, l.v.members.buf.v.index + 1, rt.raiseException);
                        const retv = variables.arithmetic("I32", rt.arithmeticValue(top), null, false);
                        rt.adjustArithmeticValue(retv);
                        return retv;
                    }
                },
                {
                    op: "getline",
                    type: `FUNCTION LREF CLASS ${structName} < > ( LREF CLASS ${structName} < > PTR I8 I32 I8 )`,
                    default(rt: CRuntime, l: IStringStreamVariable, _s: InitPointerVariable<ArithmeticVariable>, _count: ArithmeticVariable, _delim: ArithmeticVariable): IStringStreamVariable {
                        return _getline(rt, l, _s, _count, _delim);
                    }
                },
                {
                    op: "getline",
                    type: `FUNCTION LREF CLASS ${structName} < > ( LREF CLASS ${structName} < > PTR I8 I32 )`,
                    default(rt: CRuntime, l: IStringStreamVariable, _s: InitPointerVariable<ArithmeticVariable>, _count: ArithmeticVariable): IStringStreamVariable {
                        return _getline(rt, l, _s, _count, variables.arithmetic("I8", 10, "SELF"));
                    }
                },
            ]);

            common.regGlobalFuncs(rt, [
                {
                    op: "getline",
                    type: `FUNCTION LREF CLASS sstream < > ( LREF CLASS ${structName} < > LREF CLASS string < > I8 )`,
                    default(rt: CRuntime, input: IStringStreamVariable, str: StringVariable, delim: ArithmeticVariable) {
                        _getlineStr(rt, input, str, delim);
                        return input;
                    }
                },
                {
                    op: "getline",
                    type: `FUNCTION LREF CLASS sstream < > ( LREF CLASS ${structName} < > LREF CLASS string < > )`,
                    default(rt: CRuntime, input: IStringStreamVariable, str: StringVariable) {
                        _getlineStr(rt, input, str, variables.arithmetic("I8", 10, null));
                        return input;
                    }
                },
            ]);
        }
    }
};

