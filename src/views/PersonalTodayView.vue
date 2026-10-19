<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api/ledgerApi.js'
import { computePersonal } from '../calc/personal.js'
import { parseQuickEntries } from '../calc/parseQuickEntries.js'
import { todayStr } from '../utils/date.js'
import UndoToast from '../components/UndoToast.vue'
import PanghuTip from '../components/PanghuTip.vue'

const router = useRouter()
const ledger = ref(null)
const entries = ref([])
const err = ref('')
const toastVisible = ref(false)
const toastMsg = ref('')
const pendingDelete = ref(null)
const showQuick = ref(false)
const quickText = ref('')
const quickPreview = ref([])
const quickSaving = ref(false)
const quickAccountId = ref('')
const quickHint = ref('')

const today = todayStr()
const monthPrefix = today.slice(0, 7)

const catMap = computed(() => {
  const m = new Map()
  for (const c of ledger.value?.categories || []) m.set(c.id, c)
  return m
})

const todayEntries = computed(() =>
  entries.value.filter((e) => e.date === today)
)

const todayResult = computed(() =>
  computePersonal({
    entries: todayEntries.value,
    categories: ledger.value?.categories
  })
)

const monthResult = computed(() =>
  computePersonal({
    entries: entries.value,
    budget: ledger.value?.budget,
    categories: ledger.value?.categories,
    monthPrefix
  })
)

const flowRows = computed(() =>
  todayEntries.value
    .slice()
    .sort((a, b) => String(b.id).localeCompare(String(a.id)))
    .map((e) => {
      const dir = e.fields?.direction === 'income' ? 'income' : 'expense'
      const cat = catMap.value.get(e.fields?.categoryId)
      return {
        id: e.id,
        raw: e,
        note: e.fields?.note || e.summary || cat?.name || '一笔',
        catName: cat?.name || '未分类',
        icon: cat?.icon || '记',
        amount: Number(e.fields?.amount) || 0,
        direction: dir
      }
    })
)

async function refresh() {
  err.value = ''
  try {
    ledger.value = await api.getLedger()
    entries.value = await api.listEntries()
    if (!quickAccountId.value && ledger.value.accounts?.length) {
      quickAccountId.value = ledger.value.accounts[0].id
    }
  } catch (e) {
    err.value = e.message
  }
}

onMounted(refresh)

function onQuickInput() {
  quickPreview.value = parseQuickEntries(quickText.value)
}

async function confirmQuick() {
  if (quickSaving.value) return
  const items = parseQuickEntries(quickText.value)
  if (!items.length) {
    err.value = '没识别到金额，试试：午饭30 打车15'
    return
  }
  quickSaving.value = true
  err.value = ''
  try {
    const r = await api.bulkAddPersonalEntries(items, {
      date: today,
      accountId: quickAccountId.value || null
    })
    quickText.value = ''
    quickPreview.value = []
    showQuick.value = false
    err.value = ''
    quickHint.value = `已记入 ${r.count} 笔`
    setTimeout(() => {
      quickHint.value = ''
    }, 2500)
    await refresh()
  } catch (e) {
    err.value = e.message
  } finally {
    quickSaving.value = false
  }
}

function addEntry(direction = 'expense') {
  router.push({
    name: 'personal-entry',
    query: { direction }
  })
}

function editEntry(id) {
  router.push({ name: 'personal-entry', query: { id } })
}

function askDelete(row) {
  if (pendingDelete.value) return
  pendingDelete.value = row.raw
  entries.value = entries.value.filter((e) => e.id !== row.id)
  toastMsg.value = '已删除'
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
  entries.value = [...entries.value, row]
}

const tipCtx = computed(() => ({
  kind: 'personal',
  todayEntryCount: todayEntries.value.length,
  budgetPct: monthResult.value.budgetPct,
  budgetLeft: monthResult.value.budgetLeft
}))
</script>

