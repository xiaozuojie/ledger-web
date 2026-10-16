<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api/ledgerApi.js'
import { clearSession, getSession } from '../lib/session.js'
import { rowWorkDays } from '../calc/hours.js'
import { computeMixed } from '../calc/settlement.js'
import { downloadHtmlXls } from '../utils/exportXls.js'
import { renderMixedSettlementDataUrl } from '../utils/shareImage.js'
import SettlementPreview from '../components/SettlementPreview.vue'

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

const kind = computed(() => getSession()?.settlement_kind || 'mixed')

const rows = computed(() =>
  entries.value.map((e) => ({
    date: e.date,
    trucks: (e.fields && e.fields.trucks) || '',
    laborNote: (e.fields && e.fields.laborNote) || e.summary || '',
    workDays: rowWorkDays(e)
  }))
)

const result = computed(() =>
  computeMixed({
    entries: entries.value,
    rates: {
      truckUnitPrice: Number(truckUnitPrice.value) || 0,
      laborUnitPrice: Number(laborUnitPrice.value) || 0
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
    truckUnitPrice.value = String(ledger.value.rates?.truckUnitPrice ?? 100)
    laborUnitPrice.value = String(ledger.value.rates?.laborUnitPrice ?? 230)
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
  extras.value.forEach((x) => table.push([x.name, x.amount]))
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

function switchLedger() {
  clearSession()
  router.push({ name: 'home' })
}
</script>

<template>
  <header class="topbar">
    <div>
      <h2>我的</h2>
      <div class="muted">{{ ledger?.name || '账本' }}</div>
    </div>
  </header>

  <p v-if="err" class="err">{{ err }}</p>
  <p v-if="savedHint" class="hint-ok">{{ savedHint }}</p>

  <section v-if="kind === 'mixed'" class="card">
    <h3>单价</h3>
    <label>渣土车（元/车）</label>
    <input v-model="truckUnitPrice" type="number" inputmode="decimal" />
    <label>做卫生（元/人天）</label>
    <input v-model="laborUnitPrice" type="number" inputmode="decimal" />
    <button class="btn btn-primary btn-block" type="button" @click="saveRates">
      保存单价
    </button>
    <p class="muted" style="margin-top: 10px">
      当前合计 <strong>{{ result.total }}</strong> 元（{{ result.entryCount }} 行）
    </p>
  </section>

  <section class="card">
    <h3>导出与分享</h3>
    <div class="btn-row" style="margin-bottom: 10px">
      <button class="btn btn-primary" type="button" @click="exportXls">导出表格</button>
      <button class="btn btn-ghost" type="button" @click="shareImage">结算图</button>
    </div>
    <button class="btn btn-ghost btn-block" type="button" @click="copyShareLink">
      复制分享链接
    </button>
    <p class="muted" style="margin-top: 10px; word-break: break-all">
      {{ shareUrl() || '暂无链接' }}
    </p>
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
