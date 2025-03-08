import * as luainjs from 'lua-in-js';
import { Libraries, Parameter } from '../interface';
import { ClientOS } from './os';
import { ClientParameter } from './parameter';

//#region Global
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

let getlib:Getlib | undefined = undefined
let getpara:Getpara | undefined = undefined
let messager: Function
let messager_log: Function
let clientos:ClientOS | undefined
let para:ClientParameter | undefined = undefined

function hasboolean(key:string){
    const p = getpara?.() ?? undefined
    if(p == undefined) return false
    return p.booleans.findIndex(x => x.name == key) != -1
}
function hasnumber(key:string){
    const p = getpara?.() ?? undefined
    if(p == undefined) return false
    return p.numbers.findIndex(x => x.name == key) != -1
}
function hasstring(key:string){
    const p = getpara?.() ?? undefined
    if(p == undefined) return false
    return p.strings.findIndex(x => x.name == key) != -1
}
function getboolean(key:string){
    const p = getpara?.() ?? undefined
    if(p == undefined) return false
    return p.booleans.find(x => x.name == key)?.value ?? false
}
function getnumber(key:string){
    const p = getpara?.() ?? undefined
    if(p == undefined) return 0
    return p.numbers.find(x => x.name == key)?.value ?? 0
}
function getstring(key:string){
    const p = getpara?.() ?? undefined
    if(p == undefined) return ""
    return p.strings.find(x => x.name == key)?.value ?? ""
}
function setboolean(key:string, value:boolean){
    const p = getpara?.() ?? undefined
    if(p == undefined) return
    const target = p.booleans.find(x => x.name == key)
    if(target == undefined) return
    target.value = value
    messager_log(`[布林參數回饋] ${key} = ${value}`)
    para?.feedbackboolean({key:key,value:value})
}
function setnumber(key:string, value:number){
    const p = getpara?.() ?? undefined
    if(p == undefined) return
    const target = p.numbers.find(x => x.name == key)
    if(target == undefined) return
    target.value = value
    messager_log(`[數字參數回饋] ${key} = ${value}`)
    para?.feedbacknumber({key:key,value:value})
}
function setstring(key:string, value:string){
    const p = getpara?.() ?? undefined
    if(p == undefined) return
    const target = p.strings.find(x => x.name == key)
    if(target == undefined) return
    target.value = value
    messager_log(`[字串參數回饋] ${key} = ${value}`)
    para?.feedbackstring({key:key,value:value})
}
//#endregion

export class ClientLua {
    os:luainjs.Table
    env:luainjs.Table
    message:luainjs.Table

    constructor(_messager: Function, _messager_log: Function){
        this.os = new luainjs.Table({
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
            "messager": _messager, 
            "messager_log": _messager_log
        })
    }

    static Init = (_messager: Function, _messager_log: Function, _clientos:ClientOS, _para:ClientParameter, _getlib:Getlib, _getpara:Getpara) => {
        messager = _messager
        messager_log = _messager_log
        clientos = _clientos
        para = _para
        getlib = _getlib
        getpara = _getpara
    }

    LuaExecuteWithLib = (lua:string, libs:Array<string>) => {
        const luaEnv = this.getLuaEnv()
        try {
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
        }catch(err){
            throw err
        }
    }

    LuaExecute = (lua:string) => {
        const luaEnv = this.getLuaEnv()
        try {
            let script = lib + '\n' + lua
            const execc = luaEnv.parse(script)
            const r = execc.exec()
            return r
        }catch(err){
            throw err
        }
    }

    private getLuaEnv(){
        const luaEnv = luainjs.createEnv()
        luaEnv.loadLib('o', this.os)
        luaEnv.loadLib('env', this.env)
        luaEnv.loadLib('m', this.message)
        return luaEnv
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
