import { ArrayVariable, CRuntime, ClassType, ObjectValue, ObjectVariable, Variable, VariableType } from "../rt";
import { IomanipConfig } from "./shared/iomanip_types";

export = {
    load(rt: CRuntime) {
        const { fstream } = rt.config;

        interface ofStreamObject extends ObjectVariable {
            v: ObjectValue,
            manipulators?: {
                config: IomanipConfig;
                active: { [iomanipName: string]: (config: IomanipConfig) => void };
                use(o: Variable): Variable;
            }
        };

        const writeStreamType: ClassType = rt.newClass("ofstream", [{
            name: "fileObject",
            type: {} as VariableType,
            initialize(rt, _this) { 
                return {} as ObjectVariable; 
            }
        }]);
        rt.addToNamespace("std", "ofstream", writeStreamType);

        const writeStreamTypeSig = rt.getTypeSignature(writeStreamType);
        rt.types[writeStreamTypeSig].handlers = {
            "o(!)": {
                default(rt: CRuntime, _this: ofStreamObject) {
                    const fileObject: any = _this.v.members["fileObject"];
                    return rt.val(rt.boolTypeLiteral, !fileObject.is_open());
                }
            },
            "o(())": {
                default(rt: CRuntime, _this: ofStreamObject, ...args: Variable[]) {
                    const [ fileName ] = args;
                    if (fileName)
                        _open(rt, _this, fileName);
                }
            },
            "o(<<)": {
                default(rt: CRuntime, _this: ofStreamObject, t: any) {
                    const fileObject: any = _this.v.members["fileObject"];
                    // if (!fileObject.is_open()) {
                    //     return rt.raiseException(`<< operator in ofstream could not open - ${fileObject.name}`);
                    // }

                    let result;
                    if (_this.manipulators != null) {
                        t = _this.manipulators.use(t);
                    }
                    
                    if (rt.isPrimitiveType(t.t)) {
                        if (t.t.name.indexOf("char") >= 0) {
                            result = String.fromCharCode(t.v as number);
                        } else if (t.t.name === "bool") {
                            result = t.v ? "1" : "0";
                        } else {
                            result = t.v.toString();
                        }
                    } else if (rt.isStringType(t)) {
                        result = rt.getStringFromCharArray(t);
                    } else {
                        rt.raiseException("<< operator in ofstream cannot accept " + rt.makeTypeString(t.t));
                    }

                    fileObject.write(result);
                    
                    return _this;
                },
            }
        };

        const _open = function(rt: CRuntime, _this: ofStreamObject, right: Variable) {
            const fileName = rt.getStringFromCharArray(right as ArrayVariable);
            const fileObject: any = fstream.open(_this, fileName);
            
            fileObject.clear();
            _this.v.members["fileObject"] = fileObject;
        };

        rt.regFunc(_open, writeStreamType, "open", ["?"], rt.intTypeLiteral);

        rt.regFunc(function(rt: CRuntime, _this: ofStreamObject) {
            const fileObject: any = _this.v.members["fileObject"];
            const is_open = fileObject.is_open() as boolean;

            return rt.val(rt.boolTypeLiteral, is_open);
        }, writeStreamType, "is_open", [], rt.boolTypeLiteral);

        rt.regFunc(function(rt: CRuntime, _this: ofStreamObject) {
            const fileObject: any = _this.v.members["fileObject"];
            fileObject.close();
        }, writeStreamType, "close", [], rt.intTypeLiteral);
    }
};