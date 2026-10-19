import { describe, it, expect } from 'vitest'
import {
  addMemberPure,
  matchMember,
  normalizeAccess,
  removeMemberPure
} from './members.js'

describe('members', () => {
  it('defaults to open link', () => {
    expect(normalizeAccess({}).accessMode).toBe('link')
  })

  it('matches pin and rejects short pin duplicates', () => {
    const members = addMemberPure([], {
      id: 'm1',
      name: '阿强',
      pin: '1234',
      role: 'editor'
    })
    expect(matchMember(members, '1234').name).toBe('阿强')
    expect(matchMember(members, '9999')).toBeNull()
    expect(() =>
      addMemberPure(members, { id: 'm2', name: '阿华', pin: '1234' })
    ).toThrow(/口令/)
    expect(() => addMemberPure(members, { id: 'm3', name: '短', pin: '12' })).toThrow(
      /4/
    )
  })

  it('removes by id', () => {
    const members = addMemberPure([], { id: 'm1', email: 'a@b.co', role: 'viewer' })
    expect(removeMemberPure(members, 'm1')).toEqual([])
  })
})
