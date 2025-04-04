<script setup lang="ts">
import { Emitter } from 'mitt';
import { v6 as uuidv6 } from 'uuid';
import { computed, inject, nextTick, onMounted, onUnmounted, Ref, ref } from 'vue';
import { AppConfig, BusType, Preference, Project, ProjectTable, ProjectTemplate, ProjectTemplateText } from '../../interface';
import { i18n } from '../../plugins/i18n';
import { CreateField, Temp, Util_Project } from '../../util/project';

interface PROPS {
    preference: Preference
    projects: Array<Project>
    config: AppConfig
}

const emitter:Emitter<BusType> | undefined = inject('emitter');

const props = defineProps<PROPS>()
const emits = defineEmits<{
    (e: 'added', project:Project[]): void
    (e: 'edit', uuid:string, project:Project): void
    (e: 'delete', uuids:Array<string>): void
    (e: 'select', uuids:string): void
    (e: 'execute', uuids:Array<string>, force:boolean): void
    (e: 'moveup', uuids:string): void
    (e: 'movedown', uuids:string): void
}>()
const items:Ref<Array<ProjectTable>> = ref([])
const fields:Ref<Array<any>> = ref([
    { title: 'ID', align: 'center', key: 'ID' },
    { title: 'Title', align: 'center', key: 'title' },
    { title: 'Description', align: 'center', key: 'description' },
    { title: 'TaskCount', align: 'center', key: 'taskCount' },
    { title: 'Detail', align: 'center', key: 'detail' },
])
const createModal = ref(false)
const createData:Ref<CreateField> = ref({title: "", description: "", useTemp: false, temp: 0})
const temps:Ref<Array<Temp>> = ref([])
const editModal = ref(false)
const editUUID = ref('')
const deleteModal = ref(false)
const deleteData:Ref<Array<string>> = ref([])
const errorMessage = ref('')
const titleError = ref(false)
const search = ref('')
const selection:Ref<Array<string>> = ref([])

const util:Util_Project = new Util_Project({
    items: items,
    createModal: createModal,
    createData: createData,
    temps: temps,
    editModal: editModal,
    editUUID: editUUID,
    deleteModal: deleteModal,
    deleteData: deleteData,
    errorMessage: errorMessage,
    titleError: titleError,
}, () => props.projects)

const items_final = computed(() => { return search.value == null || search.value.length == 0 ? items.value : items.value.filter(x => x.title.includes(search.value) || x.ID.includes(search.value)) })
const hasSelect = computed(() => selection.value.length > 0)
const selected_project_ids = computed(() => items.value.filter(x => selection.value.includes(x.ID)).map(x => x.ID))

const updateProject = () => {
    items.value = props.projects.map(x => {
        return {
            s: false,
            ID: x.uuid,
            title: x.title,
            description: x.description,
            taskCount: x.task.length
        }
    })
    const allid = items.value.map(x => x.ID)
    selection.value = selection.value.filter(x => allid.includes(x))
}

const recoverProject = (p:Project) => emits('added', [p])
const createProject = () => util.createProject()
const datachoose = (uuid:string) => emits('select', uuid)

const dataedit = (uuid:string) => {
    const selectp = props.projects.find(x => x.uuid == uuid)
    if(selectp == undefined) return;
    createData.value = {title: selectp.title, description: selectp.description, useTemp: false, temp: 0};
    editModal.value = true;
    editUUID.value = uuid;
    errorMessage.value = ''
    titleError.value = false
}

const dataexport = (uuid:string) => {
    if(!props.config.isElectron) return
    const p = props.projects.find(x => x.uuid == uuid)
    if(p != undefined)
    window.electronAPI.send('export_project', JSON.stringify(p))
}

const deleteSelect = () => {
    deleteData.value = selected_project_ids.value
    deleteModal.value = true
}

const deleteConfirm = () => {
    deleteModal.value = false
    emits('delete', deleteData.value)
    nextTick(() => {
        updateProject()
    })
}

const cloneSelect = () => {
    const ps:Array<Project> = props.projects.filter(x => selected_project_ids.value.includes(x.uuid)).map(y => JSON.parse(JSON.stringify(y)))
    ps.forEach(x => {
        x.uuid = uuidv6()
        x.title = x.title + ` (${i18n.global.t('clone')})`
        x.task.forEach(y => {
            y.uuid = uuidv6()
            y.jobs.forEach(z => {
                z.uuid = uuidv6()
            })
        })
    })
    emits('added', ps)
    nextTick(() => {
        updateProject();
    })
}

