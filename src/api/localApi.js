/**
 * 纯浏览器存储（localStorage）。同一手机/浏览器可完整使用；
 * 不同设备互不同步（无需 Supabase）。开放账本：本机列表可见。
 */
import {
  defaultFeeTypes,
  normalizeFeeTypes,
  normalizeFeeGroups,
  feeTypesOfLedger,
  addFeeGroup as addFeeGroupPure,
  renameFeeGroup as renameFeeGroupPure,
  removeFeeGroup as removeFeeGroupPure
} from '../calc/feeTypes.js'
import {
  defaultPersonalCategories,
  normalizeCategories
} from '../calc/personalCategories.js'
import {
  addMemberPure,
  matchMember,
  normalizeAccess,
  removeMemberPure
} from '../calc/members.js'
import { validateBackup, wrapBackup } from '../utils/backup.js'

const DB_KEY = 'ledger_web_local_db_v1'
const SESSION_KEY = 'ledger_web_session_v1'

const BUILTIN_TEMPLATES = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: '工时记录',
    builtin: true,
    fields: [
      { key: 'date', label: '日期', type: 'date', required: true },
      { key: 'groups', label: '工时分组', type: 'work_groups', required: true },
      {
        key: 'totalDays',
        label: '合计工日',
        type: 'number',
        computed: 'sum_groups'
      }
    ],
    settlement: {
      kind: 'labor',
      unitPriceKey: 'laborUnitPrice',
      defaultUnitPrice: 300
    }
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: '综合记账（渣土车/做卫生）',
    builtin: true,
    fields: [
      { key: 'date', label: '日期', type: 'date', required: true },
      { key: 'trucks', label: '渣土车数', type: 'truck', required: false },
      {
        key: 'laborNote',
        label: '做卫生人工记录',
        type: 'text',
        required: false
      },
      {
        key: 'groups',
        label: '工时分组',
        type: 'work_groups',
        required: false
      },
      {
        key: 'totalDays',
        label: '折合人天',
        type: 'number',
        computed: 'sum_groups'
      }
    ],
    settlement: {
      kind: 'mixed',
      truckUnitPrice: 100,
      laborUnitPrice: 230
    }
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: '个人收支',
    builtin: true,
    fields: [
      { key: 'date', label: '日期', type: 'date', required: true },
      { key: 'amount', label: '金额', type: 'number', required: true },
      { key: 'direction', label: '收支', type: 'text', required: true },
      { key: 'categoryId', label: '分类', type: 'text', required: true },
      { key: 'note', label: '备注', type: 'text', required: false }
    ],
    settlement: {
      kind: 'personal',
      defaultMonthlyBudget: 3000
    }
  }
]

const PERSONAL_TPL_ID = '33333333-3333-3333-3333-333333333333'

function defaultAccounts() {
  return [
    { id: 'cash', name: '现金', balance: 0 },
    { id: 'wechat', name: '微信', balance: 0 },
    { id: 'alipay', name: '支付宝', balance: 0 }
  ]
}

function ensureAccounts(led) {
  if (!led.accounts?.length) led.accounts = defaultAccounts()
  return led.accounts
}

function ensureGoals(led) {
  if (!Array.isArray(led.goals)) led.goals = []
  return led.goals
}

/** 按明细方向调整账户余额；reverse=true 表示撤销 */
function applyAccountDelta(led, fields, reverse = false) {
  if (!led || led.settlement_kind !== 'personal') return
  const aid = fields?.accountId
  if (!aid) return
  const accounts = ensureAccounts(led)
  const acc = accounts.find((a) => a.id === aid)
  if (!acc) return
  const amt = Math.abs(Number(fields.amount) || 0)
  if (!amt) return
  const sign = fields.direction === 'income' ? 1 : -1
  const delta = reverse ? -sign * amt : sign * amt
  acc.balance = Math.round(((Number(acc.balance) || 0) + delta) * 100) / 100
}

function uid() {
  return crypto.randomUUID()
}

