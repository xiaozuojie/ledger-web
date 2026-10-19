/** 个人账默认分类 */
export function defaultPersonalCategories() {
  return [
    { id: 'food', name: '餐饮', direction: 'expense', icon: '餐' },
    { id: 'transport', name: '交通', direction: 'expense', icon: '行' },
    { id: 'shop', name: '购物', direction: 'expense', icon: '购' },
    { id: 'life', name: '生活', direction: 'expense', icon: '活' },
    { id: 'entertain', name: '娱乐', direction: 'expense', icon: '乐' },
    { id: 'other_out', name: '其他支出', direction: 'expense', icon: '支' },
    { id: 'salary', name: '工资', direction: 'income', icon: '薪' },
    { id: 'other_in', name: '其他收入', direction: 'income', icon: '收' }
  ]
}

export function normalizeCategories(list) {
  const defaults = defaultPersonalCategories()
  if (!list?.length) return defaults
  const byId = new Map(defaults.map((c) => [c.id, { ...c }]))
  for (const raw of list) {
    if (!raw?.id) continue
    const prev = byId.get(raw.id) || {}
    byId.set(raw.id, {
      id: String(raw.id),
      name: String(raw.name || prev.name || '未命名').trim() || '未命名',
      direction: raw.direction === 'income' ? 'income' : 'expense',
      icon: String(raw.icon || prev.icon || '记').slice(0, 2)
    })
  }
  return [...byId.values()]
}