const selectall = () => {
    selection.value = items.value.map(x => x.ID)
}

const execute = (keep:boolean) => {
    emits('execute', selected_project_ids.value, keep)
}

const confirmCreate = () => {
    const buffer = util.confirmCreate()
    if(buffer == undefined) return
    emits('added', 
        [buffer]
    )
    nextTick(() => {
        updateProject();
    })
}

const confirmEdit = () => {
    const selectp = util.confirmEdit()
    if(selectp == undefined) return
    emits('edit', 
        editUUID.value,
        { 
            uuid: editUUID.value,
            title: createData.value.title, 
            description: createData.value.description,
            parameter: selectp.parameter,
            task: selectp.task
        }
    )
    nextTick(() => {
        updateProject();
    })
}

const moveup = (uuid:string) => {
    emits('moveup', uuid)
    nextTick(() => {
        updateProject();
    })
}

const ProjectTemplateTranslate = (t:number):string => {
    return i18n.global.t(ProjectTemplateText[t])
}

const movedown = (uuid:string) => {
    emits('movedown', uuid)
    nextTick(() => {
        updateProject();
    })
}

const isFirst = (uuid:string) => util.isFirst(uuid)
const isLast = (uuid:string) => util.isLast(uuid)

const updateLocate = () => {
    temps.value = Object.keys(ProjectTemplate).filter(key => isNaN(Number(key))).map((x, index) => {
        return {
            text: ProjectTemplateTranslate(index as ProjectTemplate),
            value: index
        }
    })
}

onMounted(() => {
    updateLocate()
    updateProject()
    emitter?.on('updateProject', updateProject)
    emitter?.on('recoverProject', recoverProject)
    emitter?.on('createProject', createProject)
    emitter?.on('updateLocate', updateLocate)
    if(props.config.isElectron) {
        window.electronAPI.eventOn('createProject', createProject)
    }
})

onUnmounted(() => {
    emitter?.off('updateProject', updateProject)
    emitter?.off('recoverProject', recoverProject)
    emitter?.off('createProject', createProject)
    emitter?.off('updateLocate', updateLocate)
    if(props.config.isElectron) {
        window.electronAPI.eventOff('createProject', createProject)
    }
})

</script>