function ensureBuiltinTemplates(db) {
  if (!db.templates?.length) {
    db.templates = BUILTIN_TEMPLATES.map((t) => ({ ...t }))
    return
  }
  for (const t of BUILTIN_TEMPLATES) {
    if (!db.templates.some((x) => x.id === t.id)) {
      db.templates.push({ ...t })
    }
  }
}

function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const db = JSON.parse(raw)
      ensureBuiltinTemplates(db)
      return db
    }
  } catch {
    /* ignore */
  }
  const db = {
    templates: BUILTIN_TEMPLATES.map((t) => ({ ...t })),
    ledgers: [],
    entries: {},
    extras: {}
  }
  saveDb(db)
  return db
}

function saveDb(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

function setSession(data) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data))
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
  } catch {
    return null
  }
}

function assertWriter() {
  if (getSession()?.role === 'viewer') {
    throw new Error('你是查看成员，不能修改')
  }
}

function assertOwner() {
  const role = getSession()?.role
  if (role && role !== 'owner') throw new Error('只有账本主人可以管理成员')
}

function getToken() {
  return getSession()?.session_token || ''
}

function requireSession() {
  const s = getSession()
  if (!s?.ledger_id) throw new Error('会话已过期，请从首页重新进入账本')
  return s
}

export async function listTemplates() {
  return loadDb().templates
}

export async function listLedgers() {
  return loadDb()
    .ledgers.slice()
    .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
    .map((l) => ({
      id: l.id,
      name: l.name,
      invite_slug: l.invite_slug,
      settlement_kind: l.settlement_kind,
      updated_at: l.updated_at
    }))
}

export async function createLedger({ name, templateId }) {
  const db = loadDb()
  const tpl = db.templates.find((t) => t.id === templateId)
  if (!tpl) throw new Error('模板不存在')
  if (!name?.trim()) throw new Error('请填写账本名称')
  const kind = tpl.settlement?.kind || 'labor'
  let rates
  if (kind === 'mixed') {
    rates = {
      truckUnitPrice: tpl.settlement.truckUnitPrice ?? 100,
      laborUnitPrice: tpl.settlement.laborUnitPrice ?? 230
    }
  } else if (kind === 'personal') {
    rates = {}
  } else {
    rates = {
      laborUnitPrice: tpl.settlement.defaultUnitPrice ?? 300,
      truckUnitPrice: tpl.settlement.truckUnitPrice ?? 100
    }
  }
  const ledger = {
    id: uid(),
    name: name.trim(),
    template_id: templateId,
    settlement_kind: kind,
    rates,
    feeTypes: kind === 'personal' ? [] : defaultFeeTypes(kind),
    feeGroups: kind === 'personal' ? [] : normalizeFeeGroups([]),
    categories:
      kind === 'personal' ? defaultPersonalCategories() : undefined,
    budget:
      kind === 'personal'
        ? { monthly: tpl.settlement?.defaultMonthlyBudget ?? 3000 }
        : undefined,
    accounts: kind === 'personal' ? defaultAccounts() : undefined,
    goals: kind === 'personal' ? [] : undefined,
    invite_slug: uid().replace(/-/g, '').slice(0, 10),
    accessMode: 'link',
    members: [],
    updated_at: Date.now()
  }
  db.ledgers.push(ledger)
  db.entries[ledger.id] = []
  db.extras[ledger.id] = []
  saveDb(db)
  const session = {
    ledger_id: ledger.id,
    invite_slug: ledger.invite_slug,
    session_token: uid(),
    settlement_kind: kind,
    name: ledger.name,
    role: 'owner'
  }
  setSession(session)
  return session
}

/** 快捷：按模式建账 mode = field_mixed | field_labor | personal */
export async function createLedgerByMode({ name, mode }) {
  const map = {
    field_mixed: '22222222-2222-2222-2222-222222222222',
    field_labor: '11111111-1111-1111-1111-111111111111',
    personal: PERSONAL_TPL_ID
  }
  const templateId = map[mode] || map.field_mixed
  return createLedger({ name, templateId })
}

