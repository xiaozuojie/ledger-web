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
 * 折合工日/人天。只要存了手改数字（含 0），一律以手改为准；
 * 未选手改 / 手改为空 → 用分组人数×天数。
 */
export function rowWorkDays(entry) {
  const fromGroups = groupsWorkDays(entry)
  const raw = entry && entry.overrideTotal
  if (raw == null || raw === '') return fromGroups
  const o = Number(raw)
  if (!Number.isFinite(o)) return fromGroups
  return o
}

export function sumWorkDays(entries) {
  return (entries || []).reduce((s, e) => s + rowWorkDays(e), 0)
}

export function laborTotal(workDays, unitPrice) {
  return Number(workDays) * Number(unitPrice)
}
