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

                    return _rt.val(_rt.boolTypeLiteral, !getBit(state, ios_base.iostate.failbit) && !getBit(state, ios_base.iostate.badbit));
                }
            },
            "o(())": {
                default(_rt: CRuntime, _this: ifStreamObject, ...args: Variable[]) {
                    const [ fileName ] = args;
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
                            _rt.raiseException(">> operator in ifstream cannot accept " + _rt.makeTypeString(t.t));
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

        rt.regFunc(function(_rt: CRuntime, _this: ifStreamObject, charVar: Variable, streamSize: Variable) {
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
