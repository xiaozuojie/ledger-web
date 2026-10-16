import { describe, it, expect } from 'vitest'
import { rowWorkDays, sumWorkDays, laborTotal } from './hours.js'

describe('hours', () => {
  it('sums groups and override', () => {
    expect(
      rowWorkDays({
        groups: [
          { people: 3, days: 1 },
          { people: 1, days: 0.5 }
        ]
      })
    ).toBe(3.5)
    expect(
      rowWorkDays({ groups: [{ people: 2, days: 0.5 }], overrideTotal: 9 })
    ).toBe(9)
    // 手改 0 必须以手改为准（即使分组算出 2）
    expect(
      rowWorkDays({
        groups: [{ people: 2, days: 1 }],
        overrideTotal: 0
      })
    ).toBe(0)
    expect(rowWorkDays({ groups: [], overrideTotal: 0 })).toBe(0)
    // 手改为空字符串 → 走分组
    expect(
      rowWorkDays({
        groups: [{ people: 2, days: 1 }],
        overrideTotal: ''
      })
    ).toBe(2)
    expect(
      sumWorkDays([
        {
          groups: [
            { people: 3, days: 1 },
            { people: 1, days: 0.5 }
          ]
        },
        { groups: [{ people: 2, days: 0.5 }] }
      ])
    ).toBe(4.5)
    expect(laborTotal(3.5, 300)).toBe(1050)
  })
})