export async function openLedger(inviteSlug, opts = {}) {
  const db = loadDb()
  const ledger = db.ledgers.find((l) => l.invite_slug === inviteSlug)
  if (!ledger) throw new Error('账本不存在或链接无效（本地模式：需在同一手机浏览器内创建）')
  const access = normalizeAccess(ledger)
  let role = 'editor'
  if (opts.asOwner) role = 'owner'
  else if (access.accessMode === 'members') {
    const member = matchMember(access.members, opts.pin)
    if (!member) throw new Error('这个账本只允许成员进入，请填写成员口令')
    role = member.role
  }
  ledger.updated_at = Date.now()
  saveDb(db)
  const session = {
    ledger_id: ledger.id,
    invite_slug: ledger.invite_slug,
    session_token: uid(),
    settlement_kind: ledger.settlement_kind,
    name: ledger.name,
    role
  }
  setSession(session)
  return session
}

export async function unlockLedger({ inviteSlug }) {
  return openLedger(inviteSlug)
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}

export async function getLedger() {
  const s = requireSession()
  const db = loadDb()
  const led = db.ledgers.find((l) => l.id === s.ledger_id)
  if (!led) throw new Error('账本不存在')
  const kind = led.settlement_kind || 'mixed'
  if (kind === 'personal') {
    if (!led.categories?.length) {
      led.categories = defaultPersonalCategories()
      saveDb(db)
    } else {
      led.categories = normalizeCategories(led.categories)
    }
    if (!led.budget) {
      led.budget = { monthly: 3000 }
      saveDb(db)
    }
    ensureAccounts(led)
    ensureGoals(led)
    saveDb(db)
  } else if (!led.feeTypes?.length) {
    led.feeTypes = defaultFeeTypes(kind)
    led.feeGroups = normalizeFeeGroups(led.feeGroups)
    saveDb(db)
  } else {
    led.feeTypes = normalizeFeeTypes(led.feeTypes, kind)
    led.feeGroups = normalizeFeeGroups(led.feeGroups)
    saveDb(db)
  }
  return {
    id: led.id,
    name: led.name,
    template_id: led.template_id,
    settlement_kind: kind,
    rates: led.rates,
    feeTypes: led.feeTypes || [],
    feeGroups: led.feeGroups || [],
    categories: led.categories,
    budget: led.budget,
    accounts: led.accounts,
    goals: led.goals,
    invite_slug: led.invite_slug,
    accessMode: normalizeAccess(led).accessMode,
    members: normalizeAccess(led).members
  }
}

export async function updateBudget(budget) {
  assertWriter()
  const s = requireSession()
  const db = loadDb()
  const led = db.ledgers.find((l) => l.id === s.ledger_id)
  if (!led) throw new Error('账本不存在')
  if (led.settlement_kind !== 'personal') throw new Error('仅个人账可设预算')
  led.budget = {
    monthly: Number(budget?.monthly) || 0
  }
  led.updated_at = Date.now()
  saveDb(db)
  return { ok: true, budget: led.budget }
}

/** 首页：本机全部账本 + 明细 + 零星（无需会话） */
export async function listAllLedgerBundles() {
  const db = loadDb()
  return db.ledgers.slice().map((led) => {
    const kind = led.settlement_kind || 'mixed'
    const feeTypes =
      kind === 'personal'
        ? []
        : led.feeTypes?.length
          ? normalizeFeeTypes(led.feeTypes, kind)
          : defaultFeeTypes(kind)
    return {
      id: led.id,
      name: led.name,
      invite_slug: led.invite_slug,
      settlement_kind: kind,
      rates: led.rates || {},
      feeTypes,
      categories:
        kind === 'personal'
          ? normalizeCategories(led.categories)
          : undefined,
      budget: led.budget,
      updated_at: led.updated_at,
      entries: (db.entries[led.id] || []).map(normalizeEntry),
      extras: (db.extras[led.id] || []).map((x) => ({
        id: x.id,
        name: x.name,
        amount: Number(x.amount) || 0
      }))
    }
  })
}

