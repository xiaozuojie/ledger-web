import { describe, it, expect } from 'vitest'
import { pickPanghuTip } from './panghuTips.js'

describe('pickPanghuTip', () => {
  it('warns when budget over', () => {
    const t = pickPanghuTip({ budgetPct: 105 })
    expect(t.id).toBe('budget-over')
    expect(t.tone).toBe('warn')
  })

  it('hints empty personal day', () => {
    const t = pickPanghuTip({ kind: 'personal', todayEntryCount: 0 })
    expect(t.id).toBe('personal-empty')
  })
})
