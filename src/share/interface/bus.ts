import { Project } from "./base"
import { ExecutionLog, Log, Record } from "./record"
import { Header, Setter, WebsocketPack } from "./struct"
import { NodeTable } from "./table"
import { ToastData } from "./ui"

type Handler<T = unknown> = (event: T) => void
export type Messager = (msg:string, tag?:string) => void

export interface BusProjectStart {
    uuid: string
}

export interface BusProjectFinish {
    uuid: string
}

export interface BusTaskStart {
    uuid:string
    count:number
}

export interface BusTaskFinish {
    uuid:string
}

export interface BusSubTaskStart {
    index:number
    node:string
}

export interface BusSubTaskFinish {
    index:number
    node:string
}

export interface BusJobStart {
    uuid:string
    /**
     * Cron Index\
     * If single, this value will be 0
     */
    index:number
    node:string
}

export interface BusJobFinish {
    /**
     * Job uuid
     */
    uuid:string
    /**
     * Cron Index\
     * If single, this value will be 0
     */
    index:number
    /**
     * Use node uuid
     */
    node:string
    /**
     * 0: Success\
     * 1: Failed
     */
    meta:number
}

export interface BusAnalysis {
    name:string
    h:Header
    c:WebsocketPack | undefined
}

export interface Rename {
    oldname: string
    newname: string
}

export interface Login {
    username: string
    password: string
}

export interface RawSend {
    name: string
    token?: string
    data: any
}

export interface EmitterProxy<T> {
    on<Key extends keyof T> (type: T, handler: Handler<T[Key]>): void
    off<Key extends keyof T> (type: T, handler: Handler<T[Key]>): void
    emit<Key extends keyof T> (type: T, handler: T[Key]): void
}

export interface ExecuteProxy {
    executeProjectStart: (data:BusProjectStart) => void
    executeProjectFinish: (data:BusProjectFinish) => void
    executeTaskStart: (data:BusTaskStart) => void
    executeTaskFinish: (data:BusTaskFinish) => void
    executeSubtaskStart: (data:BusSubTaskStart) => void
    executeSubtaskFinish: (data:BusSubTaskFinish) => void
    executeJobStart: (data:BusJobStart) => void
    executeJobFinish: (data:BusJobFinish) => void
    feedbackMessage: (data:Setter) => void
}

/**
 * Emitter events container for Primary use
 */
export type BusType = {
    makeToast: ToastData
    modeSelect: boolean
    createProject: void
    updateProject: void
    recoverProject: Project
    updateTask: void
    updateJob: void
    updateParameter: void
    updateLocate: void
    updateNode: Array<NodeTable>
    execute: Record
    updateCurrent: ExecutionLog,
    updateLog: Log
    updateHandle: void
    feedbackMessage: Setter

    renameScript: Rename
    deleteScript: string

    executeProjectStart: BusProjectStart
    executeProjectFinish: BusProjectFinish
    executeTaskStart: BusTaskStart
    executeTaskFinish: BusTaskFinish
    executeSubtaskStart: BusSubTaskStart
    executeSubtaskFinish: BusSubTaskFinish
    executeJobStart: BusJobStart
    executeJobFinish: BusJobFinish

    analysis: BusAnalysis
    debuglog: string
    isExpress: boolean

    delay: Setter
    system: Setter
}

/**
 * Emitter events container for Web client
 */
export type BusWebType = {
    raw_send: RawSend

    locate: string
    load_preference: string
    load_cookie: void
    get_token: string
}