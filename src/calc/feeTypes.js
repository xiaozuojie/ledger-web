import { parseTruckCount } from './trucks.js'
import { sumWorkDays, laborTotal } from './hours.js'

/** 内置类型 id，稳定不可删 */
export const BUILTIN_IDS = {
  truck: 'truck',
  labor: 'labor'
}

/** 已废止的内置零星 id，normalize 时丢弃 */
export const RETIRED_EXTRA_ID = 'extra'

export const PRESET_ICONS = [
  '🚚',
  '🚛',
  '🫧',
  '🧹',
  '👷',
  '👤',
  '📌',
  '⛽',
  '🧱',
  '💧',
  '🍽️',
  '🅿️',
  '🧰',
  '📦',
  '🚧',
  '💰',
  '🧾',
  '🗑️'
]

export const DEFAULT_FEE_GROUPS = [
  { id: 'g_vehicle', name: '车辆' },
  { id: 'g_labor', name: '人工' },
  { id: 'g_misc', name: '杂费' }
]

export function defaultGroupId(typeId) {
  if (typeId === BUILTIN_IDS.truck) return 'g_vehicle'
  if (typeId === BUILTIN_IDS.labor) return 'g_labor'
  return 'g_misc'
}

export function defaultIcon(typeId) {
  if (typeId === BUILTIN_IDS.truck) return '🚚'
  if (typeId === BUILTIN_IDS.labor) return '🧹'
  return '📌'
}

export function normalizeFeeGroups(list) {
  const custom = []
  const nameById = new Map()
  for (const raw of list || []) {
    if (!raw || !raw.id) continue
    const id = String(raw.id)
    const name = String(raw.name || '').trim()
    if (!name) continue
    if (DEFAULT_FEE_GROUPS.some((g) => g.id === id)) nameById.set(id, name)
    else if (!custom.some((g) => g.id === id)) custom.push({ id, name })
  }
  return [
    ...DEFAULT_FEE_GROUPS.map((g) => ({
      id: g.id,
      name: nameById.get(g.id) || g.name
    })),
    ...custom
  ]
}

export function filterFeeTypes(list, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return list || []
  return (list || []).filter((t) => String(t.name || '').toLowerCase().includes(q))
}

export function addFeeGroup(groups, name, id) {
  const n = String(name || '').trim()
  if (!n) throw new Error('请填写分组名称')
  const list = normalizeFeeGroups(groups)
  if (list.some((g) => g.name === n)) throw new Error('分组名称已存在')
  return [...list, { id: String(id), name: n }]
}

export function renameFeeGroup(groups, id, name) {
  const n = String(name || '').trim()
  if (!n) throw new Error('请填写分组名称')
  const list = normalizeFeeGroups(groups)
  if (list.some((g) => g.id !== id && g.name === n)) throw new Error('分组名称已存在')
  if (!list.some((g) => g.id === id)) throw new Error('分组不存在')
  return list.map((g) => (g.id === id ? { ...g, name: n } : g))
}

export function removeFeeGroup(groups, types, id) {
  if (DEFAULT_FEE_GROUPS.some((g) => g.id === id)) throw new Error('默认分组不能删除')
  if ((types || []).some((t) => t.groupId === id)) throw new Error('分组里还有类型，不能删除')
  return normalizeFeeGroups(groups).filter((g) => g.id !== id)
}

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   kind: 'qty'|'work_days'|'fixed',
 *   unit?: string,
 *   unitPrice?: number|null,
 *   builtin?: boolean,
 *   enabled?: boolean
 * }} FeeType
 */

/** @param {'mixed'|'labor'|string} kind */
export function defaultFeeTypes(kind) {
  const laborPrice = kind === 'labor' ? 300 : 230
  return [
    {
      id: BUILTIN_IDS.truck,
      name: '渣土车',
      kind: 'qty',
      unit: '车',
      unitPrice: 100,
      builtin: true,
      enabled: true,
      groupId: 'g_vehicle',
      icon: '🚚'
    },
    {
      id: BUILTIN_IDS.labor,
      name: kind === 'labor' ? '工时' : '做卫生',
      kind: 'work_days',
      unit: '人天',
      unitPrice: laborPrice,
      builtin: true,
      enabled: true,
      groupId: 'g_labor',
      icon: '🧹'
    }
  ]
}

