import { CRuntime, OpSignature } from "../rt";
import * as ios_base from "../shared/ios_base";
import * as unixapi from "../shared/unixapi";
import { ArithmeticProperties, ArithmeticVariable, ClassType, InitIndexPointerVariable, MaybeLeft, PointerVariable, Variable, variables } from "../variables";

type OfStreamVariable = ios_base.OStreamVariable;

export = {
    load(rt: CRuntime) {
        rt.defineStruct("{global}", "ofstream", [
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
            {
                name: "base",
                variable: variables.arithmetic("I8", 10, "SELF"),
            },
            {
                name: "fill",
                variable: variables.arithmetic("I8", 32, "SELF"),
            },
            {
                name: "precision",
                variable: variables.arithmetic("I8", -1, "SELF"),
            },
            {
                name: "width",
                variable: variables.arithmetic("I8", -1, "SELF"),
            },
            {
                name: "float_display_mode",
                variable: variables.arithmetic("I8", ios_base.iomanip_token_mode.defaultfloat, "SELF"),
            },
            {
                name: "position_mode",
                variable: variables.arithmetic("I8", ios_base.iomanip_token_mode.right, "SELF"),
            },
        ]);

        type OpHandler = {
            type: string,
            op: OpSignature,
            default: ((rt: CRuntime, ...args: Variable[]) => Variable)
        };

        function pad(rt: CRuntime, s: string, pmode: number, width: number, chr: number): string {
            if (width < 0) {
                return s;
            }
            switch (pmode) {
                case ios_base.iomanip_token_mode.left:
                    return s.padEnd(width, String.fromCharCode(chr));
                case ios_base.iomanip_token_mode.right:
                    return s.padStart(width, String.fromCharCode(chr));
                case ios_base.iomanip_token_mode.internal:
                    rt.raiseException("Not yet implemented: internal");
                default:
                    rt.raiseException("Invalid position_mode value");
            }
        }

        const opHandlers: OpHandler[] = [{
            op: "o(_<<_)",
            type: "FUNCTION LREF CLASS ofstream < > ( LREF CLASS ofstream < > PTR I8 )",
            default(rt: CRuntime, l: OfStreamVariable, r: PointerVariable<ArithmeticVariable>): OfStreamVariable {
                const iptr = variables.asInitIndexPointerOfElem(r, variables.uninitArithmetic("I8", null));
                if (iptr === null) {
                    rt.raiseException("Variable is not an initialised index pointer");
                }
                if (l.v.members.width.v.value >= 0) {
                    const padded = pad(rt, rt.getStringFromCharArray(iptr), l.v.members.position_mode.v.value, l.v.members.width.v.value, l.v.members.fill.v.value);
                    unixapi.write(rt, l.v.members.fd, rt.getCharArrayFromString(padded));
                    variables.arithmeticAssign(l.v.members.width, -1, rt.raiseException);
                } else {
                    unixapi.write(rt, l.v.members.fd, iptr);
                }
                return l;
            }
        },
        {
            op: "o(_<<_)",
            type: "FUNCTION LREF CLASS ofstream < > ( LREF CLASS ofstream < > Arithmetic )",
            default(rt: CRuntime, l: OfStreamVariable, r: ArithmeticVariable): OfStreamVariable {
                const num = rt.arithmeticValue(r);
                const numProperties = variables.arithmeticProperties[r.t.sig];
                function numstr(rt: CRuntime, l: OfStreamVariable, num: number, numProperties: ArithmeticProperties): string {
                    if (numProperties.isFloat) {
                        const prec = l.v.members.precision.v.value;
                        switch (l.v.members.float_display_mode.v.value) {
                            case ios_base.iomanip_token_mode.fixed:
                                return prec >= 0 ? num.toFixed(prec) : num.toFixed();
                            case ios_base.iomanip_token_mode.scientific:
                                return prec >= 0 ? num.toExponential(prec) : num.toExponential();
                            case ios_base.iomanip_token_mode.hexfloat:
                                rt.raiseException("Not yet implemented: hexfloat")
                            case ios_base.iomanip_token_mode.defaultfloat:
                                return num.toString();
                            default:
                                rt.raiseException("Invalid float_display_mode value")
                        }
                    } else {
                        const base = l.v.members.base.v.value;
                        if (base !== 8 && base !== 10 && base !== 16) {
                            rt.raiseException("Invalid base value")
                        }
                        if (base === 10 || num >= 0) {
                            return num.toString(base);
                        } else {
                            return ((numProperties.maxv + 1 - numProperties.minv) + num).toString(base);
                        }
                    }
                }

                const ns = numstr(rt, l, num, numProperties);
                const padded = pad(rt, ns, l.v.members.position_mode.v.value, l.v.members.width.v.value, l.v.members.fill.v.value);
                const str = rt.getCharArrayFromString(padded);
                variables.arithmeticAssign(l.v.members.width, -1, rt.raiseException);
                unixapi.write(rt, l.v.members.fd, str);
                return l;
            }
        },
        {
            op: "o(!_)",
            type: "FUNCTION BOOL ( LREF CLASS ofstream < > )",
            default(_rt: CRuntime, _this: OfStreamVariable) {
                const failbit = _this.v.members.failbit.v.value;
                const badbit = _this.v.members.badbit.v.value;
                return variables.arithmetic("BOOL", failbit | badbit, null);
            }
        },
        {
            op: "o(_bool)",
            type: "FUNCTION BOOL ( LREF CLASS ofstream < > )",
            default(_rt: CRuntime, _this: OfStreamVariable): ArithmeticVariable {
                const failbit = _this.v.members.failbit.v.value;
                const badbit = _this.v.members.badbit.v.value;
                return variables.arithmetic("BOOL", (failbit !== 0 || badbit !== 0) ? 0 : 1, null);
            }
        },
        ];

        opHandlers.forEach((x) => {
            rt.regFunc(x.default, "{global}", x.op, rt.typeSignature(x.type));
        })

        const thisType = (rt.simpleType(["ofstream"]) as MaybeLeft<ClassType>).t;

        const ctorHandler: OpHandler = {
            op: "o(_ctor)",
            type: "FUNCTION CLASS ofstream < > ( PTR I8 )",
            default(_rt: CRuntime, _path: PointerVariable<ArithmeticVariable>): OfStreamVariable {
                const pathPtr = variables.asInitIndexPointerOfElem(_path, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                const result = rt.defaultValue(thisType, "SELF") as OfStreamVariable;

                variables.arithmeticAssign(result.v.members.fd, _open(_rt, result, pathPtr), rt.raiseException);
                return result;
            }
        };

        rt.regFunc(ctorHandler.default, thisType, ctorHandler.op, rt.typeSignature(ctorHandler.type));

        const _open = function(_rt: CRuntime, _this: OfStreamVariable, right: InitIndexPointerVariable<ArithmeticVariable>): number {
            const fd = _rt.openFile(right);

            if (fd !== -1) {
                variables.arithmeticAssign(_this.v.members.fd, fd, rt.raiseException);
                //variables.indexPointerAssign(_this.v.members.buf, _rt.fileRead(_this.v.members.fd).v.pointee, 0, rt.raiseException);
            } else {
                _this.v.members.failbit.v.value = 1;
            }
            return fd;
        };
        type FunHandler = {
            type: string,
            op: string,
            default: ((rt: CRuntime, ...args: Variable[]) => Variable | "VOID")
        };
        const memberHandlers: FunHandler[] = [
            {
                op: "close",
                type: "FUNCTION VOID ( LREF CLASS ofstream < > )",
                default(rt: CRuntime, l: OfStreamVariable): "VOID" {
                    rt.fileClose(l.v.members.fd);
                    return "VOID"
                }
            },
        ];
        memberHandlers.forEach((x) => {
            rt.regFunc(x.default, thisType, x.op, rt.typeSignature(x.type));
        })
        /*
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
                        _rt.raiseException("<< operator in ofstream cannot accept " + _rt.makeTypeString(t?.t));
                    }

                    fileObject.write(result);

                    return _this;
                },
            }
        };

        const _open = function(_rt: CRuntime, _this: ofStreamObject, right: Variable, mode: Variable) {
            const _mode = mode?.v ?? ios_base.openmode.out;
            const fileName = _rt.getStringFromCharArray(right as ArrayVariable);
            const fileObject: any = fstream.open(_this, fileName);

            if (_mode !== ios_base.openmode.app) {
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
        }, writeStreamType, "close", [], rt.intTypeLiteral);*/
    }
};
