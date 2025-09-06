// TODO: Implement iterator
// Now it doesn't work at all
// Signatures are not OK

import { asResult } from "../interpreter";
import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { InitIndexPointerVariable, Variable, variables, InitArithmeticVariable, Gen, MaybeUnboundVariable, ObjectType, InitValue, AbstractVariable, AbstractTemplatedClassType, ArithmeticVariable, PointerVariable, ClassType, InitPointerValue, ClassVariable, InitPointerVariable } from "../variables";

// Insert iterator type - tik vienas šablono parametras (Container)
interface InsertIteratorType<ContainerType extends ObjectType> extends AbstractTemplatedClassType<null, [ContainerType]> {
    readonly identifier: "insert_iterator",
}

type InsertIteratorVariable<ContainerType extends Variable> = AbstractVariable<InsertIteratorType<ContainerType["t"]>, InsertIteratorValue<ContainerType>>;

interface InsertIteratorValue<ContainerType extends Variable> extends InitValue<InsertIteratorVariable<ContainerType>> {
    members: {
        "_container": PointerVariable<ContainerType>,
        "_iter": Variable, // bendras Variable tipas iteratoriui
    }
}

// Back insert iterator type
// uncomment after testing
/*interface BackInsertIteratorType<ContainerType extends ObjectType> extends AbstractTemplatedClassType<null, [ContainerType]> {
    readonly identifier: "back_insert_iterator",
}

type BackInsertIteratorVariable<ContainerType extends Variable> = AbstractVariable<BackInsertIteratorType<ContainerType["t"]>, BackInsertIteratorValue<ContainerType>>;

interface BackInsertIteratorValue<ContainerType extends Variable> extends InitValue<BackInsertIteratorVariable<ContainerType>> {
    members: {
        "_container": PointerVariable<ContainerType>,
    }
}*/

