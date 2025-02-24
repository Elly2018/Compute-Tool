export interface Parameter {
    numbers: Array<{ s?:boolean, name: string, value: number }>
    strings: Array<{ s?:boolean,name: string, value: string }>
    booleans: Array<{ s?:boolean,name: string, value: boolean }>
}

export interface Job {
    s?: boolean
    index?:number
    uuid: string
    category: number
    type: number
    lua: string
    string_args: Array<string>
    number_args: Array<number>
    boolean_args: Array<boolean>
}

export interface Task {
    uuid: string
    title: string
    description: string
    cronjob: boolean
    cronjobKey: string
    multi: boolean
    multiKey: string
    jobs: Array<Job>
}

export interface Project {
    uuid: string
    title: string
    description: string
    parameter: Parameter
    task: Array<Task>
}

export interface Node {
    ID: string
    url: string
}