export async function listFeeTypes() {
  const led = await getLedger()
  return feeTypesOfLedger(led)
}

export async function addFeeType(payload) {
  assertWriter()
  const s = requireSession()
  const db = loadDb()
  const led = db.ledgers.find((l) => l.id === s.ledger_id)
  if (!led) throw new Error('账本不存在')
  const name = String(payload?.name || '').trim()
  if (!name) throw new Error('请填写类型名称')
  const kind = payload?.kind === 'fixed' ? 'fixed' : 'qty'
  const row = {
    id: uid(),
    name,
    kind,
    unit: String(payload?.unit || (kind === 'fixed' ? '元' : '次')).trim(),
    unitPrice: kind === 'qty' ? Number(payload?.unitPrice) || 0 : null,
    builtin: false,
    enabled: true,
    groupId: String(payload?.groupId || 'g_misc'),
    icon: payload?.icon || '📌'
  }
  const list = normalizeFeeTypes(
    [...(led.feeTypes || defaultFeeTypes(led.settlement_kind)), row],
    led.settlement_kind
  )
  led.feeTypes = list
  led.updated_at = Date.now()
  saveDb(db)
  return row
}

export async function updateFeeType(id, patch) {
  assertWriter()
  const s = requireSession()
  const db = loadDb()
  const led = db.ledgers.find((l) => l.id === s.ledger_id)
  if (!led) throw new Error('账本不存在')
  const list = normalizeFeeTypes(
    led.feeTypes || defaultFeeTypes(led.settlement_kind),
    led.settlement_kind
  )
  const idx = list.findIndex((t) => t.id === id)
  if (idx < 0) throw new Error('类型不存在')
  const cur = list[idx]
  if (patch.name != null) cur.name = String(patch.name).trim() || cur.name
  if (patch.unit != null) cur.unit = String(patch.unit)
  if (patch.unitPrice != null && patch.unitPrice !== '') {
    cur.unitPrice = Number(patch.unitPrice)
  }
  if (patch.enabled != null) cur.enabled = Boolean(patch.enabled)
  if (patch.kind != null && !cur.builtin) {
    cur.kind = patch.kind === 'fixed' ? 'fixed' : 'qty'
  }
  if (patch.groupId != null) cur.groupId = String(patch.groupId)
  if (patch.icon != null) cur.icon = patch.icon
  led.feeTypes = normalizeFeeTypes(list, led.settlement_kind)
  // 同步内置单价到 rates
  if (id === 'truck' && cur.unitPrice != null) {
    led.rates = { ...led.rates, truckUnitPrice: Number(cur.unitPrice) }
  }
  if (id === 'labor' && cur.unitPrice != null) {
    led.rates = { ...led.rates, laborUnitPrice: Number(cur.unitPrice) }
  }
  led.updated_at = Date.now()
  saveDb(db)
  return cur
}

export async function removeFeeType(id) {
  assertWriter()
  const s = requireSession()
  const db = loadDb()
  const led = db.ledgers.find((l) => l.id === s.ledger_id)
  if (!led) throw new Error('账本不存在')
  const list = normalizeFeeTypes(
    led.feeTypes || defaultFeeTypes(led.settlement_kind),
    led.settlement_kind
  )
  const t = list.find((x) => x.id === id)
  if (!t) throw new Error('类型不存在')
  if (t.builtin) throw new Error('内置类型不可删除')
  led.feeTypes = list.filter((x) => x.id !== id)
  led.updated_at = Date.now()
  saveDb(db)
  return { ok: true }
}

function requireLedger() {
  assertWriter()
  const s = requireSession()
  const db = loadDb()
  const led = db.ledgers.find((l) => l.id === s.ledger_id)
  if (!led) throw new Error('账本不存在')
  return { db, led }
}

