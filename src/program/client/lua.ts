/**
 * Lua module cannot handle methods which in the class\
 * In order to crack this issue, I put everything in the global scope\
 * But spawn the thread on the cluster processes\
 * 
 * This might cost more resources to work, But it won't throw error... so
 */
import fs from 'fs';
import * as luainjs from 'lua-in-js';
import path from 'path';
import { v6 as uuidv6 } from 'uuid';
import { DataType, Job, Libraries, LuaLib, Messager, Messager_log, Parameter } from '../interface';
import { ClientJobParameter } from './job_parameter';
import { ClientOS } from './os';

//#region Global
/**
 * The build-in methods for lua
 */
const lib = `function split(s, sep)
    local fields = {}
    local sep = sep or " "
    local pattern = string.format("([^%s]+)", sep)
    string.gsub(s, pattern, function(c) fields[#fields + 1] = c end)
    return fields
end
`

type Getlib = () => Libraries | undefined
type Getpara = () => Parameter | undefined
type Getjob = () => Job | undefined
type httpRequestType = [string, boolean, Response | undefined, any]

let getlib:Getlib | undefined = undefined
let getpara:Getpara | undefined = undefined
let getjob:Getjob | undefined = undefined
let messager: Messager
let messager_log: Messager_log
let clientos:ClientOS | undefined
let para:ClientJobParameter | undefined = undefined
let httpRequests:Array<httpRequestType> = []

const tag = () => getjob?.()?.uuid ?? 'unknown'
const runtime = () => getjob?.()?.runtime_uuid ?? 'unknown'

//#region Parameters
async function wait(time:number){
    const TIME = luainjs.utils.coerceArgToNumber(time, "wait", 1)
    return new Promise((resolve) => setTimeout(resolve, TIME * 1000))
}
async function sleep(n:number){
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n*1000);
}
function hasboolean(key:string){
    const p = getpara?.() ?? undefined
    if(p == undefined) return false
    return p.containers.findIndex(x => x.name == key && x.type == DataType.Boolean) != -1
}
function hasnumber(key:string){
    if(key == 'ck') return true
    const p = getpara?.() ?? undefined
    if(p == undefined) return false
    return p.containers.findIndex(x => x.name == key && x.type == DataType.Number) != -1
}
function hasstring(key:string){
    const p = getpara?.() ?? undefined
    if(p == undefined) return false
    return p.containers.findIndex(x => x.name == key && x.type == DataType.String) != -1
}
function getboolean(key:string){
    const p = getpara?.() ?? undefined
    if(p == undefined) return false
    return p.containers.find(x => x.name == key && x.type == DataType.Boolean)?.value ?? false
}
function getnumber(key:string){
    if(key == 'ck'){
        return getjob?.()?.index
    }
    const p = getpara?.() ?? undefined
    if(p == undefined) return 0
    return p.containers.find(x => x.name == key && x.type == DataType.Number)?.value ?? 0
}
function getstring(key:string){
    const p = getpara?.() ?? undefined
    if(p == undefined) return ""
    return p.containers.find(x => x.name == key && x.type == DataType.String)?.value ?? ""
}
function setboolean(key:string, value:boolean){
    const p = getpara?.() ?? undefined
    if(p == undefined) return
    const target = p.containers.find(x => x.name == key && x.type == DataType.Boolean)
    if(target == undefined && !p.canWrite) return
    if(target != undefined) target.value = value
    
    messager_log(`[Boolean feedback] ${key} = ${value}`, tag(), runtime())
    para?.feedbackboolean({key:key,value:value})
}
function setnumber(key:string, value:number){
    if(key == 'ck') {
        messager_log("Trying to set a constant ck...", tag(), runtime())
        return
    }
    const p = getpara?.() ?? undefined
    if(p == undefined) return
    const target = p.containers.find(x => x.name == key && x.type == DataType.Number)
    if(target == undefined && !p.canWrite) return
    if(target != undefined) target.value = value
    messager_log(`[Number feedback] ${key} = ${value}`, tag(), runtime())
    para?.feedbacknumber({key:key,value:value})
}
function setstring(key:string, value:string){
    const p = getpara?.() ?? undefined
    if(p == undefined) return
    const target = p.containers.find(x => x.name == key && x.type == DataType.String)
    if(target == undefined && !p.canWrite) return
    if(target != undefined) target.value = value
    messager_log(`[String feedback] ${key} = ${value}`, tag(), runtime())
    para?.feedbackstring({key:key,value:value})
}
//#endregion
//#endregion
//#region Http
function httpGet(url:string, p: luainjs.Table):string{
    return httpGo('GET', url, p.toObject())
}
function httpPost(url:string, p: luainjs.Table):string{
    return httpGo('POST', url, p.toObject())
}
function httpDelete(url:string, p: luainjs.Table):string{
    return httpGo('DELETE', url, p.toObject())
}
function httpPatch(url:string, p: luainjs.Table):string{
    return httpGo('PATCH', url, p.toObject())
}
function httpPut(url:string, p: luainjs.Table):string{
    return httpGo('PUT', url, p.toObject())
}
function httpGo(method:string, url:string, p: any):string {
    const id = uuidv6()
    fetch(url, {
        method: method,
        body: p
    }).then(x => {
        console.log(x)
        x.text().then(y => {
            console.log(y)
        })
        x.json().then(y => {
            console.log(y)
            const d:httpRequestType = [id, true, x, y]
            httpRequests.push(d)
        })
    }).catch((reason) => {
        const d:httpRequestType = [id, false, undefined, reason]
        httpRequests.push(d)
    })
    return id
}
async function httpWait(id:string){
    return new Promise<boolean>((resolve) => {
        setTimeout(() => {
            resolve(httpRequests.findIndex(x => x[0] == id) == -1)
        }, 100);
    })
}
function httpResultData(id:string):luainjs.Table{
    const index = httpRequests.findIndex(x => x[0] == id)
    if(index == -1) return new luainjs.Table()
    const target = httpRequests[index]
    if(target[1] == false || target[3] == undefined) return new luainjs.Table()
    return AnyToTable(target[3])
}
function AnyToTable(v:any):luainjs.Table {
    const r = new luainjs.Table()
    const keys = Object.keys(v)
    keys.forEach(x => {
        const value = v[x]
        if(value instanceof Object){
            const table = AnyToTable(value)
            r.set(x, table)
        }else{
            r.set(x, value)
        }
    })
    return r
}
//#endregion

