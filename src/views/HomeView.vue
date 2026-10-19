<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { hasSupabase } from '../lib/supabase.js'
import * as api from '../api/ledgerApi.js'
import { cloudConfigured, dataMode } from '../api/ledgerApi.js'
import { ledgerHomeRoute } from '../router.js'
import { aggregateHomeStats } from '../calc/homeStats.js'
import { getAuthUser, onAuthChange, signOut } from '../lib/auth.js'
import { clearSession } from '../lib/session.js'
import PanghuTip from '../components/PanghuTip.vue'

const router = useRouter()
const templates = ref([])
const ledgers = ref([])
const err = ref('')
const status = ref('')
const stats = ref(null)
const user = ref(null)
let unsubAuth = () => {}

const createForm = ref({
  name: '',
  mode: 'field_mixed'
})

function kindLabel(kind) {
  if (kind === 'personal') return '个人'
  if (kind === 'mixed') return '现场·综合'
  if (kind === 'labor') return '现场·工时'
  return kind || '账本'
}

const compositionMax = computed(() => {
  const list = stats.value?.composition || []
  if (!list.length) return 1
  return Math.max(...list.map((x) => x.amount), 1)
})

const tipCtx = computed(() => ({
  hasLedgers: ledgers.value.length > 0
}))

const needLogin = computed(
  () => cloudConfigured && dataMode === 'supabase' && !user.value
)

async function load() {
  user.value = await getAuthUser()
  if (dataMode === 'local') {
    status.value =
      '当前为浏览器本地模式：本机可完整记账；换手机/清缓存会丢数据。配置 Supabase 并登录后可云端同步「我的账本」。'
  } else if (cloudConfigured && user.value) {
    status.value = `云端已登录：${user.value.email || user.value.id}。下列为你账号下的账本。`
  } else if (cloudConfigured && !user.value) {
    status.value = '已配置云端，请先登录后查看/创建「我的账本」。仍可用链接打开别人分享的账本。'
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
    try {
      const bundles = await api.listAllLedgerBundles()
      stats.value = aggregateHomeStats(bundles)
    } catch {
      stats.value = null
    }
  } catch (e) {
    err.value = e.message
  }
}

onMounted(() => {
  load()
  unsubAuth = onAuthChange((u) => {
    user.value = u
    load()
  })
})

onUnmounted(() => unsubAuth())

async function onSignOut() {
  clearSession()
  await signOut()
  user.value = null
  await load()
}

async function onCreate() {
  err.value = ''
  if (needLogin.value) {
    err.value = '请先登录再创建云端账本'
    router.push({ name: 'auth' })
    return
  }
  try {
    await api.createLedgerByMode({
      name: createForm.value.name,
      mode: createForm.value.mode
    })
    router.push(ledgerHomeRoute())
  } catch (e) {
    err.value = e.message
  }
}

