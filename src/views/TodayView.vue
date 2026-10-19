<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api/ledgerApi.js'
import { rowWorkDays } from '../calc/hours.js'
import { computeMixed, entryExtrasSum } from '../calc/settlement.js'
import { parseTruckCount } from '../calc/trucks.js'
import { todayStr } from '../utils/date.js'
import UndoToast from '../components/UndoToast.vue'
import PanghuTip from '../components/PanghuTip.vue'

const router = useRouter()
const ledger = ref(null)
const entries = ref([])
const extras = ref([])
const err = ref('')
const toastVisible = ref(false)
const toastMsg = ref('')
const pendingDelete = ref(null)
const showExtraForm = ref(false)
const showTypePicker = ref(false)
const extraName = ref('')
const extraAmount = ref('')
const showMore = ref(false)

const today = todayStr()
const monthPrefix = today.slice(0, 7)

const rates = computed(() => ({
  truckUnitPrice: Number(ledger.value?.rates?.truckUnitPrice) || 0,
  laborUnitPrice: Number(ledger.value?.rates?.laborUnitPrice) || 0
}))

const todayEntries = computed(() =>
  entries.value.filter((e) => e.date === today)
)

const monthEntries = computed(() =>
  entries.value.filter((e) => String(e.date).startsWith(monthPrefix))
)

const todayRows = computed(() =>
  todayEntries.value.map((e) => ({
    id: e.id,
    date: e.date,
    trucks: (e.fields && e.fields.trucks) || '',
    laborNote: (e.fields && e.fields.laborNote) || e.summary || '',
    workDays: rowWorkDays(e),
    dayExtras: entryExtrasSum(e),
    truckN: parseTruckCount((e.fields && e.fields.trucks) || ''),
    raw: e
  }))
)

const todayResult = computed(() =>
  computeMixed({
    entries: todayEntries.value,
    rates: rates.value,
    extras: [],
    feeTypes: ledger.value?.feeTypes,
    ledger: ledger.value
  })
)

const monthResult = computed(() =>
  computeMixed({
    entries: monthEntries.value,
    rates: rates.value,
    extras: extras.value,
    feeTypes: ledger.value?.feeTypes,
    ledger: ledger.value
  })
)

const result = computed(() =>
  computeMixed({
    entries: entries.value,
    rates: rates.value,
    extras: extras.value,
    feeTypes: ledger.value?.feeTypes,
    ledger: ledger.value
  })
)

const feeTypes = computed(() =>
  (ledger.value?.feeTypes || []).filter((t) => t.enabled !== false)
)

const dayTruck = computed(() =>
  todayRows.value.reduce((s, r) => s + (r.truckN || 0), 0)
)
const dayLabor = computed(() =>
  todayRows.value.reduce((s, r) => s + (Number(r.workDays) || 0), 0)
)

async function refresh() {
  err.value = ''
  try {
    ledger.value = await api.getLedger()
    entries.value = await api.listEntries()
    extras.value = await api.listExtras()
  } catch (e) {
    err.value = e.message
  }
}

onMounted(refresh)

function addEntry() {
  router.push({ name: 'entry', query: { kind: 'mixed' } })
}
function addTruckEntry() {
  router.push({ name: 'entry', query: { kind: 'mixed', focus: 'trucks' } })
}
function openTypePicker() {
  showTypePicker.value = !showTypePicker.value
  showExtraForm.value = false
}
function pickFeeType(t) {
  showTypePicker.value = false
  if (t.id === 'truck') {
    addTruckEntry()
    return
  }
  if (t.id === 'extra') {
    showExtraForm.value = true
    showMore.value = true
    return
  }
  if (t.id === 'labor' || t.kind === 'work_days') {
    addEntry()
    return
  }
  router.push({
    name: 'entry',
    query: { kind: 'mixed', focus: 'fee', typeId: t.id }
  })
}
function editEntry(id) {
  router.push({ name: 'entry', query: { kind: 'mixed', id } })
}

function openExtraForm() {
  showExtraForm.value = !showExtraForm.value
}

