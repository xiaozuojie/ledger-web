function groupsWorkDays(entry) {
  const groups = (entry && entry.groups) || []
  if (!groups.length) return 0
  return groups.reduce((sum, g) => {
    const people = Number(g.people) || 0
    const days = Number(g.days) || 0
    return sum + people * days
  }, 0)
}

/**
 * 折合工日/人天。手改优先；若手改为 0 但分组算出 >0，视为脏数据回退分组
 *（常见于勾了「手工改合计」却未填数字，Number('')===0）
 */
export function rowWorkDays(entry) {
  const fromGroups = groupsWorkDays(entry)
  const raw = entry && entry.overrideTotal
  if (raw == null || raw === '') return fromGroups
  const o = Number(raw)
  if (!Number.isFinite(o)) return fromGroups
  if (o === 0 && fromGroups > 0) return fromGroups
  return o
}

export function sumWorkDays(entries) {
  return (entries || []).reduce((s, e) => s + rowWorkDays(e), 0)
}

export function laborTotal(workDays, unitPrice) {
  return Number(workDays) * Number(unitPrice)
}
