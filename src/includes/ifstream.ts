import { ArrayVariable, CRuntime, ClassType, IntVariable, ObjectValue, ObjectVariable, PointerValue, Variable, VariableType } from "../rt";
import { read, skipSpace } from "./shared/string_utils";
import { ios_base, getBit } from "./shared/ios_base";

export = {
    load(rt: CRuntime) {
        const { fstream } = rt.config;

        interface ifStreamObject extends ObjectVariable {
            v: ObjectValue
        };

        const readStreamType: ClassType = rt.newClass("ifstream", [{
            name: "buffer",
            type: rt.arrayPointerType(rt.charTypeLiteral, 0),
            initialize(_rt, _this) {
                return _rt.makeCharArrayFromString("");
            }
        }, {
            name: "state",
            type: rt.intTypeLiteral,
            initialize(_rt, _this) {
                return _rt.val(_rt.intTypeLiteral, ios_base.iostate.goodbit);
            }
        }, {
            name: "fileObject",
            type: {} as VariableType,
            initialize(_rt, _this) {
                return {} as ObjectVariable;
            }
        }]);

        function setBitTrue(_this: ifStreamObject, bit: number) {
            _this.v.members["state"].v = (_this.v.members["state"].v as number) | bit;
        }

        rt.addToNamespace("std", "ifstream", readStreamType);

        const readStreamTypeSig = rt.getTypeSignature(readStreamType);
        rt.types[readStreamTypeSig].handlers = {
            "o(!)": {
                default(_rt: CRuntime, _this: ifStreamObject) {
                    const state: any = _this.v.members["state"].v;

                    return _rt.val(_rt.boolTypeLiteral, getBit(state, ios_base.iostate.failbit) || getBit(state, ios_base.iostate.badbit));
                }
            },
            "o(())": {
                default(_rt: CRuntime, _this: ifStreamObject, ...args: Variable[]) {
                    const [fileName] = args;
                    if (fileName)
                        _open(_rt, _this, fileName);
                }
            },
            "o(bool)": {
                functions: {
                    [''](_rt: CRuntime, _this: ifStreamObject) {
                        const state: any = _this.v.members["state"].v;
                        if (getBit(state, ios_base.iostate.failbit) || getBit(state, ios_base.iostate.badbit)) {
                            return false;
                        }

                        return _this;
                    }
                },
            },
            "o(>>)": {
                default(_rt: CRuntime, _this: ifStreamObject, t: any, ignoreSpaces: any = false) {
                    const state: any = _this.v.members["state"].v as number;
                    if (getBit(state, ios_base.iostate.eofbit)) {
                        setBitTrue(_this, ios_base.iostate.failbit);
                        return _this;
                    }

                    const fileObject: any = _this.v.members["fileObject"];
                    if (!fileObject.is_open()) {
                        return _rt.raiseException(`>> operator in ifstream could not open - ${fileObject.name}`);
                    }

                    const buffer = _rt.getStringFromCharArray(_this.v.members["buffer"] as ArrayVariable);
                    if (_rt.isPointerType(t)) {
                        return _ptrToValue(_rt, _this, t, buffer);
                    }

                    let r;
                    let v;
                    let b = buffer;
                    switch (t.t.name) {
                        case "string":
                            b = skipSpace(b);
                            r = b.length === 0 ? ([""]) : read(_rt, /^[^\s]+/, b, t.t);
                            v = _rt.makeCharArrayFromString(r[0]).v;
                            break;
                        case "char": case "signed char": case "unsigned char":
                            b = !ignoreSpaces ? skipSpace(b) : b;
                            r = b.length === 0 ? ([""]) : read(_rt, /^(?:.|\s)/, b, t.t);
                            v = r[0].charCodeAt(0);
                            break;
                        case "short": case "short int": case "signed short": case "signed short int": case "unsigned short": case "unsigned short int": case "int": case "signed int": case "unsigned": case "unsigned int": case "long": case "long int": case "signed long": case "signed long int": case "unsigned long": case "unsigned long int": case "long long": case "long long int": case "signed long long": case "signed long long int": case "unsigned long long": case "unsigned long long int":
                            b = skipSpace(b);
                            r = read(_rt, /^[-+]?(?:([0-9]*)([eE]\+?[0-9]+)?)|0/, b, t.t);
                            v = parseInt(r[0], 10);
                            if (isNaN(v)) {
                                setBitTrue(_this, ios_base.iostate.failbit);
                            }
                            // TODO: add limit checking
                            break;
                        case "float": case "double":
                            b = skipSpace(b);
                            r = b.length === 0 ? ([""]) : read(_rt, /^[-+]?(?:[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)/, b, t.t);  // fixed to allow floats such as 0
                            v = parseFloat(r[0]);
                            if (isNaN(v) && !r[0].startsWith("NaN")) {
                                setBitTrue(_this, ios_base.iostate.failbit);
                            }
                            break;
                        case "bool":
                            b = skipSpace(b);
                            r = b.length === 0 ? ([""]) : read(_rt, /^(true|false)/, b, t.t);
                            v = r[0] === "true";
                            break;
                        default:
                            _rt.raiseException(">> operator in ifstream cannot accept " + _rt.makeTypeString(t?.t));
                    }

                    const len = r[0].length;
                    if (len === 0) {
                        setBitTrue(_this, ios_base.iostate.failbit);
                    } else {
                        t.v = _rt.val(t.t, v).v;
                        _this.v.members["buffer"].v = _rt.makeCharArrayFromString(b.substring(len)).v;
                    }
                    const buflen = rt.getStringFromCharArray(_this.v.members["buffer"] as ArrayVariable).length;

                    if (buflen === 0) {
                        setBitTrue(_this, ios_base.iostate.eofbit);
                    }


                    return _this;
                },
            }
        };

        // Supposed to work only with 'char' type, not 'string'
        const _ptrToValue = function(_rt: CRuntime, _this: ifStreamObject, right: any, buffer: string, streamSize: number = undefined, delimChar: string | RegExp = undefined, extractDelimiter: boolean = true) {
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
        };

        const _open = function(_rt: CRuntime, _this: ifStreamObject, right: Variable) {
            const fileName = _rt.getStringFromCharArray(right as ArrayVariable);
            const fileObject: any = fstream.open(_this, fileName);
            _this.v.members["fileObject"] = fileObject;

            if (fileObject.is_open()) {
                const buffer = fileObject.read();
                if (buffer.length !== 0) {
                    _this.v.members["buffer"].v = _rt.makeCharArrayFromString(buffer).v;
                }
            } else {
                setBitTrue(_this, ios_base.iostate.failbit);
            }
        };

        rt.regFunc(_open, readStreamType, "open", ["?"], rt.intTypeLiteral);

        rt.regFunc(function(_rt: CRuntime, _this: ifStreamObject) {
            const fileObject: any = _this.v.members["fileObject"];
            const is_open = fileObject.is_open() as boolean;

            return _rt.val(_rt.boolTypeLiteral, is_open);
        }, readStreamType, "is_open", [], rt.boolTypeLiteral);

        rt.regFunc(function(_rt: CRuntime, _this: ifStreamObject) {
            const state = _this.v.members['state'].v as number;
            const result = getBit(state, ios_base.iostate.eofbit);

            return _rt.val(_rt.boolTypeLiteral, result);
        }, readStreamType, "eof", [], rt.boolTypeLiteral);

        rt.regFunc(function(_rt: CRuntime, _this: ifStreamObject) {
            const state = _this.v.members['state'].v as number;
            const result = getBit(state, ios_base.iostate.failbit) || getBit(state, ios_base.iostate.badbit);

            return _rt.val(_rt.boolTypeLiteral, result);
        }, readStreamType, "fail", [], rt.boolTypeLiteral);

        rt.regFunc(function(_rt: CRuntime, _this: ifStreamObject) {
            const state = _this.v.members['state'].v as number;
            const result = getBit(state, ios_base.iostate.badbit);

            return _rt.val(_rt.boolTypeLiteral, result);
        }, readStreamType, "bad", [], rt.boolTypeLiteral);

        rt.regFunc(function(_rt: CRuntime, _this: ifStreamObject) {
            const state = _this.v.members['state'].v;
            const result = state === ios_base.iostate.goodbit;

            return _rt.val(_rt.boolTypeLiteral, result);
        }, readStreamType, "good", [], rt.boolTypeLiteral);

        rt.regFunc(function(_rt: CRuntime, _this: ifStreamObject) {
            const buffer: string = _rt.getStringFromCharArray(_this.v.members["buffer"] as ArrayVariable);

            if (buffer.length === 0) {
                setBitTrue(_this, ios_base.iostate.eofbit);
                return _rt.val(_rt.charTypeLiteral, 0);
            }

            return _rt.val(_rt.charTypeLiteral, buffer.charAt(0).charCodeAt(0));
        }, readStreamType, "peek", [], rt.charTypeLiteral);

        rt.regFunc(function(_rt: CRuntime, _this: ifStreamObject) {
            const fileObject: any = _this.v.members["fileObject"];
            fileObject.close();
        }, readStreamType, "close", [], rt.intTypeLiteral);

        rt.regFunc(function(_rt: CRuntime, _this: ifStreamObject, n: IntVariable, delim: Variable) {
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

        function _panic(_rt: CRuntime, fnname: string, description: string): void {
            _rt.raiseException(fnname + "(): " + description);
        }

        function _memcpy_chr(_rt: CRuntime, dst: ArrayVariable, src: ArrayVariable, cnt: number): void {
            let chrType = _rt.charTypeLiteral;
            if (!(_rt.isTypeEqualTo(src.t.eleType, dst.t.eleType) && _rt.isTypeEqualTo(src.t.eleType, chrType))) {
                _panic(_rt, "<_memcpy_chr (inner)>", "arguments do not have a char[] type");
            }
            for (let i = 0; i < cnt; i++) {
                dst.v.target[dst.v.position + i].v = src.v.target[src.v.position + i].v;
            }
        }

        // 1) int std::ifstream::get();
        //    FUNCTION I32 ( LPTR CLASS std::ifstream < > )
        //
        // 2) std::ifstream& std::ifstream::get(char &ch);
        //    FUNCTION LPTR CLASS std::ifstream < > ( LPTR CLASS std::ifstream < > LPTR I8 )
        //
        // 3) std::ifstream& std::ifstream::get(char *s, int count);
        //    FUNCTION LPTR CLASS std::ifstream < > ( LPTR CLASS std::ifstream < > PTR I8 )
        //
        // 4) std::ifstream& std::ifstream::get(char *s, int count, char delim);
        //    FUNCTION LPTR CLASS std::ifstream < > ( LPTR CLASS std::ifstream < > PTR I8 I8 )
        rt.regFunc(function(_rt: CRuntime, _this: ifStreamObject, _charPtr: Variable, streamSize: IntVariable, delim: IntVariable) {
            if (_this?.t === undefined) {
                _panic(_rt, "get", "parameter 'this' is undefined");
            }
            if (_charPtr?.t === undefined) {
                if (!(streamSize?.t === undefined || delim?.t === undefined)) {
                    _panic(_rt, "get", "internal error: invalid trailing arguments");
                }
                _panic(_rt, "get", "not yet implemented");
            } else if (streamSize?.t === undefined) {
                if (!(delim?.t === undefined)) {
                    _panic(_rt, "get", "internal error: invalid trailing arguments");
                }
                if (!((_charPtr.left ?? false) && _rt.isTypeEqualTo(_charPtr.t, _rt.charTypeLiteral))) {
                    _panic(_rt, "get", "expected argument 1 to be of 'char&' type");
                }
                _panic(_rt, "get", "not yet implemented");
            } else {
                if (!_rt.isTypeEqualTo(_charPtr.t, _rt.normalPointerType(_rt.charTypeLiteral))) {
                    _panic(_rt, "get", "expected argument 1 to be of 'char*' type");
                }
                if (!_rt.isNumericType(streamSize.t)) {
                    _panic(_rt, "get", "expected argument 2 to be of 'int' type");
                }
                if (delim?.t === undefined) {
                    delim = _rt.val(rt.charTypeLiteral, "\n".codePointAt(0));
                } else if (!_rt.isTypeEqualTo(delim.t, _rt.charTypeLiteral)) {
                    _panic(_rt, "get", "expected argument 3 to be of 'char' type");
                }

                if (getBit(_this.v.members['state'].v as number, ios_base.iostate.eofbit)) {
                    setBitTrue(_this, ios_base.iostate.failbit);
                    return _this;
                }
                const buffer = _this.v.members["buffer"] as ArrayVariable;
                const charPtr = _charPtr as ArrayVariable;
                let cnt = 0;
                while (buffer.v.position + cnt < buffer.v.target.length &&
                    cnt < streamSize.v) {
                    if (buffer.v.target[buffer.v.position + cnt].v === delim.v) {
                        break;
                    }
                    cnt++;
                }
                _memcpy_chr(_rt, charPtr, buffer, cnt);
                charPtr.v.target[charPtr.v.position + cnt].v = 0;
                buffer.v.target = buffer.v.target.slice(buffer.v.position + cnt);
                buffer.v.position = 0;
                if (buffer.v.target.length === 0) {
                    setBitTrue(_this, ios_base.iostate.eofbit);
                } 
                if (cnt === 0) {
                    setBitTrue(_this, ios_base.iostate.failbit);
                }
                return _this;
            }
        }, readStreamType, "get", ["?"], "?" as unknown as VariableType);

        rt.regFunc(function(_rt: CRuntime, _this: ifStreamObject, charVar: Variable, streamSize: Variable) {
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
        }]);

    }
};
