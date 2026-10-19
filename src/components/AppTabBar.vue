<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getSession } from '../lib/session.js'

const route = useRoute()
const router = useRouter()

const kind = computed(() => getSession()?.settlement_kind || 'mixed')

const tabs = computed(() => {
  if (kind.value === 'personal') {
    return [
      { name: 'personal-today', label: '今日', path: '/personal/today' },
      { name: 'stats', label: '统计', path: '/stats' },
      { name: 'mine', label: '我的', path: '/mine' }
    ]
  }
  if (kind.value === 'labor') {
    return [
      { name: 'labor', label: '明细', path: '/ledger/labor' },
      { name: 'stats', label: '统计', path: '/stats' },
      { name: 'mine', label: '我的', path: '/mine' }
    ]
  }
  return [
    { name: 'today', label: '今日', path: '/today' },
    { name: 'mixed', label: '样表', path: '/ledger/mixed' },
    { name: 'stats', label: '统计', path: '/stats' },
    { name: 'mine', label: '我的', path: '/mine' }
  ]
})

const active = computed(() => route.name)

function go(tab) {
  if (route.path === tab.path) return
  router.push(tab.path)
}
</script>

<template>
  <nav class="tabbar" aria-label="主导航">
    <button
      v-for="tab in tabs"
      :key="tab.name"
      type="button"
      class="tab"
      :class="{ active: active === tab.name }"
      @click="go(tab)"
    >
      <span class="tab-label">{{ tab.label }}</span>
    </button>
  </nav>
</template>
