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
            type: rt.arrayPointerType(rt.wcharTypeLiteral, 0),
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
                            r = b.length === 0 ? ([""]) : read(rt, /^./, b, t.t);
                            v = r[0].charCodeAt(0);
                            break;
                        case "short": case "short int": case "signed short": case "signed short int": case "unsigned short": case "unsigned short int": case "int": case "signed int": case "unsigned": case "unsigned int": case "long": case "long int": case "signed long": case "signed long int": case "unsigned long": case "unsigned long int": case "long long": case "long long int": case "signed long long": case "signed long long int": case "unsigned long long": case "unsigned long long int":
                            b = skipSpace(b);
                            r = read(rt, /^[-+]?(?:([0-9]*)([eE]\+?[0-9]+)?)|0/, b, t.t);
                            v = parseInt(r[0], 10);
                            break;
                        case "float": case "double":
                            b = skipSpace(b);
                            r = read(rt, /^[-+]?(?:[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)/, b, t.t);  // fixed to allow floats such as 0                                    
                            v = parseFloat(r[0]);
                            break;
                        case "bool":
                            b = skipSpace(b);
                            r = read(rt, /^(true|false)/, b, t.t);
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

        const _ptrToValue = function(rt: CRuntime, _this: ifStreamObject, right: any, buffer: string, streamSize: number = undefined) {
            if (rt.isArrayType(right)) {
                const inputHandler = rt.types[readStreamTypeSig].handlers["o(>>)"].default;
                const maxPossibleInputLength = skipSpace(buffer).split(/\s+/g)[0].length;
                const requiredInputLength = streamSize > 0 ? Math.min(maxPossibleInputLength, streamSize - 1) : maxPossibleInputLength;
                const varArray = (right as any).v.target;
                for(let i=0; i < varArray.length; i++) {
                    if (i >= requiredInputLength) {
                        if (rt.isStringType(right))
                            varArray[i].v = 0;
                        break;
                    }

                    inputHandler(rt, _this, varArray[i]);
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
            const fileObject: any = _this.v.members["fileObject"];
            fileObject.close();
        }, readStreamType, "close", [], rt.intTypeLiteral);

        rt.regFunc(function(rt: CRuntime, _this: ifStreamObject, n: IntVariable, delim: Variable) {
            const buffer = _this.v.members['buffer'] as ArrayVariable;
            const delimiter: number = delim != null ? delim.v as number : ("\n").charCodeAt(0);
            const delimChar: string = String.fromCharCode(delimiter);
            const streamsize = n?.v || delimChar.length;

            const chars = Array.from(skipSpace(rt.getStringFromCharArray(buffer)));
            const index: number = chars.findIndex((char, i) => char === delimChar && i >= streamsize - 1);
            _this.v.members['buffer'].v = rt.makeCharArrayFromString(chars.slice(index).join('')).v;

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

        const _get = function(rt: CRuntime, _this: ifStreamObject, charVar: Variable, streamSize: Variable) {
            let buffer = rt.getStringFromCharArray(_this.v.members["buffer"] as ArrayVariable);

            if (!charVar) {
                charVar = rt.val(rt.charTypeLiteral, 0);
            } else if (rt.isPointerType(charVar)) {
                return _ptrToValue(rt, _this, charVar, buffer, streamSize.v as number);
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
        };

        rt.regFunc(_get, readStreamType, "get", ["?"], rt.boolTypeLiteral, [{ 
            name: "charVar", 
            type: rt.charTypeLiteral, 
            expression: ""
        }, { 
            name: "streamSize", 
            type: rt.intTypeLiteral, 
            expression: ""
        }]);

        rt.regFunc(_get, readStreamType, "getline", ["?"], rt.boolTypeLiteral, [{ 
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