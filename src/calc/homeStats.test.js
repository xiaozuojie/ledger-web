import { describe, it, expect } from 'vitest'
import { aggregateHomeStats } from './homeStats.js'

describe('homeStats', () => {
  it('aggregates by ledger / time / composition', () => {
    const now = new Date(2026, 9, 17) // Oct 17 2026
    const stats = aggregateHomeStats(
      [
        {
          id: 'a',
          name: '工地甲',
          invite_slug: 'aaa',
          settlement_kind: 'mixed',
          rates: { truckUnitPrice: 100, laborUnitPrice: 200 },
          feeTypes: null,
          entries: [
            {
              date: '2026-10-17',
              fields: { trucks: '2车' },
              overrideTotal: 1
            },
            {
              date: '2026-10-10',
              fields: { trucks: '1车' },
              overrideTotal: 1
            }
          ],
          extras: [{ name: '整本', amount: 50 }]
        }
      ],
      { now }
    )
    expect(stats.byLedger[0].name).toBe('工地甲')
    expect(stats.byLedger[0].truckCount).toBe(3)
    expect(stats.byTime.today.count).toBe(1)
    expect(stats.byTime.today.amount).toBe(2 * 100 + 1 * 200)
    expect(stats.byTime.month.count).toBe(2)
    expect(stats.compositionTotal).toBeGreaterThan(0)
    const truck = stats.composition.find((x) => x.id === 'truck')
    expect(truck.amount).toBe(300)
  })
})
