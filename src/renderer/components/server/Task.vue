<script setup lang="ts">
import { Emitter } from 'mitt';
import { computed, inject, nextTick, onMounted, onUnmounted, Ref, ref } from 'vue';
import { BusType, DataType, Preference, Project, Task } from '../../interface';
import { i18n } from '../../plugins/i18n';
import { CreateField, DATA, Util_Task } from '../../util/Task';
import TaskDialog from '../dialog/TaskDialog.vue';

const emitter:Emitter<BusType> | undefined = inject('emitter');

interface PROPS {
    preference: Preference
    projects: Array<Project>
    select: Project | undefined
}

const props = defineProps<PROPS>()
const emits = defineEmits<{
    (e: 'added', task:Task[]): void
    (e: 'edit', uuid:string, task:Task): void
    (e: 'delete', uuids:Array<string>): void
    (e: 'select', uuids:string): void
    (e: 'parameter'):void
    (e: 'moveup', uuids:string): void
    (e: 'movedown', uuids:string): void
}>()
const data:Ref<DATA> = ref({
    fields: [],
    dialogModal: false,
    isEdit: false,
    editData: {cronjob: false, cronjobKey: "", title: "", description: "", multi: false, multiKey: ""},
    editUUID: '',
    deleteModal: false,
    deleteData: [],
    items: [],
    para_keys: [],
    errorMessage: '',
    titleError: false,
    search: '',
    selection: []
})

const util:Util_Task = new Util_Task(data, () => props.select)

const realSearch = computed(() => data.value.search.trimStart().trimEnd())
const items_final = computed(() => {
    return realSearch.value == null || realSearch.value.length == 0 ? data.value.items : data.value.items.filter(x => x.title.includes(realSearch.value) || x.ID.includes(realSearch.value))
})
const hasSelect = computed(() => data.value.selection.length > 0)
const selected_task_ids = computed(() => data.value.items.filter(x => data.value.selection.includes(x.ID)).map(x => x.ID))

const updateTask = () => util.updateTask()
const updateParameter = () => util.updateParameter()
const createProject = () => util.createProject()
const detailOpen = () => emits('parameter')

const cloneSelect = () => {
    const ts = util.cloneSelect()
    if(ts == undefined) return
    emits('added', ts)
    nextTick(() => {
        updateTask();
    })
}

const selectall = () => data.value.selection = data.value.items.map(x => x.ID)

const deleteSelect = () => {
    data.value.deleteData = selected_task_ids.value
    data.value.deleteModal = true
}

const deleteConfirm = () => {
    data.value.deleteModal = false
    emits('delete', data.value.deleteData)
    nextTick(() => {
        updateTask()
    })
}

const datachoose = (uuid:string) => emits('select', uuid)

const dataedit = (uuid:string) => {
    if(props.select == undefined) return
    const selectp = props.select.task.find(x => x.uuid == uuid)
    if(selectp == undefined) return;
    data.value.editData = {
        cronjob: selectp.cronjob, 
        cronjobKey: selectp.cronjobKey, 
        title: selectp.title, 
        description: selectp.description, 
        multi: selectp.multi, 
        multiKey: selectp.multiKey
    };
    data.value.dialogModal = true;
    data.value.isEdit = true
    data.value.editUUID = uuid;
    data.value.errorMessage = ''
    data.value.titleError = false
}

const DialogSubmit = (p:CreateField) => {
    data.value.editData = p
    if(data.value.isEdit) confirmEdit()
    else confirmCreate()
}
const confirmCreate = () => {
    const p = util.confirmCreate()
    if(p == undefined) return
    emits('added', p)
    nextTick(() => {
        updateTask();
        data.value.editData = {cronjob: false, cronjobKey: "", title: "", description: "", multi: false, multiKey: ""};
    })
}

const confirmEdit = () => {
    const p = util.confirmEdit()
    if(p == undefined) return
    emits('edit', data.value.editUUID, p)
    nextTick(() => {
        updateTask()
    })
}

const moveup = (uuid:string) => {
    emits('moveup', uuid)
    nextTick(() => {
        updateTask();
    })
}

const movedown = (uuid:string) => {
    emits('movedown', uuid)
    nextTick(() => {
        updateTask();
    })
}

const isFirst = (uuid:string) => util.isFirst(uuid)
const isLast = (uuid:string) => util.isLast(uuid)

