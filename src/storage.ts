/**
 * 기기 로컬 저장소.
 *
 * 1차 버전에는 서버가 없다. 2차에서 기록 데이터만 Supabase 로 올라가고,
 * 신체 데이터(`profile.body`)는 영구히 여기 남는다 — 서버 테이블에 컬럼 자체를
 * 만들지 않는다 (ADR-0002).
 */
import type { Profile, RecordEntry } from './types'

const KEY = 'masters-swim/v1'

export interface SavedState {
  version: 2
  profile: Profile | null
  records: RecordEntry[]
  updatedAt: string
}

const EMPTY: SavedState = { version: 2, profile: null, records: [], updatedAt: '' }

/** 어느 버전에서 왔는지 모르는 값. 좁히기 전에는 이 모양으로만 다룬다. */
interface StoredShape {
  version?: number
  profile?: Profile | null
  records?: RecordEntry[]
  updatedAt?: string
}

/** v1 에는 records 가 없었다. 필드를 채워 넣기만 하면 되므로 값을 버리지 않는다. */
function migrate(raw: unknown): SavedState {
  const state = raw as StoredShape | null
  if (state?.version !== 1 && state?.version !== 2) return EMPTY

  return {
    version: 2,
    profile: state.profile ?? null,
    records: state.records ?? [],
    updatedAt: state.updatedAt ?? '',
  }
}

export function load(): SavedState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    return migrate(JSON.parse(raw))
  } catch {
    // 저장소가 막혀 있거나(사파리 프라이빗) 값이 깨졌으면 빈 상태로 시작한다.
    return EMPTY
  }
}

function write(state: SavedState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }))
  } catch {
    // 저장 실패는 앱을 멈출 이유가 아니다. 계산은 그대로 화면에 남는다.
  }
}

export function saveProfile(profile: Profile): void {
  write({ ...load(), profile })
}

/** 기록은 날짜 오름차순으로 유지한다 — 그래프가 그 순서를 그대로 쓴다. */
export function addRecord(entry: RecordEntry): void {
  const state = load()
  const records = [...state.records, entry].sort((a, b) => a.date.localeCompare(b.date))
  write({ ...state, records })
}

export function removeRecord(index: number): void {
  const state = load()
  write({ ...state, records: state.records.filter((_, i) => i !== index) })
}

/** 기기를 바꿀 때 붙여넣기로 복구할 수 있게 전체 상태를 텍스트로 뽑는다. */
export function exportJson(): string {
  return JSON.stringify(load(), null, 2)
}

export function importJson(text: string): boolean {
  try {
    const state = migrate(JSON.parse(text))
    if (!state.profile && state.records.length === 0) return false
    write(state)
    return true
  } catch {
    return false
  }
}
