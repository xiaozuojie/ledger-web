<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as api from '../api/ledgerApi.js'
import { ledgerHomeRoute } from '../router.js'

const route = useRoute()
const router = useRouter()
const err = ref('')
const date = ref('')
const groups = ref([{ people: '', days: '' }])
const useOverride = ref(false)
const overrideTotal = ref('')
const autoTotal = computed(() =>
  groups.value.reduce((s, g) => s + (Number(g.people) || 0) * (Number(g.days) || 0), 0)
)
const trucks = ref('')
const laborNote = ref('')
const laborNoteTouched = ref(false)
const extraName = ref('')
const extraAmount = ref('')
const kind = computed(() => route.query.kind || 'mixed')
const entryId = computed(() => route.query.id || '')

function today() {
  const d = new Date()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

onMounted(async () => {
  date.value = today()
  if (!entryId.value) return
  try {
    const list = await api.listEntries()
    const row = list.find((e) => e.id === entryId.value)
    if (!row) {
      err.value = '明细不存在'
      return
    }
    date.value = row.date
    groups.value =
      row.groups && row.groups.length
        ? row.groups.map((g) => ({
            people: String(g.people ?? ''),
            days: String(g.days ?? '')
          }))
        : [{ people: '', days: '' }]
    if (row.overrideTotal != null) {
      useOverride.value = true
      overrideTotal.value = String(row.overrideTotal)
    }
    trucks.value = (row.fields && row.fields.trucks) || ''
    laborNote.value = (row.fields && row.fields.laborNote) || ''
  } catch (e) {
    err.value = e.message
  }
})

function buildLaborNote(gs, workDays) {
  const parts = gs
    .filter((g) => Number(g.people) || Number(g.days))
    .map((g) => `${Number(g.people) || 0}人${Number(g.days) || 0}天`)
  if (!parts.length) return ''
  return `${parts.join(', ')}, 合计${workDays}天`
}

async function save() {
  err.value = ''
  const mapped = groups.value.map((g) => ({
    people: Number(g.people) || 0,
    days: Number(g.days) || 0
  }))
  const workDays = useOverride.value ? Number(overrideTotal.value) || 0 : autoTotal.value
  let note = laborNote.value
  if (!laborNoteTouched.value) {
    note = buildLaborNote(mapped, workDays) || note
  }
  const fields =
    kind.value === 'mixed'
      ? { trucks: trucks.value, laborNote: note }
      : { laborNote: note }
  try {
    await api.upsertEntry({
      id: entryId.value || null,
      date: date.value,
      groups: mapped,
      overrideTotal: useOverride.value ? Number(overrideTotal.value) : null,
      fields,
      summary: note
    })
    router.push(ledgerHomeRoute())
  } catch (e) {
    err.value = e.message
  }
}

async function remove() {
  if (!entryId.value) return
  if (!confirm('删除该行？')) return
  try {
    await api.removeEntry(entryId.value)
    router.push(ledgerHomeRoute())
  } catch (e) {
    err.value = e.message
  }
}

async function addExtra() {
  try {
    await api.addExtra(extraName.value, extraAmount.value)
    extraName.value = ''
    extraAmount.value = ''
    alert('已加入零星')
  } catch (e) {
    err.value = e.message
  }
}
</script>

<template>
  <header class="topbar">
    <div>
      <h2>{{ entryId ? '编辑明细' : '新建明细' }}</h2>
    </div>
    <div class="actions" style="grid-template-columns: 1fr">
      <button class="btn btn-ghost" type="button" @click="router.push(ledgerHomeRoute())">
        返回账本
      </button>
    </div>
  </header>
  <p v-if="err" class="err">{{ err }}</p>
  <div class="card">
    <label>日期</label>
    <input v-model="date" type="date" />
    <template v-if="kind === 'mixed'">
      <label>渣土车数</label>
      <input v-model="trucks" placeholder="如 2车 或 1车渣土1车泡沫" />
    </template>
    <label>工时分组</label>
    <div v-for="(g, idx) in groups" :key="idx" class="row" style="margin-bottom: 8px">
      <input
        v-model="g.people"
        type="number"
        inputmode="decimal"
        placeholder="人数"
        style="flex: 1; margin: 0"
      />
      <span>×</span>
      <input
        v-model="g.days"
        type="number"
        inputmode="decimal"
        placeholder="天数"
        style="flex: 1; margin: 0"
      />
      <button
        class="linkish"
        type="button"
        @click="groups.length > 1 && groups.splice(idx, 1)"
      >
        删
      </button>
    </div>
    <button
      class="btn btn-ghost btn-block"
      type="button"
      @click="groups.push({ people: '', days: '' })"
    >
      ＋ 再加一组
    </button>
    <p style="margin: 12px 0 0">
      自动合计：<strong>{{ autoTotal }}</strong>
    </p>
    <label class="row" style="margin-top: 12px">
      <input v-model="useOverride" type="checkbox" style="width: auto; min-height: auto" />
      手工改合计
    </label>
    <input
      v-if="useOverride"
      v-model="overrideTotal"
      type="number"
      inputmode="decimal"
    />
    <label>做卫生人工记录 / 备注</label>
    <input
      v-model="laborNote"
      placeholder="可自动生成"
      @input="laborNoteTouched = true"
    />
  </div>
  <div class="card">
    <h3>收成零星</h3>
    <p class="muted" style="margin-top: -6px">固定金额，不计入人天</p>
    <label>名称</label>
    <input v-model="extraName" placeholder="如 门口做卫生" />
    <label>金额</label>
    <input v-model="extraAmount" type="number" inputmode="decimal" placeholder="0" />
    <button class="btn btn-ghost btn-block" type="button" @click="addExtra">
      加入零星
    </button>
  </div>
  <div class="btn-row">
    <button
      v-if="entryId"
      class="btn btn-ghost"
      type="button"
      @click="remove"
    >
      删除
    </button>
    <button
      class="btn btn-primary"
      type="button"
      :style="entryId ? '' : 'grid-column: 1 / -1'"
      @click="save"
    >
      保存
    </button>
  </div>
  <div class="fab-space" />
</template>
