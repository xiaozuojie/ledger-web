/**
 * 纯浏览器存储（localStorage）。同一手机/浏览器可完整使用；
 * 不同设备互不同步（无需 Supabase）。开放账本：本机列表可见。
 */
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
  }
]

function uid() {
  return crypto.randomUUID()
}

function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const db = JSON.parse(raw)
      if (!db.templates?.length) db.templates = BUILTIN_TEMPLATES
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
  const rates =
    kind === 'mixed'
      ? {
          truckUnitPrice: tpl.settlement.truckUnitPrice ?? 100,
          laborUnitPrice: tpl.settlement.laborUnitPrice ?? 230
        }
      : {
          laborUnitPrice: tpl.settlement.defaultUnitPrice ?? 300,
          truckUnitPrice: tpl.settlement.truckUnitPrice ?? 100
        }
  const ledger = {
    id: uid(),
    name: name.trim(),
    template_id: templateId,
    settlement_kind: kind,
    rates,
    invite_slug: uid().replace(/-/g, '').slice(0, 10),
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
    name: ledger.name
  }
  setSession(session)
  return session
}

export async function openLedger(inviteSlug) {
  const db = loadDb()
  const ledger = db.ledgers.find((l) => l.invite_slug === inviteSlug)
  if (!ledger) throw new Error('账本不存在或链接无效（本地模式：需在同一手机浏览器内创建）')
  ledger.updated_at = Date.now()
  saveDb(db)
  const session = {
    ledger_id: ledger.id,
    invite_slug: ledger.invite_slug,
    session_token: uid(),
    settlement_kind: ledger.settlement_kind,
    name: ledger.name
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
  return {
    id: led.id,
    name: led.name,
    template_id: led.template_id,
    settlement_kind: led.settlement_kind,
    rates: led.rates,
    invite_slug: led.invite_slug
  }
}

export async function updateRates(rates) {
  const s = requireSession()
  const db = loadDb()
  const led = db.ledgers.find((l) => l.id === s.ledger_id)
  if (!led) throw new Error('账本不存在')
  led.rates = rates
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
  const idx = list.findIndex((e) => e.id === body.id)
  if (idx >= 0) list[idx] = body
  else list.push(body)
  const led = db.ledgers.find((l) => l.id === s.ledger_id)
  if (led) led.updated_at = Date.now()
  saveDb(db)
  return { id: body.id }
}

export async function removeEntry(entryId) {
  const s = requireSession()
  const db = loadDb()
  db.entries[s.ledger_id] = (db.entries[s.ledger_id] || []).filter(
    (e) => e.id !== entryId
  )
  saveDb(db)
  return { ok: true }
}

export async function listExtras() {
  const s = requireSession()
  const db = loadDb()
  return (db.extras[s.ledger_id] || []).map((x) => ({
    _id: x.id,
    id: x.id,
    name: x.name,
    amount: Number(x.amount) || 0
  }))
}

export async function addExtra(name, amount) {
  const s = requireSession()
  const db = loadDb()
  const list = db.extras[s.ledger_id] || (db.extras[s.ledger_id] = [])
  const row = { id: uid(), name: name || '零星', amount: Number(amount) || 0 }
  list.push(row)
  saveDb(db)
  return { id: row.id }
}

export async function removeExtra(chargeId) {
  const s = requireSession()
  const db = loadDb()
  db.extras[s.ledger_id] = (db.extras[s.ledger_id] || []).filter(
    (x) => x.id !== chargeId
  )
  saveDb(db)
  return { ok: true }
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

export { getToken, getSession }
