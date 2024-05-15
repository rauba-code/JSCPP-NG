import { ArrayVariable, CRuntime, ClassType, IntVariable, ObjectValue, ObjectVariable, PointerValue, Variable, VariableType } from "../rt";
import { read, skipSpace } from "./shared/string_utils";

export = {
    load(rt: CRuntime) {
        const { fstream } = rt.config;

        interface ifStreamObject extends ObjectVariable {
            v: ObjectValue
        };

        const readStreamType: ClassType = rt.newClass("ifstream", [{
            name: "buffer",
            type: rt.arrayPointerType(rt.charTypeLiteral, 0),
            initialize(rt, _this) { 
                return rt.makeCharArrayFromString(""); 
            }
        }, {
            name: "eof",
            type: rt.boolTypeLiteral,
            initialize(rt, _this) { 
                return rt.val(rt.boolTypeLiteral, false); 
            }
        }, {
            name: "fileObject",
            type: {} as VariableType,
            initialize(rt, _this) { 
                return {} as ObjectVariable; 
            }
        }]);

        rt.addToNamespace("std", "ifstream", readStreamType);
        
        const readStreamTypeSig = rt.getTypeSignature(readStreamType);
        rt.types[readStreamTypeSig].handlers = {
            "o(!)": {
                default(rt: CRuntime, _this: ifStreamObject) {
                    const fileObject: any = _this.v.members["fileObject"];
                    return rt.val(rt.boolTypeLiteral, !fileObject.is_open());
                }
            },
            "o(())": {
                default(rt: CRuntime, _this: ifStreamObject, ...args: Variable[]) {
                    const [ fileName ] = args;
                    if (fileName)
                        _open(rt, _this, fileName);
                }
            },
            "o(bool)": {
                functions: {
                    ['']: function(rt: CRuntime, _this: ifStreamObject) {
                        const endOfFile: any = _this.v.members['eof'].v;
                        if (endOfFile)
                            return false;

                        return _this;
                    }
                },
            },
            "o(>>)": {
                default(rt: CRuntime, _this: ifStreamObject, t: any, ignoreSpaces: any = false) {
                    const endOfFile: any = _this.v.members['eof'].v;
                    if (endOfFile)
                        return _this;

                    const fileObject: any = _this.v.members["fileObject"];
                    if (!fileObject.is_open()) {
                        return rt.raiseException(`>> operator in ifstream could not open - ${fileObject.name}`);
                    }
        
                    const buffer = rt.getStringFromCharArray(_this.v.members["buffer"] as ArrayVariable);
                    if (rt.isPointerType(t)) {
                        return _ptrToValue(rt, _this, t, buffer);
                    }

                    let r, v, b = buffer;
                    switch (t.t.name) {
                        case "string": 
                            b = skipSpace(b);
                            r = b.length === 0 ? ([""]) : read(rt, /^[^\s]+/, b, t.t);
                            v = rt.makeCharArrayFromString(r[0]).v;
                            break;
                        case "char": case "signed char": case "unsigned char":
                            b = !ignoreSpaces ? skipSpace(b) : b;
                            r = b.length === 0 ? ([""]) : read(rt, /^(?:.|\s)/, b, t.t);
                            v = r[0].charCodeAt(0);
                            break;
                        case "short": case "short int": case "signed short": case "signed short int": case "unsigned short": case "unsigned short int": case "int": case "signed int": case "unsigned": case "unsigned int": case "long": case "long int": case "signed long": case "signed long int": case "unsigned long": case "unsigned long int": case "long long": case "long long int": case "signed long long": case "signed long long int": case "unsigned long long": case "unsigned long long int":
                            b = skipSpace(b);
                            r = read(rt, /^[-+]?(?:([0-9]*)([eE]\+?[0-9]+)?)|0/, b, t.t);
                            v = parseInt(r[0], 10);
                            break;
                        case "float": case "double":
                            b = skipSpace(b);
                            r = b.length === 0 ? ([""]) : read(rt, /^[-+]?(?:[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)/, b, t.t);  // fixed to allow floats such as 0                                    
                            v = parseFloat(r[0]);
                            break;
                        case "bool":
                            b = skipSpace(b);
                            r = b.length === 0 ? ([""]) : read(rt, /^(true|false)/, b, t.t);
                            v = r[0] === "true";
                            break;
                        default:
                            rt.raiseException(">> operator in ifstream cannot accept " + rt.makeTypeString(t.t));
                    }
        
                    const len = r[0].length;
                    _this.v.members['eof'].v = len === 0;
                    
                    if (len !== 0) {
                        t.v = rt.val(t.t, v).v;
                        _this.v.members["buffer"].v = rt.makeCharArrayFromString(b.substring(len)).v;
                    }
        
                    return _this;
                },
            }
        };

        // Supposed to work only with 'char' type, not 'string'
        const _ptrToValue = function(rt: CRuntime, _this: ifStreamObject, right: any, buffer: string, streamSize: number = undefined, delimChar: string | RegExp = undefined, extractDelimiter: boolean = true) {
            if (rt.isArrayType(right)) {
                _this.v.members["eof"].v = rt.getStringFromCharArray(_this.v.members["buffer"] as any).length === 0;

                if (!_this.v.members["eof"].v) {
                    const inputHandler = rt.types[readStreamTypeSig].handlers["o(>>)"].default;

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
                    for(let i=0; i < varArray.length; i++) {
                        if (i >= requiredInputLength) {
                            if (rt.isStringType(right))
                                varArray[stopExtractingAt].v = 0;
                            break;
                        }
    
                        inputHandler(rt, _this, varArray[i], true as any);                            
                    }
                }                
            }            

            return _this;                
        };

        const _open = function(rt: CRuntime, _this: ifStreamObject, right: Variable) {
            const fileName = rt.getStringFromCharArray(right as ArrayVariable);
            const fileObject: any = fstream.open(_this, fileName);
            _this.v.members["fileObject"] = fileObject;

            if (fileObject.is_open()) {
                const buffer = fileObject.read();
                if (buffer.length !== 0) {
                    _this.v.members["buffer"].v = rt.makeCharArrayFromString(buffer).v;
                }
            }            
        };

        rt.regFunc(_open, readStreamType, "open", ["?"], rt.intTypeLiteral);

        rt.regFunc(function(rt: CRuntime, _this: ifStreamObject) {
            const fileObject: any = _this.v.members["fileObject"];
            const is_open = fileObject.is_open() as boolean;

            return rt.val(rt.boolTypeLiteral, is_open);
        }, readStreamType, "is_open", [], rt.boolTypeLiteral);
        
        rt.regFunc(function(rt: CRuntime, _this: ifStreamObject) {
            const is_end_of_file: any = _this.v.members['eof'].v;

            return rt.val(rt.boolTypeLiteral, is_end_of_file);
        }, readStreamType, "eof", [], rt.boolTypeLiteral);

        rt.regFunc(function(rt: CRuntime, _this: ifStreamObject) {
            const buffer: string = rt.getStringFromCharArray(_this.v.members["buffer"] as ArrayVariable);

            if (buffer.length === 0) {
                _this.v.members['eof'].v = true;
                return rt.val(rt.charTypeLiteral, 0);
            }

            return rt.val(rt.charTypeLiteral, buffer.charAt(0).charCodeAt(0));
        }, readStreamType, "peek", [], rt.charTypeLiteral);

        rt.regFunc(function(rt: CRuntime, _this: ifStreamObject) {
            const fileObject: any = _this.v.members["fileObject"];
            fileObject.close();
        }, readStreamType, "close", [], rt.intTypeLiteral);

        rt.regFunc(function(rt: CRuntime, _this: ifStreamObject, n: IntVariable, delim: Variable) {
            const buffer = _this.v.members['buffer'] as ArrayVariable;
            const delimiter: number = delim != null ? delim.v as number : ("\n").charCodeAt(0);
            const delimChar: string = String.fromCharCode(delimiter);
            const requiredStreamSize = n?.v || delimChar.length;

            const chars = rt.getStringFromCharArray(buffer);

            const extracted = chars.substring(0, requiredStreamSize);
            const delimIndex = extracted.indexOf(delimChar);
            const result = chars.substring((requiredStreamSize < chars.length ? requiredStreamSize : (delimIndex !== -1 ? delimIndex + 1 : chars.length)));

            buffer.v = rt.makeCharArrayFromString(result).v;
                
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

        rt.regFunc(function(rt: CRuntime, _this: ifStreamObject, charVar: Variable, streamSize: Variable) {
            if (rt.isStringClass(charVar.t))
                rt.raiseException(`>> 'get' in ifstream cannot accept type '${rt.makeTypeString(charVar.t)}'`);

            let buffer = rt.getStringFromCharArray(_this.v.members["buffer"] as ArrayVariable);

            if (_this.v.members['eof'].v) {
                charVar.v = rt.makeCharArrayFromString("").v;
                return charVar;
            }

            if (!charVar) {
                charVar = rt.val(rt.charTypeLiteral, 0);
            } else if (rt.isPointerType(charVar)) {
                charVar.v = (rt.cloneDeep(charVar) as any).v;             
                return _ptrToValue(rt, _this, charVar, skipSpace(buffer), streamSize.v as number);
            }

            if (buffer.length === 0) {
                _this.v.members['eof'].v = true;
                charVar.v = rt.val(rt.charTypeLiteral, 0).v;
                return rt.val(rt.boolTypeLiteral, false);
            }

            const char = buffer.charAt(0);
            buffer = buffer.substring(1);
            charVar.v = rt.val(rt.charTypeLiteral, char.charCodeAt(0)).v;
            _this.v.members["buffer"].v = rt.makeCharArrayFromString(buffer).v;

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

        rt.regFunc(function(rt: CRuntime, _this: ifStreamObject, charVar: Variable, streamSize: Variable) {
            if (rt.isStringClass(charVar.t))
                rt.raiseException(`>> 'getline' in ifstream cannot accept type '${rt.makeTypeString(charVar.t)}'`);

            let buffer = rt.getStringFromCharArray(_this.v.members["buffer"] as ArrayVariable);

            if (_this.v.members['eof'].v) {
                charVar.v = rt.makeCharArrayFromString("").v;
                return charVar;
            }

            if (!charVar) {
                charVar = rt.val(rt.charTypeLiteral, 0);
            } else if (rt.isPointerType(charVar)) {  
                charVar.v = (rt.cloneDeep(charVar) as any).v;             
                return _ptrToValue(rt, _this, charVar, skipSpace(buffer), streamSize.v as number, "\n", false);
            }

            if (buffer.length === 0) {
                _this.v.members['eof'].v = true;
                charVar.v = rt.val(rt.charTypeLiteral, 0).v;
                return rt.val(rt.boolTypeLiteral, false);
            }

            const char = buffer.charAt(0);
            buffer = buffer.substring(1);
            charVar.v = rt.val(rt.charTypeLiteral, char.charCodeAt(0)).v;
            _this.v.members["buffer"].v = rt.makeCharArrayFromString(buffer).v;

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