import { describe, it, expect } from 'vitest'
import { computeMixed } from './settlement.js'
import { sumWorkDays } from './hours.js'
import { parseTruckCount } from './trucks.js'

describe('mixed settlement', () => {
  it('anchor 5885', () => {
    expect(13 * 100 + 18.5 * 230 + 330).toBe(5885)
    expect(sumWorkDays([{ overrideTotal: 10 }, { overrideTotal: 8.5 }])).toBe(
      18.5
    )
    expect(parseTruckCount('1车渣土1车泡沫')).toBe(2)
    const r = computeMixed({
      entries: [
        { fields: { trucks: '2车' }, overrideTotal: 1.5 },
        { fields: { trucks: '11车' }, overrideTotal: 17 }
      ],
      rates: { truckUnitPrice: 100, laborUnitPrice: 230 },
      extras: [{ amount: 100 }, { amount: 80 }, { amount: 150 }]
    })
    expect(r.truckCount).toBe(13)
    expect(r.workDays).toBe(18.5)
    expect(r.truckFee).toBe(1300)
    expect(r.laborFee).toBe(4255)
    expect(r.extrasSum).toBe(330)
    expect(r.total).toBe(5885)
  })
})
