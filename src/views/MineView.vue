<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api/ledgerApi.js'
import { clearSession, getSession } from '../lib/session.js'
import { rowWorkDays } from '../calc/hours.js'
import { computeMixed } from '../calc/settlement.js'
import { computePersonal } from '../calc/personal.js'
import { downloadHtmlXls } from '../utils/exportXls.js'
import { renderMixedSettlementDataUrl } from '../utils/shareImage.js'
import SettlementPreview from '../components/SettlementPreview.vue'
import { todayStr } from '../utils/date.js'

const router = useRouter()
const ledger = ref(null)
const entries = ref([])
const extras = ref([])
const err = ref('')
const truckUnitPrice = ref('')
const laborUnitPrice = ref('')
const savedHint = ref('')
const previewOpen = ref(false)
const previewSrc = ref('')
const feeTypes = ref([])
const newType = ref({ name: '', kind: 'qty', unit: '车', unitPrice: '100' })
const showAddType = ref(false)
const monthlyBudget = ref('3000')
const accounts = ref([])
const goals = ref([])
const newAccount = ref({ name: '', balance: '0' })
const newGoal = ref({ name: '', target: '1000', current: '0' })
const importText = ref('')
const showImport = ref(false)

const kind = computed(() => getSession()?.settlement_kind || 'mixed')
const isPersonal = computed(() => kind.value === 'personal')
const assetsTotal = computed(() =>
  accounts.value.reduce((s, a) => s + (Number(a.balance) || 0), 0)
)

const rows = computed(() =>
  entries.value.map((e) => ({
    date: e.date,
    trucks: (e.fields && e.fields.trucks) || '',
    laborNote: (e.fields && e.fields.laborNote) || e.summary || '',
    workDays: rowWorkDays(e)
  }))
)

const result = computed(() => {
  if (isPersonal.value) {
    return computePersonal({
      entries: entries.value,
      budget: { monthly: Number(monthlyBudget.value) || 0 },
      categories: ledger.value?.categories,
      monthPrefix: todayStr().slice(0, 7)
    })
  }
  return computeMixed({
    entries: entries.value,
    rates: {
      truckUnitPrice: Number(truckUnitPrice.value) || 0,
      laborUnitPrice: Number(laborUnitPrice.value) || 0
    },
    extras: extras.value,
    feeTypes: feeTypes.value,
    ledger: ledger.value
  })
})

async function refresh() {
  err.value = ''
  try {
    ledger.value = await api.getLedger()
    entries.value = await api.listEntries()
    extras.value = await api.listExtras()
    if (ledger.value.settlement_kind === 'personal') {
      monthlyBudget.value = String(ledger.value.budget?.monthly ?? 3000)
      accounts.value = ledger.value.accounts || []
      goals.value = ledger.value.goals || []
    } else {
      feeTypes.value = ledger.value.feeTypes || (await api.listFeeTypes())
      truckUnitPrice.value = String(ledger.value.rates?.truckUnitPrice ?? 100)
      laborUnitPrice.value = String(ledger.value.rates?.laborUnitPrice ?? 230)
    }
  } catch (e) {
    err.value = e.message
  }
}

onMounted(refresh)

