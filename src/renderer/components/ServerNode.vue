<script setup lang="ts">
import { IpcRendererEvent } from 'electron';
import { Emitter } from 'mitt';
import { v6 as uuidv6 } from 'uuid';
import { inject, nextTick, onMounted, onUnmounted, Ref, ref } from 'vue';
import { BusType, ExecuteRecord, Job, JobCategory, JobType, JobType2, Libraries, Log, Node, NodeTable, Parameter, Preference, Project, Record, Rename, Task, WebsocketPack } from '../interface';
import { isElectron } from '../main';
import { set_feedback } from '../script/debugger';
import { ExecuteManager } from '../script/execute_manager';
import { WebsocketManager } from '../script/socket_manager';
import { i18n } from './../plugins/i18n';
import ConsolePage from './server/Console.vue';
import JobPage from './server/Job.vue';
import LibraryPage from './server/Library.vue';
import LogPage from './server/Log.vue';
import NodePage from './server/Node.vue';
import ParameterPage from './server/Parameter.vue';
import ProjectPage from './server/Project.vue';
import TaskPage from './server/Task.vue';

const websocket_manager:Ref<WebsocketManager | undefined> = ref(undefined)
const execute_manager:Ref<ExecuteManager | undefined> = ref(undefined)
  
const emitter:Emitter<BusType> | undefined = inject('emitter');
let updateHandle:any = undefined

interface PROPS {
    preference: Preference
}

const props = defineProps<PROPS>()
const page = ref(0)
const lan = ref(['en', 'zh_tw'])
const lanSelect = ref(i18n.global.locale as string)

const projects:Ref<Array<Project>> = ref([])
const projects_exe:Ref<ExecuteRecord>  = ref({
  projects: [],
  nodes: [],
  running: false,
  stop: true,
  project: "",
  task: "",
  project_index: -1,
  task_index: -1,
  project_state: [],
  task_state: [],
  task_detail: [],
})
const log:Ref<Log> = ref({logs: []})
const libs:Ref<Libraries> = ref({libs: []})
const selectProject:Ref<Project | undefined> = ref(undefined)
const selectTask:Ref<Task | undefined> = ref(undefined)
const nodes:Ref<Array<NodeTable>> = ref([])

const allUpdate = () => {
  nextTick(() => {
    emitter?.emit('updateProject')
    emitter?.emit('updateTask')
    emitter?.emit('updateJob')
    emitter?.emit('updateParameter')
  })
}

const saveRecord = ():Record => {
  const record:Record = {
    projects: projects.value,
    nodes: nodes.value as Array<Node>
  }
  const k = JSON.stringify(record, null, 4)
  if(isElectron) window.electronAPI.send('save_record', k)
  return record
}

//#region Project
const addProject = (v:Array<Project>) => {
  projects.value.push(...v)
  saveRecord()
  allUpdate()
  page.value = 0
}

const editProject = (id:string, v:Project) => {
  const selectp = projects.value.findIndex(x => x.uuid == id)
  if(selectp == -1) return
  projects.value[selectp] = v
  if(selectProject.value?.uuid == id){
    selectProject.value = v
  }
  saveRecord()
  allUpdate()
}

const deleteProject = (uuids:Array<string>) => {
  uuids.forEach(id => {
    const index = projects.value.findIndex(x => x.uuid == id)
    if(index != -1) {
      projects.value[index].task.forEach(tid => {
        if(selectTask.value?.uuid == tid.uuid){
          selectTask.value = undefined
        }
      })
      projects.value.splice(index, 1)
    }
    if(selectProject.value?.uuid == id){
      selectProject.value = undefined
    }
  })
  saveRecord()
  allUpdate()
}

const chooseProject = (uuid:string) => {
  selectProject.value = projects.value.find(x => x.uuid == uuid)
  page.value = 1
  allUpdate()
}

const moveupProject = (uuid:string) => {
  const index = projects.value.findIndex(x => x.uuid == uuid)
  if(index == -1) return
  const b = projects.value[index - 1]
  projects.value[index - 1] = projects.value[index]
  projects.value[index] = b
  saveRecord()
  allUpdate()
}

