import { describe, it, expect } from 'vitest'
import { isMpBackup, mpToWebDb, webDbToMp } from './mpBridge.js'

describe('mpBridge', () => {
  it('converts miniprogram db into web ledgers', () => {
    const db = mpToWebDb({
      ledgers: [
        {
          _id: 'led_1',
          name: '工地',
          settlementKind: 'mixed',
          rates: { truckUnitPrice: 100, laborUnitPrice: 230 }
        }
      ],
      entries: [
        {
          _id: 'ent_1',
          ledgerId: 'led_1',
          date: '2026-10-19',
          groups: [{ people: 2, days: 1 }],
          fields: { trucks: '3' },
          summary: '2人'
        }
      ]
    })
    expect(db.ledgers[0].settlement_kind).toBe('mixed')
    expect(db.entries.led_1[0].fields.trucks).toBe('3')
    expect(db.entries.led_1[0].fields.groups).toHaveLength(1)
  })

  it('round-trips field ledgers and skips personal', () => {
    const web = mpToWebDb({
      ledgers: [{ _id: 'led_9', name: '卫生', settlementKind: 'labor', rates: {} }],
      entries: []
    })
    web.ledgers.push({
      id: 'p1',
      name: '个人',
      settlement_kind: 'personal',
      template_id: 'x',
      rates: {}
    })
    const mp = webDbToMp(web)
    expect(mp.ledgers.map((l) => l._id)).toEqual(['led_9'])
    expect(mp.ledger_members[0].role).toBe('admin')
    expect(isMpBackup({ app: 'panghu-ledger-mp', db: { ledgers: [] } })).toBe(true)
  })
})
