import { supabase, hasSupabase } from '../lib/supabase.js'
import { getToken, setSession, clearSession } from '../lib/session.js'
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
  setSession(data)
  return data
}

export async function openLedger(inviteSlug) {
  const data = await rpc('open_ledger', { p_invite_slug: inviteSlug })
  setSession(data)
  return data
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
  return rpc('api_get_ledger', { p_token: getToken() })
}

export async function updateRates(rates) {
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

export async function upsertEntry(payload) {
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

/** 云端尚未建 feeTypes 表：首页汇总 / 类型管理仅本地模式完整支持 */
export async function listAllLedgerBundles() {
  throw new Error('云端模式暂不支持首页全量汇总，请用本地模式或稍后升级')
}

export async function listFeeTypes() {
  const led = await getLedger()
  const { defaultFeeTypes, normalizeFeeTypes } = await import(
    '../calc/feeTypes.js'
  )
  return normalizeFeeTypes(led.feeTypes, led.settlement_kind || 'mixed').length
    ? normalizeFeeTypes(led.feeTypes, led.settlement_kind || 'mixed')
    : defaultFeeTypes(led.settlement_kind || 'mixed')
}

export async function addFeeType() {
  throw new Error('云端模式暂不支持自定义计费类型')
}

export async function updateFeeType() {
  throw new Error('云端模式暂不支持自定义计费类型')
}

export async function removeFeeType() {
  throw new Error('云端模式暂不支持自定义计费类型')
}

export async function updateBudget() {
  throw new Error('云端模式暂不支持月预算')
}

export async function bulkAddPersonalEntries() {
  throw new Error('云端模式暂不支持批量记账')
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

export async function exportBackup() {
  throw new Error('云端模式请用数据库备份；本机整库导出仅本地模式')
}

export async function importBackup() {
  throw new Error('云端模式暂不支持本机 JSON 导入')
}
