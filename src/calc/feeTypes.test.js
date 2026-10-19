import { describe, it, expect } from 'vitest'
import {
  defaultFeeTypes,
  normalizeFeeTypes,
  feeTypeAmount,
  buildFeeBreakdown,
  BUILTIN_IDS
} from './feeTypes.js'

describe('feeTypes', () => {
  it('defaults mixed has truck/labor/extra', () => {
    const t = defaultFeeTypes('mixed')
    expect(t.map((x) => x.id)).toEqual([
      BUILTIN_IDS.truck,
      BUILTIN_IDS.labor,
      BUILTIN_IDS.extra
    ])
  })

  it('normalize merges custom qty type', () => {
    const list = normalizeFeeTypes(
      [
        { id: 'truck', name: '渣土车', kind: 'qty', unitPrice: 120 },
        {
          id: 'foam',
          name: '泡沫车',
          kind: 'qty',
          unit: '车',
          unitPrice: 80,
          builtin: false
        }
      ],
      'mixed'
    )
    expect(list.find((x) => x.id === 'truck').unitPrice).toBe(120)
    expect(list.find((x) => x.id === 'foam').name).toBe('泡沫车')
  })

  it('custom qty amount = qty × unitPrice', () => {
    const type = {
      id: 'foam',
      name: '泡沫车',
      kind: 'qty',
      unitPrice: 80,
      enabled: true
    }
    const r = feeTypeAmount(type, {
      entries: [
        { fields: { feeQtys: { foam: 2 } } },
        { fields: { feeQtys: { foam: 1 } } }
      ],
      rates: {},
      extras: []
    })
    expect(r.qty).toBe(3)
    expect(r.amount).toBe(240)
  })

  it('breakdown includes custom in sum', () => {
    const bd = buildFeeBreakdown({
      feeTypes: [
        ...defaultFeeTypes('mixed'),
        { id: 'foam', name: '泡沫车', kind: 'qty', unitPrice: 50 }
      ],
      entries: [
        {
          fields: { trucks: '1车', feeQtys: { foam: 2 } },
          overrideTotal: 1
        }
      ],
      rates: { truckUnitPrice: 100, laborUnitPrice: 200 },
      extras: []
    })
    const foam = bd.find((x) => x.id === 'foam')
    expect(foam.amount).toBe(100)
    expect(bd.find((x) => x.id === 'truck').amount).toBe(100)
  })
})
