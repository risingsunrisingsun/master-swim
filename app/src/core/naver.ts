/**
 * 네이버 로그인 (ADR-0012) — 순수 함수만.
 *
 * 흐름: 앱이 네이버 인증 화면으로 보냄 → 네이버가 `?code=…&state=…` 를 붙여 앱 주소로 돌려보냄 →
 * 앱이 state 를 확인하고 code 를 Edge Function `naver-login` 에 넘김 → 함수가 명단과 잇는다.
 *
 * state 는 이 기기에서 만든 난수다. 돌아온 값이 다르면 남이 만든 링크로 들어온 것이므로 버린다.
 */
import type { Member } from './types'

export const NAVER_AUTHORIZE = 'https://nid.naver.com/oauth2.0/authorize'
/** sessionStorage 에 state 를 두는 키. */
export const NAVER_STATE_KEY = 'nineteen-naver-state'

export function authorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL(NAVER_AUTHORIZE)
  url.search = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, state }).toString()
  return url.toString()
}

export function newState(random: (bytes: Uint8Array) => Uint8Array): string {
  return [...random(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface NaverCallback {
  code: string | null
  state: string | null
  /** 사용자가 동의를 거절했거나 네이버가 오류를 돌려줬다. */
  error: string | null
}

/** 앱 주소의 `?code=…&state=…` · `?error=…` 를 읽는다. 네이버에서 돌아온 게 아니면 null. */
export function readCallback(search: string): NaverCallback | null {
  const params = new URLSearchParams(search)
  if (!params.has('code') && !params.has('error')) return null
  return { code: params.get('code'), state: params.get('state'), error: params.get('error') }
}

/**
 * 자동 연결 규칙 — Edge Function `naver-login` 의 `rosterMatch` 와 **똑같다**(데모 모드가 이것을 쓴다).
 * 사용 중지가 아니고 아직 네이버에 연결되지 않은 회원 가운데서 고른다.
 *
 * 1. **이름이 똑같은 회원** — 출생연도가 명단과 네이버 **양쪽에 다 있고 같아야** 한다.
 *    명단에 출생연도가 비어 있으면 자동으로 잇지 않는다 — 운영자 승인으로 간다(2026-11-20 운영진 결정).
 * 2. 없으면 **동명이인 표시가 붙은 회원** — `김민수A` · `김민수 2` · `김민수(83)` 처럼 이름 뒤에 영문 · 숫자
 *    네 자까지 붙은 회원. 이쪽은 출생연도가 **양쪽에 다 있고 같아야** 하고, 그런 회원이 딱 한 명이어야 한다.
 *    출생연도 없이 이름 앞부분만으로 잇는 일은 없다.
 *
 * 출생연도가 맞지 않거나 네이버가 출생연도를 주지 않으면(회원이 제공 동의를 껐다) 가입 신청으로 간다.
 */
export function rosterMatch<T extends Pick<Member, 'displayName' | 'status' | 'naverLinked' | 'birthYear'>>(
  members: readonly T[],
  naverName: string,
  naverBirthYear: number | null,
): T | null {
  const name = naverName.trim()
  if (!name || naverBirthYear === null) return null
  const open = members.filter((m) => m.status !== 'inactive' && !m.naverLinked)

  const exact = open.find((m) => m.displayName === name)
  if (exact) return exact.birthYear === naverBirthYear ? exact : null

  const marked = open.filter(
    (m) => m.birthYear === naverBirthYear && m.displayName.startsWith(name) && SAME_NAME_MARK.test(m.displayName.slice(name.length)),
  )
  return marked.length === 1 ? marked[0]! : null
}

/** 동명이인 표시 — 이름 뒤에 붙는 `A` · ` 2` · `(83)`. 한글은 받지 않는다(`김민` 이 `김민수` 를 잡지 않게). */
const SAME_NAME_MARK = /^\s?\(?[A-Za-z0-9]{1,4}\)?$/
