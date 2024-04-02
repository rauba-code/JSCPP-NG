/* eslint-disable no-shadow */
import { CRuntime, IntVariable, Variable } from "../rt";
import { IomanipOperator, IomanipConfig, Cout } from "./shared/iomanip_types";

export = {
    load(rt: CRuntime) {
        const type = rt.newClass("iomanip", []);
        
        const _setprecision = (rt: CRuntime, _this: Variable, x: IntVariable): IomanipOperator => ({
            t: type,

            v: {
                name: "setprecision",
                f(config: IomanipConfig) {
                    config.setprecision = x.v;
                }
            },

            left: false
        });
        rt.regFunc(_setprecision, "global", "setprecision", [rt.intTypeLiteral], type);
        rt.addToNamespace("std", "setprecision", rt.readVar("setprecision"));
        rt.deleteVar("setprecision");

        const _fixed: IomanipOperator = {
            t: type,
            v: {
                name: "fixed",
                f(config: IomanipConfig) {
                    config.fixed = true;
                }
            }
        };
        rt.addToNamespace("std", "fixed", _fixed);

        const _left: IomanipOperator = {
            t: type,
            v: {
                name: "left",
                f(config: IomanipConfig) {
                    config.left = true;
                    config.right = false;
                }
            }
        };
        rt.addToNamespace("std", "left", _left);

        const _right: IomanipOperator = {
            t: type,
            v: {
                name: "right",
                f(config: IomanipConfig) {
                    config.right = true;
                    config.left = false;
                }
            }
        };
        rt.addToNamespace("std", "right", _right);

        const _hex: IomanipOperator = {
            t: type,
            v: {
                name: "hex",
                f(config: IomanipConfig) {
                    config.hex = true;
                    config.oct = false;
                    config.dec = false;
                }
            }
        };
        rt.addToNamespace("std", "hex", _hex);

        const _oct: IomanipOperator = {
            t: type,
            v: {
                name: "oct",
                f(config: IomanipConfig) {
                    config.oct = true;
                    config.hex = false;
                    config.dec = false;
                }
            }
        };
        rt.addToNamespace("std", "oct", _oct);

        const _dec: IomanipOperator = {
            t: type,
            v: {
                name: "dec",
                f(config: IomanipConfig) {
                    config.dec = true;
                    config.oct = false;
                    config.hex = false;
                }
            }
        };
        rt.addToNamespace("std", "dec", _dec);

        const _boolalpha: IomanipOperator = {
            t: type,
            v: {
                name: "boolalpha",
                f(config: IomanipConfig) {
                    config.boolalpha = true;
                    config.noboolalpha = false;
                }
            }
        };
        rt.addToNamespace("std", "boolalpha", _boolalpha);

        const _noboolalpha: IomanipOperator = {
            t: type,
            v: {
                name: "noboolalpha",
                f(config: IomanipConfig) {
                    config.noboolalpha = true;
                    config.boolalpha = false;
                }
            }
        };
        rt.addToNamespace("std", "noboolalpha", _noboolalpha);

        const endl = rt.val(rt.charTypeLiteral, "\n".charCodeAt(0));
        rt.addToNamespace("std", "endl", endl);

        const _setw = (rt: CRuntime, _this: Variable, x: IntVariable): IomanipOperator => ({
            t: type,

            v: {
                name: "setw",
                f(config: IomanipConfig) {
                    config.setw = x.v;
                }
            }
        });
        rt.regFunc(_setw, "global", "setw", [rt.intTypeLiteral], type);
        rt.addToNamespace("std", "setw", rt.readVar("setw"));
        rt.deleteVar("setw");

        const _setfill = (rt: CRuntime, _this: Variable, x: IntVariable): IomanipOperator => ({
            t: type,

            v: {
                name: "setfill",
                f(config: IomanipConfig) {
                    config.setfill = String.fromCharCode(x.v);
                }
            }
        });
        rt.regFunc(_setfill, "global", "setfill", [rt.charTypeLiteral], type);
        rt.addToNamespace("std", "setfill", rt.readVar("setfill"));
        rt.deleteVar("setfill");

        const _addManipulator = function (rt: CRuntime, _cout: Cout, m: IomanipOperator) {
            if (!_cout.manipulators) {
                _cout.manipulators = {
                    config: {},
                    active: {},
                    use(o: Variable) {
                        let tarStr: any;
                        if (rt.isNumericType(o) && rt.isFloatType(o)) {
                            if (this.active.fixed) {
                                const prec = (this.active.setprecision != null) ?
                                    this.config.setprecision
                                    :
                                    6;
                                tarStr = o.v.toFixed(prec);
                            } else if (this.active.setprecision != null) {
                                tarStr = o.v.toPrecision(this.config.setprecision).replace(/0+$/, "");
                            }
                        }
                        
                        if (rt.isBoolType(o.t)) {
                            if (this.active.boolalpha) {
                                tarStr = o.v ? "true" : "false";
                            }
                        }
                        if (rt.isNumericType(o) && rt.isIntegerType(o) && !((o.v === 10) || (o.v === 13))) {
                            if (this.active.hex) {
                                tarStr = o.v.toString(16);
                            }
                            if (this.active.oct) {
                                tarStr = o.v.toString(8);
                            }                            
                            if (this.active.dec) {
                                tarStr = o.v.toString(10);
                            }                            
                        }
                        if (this.active.setw != null) {
                            let fill;
                            if (this.active.setfill != null) {
                                fill = this.config.setfill;
                            } else {
                                fill = " ";
                            }
                            
                            if (!(rt.isTypeEqualTo(o.t, rt.charTypeLiteral) && ((o.v === 10) || (o.v === 13)))) {
                                if (!tarStr) {
                                    tarStr = rt.isPrimitiveType(o) ?
                                        o.t.name.indexOf("char") >= 0 ?
                                            String.fromCharCode(o.v as number)
                                            : o.t.name === "bool" ?
                                                o.v ? "1" : "0"
                                                :
                                                o.v.toString()
                                        : rt.isStringType(o) ?
                                            rt.getStringFromCharArray(o)
                                            :
                                            rt.raiseException("<< operator in ostream cannot accept " + rt.makeTypeString(o.t));
                                }
                                for (let i = 0, end = this.config.setw - tarStr.length; i < end; i++) {
                                    if (!this.active.left) {
                                        tarStr = fill + tarStr;
                                    } else {
                                        tarStr = tarStr + fill;
                                    }
                                }
                                delete this.active.setw;
                            }
                        }
                        if (tarStr != null) {
                            return rt.makeCharArrayFromString(tarStr);
                        } else {
                            return o;
                        }
                    }
                };
            }
            m.v.f(_cout.manipulators.config);
            if (m.v.name == "hex") {
                delete _cout.manipulators.active["oct"];
                delete _cout.manipulators.active["dec"];
            }
            if (m.v.name == "oct") {
                delete _cout.manipulators.active["hex"];
                delete _cout.manipulators.active["dec"];
            }                            
            if (m.v.name == "dec") {
                delete _cout.manipulators.active["oct"];
                delete _cout.manipulators.active["hex"];
            }             
            if (m.v.name == "boolalpha") {
                delete _cout.manipulators.active["noboolalpha"];
            }             
            if (m.v.name == "noboolalpha") {
                delete _cout.manipulators.active["boolalpha"];
            } 
            _cout.manipulators.active[m.v.name] = m.v.f;
            return _cout;
        };

        const _bindOperatorToType = function(className: string) {
            let type;
            try {
                type = rt.newClass(className, []);
                rt.types[rt.getTypeSignature(type)].father = "iomanip";
            } catch (error) {
                type = rt.simpleType(className); 
            }
            return type;
        };

        const oType = _bindOperatorToType("ostream");
        rt.regOperator(_addManipulator, oType, "<<", [type], oType);

        const ofstreamType = _bindOperatorToType("ofstream");
        rt.regOperator(_addManipulator, ofstreamType, "<<", [type], ofstreamType);
    }
};