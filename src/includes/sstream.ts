/* eslint-disable no-shadow */
import { ArrayVariable, CRuntime, ClassType, ObjectValue, ObjectVariable, Variable } from "../rt";
import { read, skipSpace } from "./shared/string_utils";

export = {
    load(rt: CRuntime) {
        interface stringStreamObject extends ObjectVariable {
            v: ObjectValue
        };

        const stringStreamType: ClassType = rt.newClass("stringstream", [{
            name: "buffer",
            type: rt.arrayPointerType(rt.charTypeLiteral, 0),
            initialize(rt, _this) { 
                return rt.makeCharArrayFromString(""); 
            }
        }, {
            name: "extracted_buffer",
            type: rt.arrayPointerType(rt.charTypeLiteral, 0),
            initialize(rt, _this) {
                return null; 
            }
        }, {
            name: "inserted_buffer",
            type: [] as any,
            initialize(rt, _this) { 
                return [] as any; 
            }
        }, {
            name: "eof",
            type: rt.boolTypeLiteral,
            initialize(rt, _this) { 
                return rt.val(rt.boolTypeLiteral, false); 
            }
        }]);

        rt.addToNamespace("std", "stringstream", stringStreamType);

        const stringStreamTypeSig = rt.getTypeSignature(stringStreamType);
        rt.types[stringStreamTypeSig].handlers = {
            "o(())": {
                default(rt: CRuntime, _this: stringStreamObject, ...args: Variable[]) {
                    const [ string ] = args;
                    
                    _this.v.members["buffer"] = rt.clone(string);
                    (_this.v.members["inserted_buffer"] as any) = [];
                }
            },
            "o(bool)": {
                functions: {
                    ['']: function(rt: CRuntime, _this: stringStreamObject) {
                        const endOfString: any = _this.v.members['eof'].v;
                        if (endOfString)
                            return false;

                        return _this;
                    }
                },
            },
            "o(<<)": {
                default(rt: CRuntime, _this: stringStreamObject, t: any) {
                    const inserted_buffer: any = _this.v.members["inserted_buffer"];
                    const inputValue = rt.isArrayType(t) ? rt.getStringFromCharArray(t as any) : t.v;

                    inserted_buffer.push(inputValue);

                    return _this;
                },
            },
            "o(>>)": {
                default(rt: CRuntime, _this: stringStreamObject, t: any) {
                    const endOfString: any = _this.v.members['eof'].v;
                    if (endOfString)
                        return _this;
        
                    const extracted_buffer = (_this.v.members["extracted_buffer"] || (_this.v.members["extracted_buffer"] = getString(rt, _this))) as ArrayVariable;
                    const buffer = rt.getStringFromCharArray(extracted_buffer);

                    let r, v, b = buffer;
                    switch (t.t.name) {
                        case "string": 
                            b = skipSpace(b);
                            r = b.length === 0 ? ([""]) : read(rt, /^[^\s]+/, b, t.t);
                            v = rt.makeCharArrayFromString(r[0]).v;
                            break;
                        case "char": case "signed char": case "unsigned char":
                            b = skipSpace(b);
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
                            rt.raiseException(">> operator in stringstream cannot accept " + rt.makeTypeString(t.t));
                    }

                    const len = r[0].length;
                    _this.v.members['eof'].v = len === 0;
                    
                    if (len !== 0) {
                        t.v = rt.val(t.t, v).v;
                        _this.v.members["extracted_buffer"].v = rt.makeCharArrayFromString(b.substring(len)).v;
                    }
        
                    return _this;
                },
            }
        };

        const getString = function(rt: CRuntime, _this: stringStreamObject) {
            const buffer: string = rt.getStringFromCharArray(_this.v.members["buffer"] as ArrayVariable);
            const inserted_buffer: string = (_this.v.members["inserted_buffer"] as any).join("");

            return rt.makeCharArrayFromString(inserted_buffer + buffer.substring(inserted_buffer.length));
        };

        rt.regFunc(getString, stringStreamType, "str", [], rt.charTypeLiteral);
    }
};
