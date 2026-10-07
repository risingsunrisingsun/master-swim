import { beforeEach, describe, expect, test } from 'bun:test'
import { UserFacingError } from './backend'
import { DEMO_ADMIN, DEMO_INVITE, DEMO_MEMBER, type KeyValue, LocalBackend } from './local'

class MemoryStore implements KeyValue {
  private readonly map = new Map<string, string>()
  getItem(key: string) {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
}

const TODAY = '2026-10-28'
let seed = 1
const random = () => {
  // 고정 난수 — 시드 데이터가 매번 같다.
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}

let backend: LocalBackend

beforeEach(() => {
  seed = 1
  backend = new LocalBackend(new MemoryStore(), () => TODAY, random)
})

describe('로그인', () => {
  test('틀린 비밀번호는 거절, 맞으면 들어온다', async () => {
    await expect(backend.signIn(DEMO_MEMBER.name, 'nope')).rejects.toBeInstanceOf(UserFacingError)
    const me = await backend.signIn(` ${DEMO_MEMBER.name} `, DEMO_MEMBER.password)
    expect(me.displayName).toBe(DEMO_MEMBER.name)
    expect(await backend.me()).toEqual(me)
    expect('password' in me).toBe(false)
  })

  test('가입 전 회원은 비밀번호가 없어 로그인 못 한다', async () => {
    await expect(backend.signIn('회원 08', '')).rejects.toBeInstanceOf(UserFacingError)
  })

  test('초대코드는 한 번만 쓴다', async () => {
    const me = await backend.redeemInvite(DEMO_INVITE.toLowerCase(), 'secret1')
    expect(me.status).toBe('active')
    await backend.signOut()
    expect(await backend.me()).toBeNull()
    expect((await backend.signIn('회원 08', 'secret1')).displayName).toBe('회원 08')
    await expect(backend.redeemInvite(DEMO_INVITE, 'other12')).rejects.toBeInstanceOf(UserFacingError)
  })

  test('재발급하면 옛 코드는 무효, 새 코드로 비밀번호가 바뀐다', async () => {
    await backend.signIn(DEMO_ADMIN.name, DEMO_ADMIN.password)
    const members = await backend.members()
    const hong = members.find((m) => m.displayName === DEMO_MEMBER.name)!
    const first = await backend.issueInvite(hong.id)
    const second = await backend.issueInvite(hong.id)
    expect(second.expiresOn).toBe('2026-11-04')
    await backend.signOut()

    await expect(backend.redeemInvite(first.code, 'newpass')).rejects.toBeInstanceOf(UserFacingError)
    await backend.redeemInvite(second.code, 'newpass')
    await backend.signOut()
    await expect(backend.signIn(DEMO_MEMBER.name, DEMO_MEMBER.password)).rejects.toBeInstanceOf(UserFacingError)
    expect((await backend.signIn(DEMO_MEMBER.name, 'newpass')).id).toBe(hong.id)
  })

  test('중지된 회원은 로그인도 가입도 못 한다', async () => {
    await backend.signIn(DEMO_ADMIN.name, DEMO_ADMIN.password)
    const hong = (await backend.members()).find((m) => m.displayName === DEMO_MEMBER.name)!
    const invite = await backend.issueInvite(hong.id)
    await backend.setMemberActive(hong.id, false)
    await backend.signOut()
    await expect(backend.signIn(DEMO_MEMBER.name, DEMO_MEMBER.password)).rejects.toThrow('중지')
    await expect(backend.redeemInvite(invite.code, 'whatever')).rejects.toBeInstanceOf(UserFacingError)
  })
})

describe('권한', () => {
  test('로그인 전에는 모임도 못 본다', async () => {
    await expect(backend.meetings()).rejects.toThrow('로그인')
  })

  test('회원은 운영 기능을 못 쓴다', async () => {
    await backend.signIn(DEMO_MEMBER.name, DEMO_MEMBER.password)
    await expect(backend.members()).rejects.toThrow('운영자')
    await expect(backend.saveAttendance('x', [])).rejects.toThrow('운영자')
    await expect(backend.createMeeting({ date: TODAY, kind: 'training', place: '' })).rejects.toThrow('운영자')
  })

  test('운영자는 자기 계정을 중지할 수 없다', async () => {
    const admin = await backend.signIn(DEMO_ADMIN.name, DEMO_ADMIN.password)
    await expect(backend.setMemberActive(admin.id, false)).rejects.toBeInstanceOf(UserFacingError)
  })
})

describe('출석', () => {
  test('저장하면 집계됨이 되고 회원의 참석 목록에 들어간다', async () => {
    await backend.signIn(DEMO_ADMIN.name, DEMO_ADMIN.password)
    const meeting = await backend.createMeeting({ date: TODAY, kind: 'training', place: '' })
    expect(meeting.checkedAt).toBeNull()
    const hong = (await backend.members()).find((m) => m.displayName === DEMO_MEMBER.name)!

    await backend.saveAttendance(meeting.id, [hong.id])
    expect([...(await backend.presentMemberIds(meeting.id))]).toEqual([hong.id])
    expect((await backend.meetings()).find((m) => m.id === meeting.id)?.checkedAt).not.toBeNull()

    // 다시 저장하면 통째로 바뀐다.
    await backend.saveAttendance(meeting.id, [])
    expect((await backend.presentMemberIds(meeting.id)).size).toBe(0)

    await backend.saveAttendance(meeting.id, [hong.id])
    await backend.signOut()
    await backend.signIn(DEMO_MEMBER.name, DEMO_MEMBER.password)
    expect((await backend.myPresentMeetingIds()).has(meeting.id)).toBe(true)
  })

  test('같은 이름은 거절', async () => {
    await backend.signIn(DEMO_ADMIN.name, DEMO_ADMIN.password)
    await expect(
      backend.createMember({ displayName: DEMO_MEMBER.name, role: 'member', joinedOn: TODAY }),
    ).rejects.toThrow('같은 이름')
  })
})

describe('데모 시드', () => {
  test('가장 최근 지난 모임 하나는 집계 전으로 남는다', async () => {
    await backend.signIn(DEMO_MEMBER.name, DEMO_MEMBER.password)
    const past = (await backend.meetings()).filter((m) => m.date <= TODAY && !m.cancelled)
    const last = past.at(-1)!
    expect(last.checkedAt).toBeNull()
    expect(past.slice(0, -1).every((m) => m.checkedAt !== null)).toBe(true)
    expect((await backend.meetings()).some((m) => m.date > TODAY)).toBe(true)
  })
})
