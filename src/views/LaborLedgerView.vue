<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api/ledgerApi.js'
import { clearSession, getSession } from '../lib/session.js'
import { rowWorkDays } from '../calc/hours.js'
import { computeLabor, entryExtrasSum } from '../calc/settlement.js'
import { downloadHtmlXls } from '../utils/exportXls.js'
import { renderLaborSettlementDataUrl } from '../utils/shareImage.js'
import SettlementPreview from '../components/SettlementPreview.vue'
import UndoToast from '../components/UndoToast.vue'

const sessionInvite = () => getSession()?.invite_slug

const router = useRouter()
const ledger = ref(null)
const entries = ref([])
const extras = ref([])
const err = ref('')
const laborUnitPrice = ref('')
const extraName = ref('')
const extraAmount = ref('')
const previewOpen = ref(false)
const previewSrc = ref('')
const toastVisible = ref(false)
const toastMsg = ref('')
const pendingDelete = ref(null)
const showExtraForm = ref(false)

const result = computed(() =>
  computeLabor({
    entries: entries.value,
    rates: { laborUnitPrice: Number(laborUnitPrice.value) || 0 },
    extras: extras.value
  })
)

const detailRows = computed(() =>
  entries.value.map((e) => {
    const g = e.groups || []
    return {
      id: e.id,
      date: e.date,
      peopleText: g.map((x) => x.people).filter((v) => v !== '' && v != null).join('+') || '—',
      daysText: g.map((x) => x.days).filter((v) => v !== '' && v != null).join('+') || '—',
      workDays: rowWorkDays(e),
      note: e.summary || (e.fields && e.fields.laborNote) || '',
      dayExtras: entryExtrasSum(e)
    }
  })
)

async function refresh() {
  err.value = ''
  try {
    ledger.value = await api.getLedger()
    entries.value = await api.listEntries()
    extras.value = await api.listExtras()
    laborUnitPrice.value = String(ledger.value.rates?.laborUnitPrice ?? 300)
  } catch (e) {
    err.value = e.message
  }
}

onMounted(refresh)

function editEntry(id) {
  router.push({ name: 'entry', query: { kind: 'labor', id } })
}

