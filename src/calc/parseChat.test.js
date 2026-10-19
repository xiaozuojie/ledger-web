import { describe, it, expect } from 'vitest'
import { parseChat, parsePaymentNotice } from './parseChat.js'

describe('parseChat', () => {
  it('keeps one-line multi entries', () => {
    const rows = parseChat('午饭30 打车15')
    expect(rows.map((r) => r.amount)).toEqual([30, 15])
  })

  it('strips chat prefix', () => {
    const rows = parseChat('帮我记一笔午饭30')
    expect(rows).toHaveLength(1)
    expect(rows[0].note).toContain('午饭')
    expect(rows[0].amount).toBe(30)
  })

  it('parses pay-to sentence', () => {
    const rows = parsePaymentNotice('你向美团付款18.5元')
    expect(rows[0]).toMatchObject({ amount: 18.5, direction: 'expense' })
    expect(rows[0].note).toContain('美团')
  })

  it('parses wechat notice with spaces', () => {
    const rows = parseChat('微信支付\n收款方：星巴克\n金额：35.00元')
    expect(rows[0].amount).toBe(35)
    expect(rows[0].note).toContain('星巴克')
    expect(rows[0].direction).toBe('expense')
  })

  it('treats incoming notice as income', () => {
    const rows = parseChat('微信收款成功 收款金额￥128.00 付款方：张三')
    expect(rows[0].direction).toBe('income')
    expect(rows[0].amount).toBe(128)
  })
})
