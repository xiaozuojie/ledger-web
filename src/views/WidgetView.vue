<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api/ledgerApi.js'
import { computePersonal } from '../calc/personal.js'
import { getToken } from '../lib/session.js'
import { todayStr } from '../utils/date.js'
import PanghuMark from '../components/PanghuMark.vue'

const router = useRouter()
const ready = ref(false)
const name = ref('')
const figure = ref('—')
const caption = ref('今日')
const hint = ref('')

onMounted(async () => {
  if (!getToken()) {
    hint.value = '还没打开账本'
    ready.value = true
    return
  }
  try {
    const ledger = await api.getLedger()
    name.value = ledger.name || '胖虎记账'
    const entries = await api.listEntries()
    const today = todayStr()
    if (ledger.settlement_kind === 'personal') {
      const result = computePersonal({
        entries: entries.filter((e) => e.date === today),
        categories: ledger.categories
      })
      figure.value = String(result.expense)
      caption.value = '今日支出'
    } else {
      figure.value = String(entries.filter((e) => e.date === today).length)
      caption.value = '今日笔数'
    }
  } catch (e) {
    hint.value = e.message || '读不到账本'
  } finally {
    ready.value = true
  }
})
</script>

<template>
  <section class="widget-card">
    <PanghuMark />
    <p class="muted">胖虎记账</p>
    <h1>{{ name || '桌面摘要' }}</h1>
    <p class="widget-k">{{ caption }}</p>
    <p class="widget-n">{{ ready ? figure : '…' }}</p>
    <p v-if="hint" class="muted">{{ hint }}</p>
    <button class="btn btn-primary btn-block" type="button" @click="router.push({ name: 'home' })">
      打开账本
    </button>
    <p class="muted">用浏览器「添加到主屏幕」后，这个摘要可以单独放在桌面。它不是系统小组件。</p>
  </section>
</template>
