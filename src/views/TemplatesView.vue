<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api/ledgerApi.js'
import { ledgerHomeRoute } from '../router.js'

const router = useRouter()
const list = ref([])
const err = ref('')

async function refresh() {
  err.value = ''
  try {
    list.value = await api.listTemplates()
  } catch (e) {
    err.value = e.message
  }
}

onMounted(refresh)

async function cloneTpl(t) {
  const name = prompt('副本名称', `${t.name} 副本`)
  if (name == null) return
  try {
    const res = await api.cloneTemplate(t.id, name)
    await refresh()
    router.push({ name: 'template-edit', query: { id: res.id } })
  } catch (e) {
    err.value = e.message
  }
}
</script>

<template>
  <header class="topbar">
    <div><h2>模板</h2></div>
    <div class="actions" style="grid-template-columns: 1fr">
      <button class="btn btn-ghost" type="button" @click="router.push(ledgerHomeRoute())">
        返回账本
      </button>
    </div>
  </header>
  <p v-if="err" class="err">{{ err }}</p>
  <div v-for="t in list" :key="t.id" class="card">
    <div class="title" style="font-weight: 700; margin-bottom: 4px">{{ t.name }}</div>
    <div class="muted" style="margin-bottom: 12px">
      <span class="chip">{{ t.builtin ? '内置' : '自定义' }}</span>
      {{ t.settlement?.kind }}
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost" type="button" @click="cloneTpl(t)">复制</button>
      <button
        v-if="!t.builtin"
        class="btn btn-primary"
        type="button"
        @click="router.push({ name: 'template-edit', query: { id: t.id } })"
      >
        编辑
      </button>
      <button
        v-else
        class="btn btn-ghost"
        type="button"
        disabled
        style="opacity: 0.5"
      >
        内置只读
      </button>
    </div>
  </div>
</template>
