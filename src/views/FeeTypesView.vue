<script setup>
import { computed, onMounted, ref } from 'vue'
import * as api from '../api/ledgerApi.js'
import {
  DEFAULT_FEE_GROUPS,
  PRESET_ICONS,
  filterFeeTypes
} from '../calc/feeTypes.js'

const ledger = ref(null)
const feeTypes = ref([])
const feeGroups = ref([])
const err = ref('')
const hint = ref('')
const query = ref('')
const editing = ref(null)
const groupEditor = ref(false)
const newGroupName = ref('')
const groupDrafts = ref({})

const visible = computed(() => filterFeeTypes(feeTypes.value, query.value))

const shownGroups = computed(() => {
  const q = query.value.trim()
  return feeGroups.value.filter((g) => {
    const n = visible.value.filter((t) => t.groupId === g.id).length
    if (q) return n > 0
    return true
  })
})

const nothingMatched = computed(
  () => query.value.trim() && shownGroups.value.length === 0
)

function cards(g) {
  return visible.value.filter((t) => t.groupId === g.id)
}

function subtitle(t) {
  if (t.kind === 'qty') return `${t.unitPrice ?? 0} 元/${t.unit || '次'}`
  if (t.kind === 'work_days') return `${t.unitPrice ?? 0} 元/人天`
  return '记一笔时填写'
}

function isDefaultGroup(id) {
  return DEFAULT_FEE_GROUPS.some((g) => g.id === id)
}

async function refresh() {
  err.value = ''
  try {
    ledger.value = await api.getLedger()
    feeTypes.value = ledger.value.feeTypes || []
    feeGroups.value = ledger.value.feeGroups || []
    const drafts = {}
    for (const g of feeGroups.value) drafts[g.id] = g.name
    groupDrafts.value = drafts
  } catch (e) {
    err.value = e.message
  }
}

onMounted(refresh)

function openEdit(t) {
  editing.value = { ...t }
  hint.value = ''
}

function openAdd() {
  editing.value = {
    id: '',
    name: '',
    kind: 'qty',
    unit: '车',
    unitPrice: 100,
    groupId: 'g_misc',
    icon: '📌',
    builtin: false
  }
  hint.value = ''
}

async function saveEdit() {
  const t = editing.value
  if (!t) return
  err.value = ''
  try {
    if (!t.id) {
      await api.addFeeType({
        name: t.name,
        kind: t.kind,
        unit: t.unit,
        unitPrice: t.unitPrice,
        groupId: t.groupId,
        icon: t.icon
      })
      hint.value = '已添加'
    } else {
      await api.updateFeeType(t.id, {
        name: t.name,
        kind: t.kind,
        unit: t.unit,
        unitPrice: t.unitPrice,
        groupId: t.groupId,
        icon: t.icon
      })
      hint.value = '已保存'
    }
    editing.value = null
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

async function removeType(id) {
  if (!confirm('删除该自定义类型？已记数量将不再计入')) return
  try {
    await api.removeFeeType(id)
    editing.value = null
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

async function addGroup() {
  err.value = ''
  try {
    feeGroups.value = await api.addFeeGroup(newGroupName.value)
    newGroupName.value = ''
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

async function saveGroup(id) {
  err.value = ''
  try {
    await api.renameFeeGroup(id, groupDrafts.value[id])
    hint.value = '分组已保存'
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

async function deleteGroup(id) {
  err.value = ''
  try {
    await api.removeFeeGroup(id)
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}
</script>

<template>
  <header class="topbar">
    <div>
      <div class="brand-mark">胖虎记账</div>
      <h2>类型</h2>
      <div class="muted">{{ ledger?.name || '当前账本' }}</div>
    </div>
  </header>
  <p v-if="err" class="err">{{ err }}</p>
  <p v-if="hint" class="hint-ok">{{ hint }}</p>

  <input v-model="query" placeholder="搜索类型，如 泡沫车" />

  <p v-if="nothingMatched" class="empty">没有匹配的类型</p>

  <section v-for="g in shownGroups" :key="g.id" class="card">
    <h3>{{ g.name }}</h3>
    <div v-if="cards(g).length" class="type-grid">
      <button
        v-for="t in cards(g)"
        :key="t.id"
        type="button"
        class="type-tile"
        @click="openEdit(t)"
      >
        <span class="type-ico">{{ t.icon }}</span>
        <span class="type-name">{{ t.name }}</span>
        <span class="muted">{{ subtitle(t) }}</span>
      </button>
    </div>
    <p v-else class="empty">暂无类型</p>
  </section>

  <button class="btn btn-primary btn-block" type="button" @click="openAdd">新增类型</button>
  <button class="btn btn-ghost btn-block" type="button" style="margin-top: 8px" @click="groupEditor = !groupEditor">
    {{ groupEditor ? '收起分组' : '管理分组' }}
  </button>

  <section v-if="groupEditor" class="card">
    <h3>分组</h3>
    <div v-for="g in feeGroups" :key="g.id" class="group-row">
      <input v-model="groupDrafts[g.id]" />
      <button class="btn btn-ghost" type="button" @click="saveGroup(g.id)">保存</button>
      <button
        v-if="!isDefaultGroup(g.id)"
        class="btn btn-ghost"
        type="button"
        @click="deleteGroup(g.id)"
      >
        删除
      </button>
    </div>
    <label>新分组</label>
    <input v-model="newGroupName" placeholder="如 材料" />
    <button class="btn btn-primary btn-block" type="button" style="margin-top: 8px" @click="addGroup">
      添加分组
    </button>
  </section>

  <section v-if="editing" class="card">
    <h3>{{ editing.id ? '编辑类型' : '新增类型' }}</h3>
    <label>名称</label>
    <input v-model="editing.name" placeholder="如 泡沫车" />
    <label>图标</label>
    <div class="icon-pick">
      <button
        v-for="ico in PRESET_ICONS"
        :key="ico"
        type="button"
        :class="{ selected: editing.icon === ico }"
        @click="editing.icon = ico"
      >
        {{ ico }}
      </button>
    </div>
    <label>分组</label>
    <div class="btn-row">
      <button
        v-for="g in feeGroups"
        :key="g.id"
        type="button"
        class="btn btn-ghost"
        :class="{ 'btn-primary': editing.groupId === g.id }"
        @click="editing.groupId = g.id"
      >
        {{ g.name }}
      </button>
    </div>
    <template v-if="!editing.builtin">
      <label>计价</label>
      <select v-model="editing.kind">
        <option value="qty">数量 × 单价</option>
        <option value="fixed">固定金额</option>
      </select>
    </template>
    <template v-if="editing.kind === 'qty'">
      <label>单位</label>
      <input v-model="editing.unit" placeholder="车" />
      <label>单价</label>
      <input v-model="editing.unitPrice" type="number" inputmode="decimal" />
    </template>
    <template v-else-if="editing.kind === 'work_days'">
      <label>单价（元/人天）</label>
      <input v-model="editing.unitPrice" type="number" inputmode="decimal" />
    </template>
    <p v-else class="muted">固定金额在记一笔时填写</p>
    <div class="btn-row" style="margin-top: 10px">
      <button class="btn btn-primary" type="button" @click="saveEdit">保存</button>
      <button class="btn btn-ghost" type="button" @click="editing = null">取消</button>
      <button
        v-if="editing.id && !editing.builtin"
        class="btn btn-ghost"
        type="button"
        @click="removeType(editing.id)"
      >
        删除
      </button>
    </div>
  </section>
</template>
