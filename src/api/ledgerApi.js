import { supabase, hasSupabase } from '../lib/supabase.js'
import { getToken, setSession, clearSession } from '../lib/session.js'

function rpcError(err) {
  const msg = (err && (err.message || err.error_description)) || '请求失败'
  if (/UNAUTHORIZED/i.test(msg)) {
    return new Error('会话已过期，请从首页重新进入账本')
  }
  if (/NOT_FOUND ledger/i.test(msg)) {
    return new Error('账本不存在或链接无效')
  }
  return new Error(msg.replace(/^.*EXCEPTION:\s*/i, '').slice(0, 200))
}

async function rpc(name, args = {}) {
  if (!hasSupabase) {
    throw new Error('请先配置 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY（见 .env.example）')
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

/** 开放进入：只需邀请码 / 链接中的 slug，无需口令 */
export async function openLedger(inviteSlug) {
  const data = await rpc('open_ledger', {
    p_invite_slug: inviteSlug
  })
  setSession(data)
  return data
}

export async function unlockLedger({ inviteSlug }) {
  return openLedger(inviteSlug)
}

export function logout() {
  clearSession()
}

export async function getLedger() {
  return rpc('api_get_ledger', { p_token: getToken() })
}

export async function updateRates(rates) {
  return rpc('api_update_rates', { p_token: getToken(), p_rates: rates })
}

export async function listEntries() {
  const rows = (await rpc('api_list_entries', { p_token: getToken() })) || []
  return rows.map(normalizeEntry)
}

function normalizeEntry(e) {
  return {
    _id: e.id,
    id: e.id,
    date: e.date,
    fields: e.fields || {},
    groups: e.groups || [],
    overrideTotal:
      e.override_total != null ? Number(e.override_total) : null,
    summary: e.summary || ''
  }
}

export async function upsertEntry(payload) {
  return rpc('api_upsert_entry', {
    p_token: getToken(),
    p_entry_id: payload.id || null,
    p_date: payload.date,
    p_fields: payload.fields || {},
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
  const rows = (await rpc('api_list_extras', { p_token: getToken() })) || []
  return rows.map((x) => ({
    _id: x.id,
    id: x.id,
    name: x.name,
    amount: Number(x.amount) || 0
  }))
}

export async function addExtra(name, amount) {
  return rpc('api_add_extra', {
    p_token: getToken(),
    p_name: name,
    p_amount: Number(amount) || 0
  })
}

export async function removeExtra(chargeId) {
  return rpc('api_remove_extra', {
    p_token: getToken(),
    p_charge_id: chargeId
  })
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
