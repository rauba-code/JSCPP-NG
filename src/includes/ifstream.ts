import { CRuntime, OpSignature } from "../rt";
import { sizeNonSpace, skipSpace } from "../shared/string_utils";
import * as ios_base from "../shared/ios_base";
import { ArithmeticVariable, ClassType, InitArithmeticVariable, InitIndexPointerVariable, InitPointerVariable, MaybeLeft, PointerVariable, Variable, variables } from "../variables";

type IfStreamVariable = ios_base.IStreamVariable;

export = {
    load(rt: CRuntime) {

        const charType = variables.arithmeticType("I8");
        rt.defineStruct("{global}", "ifstream", [
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

        //rt.addToNamespace("std", "ifstream", readStreamType);

        type OpHandler = {
            type: string,
            op: OpSignature,
            default: ((rt: CRuntime, ...args: Variable[]) => Variable | "VOID")
        };

        const opHandlers: OpHandler[] = [
            {
                op: "o(!_)",
                type: "FUNCTION BOOL ( LREF CLASS ifstream < > )",
                default(_rt: CRuntime, _this: IfStreamVariable) {
                    const failbit = _this.v.members.failbit.v.value;
                    const badbit = _this.v.members.badbit.v.value;
                    return variables.arithmetic("BOOL", failbit | badbit, null);
                }
            },
            {
                op: "o(_bool)",
                type: "FUNCTION BOOL ( LREF CLASS ifstream < > )",
                default(_rt: CRuntime, _this: IfStreamVariable): ArithmeticVariable {
                    const failbit = _this.v.members.failbit.v.value;
                    const badbit = _this.v.members.badbit.v.value;
                    return variables.arithmetic("BOOL", (failbit !== 0 || badbit !== 0) ? 0 : 1, null);
                }
            },
            {
                op: "o(_>>_)",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > LREF Arithmetic )",
                default(_rt: CRuntime, l: IfStreamVariable, r: ArithmeticVariable): IfStreamVariable {
                    // TODO: this and istream functions share equal code. Merge into a single shared function
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
            }
        ];

        opHandlers.forEach((x) => {
            rt.regFunc(x.default, "{global}", x.op, rt.typeSignature(x.type));
        })


        const thisType = (rt.simpleType(["ifstream"]) as MaybeLeft<ClassType>).t;

        const ctorHandler: OpHandler = {
            op: "o(_ctor)",
            type: "FUNCTION CLASS ifstream < > ( PTR I8 )",
            default(_rt: CRuntime, _path: PointerVariable<ArithmeticVariable>): IfStreamVariable {
                const pathPtr = variables.asInitIndexPointerOfElem(_path, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                const result = rt.defaultValue(thisType, "SELF") as IfStreamVariable;

                variables.arithmeticAssign(result.v.members.fd, _open(_rt, result, pathPtr), rt.raiseException);
                return result;
            }
        };

        rt.regFunc(ctorHandler.default, thisType, ctorHandler.op, rt.typeSignature(ctorHandler.type));

        type FunHandler = {
            type: string,
            op: string,
            default: ((rt: CRuntime, ...args: Variable[]) => Variable | "VOID")
        };
        function _getline(rt: CRuntime, l: IfStreamVariable, _s: InitPointerVariable<ArithmeticVariable>, _count: ArithmeticVariable, _delim: ArithmeticVariable): IfStreamVariable {
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
        const memberHandlers: FunHandler[] = [
            {
                op: "get",
                type: "FUNCTION I32 ( LREF CLASS ifstream < > )",
                default(rt: CRuntime, l: IfStreamVariable): InitArithmeticVariable {
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
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > PTR I8 I32 I8 )",
                default(rt: CRuntime, l: IfStreamVariable, _s: InitPointerVariable<ArithmeticVariable>, _count: ArithmeticVariable, _delim: ArithmeticVariable): IfStreamVariable {
                    return _getline(rt, l, _s, _count, _delim);
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS ifstream < > ( LREF CLASS ifstream < > PTR I8 I32 )",
                default(rt: CRuntime, l: IfStreamVariable, _s: InitPointerVariable<ArithmeticVariable>, _count: ArithmeticVariable): IfStreamVariable {
                    return _getline(rt, l, _s, _count, variables.arithmetic("I8", 10, "SELF"));
                }
            },
            {
                op: "close",
                type: "FUNCTION VOID ( LREF CLASS ifstream < > )",
                default(rt: CRuntime, l: IfStreamVariable): "VOID" {
                    rt.fileClose(l.v.members.fd);
                    return "VOID"
                }
            },
        ]

        memberHandlers.forEach((x) => {
            rt.regFunc(x.default, thisType, x.op, rt.typeSignature(x.type));
        })



        // Supposed to work only with 'char' type, not 'string'
        /*const _ptrToValue = function(_rt: CRuntime, _this: IfStreamVariable, right: any, buffer: string, streamSize: number = undefined, delimChar: string | RegExp = undefined, extractDelimiter: boolean = true) {
            if (_rt.isArrayType(right)) {
                if (rt.getStringFromCharArray(_this.v.members["buffer"] as any).length === 0) {
                    setBitTrue(_this, ios_base.iostate.badbit);
                }

                if (_this.v.members["state"].v === ios_base.iostate.goodbit) {
                    const inputHandler = _rt.types[readStreamTypeSig].handlers["o(>>)"].default;

                    if (!streamSize) {
                        delimChar = /\s+/g;
                        streamSize = skipSpace(buffer).split(delimChar)[0].length + 1;
                        extractDelimiter = false;
                    }

                    let requiredInputLength = Math.min(streamSize - 1, buffer.length);
                    let stopExtractingAt = requiredInputLength;

                    if (delimChar) {
                        const delimiterIdx = buffer.search(delimChar);
                        if (delimiterIdx !== -1) {
                            if (!extractDelimiter)
                                stopExtractingAt = delimiterIdx;
                            requiredInputLength = delimiterIdx + 1;
                        }
                    }

                    const varArray = (right as any).v.target;
                    for (let i = 0; i < varArray.length; i++) {
                        if (i >= requiredInputLength) {
                            if (_rt.isStringType(right))
                                varArray[stopExtractingAt].v = 0;
                            break;
                        }

                        inputHandler(_rt, _this, varArray[i], true as any);
                    }
                }
            }

            return _this;
        };*/

        const _open = function(_rt: CRuntime, _this: IfStreamVariable, right: InitIndexPointerVariable<ArithmeticVariable>): number {
            const fd = _rt.openFile(right);

            if (fd !== -1) {
                variables.arithmeticAssign(_this.v.members.fd, fd, rt.raiseException);
                variables.indexPointerAssign(_this.v.members.buf, _rt.fileRead(_this.v.members.fd).v.pointee, 0, rt.raiseException);
            } else {
                _this.v.members.failbit.v.value = 1;
            }
            return fd;
        };

        /*rt.regFunc(_open, readStreamType, "open", ["?"], rt.intTypeLiteral);

        rt.regFunc(function(_rt: CRuntime, _this: IfStreamVariable) {
            const fileObject: any = _this.v.members["fileObject"];
            const is_open = fileObject.is_open() as boolean;

            return _rt.val(_rt.boolTypeLiteral, is_open);
        }, readStreamType, "is_open", [], rt.boolTypeLiteral);

        rt.regFunc(function(_rt: CRuntime, _this: IfStreamVariable) {
            const state = _this.v.members['state'].v as number;
            const result = getBit(state, ios_base.iostate.eofbit);

            return _rt.val(_rt.boolTypeLiteral, result);
        }, readStreamType, "eof", [], rt.boolTypeLiteral);

        rt.regFunc(function(_rt: CRuntime, _this: IfStreamVariable) {
            const state = _this.v.members['state'].v as number;
            const result = getBit(state, ios_base.iostate.failbit) || getBit(state, ios_base.iostate.badbit);

            return _rt.val(_rt.boolTypeLiteral, result);
        }, readStreamType, "fail", [], rt.boolTypeLiteral);

        rt.regFunc(function(_rt: CRuntime, _this: IfStreamVariable) {
            const state = _this.v.members['state'].v as number;
            const result = getBit(state, ios_base.iostate.badbit);

            return _rt.val(_rt.boolTypeLiteral, result);
        }, readStreamType, "bad", [], rt.boolTypeLiteral);

        rt.regFunc(function(_rt: CRuntime, _this: IfStreamVariable) {
            const state = _this.v.members['state'].v;
            const result = state === ios_base.iostate.goodbit;

            return _rt.val(_rt.boolTypeLiteral, result);
        }, readStreamType, "good", [], rt.boolTypeLiteral);

        rt.regFunc(function(_rt: CRuntime, _this: IfStreamVariable) {
            const buffer: string = _rt.getStringFromCharArray(_this.v.members["buffer"] as ArrayVariable);

            if (buffer.length === 0) {
                setBitTrue(_this, ios_base.iostate.eofbit);
                return _rt.val(_rt.charTypeLiteral, 0);
            }

            return _rt.val(_rt.charTypeLiteral, buffer.charAt(0).charCodeAt(0));
        }, readStreamType, "peek", [], rt.charTypeLiteral);

        rt.regFunc(function(_rt: CRuntime, _this: IfStreamVariable) {
            const fileObject: any = _this.v.members["fileObject"];
            fileObject.close();
        }, readStreamType, "close", [], rt.intTypeLiteral);

        rt.regFunc(function(_rt: CRuntime, _this: IfStreamVariable, n: IntVariable, delim: Variable) {
            const buffer = _this.v.members['buffer'] as ArrayVariable;
            const delimiter: number = delim != null ? delim.v as number : ("\n").charCodeAt(0);
            const delimChar: string = String.fromCharCode(delimiter);
            const requiredStreamSize = n?.v || delimChar.length;

            const chars = _rt.getStringFromCharArray(buffer);

            const extracted = chars.substring(0, requiredStreamSize);
            const delimIndex = extracted.indexOf(delimChar);
            const result = chars.substring((requiredStreamSize < chars.length ? requiredStreamSize : (delimIndex !== -1 ? delimIndex + 1 : chars.length)));

            buffer.v = _rt.makeCharArrayFromString(result).v;

            return _this;
        }, readStreamType, "ignore", ["?"], readStreamType, [{
            name: "n",
            type: rt.intTypeLiteral,
            expression: ""
        }, {
            name: "delim",
            type: rt.charTypeLiteral,
            expression: ""
        }]);

        rt.regFunc(function(_rt: CRuntime, _this: IfStreamVariable, charVar: Variable, streamSize: Variable) {
            if (_rt.isStringClass(charVar.t))
                _rt.raiseException(`>> 'get' in ifstream cannot accept type '${_rt.makeTypeString(charVar.t)}'`);

            let buffer = _rt.getStringFromCharArray(_this.v.members["buffer"] as ArrayVariable);

            if (getBit(_this.v.members['state'].v as number, ios_base.iostate.eofbit)) {
                charVar.v = _rt.makeCharArrayFromString("").v;
                return charVar;
            }

            if (!charVar) {
                charVar = _rt.val(_rt.charTypeLiteral, 0);
            } else if (_rt.isPointerType(charVar)) {
                charVar.v = (_rt.cloneDeep(charVar) as any).v;
                return _ptrToValue(_rt, _this, charVar, skipSpace(buffer), streamSize.v as number);
            }

            if (buffer.length === 0) {
                setBitTrue(_this, ios_base.iostate.eofbit);
                charVar.v = _rt.val(_rt.charTypeLiteral, 0).v;
                return _rt.val(_rt.boolTypeLiteral, false);
            }

            const char = buffer.charAt(0);
            buffer = buffer.substring(1);
            if (buffer.length === 0) {
                setBitTrue(_this, ios_base.iostate.eofbit);
            }
            charVar.v = _rt.val(_rt.charTypeLiteral, char.charCodeAt(0)).v;
            _this.v.members["buffer"].v = _rt.makeCharArrayFromString(buffer).v;

            return charVar;
        }, readStreamType, "get", ["?"], rt.boolTypeLiteral, [{
            name: "charVar",
            type: rt.charTypeLiteral,
            expression: ""
        }, {
            name: "streamSize",
            type: rt.intTypeLiteral,
            expression: ""
        }]);

        rt.regFunc(function(_rt: CRuntime, _this: IfStreamVariable, charVar: Variable, streamSize: Variable) {
            if (_rt.isStringClass(charVar.t))
                _rt.raiseException(`>> 'getline' in ifstream cannot accept type '${_rt.makeTypeString(charVar.t)}'`);

            let buffer = _rt.getStringFromCharArray(_this.v.members["buffer"] as ArrayVariable);

            if (getBit(_this.v.members['state'].v as number, ios_base.iostate.eofbit)) {
                charVar.v = _rt.makeCharArrayFromString("").v;
                return charVar;
            }

            if (!charVar) {
                charVar = _rt.val(_rt.charTypeLiteral, 0);
            } else if (_rt.isPointerType(charVar)) {
                charVar.v = (_rt.cloneDeep(charVar) as any).v;
                return _ptrToValue(_rt, _this, charVar, skipSpace(buffer), streamSize.v as number, "\n", false);
            }

            if (buffer.length === 0) {
                setBitTrue(_this, ios_base.iostate.eofbit);
                charVar.v = _rt.val(_rt.charTypeLiteral, 0).v;
                return _rt.val(_rt.boolTypeLiteral, false);
            }

            const char = buffer.charAt(0);
            buffer = buffer.substring(1);
            if (buffer.length === 0) {
                setBitTrue(_this, ios_base.iostate.eofbit);
            }
            charVar.v = _rt.val(_rt.charTypeLiteral, char.charCodeAt(0)).v;
            _this.v.members["buffer"].v = _rt.makeCharArrayFromString(buffer).v;

            return charVar;
        }, readStreamType, "getline", ["?"], rt.boolTypeLiteral, [{
            name: "charVar",
            type: rt.charTypeLiteral,
            expression: ""
        }, {
            name: "streamSize",
            type: rt.intTypeLiteral,
            expression: ""
        }]);*/

    }
};
