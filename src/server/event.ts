import fs from "fs";
import tcpPortUsed from 'tcp-port-used';
import ws from 'ws';
import { Client } from "./client/client";
import { messager, messager_log } from "./debugger";
import { BusAnalysis, BusJobFinish, BusJobStart, BusProjectFinish, BusProjectStart, BusSubTaskFinish, BusSubTaskStart, BusTaskFinish, BusTaskStart, ExecuteProxy, Header, Libraries, Log, Preference, Project, Record, Setter, WebsocketPack } from "./interface";
import { i18n } from "./plugins/i18n";
import { ExecuteManager } from "./script/execute_manager";
import { WebsocketManager } from "./script/socket_manager";

export class BackendEvent {
    client:Client | undefined = undefined
    websocket_manager:WebsocketManager | undefined = undefined
    execute_manager:ExecuteManager | undefined = undefined
    manager:Array<ws.WebSocket> = []
    libs:Libraries = {libs: []}
    
    constructor(){
        this.client = new Client(messager, messager_log)
    }

    Init = () => {
        const proxy:ExecuteProxy = {
            executeProjectStart: (data:BusProjectStart):void => { this.Boradcasting('executeProjectStart', data) },
            executeProjectFinish: (data:BusProjectFinish):void => { this.Boradcasting('executeProjectFinish', data) },
            executeTaskStart: (data:BusTaskStart):void => { this.Boradcasting('executeTaskStart', data) },
            executeTaskFinish: (data:BusTaskFinish):void => { this.Boradcasting('executeTaskFinish', data) },
            executeSubtaskStart: (data:BusSubTaskStart):void => { this.Boradcasting('executeSubtaskStart', data) },
            executeSubtaskFinish: (data:BusSubTaskFinish):void => { this.Boradcasting('executeSubtaskFinish', data) },
            executeJobStart: (data:BusJobStart):void => { this.Boradcasting('executeJobStart', data) },
            executeJobFinish: (data:BusJobFinish):void => { this.Boradcasting('executeJobFinish', data) },
            feedbackMessage: (data:Setter):void => { this.Boradcasting('feedbackMessage', data) },
        }

        this.websocket_manager = new WebsocketManager(this.newConnect, this.disconnect, this.analysis, messager_log)
        this.execute_manager = new ExecuteManager(this.websocket_manager, messager_log)
        this.execute_manager.libs = this.libs
        this.execute_manager.proxy = proxy
        this.websocket_manager.newConnect = this.newConnect
        this.websocket_manager.disconnect = this.disconnect
        this.websocket_manager.onAnalysis = this.execute_manager.Analysis
    }

    NewConsole = (socket:ws.WebSocket) => {
        this.manager.push(socket)
    }

    DropConsole = (socket:ws.WebSocket) => {
        const index = this.manager.findIndex(x => x == socket)
        if(index != -1) this.manager.splice(index, 1)
    }

    Analysis = (socket:ws.WebSocket, h:Header) => {
        const typeMap:{ [key:string]:Function } = {
            'lua': this.lua
        }

        if (h == undefined){
            messager_log('[來源資料解析] 解析失敗, 得到的值為 undefined')
            return;
        }
        if (h.message != undefined && h.message.length > 0){
            messager_log(`[來源資料解析] ${h.message}`)
        }
        if (h.data == undefined) return
        if(typeMap.hasOwnProperty(h.name)){
            const castingFunc = typeMap[h.name]
            castingFunc(socket, h.data)
        }else{
            messager_log(`[來源資料解析] 解析失敗, 不明的來源標頭, name: ${h.name}, meta: ${h.meta}`)
        }
    }

    //#region Server Side
    private newConnect = (x:WebsocketPack) => {
        const d:Header = {
            name: 'makeToast',
            data: {
                title: "連線建立",
                type: 'success',
                message: `建立新的連線: ${x.websocket.url} \n${x.uuid}`
            }
        }
        this.manager.forEach(x => {
            x.send(JSON.stringify(d))
        })
        this.execute_manager?.NewConnection(x)
    }

    private disconnect = (x:WebsocketPack) => {
        const d:Header = {
            name: 'makeToast',
            data: {
                title: "連線中斷",
                type: 'danger',
                message: `連線中斷偵測: ${x.websocket.url} \n${x.uuid}`
            }
        }
        this.manager.forEach(x => {
            x.send(JSON.stringify(d))
        })
    }

    private analysis = (b:BusAnalysis) => {
        this.execute_manager?.Analysis(b)
    }
    
