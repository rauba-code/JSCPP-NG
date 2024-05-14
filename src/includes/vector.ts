import { CRuntime, ClassType, ObjectValue, ObjectVariable, Variable, VariableType } from "../rt";

export = {
    load(rt: CRuntime) {
        const vectorType: ClassType = rt.newClass("vector", [{
            name: "element_container",
            type: [] as any,
            initialize(rt, _this) { 
                return [] as any; 
            }
        }]);
        rt.addToNamespace("std", "vector", vectorType);

        const _getElementContainer = function(_this: any) {
            return _this.v.members["element_container"];
        };

        const vectorTypeSig = rt.getTypeSignature(vectorType);
        rt.types[vectorTypeSig].handlers = {
            "o([])": {
                default(rt, _this: any, r: Variable) {
                    const element_container = _getElementContainer(_this);
                    return element_container[r.v as number];
                }
            }
        };

        rt.regFunc(function(rt: CRuntime, _this: any, val: Variable) {
            // const vectorDataType = _this.dataType;
            const element_container = _getElementContainer(_this);
            element_container.push(rt.cloneDeep(val));
        }, vectorType, "push_back", ["?"], rt.voidTypeLiteral);

        rt.regFunc(function(rt: CRuntime, _this: any) {
            const element_container = _getElementContainer(_this);
            return rt.val(rt.intTypeLiteral, element_container.length);
        }, vectorType, "size", [], rt.intTypeLiteral);

        rt.regFunc(function(rt: CRuntime, _this: any) {
            const element_container = _getElementContainer(_this);
            return element_container[0];
        }, vectorType, "front", [], "?" as unknown as VariableType);

        rt.regFunc(function(rt: CRuntime, _this: any) {
            const element_container = _getElementContainer(_this);
            return element_container[element_container.length - 1];
        }, vectorType, "back", [], "?" as unknown as VariableType);
    }
};