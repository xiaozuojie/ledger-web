<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api/ledgerApi.js'
import { getSession } from '../lib/session.js'
import { rowWorkDays } from '../calc/hours.js'
import { computeMixed, entryExtrasSum } from '../calc/settlement.js'
import UndoToast from '../components/UndoToast.vue'

const sessionInvite = () => getSession()?.invite_slug

const router = useRouter()
const ledger = ref(null)
const entries = ref([])
const extras = ref([])
const err = ref('')
const truckUnitPrice = ref('')
const laborUnitPrice = ref('')
const extraName = ref('')
const extraAmount = ref('')
const ratesHint = ref('')
const toastVisible = ref(false)
const toastMsg = ref('')
const pendingDelete = ref(null)
const showExtraForm = ref(false)

const rows = computed(() =>
  entries.value.map((e) => ({
    id: e.id,
    date: e.date,
    trucks: (e.fields && e.fields.trucks) || '',
    laborNote: (e.fields && e.fields.laborNote) || e.summary || '',
    workDays: rowWorkDays(e),
    dayExtras: entryExtrasSum(e)
  }))
)

const result = computed(() =>
  computeMixed({
    entries: entries.value,
    rates: {
      truckUnitPrice: Number(truckUnitPrice.value) || 0,
      laborUnitPrice: Number(laborUnitPrice.value) || 0
    },
    extras: extras.value,
    feeTypes: ledger.value?.feeTypes,
    ledger: ledger.value
  })
)

const feeTypes = computed(() =>
  (ledger.value?.feeTypes || []).filter((t) => t.enabled !== false)
)
const showTypePicker = ref(false)
const customFeeLines = computed(() =>
  (result.value.feeBreakdown || []).filter(
    (x) => x.id !== 'truck' && x.id !== 'labor' && x.id !== 'extra' && x.amount
  )
)

