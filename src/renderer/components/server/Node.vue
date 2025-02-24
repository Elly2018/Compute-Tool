<script setup lang="ts">
import { Emitter } from 'mitt';
import { inject, onMounted, onUnmounted, Ref, ref } from 'vue';
import { BusType, ConnectionText, NodeTable } from '../../interface';
import { isElectron } from '../../main';
import { i18n } from '../../plugins/i18n';
import { WebsocketManager } from '../../script/socket_manager';

const emitter:Emitter<BusType> | undefined = inject('emitter');

interface PROPS {
    nodes: Array<NodeTable>
    manager: WebsocketManager | undefined
}

const props = defineProps<PROPS>()
const connectionModal = ref(false)
const connectionData = ref({url: ''})
const fields:Ref<Array<string>> = ref([])
const hasSelect = ref(false)

const serverUpdate = () => {
    props.manager?.server_update()
}

const createNode = () => {
    connectionData.value = {url: '127.0.0.1:12080'}
    connectionModal.value = true
}

const deleteNode = () => {
    props.nodes.filter(x => x.s).map(x => x.ID).forEach(x => {
        props.manager?.server_stop(x, '伺服器手動斷線')
        if(!isElectron) return
        window.electronAPI.send('server_stop', x, '伺服器手動斷線')
    })
}

const datachange = (uuid:any, v:boolean) => {
    const index = props.nodes.findIndex(x => x.ID == uuid)
    if(index != -1) props.nodes[index].s = v
    hasSelect.value = props.nodes.filter(x => x.s).length > 0;
}

const confirmConnection = () => {
    connectionModal.value = false
    props.manager?.server_start(`ws://${connectionData.value.url}`)
    connectionData.value = { url: '' }
}

const translate_state = (state:number):string => {
    return i18n.global.t(ConnectionText[state])
}

onMounted(() => {
    fields.value = ['ID', 'url', 'state']
    emitter?.on('updateHandle', serverUpdate)
})

onUnmounted(() => {
    emitter?.off('updateHandle', serverUpdate)
})

</script>

<template>
    <div>
        <div class="py-3">
            <b-button-group>
                <b-button variant='primary' @click="createNode">{{ $t('create') }}</b-button>
                <b-button variant='danger' @click="deleteNode" :disabled="!hasSelect">{{ $t('delete') }}</b-button>
            </b-button-group>
        </div>
        <b-table dark striped hover :items="nodes" :fields="fields">
            <template #cell(ID)="data">
                <b-form-checkbox style="float:left;" v-model="data.s" @change="(v: boolean) => datachange(data.item.ID, v)">{{ data.item.ID }}</b-form-checkbox>
            </template>
            <template #cell(state)="data">
                <p>{{ translate_state(data.item.state) }}</p>
            </template>
        </b-table>
        <b-modal :title="$t('modal.new-node')" v-model="connectionModal" hide-footer class="text-white" header-bg-variant="dark" header-text-variant="light" body-bg-variant="dark" body-text-variant="light" footer-text-variant="dark" footer-body-variant="light">
            <b-form-input v-model="connectionData.url" required :placeholder="$t('modal.enter-node-address')"></b-form-input>
            <b-button class="mt-3" variant="primary" @click="confirmConnection">{{ $t('create') }}</b-button>
        </b-modal>
    </div>
</template>

<style scoped>

</style>
