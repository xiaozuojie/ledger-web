import { describe, it, expect } from 'vitest'
import {
  defaultFeeTypes,
  normalizeFeeTypes,
  normalizeFeeGroups,
  filterFeeTypes,
  addFeeGroup,
  renameFeeGroup,
  removeFeeGroup,
  feeTypeAmount,
  buildFeeBreakdown,
  BUILTIN_IDS,
  PRESET_ICONS
} from './feeTypes.js'

describe('feeTypes', () => {
  it('defaults mixed has truck and labor only', () => {
    const t = defaultFeeTypes('mixed')
    expect(t.map((x) => x.id)).toEqual([BUILTIN_IDS.truck, BUILTIN_IDS.labor])
  })

  it('normalize drops builtin extra', () => {
    const list = normalizeFeeTypes(
      [
        { id: 'truck', name: '渣土车', kind: 'qty', unitPrice: 100 },
        { id: 'extra', name: '零星', kind: 'fixed', builtin: true },
        { id: 'foam', name: '泡沫车', kind: 'qty', unitPrice: 80 }
      ],
      'mixed'
    )
    expect(list.some((x) => x.id === 'extra')).toBe(false)
    expect(list.some((x) => x.id === 'foam')).toBe(true)
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

  it('normalize fills default group and icon', () => {
    const list = normalizeFeeTypes(
      [
        { id: 'truck', name: '渣土车', kind: 'qty', unitPrice: 100 },
        { id: 'labor', name: '做卫生', kind: 'work_days', unitPrice: 230 },
        { id: 'foam', name: '泡沫车', kind: 'qty', unitPrice: 80, icon: 'nope' }
      ],
      'mixed'
    )
    expect(list.find((x) => x.id === 'truck')).toMatchObject({
      groupId: 'g_vehicle',
      icon: '🚚'
    })
    expect(list.find((x) => x.id === 'labor').groupId).toBe('g_labor')
    expect(list.find((x) => x.id === 'foam')).toMatchObject({
      groupId: 'g_misc',
      icon: '📌'
    })
    expect(PRESET_ICONS).toContain('🫧')
  })

  it('normalizeFeeGroups keeps defaults then custom', () => {
    const groups = normalizeFeeGroups([
      { id: 'g_custom', name: '材料' },
      { id: 'g_vehicle', name: '渣土' }
    ])
    expect(groups.map((g) => g.id)).toEqual([
      'g_vehicle',
      'g_labor',
      'g_misc',
      'g_custom'
    ])
    expect(groups[0].name).toBe('渣土')
  })

  it('filterFeeTypes matches name', () => {
    const list = normalizeFeeTypes(
      [{ id: 'foam', name: '泡沫车', kind: 'qty', unitPrice: 1 }],
      'mixed'
    )
    expect(filterFeeTypes(list, ' 泡沫 ').map((x) => x.id)).toEqual(['foam'])
    expect(filterFeeTypes(list, '没有')).toEqual([])
    expect(filterFeeTypes(list, '').length).toBe(list.length)
  })

  it('group helpers reject bad deletes and duplicate names', () => {
    const groups = normalizeFeeGroups([{ id: 'g_mat', name: '材料' }])
    const types = [{ id: 'foam', groupId: 'g_mat' }]
    expect(() => addFeeGroup(groups, ' 材料 ', 'g_x')).toThrow(/已存在/)
    expect(() => addFeeGroup(groups, '   ', 'g_x')).toThrow(/名称/)
    expect(() => removeFeeGroup(groups, [], 'g_vehicle')).toThrow(/默认/)
    expect(() => removeFeeGroup(groups, types, 'g_mat')).toThrow(/还有类型/)
    expect(removeFeeGroup(groups, [], 'g_mat').some((g) => g.id === 'g_mat')).toBe(false)
    expect(renameFeeGroup(groups, 'g_mat', '辅材').find((g) => g.id === 'g_mat').name).toBe(
      '辅材'
    )
  })
})