async function saveRates() {
  try {
    await api.updateRates({
      truckUnitPrice: Number(truckUnitPrice.value) || 0,
      laborUnitPrice: Number(laborUnitPrice.value) || 0
    })
    savedHint.value = '单价已保存'
    setTimeout(() => {
      savedHint.value = ''
    }, 2000)
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

async function saveBudget() {
  try {
    await api.updateBudget({ monthly: Number(monthlyBudget.value) || 0 })
    savedHint.value = '月预算已保存'
    setTimeout(() => {
      savedHint.value = ''
    }, 2000)
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

async function saveAccountBalance(a) {
  try {
    await api.upsertAccount({
      id: a.id,
      name: a.name,
      balance: a.balance
    })
    savedHint.value = '账户已保存'
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

async function addAccount() {
  try {
    await api.upsertAccount({
      name: newAccount.value.name,
      balance: newAccount.value.balance
    })
    newAccount.value = { name: '', balance: '0' }
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

async function delAccount(id) {
  if (!confirm('删除该账户？')) return
  try {
    await api.removeAccount(id)
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

async function addGoal() {
  try {
    await api.upsertGoal({
      name: newGoal.value.name,
      target: newGoal.value.target,
      current: newGoal.value.current
    })
    newGoal.value = { name: '', target: '1000', current: '0' }
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

async function saveGoal(g) {
  try {
    await api.upsertGoal({
      id: g.id,
      name: g.name,
      target: g.target,
      current: g.current
    })
    savedHint.value = '目标已保存'
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

async function delGoal(id) {
  if (!confirm('删除该目标？')) return
  try {
    await api.removeGoal(id)
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

async function doImport() {
  try {
    const r = await api.importPersonalCsv(importText.value)
    importText.value = ''
    showImport.value = false
    savedHint.value = `已导入 ${r.count} 笔`
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

async function downloadBackup() {
  try {
    const data = await api.exportBackup()
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `panghu-ledger-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    savedHint.value = '备份已下载'
  } catch (e) {
    err.value = e.message
  }
}

function onBackupFile(ev) {
  const file = ev.target?.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      if (!confirm('导入将覆盖本机全部数据并退出当前账本。确定？')) return
      await api.importBackup(String(reader.result || ''))
      clearSession()
      router.push({ name: 'home' })
    } catch (e) {
      err.value = e.message
    }
  }
  reader.readAsText(file, 'utf-8')
  ev.target.value = ''
}

function shareUrl() {
  const slug = getSession()?.invite_slug || ledger.value?.invite_slug
  if (!slug) return ''
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(
    /\/?$/,
    '/'
  )
  return `${base}l/${slug}`
}

async function copyShareLink() {
  const url = shareUrl()
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    savedHint.value = '分享链接已复制'
  } catch {
    prompt('复制链接', url)
  }
}

function exportXls() {
  if (isPersonal.value) {
    const catMap = new Map(
      (ledger.value?.categories || []).map((c) => [c.id, c.name])
    )
    const table = [['日期', '收支', '分类', '金额', '备注']]
    entries.value.forEach((e) => {
      const dir = e.fields?.direction === 'income' ? '收入' : '支出'
      table.push([
        e.date,
        dir,
        catMap.get(e.fields?.categoryId) || '',
        e.fields?.amount ?? '',
        e.fields?.note || e.summary || ''
      ])
    })
    const r = result.value
    table.push([])
    table.push(['本月支出', r.expense])
    table.push(['本月收入', r.income])
    table.push(['结余', r.net])
    downloadHtmlXls(table, (ledger.value && ledger.value.name) || '个人账')
    return
  }
  const r = result.value
  const table = [['日期', '渣土车数', '做卫生人工记录', '折合人天']]
  rows.value.forEach((row) => {
    table.push([row.date, row.trucks, row.laborNote, row.workDays])
  })
  table.push([])
  if (Number(r.truckCount) > 0) {
    table.push([
      '渣土车费',
      `${r.truckCount} 车 × ${r.truckUnitPrice} 元/车 = ${r.truckFee}`
    ])
  }
  table.push([
    '做卫生人工费',
    `${r.workDays} 人天 × ${r.laborUnitPrice} 元/人天 = ${r.laborFee}`
  ])
  if (Number(r.dayExtrasSum) > 0) {
    table.push(['各日零星合计', r.dayExtrasSum])
  }
  extras.value.forEach((x) => table.push([`整本·${x.name}`, x.amount]))
  table.push(['总计', r.total])
  downloadHtmlXls(table, (ledger.value && ledger.value.name) || '结算')
}

async function shareImage() {
  err.value = ''
  try {
    // 再拉一次，避免「我的」页数据未刷新导致明细空白
    await refresh()
    const r = result.value
    const detailRows = rows.value.map((row) => ({
      date: row.date,
      trucks: row.trucks,
      laborNote: row.laborNote,
      workDays: row.workDays
    }))
    previewSrc.value = await renderMixedSettlementDataUrl({
      title: `${ledger.value?.name || '车 / 做卫生'} 记账明细`,
      rows: detailRows,
      result: {
        truckCount: r.truckCount,
        truckUnitPrice: r.truckUnitPrice,
        truckFee: r.truckFee,
        workDays: r.workDays,
        laborUnitPrice: r.laborUnitPrice,
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

async function logout() {
  try {
    await api.logout()
  } catch {
    clearSession()
  }
  router.push({ name: 'home' })
}

function switchLedger() {
  clearSession()
  router.push({ name: 'home' })
}

async function saveTypePrice(t) {
  try {
    await api.updateFeeType(t.id, {
      name: t.name,
      unit: t.unit,
      unitPrice: t.unitPrice
    })
    if (t.id === 'truck') truckUnitPrice.value = String(t.unitPrice ?? '')
    if (t.id === 'labor') laborUnitPrice.value = String(t.unitPrice ?? '')
    savedHint.value = '类型已保存'
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

async function addType() {
  try {
    await api.addFeeType({
      name: newType.value.name,
      kind: newType.value.kind,
      unit: newType.value.unit,
      unitPrice: newType.value.unitPrice
    })
    newType.value = { name: '', kind: 'qty', unit: '车', unitPrice: '100' }
    showAddType.value = false
    savedHint.value = '已添加计费类型'
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

async function removeType(id) {
  if (!confirm('删除该自定义类型？已记数量将不再计入')) return
  try {
    await api.removeFeeType(id)
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}
</script>

<template>
  <header class="topbar">
    <div>
      <div class="brand-mark">胖虎记账</div>
      <h2>我的</h2>
      <div class="muted">{{ ledger?.name || '账本' }}</div>
    </div>
  </header>

  <p v-if="err" class="err">{{ err }}</p>
  <p v-if="savedHint" class="hint-ok">{{ savedHint }}</p>

  <section v-if="isPersonal" class="card">
    <h3>月预算</h3>
    <label>本月预算（元）</label>
    <input v-model="monthlyBudget" type="number" inputmode="decimal" />
    <button class="btn btn-primary btn-block" type="button" @click="saveBudget">
      保存预算
    </button>
    <p class="muted" style="margin-top: 10px">
      本月支出 <strong>{{ result.expense }}</strong> · 收入
      <strong>{{ result.income }}</strong>（{{ result.entryCount }} 笔）
    </p>
  </section>

  <section v-if="isPersonal" class="card">
    <h3>资产账户</h3>
    <p class="muted" style="margin-top: -6px">合计 {{ assetsTotal }} 元</p>
    <div v-for="a in accounts" :key="a.id" style="margin-bottom: 10px">
      <label>{{ a.name }}</label>
      <input v-model="a.balance" type="number" inputmode="decimal" />
      <div class="btn-row" style="margin-top: 6px">
        <button class="btn btn-ghost" type="button" @click="saveAccountBalance(a)">
          保存余额
        </button>
        <button class="btn btn-ghost danger-ghost" type="button" @click="delAccount(a.id)">
          删除
        </button>
      </div>
    </div>
    <label>新账户名</label>
    <input v-model="newAccount.name" placeholder="如 银行卡" />
    <label>初始余额</label>
    <input v-model="newAccount.balance" type="number" inputmode="decimal" />
    <button class="btn btn-ghost btn-block" type="button" @click="addAccount">
      ＋ 添加账户
    </button>
  </section>

  <section v-if="isPersonal" class="card">
    <h3>存钱目标</h3>
    <div v-for="g in goals" :key="g.id" style="margin-bottom: 12px">
      <label>{{ g.name }}</label>
      <div class="comp-head">
        <span>{{ g.current }} / {{ g.target }}</span>
        <span
          >{{
            g.target
              ? Math.min(100, Math.round((g.current / g.target) * 1000) / 10)
              : 0
          }}%</span
        >
      </div>
      <div class="comp-bar">
        <i
          :style="{
            width:
              (g.target
                ? Math.min(100, (g.current / g.target) * 100)
                : 0) + '%'
          }"
        />
      </div>
      <label style="margin-top: 8px">当前进度</label>
      <input v-model="g.current" type="number" inputmode="decimal" />
      <div class="btn-row" style="margin-top: 6px">
        <button class="btn btn-ghost" type="button" @click="saveGoal(g)">保存</button>
        <button class="btn btn-ghost danger-ghost" type="button" @click="delGoal(g.id)">
          删除
        </button>
      </div>
    </div>
    <label>目标名称</label>
    <input v-model="newGoal.name" placeholder="如 应急金" />
    <label>目标金额</label>
    <input v-model="newGoal.target" type="number" inputmode="decimal" />
    <label>已存</label>
    <input v-model="newGoal.current" type="number" inputmode="decimal" />
    <button class="btn btn-ghost btn-block" type="button" @click="addGoal">
      ＋ 添加目标
    </button>
  </section>

  <section v-if="isPersonal" class="card">
    <h3>CSV 导入</h3>
    <button class="btn btn-ghost btn-block" type="button" @click="showImport = !showImport">
      {{ showImport ? '收起' : '粘贴 CSV 导入' }}
    </button>
    <div v-if="showImport" style="margin-top: 10px">
      <p class="muted">格式：日期,收支,分类,金额,备注（首行可表头）</p>
      <textarea
        v-model="importText"
        rows="5"
        placeholder="2026-10-17,支出,餐饮,30,午饭"
        style="width: 100%; font-size: 14px"
      />
      <button class="btn btn-primary btn-block" type="button" @click="doImport">
        开始导入
      </button>
    </div>
  </section>

  <section v-if="!isPersonal" class="card">
    <h3>单价</h3>
    <label>渣土车（元/车）</label>
    <input v-model="truckUnitPrice" type="number" inputmode="decimal" />
    <label>{{ kind === 'mixed' ? '做卫生（元/人天）' : '工日（元/工日）' }}</label>
    <input v-model="laborUnitPrice" type="number" inputmode="decimal" />
    <button class="btn btn-primary btn-block" type="button" @click="saveRates">
      保存单价
    </button>
    <p class="muted" style="margin-top: 10px">
      当前合计 <strong>{{ result.total }}</strong> 元（{{ result.entryCount }} 行）
    </p>
  </section>

  <section v-if="!isPersonal" class="card">
    <h3>计费类型</h3>
    <p class="muted" style="margin-top: -6px">
      内置可改名/单价；可添加泡沫车等自定义类型
    </p>
    <div v-for="t in feeTypes" :key="t.id" class="fee-type-row">
      <label>{{ t.builtin ? '内置' : '自定义' }} · {{ t.id === 'extra' ? '零星' : t.name }}</label>
      <input v-model="t.name" placeholder="名称" />
      <template v-if="t.kind !== 'fixed' || !t.builtin">
        <label v-if="t.kind === 'qty'">单位</label>
        <input v-if="t.kind === 'qty'" v-model="t.unit" placeholder="车" />
        <label>{{ t.kind === 'fixed' ? '（固定金额在录入时填）' : '单价' }}</label>
        <input
          v-if="t.kind !== 'fixed'"
          v-model="t.unitPrice"
          type="number"
          inputmode="decimal"
        />
      </template>
      <div class="btn-row" style="margin-top: 6px">
        <button class="btn btn-ghost" type="button" @click="saveTypePrice(t)">保存</button>
        <button
          v-if="!t.builtin"
          class="btn btn-ghost danger-ghost"
          type="button"
          @click="removeType(t.id)"
        >
          删除
        </button>
      </div>
    </div>
    <button
      class="btn btn-ghost btn-block"
      type="button"
      style="margin-top: 10px"
      @click="showAddType = !showAddType"
    >
      {{ showAddType ? '收起' : '＋ 添加类型' }}
    </button>
    <div v-if="showAddType" style="margin-top: 10px">
      <label>名称</label>
      <input v-model="newType.name" placeholder="如 泡沫车" />
      <label>计价</label>
      <select v-model="newType.kind">
        <option value="qty">数量 × 单价</option>
        <option value="fixed">固定金额</option>
      </select>
      <label v-if="newType.kind === 'qty'">单位</label>
      <input v-if="newType.kind === 'qty'" v-model="newType.unit" placeholder="车" />
      <label v-if="newType.kind === 'qty'">默认单价</label>
      <input
        v-if="newType.kind === 'qty'"
        v-model="newType.unitPrice"
        type="number"
        inputmode="decimal"
      />
      <button class="btn btn-primary btn-block" type="button" @click="addType">确认添加</button>
    </div>
  </section>

  <section class="card">
    <h3>导出与分享</h3>
    <div class="btn-row" style="margin-bottom: 10px">
      <button class="btn btn-primary" type="button" @click="exportXls">导出表格</button>
      <button
        v-if="!isPersonal"
        class="btn btn-ghost"
        type="button"
        @click="shareImage"
      >
        结算图
      </button>
    </div>
    <button class="btn btn-ghost btn-block" type="button" @click="copyShareLink">
      复制分享链接
    </button>
    <p class="muted" style="margin-top: 10px; word-break: break-all">
      {{ shareUrl() || '暂无链接' }}
    </p>
  </section>

  <section class="card">
    <h3>本机备份</h3>
    <p class="muted" style="margin-top: -6px">整库 JSON，防清缓存丢账</p>
    <button class="btn btn-primary btn-block" type="button" @click="downloadBackup">
      导出备份
    </button>
    <label class="btn btn-ghost btn-block" style="margin-top: 8px; text-align: center">
      导入备份
      <input
        type="file"
        accept="application/json,.json"
        style="display: none"
        @change="onBackupFile"
      />
    </label>
  </section>

  <section class="card">
    <h3>更多</h3>
    <button
      class="btn btn-ghost btn-block"
      type="button"
      style="margin-bottom: 8px"
      @click="router.push({ name: 'templates' })"
    >
      模板管理
    </button>
    <button
      class="btn btn-ghost btn-block"
      type="button"
      style="margin-bottom: 8px"
      @click="switchLedger"
    >
      切换 / 新建账本
    </button>
    <button class="btn btn-ghost btn-block" type="button" @click="logout">
      退出当前账本
    </button>
    <p class="muted" style="margin-top: 12px">
      本地模式数据存在本机浏览器；清缓存会丢。需要多机同步时再接 Supabase。
    </p>
  </section>

  <SettlementPreview
    :open="previewOpen"
    :src="previewSrc"
    :title="ledger?.name || '结算图'"
    @close="previewOpen = false"
  />
  <div class="fab-space with-tabbar" />
</template>
