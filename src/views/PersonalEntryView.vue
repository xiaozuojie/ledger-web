<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as api from '../api/ledgerApi.js'
import { todayStr } from '../utils/date.js'

const route = useRoute()
const router = useRouter()
const err = ref('')
const saving = ref(false)
const date = ref(todayStr())
const amount = ref('')
const direction = ref('expense')
const categoryId = ref('food')
const note = ref('')
const categories = ref([])
const accounts = ref([])
const accountId = ref('')
const entryId = computed(() => route.query.id || '')

const filteredCats = computed(() =>
  categories.value.filter((c) => c.direction === direction.value)
)

onMounted(async () => {
  try {
    const led = await api.getLedger()
    categories.value = led.categories || []
    accounts.value = led.accounts || []
    if (route.query.direction === 'income') direction.value = 'income'
    if (!entryId.value) {
      const first = filteredCats.value[0]
      if (first) categoryId.value = first.id
      if (accounts.value[0]) accountId.value = accounts.value[0].id
      return
    }
    const list = await api.listEntries()
    const row = list.find((e) => e.id === entryId.value)
    if (!row) {
      err.value = '明细不存在'
      return
    }
    date.value = row.date
    amount.value = String(row.fields?.amount ?? '')
    direction.value = row.fields?.direction === 'income' ? 'income' : 'expense'
    categoryId.value = row.fields?.categoryId || 'food'
    note.value = row.fields?.note || row.summary || ''
    accountId.value = row.fields?.accountId || ''
  } catch (e) {
    err.value = e.message
  }
})

function onDirection(d) {
  direction.value = d
  const first = categories.value.find((c) => c.direction === d)
  if (first) categoryId.value = first.id
}

async function save() {
  if (saving.value) return
  const n = Number(amount.value)
  if (!n || n < 0) {
    err.value = '请填写有效金额'
    return
  }
  err.value = ''
  saving.value = true
  try {
    const summary = note.value || filteredCats.value.find((c) => c.id === categoryId.value)?.name || ''
    await api.upsertEntry({
      id: entryId.value || null,
      date: date.value,
      groups: [],
      overrideTotal: null,
      fields: {
        amount: n,
        direction: direction.value,
        categoryId: categoryId.value,
        note: note.value,
        accountId: accountId.value || null
      },
      summary,
      extras: []
    })
    router.push({ name: 'personal-today' })
  } catch (e) {
    err.value = e.message
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!entryId.value) return
  if (!confirm('删除该笔？')) return
  try {
    await api.removeEntry(entryId.value)
    router.push({ name: 'personal-today' })
  } catch (e) {
    err.value = e.message
  }
}
</script>

<template>
  <header class="topbar">
    <div>
      <h2>{{ entryId ? '编辑' : '记一笔' }}</h2>
      <div class="muted">个人收支</div>
    </div>
    <div class="actions">
      <button class="btn btn-ghost" type="button" @click="router.push({ name: 'personal-today' })">
        返回
      </button>
    </div>
  </header>
  <p v-if="err" class="err">{{ err }}</p>
  <div class="card">
    <div class="btn-row" style="margin-bottom: 12px">
      <button
        class="btn"
        :class="direction === 'expense' ? 'btn-primary' : 'btn-ghost'"
        type="button"
        @click="onDirection('expense')"
      >
        支出
      </button>
      <button
        class="btn"
        :class="direction === 'income' ? 'btn-primary' : 'btn-ghost'"
        type="button"
        @click="onDirection('income')"
      >
        收入
      </button>
    </div>
    <label>金额</label>
    <input v-model="amount" type="number" inputmode="decimal" placeholder="0" autofocus />
    <label>日期</label>
    <input v-model="date" type="date" />
    <label>分类</label>
    <div class="cat-grid">
      <button
        v-for="c in filteredCats"
        :key="c.id"
        type="button"
        class="cat-chip"
        :class="{ active: categoryId === c.id }"
        @click="categoryId = c.id"
      >
        {{ c.icon }} {{ c.name }}
      </button>
    </div>
    <label>备注</label>
    <input v-model="note" placeholder="可选" />
    <label v-if="accounts.length">账户</label>
    <select v-if="accounts.length" v-model="accountId">
      <option value="">不关联</option>
      <option v-for="a in accounts" :key="a.id" :value="a.id">
        {{ a.name }}（余额 {{ a.balance }}）
      </option>
    </select>
  </div>
  <div class="btn-row">
    <button v-if="entryId" class="btn btn-ghost" type="button" @click="remove">删除</button>
    <button
      class="btn btn-primary"
      type="button"
      :disabled="saving"
      :style="entryId ? '' : 'grid-column: 1 / -1'"
      @click="save"
    >
      {{ saving ? '保存中…' : '保存' }}
    </button>
  </div>
  <div class="fab-space" />
</template>

<style scoped>
.cat-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.cat-chip {
  appearance: none;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 14px;
  color: var(--text);
}
.cat-chip.active {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-dark);
  font-weight: 600;
}
</style>
