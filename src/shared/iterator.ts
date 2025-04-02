import { ClassType } from "../../rt";

export class Iterator {
    scope: any;
    
    index: number;
    iterables: any;

    v: Iterator;
    t: ClassType;

    constructor(type: any, scope: any, iterables: any) {
        this.scope = scope;
        this.iterables = iterables;
        this.index = 0;

        this.t = type;
        this.v = this;
    }

    begin() {
        this.index = 0;
        return this;
    }

    end() {
        this.index = this.iterables.length;
        return this;
    }

    next() {
        if (this.index >= this.iterables.length) {
            return { done: true };
        }
        return { value: this.iterables[this.index++], done: false };
    }

    [Symbol.iterator]() {
        return this;
    }
}