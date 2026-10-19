import { supabase, hasSupabase } from '../lib/supabase.js'
import { getToken, getSession, setSession, clearSession } from '../lib/session.js'
import { signOut } from '../lib/auth.js'

const TPL = {
  field_labor: '11111111-1111-1111-1111-111111111111',
  field_mixed: '22222222-2222-2222-2222-222222222222',
  personal: '33333333-3333-3333-3333-333333333333'
}

function rpcError(err) {
  const msg = (err && (err.message || err.error_description)) || '请求失败'
  if (/UNAUTHORIZED.*login/i.test(msg)) {
    return new Error('请先登录后再创建云端账本')
  }
  if (/UNAUTHORIZED/i.test(msg)) {
    return new Error('会话已过期，请重新登录或从首页进入账本')
  }
  if (/FORBIDDEN/i.test(msg)) {
    return new Error(msg.replace(/^.*FORBIDDEN\s*/i, '') || '没有权限')
  }
  if (/NOT_FOUND ledger/i.test(msg)) {
    return new Error('账本不存在或链接无效')
  }
  return new Error(msg.replace(/^.*EXCEPTION:\s*/i, '').slice(0, 200))
}

async function rpc(name, args = {}) {
  if (!hasSupabase) {
    throw new Error('未配置 Supabase')
  }
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw rpcError(error)
  return data
}

export async function listTemplates() {
  return (await rpc('api_list_templates', { p_token: null })) || []
}

export async function listLedgers() {
  return (await rpc('list_ledgers')) || []
}

export async function createLedger({ name, templateId }) {
  const data = await rpc('create_ledger', {
    p_name: name,
    p_template_id: templateId,
    p_passphrase: null
  })
  setSession({ ...data, role: data.role || 'owner' })
  return data
}

export async function openLedger(inviteSlug, opts = {}) {
  const args = { p_invite_slug: inviteSlug }
  if (opts?.pin) args.p_pin = opts.pin
  const data = await rpc('open_ledger', args)
  const session = { ...data, role: data.role || (opts?.asOwner ? 'owner' : 'editor') }
  setSession(session)
  return session
}

export async function unlockLedger({ inviteSlug }) {
  return openLedger(inviteSlug)
}

export async function logout() {
  clearSession()
  await signOut()
}

export async function createLedgerByMode({ name, mode }) {
  const templateId = TPL[mode] || TPL.field_mixed
  return createLedger({ name, templateId })
}

export async function getLedger() {
  const led = await rpc('api_get_ledger', { p_token: getToken() })
  const kind = led.settlement_kind || 'mixed'
  if (kind === 'personal') return { ...led, feeTypes: [], feeGroups: [] }
  const { normalizeFeeTypes, normalizeFeeGroups } = await import('../calc/feeTypes.js')
  return {
    ...led,
    feeGroups: normalizeFeeGroups(led.feeGroups),
    feeTypes: normalizeFeeTypes(led.feeTypes, kind)
  }
}

export async function updateRates(rates) {
  assertWriter()
  return rpc('api_update_rates', { p_token: getToken(), p_rates: rates })
}

export async function listEntries() {
  const rows = (await rpc('api_list_entries', { p_token: getToken() })) || []
  return rows.map((e) => {
    const fields = e.fields || {}
    const extras = Array.isArray(e.extras)
      ? e.extras
      : Array.isArray(fields.dayExtras)
        ? fields.dayExtras
        : []
    return {
      _id: e.id,
      id: e.id,
      date: e.date,
      fields,
      groups: e.groups || [],
      overrideTotal:
        e.override_total != null ? Number(e.override_total) : null,
      summary: e.summary || '',
      extras: extras.map((x) => ({
        id: x.id,
        name: x.name || '零星',
        amount: Number(x.amount) || 0
      }))
    }
  })
}

function assertWriter() {
  if (getSession()?.role === 'viewer') throw new Error('你是查看成员，不能修改')
}

