import { describe, expect, test } from 'bun:test'
import { DRYLAND_SETS, searchDryland, setsFor, videoUrl } from './dryland'
import { methodById } from './methods'
import type { Stroke } from './types'

const STROKES = ['free', 'back', 'breast', 'fly'] as const

describe('지상훈련 데이터 무결성', () => {
  test('아이디가 겹치지 않는다', () => {
    const ids = DRYLAND_SETS.map((set) => set.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('모든 세트에 이유와 동작이 있다', () => {
    for (const set of DRYLAND_SETS) {
      expect(set.title.length).toBeGreaterThan(0)
      expect(set.why.length).toBeGreaterThan(20)
      expect(set.exercises.length).toBeGreaterThan(0)
    }
  })

  // 동작 이름만 있으면 아무 도움이 안 된다. 처방과 요령이 함께 가야 한다.
  test('모든 동작에 세트·반복과 요령이 있다', () => {
    for (const set of DRYLAND_SETS) {
      for (const exercise of set.exercises) {
        expect(exercise.name.length).toBeGreaterThan(0)
        expect(exercise.prescription.length).toBeGreaterThan(0)
        expect(exercise.cue.length).toBeGreaterThan(10)
      }
    }
  })

  test('네 영법에 각각 세트가 있다', () => {
    for (const stroke of STROKES) {
      expect(DRYLAND_SETS.some((set) => set.scope === stroke)).toBe(true)
    }
  })

  // 처방 파라미터의 원본은 `methods.ts` 다. 가리키는 id 가 없어지면 여기서 걸린다.
  test('method 로 가리키는 육상 방법이 실제로 있다', () => {
    for (const set of DRYLAND_SETS) {
      if (!set.method) continue
      const method = methodById(set.method)
      expect(method).toBeDefined()
      expect(method!.kind).toBe('dryland')
    }
  })
})

describe('영상 링크', () => {
  test('모든 영상에 제목과 채널이 있다 — 회원이 출처를 보고 판단해야 한다', () => {
    for (const set of DRYLAND_SETS) {
      for (const video of set.videos) {
        expect(video.title.length).toBeGreaterThan(0)
        expect(video.channel.length).toBeGreaterThan(0)
      }
    }
  })

  // 유튜브 영상 id 는 11자 [A-Za-z0-9_-] 다. 오타가 나면 죽은 링크가 나간다.
  test('영상 id 가 유튜브 형식이다', () => {
    for (const set of DRYLAND_SETS) {
      for (const video of set.videos) expect(video.id).toMatch(/^[A-Za-z0-9_-]{11}$/)
    }
  })

  test('같은 영상이 두 번 실리지 않는다', () => {
    const ids = DRYLAND_SETS.flatMap((set) => set.videos.map((video) => video.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('videoUrl 이 watch 주소를 만든다', () => {
    expect(videoUrl({ id: 'abc12345678', title: 't', channel: 'c' })).toBe(
      'https://www.youtube.com/watch?v=abc12345678',
    )
  })
})

describe('setsFor', () => {
  test('공통 세트는 어떤 영법에서도 나온다', () => {
    const commonCount = DRYLAND_SETS.filter((set) => set.scope === 'common').length
    for (const stroke of STROKES) {
      const sets = setsFor(stroke)
      expect(sets.filter((set) => set.scope === 'common').length).toBe(commonCount)
    }
  })

  test('고른 영법의 세트만 함께 나온다', () => {
    const sets = setsFor('breast')
    const strokeScoped = sets.filter((set) => set.scope !== 'common')
    expect(strokeScoped.length).toBe(1)
    expect(strokeScoped[0]!.scope).toBe('breast')
  })

  // 개인혼영은 네 영법을 다 하므로 네 세트를 모두 돌려준다.
  test('개인혼영은 네 영법 세트를 전부 돌려준다', () => {
    const sets = setsFor('im')
    const scopes = sets.filter((set) => set.scope !== 'common').map((set) => set.scope)
    expect(scopes.sort()).toEqual([...STROKES].sort())
  })

  test('공통 세트가 영법 세트보다 먼저 나온다', () => {
    const sets = setsFor('fly')
    const firstStroke = sets.findIndex((set) => set.scope !== 'common')
    const lastCommon = sets.map((set) => set.scope).lastIndexOf('common')
    expect(lastCommon).toBeLessThan(firstStroke)
  })

  test('모든 영법에서 빈 목록이 나오지 않는다', () => {
    for (const stroke of ['free', 'back', 'breast', 'fly', 'im'] as Stroke[]) {
      expect(setsFor(stroke).length).toBeGreaterThan(0)
    }
  })
})

describe('searchDryland', () => {
  test('빈 입력은 빈 배열 — 화면이 영법별 목록으로 돌아갈 수 있어야 한다', () => {
    expect(searchDryland('')).toEqual([])
    expect(searchDryland('   ')).toEqual([])
  })

  test('세트 제목으로 찾는다', () => {
    expect(searchDryland('어깨').map((set) => set.id)).toContain('shoulder')
  })

  test('동작 이름으로 찾는다', () => {
    // '데드버그'는 코어 세트의 동작 이름에만 있다.
    expect(searchDryland('데드버그').map((set) => set.id)).toContain('core')
  })

  test('영법을 가리지 않는다 — 밴드는 공통과 영법 세트 양쪽에 있다', () => {
    const found = searchDryland('밴드')
    expect(found.length).toBeGreaterThan(1)
    expect(found.some((set) => set.scope === 'common')).toBe(true)
    expect(found.some((set) => set.scope !== 'common')).toBe(true)
  })

  test('영상 채널명으로도 찾는다', () => {
    expect(searchDryland('U.S. Masters Swimming').map((set) => set.id)).toContain('core')
  })

  test('대소문자를 가리지 않는다', () => {
    expect(searchDryland('masters').length).toBeGreaterThan(0)
    expect(searchDryland('MASTERS').length).toBeGreaterThan(0)
  })

  test('같은 세트가 두 번 나오지 않는다 — 여러 필드에 맞아도 한 번이다', () => {
    const ids = searchDryland('어깨').map((set) => set.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('없는 말은 빈 배열', () => {
    expect(searchDryland('역도')).toEqual([])
  })
})
