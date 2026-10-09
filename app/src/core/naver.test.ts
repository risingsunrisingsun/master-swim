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

test('자동 연결 — 이름이 똑같고, 중지 아니고, 아직 네이버 미연결인 회원만', () => {
  const members = [
    { id: 'a', displayName: '홍길동', status: 'active' as const, naverLinked: false },
    { id: 'b', displayName: '김민수A', status: 'invited' as const, naverLinked: false },
    { id: 'c', displayName: '이영희', status: 'inactive' as const, naverLinked: false },
    { id: 'd', displayName: '박철수', status: 'active' as const, naverLinked: true },
  ]
  expect(rosterMatch(members, ' 홍길동 ')?.id).toBe('a')
  expect(rosterMatch(members, '김민수')).toBeNull() // 동명이인 표시는 운영자 승인으로
  expect(rosterMatch(members, '이영희')).toBeNull() // 중지된 회원
  expect(rosterMatch(members, '박철수')).toBeNull() // 이미 다른 네이버에 연결 — 가로채기 막기
  expect(rosterMatch(members, '')).toBeNull()
})
