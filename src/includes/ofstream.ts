import { ArrayVariable, CRuntime, ClassType, ObjectValue, ObjectVariable, Variable, VariableType } from "../rt";
import { IomanipConfig } from "./shared/iomanip_types";
import { ios_base_openmode } from "./shared/fstream_modes";

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
            initialize(_rt, _this) {
                return {} as ObjectVariable;
            }
        }]);
        rt.addToNamespace("std", "ofstream", writeStreamType);

        const writeStreamTypeSig = rt.getTypeSignature(writeStreamType);
        rt.types[writeStreamTypeSig].handlers = {
            "o(!)": {
                default(_rt: CRuntime, _this: ofStreamObject) {
                    const fileObject: any = _this.v.members["fileObject"];
                    return _rt.val(_rt.boolTypeLiteral, !fileObject.is_open());
                }
            },
            "o(())": {
                default(_rt: CRuntime, _this: ofStreamObject, filename: Variable, mode: Variable) {
                    _open(_rt, _this, filename, mode);
                }
            },
            "o(<<)": {
                default(_rt: CRuntime, _this: ofStreamObject, t: any) {
                    const fileObject: any = _this.v.members["fileObject"];
                    // if (!fileObject.is_open()) {
                    //     return _rt.raiseException(`<< operator in ofstream could not open - ${fileObject.name}`);
                    // }

                    let result;
                    if (_this.manipulators != null) {
                        t = _this.manipulators.use(t);
                    }

                    if (_rt.isPrimitiveType(t.t)) {
                        if (t.t.name.indexOf("char") >= 0) {
                            result = String.fromCharCode(t.v as number);
                        } else if (t.t.name === "bool") {
                            result = t.v ? "1" : "0";
                        } else {
                            result = t.v.toString();
                        }
                    } else if (_rt.isStringType(t)) {
                        result = _rt.getStringFromCharArray(t);
                    } else {
                        _rt.raiseException("<< operator in ofstream cannot accept " + _rt.makeTypeString(t.t));
                    }

                    fileObject.write(result);

                    return _this;
                },
            }
        };

        const _open = function(_rt: CRuntime, _this: ofStreamObject, right: Variable, mode: Variable) {
            const _mode = mode?.v ?? ios_base_openmode.out;
            const fileName = _rt.getStringFromCharArray(right as ArrayVariable);
            const fileObject: any = fstream.open(_this, fileName);

            if (_mode !== ios_base_openmode.app) {
                fileObject.clear();
            }
            _this.v.members["fileObject"] = fileObject;
        };

        rt.regFunc(_open, writeStreamType, "open", ["?"], rt.intTypeLiteral);

        rt.regFunc(function(_rt: CRuntime, _this: ofStreamObject) {
            const fileObject: any = _this.v.members["fileObject"];
            const is_open = fileObject.is_open() as boolean;

            return _rt.val(_rt.boolTypeLiteral, is_open);
        }, writeStreamType, "is_open", [], rt.boolTypeLiteral);

        rt.regFunc(function(_rt: CRuntime, _this: ofStreamObject) {
            const fileObject: any = _this.v.members["fileObject"];
            fileObject.close();
        }, writeStreamType, "close", [], rt.intTypeLiteral);
    }
};