async function refresh() {
  err.value = ''
  try {
    ledger.value = await api.getLedger()
    entries.value = await api.listEntries()
    extras.value = await api.listExtras()
    truckUnitPrice.value = String(ledger.value.rates?.truckUnitPrice ?? 100)
    laborUnitPrice.value = String(ledger.value.rates?.laborUnitPrice ?? 230)
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

function askDelete(id) {
  if (pendingDelete.value) return
  const row = entries.value.find((e) => e.id === id)
  if (!row) return
  if (!confirm('删除这条明细？')) return
  pendingDelete.value = row
  entries.value = entries.value.filter((e) => e.id !== id)
  toastMsg.value = '已删除一行'
  toastVisible.value = true
}

async function onExpireDelete() {
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

function onUndoDelete() {
  const row = pendingDelete.value
  toastVisible.value = false
  pendingDelete.value = null
  if (!row) return
  entries.value = [...entries.value, row].sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  )
}

async function saveRates() {
  try {
    await api.updateRates({
      truckUnitPrice: Number(truckUnitPrice.value) || 0,
      laborUnitPrice: Number(laborUnitPrice.value) || 0
    })
    ratesHint.value = '已保存'
    setTimeout(() => {
      ratesHint.value = ''
    }, 1500)
  } catch (e) {
    err.value = e.message
  }
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

function openExtraForm() {
  showExtraForm.value = !showExtraForm.value
}

async function removeExtra(id) {
  try {
    await api.removeExtra(id)
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

function copyShareLink() {
  const slug = sessionInvite() || ledger.value?.invite_slug
  if (!slug) return
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(
    /\/?$/,
    '/'
  )
  const url = `${base}l/${slug}`
  navigator.clipboard?.writeText(url).then(
    () => {
      ratesHint.value = '链接已复制'
    },
    () => prompt('复制链接', url)
  )
}
</script>

<template>
  <header class="topbar">
    <div>
      <div class="brand-mark">胖虎记账</div>
      <h2>{{ ledger?.name || '样表' }}</h2>
      <div class="muted">
        <span class="chip">纸面四列</span>
        {{ result.entryCount }} 行 · 合计 {{ result.total }} 元
      </div>
    </div>
    <div class="actions actions-2">
      <button class="btn btn-ghost" type="button" @click="copyShareLink">分享</button>
      <button class="btn btn-ghost" type="button" @click="router.push({ name: 'mine' })">
        导出
      </button>
    </div>
  </header>

  <p v-if="err" class="err">{{ err }}</p>
  <p v-if="ratesHint" class="hint-ok">{{ ratesHint }}</p>

  <section class="card top-actions">
    <div class="btn-row-3">
      <button class="btn btn-primary" type="button" @click="addEntry">＋ 新建一行</button>
      <button class="btn btn-ghost" type="button" @click="openTypePicker">
        {{ showTypePicker ? '收起' : '＋ 新增类型' }}
      </button>
      <button class="btn btn-ghost" type="button" @click="openExtraForm">
        {{ showExtraForm ? '收起' : '＋ 整本零星' }}
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
        <span class="muted">
          ·
          {{
            t.kind === 'qty'
              ? `${t.unitPrice ?? ''}元/${t.unit || '次'}`
              : t.kind === 'work_days'
                ? `${t.unitPrice ?? ''}元/人天`
                : '固定金额'
          }}
        </span>
      </button>
    </div>
    <p class="muted" style="margin: 8px 0 0">
      「新增类型」可选车/人工/零星/自定义；当日零星在行内加。
    </p>
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
  </section>

  <div class="entry-list always">
    <div v-for="row in rows" :key="row.id" class="entry-card">
      <div class="head" @click="editEntry(row.id)">
        <span class="date">{{ row.date }}</span>
        <span class="days">{{ row.workDays }} 人天</span>
      </div>
      <div v-if="row.trucks" class="meta" @click="editEntry(row.id)">
        车次：{{ row.trucks }}
      </div>
      <div class="meta" @click="editEntry(row.id)">
        {{ row.laborNote || '（无人工说明）' }}
        <template v-if="row.dayExtras"> · 当日零星 {{ row.dayExtras }}</template>
      </div>
      <div class="card-actions">
        <button class="btn btn-ghost" type="button" @click="editEntry(row.id)">编辑</button>
        <button class="btn btn-ghost danger-ghost" type="button" @click="askDelete(row.id)">
          删除
        </button>
      </div>
    </div>
    <div v-if="!rows.length" class="card empty">暂无明细，点上方「新建一行」</div>
  </div>

  <div class="table-wrap card" style="padding: 0">
    <table class="sheet">
      <thead>
        <tr>
          <th>日期</th>
          <th>渣土车数</th>
          <th>做卫生人工记录</th>
          <th>折合人天</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="'t-' + row.id">
          <td @click="editEntry(row.id)" style="cursor: pointer">{{ row.date }}</td>
          <td @click="editEntry(row.id)" style="cursor: pointer">{{ row.trucks }}</td>
          <td @click="editEntry(row.id)" style="cursor: pointer">{{ row.laborNote }}</td>
          <td @click="editEntry(row.id)" style="cursor: pointer">{{ row.workDays }}</td>
          <td>
            <button class="linkish" type="button" @click="askDelete(row.id)">删除</button>
          </td>
        </tr>
        <tr v-if="!rows.length">
          <td colspan="5" class="muted">暂无明细</td>
        </tr>
      </tbody>
    </table>
  </div>

  <UndoToast
    :visible="toastVisible"
    :message="toastMsg"
    @undo="onUndoDelete"
    @expire="onExpireDelete"
  />

  <section class="summary sticky-sum">
    <div class="sum-head">
      <h3>结算</h3>
      <span class="muted" v-if="ratesHint">{{ ratesHint }}</span>
    </div>
    <div v-if="result.truckCount > 0" class="sum-line">
      车费 {{ result.truckCount }} 车 ×
      <input
        v-model="truckUnitPrice"
        class="price"
        type="number"
        inputmode="decimal"
        @change="saveRates"
      />
      =
      <strong>{{ result.truckFee }}</strong>
    </div>
    <div class="sum-line">
      人工 {{ result.workDays }} 人天 ×
      <input
        v-model="laborUnitPrice"
        class="price"
        type="number"
        inputmode="decimal"
        @change="saveRates"
      />
      =
      <strong>{{ result.laborFee }}</strong>
    </div>
    <div v-if="result.dayExtrasSum" class="extra-row">
      <span>各日零星合计 = {{ result.dayExtrasSum }}</span>
    </div>
    <div v-for="x in extras" :key="'sum-' + x.id" class="extra-row">
      <span>整本 · {{ x.name }} = {{ x.amount }}</span>
    </div>
    <div v-for="c in customFeeLines" :key="'cf-' + c.id" class="extra-row">
      <span
        >{{ c.name }}
        <template v-if="c.kind === 'qty'"
          >{{ c.qty }}{{ c.unit || '' }} × {{ c.unitPrice }}</template
        >
        = {{ c.amount }}</span
      >
    </div>
    <div class="total">总计 {{ result.total }} 元</div>
  </section>
  <div class="fab-space with-tabbar" />
</template>
