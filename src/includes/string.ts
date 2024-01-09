/* eslint-disable no-shadow */
import { CRuntime, ClassType, ArrayVariable, Variable, ObjectVariable, IntType, VariableValue, IntVariable } from "../rt";

export = {
    load(rt: CRuntime) {
        const newStringType: ClassType = rt.newClass("string", []);

        const typeSig = rt.getTypeSignature(newStringType);
        rt.types[typeSig].father = "object";

        const originalConstructor = rt.types[typeSig].cConstructor;
        rt.types[typeSig].cConstructor = function(rt: CRuntime, _this: Variable) {
            originalConstructor(rt, _this);
            _this.v = rt.makeCharArrayFromString("").v as VariableValue;
        };
        
        const stringHandlers = {
            "o(=)": {
                default(rt: CRuntime, left: any, right: any) {
                    left.v = _convertSingleCharIntoStringArray(right).v;
                    return left;                    
                },
            },
            "o(+)": {
                default(rt: CRuntime, left: Variable, right: ArrayVariable) {
                    const r = rt.getStringFromCharArray(left as ArrayVariable) + rt.getStringFromCharArray(right);
                    left.v = rt.makeCharArrayFromString(r).v;
                    return left;
                }
            },
            "o(==)": {
                default(rt: CRuntime, left: ArrayVariable, right: ArrayVariable) {
                    const l = rt.getStringFromCharArray(left);
                    const r = rt.getStringFromCharArray(right);
                    return rt.val(rt.boolTypeLiteral, l === r);
                }
            },
            "o(+=)": {
                default(rt: CRuntime, left: Variable, right: ArrayVariable) {
                    const r = stringHandlers["o(+)"].default(rt, left, right);
                    return stringHandlers["o(=)"].default(rt, left, r);
                }
            },
            "o([])": {
                default(rt: CRuntime, left: ArrayVariable, right: any) {
                    return left.v.target[right.v];
                }
            },
        };

        rt.types[typeSig].handlers = stringHandlers;

        const _convertSingleCharIntoStringArray = function(charArray: any) {
            if (charArray.v.target)
                return charArray;

            return rt.makeCharArrayFromString(String.fromCharCode(charArray.v as number));
        };

        const _getSubstring = function(rt: CRuntime, left: Variable, pos: IntVariable, npos: IntVariable) {
            const r = rt.getStringFromCharArray(left as ArrayVariable).substring(pos.v, npos != null ? pos.v + npos.v : undefined);
            left.v = rt.makeCharArrayFromString(r).v;
            return left;
        };
    
        const _getStringLength = function(rt: CRuntime, _this: Variable) {
            const len = rt.getStringFromCharArray(_this as ArrayVariable).length;
            _this = rt.val(rt.intTypeLiteral, len);
            return _this;
        };

        rt.regFunc(_getStringLength, newStringType, "length", [], rt.intTypeLiteral);
		rt.regFunc(_getStringLength, newStringType, "size", [], rt.intTypeLiteral);
        rt.regFunc(_getSubstring, newStringType, "substr", [rt.intTypeLiteral], newStringType, [{ 
            name: "npos", 
            type: rt.intTypeLiteral, 
            expression: ""
        }]);

        rt.regFunc(function(rt: CRuntime, left: Variable, str: Variable, pos: IntVariable, n: IntVariable) {
            const index = rt.getStringFromCharArray(_convertSingleCharIntoStringArray(left)).indexOf(rt.getStringFromCharArray(_convertSingleCharIntoStringArray(str)).substring(0, n?.v), pos?.v);
            left = rt.val(rt.intTypeLiteral, index);
            return left;
        }, newStringType, "find", ["?"], newStringType, [{ 
            name: "pos", 
            type: rt.intTypeLiteral, 
            expression: ""
        }, { 
            name: "n", 
            type: rt.intTypeLiteral, 
            expression: ""
        }]);

        rt.regFunc(function(rt: CRuntime, _this: Variable, append_str: Variable, subpos: IntVariable, sublen: IntVariable) {
            let r = rt.getStringFromCharArray(_this as ArrayVariable);
            r += rt.getStringFromCharArray((!subpos ? append_str : _getSubstring(rt, append_str, subpos, sublen)) as ArrayVariable);

            _this.v = rt.makeCharArrayFromString(r).v;
            return _this;
        }, newStringType, "append", ["?"], newStringType, [
            { 
                name: "subpos", 
                type: rt.intTypeLiteral, 
                expression: ""
            }, { 
                name: "sublen", 
                type: rt.intTypeLiteral, 
                expression: ""
            }
        ]);
    }
};
