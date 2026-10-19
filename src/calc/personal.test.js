import { describe, it, expect } from 'vitest'
import { computePersonal } from './personal.js'

describe('computePersonal', () => {
  it('sums income expense and budget', () => {
    const r = computePersonal({
      entries: [
        {
          date: '2026-10-17',
          fields: {
            amount: 30,
            direction: 'expense',
            categoryId: 'food'
          }
        },
        {
          date: '2026-10-17',
          fields: {
            amount: 5000,
            direction: 'income',
            categoryId: 'salary'
          }
        },
        {
          date: '2026-09-01',
          fields: { amount: 99, direction: 'expense', categoryId: 'food' }
        }
      ],
      budget: { monthly: 3000 },
      monthPrefix: '2026-10'
    })
    expect(r.expense).toBe(30)
    expect(r.income).toBe(5000)
    expect(r.net).toBe(4970)
    expect(r.entryCount).toBe(2)
    expect(r.budgetLeft).toBe(2970)
    expect(r.composition.find((c) => c.id === 'food').amount).toBe(30)
  })
})