const movedownProject = (uuid:string) => {
  const index = projects.value.findIndex(x => x.uuid == uuid)
  if(index == -1) return
  const b = projects.value[index + 1]
  projects.value[index + 1] = projects.value[index]
  projects.value[index] = b
  saveRecord()
  allUpdate()
}

const executeProjects = (uuids:Array<string>, keep:boolean) => {
  const selection = projects.value.filter(x => uuids.includes(x.uuid))
  if(!keep){
    projects.value = projects.value.filter(x => !uuids.includes(x.uuid))
    saveRecord()
    allUpdate()
  }
  const record:Record = {
    projects: selection,
    nodes: nodes.value as Array<Node>
  }
  Object.assign(record, projects_exe.value.projects)
  emitter?.emit('execute', record)
  page.value = 5
}
//#endregion

//#region Task
const addTask = (v:Array<Task>) => {
  if(selectProject.value == undefined) return
  selectProject.value.task.push(...v)
  saveRecord()
  allUpdate()
}

const editTask = (id:string, v:Task) => {
  if(selectProject.value == undefined) return
  const selectt = selectProject.value.task.findIndex(x => x.uuid == id)
  if(selectt == -1) return
  selectProject.value.task[selectt] = v
  if(selectTask.value?.uuid == id){
    selectTask.value = v
  }
  saveRecord()
  allUpdate()
}

const deleteTask = (uuids:Array<string>) => {
  uuids.forEach(id => {
    if(selectProject.value == undefined) return
    const index = selectProject.value.task.findIndex(x => x.uuid == id)
    if(index != -1) selectProject.value.task.splice(index, 1)
    if(selectTask.value?.uuid == id){
      selectTask.value = undefined
    }
  })
  saveRecord()
  allUpdate()
}

const chooseTask = (uuid:string) => {
  selectTask.value = selectProject.value?.task.find(x => x.uuid == uuid)
  page.value = 2
  allUpdate()
}

const moveupTask = (uuid:string) => {
  if(selectProject.value == undefined) return
  const index = selectProject.value.task.findIndex(x => x.uuid == uuid)
  if(index == -1) return
  const b = selectProject.value.task[index - 1]
  selectProject.value.task[index - 1] = selectProject.value.task[index]
  selectProject.value.task[index] = b
  saveRecord()
  allUpdate()
}

const movedownTask = (uuid:string) => {
  if(selectProject.value == undefined) return
  const index = selectProject.value.task.findIndex(x => x.uuid == uuid)
  if(index == -1) return
  const b = selectProject.value.task[index + 1]
  selectProject.value.task[index + 1] = selectProject.value.task[index]
  selectProject.value.task[index] = b
  saveRecord()
  allUpdate()
}
//#endregion

//#region Job
const addJob = (v:Array<Job>) => {
  if(selectTask.value == undefined) return
  selectTask.value.jobs.push(...v)
  saveRecord()
  allUpdate()
}

const editJob = (v:Array<Job>) => {
  if(selectTask.value == undefined) return
  selectTask.value.jobs = v
  saveRecord()
  allUpdate()
}

const deleteJob = (uuids:Array<string>) => {
  uuids.forEach(id => {
    if(selectTask.value == undefined) return
    const index = selectTask.value.jobs.findIndex(x => x.uuid == id)
    if(index != -1) selectTask.value.jobs.splice(index, 1)
    if(selectTask.value?.uuid == id){
      selectTask.value = undefined
    }
  })
  saveRecord()
  allUpdate()
}
//#endregion

//#region Node
const server_clients_update = (v:Array<NodeTable>) => {
    const old:Array<NodeTable> = Object.create(nodes.value)
    nodes.value = v
    old.filter(x => x.s).forEach(x => {
        const index = nodes.value.findIndex(y => y.ID == x.ID)
        if(index != -1){
            nodes.value[index].s = true
        }
    })
    saveRecord()
}
//#endregion

//#region Parameter
const editParameter = (e:Parameter) => {
  if(selectProject.value == undefined) return
  selectProject.value.parameter = e
  saveRecord()
  allUpdate()
}
//#endregion

