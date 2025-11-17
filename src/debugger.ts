import { StatementMeta } from "./interpreter";
import { CRuntime } from "./rt";
import { ArithmeticVariable, Gen, MaybeLeftCV, ObjectType, variables } from "./variables";

interface AstNode extends StatementMeta {
    type: string;
}

type PromiseOrNot<T> = PromiseLike<T> | T;

type BreakpointConditionPredicate = (prevNode: AstNode | null, newStmt: AstNode | null) => PromiseOrNot<boolean | null>;

export default class Debugger {
    src: string;
    srcByLines: string[];
    prevNode: AstNode | null;
    done: boolean;
    conditions: {
        [condition: string]: BreakpointConditionPredicate;
    };
    stopConditions: {
        [condition: string]: boolean;
    };
    breakpoints: Set<number>;
    rt: CRuntime;
    gen: Generator<any, ArithmeticVariable | false, any>;
    constructor(rt: CRuntime, entryPoint: Gen<any>, src?: string, oldSrc?: string) {
        this.src = src || "";
        this.srcByLines = (oldSrc || src || "").split("\n");
        this.prevNode = null;
        this.done = false;
        this.conditions = {
            isStatement(_prevNode: AstNode, newStmt: AstNode | null) {
                return (newStmt != null ? newStmt.type.indexOf("Statement") >= 0 : null);
            },
            positionChanged(prevNode: AstNode, newStmt: AstNode) {
                return ((prevNode != null ? prevNode.eOffset : undefined) !== newStmt.eOffset) || ((prevNode != null ? prevNode.sOffset : undefined) !== newStmt.sOffset);
            },
            lineChanged(prevNode: AstNode, newStmt: AstNode) {
                return (prevNode != null ? prevNode.sLine : undefined) !== newStmt.sLine;
            }
        };
        this.rt = rt;
        this.gen = entryPoint;

        this.stopConditions = {
            isStatement: false,
            positionChangIntVariableed: false,
            lineChanged: true
        };
    }

    setStopConditions(stopConditions: {
        [condition: string]: boolean;
    }): void {
        this.stopConditions = stopConditions;
    }

    setCondition(name: string, callback: BreakpointConditionPredicate): void {
        this.conditions[name] = callback;
    }

    disableCondition(name: string): void {
        this.stopConditions[name] = false;
    }

    enableCondition(name: string): void {
        this.stopConditions[name] = true;
    }

    addBreakpoint(row: number): void {
        this.breakpoints.add(row);
    }

    removeBreakpoint(row: number): void {
        this.breakpoints.delete(row);
    }

    getSource(): string {
        return this.src;
    }

    start(): Gen<any> {
        return this.gen;
    }

    async wait(): Promise<void> {
        while (!this.rt.config.stdio?.cinState()) {
            await new Promise((resolve) => setImmediate(resolve));
        }
    }

    continue(): false | number {
        while (true) {
            const done = this.next();
            if (done !== false) { return done; }
            const curStmt = this.nextNode();
            for (const name of Object.keys(this.stopConditions)) {
                const active = this.stopConditions[name];
                if (active) {
                    if (this.conditions[name](this.prevNode, curStmt)) {
                        return false;
                    }
                }
            }
        }
    }

    next(): false | number {
        this.prevNode = this.nextNode();
        const ngen = this.gen.next();
        if (ngen.done) {
            this.done = true;
            if (ngen.value === false) {
                return false;
            } else {
                return this.rt.arithmeticValue(ngen.value);
            }
        } else {
            return false;
        }
    }

    nextLine() {
        const s = this.nextNode();
        return s ? this.srcByLines[s.sLine - 1] : this.srcByLines[0];
    }

    nextNodeText() {
        const s = this.nextNode();
        return s ? this.src.slice(s.sOffset, s.eOffset).trim() : "";
    }

    nextNode(): AstNode | null {
        if (this.done) {
            return null;
        } else {
            return this.rt.interp.currentNode;
        }
    }

    variable(name?: string) {
        if (name) {
            const v = this.rt.readVarOrFunc(name);
            const vf = variables.asFunction(v);
            if (vf !== null) {
                return {
                    type: vf.t.fulltype.join(" "),
                    value: vf.v
                }
            }
            return {
                type: this.rt.makeTypeStringOfVar(v as MaybeLeftCV<ObjectType>),
                value: v.v
            };
        } else {
            const usedName = new Set();
            const ret = [];
            for (let scopeIndex = this.rt.scope.length - 1; scopeIndex >= 0; scopeIndex--) {
                for (name of Object.keys(this.rt.scope[scopeIndex].variables)) {
                    const val = this.rt.scope[scopeIndex].variables[name];
                    if ((typeof val === "object") && "t" in val && "v" in val) {
                        if (!usedName.has(name)) {
                            usedName.add(name);
                            ret.push({
                                name,
                                type: this.rt.makeTypeStringOfVar(val),
                                value: this.rt.makeValueString(val)
                            });
                        }
                    }
                }
            }
            return ret;
        }
    }
}
