const TPL = {
  mixed: '22222222-2222-2222-2222-222222222222',
  labor: '11111111-1111-1111-1111-111111111111',
  personal: '33333333-3333-3333-3333-333333333333'
}

export function isMpBackup(data) {
  return Boolean(data && data.app === 'panghu-ledger-mp' && data.db)
}

function webKind(kind) {
  if (kind === 'mixed' || kind === 'personal') return kind
  return 'labor'
}

/** 小程序本地库 → 网页备份 db */
export function mpToWebDb(mp) {
  const src = mp || {}
  const ledgers = []
  const entries = {}
  for (const led of src.ledgers || []) {
    const id = String(led._id || led.id || '')
    if (!id) continue
    const kind = webKind(led.settlementKind || led.settlement_kind)
    const slug = id.replace(/[^a-z0-9]/gi, '').slice(-10) || `mp${ledgers.length}`
    ledgers.push({
      id,
      name: led.name || '未命名',
      template_id: TPL[kind],
      settlement_kind: kind,
      rates: led.rates || {},
      invite_slug: slug,
      updated_at: led.updatedAt || led.updated_at || Date.now(),
      accessMode: 'link',
      members: []
    })
    entries[id] = []
  }
  for (const row of src.entries || []) {
    const lid = String(row.ledgerId || row.ledger_id || '')
    if (!entries[lid]) continue
    const fields = { ...(row.fields || {}) }
    if (row.groups) fields.groups = row.groups
    if (row.overrideTotal != null) fields.overrideTotal = row.overrideTotal
    entries[lid].push({
      id: String(row._id || row.id),
      date: row.date,
      fields,
      summary: row.summary || '',
      created_at: row.createdAt || Date.now()
    })
  }
  return { ledgers, entries, extras: {}, templates: [] }
}

/** 网页备份 db → 小程序本地库 */
export function webDbToMp(db) {
  const ledgers = []
  const entries = []
  const ledger_members = []
  const map = db?.entries && !Array.isArray(db.entries) ? db.entries : null
  for (const led of db?.ledgers || []) {
    if (led.settlement_kind === 'personal') continue
    const id = String(led.id)
    ledgers.push({
      _id: id,
      name: led.name || '未命名',
      templateId: led.template_id,
      settlementKind: led.settlement_kind === 'mixed' ? 'mixed' : 'labor',
      rates: led.rates || {},
      updatedAt: led.updated_at || Date.now(),
      createdAt: led.updated_at || Date.now()
    })
    ledger_members.push({
      _id: `mem_${id}`,
      ledgerId: id,
      openid: 'imported',
      role: 'admin',
      createdAt: Date.now()
    })
    const list = map ? map[id] || [] : []
    for (const row of list) {
      entries.push({
        _id: String(row.id || row._id),
        ledgerId: id,
        date: row.date,
        groups: row.groups || row.fields?.groups || [],
        overrideTotal: row.overrideTotal ?? row.fields?.overrideTotal ?? null,
        fields: row.fields || {},
        summary: row.summary || '',
        updatedAt: Date.now(),
        createdAt: row.created_at || Date.now()
      })
    }
  }
  return {
    openid: 'imported',
    users: [{ openid: 'imported', nickName: '从网页导入' }],
    templates: [],
    ledgers,
    ledger_members,
    entries,
    extra_charges: []
  }
}