export async function addFeeGroup(name) {
  const { db, led } = requireLedger()
  led.feeGroups = addFeeGroupPure(normalizeFeeGroups(led.feeGroups), name, 'g_' + uid())
  led.updated_at = Date.now()
  saveDb(db)
  return led.feeGroups
}

export async function renameFeeGroup(id, name) {
  const { db, led } = requireLedger()
  led.feeGroups = renameFeeGroupPure(normalizeFeeGroups(led.feeGroups), id, name)
  led.updated_at = Date.now()
  saveDb(db)
  return led.feeGroups
}

export async function removeFeeGroup(id) {
  const { db, led } = requireLedger()
  const types = normalizeFeeTypes(led.feeTypes || [], led.settlement_kind)
  led.feeGroups = removeFeeGroupPure(normalizeFeeGroups(led.feeGroups), types, id)
  led.updated_at = Date.now()
  saveDb(db)
  return led.feeGroups
}

export async function updateRates(rates) {
  assertWriter()
  const s = requireSession()
  const db = loadDb()
  const led = db.ledgers.find((l) => l.id === s.ledger_id)
  if (!led) throw new Error('账本不存在')
  led.rates = rates
  const types = normalizeFeeTypes(
    led.feeTypes || defaultFeeTypes(led.settlement_kind),
    led.settlement_kind
  )
  for (const t of types) {
    if (t.id === 'truck' && rates.truckUnitPrice != null) {
      t.unitPrice = Number(rates.truckUnitPrice)
    }
    if (t.id === 'labor' && rates.laborUnitPrice != null) {
      t.unitPrice = Number(rates.laborUnitPrice)
    }
  }
  led.feeTypes = types
  led.updated_at = Date.now()
  saveDb(db)
  return { ok: true, rates }
}

function normalizeExtras(list) {
  return (list || []).map((x) => ({
    id: x.id || uid(),
    name: x.name || '零星',
    amount: Number(x.amount) || 0
  }))
}

function normalizeEntry(e) {
  const fields = e.fields || {}
  const extras = normalizeExtras(
    e.extras || fields.dayExtras || fields.extras || []
  )
  return {
    _id: e.id,
    id: e.id,
    date: e.date,
    fields,
    groups: e.groups || [],
    overrideTotal: e.override_total != null ? Number(e.override_total) : null,
    summary: e.summary || '',
    extras
  }
}

export async function listEntries() {
  const s = requireSession()
  const db = loadDb()
  return (db.entries[s.ledger_id] || [])
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map(normalizeEntry)
}

export async function upsertEntry(payload) {
  assertWriter()
  const s = requireSession()
  const db = loadDb()
  const list = db.entries[s.ledger_id] || (db.entries[s.ledger_id] = [])
  const dayExtras = normalizeExtras(payload.extras)
  const fields = { ...(payload.fields || {}), dayExtras }
  const body = {
    id: payload.id || uid(),
    date: payload.date,
    fields,
    groups: payload.groups || [],
    extras: dayExtras,
    override_total:
      payload.overrideTotal != null && payload.overrideTotal !== ''
        ? Number(payload.overrideTotal)
        : null,
    summary: payload.summary || null
  }
  const led = db.ledgers.find((l) => l.id === s.ledger_id)
  const idx = list.findIndex((e) => e.id === body.id)
  if (idx >= 0) {
    applyAccountDelta(led, list[idx].fields, true)
    list[idx] = body
  } else {
    list.push(body)
  }
  applyAccountDelta(led, body.fields, false)
  if (led) led.updated_at = Date.now()
  saveDb(db)
  return { id: body.id }
}

export async function removeEntry(entryId) {
  assertWriter()
  const s = requireSession()
  const db = loadDb()
  const list = db.entries[s.ledger_id] || []
  const row = list.find((e) => e.id === entryId)
  const led = db.ledgers.find((l) => l.id === s.ledger_id)
  if (row) applyAccountDelta(led, row.fields, true)
  db.entries[s.ledger_id] = list.filter((e) => e.id !== entryId)
  saveDb(db)
  return { ok: true }
}