    private lua = (socket:ws.WebSocket, content:string) => {
        const r = this.client?.lua.LuaExecute(content)
        const d:Header = {
            name: 'lua-feedback',
            data: r?.toString() ?? ''
        }
        socket.send(JSON.stringify(d))
    }

    private message = (socket:ws.WebSocket, d:{message:string, tag?:string}) => {
        console.log(`${ d.tag == undefined ? '[後台訊息]' : '[' + d.tag + ']' } ${d.message}`);
    }

    private save_record = (socket:ws.WebSocket, record:string) => {
        fs.writeFileSync('record.json', record)
    }
    private load_record =  (socket:ws.WebSocket) => {
        const exist = fs.existsSync('record.json');
        messager_log(`[事件] 讀取 record.js, 檔案存在: ${exist}`)
        if(!exist){
            const record:Record = {
                projects: [],
                nodes: []
            }
            fs.writeFileSync('record.json', JSON.stringify(record, null, 4))
            return JSON.stringify(record)
        } else {
            const file = fs.readFileSync('record.json', { encoding: 'utf8', flag: 'r' })
            return file.toString()
        }
    }
    private save_log = (socket:ws.WebSocket, log:string) => {
        fs.writeFileSync('log.json', log)
    }
    private load_log = (socket:ws.WebSocket) => {
        const exist = fs.existsSync('log.json');
        messager_log(`[事件] 讀取 log.js, 檔案存在: ${exist}`)
        if(!exist){
            const record:Log = {
                logs: []
            }
            fs.writeFileSync('log.json', JSON.stringify(record, null, 4))
            return JSON.stringify(record)
        } else {
            const file = fs.readFileSync('log.json', { encoding: 'utf8', flag: 'r' })
            return file.toString()
        }
    }
    private save_lib = (socket:ws.WebSocket, log:string) => {
        fs.writeFileSync('lib.json', log)
    }
    private load_lib = (socket:ws.WebSocket) => {
        const exist = fs.existsSync('log.json');
        messager_log(`[事件] 讀取 lib.js, 檔案存在: ${exist}`)
        if(!exist){
            const record:Libraries = {
                libs: []
            }
            fs.writeFileSync('lib.json', JSON.stringify(record, null, 4))
            return JSON.stringify(record)
        } else {
            const file = fs.readFileSync('lib.json', { encoding: 'utf8', flag: 'r' })
            return file.toString()
        }
    }
    private save_preference = (socket:ws.WebSocket, preference:string) => {
        fs.writeFileSync('preference.json', preference)
    }
    private load_preference = (socket:ws.WebSocket) => {
        const exist = fs.existsSync('preference.json');
        messager_log(`[事件] 讀取 preference.js, 檔案存在: ${exist}`)
        if(!exist){
            const record:Preference = {
                lan: 'en'
            }
            fs.writeFileSync('preference.json', JSON.stringify(record, null, 4))
            i18n.global.locale = 'en'
            //setupMenu()
            return JSON.stringify(record)
        } else {
            const file = fs.readFileSync('preference.json', { encoding: 'utf8', flag: 'r' })
            return file.toString()
        }
    }
    private import_project = (socket:ws.WebSocket) => {
        this.ImportProject()
    }
    private export_projects = (socket:ws.WebSocket, data:string) => {
        const p:Array<Project> = JSON.parse(data)
        this.ExportProjects(p)
    }
    private export_project = (socket:ws.WebSocket, data:string) => {
        const p:Project = JSON.parse(data)
        this.ExportProject(p)
    }
    private locate = (socket:ws.WebSocket, data:string) => {
        // @ts-ignore
        i18n.global.locale = data
    }

    PortAvailable = async (start:number) => {
        let port_result = start
        let canbeuse = false

        while(!canbeuse){
            await tcpPortUsed.check(port_result).then(x => {
                canbeuse = !x
            }).catch(err => {
                canbeuse = true
            })
            if(!canbeuse) port_result += 1
        }

        return port_result
    }
    
    ImportProject = () => {
        
    }
    
    ExportProject = (value:Project) => {
        
    }
    
    ExportProjects = (value:Array<Project>) => {
        
    }

    Boradcasting = (name:string, data:any) => {
        const d:Header = {
            name: name,
            data: data
        }
        this.manager.forEach(x => {
            x.send(JSON.stringify(d))
        })
    }
    //#endregion
}


export const backendEvent = new BackendEvent()
