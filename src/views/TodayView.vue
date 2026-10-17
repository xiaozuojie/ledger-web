<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api/ledgerApi.js'
import { rowWorkDays } from '../calc/hours.js'
import { computeMixed } from '../calc/settlement.js'
import { parseTruckCount } from '../calc/trucks.js'
import { todayStr } from '../utils/date.js'
import UndoToast from '../components/UndoToast.vue'

const router = useRouter()
const ledger = ref(null)
const entries = ref([])
const extras = ref([])
const err = ref('')
const toastVisible = ref(false)
const toastMsg = ref('')
const pendingDelete = ref(null)
const showExtraForm = ref(false)
const extraName = ref('')
const extraAmount = ref('')

const today = todayStr()

const todayRows = computed(() =>
  entries.value
    .filter((e) => e.date === today)
    .map((e) => ({
      id: e.id,
      date: e.date,
      trucks: (e.fields && e.fields.trucks) || '',
      laborNote: (e.fields && e.fields.laborNote) || e.summary || '',
      workDays: rowWorkDays(e),
      raw: e
    }))
)

const dayTruck = computed(() =>
  todayRows.value.reduce((s, r) => s + parseTruckCount(r.trucks), 0)
)
const dayLabor = computed(() =>
  todayRows.value.reduce((s, r) => s + (Number(r.workDays) || 0), 0)
)

const result = computed(() =>
  computeMixed({
    entries: entries.value,
    rates: {
      truckUnitPrice: Number(ledger.value?.rates?.truckUnitPrice) || 0,
      laborUnitPrice: Number(ledger.value?.rates?.laborUnitPrice) || 0
    },
    extras: extras.value
  })
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
</script>

<template>
  <header class="topbar">
    <div>
      <h2>{{ ledger?.name || '今日' }}</h2>
      <div class="muted">{{ today }} · 今天记了 {{ todayRows.length }} 笔</div>
    </div>
  </header>

  <p v-if="err" class="err">{{ err }}</p>

  <section class="card top-actions">
    <div class="btn-row">
      <button class="btn btn-primary" type="button" @click="addEntry">＋ 记一笔</button>
      <button class="btn btn-ghost" type="button" @click="openExtraForm">
        {{ showExtraForm ? '收起零星' : '＋ 添加零星' }}
      </button>
    </div>
    <div v-if="showExtraForm" class="extra-panel">
      <label>零星名称</label>
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
        <span>{{ x.name }} = {{ x.amount }}</span>
        <button class="linkish" type="button" @click="removeExtra(x.id)">删除</button>
      </div>
    </div>
  </section>

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
      <span class="k">账本合计</span>
      <strong class="accent">{{ result.total }}</strong>
    </div>
  </div>

  <div class="entry-list always">
    <div
      v-for="row in todayRows"
      :key="row.id"
      class="entry-card"
    >
      <div class="head" @click="editEntry(row.id)">
        <span class="date">{{ row.date }}</span>
        <span class="days">{{ row.workDays }} 人天</span>
      </div>
      <div class="meta" v-if="row.trucks" @click="editEntry(row.id)">
        车次：{{ row.trucks }}
      </div>
      <div class="meta" @click="editEntry(row.id)">
        {{ row.laborNote || '（无人工说明）' }}
      </div>
      <div class="card-actions">
        <button class="btn btn-ghost" type="button" @click="editEntry(row.id)">
          编辑
        </button>
        <button class="btn btn-ghost danger-ghost" type="button" @click="askDelete(row)">
          删除
        </button>
      </div>
    </div>
    <div v-if="!todayRows.length" class="card empty">
      今天还没记。点上方「记一笔」即可。
    </div>
  </div>

  <div class="fab-space with-tabbar" />

  <UndoToast
    :visible="toastVisible"
    :message="toastMsg"
    @undo="onUndo"
    @expire="onExpire"
  />
</template>
