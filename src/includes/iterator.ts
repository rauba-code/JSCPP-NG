// TODO: Implement iterator
// Now it doesn't work at all
// Signatures are not OK

import { asResult } from "../interpreter";
import { CRuntime } from "../rt";
import * as common from "../shared/common";
import { InitIndexPointerVariable, Variable, variables, InitArithmeticVariable, Gen, MaybeUnboundVariable, ObjectType, InitValue, AbstractVariable, AbstractTemplatedClassType, ArithmeticVariable, PointerVariable, ClassType, InitPointerValue } from "../variables";

// Insert iterator type - tik vienas šablono parametras (Container)
interface InsertIteratorType<ContainerType extends ObjectType> extends AbstractTemplatedClassType<null, [ContainerType]> {
    readonly identifier: "insert_iterator",
}

type InsertIteratorVariable<ContainerType extends Variable> = AbstractVariable<InsertIteratorType<ContainerType["t"]>, InsertIteratorValue<ContainerType>>;

interface InsertIteratorValue<ContainerType extends Variable> extends InitValue<InsertIteratorVariable<ContainerType>> {
    members: {
        "_container": PointerVariable<ContainerType>,
        "_iter": PointerVariable<Variable>, // bendras Variable tipas iteratoriui
    }
}

// Back insert iterator type
interface BackInsertIteratorType<ContainerType extends ObjectType> extends AbstractTemplatedClassType<null, [ContainerType]> {
    readonly identifier: "back_insert_iterator",
}

type BackInsertIteratorVariable<ContainerType extends Variable> = AbstractVariable<BackInsertIteratorType<ContainerType["t"]>, BackInsertIteratorValue<ContainerType>>;

interface BackInsertIteratorValue<ContainerType extends Variable> extends InitValue<BackInsertIteratorVariable<ContainerType>> {
    members: {
        "_container": PointerVariable<ContainerType>,
    }
}