export = {
    load(rt: CRuntime) {
        // Define insert_iterator struct - tik vienas šablono parametras
        const insertIteratorSig: string[] = "!Class CLASS insert_iterator < ?0 >".split(" ");
        rt.defineStruct2("{global}", "insert_iterator", {
            numTemplateArgs: 1, factory: (iteratorType: InsertIteratorType<ObjectType>) => {
                //const iteratorType = rt
                return [
                    {
                        name: "_container",
                        variable: variables.uninitPointer(iteratorType.templateSpec[0], null, "SELF")
                    },
                    {
                        name: "_iter",
                        variable: variables.uninitPointer(variables.arithmeticType("I8"), null, "SELF")
                    }
                ]
            }
        }, ["_container", "_iter"], {
            ["value_type"]: [{ src: insertIteratorSig, dst: ["VOID"] }],
            ["pointer"]: [{ src: insertIteratorSig, dst: ["VOID"] }],
            ["reference"]: [{ src: insertIteratorSig, dst: ["VOID"] }],
        });

        // Define back_insert_iterator struct
        /*rt.defineStruct2("{global}", "back_insert_iterator", {
            numTemplateArgs: 1, factory: (iteratorType: BackInsertIteratorType<ObjectType>) => {
                return [
                    {
                        name: "_container",
                        variable: variables.uninitPointer(iteratorType.templateSpec[0], null, "SELF")
                    }
                ]
            }
        }, ["_container"], {});*/

        // Constructor for insert_iterator - pakeista ?1 į PTR ?0
        const insertIteratorCtorHandler: common.OpHandler = {
            op: "o(_ctor)",
            type: "!Class FUNCTION CLASS insert_iterator < ?0 > ( LREF ?0 MEMBERTYPE iterator ?0 )",
            *default(rt: CRuntime, _templateTypes: ObjectType[], container: Variable, iter: Variable): Gen<InsertIteratorVariable<Variable>> {
                const thisType = variables.classType("insert_iterator", [container.t], null);
                const insertIter = yield* rt.defaultValue2(thisType, "SELF") as Gen<InsertIteratorVariable<Variable>>;

                // Set container pointer
                const containerPtr = insertIter.v.members._container;
                containerPtr.v.state = "INIT";
                (containerPtr.v as InitPointerValue<Variable>).pointee = container.v;
                (containerPtr.v as InitPointerValue<Variable>).subtype = "DIRECT";

                // Set iterator member
                insertIter.v.members["_iter"] = iter;

                return insertIter;
            }
        };

        // Constructor for back_insert_iterator
        /*const backInsertIteratorCtorHandler: common.OpHandler = {
            op: "o(_ctor)",
            type: "!ParamObject FUNCTION CLASS back_insert_iterator < ?0 > ( LREF ?0 )",
            *default(rt: CRuntime, _templateTypes: ObjectType[], container: Variable): Gen<BackInsertIteratorVariable<Variable>> {
                const containerType = _templateTypes[0];
                const thisType = variables.classType("back_insert_iterator", [containerType], null);
                const backInsertIter = yield* rt.defaultValue2(thisType, "SELF") as Gen<BackInsertIteratorVariable<Variable>>;
                
                // Set container pointer
                const containerPtr = backInsertIter.v.members._container;
                (containerPtr.v as InitPointerValue<Variable>).pointee = container.v;
                containerPtr.v.state = "INIT";
                
                return backInsertIter;
            }
        };*/

        const insertIteratorType = variables.classType("insert_iterator", [], null);
        //const backInsertIteratorType = variables.classType("back_insert_iterator", [], null);

        rt.regFunc(insertIteratorCtorHandler.default, insertIteratorType, insertIteratorCtorHandler.op, rt.typeSignature(insertIteratorCtorHandler.type), [-1]);
        //rt.regFunc(backInsertIteratorCtorHandler.default, backInsertIteratorType, backInsertIteratorCtorHandler.op, rt.typeSignature(backInsertIteratorCtorHandler.type), [-1]);

        // Assignment operators
        common.regOps(rt, [
            {
                op: "o(_=_)",
                type: "!Class FUNCTION LREF CLASS insert_iterator < ?0 > ( LREF CLASS insert_iterator < ?0 > CLREF MEMBERTYPE value_type ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], insertIter: InsertIteratorVariable<Variable>, value: Variable): Gen<InsertIteratorVariable<Variable>> {
                    // current implementation of function parameter conversion does not convert LREF to CLREF, need to do that manually
                    const wasConst : boolean = value.v.isConst;
                    if (!wasConst) {
                        (value.v as any).isConst = true;
                    }
                    const containerPtr = variables.asInitPointer(insertIter.v.members._container) ?? rt.raiseException("insert_iterator: container pointer not initialized");
                    if (containerPtr.t.pointee.sig === "FUNCTION") {
                        rt.raiseException("insert_iterator::operator=(): Unexpected function pointer in this->_container");
                    }
                    const iter = insertIter.v.members._iter;

                    // Get container and iterator from pointers
                    const x = variables.deref(containerPtr as InitPointerVariable<Variable>) as MaybeUnboundVariable;
                    const container = variables.asClass(rt.unbound(x) as Variable) ?? rt.raiseException("insert_iterator: container is not a class");

                    // Call container's insert method
                    const insertMethod = rt.getFuncByParams(container.t, "insert", [
                        container,
                        iter,
                        value
                    ], []);
                    const insertResult = rt.invokeCall(insertMethod, [], container, iter, value);
                    asResult(insertResult) ?? (yield* insertResult as Gen<MaybeUnboundVariable | "VOID">);
                    const ppInst = rt.getOpByParams("{global}", "o(++_)", [iter], []);
                    const ppYield = rt.invokeCall(ppInst, [], iter);
                    asResult(ppYield) ?? (yield* ppYield as Gen<MaybeUnboundVariable | "VOID">);

                    if (!wasConst) {
                        (value.v as any).isConst = false;
                    }
                    return insertIter;
                }
            },
            /*{
                op: "o(_=_)",
                type: "!ParamObject FUNCTION LREF CLASS back_insert_iterator < ?0 > ( LREF CLASS back_insert_iterator < ?0 > CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], backInsertIter: BackInsertIteratorVariable<Variable>, value: Variable): Gen<BackInsertIteratorVariable<Variable>> {
                    const containerPtr = variables.asInitPointer(backInsertIter.v.members._container) ?? rt.raiseException("back_insert_iterator: container not initialized");
                    
                    // Get container from pointer
                    const container = rt.unbound(containerPtr) as Variable;
                    
                    // Call container's push_back method
                    const containerType = container.t as ClassType;
                    if (containerType.identifier) {
                        try {
                            const pushBackMethod = rt.getFuncByParams("{global}" as ClassType | "{global}", "push_back", [
                                { t: container.t, v: { isConst: false, lvHolder: "SELF" } },
                                { t: value.t, v: { isConst: true, lvHolder: "SELF" } }
                            ], []);
                            if (pushBackMethod) {
                                const pushResult = rt.invokeCall(pushBackMethod, [], container, value);
                                asResult(pushResult) ?? (yield* pushResult as Gen<Variable>);
                            }
                        } catch (e) {
                            // Fallback - try to call push_back directly
                        }
                    }
                    
                    return backInsertIter;
                }
            }*/
        ]);

        // Dereference and increment operators
        common.regOps(rt, [
            {
                op: "o(*_)",
                type: "!ParamObject FUNCTION LREF CLASS insert_iterator < ?0 > ( LREF CLASS insert_iterator < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], insertIter: InsertIteratorVariable<Variable>): InsertIteratorVariable<Variable> {
                    return insertIter; // Insert iterators return themselves when dereferenced
                }
            },
            /*{
                op: "o(*_)",
                type: "!ParamObject FUNCTION LREF CLASS back_insert_iterator < ?0 > ( LREF CLASS back_insert_iterator < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], backInsertIter: BackInsertIteratorVariable<Variable>): BackInsertIteratorVariable<Variable> {
                    return backInsertIter; // Back insert iterators return themselves when dereferenced
                }
            },*/
            {
                op: "o(++_)",
                type: "!ParamObject FUNCTION LREF CLASS insert_iterator < ?0 > ( LREF CLASS insert_iterator < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], insertIter: InsertIteratorVariable<Variable>): InsertIteratorVariable<Variable> {
                    return insertIter; // Insert iterators don't actually increment
                }
            },
            /*{
                op: "o(++_)",
                type: "!ParamObject FUNCTION LREF CLASS back_insert_iterator < ?0 > ( LREF CLASS back_insert_iterator < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], backInsertIter: BackInsertIteratorVariable<Variable>): BackInsertIteratorVariable<Variable> {
                    return backInsertIter; // Back insert iterators don't actually increment
                }
            },*/
            {
                op: "o(_++)",
                type: "!ParamObject FUNCTION LREF CLASS insert_iterator < ?0 > ( LREF CLASS insert_iterator < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], insertIter: InsertIteratorVariable<Variable>): InsertIteratorVariable<Variable> {
                    return insertIter; // Insert iterators don't actually increment
                }
            },
            /*{
                op: "o(_++)",
                type: "!ParamObject FUNCTION LREF CLASS back_insert_iterator < ?0 > ( LREF CLASS back_insert_iterator < ?0 > )",
                default(_rt: CRuntime, _templateTypes: ObjectType[], backInsertIter: BackInsertIteratorVariable<Variable>): BackInsertIteratorVariable<Variable> {
                    return backInsertIter; // Back insert iterators don't actually increment
                }
            }*/
        ]);

        // Global utility functions
        common.regGlobalFuncs(rt, [
            {
                op: "inserter",
                type: "!Class FUNCTION CLASS insert_iterator < ?0 > ( LREF ?0 MEMBERTYPE iterator ?0 )",
                *default(rt: CRuntime, templateTypes: ObjectType[], container: ClassVariable, iter: Variable): Gen<InsertIteratorVariable<Variable>> {
                    const containerType = templateTypes[0];
                    
                    const insertIterResult = insertIteratorCtorHandler.default(rt, [containerType], container, iter);
                    const result = asResult(insertIterResult);
                    if (result) {
                        return result as InsertIteratorVariable<Variable>;
                    } else {
                        return yield* insertIterResult as Gen<InsertIteratorVariable<Variable>>;
                    }
                }
            }
        ]);
    }
};