async function addExtra() {
  try {
    await api.addExtra(extraName.value, extraAmount.value)
    extraName.value = ''
    extraAmount.value = ''
    showExtraForm.value = false
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

async function removeExtra(id) {
  try {
    await api.removeExtra(id)
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

function askDelete(row) {
  if (pendingDelete.value) return
  pendingDelete.value = row.raw
  entries.value = entries.value.filter((e) => e.id !== row.id)
  toastMsg.value = '已删除一行'
  toastVisible.value = true
}

async function onExpire() {
  const row = pendingDelete.value
  toastVisible.value = false
  pendingDelete.value = null
  if (!row) return
  try {
    await api.removeEntry(row.id)
  } catch (e) {
    err.value = e.message
    await refresh()
  }
}

function onUndo() {
  const row = pendingDelete.value
  toastVisible.value = false
  pendingDelete.value = null
  if (!row) return
  entries.value = [...entries.value, row].sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  )
}

function flowDotClass(row) {
  if (row.truckN > 0) return 'truck'
  if (row.dayExtras) return 'extra'
  return 'labor'
}

const tipCtx = computed(() => ({
  kind: 'mixed',
  todayEntryCount: todayRows.value.length
}))
</script>

<template>
  <header class="topbar">
    <div>
      <div class="brand-mark">胖虎记账</div>
      <h2>{{ ledger?.name || '今日' }}</h2>
      <div class="muted">{{ today }} · {{ todayRows.length }} 笔</div>
    </div>
  </header>

  <p v-if="err" class="err">{{ err }}</p>
  <PanghuTip :ctx="tipCtx" />

  <div class="hero-money">
    <div class="hm-card primary">
      <span class="k">今日合计</span>
      <strong>{{ todayResult.total }}</strong>
    </div>
    <div class="hm-card">
      <span class="k">本月合计</span>
      <strong>{{ monthResult.total }}</strong>
    </div>
  </div>

  <div class="day-strip card">
    <div class="day-stat">
      <span class="k">今日车次</span>
      <strong>{{ dayTruck }}</strong>
    </div>
    <div class="day-stat">
      <span class="k">今日人天</span>
      <strong>{{ dayLabor }}</strong>
    </div>
    <div class="day-stat">
      <span class="k">账本总计</span>
      <strong class="accent">{{ result.total }}</strong>
    </div>
  </div>

  <section class="card" style="margin-bottom: 12px">
    <div class="btn-row" style="margin-bottom: 0">
      <button class="btn btn-ghost" type="button" @click="openTypePicker">
        {{ showTypePicker ? '收起类型' : '按类型记' }}
      </button>
      <button class="btn btn-ghost" type="button" @click="showMore = !showMore">
        {{ showMore ? '收起' : '更多' }}
      </button>
    </div>
    <div v-if="showTypePicker" class="type-picker">
      <button
        v-for="t in feeTypes"
        :key="t.id"
        class="btn btn-ghost btn-block"
        type="button"
        @click="pickFeeType(t)"
      >
        {{ t.name }}
      </button>
    </div>
    <div v-if="showMore" style="margin-top: 10px">
      <button class="btn btn-ghost btn-block" type="button" @click="openExtraForm">
        {{ showExtraForm ? '收起整本零星' : '＋ 整本零星' }}
      </button>
      <div v-if="showExtraForm" class="extra-panel">
        <label>整本零星名称</label>
        <input v-model="extraName" placeholder="如 门口做卫生" />
        <label>金额</label>
        <input v-model="extraAmount" type="number" inputmode="decimal" placeholder="0" />
        <div class="btn-row">
          <button class="btn btn-ghost" type="button" @click="showExtraForm = false">取消</button>
          <button class="btn btn-primary" type="button" @click="addExtra">确认添加</button>
        </div>
      </div>
      <div v-if="extras.length" class="extra-list-top">
        <div v-for="x in extras" :key="x.id" class="extra-row">
          <span>整本 · {{ x.name }} = {{ x.amount }}</span>
          <button class="linkish" type="button" @click="removeExtra(x.id)">删除</button>
        </div>
      </div>
    </div>
  </section>

  <h3 style="margin: 0 4px 8px; font-size: 15px">今日流水</h3>
  <div class="entry-list always">
    <div v-for="row in todayRows" :key="row.id" class="entry-card">
      <div class="head" @click="editEntry(row.id)" style="align-items: center; gap: 8px">
        <span class="flow-dot" :class="flowDotClass(row)" />
        <span class="date" style="flex: 1">{{ row.laborNote || '现场一笔' }}</span>
        <span class="days">{{ row.workDays }} 人天</span>
      </div>
      <div class="meta" @click="editEntry(row.id)">
        <template v-if="row.trucks">车 {{ row.trucks }} · </template>
        <template v-if="row.dayExtras">零星 {{ row.dayExtras }} · </template>
        {{ row.date }}
      </div>
      <div class="card-actions">
        <button class="btn btn-ghost" type="button" @click="editEntry(row.id)">编辑</button>
        <button class="btn btn-ghost danger-ghost" type="button" @click="askDelete(row)">
          删除
        </button>
      </div>
    </div>
    <div v-if="!todayRows.length" class="card empty">
      今天还没记，点下面「记一笔」即可。
    </div>
  </div>

  <div class="cta-record">
    <button class="btn btn-primary btn-cta" type="button" @click="addEntry">记一笔</button>
  </div>

  <div class="fab-space with-tabbar" />

  <UndoToast
    :visible="toastVisible"
    :message="toastMsg"
    @undo="onUndo"
    @expire="onExpire"
  />
</template>