//#region Lib
const libRename = (d:Rename) => {
  projects.value.forEach(x => {
    x.task.forEach(y => {
      y.jobs.forEach(z => {
        if((z.category == JobCategory.Condition && z.type == JobType2.LUA) || (z.category == JobCategory.Execution && z.type == JobType.LUA)){
          const index = z.string_args.findIndex(x => x == d.oldname)
          if(index != -1) z.string_args[index] = d.newname
        }
      })
    })
  })
  allUpdate()
}

const libDelete = (name:string) => {
  projects.value.forEach(x => {
    x.task.forEach(y => {
      y.jobs.forEach(z => {
        if((z.category == JobCategory.Condition && z.type == JobType2.LUA) || (z.category == JobCategory.Execution && z.type == JobType.LUA)){
          const index = z.string_args.findIndex(x => x == name)
          if(index != -1) z.string_args.splice(index, 1)
        }
      })
    })
  })
  allUpdate()
}
//#endregion

const menuCreateProject = (e:IpcRendererEvent) => {
  page.value = 0
}

const menu_export_project = (e:IpcRendererEvent) => {
  if(isElectron) window.electronAPI.send("export_project", JSON.stringify(projects.value))
}

const import_project_feedback = (e:IpcRendererEvent, text:string) => {
  const ps:Array<Project> = JSON.parse(text)
  for(const p of ps){
    for(const t of p.task){
      for(const j of t.jobs){
        j.uuid = uuidv6()
      }
      t.uuid = uuidv6()
    }
    p.uuid = uuidv6()
  }
  projects.value.push(...ps)
  saveRecord()
  allUpdate()
}

const run_all = (e:IpcRendererEvent) => {
  executeProjects(projects.value.map(x => x.uuid), false)
}

const run_all_keep = (e:IpcRendererEvent) => {
  executeProjects(projects.value.map(x => x.uuid), true)
}

const serverUpdate = () => {
    emitter?.emit('updateHandle')
}

const debug_feedback = (e:string) => {
  emitter?.emit('debuglog', e)
}

const onChangeLan = (e:string) => {
  lanSelect.value = e
  // @ts-ignore
  i18n.global.locale = e
  if(!isElectron) return
  window.electronAPI.send('save_preference', JSON.stringify(props.preference, null, 4))
}

onMounted(() => {
  set_feedback(debug_feedback)
  websocket_manager.value = new WebsocketManager()
  execute_manager.value = new ExecuteManager(websocket_manager.value)
  execute_manager.value.libs = libs
  websocket_manager.value.set_new_connect((x:WebsocketPack) => {
    emitter?.emit('makeToast', {
      title: "連線建立",
      type: 'success',
      message: `建立新的連線: ${x.websocket.url} \n${x.uuid}`
    })
    execute_manager.value!.NewConnection(x)
  })
  websocket_manager.value.set_dc_connect((x:WebsocketPack) => {
    emitter?.emit('makeToast', {
      title: "連線中斷",
      type: 'danger',
      message: `連線中斷偵測: ${x.websocket.url} \n${x.uuid}`
    })
  })
  updateHandle = setInterval(serverUpdate, 1000);
  emitter?.on('updateNode', server_clients_update)
  emitter?.on('renameScript', libRename)
  emitter?.on('deleteScript', libDelete)

  if(!isElectron) return
  window.electronAPI.send('menu', true)
  window.electronAPI.eventOn('createProject', menuCreateProject)
  window.electronAPI.eventOn('menu_export_project', menu_export_project)
  window.electronAPI.eventOn('run_all', run_all)
  window.electronAPI.eventOn('run_all_keep', run_all_keep)
  window.electronAPI.eventOn('import_project_feedback', import_project_feedback)
  window.electronAPI.invoke('load_lib').then(x => {
    libs.value = JSON.parse(x)
  })
  window.electronAPI.invoke('load_record').then(x => {
    const record:Record = JSON.parse(x)
    projects.value = record.projects
    nodes.value = record.nodes.map(x => {
      return Object.assign(x, {
        s: false,
        state: 0,
        connection_rate: 0
      })
    })
    nodes.value.forEach(x => {
      websocket_manager.value?.server_start(x.url)
    })
    nextTick(() => {
      allUpdate()
    })
  })
  window.electronAPI.invoke('load_log').then(x => {
    log.value = JSON.parse(x)
  })
})

