import { CRuntime, ClassType, ObjectValue, ObjectVariable, Variable, VariableType } from "../rt";

export = {
    load(rt: CRuntime) {

        class Vector {
            elements: any[];

            constructor(elements: any[]) {
                this.elements = elements;
            }
        
            [Symbol.iterator]() {
                return new Iterator(this);
            }

            push_back(value: any) {
                this.elements.push(value);
            }

            push_front(value: any) {
                this.elements.unshift(value);
            }

            pop_back() {
                if (this.size() > 0) {
                    this.elements.pop();
                }
            }
            
            size() {
                return this.elements.length;
            }

            front() {
                return this.elements[0];
            }

            back() {
                return this.elements[this.size() - 1];
            }

            get(index: number) {
                return this.elements[index];
            }
        }
        
        class Iterator {
            vector: Vector;
            index: number;

            constructor(vector: Vector) {
                this.vector = vector;
                this.index = 0;
            }
        
            begin() {
                this.index = 0;
                return this;
            }
        
            end() {
                this.index = this.vector.size();
                return this;
            }
        
            next() {
                if (this.index >= this.vector.size()) {
                    return { done: true };
                }
                return { value: this.vector.elements[this.index++], done: false };
            }
        }

        const vectorType: ClassType = rt.newClass("vector", [{
            name: "element_container",
            type: [] as any,
            initialize(rt, _this) { 
                return new Vector([]) as any; 
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
                    return element_container.get(r.v as number);
                }
            }
        };

        rt.regFunc(function(rt: CRuntime, _this: any, val: Variable) {
            // const vectorDataType = _this.dataType;
            const element_container = _getElementContainer(_this);
            element_container.push_back(rt.cloneDeep(val));
        }, vectorType, "push_back", ["?"], rt.voidTypeLiteral);

        rt.regFunc(function(rt: CRuntime, _this: any) {
            const element_container = _getElementContainer(_this);
            return rt.val(rt.intTypeLiteral, element_container.size());
        }, vectorType, "size", [], rt.intTypeLiteral);

        rt.regFunc(function(rt: CRuntime, _this: any) {
            const element_container = _getElementContainer(_this);
            return element_container.front();
        }, vectorType, "front", [], "?" as unknown as VariableType);

        rt.regFunc(function(rt: CRuntime, _this: any) {
            const element_container = _getElementContainer(_this);
            return element_container.back();
        }, vectorType, "back", [], "?" as unknown as VariableType);

        rt.regFunc(function(rt: CRuntime, _this: any) {
            const element_container = _getElementContainer(_this);
            const iterator = element_container[Symbol.iterator]();
            return iterator.begin();
        }, vectorType, "begin", [], "?" as unknown as VariableType);

        rt.regFunc(function(rt: CRuntime, _this: any) {
            const element_container = _getElementContainer(_this);
            const iterator = element_container[Symbol.iterator]();
            return iterator.end();
        }, vectorType, "end", [], "?" as unknown as VariableType);

        rt.regFunc(function(rt: CRuntime, _this: any) {
            const element_container = _getElementContainer(_this);
            const iterator = element_container[Symbol.iterator]();
            return iterator;
        }, vectorType, "__iterator", [], "?" as unknown as VariableType);
    }
};