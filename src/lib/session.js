const KEY = 'ledger_web_session_v1'

export function getSession() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setSession(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function clearSession() {
  localStorage.removeItem(KEY)
}

export function getToken() {
  const s = getSession()
  return (s && s.session_token) || ''
}

/** 兼容 localApi 写入的会话字段 */
export function getInviteSlug() {
  const s = getSession()
  return (s && s.invite_slug) || ''
}
