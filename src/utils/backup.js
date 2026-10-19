import { mpToWebDb } from '../calc/mpBridge.js'

/**
 * 校验胖虎记账本机备份 JSON
 * @returns {{ ok: true, db: object } | { ok: false, error: string }}
 */
export function validateBackup(raw) {
  let data = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return { ok: false, error: '不是合法 JSON' }
    }
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, error: '备份格式错误' }
  }
  if (data.app === 'panghu-ledger-mp') {
    const db = mpToWebDb(data.db || {})
    if (!Array.isArray(db.ledgers)) {
      return { ok: false, error: '缺少 ledgers' }
    }
    return { ok: true, db }
  }
  // 支持包一层 { version, exportedAt, db } 或直接 db
  const db = data.db && typeof data.db === 'object' ? data.db : data
  if (!Array.isArray(db.ledgers)) {
    return { ok: false, error: '缺少 ledgers' }
  }
  if (!db.entries || typeof db.entries !== 'object') {
    return { ok: false, error: '缺少 entries' }
  }
  return { ok: true, db }
}

export function wrapBackup(db) {
  return {
    version: 1,
    app: 'panghu-ledger',
    exportedAt: new Date().toISOString(),
    db
  }
}