/** 批量写入个人明细（一句话/导入） */
export async function bulkAddPersonalEntries(items, { date, accountId } = {}) {
  assertWriter()
  const s = requireSession()
  const db = loadDb()
  const led = db.ledgers.find((l) => l.id === s.ledger_id)
  if (!led || led.settlement_kind !== 'personal') {
    throw new Error('仅个人账支持批量记入')
  }
  const list = db.entries[s.ledger_id] || (db.entries[s.ledger_id] = [])
  const day = date || new Date().toISOString().slice(0, 10)
  const ids = []
  for (const it of items || []) {
    const amount = Math.abs(Number(it.amount) || 0)
    if (!amount) continue
    const fields = {
      amount,
      direction: it.direction === 'income' ? 'income' : 'expense',
      categoryId: it.categoryId || 'other_out',
      note: it.note || '',
      accountId: accountId || it.accountId || null,
      dayExtras: []
    }
    const body = {
      id: uid(),
      date: it.date || day,
      fields,
      groups: [],
      extras: [],
      override_total: null,
      summary: fields.note || null
    }
    list.push(body)
    applyAccountDelta(led, fields, false)
    ids.push(body.id)
  }
  led.updated_at = Date.now()
  saveDb(db)
  return { ids, count: ids.length }
}

export async function listAccounts() {
  const led = await getLedger()
  return led.accounts || []
}

export async function upsertAccount({ id, name, balance }) {
  assertWriter()
  const s = requireSession()
  const db = loadDb()
  const led = db.ledgers.find((l) => l.id === s.ledger_id)
  if (!led || led.settlement_kind !== 'personal') throw new Error('仅个人账')
  const accounts = ensureAccounts(led)
  const n = String(name || '').trim()
  if (!n) throw new Error('请填写账户名')
  if (id) {
    const row = accounts.find((a) => a.id === id)
    if (!row) throw new Error('账户不存在')
    row.name = n
    if (balance != null && balance !== '') row.balance = Number(balance) || 0
  } else {
    accounts.push({ id: uid(), name: n, balance: Number(balance) || 0 })
  }
  led.updated_at = Date.now()
  saveDb(db)
  return { ok: true }
}

export async function removeAccount(id) {
  assertWriter()
  const s = requireSession()
  const db = loadDb()
  const led = db.ledgers.find((l) => l.id === s.ledger_id)
  if (!led) throw new Error('账本不存在')
  led.accounts = ensureAccounts(led).filter((a) => a.id !== id)
  saveDb(db)
  return { ok: true }
}

export async function listGoals() {
  const led = await getLedger()
  return led.goals || []
}

export async function upsertGoal({ id, name, target, current }) {
  assertWriter()
  const s = requireSession()
  const db = loadDb()
  const led = db.ledgers.find((l) => l.id === s.ledger_id)
  if (!led || led.settlement_kind !== 'personal') throw new Error('仅个人账')
  const goals = ensureGoals(led)
  const n = String(name || '').trim()
  if (!n) throw new Error('请填写目标名称')
  if (id) {
    const row = goals.find((g) => g.id === id)
    if (!row) throw new Error('目标不存在')
    row.name = n
    if (target != null) row.target = Number(target) || 0
    if (current != null) row.current = Number(current) || 0
  } else {
    goals.push({
      id: uid(),
      name: n,
      target: Number(target) || 0,
      current: Number(current) || 0
    })
  }
  led.updated_at = Date.now()
  saveDb(db)
  return { ok: true }
}

export async function removeGoal(id) {
  assertWriter()
  const s = requireSession()
  const db = loadDb()
  const led = db.ledgers.find((l) => l.id === s.ledger_id)
  if (!led) throw new Error('账本不存在')
  led.goals = ensureGoals(led).filter((g) => g.id !== id)
  saveDb(db)
  return { ok: true }
}

/**
 * CSV：日期,收支,分类名,金额,备注
 * 收支：收入/支出 或 income/expense
 */