async function enterLedger(slug) {
  err.value = ''
  try {
    await api.openLedger(slug, { asOwner: true })
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

async function downloadBackup() {
  err.value = ''
  try {
    const data = await api.exportBackup()
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `panghu-ledger-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  } catch (e) {
    err.value = e.message
  }
}

function onBackupFile(ev) {
  const file = ev.target?.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    err.value = ''
    try {
      if (
        !confirm(
          '导入将覆盖本机全部账本数据，且退出当前会话。确定？'
        )
      ) {
        return
      }
      const r = await api.importBackup(String(reader.result || ''))
      alert(`已导入 ${r.ledgerCount} 本账，请重新进入`)
      await load()
    } catch (e) {
      err.value = e.message
    }
  }
  reader.readAsText(file, 'utf-8')
  ev.target.value = ''
}
</script>

<template>
  <header class="page-hero">
    <div class="brand-mark">PANGHU</div>
    <h1>胖虎记账</h1>
    <p class="lead">现场账 · 个人账 · 今日流水</p>
    <button class="btn btn-ghost" type="button" @click="router.push({ name: 'widget' })">
      桌面摘要
    </button>
  </header>

  <PanghuTip :ctx="tipCtx" />
  <p v-if="status" class="card muted" style="margin-bottom: 12px">{{ status }}</p>
  <p v-if="err" class="err">{{ err }}</p>

  <section v-if="cloudConfigured" class="card" style="margin-bottom: 12px">
    <h3>账号</h3>
    <template v-if="user">
      <p class="muted" style="margin: 0 0 10px">{{ user.email }}</p>
      <button class="btn btn-ghost btn-block" type="button" @click="onSignOut">
        退出登录
      </button>
    </template>
    <template v-else>
      <p class="muted" style="margin: 0 0 10px">登录后云端同步「我的账本」</p>
      <div class="btn-row">
        <button class="btn btn-primary" type="button" @click="router.push({ name: 'auth' })">
          登录
        </button>
        <button
          class="btn btn-ghost"
          type="button"
          @click="router.push({ name: 'auth', query: { mode: 'signup' } })"
        >
          注册
        </button>
      </div>
    </template>
  </section>

  <template v-if="stats">
    <section class="card">
      <h3>按时间</h3>
      <div class="stat-time-grid">
        <div class="stat-time-card">
          <span class="k">今日</span>
          <strong>{{ stats.byTime.today.amount }}</strong>
          <span class="muted">{{ stats.byTime.today.count }} 笔</span>
        </div>
        <div class="stat-time-card">
          <span class="k">本周</span>
          <strong>{{ stats.byTime.week.amount }}</strong>
          <span class="muted">{{ stats.byTime.week.count }} 笔</span>
        </div>
        <div class="stat-time-card">
          <span class="k">本月</span>
          <strong>{{ stats.byTime.month.amount }}</strong>
          <span class="muted">{{ stats.byTime.month.count }} 笔</span>
        </div>
      </div>
    </section>

    <section class="card">
      <h3>按费用构成（本月）</h3>
      <div v-if="!stats.composition.length" class="empty">本月暂无金额</div>
      <div v-for="c in stats.composition" :key="c.id" class="comp-row">
        <div class="comp-head">
          <span>{{ c.name }}</span>
          <span>{{ c.amount }} · {{ c.pct }}%</span>
        </div>
        <div class="comp-bar">
          <i :style="{ width: (c.amount / compositionMax) * 100 + '%' }" />
        </div>
      </div>
      <p v-if="stats.composition.length" class="muted" style="margin-top: 8px">
        本月合计 {{ stats.compositionTotal }} 元
      </p>
    </section>

    <section class="card">
      <h3>按账本</h3>
      <div
        v-for="l in stats.byLedger"
        :key="'s-' + l.id"
        class="ledger-stat"
        @click="enterLedger(l.invite_slug)"
      >
        <div class="title">{{ l.name }}</div>
        <div class="muted">
          {{ l.entryCount }} 笔
          <template v-if="l.truckCount"> · {{ l.truckCount }} 车</template>
          <template v-if="l.workDays"> · {{ l.workDays }} 人天</template>
        </div>
        <strong class="amt">{{ l.total }} 元</strong>
      </div>
      <p v-if="!stats.byLedger.length" class="empty">暂无账本数据</p>
    </section>
  </template>

  <section class="card">
    <h3>{{ cloudConfigured ? '我的账本' : '全部账本' }}</h3>
    <p v-if="needLogin" class="empty">登录后显示云端账本</p>
    <div v-for="l in ledgers" :key="l.id" class="ledger-item">
      <div @click="enterLedger(l.invite_slug)" style="cursor: pointer">
        <div class="title">{{ l.name }}</div>
        <div class="muted">
          <span class="chip">{{ kindLabel(l.settlement_kind) }}</span>
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
    <label>账本类型</label>
    <div class="mode-grid">
      <button
        type="button"
        class="mode-card"
        :class="{ active: createForm.mode === 'field_mixed' }"
        @click="createForm.mode = 'field_mixed'"
      >
        <strong>现场·综合</strong>
        <span class="muted">渣土车 / 做卫生</span>
      </button>
      <button
        type="button"
        class="mode-card"
        :class="{ active: createForm.mode === 'field_labor' }"
        @click="createForm.mode = 'field_labor'"
      >
        <strong>现场·工时</strong>
        <span class="muted">纯人天记账</span>
      </button>
      <button
        type="button"
        class="mode-card"
        :class="{ active: createForm.mode === 'personal' }"
        @click="createForm.mode = 'personal'"
      >
        <strong>个人账</strong>
        <span class="muted">分类收支 · 预算</span>
      </button>
    </div>
    <label>账本名称</label>
    <input
      v-model="createForm.name"
      :placeholder="
        createForm.mode === 'personal' ? '如 日常开销' : '如 9月渣土车卫生'
      "
    />
    <button class="btn btn-primary btn-block" type="button" @click="onCreate">
      创建并进入
    </button>
  </section>

  <section class="card">
    <h3>本机备份</h3>
    <p class="muted" style="margin-top: -6px">
      数据在浏览器本地；清缓存会丢。请定期导出 JSON。
    </p>
    <button class="btn btn-primary btn-block" type="button" @click="downloadBackup">
      导出备份
    </button>
    <label class="btn btn-ghost btn-block" style="margin-top: 8px; text-align: center">
      导入备份
      <input
        type="file"
        accept="application/json,.json"
        style="display: none"
        @change="onBackupFile"
      />
    </label>
  </section>
</template>
