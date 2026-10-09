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
 * 자동 연결 규칙 — Edge Function 과 같다(데모 모드가 이것을 쓴다).
 * 이름이 똑같고, 사용 중지가 아니고, 아직 네이버에 연결되지 않은 회원. 이름은 유일하므로 많아야 한 명.
 */
export function rosterMatch<T extends Pick<Member, 'displayName' | 'status' | 'naverLinked'>>(
  members: readonly T[],
  naverName: string,
): T | null {
  const name = naverName.trim()
  if (!name) return null
  return members.find((m) => m.displayName === name && m.status !== 'inactive' && !m.naverLinked) ?? null
}
