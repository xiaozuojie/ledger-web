import { parseQuickEntries } from './parseQuickEntries.js'

const CHAT_PREFIX =
  /^(?:胖虎[,，]?\s*)?(?:请|麻烦)?(?:帮我)?(?:记一笔|记一下|记下|记账)[:：\s]*/

/**
 * 从微信/支付宝通知正文里抽出一笔。
 * 网页拦不到系统支付弹窗，只解析用户粘贴的通知文字。
 * @returns {Array<{ note: string, amount: number, direction: 'expense'|'income', categoryId: string }>}
 */
export function parsePaymentNotice(text) {
  const compact = String(text || '').replace(/\s+/g, '')
  if (!compact) return []
  if (!/支付|支付宝|微信|付款|收款/.test(compact)) return []

  let merchant = ''
  let amount = 0
  let direction = 'expense'

  const payTo = compact.match(/(?:向|给)([^付款收]{1,24}?)付款(\d+(?:\.\d+)?)元?/)
  if (payTo) {
    merchant = payTo[1]
    amount = Number(payTo[2])
  }

  if (!amount) {
    const amt = compact.match(
      /(?:收款金额|付款金额|支付金额|金额)[:：]?[￥¥]?(\d+(?:\.\d+)?)/
    )
    if (amt) amount = Number(amt[1])
    const who = compact.match(/(?:收款方|商户|交易对象|付款给)[:：]?([^0-9￥¥金额]{1,24})/)
    if (who) merchant = who[1].replace(/[:：].*$/, '')
  }

  if (!amount) {
    const loose = compact.match(/[￥¥](\d+(?:\.\d+)?)元?/)
    if (loose) amount = Number(loose[1])
  }

  if (!amount) return []
  if (/收款成功|已收款|收款金额/.test(compact) && !/付款(?!方)|支付成功/.test(compact)) {
    direction = 'income'
  }
  const note = (merchant || (direction === 'income' ? '收款' : '支付')).slice(0, 24)
  const parsed = parseQuickEntries(`${note}${amount}`)
  if (parsed.length) {
    return parsed.map((row) => ({ ...row, direction }))
  }
  return [
    {
      note,
      amount,
      direction,
      categoryId: direction === 'income' ? 'other_in' : 'other_out'
    }
  ]
}

/** 聊天句子、一句话多笔、支付通知，统一成待确认明细 */
export function parseChat(text) {
  const pay = parsePaymentNotice(text)
  if (pay.length) return pay
  const stripped = String(text || '')
    .trim()
    .replace(CHAT_PREFIX, '')
    .trim()
  return parseQuickEntries(stripped)
}
