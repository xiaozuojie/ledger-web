<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as api from '../api/ledgerApi.js'
import { ledgerHomeRoute } from '../router.js'

const route = useRoute()
const router = useRouter()
const err = ref('')
const pin = ref('')
const needPin = ref(false)
const opening = ref(false)

async function open() {
  const slug = route.params.slug
  if (!slug) {
    err.value = '链接无效'
    return
  }
  opening.value = true
  err.value = ''
  try {
    await api.openLedger(slug, { pin: pin.value })
    router.replace(ledgerHomeRoute())
  } catch (e) {
    const msg = e.message || '打开失败'
    err.value = msg
    needPin.value = /口令|成员/.test(msg)
  } finally {
    opening.value = false
  }
}

open()
</script>

<template>
  <div class="card">
    <p>{{ err || (opening ? '正在打开账本…' : '') }}</p>
    <template v-if="needPin">
      <label>成员口令</label>
      <input v-model="pin" placeholder="向主人要的口令" />
      <button class="btn btn-primary btn-block" type="button" style="margin-top: 8px" @click="open">
        进入
      </button>
    </template>
    <button class="btn btn-ghost" type="button" @click="router.push({ name: 'home' })">
      回首页
    </button>
  </div>
</template>