/**
 * The lua runner
 */
export class ClientLua {
    os:luainjs.Table
    env:luainjs.Table
    message:luainjs.Table
    http:luainjs.Table

    constructor(_messager: Messager, _messager_log: Messager_log, _getjob:Getjob){
        messager = _messager
        messager_log = _messager_log
        this.os = new luainjs.Table({
            "sleep": sleep,
            "copyfile": this.copyfile,
            "copydir": this.copydir,
            "deletefile": this.deletefile,
            "deletedir": this.deletedir,
            "exist": this.exist,
            "listfile": this.listfile,
            "listdir": this.listdir,
            "createdir": this.createdir,
            "writefile": this.writefile,
            "readfile": this.readfile,
            "rename": this.rename,
        })
        
        this.env = new luainjs.Table({
            "wait": wait,
            "hasboolean": hasboolean, 
            "getboolean": getboolean, 
            "setboolean": setboolean,

            "hasnumber": hasnumber, 
            "getnumber": getnumber, 
            "setnumber": setnumber,

            "hasstring": hasstring, 
            "getstring": getstring, 
            "setstring": setstring,
        })
        
        this.message = new luainjs.Table({
            "messager": (m:string) => _messager(m, tag()), 
            "messager_log": (m:string) => _messager_log(m, tag(), runtime()),
            "table": (m:luainjs.Table) => _messager(JSON.stringify(m.toObject()), tag()),
            "table_log": (m:luainjs.Table) => _messager_log(JSON.stringify(m.toObject()), tag()),
        })

        this.http = new luainjs.Table({
            "get": httpGet,
            "post": httpPost,
            "put": httpPut,
            "delete": httpDelete,
            "patch": httpPatch,
            "wait": httpWait,
            "resultdata": httpResultData,
        })
    }

