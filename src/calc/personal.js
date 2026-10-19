import { normalizeCategories } from './personalCategories.js'

export function personalAmount(entry) {
  return Math.abs(Number(entry?.fields?.amount) || 0)
}

export function personalDirection(entry) {
  return entry?.fields?.direction === 'income' ? 'income' : 'expense'
}

/**
 * @param {{ entries, budget?, categories?, monthPrefix? }} opts
 * monthPrefix: 'YYYY-MM'；缺省则全部
 */
export function computePersonal({ entries, budget, categories, monthPrefix }) {
  const cats = normalizeCategories(categories)
  const catMap = new Map(cats.map((c) => [c.id, c]))
  let list = entries || []
  if (monthPrefix) {
    list = list.filter((e) => String(e.date).startsWith(monthPrefix))
  }
  let income = 0
  let expense = 0
  /** @type {Record<string, number>} */
  const byCat = {}
  for (const e of list) {
    const amt = personalAmount(e)
    const dir = personalDirection(e)
    if (dir === 'income') income += amt
    else expense += amt
    const cid = e.fields?.categoryId || (dir === 'income' ? 'other_in' : 'other_out')
    byCat[cid] = (byCat[cid] || 0) + (dir === 'income' ? amt : amt)
  }
  const monthly = Number(budget?.monthly) || 0
  const budgetLeft = monthly ? monthly - expense : null
  const budgetPct = monthly ? Math.min(100, Math.round((expense / monthly) * 1000) / 10) : 0
  const composition = Object.entries(byCat)
    .map(([id, amount]) => ({
      id,
      name: catMap.get(id)?.name || id,
      direction: catMap.get(id)?.direction || 'expense',
      amount
    }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  return {
    kind: 'personal',
    income,
    expense,
    net: income - expense,
    entryCount: list.length,
    monthlyBudget: monthly,
    budgetLeft,
    budgetPct,
    composition,
    categories: cats
  }
}
