<script setup>
import { onMounted, ref } from 'vue'
import * as api from '../api/ledgerApi.js'

const ledger = ref(null)
const feeTypes = ref([])
const err = ref('')
const hint = ref('')
const newType = ref({ name: '', kind: 'qty', unit: '车', unitPrice: '100' })

async function refresh() {
  err.value = ''
  try {
    ledger.value = await api.getLedger()
    feeTypes.value = ledger.value.feeTypes || (await api.listFeeTypes())
  } catch (e) {
    err.value = e.message
  }
}

onMounted(refresh)

async function saveType(t) {
  try {
    await api.updateFeeType(t.id, {
      name: t.name,
      unit: t.unit,
      unitPrice: t.unitPrice
    })
    hint.value = '已保存'
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

async function addType() {
  try {
    await api.addFeeType({
      name: newType.value.name,
      kind: newType.value.kind,
      unit: newType.value.unit,
      unitPrice: newType.value.unitPrice
    })
    newType.value = { name: '', kind: 'qty', unit: '车', unitPrice: '100' }
    hint.value = '已添加'
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

async function removeType(id) {
  if (!confirm('删除该自定义类型？已记数量将不再计入')) return
  try {
    await api.removeFeeType(id)
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

  <section class="card">
    <h3>已有类型</h3>
    <p class="muted" style="margin-top: -6px">内置可改名和单价；自定义可删</p>
    <div v-for="t in feeTypes" :key="t.id" class="fee-type-row">
      <label>{{ t.builtin ? '内置' : '自定义' }} · {{ t.name }}</label>
      <input v-model="t.name" placeholder="名称" />
      <template v-if="t.kind === 'qty'">
        <label>单位</label>
        <input v-model="t.unit" placeholder="车" />
        <label>单价</label>
        <input v-model="t.unitPrice" type="number" inputmode="decimal" />
      </template>
      <template v-else-if="t.kind === 'work_days'">
        <label>单价（元/人天）</label>
        <input v-model="t.unitPrice" type="number" inputmode="decimal" />
      </template>
      <p v-else class="muted">固定金额在记一笔时填写</p>
      <div class="btn-row" style="margin-top: 6px">
        <button class="btn btn-ghost" type="button" @click="saveType(t)">保存</button>
        <button
          v-if="!t.builtin"
          class="btn btn-ghost danger-ghost"
          type="button"
          @click="removeType(t.id)"
        >
          删除
        </button>
      </div>
    </div>
    <p v-if="!feeTypes.length" class="empty">还没有类型</p>
  </section>

  <section class="card">
    <h3>新增类型</h3>
    <label>名称</label>
    <input v-model="newType.name" placeholder="如 泡沫车" />
    <label>计价</label>
    <select v-model="newType.kind">
      <option value="qty">数量 × 单价</option>
      <option value="fixed">固定金额</option>
    </select>
    <label v-if="newType.kind === 'qty'">单位</label>
    <input v-if="newType.kind === 'qty'" v-model="newType.unit" placeholder="车" />
    <label v-if="newType.kind === 'qty'">默认单价</label>
    <input
      v-if="newType.kind === 'qty'"
      v-model="newType.unitPrice"
      type="number"
      inputmode="decimal"
    />
    <button class="btn btn-primary btn-block" type="button" style="margin-top: 10px" @click="addType">
      确认添加
    </button>
  </section>
</template>
