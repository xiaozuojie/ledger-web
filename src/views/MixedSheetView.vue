<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api/ledgerApi.js'
import { getSession } from '../lib/session.js'
import { rowWorkDays } from '../calc/hours.js'
import { computeMixed } from '../calc/settlement.js'

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

const rows = computed(() =>
  entries.value.map((e) => ({
    id: e.id,
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

function addEntry() {
  router.push({ name: 'entry', query: { kind: 'mixed' } })
}
function editEntry(id) {
  router.push({ name: 'entry', query: { kind: 'mixed', id } })
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

  <div class="entry-list">
    <div
      v-for="row in rows"
      :key="row.id"
      class="entry-card"
      @click="editEntry(row.id)"
    >
      <div class="head">
        <span class="date">{{ row.date }}</span>
        <span class="days">{{ row.workDays }} 人天</span>
      </div>
      <div class="meta" v-if="row.trucks">车次：{{ row.trucks }}</div>
      <div class="meta">{{ row.laborNote || '（无人工说明）' }}</div>
    </div>
    <div v-if="!rows.length" class="card empty">暂无明细，点下方新建</div>
  </div>

  <div class="table-wrap card" style="padding: 0">
    <table class="sheet">
      <thead>
        <tr>
          <th>日期</th>
          <th>渣土车数</th>
          <th>做卫生人工记录</th>
          <th>折合人天</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="'t-' + row.id"
          style="cursor: pointer"
          @click="editEntry(row.id)"
        >
          <td>{{ row.date }}</td>
          <td>{{ row.trucks }}</td>
          <td>{{ row.laborNote }}</td>
          <td>{{ row.workDays }}</td>
        </tr>
        <tr v-if="!rows.length">
          <td colspan="4" class="muted">暂无明细</td>
        </tr>
      </tbody>
    </table>
  </div>

  <button class="btn btn-primary fab with-tabbar" type="button" @click="addEntry">
    ＋ 新建一行
  </button>
  <div class="fab-space with-tabbar" />

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
    <div v-for="x in extras" :key="x.id" class="extra-row">
      <span>{{ x.name }} = {{ x.amount }}</span>
      <button class="linkish" type="button" @click="removeExtra(x.id)">删除</button>
    </div>
    <div class="extra-add">
      <input v-model="extraName" placeholder="零星名称" />
      <input
        v-model="extraAmount"
        type="number"
        inputmode="decimal"
        placeholder="金额"
      />
      <button class="btn btn-ghost" type="button" @click="addExtra">加</button>
    </div>
    <div class="total">总计 {{ result.total }} 元</div>
  </section>
</template>
