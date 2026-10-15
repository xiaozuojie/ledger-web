<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { hasSupabase } from '../lib/supabase.js'
import * as api from '../api/ledgerApi.js'
import { dataMode } from '../api/ledgerApi.js'
import { ledgerHomeRoute } from '../router.js'

const router = useRouter()
const templates = ref([])
const ledgers = ref([])
const err = ref('')
const status = ref('')

const createForm = ref({
  name: '',
  templateId: ''
})

async function load() {
  if (dataMode === 'local') {
    status.value =
      '当前为浏览器本地模式：本机可完整记账；换手机/清缓存会丢数据，也无法多人实时共用。若要联网共用，把 Supabase 的 URL 和 anon key 发给我即可升级。'
  } else if (!hasSupabase) {
    status.value = 'Supabase 未配置，已回退本地模式。'
  }
  try {
    const [tpl, list] = await Promise.all([
      api.listTemplates(),
      api.listLedgers()
    ])
    templates.value = tpl
    ledgers.value = list
    if (templates.value.length && !createForm.value.templateId) {
      createForm.value.templateId = templates.value[0].id
    }
  } catch (e) {
    err.value = e.message
  }
}

onMounted(load)

async function onCreate() {
  err.value = ''
  try {
    await api.createLedger({
      name: createForm.value.name,
      templateId: createForm.value.templateId
    })
    router.push(ledgerHomeRoute())
  } catch (e) {
    err.value = e.message
  }
}

async function enterLedger(slug) {
  err.value = ''
  try {
    await api.openLedger(slug)
    router.push(ledgerHomeRoute())
  } catch (e) {
    err.value = e.message
  }
}

function shareUrl(slug) {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(
    /\/?$/,
    '/'
  )
  return `${base}l/${slug}`
}

async function copyLink(slug) {
  try {
    await navigator.clipboard.writeText(shareUrl(slug))
    alert('链接已复制，发给别人即可直接打开')
  } catch {
    prompt('复制链接', shareUrl(slug))
  }
}
</script>

<template>
  <header class="page-hero">
    <h1>记账工时</h1>
    <p class="lead">手机也能顺手记 · 开放账本，点进即用</p>
  </header>

  <p v-if="status" class="card muted" style="margin-bottom: 12px">{{ status }}</p>
  <p v-if="err" class="err">{{ err }}</p>

  <section class="card">
    <h3>全部账本</h3>
    <div v-for="l in ledgers" :key="l.id" class="ledger-item">
      <div @click="enterLedger(l.invite_slug)" style="cursor: pointer">
        <div class="title">{{ l.name }}</div>
        <div class="muted">
          <span class="chip">{{
            l.settlement_kind === 'mixed' ? '综合' : '工时'
          }}</span>
          {{ l.invite_slug }}
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-ghost" type="button" @click="copyLink(l.invite_slug)">
          复制链接
        </button>
        <button class="btn btn-primary" type="button" @click="enterLedger(l.invite_slug)">
          进入
        </button>
      </div>
    </div>
    <p v-if="!ledgers.length" class="empty">暂无账本，往下创建即可</p>
  </section>

  <section class="card">
    <h3>创建新账本</h3>
    <label>账本名称</label>
    <input v-model="createForm.name" placeholder="如 9月渣土车卫生" />
    <label>模板</label>
    <select v-model="createForm.templateId">
      <option v-for="t in templates" :key="t.id" :value="t.id">
        {{ t.name }}{{ t.builtin ? '（内置）' : '' }}
      </option>
    </select>
    <button class="btn btn-primary btn-block" type="button" @click="onCreate">
      创建并进入
    </button>
  </section>
</template>
