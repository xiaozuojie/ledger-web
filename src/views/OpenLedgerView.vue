<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as api from '../api/ledgerApi.js'
import { ledgerHomeRoute } from '../router.js'

const route = useRoute()
const router = useRouter()
const err = ref('正在打开账本…')

onMounted(async () => {
  const slug = route.params.slug
  if (!slug) {
    err.value = '链接无效'
    return
  }
  try {
    await api.openLedger(slug)
    router.replace(ledgerHomeRoute())
  } catch (e) {
    err.value = e.message || '打开失败'
  }
})
</script>

<template>
  <div class="card">
    <p>{{ err }}</p>
    <button class="btn btn-ghost" type="button" @click="router.push({ name: 'home' })">
      回首页
    </button>
  </div>
</template>
