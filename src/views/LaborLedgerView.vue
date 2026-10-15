<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api/ledgerApi.js'
import { clearSession, getSession } from '../lib/session.js'

const sessionInvite = () => getSession()?.invite_slug
import { rowWorkDays } from '../calc/hours.js'
import { computeLabor } from '../calc/settlement.js'
import { downloadHtmlXls } from '../utils/exportXls.js'
import { paintSettlementImage, canvasToDataUrl } from '../utils/shareImage.js'
import SettlementPreview from '../components/SettlementPreview.vue'

const router = useRouter()
const ledger = ref(null)
const entries = ref([])
const extras = ref([])
const err = ref('')
const laborUnitPrice = ref('')
const extraName = ref('')
const extraAmount = ref('')
const canvasRef = ref(null)
const previewOpen = ref(false)
const previewSrc = ref('')

const result = computed(() =>
  computeLabor({
    entries: entries.value,
    rates: { laborUnitPrice: Number(laborUnitPrice.value) || 0 },
    extras: extras.value
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
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

function exportXls() {
  const r = result.value
  const table = [['日期', '人数摘要', '单人天数摘要', '合计工日']]
  entries.value.forEach((e) => {
    const g = e.groups || []
    table.push([
      e.date,
      g.map((x) => x.people).join('+'),
      g.map((x) => x.days).join('+'),
      rowWorkDays(e)
    ])
  })
  table.push(['合计', '', '', r.workDays])
  table.push(['单价', '', '', r.unitPrice])
  extras.value.forEach((x) => table.push([x.name, '', '', x.amount]))
  table.push(['总计', '', '', r.total])
  downloadHtmlXls(table, ledger.value?.name || '工时结算')
}

function shareImage() {
  const r = result.value
  paintSettlementImage(
    canvasRef.value,
    ledger.value?.name || '工时',
    [`工日 ${r.workDays} × ${r.unitPrice} = ${r.laborFee}`, `零星 ${r.extrasSum}`],
    r.total
  )
  previewSrc.value = canvasToDataUrl(canvasRef.value)
  previewOpen.value = true
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
        {{ sessionInvite() || ledger?.invite_slug }}
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

  <div class="entry-list">
    <div
      v-for="e in entries"
      :key="e.id"
      class="entry-card"
      @click="router.push({ name: 'entry', query: { kind: 'labor', id: e.id } })"
    >
      <div class="head">
        <span class="date">{{ e.date }}</span>
        <span class="days">{{ rowWorkDays(e) }} 工日</span>
      </div>
      <div class="meta">点按编辑</div>
    </div>
    <div v-if="!entries.length" class="card empty">暂无明细</div>
  </div>

  <button
    class="btn btn-primary fab with-tabbar"
    type="button"
    @click="router.push({ name: 'entry', query: { kind: 'labor' } })"
  >
    ＋ 新建一行
  </button>
  <div class="fab-space with-tabbar" />

  <section class="summary">
    <h3>结算汇总</h3>
    <div class="sum-line">
      工日 {{ result.workDays }} ×
      <input v-model="laborUnitPrice" class="price" type="number" inputmode="decimal" />
      =
      <strong>{{ result.laborFee }}</strong>
    </div>
    <div v-for="x in extras" :key="x.id" class="extra-row">
      <span>{{ x.name }} = {{ x.amount }}</span>
      <button
        class="linkish"
        type="button"
        @click="
          api
            .removeExtra(x.id)
            .then(refresh)
            .catch((e) => (err = e.message))
        "
      >
        删除
      </button>
    </div>
    <label>零星名称</label>
    <input v-model="extraName" placeholder="名称" />
    <label>金额</label>
    <input v-model="extraAmount" type="number" inputmode="decimal" placeholder="0" />
    <div class="btn-row">
      <button class="btn btn-ghost" type="button" @click="addExtra">添加零星</button>
      <button class="btn btn-primary" type="button" @click="saveRates">保存单价</button>
    </div>
    <div class="total">总计 {{ result.total }} 元</div>
  </section>

  <div class="card btn-row" style="margin-top: 14px">
    <button class="btn btn-primary" type="button" @click="exportXls">导出表格</button>
    <button class="btn btn-ghost" type="button" @click="shareImage">结算图</button>
  </div>
  <canvas ref="canvasRef" style="display: none" />
  <SettlementPreview
    :open="previewOpen"
    :src="previewSrc"
    :title="ledger?.name || '结算图'"
    @close="previewOpen = false"
  />
</template>