const updateFields = () => {
    data.value.fields = [
        { title: 'ID', align: 'center', key: 'ID' },
        { title: i18n.global.t('headers.title'), align: 'center', key: 'title' },
        { title: i18n.global.t('headers.description'), align: 'center', key: 'description' },
        { title: i18n.global.t('headers.cronjob'), align: 'center', key: 'cronjob' },
        { title: i18n.global.t('headers.multi'), align: 'center', key: 'multi' },
        { title: i18n.global.t('headers.job-count'), align: 'center', key: 'jobCount' },
        { title: i18n.global.t('headers.detail'), align: 'center', key: 'detail' },
    ]
}

const updateLocate = () => {
    updateFields()
}

onMounted(() => {
    updateFields()
    emitter?.on('updateTask', updateTask)
    emitter?.on('updateParameter', updateParameter)
    emitter?.on('updateLocate', updateLocate)
    data.value.para_keys = props.select?.parameter.containers.filter(x => x.type == DataType.Number).map(x => x.name) ?? []
})

onUnmounted(() => {
    emitter?.off('updateTask', updateTask)
    emitter?.off('updateParameter', updateParameter)
    emitter?.off('updateLocate', updateLocate)
})

</script>

<template>
    <div>
        <div class="py-3">
            <v-toolbar density="compact" class="pr-3">
                <v-text-field :style="{ 'fontSize': props.preference.font + 'px' }" max-width="400px" class="pl-5 mr-5" :placeholder="$t('search')" clearable density="compact" prepend-icon="mdi-magnify" hide-details single-line v-model="data.search"></v-text-field>
                <p v-if="props.select != undefined" class="mr-4">
                    {{ $t('project') }}: {{ props.select.title }}
                </p>
                <v-chip v-if="props.select != undefined" prepend-icon="mdi-pen" @click="detailOpen" color="success">
                    {{ $t('parameter-setting') }}
                </v-chip>
                <v-spacer></v-spacer>
                <v-tooltip location="bottom">
                    <template v-slot:activator="{ props }">
                        <v-btn icon v-bind="props" @click="createProject" :disabled="select == undefined">
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
                        <v-btn icon v-bind="props" @click="cloneSelect" :disabled="!hasSelect || select == undefined">
                            <v-icon>mdi-content-paste</v-icon>
                        </v-btn>
                    </template>
                    {{ $t('clone') }}
                </v-tooltip>         
                <v-tooltip location="bottom">
                    <template v-slot:activator="{ props }">
                        <v-btn icon color='error' v-bind="props" @click="deleteSelect" :disabled="!hasSelect || select == undefined">
                            <v-icon>mdi-delete</v-icon>
                        </v-btn>
                    </template>
                    {{ $t('delete') }}
                </v-tooltip> 
            </v-toolbar>
        </div>
        <div class="py-3">
            <v-data-table :headers="data.fields" :items="items_final" show-select v-model="data.selection" item-value="ID" :style="{ 'fontSize': props.preference.font + 'px' }">
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
                    <v-btn flat icon :disabled="isFirst(item.ID)" @click="moveup(item.ID)" size="small">
                        <v-icon>mdi-arrow-up</v-icon>
                    </v-btn>
                    <v-btn flat icon :disabled="isLast(item.ID)" @click="movedown(item.ID)" size="small">
                        <v-icon>mdi-arrow-down</v-icon>
                    </v-btn>
                </template>
                <template v-slot:item.cronjob="{ item }">
                    <v-chip :color="item.cronjob ? 'success' : 'error'">{{ item.cronjob }}</v-chip>
                </template>
                <template v-slot:item.multi="{ item }">
                    <v-chip :color="item.multi ? 'success' : 'error'">{{ item.multi }}</v-chip>
                </template>
            </v-data-table>
        </div>
        <TaskDialog v-model="data.dialogModal" 
            :para_keys="data.para_keys"
            :is-edit="data.isEdit" 
            :error-message="data.errorMessage"
            :title-error="data.titleError"
            :edit-data="data.editData" 
            @submit="DialogSubmit" />
        <v-dialog width="500" v-model="data.deleteModal" class="text-white">
            <v-card>
                <v-card-title>
                    <v-icon>mdi-pencil</v-icon>
                    {{ $t('modal.delete-task') }}
                </v-card-title>
                <v-card-text>
                    <p>{{ $t('modal.delete-task-confirm') }}</p>
                    <br />
                    <p v-for="(p, i) in data.deleteData">
                        {{ i }}. {{ p }}
                    </p>
                </v-card-text>
                <template v-slot:actions>
                    <v-btn class="mt-3" color="primary" @click="data.deleteModal = false">{{ $t('cancel') }}</v-btn>
                    <v-btn class="mt-3" color="error" @click="deleteConfirm">{{ $t('delete') }}</v-btn>
                </template>
            </v-card>
        </v-dialog>
    </div>
</template>

<style scoped>
</style>
