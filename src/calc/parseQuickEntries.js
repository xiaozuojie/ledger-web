/**
 * 一句话拆多笔（个人账）
 * 支持：`午饭30 打车15`、`工资5000`、`收入 兼职 200`、`支出 咖啡 18`
 */

const INCOME_HINT = /收入|工资|奖金|兼职|报销|红包|退款/
const EXPENSE_HINT = /支出|花费|付了|买/

/** 关键词 → categoryId（与 defaultPersonalCategories 对齐） */
const KEYWORD_MAP = [
  { re: /午饭|晚餐|早餐|餐饮|吃|饭|菜|奶茶|咖啡|外卖/, id: 'food', dir: 'expense' },
  { re: /打车|地铁|公交|加油|火车|机票|滴滴|交通/, id: 'transport', dir: 'expense' },
  { re: /购物|淘宝|京东|超市|衣服|鞋/, id: 'shop', dir: 'expense' },
  { re: /房租|水电|物业|生活|日用/, id: 'life', dir: 'expense' },
  { re: /电影|游戏|娱乐|KTV/, id: 'entertain', dir: 'expense' },
  { re: /工资|薪水|薪资/, id: 'salary', dir: 'income' },
  { re: /兼职|奖金|红包|退款|报销/, id: 'other_in', dir: 'income' }
]

function guessCategory(note, direction) {
  for (const k of KEYWORD_MAP) {
    if (k.re.test(note)) {
      return { categoryId: k.id, direction: k.dir }
    }
  }
  return {
    categoryId: direction === 'income' ? 'other_in' : 'other_out',
    direction
  }
}

/**
 * @returns {Array<{ note: string, amount: number, direction: 'expense'|'income', categoryId: string }>}
 */
export function parseQuickEntries(text) {
  const raw = String(text || '').trim()
  if (!raw) return []

  // 先按空白 / 逗号 / 顿号 / 分号拆段
  const parts = raw
    .split(/[\s,，、;；]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const results = []
  for (const part of parts) {
    // 「收入xxx200」或「支出xxx30」
    let m = part.match(/^(收入|支出)(.+?)(\d+(?:\.\d+)?)$/)
    if (m) {
      const dir = m[1] === '收入' ? 'income' : 'expense'
      const note = m[2].trim() || (dir === 'income' ? '收入' : '支出')
      const amount = Number(m[3])
      if (!amount) continue
      const g = guessCategory(note, dir)
      results.push({
        note,
        amount,
        direction: g.direction || dir,
        categoryId: g.categoryId
      })
      continue
    }

    // 「午饭30」「工资5000」
    m = part.match(/^(.+?)(\d+(?:\.\d+)?)$/)
    if (!m) continue
    const note = m[1].trim()
    const amount = Number(m[2])
    if (!note || !amount) continue
    let dir = 'expense'
    if (INCOME_HINT.test(note) && !EXPENSE_HINT.test(note)) dir = 'income'
    const g = guessCategory(note, dir)
    results.push({
      note,
      amount,
      direction: g.direction,
      categoryId: g.categoryId
    })
  }
  return results
}
