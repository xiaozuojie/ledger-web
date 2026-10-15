<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as api from '../api/ledgerApi.js'

const route = useRoute()
const router = useRouter()
const err = ref('')
const name = ref('')
const fields = ref([])
const settlement = ref({})
const types = ['text', 'number', 'truck', 'date', 'work_groups']

onMounted(async () => {
  try {
    const t = await api.getTemplate(route.query.id)
    name.value = t.name
    fields.value = (t.fields || []).map((f) => ({ ...f }))
    settlement.value = { ...(t.settlement || {}) }
  } catch (e) {
    err.value = e.message
  }
})

function addField() {
  fields.value.push({
    key: `f_${Date.now()}`,
    label: '新字段',
    type: 'text',
    required: false
  })
}

async function save() {
  err.value = ''
  try {
    await api.updateTemplate({
      id: route.query.id,
      name: name.value,
      fields: fields.value,
      settlement: settlement.value
    })
    router.push({ name: 'templates' })
  } catch (e) {
    err.value = e.message
  }
}
</script>

<template>
  <div class="topbar">
    <h2 style="margin: 0">编辑模板</h2>
    <button class="btn btn-ghost" type="button" @click="router.push({ name: 'templates' })">
      返回
    </button>
  </div>
  <p v-if="err" class="err">{{ err }}</p>
  <div class="card">
    <label>名称</label>
    <input v-model="name" />
    <label>结算 kind</label>
    <select v-model="settlement.kind">
      <option value="labor">labor 工时</option>
      <option value="mixed">mixed 综合</option>
    </select>
  </div>
  <div v-for="(f, idx) in fields" :key="idx" class="card">
    <label>key</label>
    <input v-model="f.key" />
    <label>标签</label>
    <input v-model="f.label" />
    <label>类型</label>
    <select v-model="f.type">
      <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
    </select>
    <label class="row">
      <input v-model="f.required" type="checkbox" style="width: auto" />
      必填
    </label>
    <button class="linkish" type="button" @click="fields.splice(idx, 1)">删除字段</button>
  </div>
  <button class="btn btn-ghost" type="button" @click="addField">+ 字段</button>
  <button class="btn btn-primary" type="button" style="margin-left: 8px" @click="save">
    保存
  </button>
</template>
