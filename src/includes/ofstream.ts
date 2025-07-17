import { CRuntime } from "../rt";
import { FunHandler, OpHandler } from "../shared/common";
import * as ios_base from "../shared/ios_base";
import * as ios_base_impl from "../shared/ios_base_impl"
import { StringVariable } from "../shared/string_utils";
import { AbstractVariable, ArithmeticVariable, ClassType, InitArithmeticVariable, InitIndexPointerVariable, MaybeLeft, PointerVariable, variables } from "../variables";

type OfstreamValue = ios_base.OStreamValue & {
    members: {
        _is_open: InitArithmeticVariable
    }
};
type OfStreamVariable = AbstractVariable<ios_base.OStreamType, OfstreamValue>;

export = {
    load(rt: CRuntime) {
        if (!rt.varAlreadyDefined("endl")) {
            const endl = rt.getCharArrayFromString("\n");
            rt.addToNamespace("std", "endl", endl);
        }

        ios_base_impl.defineOstream(rt, "ofstream", [
            {
                name: "_is_open",
                variable: variables.arithmetic("BOOL", 0, "SELF"),
            }
        ]);

        const thisType = (rt.simpleType(["ofstream"]) as MaybeLeft<ClassType>).t;

        const ctorHandlers: OpHandler[] = [{
            op: "o(_ctor)",
            type: "FUNCTION CLASS ofstream < > ( PTR I8 )",
            default(_rt: CRuntime, _templateTypes: [], _path: PointerVariable<ArithmeticVariable>): OfStreamVariable {
                const pathPtr = variables.asInitIndexPointerOfElem(_path, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                const result = rt.defaultValue(thisType, "SELF") as OfStreamVariable;

                _open(_rt, result, pathPtr);
                return result;
            }
        },
        {
            op: "o(_ctor)",
            type: "FUNCTION CLASS ofstream < > ( CLREF CLASS string < > )",
            default(_rt: CRuntime, _templateTypes: [], _path: StringVariable): OfStreamVariable {
                const pathPtr = variables.asInitIndexPointerOfElem(_path.v.members._ptr, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                const result = rt.defaultValue(thisType, "SELF") as OfStreamVariable;

                _open(_rt, result, pathPtr);
                return result;
            }
        },
        ];

        for (const ctorHandler of ctorHandlers) {
            rt.regFunc(ctorHandler.default, thisType, ctorHandler.op, rt.typeSignature(ctorHandler.type), []);
        }

        const _open = function(_rt: CRuntime, _this: OfStreamVariable, right: InitIndexPointerVariable<ArithmeticVariable>): void {
            const fd = _rt.openFile(right);

            if (fd !== -1) {
                variables.arithmeticAssign(_this.v.members.fd, fd, rt.raiseException);
                _this.v.members._is_open.v.value = 1;
                //variables.indexPointerAssign(_this.v.members.buf, _rt.fileRead(_this.v.members.fd).v.pointee, 0, rt.raiseException);
            } else {
                _this.v.members.failbit.v.value = 1;
                _this.v.members._is_open.v.value = 0;
            }
        };
        const memberHandlers: FunHandler[] = [
            {
                op: "close",
                type: "FUNCTION VOID ( LREF CLASS ofstream < > )",
                default(rt: CRuntime, _templateTypes: [], l: OfStreamVariable): "VOID" {
                    rt.fileClose(l.v.members.fd);
                    l.v.members._is_open.v.value = 0;
                    return "VOID";
                }
            },
            {
                op: "open",
                type: "FUNCTION VOID ( LREF CLASS ofstream < > PTR I8 )",
                default(rt: CRuntime, _templateTypes: [], l: OfStreamVariable, _path: PointerVariable<ArithmeticVariable>): "VOID" {
                    const pathPtr = variables.asInitIndexPointerOfElem(_path, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                    _open(rt, l, pathPtr);
                    return "VOID";
                }
            },
            {
                op: "is_open",
                type: "FUNCTION BOOL ( LREF CLASS ofstream < > )",
                default(_rt: CRuntime, _templateTypes: [], l: OfStreamVariable): InitArithmeticVariable {
                    return variables.arithmetic("BOOL", l.v.members._is_open.v.value, null);
                }
            },
        ];
        memberHandlers.forEach((x) => {
            rt.regFunc(x.default, thisType, x.op, rt.typeSignature(x.type), []);
        })
    }
};
