import { Parameter, Project } from "../../interface"

export const GetAfterEffectTemplate = (r:Project):Project => {
    const para:Parameter = {
        canWrite: true,
        containers: []
    }
    r.parameter = para
    r.task = [

    ]
    return r
}