export async function importPersonalCsv(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) throw new Error('CSV 为空')
  const led = await getLedger()
  const catByName = new Map(
    (led.categories || []).map((c) => [c.name, c])
  )
  const items = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (i === 0 && /日期/.test(line)) continue
    const cols = line.split(/[,，\t]/).map((c) => c.trim())
    if (cols.length < 4) continue
    const [date, dirRaw, catName, amountStr, note = ''] = cols
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const amount = Math.abs(Number(amountStr) || 0)
    if (!amount) continue
    const isIncome = /收入|income|\+/i.test(dirRaw)
    const cat =
      catByName.get(catName) ||
      (isIncome
        ? { id: 'other_in', direction: 'income' }
        : { id: 'other_out', direction: 'expense' })
    items.push({
      date,
      amount,
      direction: isIncome ? 'income' : 'expense',
      categoryId: cat.id,
      note: note || catName || ''
    })
  }
  if (!items.length) throw new Error('没有可导入的有效行')
  return bulkAddPersonalEntries(items)
}

export async function listExtras() {
  return []
}

export async function addExtra() {
  return { ok: true, retired: true }
}

export async function removeExtra() {
  return { ok: true, retired: true }
}

export async function getTemplate(templateId) {
  const t = loadDb().templates.find((x) => x.id === templateId)
  if (!t) throw new Error('模板不存在')
  return t
}

export async function cloneTemplate(templateId, name) {
  requireSession()
  const db = loadDb()
  const src = db.templates.find((x) => x.id === templateId)
  if (!src) throw new Error('模板不存在')
  const row = {
    ...JSON.parse(JSON.stringify(src)),
    id: uid(),
    name: name || `${src.name} 副本`,
    builtin: false
  }
  db.templates.push(row)
  saveDb(db)
  return { id: row.id }
}

export async function updateTemplate({ id, name, fields, settlement }) {
  assertWriter()
  requireSession()
  const db = loadDb()
  const t = db.templates.find((x) => x.id === id)
  if (!t) throw new Error('模板不存在')
  if (t.builtin) throw new Error('内置模板不可改')
  if (name) t.name = name
  if (fields) t.fields = fields
  if (settlement) t.settlement = settlement
  saveDb(db)
  return { ok: true }
}

export async function setAccessMode(mode) {
  assertOwner()
  const { db, led } = requireLedger()
  led.accessMode = mode === 'members' ? 'members' : 'link'
  led.updated_at = Date.now()
  saveDb(db)
  return normalizeAccess(led)
}

export async function addMember(payload) {
  assertOwner()
  const { db, led } = requireLedger()
  led.members = addMemberPure(led.members, {
    id: `m_${uid()}`,
    name: payload?.name,
    pin: payload?.pin,
    email: payload?.email,
    role: payload?.role
  })
  led.updated_at = Date.now()
  saveDb(db)
  return normalizeAccess(led).members
}

export async function removeMember(id) {
  assertOwner()
  const { db, led } = requireLedger()
  led.members = removeMemberPure(led.members, id)
  led.updated_at = Date.now()
  saveDb(db)
  return led.members
}

/** 导出整库备份（对象，调用方序列化下载） */
export async function exportBackup() {
  const db = loadDb()
  return wrapBackup(db)
}

/**
 * 导入整库备份，覆盖本机数据并清除会话
 * @param {string|object} raw
 */
export async function importBackup(raw) {
  const checked = validateBackup(raw)
  if (!checked.ok) throw new Error(checked.error)
  const db = checked.db
  // 补齐缺省字段
  if (!Array.isArray(db.templates)) db.templates = []
  if (!db.extras || typeof db.extras !== 'object') db.extras = {}
  ensureBuiltinTemplates(db)
  saveDb(db)
  localStorage.removeItem(SESSION_KEY)
  return {
    ok: true,
    ledgerCount: db.ledgers.length,
    entryKeys: Object.keys(db.entries || {}).length
  }
}

export { getToken, getSession }