export async function upsertEntry(payload) {
  assertWriter()
  const dayExtras = (payload.extras || []).map((x) => ({
    id: x.id,
    name: x.name || '零星',
    amount: Number(x.amount) || 0
  }))
  const fields = { ...(payload.fields || {}), dayExtras }
  return rpc('api_upsert_entry', {
    p_token: getToken(),
    p_entry_id: payload.id || null,
    p_date: payload.date,
    p_fields: fields,
    p_groups: payload.groups || [],
    p_override_total:
      payload.overrideTotal != null && payload.overrideTotal !== ''
        ? Number(payload.overrideTotal)
        : null,
    p_summary: payload.summary || null
  })
}

export async function removeEntry(entryId) {
  assertWriter()
  return rpc('api_remove_entry', {
    p_token: getToken(),
    p_entry_id: entryId
  })
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
  return rpc('api_get_template', { p_template_id: templateId })
}

export async function cloneTemplate(templateId, name) {
  return rpc('api_clone_template', {
    p_token: getToken(),
    p_template_id: templateId,
    p_name: name
  })
}

export async function updateTemplate({ id, name, fields, settlement }) {
  return rpc('api_update_template', {
    p_token: getToken(),
    p_template_id: id,
    p_name: name,
    p_fields: fields,
    p_settlement: settlement
  })
}

export async function listAllLedgerBundles() {
  throw new Error('云端模式暂不支持首页全量汇总，请用本地模式或稍后升级')
}

async function saveFeeCatalog(feeTypes, feeGroups) {
  return rpc('api_save_fee_catalog', {
    p_token: getToken(),
    p_fee_types: feeTypes,
    p_fee_groups: feeGroups
  })
}

export async function listFeeTypes() {
  return (await getLedger()).feeTypes
}

export async function addFeeType(payload) {
  assertWriter()
  const {
    normalizeFeeTypes,
    normalizeFeeGroups
  } = await import('../calc/feeTypes.js')
  const led = await getLedger()
  const name = String(payload?.name || '').trim()
  if (!name) throw new Error('请填写类型名称')
  const kind = payload?.kind === 'fixed' ? 'fixed' : 'qty'
  const row = {
    id: crypto.randomUUID(),
    name,
    kind,
    unit: String(payload?.unit || (kind === 'fixed' ? '元' : '次')).trim(),
    unitPrice: kind === 'qty' ? Number(payload?.unitPrice) || 0 : null,
    builtin: false,
    enabled: true,
    groupId: String(payload?.groupId || 'g_misc'),
    icon: payload?.icon || '📌'
  }
  const feeTypes = normalizeFeeTypes([...(led.feeTypes || []), row], led.settlement_kind)
  const feeGroups = normalizeFeeGroups(led.feeGroups)
  await saveFeeCatalog(feeTypes, feeGroups)
  return row
}

export async function updateFeeType(id, patch) {
  assertWriter()
  const { normalizeFeeTypes, normalizeFeeGroups } = await import('../calc/feeTypes.js')
  const led = await getLedger()
  const list = normalizeFeeTypes(led.feeTypes, led.settlement_kind)
  const idx = list.findIndex((t) => t.id === id)
  if (idx < 0) throw new Error('类型不存在')
  const cur = { ...list[idx] }
  if (patch.name != null) cur.name = String(patch.name).trim() || cur.name
  if (patch.unit != null) cur.unit = String(patch.unit)
  if (patch.unitPrice != null && patch.unitPrice !== '') cur.unitPrice = Number(patch.unitPrice)
  if (patch.enabled != null) cur.enabled = Boolean(patch.enabled)
  if (patch.kind != null && !cur.builtin) cur.kind = patch.kind === 'fixed' ? 'fixed' : 'qty'
  if (patch.groupId != null) cur.groupId = String(patch.groupId)
  if (patch.icon != null) cur.icon = patch.icon
  list[idx] = cur
  const feeTypes = normalizeFeeTypes(list, led.settlement_kind)
  await saveFeeCatalog(feeTypes, normalizeFeeGroups(led.feeGroups))
  return feeTypes.find((t) => t.id === id)
}

