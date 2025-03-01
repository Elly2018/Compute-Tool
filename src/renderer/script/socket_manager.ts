import { v6 as uuidv6 } from 'uuid';
import { Header, Node, NodeTable, WebsocketPack } from "../interface";
import { messager_log } from "./debugger";

export class WebsocketManager{

    targets:Array<WebsocketPack> = []
    newConnect:Function | undefined
    disconnect:Function | undefined
    onAnalysis:Function | undefined

    server_start = (url:string) => this.serverconnect(url)
    
    server_stop = (uuid:string, reason?:string) => this.removeByUUID(uuid, reason)

    server_update = ():Array<NodeTable> => this.sendUpdate()

    server_record = (ns:Array<Node>) => {
        ns.forEach(x => {
            this.serverconnect(x.url, x.ID)
        })
    }

    private serverconnect = (url:string, uuid?:string) => {
        if(this.targets.findIndex(x => x.websocket.url.slice(0, -1) == url) != -1) return
        const client = new WebSocket(url)
        const index = this.targets.push({ uuid: uuid == undefined ? uuidv6() : uuid, websocket: client })
        client.onerror = (err:any) => {
            messager_log(`[錯誤事件] 連線失敗 ${url}`)
        }
        client.onclose = (ev) => {
            if(this.targets[index - 1].s != undefined){
                messager_log(`[關閉事件] 客戶端關閉連線, ${ev.code}, ${ev.reason}`)
                if(this.disconnect != undefined) this.disconnect(this.targets[index - 1])
            }
            this.targets[index - 1].s = undefined
            this.targets[index - 1].state = undefined
            this.targets[index - 1].current_job = undefined
        }
        client.onopen = () => {
            messager_log('[連線事件] 新連線狀態建立 !' + client.url)
            if(this.targets[index - 1].s == undefined){
                this.targets[index - 1].s = true
            }
            this.sendUpdate()
            if(this.newConnect != undefined) this.newConnect(this.targets[index - 1])
        }
        client.onmessage = (ev) => {
            const h:Header | undefined = JSON.parse(ev.data.toString());
            const c = this.targets.find(x => x.websocket == client)
            this.analysis(h, c)
        }
        return client
    }

    private analysis = (h:Header | undefined, c:WebsocketPack | undefined) => {
        if (h == undefined){
            messager_log('[來源資料解析] 解析失敗, 得到的值為 undefined')
            return;
        }
        if (h.message != undefined && h.message.length > 0){
            messager_log(`[來源資料解析] ${h.message}`)
        }
        if (h.data == undefined) return
        if(this.onAnalysis != undefined) this.onAnalysis({name: h.name, h: h, c: c})
    }

    private sendUpdate = (): Array<NodeTable> => {
        let result:Array<NodeTable> = []
        const data:Array<Node> = []
        this.targets.forEach(x => {
            if(x.websocket.readyState == WebSocket.CLOSED){
                data.push({ID: x.uuid, url: x.websocket.url})
            }
        })
        data.forEach(d => this.removeByUUID(d.ID))
        data.forEach(d => {
            this.serverconnect(d.url, d.ID)
        })

        result = this.targets.map(x => {
            return {
                ID: x.uuid,
                state: x.websocket.readyState,
                url: x.websocket.url,
                connection_rate: 0
            }
        })

        return result
    }

    private removeByUUID = (uuid:string, reason?:string) => {
        let index = this.targets.findIndex(x => x.uuid == uuid)
        if(index != -1) {
            if(this.targets[index].websocket.readyState == WebSocket.OPEN) this.targets[index].websocket.close(1000, reason != undefined ? reason : '')
                this.targets.splice(index, 1)
        }
    }
}