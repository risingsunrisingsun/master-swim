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
    await expect(backend.createMeeting({ date: TODAY, kind: 'training', label: '', place: '' })).rejects.toThrow('운영자')
  })

  test('운영자는 자기 계정을 중지할 수 없다', async () => {
    const admin = await backend.signIn(DEMO_ADMIN.name, DEMO_ADMIN.password)
    await expect(backend.setMemberActive(admin.id, false)).rejects.toBeInstanceOf(UserFacingError)
  })
})

describe('출석', () => {
  test('저장하면 집계됨이 되고 회원의 참석 목록에 들어간다', async () => {
    await backend.signIn(DEMO_ADMIN.name, DEMO_ADMIN.password)
    const meeting = await backend.createMeeting({ date: TODAY, kind: 'training', label: '', place: '' })
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
      backend.createMember({ displayName: DEMO_MEMBER.name, role: 'member', joinedOn: TODAY, sex: null, birthYear: null }),
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

describe('비밀번호 바꾸기', () => {
  test('지금 비밀번호가 맞아야 바뀐다', async () => {
    await backend.signIn(DEMO_MEMBER.name, DEMO_MEMBER.password)
    await expect(backend.changePassword('wrong', 'newpass1')).rejects.toThrow('지금 비밀번호')
    await expect(backend.changePassword(DEMO_MEMBER.password, DEMO_MEMBER.password)).rejects.toThrow('다른 비밀번호')
    await backend.changePassword(DEMO_MEMBER.password, 'newpass1')
    await backend.signOut()
    await expect(backend.signIn(DEMO_MEMBER.name, DEMO_MEMBER.password)).rejects.toBeInstanceOf(UserFacingError)
    expect((await backend.signIn(DEMO_MEMBER.name, 'newpass1')).displayName).toBe(DEMO_MEMBER.name)
  })

  test('로그인 전에는 못 바꾼다', async () => {
    await expect(backend.changePassword(DEMO_MEMBER.password, 'newpass1')).rejects.toThrow('로그인')
  })
})

describe('기록', () => {
  const FREE50 = { stroke: 'free', distance: 50 } as const

  test('데모 시드 — 홍길동은 개인 입력과 모임 기록이 둘 다 있다', async () => {
    await backend.signIn(DEMO_MEMBER.name, DEMO_MEMBER.password)
    const records = await backend.myRecords()
    expect(records.some((r) => r.source === 'self')).toBe(true)
    expect(records.some((r) => r.source === 'meeting')).toBe(true)
    expect(records.every((r) => r.memberId === 'demo-1')).toBe(true)
    expect((await backend.myGoals()).map((g) => g.targetCs)).toEqual([3100])
  })

  test('개인 입력은 넣고 고치고 지운다, 모임 기록은 못 건드린다', async () => {
    await backend.signIn(DEMO_MEMBER.name, DEMO_MEMBER.password)
    const before = (await backend.myRecords()).length
    await backend.addRecord({ ...FREE50, timeCs: 3000, date: TODAY, note: ' 메모 ' })
    const mine = (await backend.myRecords()).find((r) => r.timeCs === 3000)!
    expect(mine.note).toBe('메모')
    await backend.updateRecord(mine.id, { ...FREE50, timeCs: 2990, date: TODAY, note: '' })
    expect((await backend.myRecords()).some((r) => r.timeCs === 2990)).toBe(true)
    await backend.deleteRecord(mine.id)
    expect((await backend.myRecords()).length).toBe(before)

    const official = (await backend.myRecords()).find((r) => r.source === 'meeting')!
    await expect(backend.deleteRecord(official.id)).rejects.toThrow('모임 기록은 운영자')
    await expect(backend.updateRecord(official.id, { ...FREE50, timeCs: 2000, date: TODAY, note: '' })).rejects.toThrow()
  })

  test('남의 기록은 못 고친다', async () => {
    await backend.signIn(DEMO_MEMBER.name, DEMO_MEMBER.password)
    await backend.addRecord({ ...FREE50, timeCs: 3000, date: TODAY, note: '' })
    const id = (await backend.myRecords()).find((r) => r.timeCs === 3000)!.id
    await backend.signOut()
    await backend.signIn('회원 02', DEMO_MEMBER.password)
    await expect(backend.deleteRecord(id)).rejects.toBeInstanceOf(UserFacingError)
  })

  test('목표는 종목마다 하나 — 다시 정하면 바뀐다', async () => {
    await backend.signIn(DEMO_MEMBER.name, DEMO_MEMBER.password)
    await backend.saveGoal(FREE50, 3000)
    await backend.saveGoal({ stroke: 'back', distance: 50 }, 3600)
    const goals = await backend.myGoals()
    expect(goals).toHaveLength(2)
    expect(goals.find((g) => g.stroke === 'free')?.targetCs).toBe(3000)
  })

  test('운영자 모임 기록 — 그 모임 · 그 종목을 통째로 바꾸고 회원에게 보인다', async () => {
    await backend.signIn(DEMO_ADMIN.name, DEMO_ADMIN.password)
    const meeting = await backend.createMeeting({ date: TODAY, kind: 'record', label: '', place: '' })
    const hong = (await backend.members()).find((m) => m.displayName === DEMO_MEMBER.name)!
    await backend.saveMeetingRecords(meeting.id, FREE50, [{ memberId: hong.id, timeCs: 2950 }])
    await backend.saveMeetingRecords(meeting.id, { stroke: 'back', distance: 50 }, [{ memberId: hong.id, timeCs: 3500 }])
    await backend.saveMeetingRecords(meeting.id, FREE50, [{ memberId: hong.id, timeCs: 2940 }])
    const saved = await backend.meetingRecords(meeting.id)
    expect(saved.map((r) => [r.stroke, r.timeCs]).sort()).toEqual([
      ['back', 3500],
      ['free', 2940],
    ])
    expect(saved.every((r) => r.date === TODAY && r.source === 'meeting')).toBe(true)

    await backend.signOut()
    await backend.signIn(DEMO_MEMBER.name, DEMO_MEMBER.password)
    expect((await backend.myRecords()).some((r) => r.meetingId === meeting.id && r.timeCs === 2940)).toBe(true)
    await expect(backend.saveMeetingRecords(meeting.id, FREE50, [])).rejects.toThrow('운영자')
  })
})

describe('세트 코치 조정', () => {
  const plan = {
    lines: [{ name: '코치 25', reps: 10, distance: 25, restS: 20, effort: 'pace' as const, paceOffsetCs: 0, note: '' }],
    perWeek: 3,
    weeks: 5,
  }

  test('운영자만 덮어쓰고, 회원은 읽는다', async () => {
    await backend.signIn(DEMO_MEMBER.name, DEMO_MEMBER.password)
    await expect(backend.saveSetOverride({ stroke: 'free', distance: 50 }, 1, plan)).rejects.toThrow('운영자')
    await backend.signOut()

    await backend.signIn(DEMO_ADMIN.name, DEMO_ADMIN.password)
    await backend.saveSetOverride({ stroke: 'free', distance: 50 }, 1, plan)
    await backend.saveSetOverride({ stroke: 'free', distance: 50 }, 1, { ...plan, weeks: 6 })
    await backend.signOut()

    await backend.signIn(DEMO_MEMBER.name, DEMO_MEMBER.password)
    const overrides = await backend.setOverrides()
    expect(overrides).toHaveLength(1)
    expect(overrides[0]!.plan.weeks).toBe(6)
    await backend.signOut()

    await backend.signIn(DEMO_ADMIN.name, DEMO_ADMIN.password)
    await backend.deleteSetOverride({ stroke: 'free', distance: 50 }, 1)
    expect(await backend.setOverrides()).toEqual([])
  })
})

describe('운영자가 정하는 비밀번호 · 회원 정보', () => {
  test('가입 전 회원은 계정이 바로 생기고, 바꾸라는 표시가 붙었다가 스스로 바꾸면 꺼진다', async () => {
    await backend.signIn(DEMO_ADMIN.name, DEMO_ADMIN.password)
    const member = await backend.createMember({ displayName: '새회원', role: 'member', joinedOn: TODAY, sex: 'F', birthYear: 1988 })
    const invite = await backend.issueInvite(member.id)
    const results = await backend.setPasswords([
      { memberId: member.id, password: 'start123' },
      { memberId: 'nobody', password: 'start123' },
      { memberId: member.id, password: 'abc' },
    ])
    expect(results.map((r) => r.error === null)).toEqual([true, false, false])
    expect((await backend.members()).find((m) => m.id === member.id)?.status).toBe('active')
    await backend.signOut()

    // 남아 있던 초대코드는 무효
    await expect(backend.redeemInvite(invite.code, 'whatever1')).rejects.toBeInstanceOf(UserFacingError)

    const me = await backend.signIn('새회원', 'start123')
    expect(me.sex).toBe('F')
    expect(await backend.passwordIsTemporary()).toBe(true)
    await backend.changePassword('start123', 'mine1234')
    expect(await backend.passwordIsTemporary()).toBe(false)
  })

  test('회원은 남의 비밀번호 · 정보를 못 바꾼다', async () => {
    await backend.signIn(DEMO_MEMBER.name, DEMO_MEMBER.password)
    await expect(backend.setPasswords([{ memberId: 'demo-2', password: 'hacked1' }])).rejects.toThrow('운영자')
    await expect(backend.updateMemberProfile('demo-2', { sex: 'M', birthYear: 1990 })).rejects.toThrow('운영자')
  })

  test('운영자는 성별 · 출생연도를 고치고 지울 수 있다', async () => {
    await backend.signIn(DEMO_ADMIN.name, DEMO_ADMIN.password)
    await backend.updateMemberProfile('demo-1', { sex: null, birthYear: null })
    const hong = (await backend.members()).find((m) => m.id === 'demo-1')!
    expect([hong.sex, hong.birthYear]).toEqual([null, null])
  })
})

test('직접 입력한 모임 — 이름이 있어야 하고, 정해 둔 종류는 이름을 버린다', async () => {
  await backend.signIn(DEMO_ADMIN.name, DEMO_ADMIN.password)
  await expect(backend.createMeeting({ date: TODAY, kind: 'custom', label: '  ', place: '' })).rejects.toThrow('모임 이름')
  const sea = await backend.createMeeting({ date: TODAY, kind: 'custom', label: ' 바다수영 ', place: '' })
  expect(sea.label).toBe('바다수영')
  const training = await backend.createMeeting({ date: TODAY, kind: 'training', label: '무시됨', place: '' })
  expect(training.label).toBe('')
})

test('전체 기록은 운영자만', async () => {
  await backend.signIn(DEMO_MEMBER.name, DEMO_MEMBER.password)
  await expect(backend.allRecords()).rejects.toThrow('운영자')
  await backend.signOut()
  await backend.signIn(DEMO_ADMIN.name, DEMO_ADMIN.password)
  const all = await backend.allRecords()
  expect(new Set(all.map((r) => r.memberId)).size).toBeGreaterThan(1)
})
