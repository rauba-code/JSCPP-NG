import { CRuntime } from "../../rt";
import * as unixapi from "../../shared/unixapi"

export = {
    load(rt: CRuntime) {
        rt.regFunc(unixapi.write, "{global}", "__write", rt.typeSignature("FUNCTION VOID ( I32 PTR I8 )"), []);
    }
}
