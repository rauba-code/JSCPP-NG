import { CRuntime, ClassType, Variable, VariableType } from "../rt";

export = {
    load(rt: CRuntime) {

        class Vector {
            elements: any[];
            iterator: Iterator;

            constructor(elements: any[]) {
                this.elements = elements;
            }
        
            [Symbol.iterator]() {
                this.iterator = new Iterator(this);
                return this.iterator;
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

            insert(start: any, end: any) {
                this.elements.splice(((start as any).v?.index ?? start.v) as number, 0, end);
                return this.iterator;
            }

            erase(start: Variable, end: Variable) {
                this.elements.splice(((start as any).v?.index ?? start.v) as number, ((end?.v as number) - (start.v as number)) || 1);
                return this.iterator;
            }

            resize(count: any, value: any) {
                const currentSize = this.size();
                if (count.v as number < currentSize) {
                    this.elements.length = count.v as number;
                } else {
                    this.elements.push(...new Array((count.v as number) - currentSize).fill(value ?? rt.defaultValue(this.front().t)));
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

            clear() {
                this.elements = [];
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

        class Iterator {
            vector: Vector;
            index: number;
            v: Iterator;
            t: ClassType;

            constructor(vector: Vector) {
                this.vector = vector;
                this.index = 0;

                this.t = vectorType;
                this.v = this;
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

            [Symbol.iterator]() {
                return this;
            }
        }
        
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
            },
            "o(!=)": {
                default(rt, _left: any, _right: any) {
                    return rt.val(rt.boolTypeLiteral, _left.v.index != _right.index);
                }
            },
            "o(+)": { // vector .begin() + value
                default(rt, _left: any, _right: Variable) {
                    return _right;
                }
            },
            "o(-)": { // vector .end() - value
                default(rt, _left: any, _right: Variable) {
                    return rt.val(rt.intTypeLiteral, (_left.index - (_right as any).v));
                }
            },
            "o(*)": {
                default(rt, _left: any, _right: Variable) {
                    return _left.v.vector.get(_left.v.index);
                }
            },
            "o(=)": {
                default(rt, _left: any, _right: Variable) {
                    //_left.v = _right.v;
                }
            },
            "o(++)": { // vector it++;
                default(rt, _left: any, _right: Variable) {
                    _left.v.next();
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
            element_container.pop_back();
        }, vectorType, "pop_back", [], rt.voidTypeLiteral);

        rt.regFunc(function(rt: CRuntime, _this: any, count: Variable, value: Variable) {
            const element_container = _getElementContainer(_this);
            return element_container.resize(count, value);
        }, vectorType, "resize", ["?"], "?" as unknown as VariableType);

        rt.regFunc(function(rt: CRuntime, _this: any, start: Variable, end: Variable) {
            const element_container = _getElementContainer(_this);
            return element_container.insert(start, end);
        }, vectorType, "insert", ["?"], "?" as unknown as VariableType);

        rt.regFunc(function(rt: CRuntime, _this: any, start: Variable, end: Variable) {
            const element_container = _getElementContainer(_this);
            return element_container.erase(start, end);
        }, vectorType, "erase", ["?"], "?" as unknown as VariableType);

        rt.regFunc(function(rt: CRuntime, _this: any) {
            const element_container = _getElementContainer(_this);
            element_container.clear();
        }, vectorType, "clear", [], rt.voidTypeLiteral);

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