<template>
  <header class="topbar">
    <div>
      <div class="brand-mark">胖虎记账 · 个人</div>
      <h2>{{ ledger?.name || '今日' }}</h2>
      <div class="muted">{{ today }}</div>
    </div>
  </header>

  <p v-if="err" class="err">{{ err }}</p>
  <p v-if="quickHint" class="hint-ok">{{ quickHint }}</p>
  <PanghuTip :ctx="tipCtx" />

  <div class="hero-money">
    <div class="hm-card primary">
      <span class="k">今日支出</span>
      <strong>{{ todayResult.expense }}</strong>
    </div>
    <div class="hm-card">
      <span class="k">本月支出</span>
      <strong>{{ monthResult.expense }}</strong>
    </div>
  </div>

  <section v-if="monthResult.monthlyBudget" class="card">
    <div class="comp-head">
      <span>月预算 {{ monthResult.monthlyBudget }}</span>
      <span
        >剩 {{ monthResult.budgetLeft }} · {{ monthResult.budgetPct }}%</span
      >
    </div>
    <div class="comp-bar">
      <i :style="{ width: Math.min(100, monthResult.budgetPct) + '%' }" />
    </div>
    <p class="muted" style="margin: 8px 0 0">
      本月收入 {{ monthResult.income }} · 结余 {{ monthResult.net }}
    </p>
  </section>

  <section class="card">
    <button class="btn btn-ghost btn-block" type="button" @click="showQuick = !showQuick">
      {{ showQuick ? '收起' : '一句话记多笔' }}
    </button>
    <div v-if="showQuick" style="margin-top: 10px">
      <label>例如：午饭30 打车15 工资5000</label>
      <input
        v-model="quickText"
        placeholder="用空格分隔多笔"
        @input="onQuickInput"
      />
      <label v-if="ledger?.accounts?.length">记入账户（可选）</label>
      <select v-if="ledger?.accounts?.length" v-model="quickAccountId">
        <option value="">不关联账户</option>
        <option v-for="a in ledger.accounts" :key="a.id" :value="a.id">
          {{ a.name }}（{{ a.balance }}）
        </option>
      </select>
      <div v-if="quickPreview.length" class="quick-preview">
        <div v-for="(p, i) in quickPreview" :key="i" class="muted">
          {{ p.direction === 'income' ? '收' : '支' }} {{ p.note }}
          {{ p.amount }}
        </div>
      </div>
      <button
        class="btn btn-primary btn-block"
        type="button"
        style="margin-top: 8px"
        :disabled="quickSaving || !quickPreview.length"
        @click="confirmQuick"
      >
        {{ quickSaving ? '保存中…' : `确认记入 ${quickPreview.length} 笔` }}
      </button>
    </div>
  </section>

  <h3 style="margin: 12px 4px 8px; font-size: 15px">今日流水</h3>
  <div class="entry-list always">
    <div v-for="row in flowRows" :key="row.id" class="entry-card">
      <div class="head" @click="editEntry(row.id)" style="align-items: center; gap: 8px">
        <span class="flow-dot" :class="row.direction === 'income' ? 'labor' : 'truck'" />
        <span class="date" style="flex: 1">{{ row.icon }} {{ row.note }}</span>
        <span
          class="days"
          :style="{ color: row.direction === 'income' ? '#2a9d8f' : 'inherit' }"
        >
          {{ row.direction === 'income' ? '+' : '-' }}{{ row.amount }}
        </span>
      </div>
      <div class="meta" @click="editEntry(row.id)">{{ row.catName }}</div>
      <div class="card-actions">
        <button class="btn btn-ghost" type="button" @click="editEntry(row.id)">编辑</button>
        <button class="btn btn-ghost danger-ghost" type="button" @click="askDelete(row)">
          删除
        </button>
      </div>
    </div>
    <div v-if="!flowRows.length" class="card empty">
      今天还没记，点下面记一笔。
    </div>
  </div>

  <div class="cta-record">
    <div class="btn-row" style="margin: 0">
      <button class="btn btn-ghost" type="button" @click="addEntry('income')">记收入</button>
      <button class="btn btn-primary btn-cta" type="button" @click="addEntry('expense')">
        记支出
      </button>
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
