export function rowWorkDays(entry) {
  if (entry && entry.overrideTotal != null && entry.overrideTotal !== '') {
    return Number(entry.overrideTotal)
  }
  const groups = (entry && entry.groups) || []
  if (!groups.length) return 0
  return groups.reduce((sum, g) => {
    const people = Number(g.people) || 0
    const days = Number(g.days) || 0
    return sum + people * days
  }, 0)
}

export function sumWorkDays(entries) {
  return (entries || []).reduce((s, e) => s + rowWorkDays(e), 0)
}

export function laborTotal(workDays, unitPrice) {
  return Number(workDays) * Number(unitPrice)
}