function addEntry() {
  router.push({ name: 'entry', query: { kind: 'labor' } })
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
    await api.updateRates({ laborUnitPrice: Number(laborUnitPrice.value) || 0 })
    await refresh()
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

function exportXls() {
  const r = result.value
  const table = [['日期', '人数摘要', '单人天数摘要', '合计工日', '备注']]
  detailRows.value.forEach((row) => {
    table.push([row.date, row.peopleText, row.daysText, row.workDays, row.note])
  })
  table.push(['合计', '', '', r.workDays, ''])
  table.push(['单价', '', '', r.unitPrice, ''])
  extras.value.forEach((x) => table.push([x.name, '', '', x.amount, '']))
  table.push(['总计', '', '', r.total, ''])
  downloadHtmlXls(table, ledger.value?.name || '工时结算')
}

async function shareImage() {
  err.value = ''
  try {
    await refresh()
    const r = result.value
    previewSrc.value = await renderLaborSettlementDataUrl({
      title: `${ledger.value?.name || '工时'} 记账明细`,
      rows: detailRows.value.map((row) => ({
        date: row.date,
        peopleText: row.peopleText === '—' ? '' : row.peopleText,
        daysText: row.daysText === '—' ? '' : row.daysText,
        workDays: row.workDays,
        laborNote: row.note
      })),
      result: {
        workDays: r.workDays,
        unitPrice: r.unitPrice,
        laborFee: r.laborFee,
        dayExtrasSum: r.dayExtrasSum,
        extras: extras.value,
        total: r.total
      }
    })
    previewOpen.value = true
  } catch (e) {
    err.value = e.message || '生成结算图失败'
  }
}

function logout() {
  clearSession()
  router.push({ name: 'home' })
}
</script>

<template>
  <header class="topbar">
    <div>
      <h2>{{ ledger?.name || '工时账本' }}</h2>
      <div class="muted">
        <span class="chip">工时</span>
        {{ result.entryCount }} 笔明细 · 共 {{ result.workDays }} 工日
      </div>
    </div>
    <div class="actions actions-2">
      <button class="btn btn-ghost" type="button" @click="router.push({ name: 'mine' })">
        我的
      </button>
      <button class="btn btn-ghost" type="button" @click="logout">退出</button>
    </div>
  </header>
  <p v-if="err" class="err">{{ err }}</p>

  <section class="card top-actions">
    <div class="btn-row">
      <button class="btn btn-primary" type="button" @click="addEntry">＋ 新建一行</button>
      <button class="btn btn-ghost" type="button" @click="openExtraForm">
        {{ showExtraForm ? '收起整本零星' : '＋ 整本零星' }}
      </button>
    </div>
    <p class="muted" style="margin: 8px 0 0">
      当日零星请在「新建/编辑一行」里添加；此处为不跟日期的整本零星。
    </p>
    <div v-if="showExtraForm" class="extra-panel">
      <label>整本零星名称</label>
      <input v-model="extraName" placeholder="如 材料费" />
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

  <!-- always：避免宽屏 media 把列表藏掉却无表格 -->
  <div class="entry-list always">
    <div v-for="row in detailRows" :key="row.id" class="entry-card">
      <div class="head" @click="editEntry(row.id)">
        <span class="date">{{ row.date }}</span>
        <span class="days">{{ row.workDays }} 工日</span>
      </div>
      <div class="meta" @click="editEntry(row.id)">
        人数 {{ row.peopleText }} · 天数 {{ row.daysText }}
        <template v-if="row.dayExtras"> · 当日零星 {{ row.dayExtras }}</template>
      </div>
      <div v-if="row.note" class="meta" @click="editEntry(row.id)">{{ row.note }}</div>
      <div class="card-actions">
        <button class="btn btn-ghost" type="button" @click="editEntry(row.id)">编辑</button>
        <button class="btn btn-ghost danger-ghost" type="button" @click="askDelete(row.id)">
          删除
        </button>
      </div>
    </div>
    <div v-if="!detailRows.length" class="card empty">
      暂无每日明细，点上方「新建一行」开始记
    </div>
  </div>

  <div class="table-wrap card" style="padding: 0">
    <table class="sheet">
      <thead>
        <tr>
          <th>日期</th>
          <th>人数</th>
          <th>天数</th>
          <th>折合工日</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in detailRows" :key="'t-' + row.id">
          <td @click="editEntry(row.id)" style="cursor: pointer">{{ row.date }}</td>
          <td @click="editEntry(row.id)" style="cursor: pointer">{{ row.peopleText }}</td>
          <td @click="editEntry(row.id)" style="cursor: pointer">{{ row.daysText }}</td>
          <td @click="editEntry(row.id)" style="cursor: pointer">{{ row.workDays }}</td>
          <td>
            <button class="linkish" type="button" @click="askDelete(row.id)">删除</button>
          </td>
        </tr>
        <tr v-if="!detailRows.length">
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

  <section class="summary">
    <h3>结算汇总</h3>
    <div class="sum-line sum-line-wrap">
      <span class="sum-label">工日 {{ result.workDays }} ×</span>
      <input
        v-model="laborUnitPrice"
        class="price"
        type="number"
        inputmode="decimal"
        @change="saveRates"
      />
      <span>=</span>
      <strong>{{ result.laborFee }}</strong>
    </div>
    <div v-if="result.dayExtrasSum" class="extra-row">
      <span>各日零星合计 = {{ result.dayExtrasSum }}</span>
    </div>
    <div v-for="x in extras" :key="'sum-' + x.id" class="extra-row">
      <span>整本 · {{ x.name }} = {{ x.amount }}</span>
    </div>
    <button
      class="btn btn-primary btn-block"
      type="button"
      style="margin-top: 10px"
      @click="saveRates"
    >
      保存单价
    </button>
    <div class="total">总计 {{ result.total }} 元</div>
  </section>
  <div class="fab-space with-tabbar" />

  <div class="card btn-row" style="margin-top: 14px">
    <button class="btn btn-primary" type="button" @click="exportXls">导出表格</button>
    <button class="btn btn-ghost" type="button" @click="shareImage">结算图</button>
  </div>
  <SettlementPreview
    :open="previewOpen"
    :src="previewSrc"
    :title="ledger?.name || '结算图'"
    @close="previewOpen = false"
  />
</template>
