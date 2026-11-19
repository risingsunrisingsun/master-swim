import { expect, test } from 'bun:test'
import { authorizeUrl, newState, readCallback, rosterMatch } from './naver'

test('인증 주소 — code 방식, 돌아올 주소와 state 가 실린다', () => {
  const url = new URL(authorizeUrl('CID', 'https://example.org/master-swim/app/', 'abc'))
  expect(url.origin + url.pathname).toBe('https://nid.naver.com/oauth2.0/authorize')
  expect(Object.fromEntries(url.searchParams)).toEqual({
    response_type: 'code',
    client_id: 'CID',
    redirect_uri: 'https://example.org/master-swim/app/',
    state: 'abc',
  })
})

test('state — 16바이트 난수를 32자리 16진수로', () => {
  expect(newState((b) => b.fill(255))).toBe('f'.repeat(32))
  expect(newState((b) => b.fill(1))).toHaveLength(32)
})

test('돌아온 주소 읽기', () => {
  expect(readCallback('?code=C&state=S')).toEqual({ code: 'C', state: 'S', error: null })
  expect(readCallback('?error=access_denied&state=S')).toEqual({ code: null, state: 'S', error: 'access_denied' })
  expect(readCallback('')).toBeNull()
  expect(readCallback('?m=1')).toBeNull()
})

const member = (id: string, displayName: string, birthYear: number | null, extra: Partial<{ status: 'active' | 'invited' | 'inactive'; naverLinked: boolean }> = {}) => ({
  id,
  displayName,
  birthYear,
  status: extra.status ?? ('active' as const),
  naverLinked: extra.naverLinked ?? false,
})

test('자동 연결 — 중지 아니고, 아직 네이버 미연결인 회원만', () => {
  const members = [
    member('a', '홍길동', 1985),
    member('c', '이영희', 1990, { status: 'inactive' }),
    member('d', '박철수', 1980, { naverLinked: true }),
  ]
  expect(rosterMatch(members, ' 홍길동 ', 1985)?.id).toBe('a')
  expect(rosterMatch(members, '이영희', 1990)).toBeNull() // 중지된 회원
  expect(rosterMatch(members, '박철수', 1980)).toBeNull() // 이미 다른 네이버에 연결 — 가로채기 막기
  expect(rosterMatch(members, '', 1985)).toBeNull()
})

test('명단에 출생연도가 있으면 네이버 출생연도도 같아야 한다', () => {
  const members = [member('a', '홍길동', 1985)]
  expect(rosterMatch(members, '홍길동', 1985)?.id).toBe('a')
  expect(rosterMatch(members, '홍길동', 1990)).toBeNull() // 이름만 같은 다른 사람
  expect(rosterMatch(members, '홍길동', null)).toBeNull() // 출생연도 제공을 끈 경우 — 승인으로
})

test('명단에 출생연도가 없으면 이름이 같아도 잇지 않는다 — 운영자 승인으로', () => {
  expect(rosterMatch([member('a', '홍길동', null)], '홍길동', null)).toBeNull()
  expect(rosterMatch([member('a', '홍길동', null)], '홍길동', 1985)).toBeNull()
})

test('동명이인 표시가 붙은 회원은 출생연도가 같을 때만, 한 명일 때만', () => {
  const members = [
    member('a', '김민수A', 1980),
    member('b', '김민수B', 1990),
    member('c', '김민수 (83)', 1983),
    member('d', '김민수아', 1990), // 한글이 붙은 건 다른 이름
  ]
  expect(rosterMatch(members, '김민수', 1990)?.id).toBe('b')
  expect(rosterMatch(members, '김민수', 1983)?.id).toBe('c')
  expect(rosterMatch(members, '김민수', 1975)).toBeNull()
  expect(rosterMatch(members, '김민수', null)).toBeNull()
  expect(rosterMatch(members, '김민', 1990)).toBeNull()
  // 같은 해에 둘이면 고를 수 없다 — 운영자 승인으로
  expect(rosterMatch([member('a', '김민수A', 1990), member('b', '김민수B', 1990)], '김민수', 1990)).toBeNull()
  // 표시가 붙은 회원도 출생연도가 비어 있으면 잇지 않는다
  expect(rosterMatch([member('a', '김민수A', null)], '김민수', 1990)).toBeNull()
})

test('이름이 똑같은 회원이 있으면 그쪽만 본다 — 출생연도가 달라도 표시 붙은 회원으로 넘어가지 않는다', () => {
  const members = [member('a', '김민수', 1980), member('b', '김민수B', 1990)]
  expect(rosterMatch(members, '김민수', 1990)).toBeNull()
})
