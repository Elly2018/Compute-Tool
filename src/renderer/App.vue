<script setup lang="ts">
import { Emitter } from 'mitt';
import { computed, inject, onMounted, onUnmounted, Ref, ref } from 'vue';
import ClientNode from './components/ClientNode.vue';
import Messager from './components/Messager.vue';
import ServerClientSelection from './components/ServerClientSelection.vue';
import ServerNode from './components/ServerNode.vue';
import SettingDialog from './components/dialog/SettingDialog.vue';
import { messager_log } from './debugger';
import { BusType, Preference } from './interface';
import { i18n } from './plugins/i18n';
import { BackendProxy } from './proxy';
import { ConsoleManager } from './script/console_manager';

const emitter:Emitter<BusType> | undefined = inject('emitter');
const preference:Ref<Preference> = ref({
  lan: 'en',
  log: false,
  font: 16,
})
const backend:Ref<BackendProxy> = ref(new BackendProxy())
const config = computed(() => backend.value.config)

const mode = ref(config.value.isElectron ? -1 : 1)
const settingModal = ref(false)

backend.value.init().then(() => {
  console.log("isElectron", config.value.isElectron)
  console.log("isExpress", config.value.isExpress)
  if (config.value.isElectron) window.electronAPI.send('message', 'Welcome Compute Tool');
})

const modeSelect = (isclient:boolean) => {
  mode.value = isclient ? 0 : 1
}

const locate = (v:string) => {
  const t = i18n.global
  // @ts-ignore
  t.locale = v
  preference.value.lan = v
  emitter?.emit('updateLocate')
  if(config.value.isElectron){
    window.electronAPI.send('save_preference', JSON.stringify(preference.value, null, 4))
  }
}

const setting = () => {
  settingModal.value = true
}

const preferenceUpdate = (data:Preference) => {
  Object.assign(preference.value, data)
  locate(preference.value.lan)
}

const load_preference = (x:string) => {
  preference.value = JSON.parse(x)
  console.log("lan: ", preference.value)
  window.electronAPI.send('locate', preference.value.lan)
  const t = i18n.global
  // @ts-ignore
  t.locale = preference.value.lan
}

onMounted(() => {
  emitter?.on('modeSelect', modeSelect)
  backend.value.wait_init().then(() => {
    backend.value.consoleM = new ConsoleManager(`${window.location.protocol}://${window.location.host}`, messager_log, {
      on: emitter!.on,
      off: emitter!.off,
      emit: emitter!.emit
    })
    
    if(config.value.isElectron){
      backend.value.eventOn('locate', locate)
      backend.value.eventOn('setting', setting)
      backend.value.invoke('load_preference').then(x => load_preference(x))
    }
  })
  
})

onUnmounted(() => {
  emitter?.on('modeSelect', modeSelect)
  backend.value.eventOff('locate', locate)
  backend.value.eventOff('setting', setting)
})

</script>

<template>
  <v-container fluid class="ma-0 pa-0" :style="{ 'fontSize': preference.font + 'px' }">
    <ServerClientSelection v-model.number="mode" v-if="mode == -1" :preference="preference" :config="config"/>
    <ClientNode v-else-if="mode == 0" :preference="preference" :backend="backend"/>
    <ServerNode v-else-if="mode == 1" :preference="preference" :backend="backend"/>
    <Messager :preference="preference" />
    <SettingDialog v-model="settingModal" :item="preference" @update="preferenceUpdate" />
  </v-container>
</template>