onUnmounted(() => {
  emitter?.off('updateNode', server_clients_update)
  emitter?.off('renameScript', libRename)
  emitter?.off('deleteScript', libDelete)
  if(updateHandle != undefined) clearInterval(updateHandle)
  if(!isElectron) return
  window.electronAPI.eventOff('createProject', menuCreateProject)
  window.electronAPI.eventOff('menu_export_project', menu_export_project)
  window.electronAPI.eventOff('run_all', run_all)
  window.electronAPI.eventOff('run_all_keep', run_all_keep)
  window.electronAPI.eventOff('import_project_feedback', import_project_feedback)
})

</script>

<template>
  <v-tabs v-model="page" tabs style="position: fixed; z-index: 1; width: 100vw; height:50px;" class="bg-grey-darken-4">
    <v-tab>{{ $t('toolbar.project') }}</v-tab>
    <v-tab>{{ $t('toolbar.task') }}</v-tab>
    <v-tab>{{ $t('toolbar.job') }}</v-tab>
    <v-tab>{{ $t('toolbar.parameter') }}</v-tab>
    <v-tab>{{ $t('toolbar.node') }}</v-tab>
    <v-tab>{{ $t('toolbar.console') }}</v-tab>
    <v-tab>{{ $t('toolbar.log') }}</v-tab>
    <v-tab>{{ $t('toolbar.library') }}</v-tab>
    <v-menu v-if="!isElectron">
        <template v-slot:activator="{ props }">
          <v-btn class="mt-1" v-bind="props">
            <v-icon class="pr-2" icon="mdi-web"></v-icon>
            {{ lanSelect }}
          </v-btn>
        </template>
        <v-list>
          <v-list-item v-for="(locate, i) in lan" :key="i" :value="locate" @click="onChangeLan(locate)">
            {{ locate }}
          </v-list-item>
        </v-list>
      </v-menu>
  </v-tabs>
  <div style="width: 100vw; height:100vh; padding-top: 50px; background-color: red;" class="bg-grey-darken-4 text-white">
    <ProjectPage v-show="page == 0" 
      :projects="projects" 
      @added="e => addProject(e)" 
      @edit="(id, e) => editProject(id, e)" 
      @select="e => chooseProject(e)" 
      @delete="e => deleteProject(e)"
      @moveup="e => moveupProject(e)"
      @movedown="e => movedownProject(e)" 
      @execute="(e, keep) => executeProjects(e, keep)"/>

    <TaskPage v-show="page == 1" 
      :projects="projects" 
      :select="selectProject" 
      @added="e => addTask(e)" 
      @edit="(id, e) => editTask(id, e)" 
      @select="e => chooseTask(e)"
      @delete="e => deleteTask(e)"
      @moveup="e => moveupTask(e)"
      @movedown="e => movedownTask(e)"
      @parameter="page = 3" />

    <JobPage v-show="page == 2" 
      :projects="projects" 
      :select="selectTask"
      :owner="selectProject"
      :libs="libs"
      @added="e => addJob(e)" 
      @edit="(e) => editJob(e)" 
      @delete="e => deleteJob(e)" />

    <ParameterPage v-show="page == 3" 
      :select="selectProject"
      @edit="e => editParameter(e)" />

    <NodePage v-show="page == 4" 
      :manager="websocket_manager"
      :nodes="nodes" />

    <ConsolePage v-show="page == 5" 
      :socket="websocket_manager"
      :execute="execute_manager"
      :logs="log"
      :libs="libs"
      v-model="projects_exe"/>
      
    <LogPage v-show="page == 6" :logs="log" 
      v-model="projects_exe"/>

    <LibraryPage v-show="page == 7" 
      v-model="libs"/>
  </div>
</template>

<style scoped>

</style>
