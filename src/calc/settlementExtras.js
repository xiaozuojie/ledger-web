/** 单行当日零星金额 */
export function entryExtrasSum(entry) {
  const list = entryExtrasList(entry)
  return list.reduce((s, x) => s + (Number(x.amount) || 0), 0)
}

export function entryExtrasList(entry) {
  if (!entry) return []
  if (Array.isArray(entry.extras) && entry.extras.length) return entry.extras
  const fromFields = entry.fields && entry.fields.dayExtras
  return Array.isArray(fromFields) ? fromFields : []
}

/** 全部明细的当日零星合计 */
export function sumEntryExtras(entries) {
  return (entries || []).reduce((s, e) => s + entryExtrasSum(e), 0)
}