export async function removeFeeType(id) {
  assertWriter()
  const { normalizeFeeTypes, normalizeFeeGroups } = await import('../calc/feeTypes.js')
  const led = await getLedger()
  const list = normalizeFeeTypes(led.feeTypes, led.settlement_kind)
  const t = list.find((x) => x.id === id)
  if (!t) throw new Error('类型不存在')
  if (t.builtin) throw new Error('内置类型不可删除')
  await saveFeeCatalog(
    list.filter((x) => x.id !== id),
    normalizeFeeGroups(led.feeGroups)
  )
  return { ok: true }
}

export async function addFeeGroup(name) {
  assertWriter()
  const { addFeeGroup: addPure, normalizeFeeGroups, normalizeFeeTypes } = await import(
    '../calc/feeTypes.js'
  )
  const led = await getLedger()
  const feeGroups = addPure(normalizeFeeGroups(led.feeGroups), name, 'g_' + crypto.randomUUID())
  await saveFeeCatalog(normalizeFeeTypes(led.feeTypes, led.settlement_kind), feeGroups)
  return feeGroups
}

export async function renameFeeGroup(id, name) {
  assertWriter()
  const { renameFeeGroup: renamePure, normalizeFeeGroups, normalizeFeeTypes } = await import(
    '../calc/feeTypes.js'
  )
  const led = await getLedger()
  const feeGroups = renamePure(normalizeFeeGroups(led.feeGroups), id, name)
  await saveFeeCatalog(normalizeFeeTypes(led.feeTypes, led.settlement_kind), feeGroups)
  return feeGroups
}

export async function removeFeeGroup(id) {
  assertWriter()
  const { removeFeeGroup: removePure, normalizeFeeGroups, normalizeFeeTypes } = await import(
    '../calc/feeTypes.js'
  )
  const led = await getLedger()
  const types = normalizeFeeTypes(led.feeTypes, led.settlement_kind)
  const feeGroups = removePure(normalizeFeeGroups(led.feeGroups), types, id)
  await saveFeeCatalog(types, feeGroups)
  return feeGroups
}

export async function updateBudget() {
  throw new Error('云端模式暂不支持月预算')
}

export async function bulkAddPersonalEntries(items, { date, accountId } = {}) {
  assertWriter()
  const led = await getLedger()
  if (led.settlement_kind !== 'personal') throw new Error('仅个人账支持批量记入')
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
      accountId: accountId || it.accountId || null
    }
    const row = await upsertEntry({
      date: it.date || day,
      fields,
      groups: [],
      summary: fields.note || null
    })
    ids.push(row?.id || row?.entry_id || 'ok')
  }
  return { ids, count: ids.length }
}
export async function listAccounts() {
  return []
}
export async function upsertAccount() {
  throw new Error('云端模式暂不支持资产账户')
}
export async function removeAccount() {
  throw new Error('云端模式暂不支持资产账户')
}
export async function listGoals() {
  return []
}
export async function upsertGoal() {
  throw new Error('云端模式暂不支持存钱目标')
}
export async function removeGoal() {
  throw new Error('云端模式暂不支持存钱目标')
}
export async function importPersonalCsv() {
  throw new Error('云端模式暂不支持 CSV 导入')
}

export async function setAccessMode(mode) {
  await rpc('api_set_access', {
    p_token: getToken(),
    p_mode: mode === 'members' ? 'members' : 'link'
  })
  return { accessMode: mode === 'members' ? 'members' : 'link' }
}

export async function addMember({ email, role }) {
  await rpc('api_invite_member', {
    p_token: getToken(),
    p_email: email,
    p_role: role === 'viewer' ? 'viewer' : 'editor'
  })
  return (await getLedger()).members || []
}

export async function removeMember(id) {
  await rpc('api_remove_member', { p_token: getToken(), p_user_id: id })
  return (await getLedger()).members || []
}

export async function exportBackup() {
  throw new Error('云端模式请用数据库备份；本机整库导出仅本地模式')
}

export async function importBackup() {
  throw new Error('云端模式暂不支持本机 JSON 导入')
}