<template>
    <div>
        <div class="py-3">
            <v-toolbar density="compact" class="pr-3">
                <v-text-field :style="{ 'fontSize': props.preference.font + 'px' }" max-width="400px" class="pl-5" :placeholder="$t('search')" clearable density="compact" prepend-icon="mdi-magnify" hide-details single-line v-model="search"></v-text-field>
                <v-spacer></v-spacer>
                <v-tooltip location="bottom">
                    <template v-slot:activator="{ props }">
                        <v-btn icon v-bind="props" @click="execute(true)" :disabled="!hasSelect">
                            <v-icon>mdi-play-outline</v-icon>
                        </v-btn>
                    </template>
                    {{ $t('execute-keep') }}
                </v-tooltip>
                <v-tooltip location="bottom">
                    <template v-slot:activator="{ props }">
                        <v-btn icon v-bind="props" @click="execute(false)" :disabled="!hasSelect">
                            <v-icon>mdi-play</v-icon>
                        </v-btn>
                    </template>
                    {{ $t('execute') }}
                </v-tooltip>
                <v-tooltip location="bottom">
                    <template v-slot:activator="{ props }">
                        <v-btn icon v-bind="props" @click="createProject">
                            <v-icon>mdi-plus</v-icon>
                        </v-btn>
                    </template>
                    {{ $t('create') }}
                </v-tooltip>
                <v-tooltip location="bottom">
                    <template v-slot:activator="{ props }">
                        <v-btn icon v-bind="props" @click="selectall">
                            <v-icon>mdi-check-all</v-icon>
                        </v-btn>
                    </template>
                    {{ $t('selectall') }}
                </v-tooltip>    
                <v-tooltip location="bottom">
                    <template v-slot:activator="{ props }">
                        <v-btn icon v-bind="props" @click="cloneSelect" :disabled="!hasSelect">
                            <v-icon>mdi-content-paste</v-icon>
                        </v-btn>
                    </template>
                    {{ $t('clone') }}
                </v-tooltip>         
                <v-tooltip location="bottom">
                    <template v-slot:activator="{ props }">
                        <v-btn icon color='error' v-bind="props" @click="deleteSelect" :disabled="!hasSelect">
                            <v-icon>mdi-delete</v-icon>
                        </v-btn>
                    </template>
                    {{ $t('delete') }}
                </v-tooltip> 
            </v-toolbar>
        </div>
        <div class="pt-3">
            <v-data-table :headers="fields" :items="items_final" show-select v-model="selection" item-value="ID" :style="{ 'fontSize': props.preference.font + 'px' }">
                <template v-slot:item.ID="{ item }">
                    <a href="#" @click="datachoose(item.ID)">{{ item.ID }}</a>
                </template>
                <template v-slot:item.detail="{ item }">
                    <v-btn flat icon @click="datachoose(item.ID)" size="small">
                        <v-icon>mdi-location-enter</v-icon>
                    </v-btn>
                    <v-btn flat icon @click="dataedit(item.ID)" size="small">
                        <v-icon>mdi-pencil</v-icon>
                    </v-btn>
                    <v-btn flat icon @click="dataexport(item.ID)" size="small">
                        <v-icon>mdi-export</v-icon>
                    </v-btn>
                    <v-btn flat icon :disabled="isFirst(item.ID)" @click="moveup(item.ID)" size="small">
                        <v-icon>mdi-arrow-up</v-icon>
                    </v-btn>
                    <v-btn flat icon :disabled="isLast(item.ID)" @click="movedown(item.ID)" size="small">
                        <v-icon>mdi-arrow-down</v-icon>
                    </v-btn>
                </template>
            </v-data-table>
        </div>
        <v-dialog width="500" v-model="createModal" class="text-white">
            <v-card>
                <v-card-title>
                    <v-icon>mdi-hammer</v-icon>
                    {{ $t('modal.new-project') }}
                </v-card-title>
                <v-card-text>
                    <v-text-field :error="titleError" v-model="createData.title" required :label="$t('modal.enter-project-name')" hide-details></v-text-field>
                    <v-text-field class="mt-3" v-model="createData.description" :label="$t('modal.enter-project-description')" hide-details></v-text-field>
                    <br />
                    <v-checkbox v-model="createData.useTemp" hide-details :label="$t('useTemplate')"></v-checkbox>
                    <v-select v-if="createData.useTemp" v-model="createData.temp" :items="temps" item-title="text" hide-details></v-select>
                    <p v-if="errorMessage.length > 0" class="mt-3 text-red">{{ errorMessage }}</p>
                </v-card-text>
                <template v-slot:actions>
                    <v-btn class="mt-3" color="primary" @click="confirmCreate">{{ $t('create') }}</v-btn>
                </template>
            </v-card>
        </v-dialog>
        <v-dialog width="500" v-model="editModal" class="text-white">
            <v-card>
                <v-card-title>
                    <v-icon>mdi-pencil</v-icon>
                    {{ $t('modal.modify-project') }}
                </v-card-title>
                <v-card-text>
                    <v-text-field :error="titleError" v-model="createData.title" required :label="$t('modal.enter-project-name')" hide-details></v-text-field>
                    <v-text-field class="mt-3" v-model="createData.description" :label="$t('modal.enter-project-description')" hide-details></v-text-field>
                    <p v-if="errorMessage.length > 0" class="mt-3 text-red">{{ errorMessage }}</p>
                </v-card-text>
                <template v-slot:actions>
                    <v-btn class="mt-3" color="primary" @click="confirmEdit">{{ $t('modify') }}</v-btn>
                </template>
            </v-card>
        </v-dialog>
        <v-dialog width="500" v-model="deleteModal" class="text-white">
            <v-card>
                <v-card-title>
                    <v-icon>mdi-pencil</v-icon>
                    {{ $t('modal.delete-project') }}
                </v-card-title>
                <v-card-text>
                    <p>{{ $t('modal.delete-project-confirm') }}</p>
                    <br />
                    <p v-for="(p, i) in deleteData">
                        {{ i }}. {{ p }}
                    </p>
                </v-card-text>
                <template v-slot:actions>
                    <v-btn class="mt-3" color="primary" @click="deleteModal = false">{{ $t('cancel') }}</v-btn>
                    <v-btn class="mt-3" color="error" @click="deleteConfirm">{{ $t('delete') }}</v-btn>
                </template>
            </v-card>
        </v-dialog>
    </div>
</template>

<style>

</style>