export = {
    load(rt: CRuntime) {
        // Define insert_iterator struct - tik vienas šablono parametras
        rt.defineStruct2("{global}", "insert_iterator", {
            numTemplateArgs: 1, factory: (iteratorType: InsertIteratorType<ObjectType>) => {
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
        }, ["_container", "_iter"], {});

        // Define back_insert_iterator struct
        rt.defineStruct2("{global}", "back_insert_iterator", {
            numTemplateArgs: 1, factory: (iteratorType: BackInsertIteratorType<ObjectType>) => {
                return [
                    {
                        name: "_container",
                        variable: variables.uninitPointer(iteratorType.templateSpec[0], null, "SELF")
                    }
                ]
            }
        }, ["_container"], {});

        // Constructor for insert_iterator - pakeista ?1 į PTR ?0
        const insertIteratorCtorHandler: common.OpHandler = {
            op: "o(_ctor)",
            type: "!ParamObject FUNCTION CLASS insert_iterator < ?0 > ( LREF ?0 PTR ?0 )",
            *default(rt: CRuntime, _templateTypes: ObjectType[], container: Variable, iter: PointerVariable<Variable>): Gen<InsertIteratorVariable<Variable>> {
                const containerType = _templateTypes[0];
                const thisType = variables.classType("insert_iterator", [containerType], null);
                const insertIter = yield* rt.defaultValue2(thisType, "SELF") as Gen<InsertIteratorVariable<Variable>>;
                
                // Set container pointer
                const containerPtr = insertIter.v.members._container;
                (containerPtr.v as InitPointerValue<Variable>).pointee = container.v;
                containerPtr.v.state = "INIT";
                
                // Set iterator pointer
                const iterPtr = variables.asInitIndexPointer(iter) ?? rt.raiseException("inserter: expected valid iterator");
                const iterPtrVar = insertIter.v.members._iter;
                (iterPtrVar.v as InitPointerValue<Variable>).pointee = iterPtr.v;
                iterPtrVar.v.state = "INIT";
                
                return insertIter;
            }
        };

        // Constructor for back_insert_iterator
        const backInsertIteratorCtorHandler: common.OpHandler = {
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
        };

        const insertIteratorType = variables.classType("insert_iterator", [], null);
        const backInsertIteratorType = variables.classType("back_insert_iterator", [], null);

        rt.regFunc(insertIteratorCtorHandler.default, insertIteratorType, insertIteratorCtorHandler.op, rt.typeSignature(insertIteratorCtorHandler.type), [-1]);
        rt.regFunc(backInsertIteratorCtorHandler.default, backInsertIteratorType, backInsertIteratorCtorHandler.op, rt.typeSignature(backInsertIteratorCtorHandler.type), [-1]);

        // Assignment operators
        common.regOps(rt, [
            {
                op: "o(_=_)",
                type: "!ParamObject FUNCTION LREF CLASS insert_iterator < ?0 > ( LREF CLASS insert_iterator < ?0 > CLREF ?0 )",
                *default(rt: CRuntime, _templateTypes: ObjectType[], insertIter: InsertIteratorVariable<Variable>, value: Variable): Gen<InsertIteratorVariable<Variable>> {
                    const containerPtr = variables.asInitPointer(insertIter.v.members._container) ?? rt.raiseException("insert_iterator: container not initialized");
                    const iterPtr = variables.asInitPointer(insertIter.v.members._iter) ?? rt.raiseException("insert_iterator: iterator not initialized");
                    
                    // Get container and iterator from pointers
                    const container = rt.unbound(containerPtr) as Variable;
                    const iter = rt.unbound(iterPtr) as PointerVariable<Variable>;
                    
                    // Call container's insert method
                    const containerType = container.t as ClassType;
                    if (containerType.identifier) {
                        try {
                            const insertMethod = rt.getFuncByParams("{global}" as ClassType | "{global}", "insert", [
                                { t: container.t, v: { isConst: false, lvHolder: "SELF" } },
                                { t: iter.t, v: { isConst: true, lvHolder: "SELF" } },
                                { t: value.t, v: { isConst: true, lvHolder: "SELF" } }
                            ], []);
                            if (insertMethod) {
                                const insertResult = rt.invokeCall(insertMethod, [], container, iter, value);
                                asResult(insertResult) ?? (yield* insertResult as Gen<Variable>);
                            }
                        } catch (e) {
                            // Fallback - try to call insert directly
                        }
                    }
                    
                    return insertIter;
                }
            },
            {
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
            }
        ]);

        // Dereference and increment operators
        common.regOps(rt, [
            {
                op: "o(*_)",
                type: "!ParamObject FUNCTION LREF CLASS insert_iterator < ?0 > ( LREF CLASS insert_iterator < ?0 > )",
                default(rt: CRuntime, _templateTypes: ObjectType[], insertIter: InsertIteratorVariable<Variable>): InsertIteratorVariable<Variable> {
                    return insertIter; // Insert iterators return themselves when dereferenced
                }
            },
            {
                op: "o(*_)",
                type: "!ParamObject FUNCTION LREF CLASS back_insert_iterator < ?0 > ( LREF CLASS back_insert_iterator < ?0 > )",
                default(rt: CRuntime, _templateTypes: ObjectType[], backInsertIter: BackInsertIteratorVariable<Variable>): BackInsertIteratorVariable<Variable> {
                    return backInsertIter; // Back insert iterators return themselves when dereferenced
                }
            },
            {
                op: "o(++_)",
                type: "!ParamObject FUNCTION LREF CLASS insert_iterator < ?0 > ( LREF CLASS insert_iterator < ?0 > )",
                default(rt: CRuntime, _templateTypes: ObjectType[], insertIter: InsertIteratorVariable<Variable>): InsertIteratorVariable<Variable> {
                    return insertIter; // Insert iterators don't actually increment
                }
            },
            {
                op: "o(++_)",
                type: "!ParamObject FUNCTION LREF CLASS back_insert_iterator < ?0 > ( LREF CLASS back_insert_iterator < ?0 > )",
                default(rt: CRuntime, _templateTypes: ObjectType[], backInsertIter: BackInsertIteratorVariable<Variable>): BackInsertIteratorVariable<Variable> {
                    return backInsertIter; // Back insert iterators don't actually increment
                }
            },
            {
                op: "o(_++)",
                type: "!ParamObject FUNCTION CLASS insert_iterator < ?0 > ( LREF CLASS insert_iterator < ?0 > I32 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], insertIter: InsertIteratorVariable<Variable>, _dummy: ArithmeticVariable): InsertIteratorVariable<Variable> {
                    return insertIter; // Insert iterators don't actually increment
                }
            },
            {
                op: "o(_++)",
                type: "!ParamObject FUNCTION CLASS back_insert_iterator < ?0 > ( LREF CLASS back_insert_iterator < ?0 > I32 )",
                default(rt: CRuntime, _templateTypes: ObjectType[], backInsertIter: BackInsertIteratorVariable<Variable>, _dummy: ArithmeticVariable): BackInsertIteratorVariable<Variable> {
                    return backInsertIter; // Back insert iterators don't actually increment
                }
            }
        ]);

        // Global utility functions - pakeista ?1 į PTR ?0
        common.regGlobalFuncs(rt, [
            {
                op: "inserter",
                type: "!ParamObject FUNCTION CLASS insert_iterator < ?0 > ( LREF ?0 PTR ?0 )",
                *default(rt: CRuntime, templateTypes: ObjectType[], container: Variable, iter: PointerVariable<Variable>): Gen<InsertIteratorVariable<Variable>> {
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
