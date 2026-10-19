<script setup>
import { computed, onMounted, ref } from 'vue'
import * as api from '../api/ledgerApi.js'
import { getSession } from '../lib/session.js'
import { computeMixed, computeLabor } from '../calc/settlement.js'
import { computePersonal } from '../calc/personal.js'
import { todayStr } from '../utils/date.js'

const ledger = ref(null)
const entries = ref([])
const extras = ref([])
const err = ref('')

const kind = computed(() => getSession()?.settlement_kind || 'mixed')
const monthPrefix = todayStr().slice(0, 7)

const rates = computed(() => ({
  truckUnitPrice: Number(ledger.value?.rates?.truckUnitPrice) || 0,
  laborUnitPrice: Number(ledger.value?.rates?.laborUnitPrice) || 0
}))

const personalResult = computed(() =>
  computePersonal({
    entries: entries.value,
    budget: ledger.value?.budget,
    categories: ledger.value?.categories,
    monthPrefix
  })
)

const fieldResult = computed(() => {
  const fn = kind.value === 'labor' ? computeLabor : computeMixed
  return fn({
    entries: entries.value,
    rates: rates.value,
    extras: extras.value,
    feeTypes: ledger.value?.feeTypes,
    ledger: ledger.value
  })
})

const composition = computed(() => {
  if (kind.value === 'personal') {
    const list = (personalResult.value.composition || []).filter(
      (x) => x.direction !== 'income' && x.amount > 0
    )
    const max = Math.max(...list.map((x) => x.amount), 1)
    const total = list.reduce((s, x) => s + x.amount, 0) || 1
    return list.map((x) => ({
      ...x,
      pct: Math.round((x.amount / total) * 1000) / 10,
      bar: (x.amount / max) * 100
    }))
  }
  const list = (fieldResult.value.feeBreakdown || []).filter((x) => x.amount > 0)
  const max = Math.max(...list.map((x) => x.amount), 1)
  const total = list.reduce((s, x) => s + x.amount, 0) || 1
  return list.map((x) => ({
    ...x,
    pct: Math.round((x.amount / total) * 1000) / 10,
    bar: (x.amount / max) * 100
  }))
})

const byDay = computed(() => {
  const map = new Map()
  for (const e of entries.value) {
    const d = e.date
    if (!map.has(d)) map.set(d, [])
    map.get(d).push(e)
  }
  const dates = [...map.keys()].sort((a, b) => String(b).localeCompare(String(a)))
  if (kind.value === 'personal') {
    return dates.map((date) => {
      const list = map.get(date)
      const r = computePersonal({
        entries: list,
        categories: ledger.value?.categories
      })
      return {
        date,
        count: list.length,
        total: r.expense,
        sub: `支 ${r.expense} · 收 ${r.income}`
      }
    })
  }
  const fn = kind.value === 'labor' ? computeLabor : computeMixed
  return dates.map((date) => {
    const list = map.get(date)
    const r = fn({
      entries: list,
      rates: rates.value,
      extras: [],
      feeTypes: ledger.value?.feeTypes,
      ledger: ledger.value
    })
    return {
      date,
      count: list.length,
      total: r.total,
      sub: `${r.truckCount || 0} 车 · ${r.workDays || 0} 人天`
    }
  })
})

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
</script>

<template>
  <header class="topbar">
    <div>
      <div class="brand-mark">胖虎记账</div>
      <h2>统计</h2>
      <div class="muted">{{ ledger?.name || '本账本' }}</div>
    </div>
  </header>

  <p v-if="err" class="err">{{ err }}</p>

  <section v-if="kind === 'personal'" class="card">
    <h3>本月</h3>
    <p style="margin: 0; font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums">
      支出 {{ personalResult.expense }}
    </p>
    <p class="muted" style="margin: 6px 0 0">
      收入 {{ personalResult.income }} · 结余 {{ personalResult.net }} ·
      {{ personalResult.entryCount }} 笔
    </p>
    <template v-if="personalResult.monthlyBudget">
      <div class="comp-head" style="margin-top: 12px">
        <span>预算 {{ personalResult.monthlyBudget }}</span>
        <span>{{ personalResult.budgetPct }}%</span>
      </div>
      <div class="comp-bar">
        <i :style="{ width: Math.min(100, personalResult.budgetPct) + '%' }" />
      </div>
    </template>
  </section>

  <section v-else class="card">
    <h3>账本合计</h3>
    <p style="margin: 0; font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums">
      {{ fieldResult.total }} <span class="muted" style="font-size: 14px">元</span>
    </p>
    <p class="muted" style="margin: 6px 0 0">
      {{ fieldResult.entryCount }} 笔
      <template v-if="fieldResult.truckCount"> · {{ fieldResult.truckCount }} 车</template>
      <template v-if="fieldResult.workDays"> · {{ fieldResult.workDays }} 人天</template>
    </p>
  </section>

  <section class="card">
    <h3>{{ kind === 'personal' ? '本月支出构成' : '费用构成' }}</h3>
    <div v-if="!composition.length" class="empty">暂无金额</div>
    <div v-for="c in composition" :key="c.id" class="comp-row">
      <div class="comp-head">
        <span>{{ c.name }}</span>
        <span>{{ c.amount }} · {{ c.pct }}%</span>
      </div>
      <div class="comp-bar">
        <i :style="{ width: c.bar + '%' }" />
      </div>
    </div>
  </section>

  <section class="card">
    <h3>按日小计</h3>
    <div v-if="!byDay.length" class="empty">暂无明细</div>
    <div v-for="d in byDay" :key="d.date" class="day-row-stat">
      <div>
        <div>{{ d.date }}</div>
        <div class="muted" style="font-size: 12px">{{ d.count }} 笔 · {{ d.sub }}</div>
      </div>
      <strong>{{ d.total }}</strong>
    </div>
  </section>

  <div class="fab-space with-tabbar" />
</template>
