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
    expect(r.dayExtrasSum).toBe(0)
    expect(r.bookExtrasSum).toBe(330)
    expect(r.total).toBe(5885)
  })

  it('sums per-day extras into total', () => {
    const r = computeMixed({
      entries: [
        {
          fields: { trucks: '1车' },
          overrideTotal: 1,
          extras: [{ name: '门口', amount: 50 }]
        },
        {
          fields: { trucks: '0' },
          overrideTotal: 1,
          extras: [{ name: '材料', amount: 30 }]
        }
      ],
      rates: { truckUnitPrice: 100, laborUnitPrice: 200 },
      extras: [{ name: '整本', amount: 20 }]
    })
    expect(r.dayExtrasSum).toBe(80)
    expect(r.bookExtrasSum).toBe(20)
    expect(r.extrasSum).toBe(100)
    expect(r.total).toBe(1 * 100 + 2 * 200 + 100)
  })

  it('adds custom fee type into total and breakdown', () => {
    const r = computeMixed({
      entries: [
        {
          fields: { trucks: '1车', feeQtys: { foam: 2 } },
          overrideTotal: 1
        }
      ],
      rates: { truckUnitPrice: 100, laborUnitPrice: 200 },
      extras: [],
      feeTypes: [
        { id: 'truck', name: '渣土车', kind: 'qty', unitPrice: 100, builtin: true },
        {
          id: 'labor',
          name: '做卫生',
          kind: 'work_days',
          unitPrice: 200,
          builtin: true
        },
        { id: 'extra', name: '零星', kind: 'fixed', builtin: true },
        { id: 'foam', name: '泡沫车', kind: 'qty', unit: '车', unitPrice: 50 }
      ]
    })
    expect(r.customFeeSum).toBe(100)
    expect(r.total).toBe(100 + 200 + 100)
    expect(r.feeBreakdown.find((x) => x.id === 'foam').amount).toBe(100)
  })
})
