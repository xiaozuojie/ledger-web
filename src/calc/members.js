export function normalizeAccess(ledger) {
  const accessMode = ledger?.accessMode === 'members' ? 'members' : 'link'
  const members = []
  for (const raw of ledger?.members || []) {
    if (!raw) continue
    const id = String(raw.id || '')
    if (!id) continue
    const role = raw.role === 'viewer' ? 'viewer' : 'editor'
    const email = String(raw.email || '')
      .trim()
      .toLowerCase()
    const name = String(raw.name || email || '').trim()
    const pin = String(raw.pin || '').trim()
    members.push({ id, name, pin, email, role })
  }
  return { accessMode, members }
}

export function matchMember(members, pin) {
  const p = String(pin || '').trim()
  if (!p) return null
  return (members || []).find((m) => m.pin && m.pin === p) || null
}

export function addMemberPure(members, row) {
  const email = String(row.email || '')
    .trim()
    .toLowerCase()
  const name = String(row.name || '').trim()
  const pin = String(row.pin || '').trim()
  const role = row.role === 'viewer' ? 'viewer' : 'editor'
  if (!name && !email) throw new Error('请填写成员名称或邮箱')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('邮箱格式不对')
  }
  if (pin && pin.length < 4) throw new Error('口令至少 4 位')
  const list = normalizeAccess({ members }).members
  if (email && list.some((m) => m.email === email)) throw new Error('这个邮箱已经是成员')
  if (pin && list.some((m) => m.pin === pin)) throw new Error('口令已被使用')
  return [
    ...list,
    {
      id: String(row.id),
      name: name || email,
      pin,
      email,
      role
    }
  ]
}

export function removeMemberPure(members, id) {
  return normalizeAccess({ members }).members.filter((m) => m.id !== id)
}
