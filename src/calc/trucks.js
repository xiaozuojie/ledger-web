export function parseTruckCount(text) {
  if (text == null || text === '') return 0
  if (typeof text === 'number') return text
  const s = String(text)
  const matches = s.match(/(\d+(?:\.\d+)?)\s*车/g)
  if (!matches) {
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }
  return matches.reduce((sum, m) => sum + Number(m.replace(/[^\d.]/g, '')), 0)
}
