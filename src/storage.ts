/**
 * 기기 로컬 저장소.
 *
 * 1차 버전에는 서버가 없다. 2차에서 기록 데이터만 Supabase 로 올라가고,
 * 신체 데이터는 영구히 여기 남는다 — 서버 테이블에 컬럼 자체를 만들지 않는다. (ADR-0002)
 */
import type { Profile } from './types'

const KEY = 'masters-swim/v1'

export interface SavedState {
  version: 1
  profile: Profile | null
  updatedAt: string
}

const EMPTY: SavedState = { version: 1, profile: null, updatedAt: '' }

export function load(): SavedState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY

    const parsed = JSON.parse(raw) as SavedState
    return parsed.version === 1 ? parsed : EMPTY
  } catch {
    // 저장소가 막혀 있거나(사파리 프라이빗) 값이 깨졌으면 빈 상태로 시작한다.
    return EMPTY
  }
}

export function save(profile: Profile): void {
  const state: SavedState = { version: 1, profile, updatedAt: new Date().toISOString() }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // 저장 실패는 앱을 멈출 이유가 아니다. 계산은 그대로 화면에 남는다.
  }
}

/** 기기를 바꿀 때 붙여넣기로 복구할 수 있게 전체 상태를 텍스트로 뽑는다. */
export function exportJson(): string {
  return JSON.stringify(load(), null, 2)
}

export function importJson(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as SavedState
    if (parsed.version !== 1 || !parsed.profile) return false
    save(parsed.profile)
    return true
  } catch {
    return false
  }
}
