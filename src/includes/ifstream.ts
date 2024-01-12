import { ArrayVariable, CRuntime, ClassType, Member, ObjectValue, ObjectVariable, Variable, VariableType } from "../rt";
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
            name: "fileObject",
            type: {} as VariableType,
            initialize(rt, _this) { 
                return {} as ObjectVariable; 
            }
        }]);
        
        const readStreamTypeSig = rt.getTypeSignature(readStreamType);
        rt.types[readStreamTypeSig].handlers = {
            "o(>>)": {
                default(rt: CRuntime, _this: ifStreamObject, t: any) {
                    const fileObject: any = _this.v.members["fileObject"];
                    if (!fileObject.is_open()) {
                        return rt.raiseException(`>> operator in ifstream could not open - ${fileObject.name}`);
                    }
        
                    const buffer = rt.getStringFromCharArray(_this.v.members["buffer"] as ArrayVariable);
        
                    let r, v, b = buffer;
        
                    switch (t.t.name) {
                        case "string": 
                            b = skipSpace(b);
                            r = read(rt, /^[^\s]+/, b, t.t);
                            v = rt.makeCharArrayFromString(r[0]).v;
                            break;
                        case "char": case "signed char": case "unsigned char":
                            b = skipSpace(b);
                            r = read(rt, /^./, b, t.t);
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
                    if (len !== 0) {
                        t.v = rt.val(t.t, v).v;
                        _this.v.members["buffer"].v = rt.makeCharArrayFromString(b.substring(len)).v;
                    }
        
                    return _this;
                },
            }
        };
        
        rt.regFunc(function(rt: CRuntime, _this: ifStreamObject, right: Variable) {
            const fileName = rt.getStringFromCharArray(right as ArrayVariable);
            const fileObject: any = fstream.open(fileName);
            _this.v.members["fileObject"] = fileObject;

            if (fileObject.is_open()) {
                const buffer = fileObject.read();
                if (buffer.length !== 0) {
                    _this.v.members["buffer"].v = rt.makeCharArrayFromString(buffer).v;
                }
            }            
        }, readStreamType, "open", ["?"], rt.intTypeLiteral);
        
        rt.regFunc(function(rt: CRuntime, _this: ifStreamObject) {
            const fileObject: any = _this.v.members["fileObject"];
            const is_open = fileObject.is_open() as boolean;

            return rt.val(rt.boolTypeLiteral, is_open);
        }, readStreamType, "is_open", [], rt.boolTypeLiteral);
        
        rt.regFunc(function(rt: CRuntime, _this: ifStreamObject) {
            const fileObject: any = _this.v.members["fileObject"];
            fileObject.close();
        }, readStreamType, "close", [], rt.intTypeLiteral);
    }
};