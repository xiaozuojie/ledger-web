export function todayStr() {
  return formatDate(new Date())
}

export function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return formatDate(d)
}

export function formatDate(d) {
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** 从「2车」「1车渣土1车泡沫」等文本提取可步进的整数；复杂文本返回 null */
export function simpleTruckCount(text) {
  const s = String(text || '').trim()
  if (!s) return 0
  if (/^\d+(\.\d+)?$/.test(s)) return Math.max(0, Math.floor(Number(s)))
  const m = s.match(/^(\d+)\s*车$/)
  if (m) return Number(m[1])
  return null
}

export function formatSimpleTrucks(n) {
  const v = Math.max(0, Math.floor(Number(n) || 0))
  return v === 0 ? '' : `${v}车`
}