/** @param {Partial<FeeType>[]} list */
export function normalizeFeeTypes(list, kind = 'mixed') {
  const defaults = defaultFeeTypes(kind)
  const byId = new Map()
  for (const d of defaults) byId.set(d.id, { ...d })
  for (const raw of list || []) {
    if (!raw || !raw.id) continue
    if (raw.id === RETIRED_EXTRA_ID) continue
    const prev = byId.get(raw.id) || {}
    const kindVal = raw.kind || prev.kind || 'qty'
    const typeId = String(raw.id)
    const rawGroup = String(raw.groupId || prev.groupId || '')
    const groupId = rawGroup.startsWith('g_') ? rawGroup : defaultGroupId(typeId)
    const icon = PRESET_ICONS.includes(raw.icon)
      ? raw.icon
      : PRESET_ICONS.includes(prev.icon)
        ? prev.icon
        : defaultIcon(typeId)
    byId.set(raw.id, {
      id: typeId,
      name: String(raw.name || prev.name || '未命名').trim() || '未命名',
      kind: ['qty', 'work_days', 'fixed'].includes(kindVal) ? kindVal : 'qty',
      unit: raw.unit != null ? String(raw.unit) : prev.unit || '次',
      unitPrice:
        raw.unitPrice != null && raw.unitPrice !== ''
          ? Number(raw.unitPrice)
          : prev.unitPrice != null
            ? Number(prev.unitPrice)
            : null,
      builtin: Boolean(prev.builtin || raw.builtin),
      enabled: raw.enabled === false ? false : true,
      groupId,
      icon
    })
  }
  // 内置按默认顺序，其后自定义按出现顺序
  const customOrder = (list || [])
    .map((x) => x && x.id)
    .filter((id) => id && id !== RETIRED_EXTRA_ID && !defaults.some((d) => d.id === id))
  const ordered = [
    ...defaults.map((d) => byId.get(d.id)),
    ...customOrder.map((id) => byId.get(id)).filter(Boolean)
  ]
  // 去重兜底
  const seen = new Set()
  return ordered.filter((t) => {
    if (!t || seen.has(t.id)) return false
    seen.add(t.id)
    return true
  })
}

/** 从账本对象取规范化类型 */
export function feeTypesOfLedger(ledger) {
  const kind = ledger?.settlement_kind || ledger?.settlementKind || 'mixed'
  return normalizeFeeTypes(ledger?.feeTypes || ledger?.fee_types, kind)
}

export function sumFeeQty(entries, typeId) {
  return (entries || []).reduce((s, e) => {
    const q = e?.fields?.feeQtys?.[typeId]
    return s + (Number(q) || 0)
  }, 0)
}

export function sumTruckQty(entries) {
  return (entries || []).reduce((s, e) => {
    const f = e.fields || {}
    return s + parseTruckCount(f.trucks || '')
  }, 0)
}

/**
 * 单类型金额与数量摘要
 * @returns {{ id: string, name: string, kind: string, qty: number, unitPrice: number|null, amount: number, unit?: string }}
 */
export function feeTypeAmount(type, { entries, rates, extras }) {
  const t = type
  if (!t || t.enabled === false) {
    return {
      id: t?.id || '',
      name: t?.name || '',
      kind: t?.kind || 'qty',
      qty: 0,
      unitPrice: null,
      amount: 0,
      unit: t?.unit
    }
  }
  if (t.id === BUILTIN_IDS.truck || (t.builtin && t.kind === 'qty' && t.id === 'truck')) {
    const qty = sumTruckQty(entries)
    const unitPrice =
      t.unitPrice != null && Number.isFinite(Number(t.unitPrice))
        ? Number(t.unitPrice)
        : Number(rates?.truckUnitPrice) || 0
    return {
      id: t.id,
      name: t.name,
      kind: 'qty',
      qty,
      unitPrice,
      amount: qty * unitPrice,
      unit: t.unit || '车'
    }
  }
  if (t.id === BUILTIN_IDS.labor) {
    const qty = sumWorkDays(entries)
    const unitPrice =
      t.unitPrice != null && Number.isFinite(Number(t.unitPrice))
        ? Number(t.unitPrice)
        : Number(rates?.laborUnitPrice) || 0
    return {
      id: t.id,
      name: t.name,
      kind: 'work_days',
      qty,
      unitPrice,
      amount: laborTotal(qty, unitPrice),
      unit: t.unit || '人天'
    }
  }
  void extras
  if (t.kind === 'fixed') {
    // 自定义 fixed：从 feeQtys 存金额（把 qty 当金额）
    const amount = sumFeeQty(entries, t.id)
    return {
      id: t.id,
      name: t.name,
      kind: 'fixed',
      qty: 0,
      unitPrice: null,
      amount,
      unit: t.unit || '元'
    }
  }
  // 自定义 qty
  const qty = sumFeeQty(entries, t.id)
  const unitPrice = Number(t.unitPrice) || 0
  return {
    id: t.id,
    name: t.name,
    kind: 'qty',
    qty,
    unitPrice,
    amount: qty * unitPrice,
    unit: t.unit || '次'
  }
}

/** 完整费用拆解 */
export function buildFeeBreakdown({ feeTypes, entries, rates, extras }) {
  const types = normalizeFeeTypes(feeTypes, 'mixed')
  return types
    .filter((t) => t.enabled !== false)
    .map((t) => feeTypeAmount(t, { entries, rates, extras }))
}
