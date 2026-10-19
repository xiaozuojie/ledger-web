import { describe, it, expect } from 'vitest'
import { validateBackup, wrapBackup } from './backup.js'

describe('backup', () => {
  it('accepts wrapped backup', () => {
    const packed = wrapBackup({
      templates: [],
      ledgers: [{ id: '1', name: 'a' }],
      entries: { '1': [] },
      extras: {}
    })
    const r = validateBackup(JSON.stringify(packed))
    expect(r.ok).toBe(true)
    expect(r.db.ledgers).toHaveLength(1)
  })

  it('rejects missing ledgers', () => {
    const r = validateBackup({ entries: {} })
    expect(r.ok).toBe(false)
  })
})