    /**
     * Before running the lua scripts, We must init first.\
     * ! Otherwise it won't work or throw error
     * @param _messager Message habndle
     * @param _messager_log Message habndle with print on screen feature
     * @param _clientos OS worker
     * @param _para Parameter worker
     * @param _getlib library getter method
     * @param _getpara Parameter getter method
     * @param _getjob Job getter method
     */
    static Init = (_messager: Messager, _messager_log: Messager, _clientos:ClientOS, _para:ClientJobParameter, _getlib:Getlib, _getpara:Getpara, _getjob:Getjob) => {
        messager = _messager
        messager_log = _messager_log
        clientos = _clientos
        para = _para
        getlib = _getlib
        getpara = _getpara
        getjob = _getjob
    }

    /**
     * Running lua\
     * With reference libraries\
     * @param lua Lua script text
     * @param libs Libraries header names
     * @returns Calcuate result
     */
    LuaExecuteWithLib = (lua:string, libs:Array<string>) => {
        const luaEnv = this.getLuaEnv()
        let script = lib + '\n'

        const p = getlib?.() ?? undefined
        if(p != undefined){
            libs.forEach(x => {
                const t = p.libs.find(y => y.name == x)
                if(t != undefined) script += ("\n" + t.content + "\n")
            })
        }
        
        script += ('\n' + lua)
        const execc = luaEnv.parse(script)
        const r = execc.exec()
        return r
    }

    /**
     * Running lua
     * @param lua Lua script text
     * @returns Calcuate result
     */
    LuaExecute = (lua:string) => {
        const luaEnv = this.getLuaEnv(LuaLib.OS | LuaLib.MESSAGE | LuaLib.HTTP)
        let script = lib + '\n' + lua
        const execc = luaEnv.parse(script)
        const r = execc.exec()
        return r
    }

    private getLuaEnv(flags:LuaLib = LuaLib.ALL){
        const isbin = process.cwd().endsWith('bin')
        const root = isbin ? path.join(process.cwd(), 'lua') : path.join(process.cwd(), 'bin', 'lua')
        if (!fs.existsSync(root)) fs.mkdirSync(root)
        const luaEnv = luainjs.createEnv({
            LUA_PATH: root,
            fileExists: p => fs.existsSync(path.join(root, p)),
            loadFile: p => this.readfile_Env(path.join(root, p)),
            stdout: messager,
        })
        if((flags & LuaLib.OS) == LuaLib.OS) luaEnv.loadLib('o', this.os)
        if((flags & LuaLib.ENV) == LuaLib.ENV) luaEnv.loadLib('env', this.env)
        if((flags & LuaLib.MESSAGE) == LuaLib.MESSAGE) luaEnv.loadLib('m', this.message)
        if((flags & LuaLib.HTTP) == LuaLib.HTTP) luaEnv.loadLib('http', this.http)
        const fss = fs.readdirSync(root, {withFileTypes: true})
        fss.forEach(x => {
            if(!x.isFile()) return
            const basename = path.basename(x.name)
            const table:luainjs.Table = luaEnv.parseFile(x.name).exec() as luainjs.Table
            luaEnv.loadLib(basename, table)
        })
        return luaEnv
    }
    private readfile_Env(path:string):string{
        return fs.readFileSync(path).toString()
    }
    private copyfile(from:string, to:string){
        clientos?.file_copy({from:from,to:to})
    }
    private copydir(from:string, to:string){
        clientos?.dir_copy({from:from,to:to})
    }
    private deletefile(path:string){
        clientos?.file_delete({path:path})
    }
    private deletedir(path:string){
        clientos?.dir_delete({path:path})
    }
    private rename(from:string, to:string){
        return clientos?.rename({from:from, to:to})
    }
    private exist(path:string){
        return clientos?.fs_exist({path:path})
    }
    private listfile(path:string){
        return clientos?.dir_files({path:path}).join('\n')
    }
    private listdir(path:string){
        return clientos?.dir_dirs({path:path}).join('\n')
    }
    private createdir(path:string){
        clientos?.dir_create({path:path})
    }
    private writefile(path:string, data:string){
        clientos?.file_write({ from: path, to: data })
    }
    private readfile(path:string){
        return clientos?.file_read({path:path})
    }
}
