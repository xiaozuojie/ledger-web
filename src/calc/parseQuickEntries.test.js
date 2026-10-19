import { describe, it, expect } from 'vitest'
import { parseQuickEntries } from './parseQuickEntries.js'

describe('parseQuickEntries', () => {
  it('splits lunch and taxi', () => {
    const r = parseQuickEntries('午饭30 打车15')
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({
      note: '午饭',
      amount: 30,
      direction: 'expense',
      categoryId: 'food'
    })
    expect(r[1]).toMatchObject({
      note: '打车',
      amount: 15,
      categoryId: 'transport'
    })
  })

  it('detects salary income', () => {
    const r = parseQuickEntries('工资5000')
    expect(r[0].direction).toBe('income')
    expect(r[0].categoryId).toBe('salary')
  })

  it('supports 收入/支出 prefix', () => {
    const r = parseQuickEntries('收入兼职200 支出零食12')
    expect(r[0].direction).toBe('income')
    expect(r[0].amount).toBe(200)
    expect(r[1].direction).toBe('expense')
    expect(r[1].amount).toBe(12)
  })
})
