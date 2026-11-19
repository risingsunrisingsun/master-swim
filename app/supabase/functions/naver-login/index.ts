/**
 * 네이버 로그인 (ADR-0012).
 *
 * 앱이 네이버 인증 화면에서 돌아오며 받은 `{ code, state }` 를 보낸다.
 *   1. code → 네이버 접근 토큰(client secret 은 이 함수의 환경변수에만 있다)
 *   2. 토큰 → 네이버 프로필(고유 id · 실명 · 별명 · 성별 · 출생연도)
 *   3. 명단과 잇기
 *      - 이미 이 네이버 id 에 연결된 회원 → 그 회원
 *      - 아니면 `rosterMatch` — 실명 + 출생연도가 명단과 맞고 아직 네이버 미연결인 회원 → 자동 연결.
 *        출생연도는 명단과 네이버 양쪽에 다 있고 같아야 한다(명단이 비어 있으면 운영자 승인).
 *        동명이인 표시(김민수A)가 붙은 회원은 그런 회원이 한 명일 때만. 규칙은 app/src/core/naver.ts 의 rosterMatch 와 똑같다.
 *      - 그 밖에는 가입 신청으로 남기고 `{ status: 'pending' }`
 *   4. 회원이면 Auth 사용자를 (없으면 만들어) 잇고, 일회용 로그인 토큰을 돌려준다.
 *      앱이 그 토큰으로 verifyOtp 를 불러 세션을 받는다 — 메일은 보내지 않는다.
 *
 * 비밀번호로 쓰던 회원도 같은 Auth 사용자에 이어지므로 기록 · 출석이 그대로다.
 * Deno 런타임 — 앱 번들과 tsconfig 에 들어가지 않는다.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

const DOMAIN = Deno.env.get('AUTH_EMAIL_DOMAIN') ?? 'members.nineteen.invalid'
const CLIENT_ID = Deno.env.get('NAVER_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('NAVER_CLIENT_SECRET') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

interface NaverProfile {
  id: string
  name: string
  nickname: string
  sex: 'M' | 'F' | null
  birthYear: number | null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return reply(405, { error: 'POST 만 받습니다.' })
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 가 없습니다')
    return reply(503, { error: '네이버 로그인이 아직 준비되지 않았습니다. 운영진에게 문의하세요.' })
  }

  let code = ''
  let state = ''
  try {
    const body = await request.json()
    code = String(body.code ?? '')
    state = String(body.state ?? '')
  } catch {
    return reply(400, { error: '요청 형식이 잘못됐습니다.' })
  }
  if (!code || !state) return reply(400, { error: '네이버 로그인을 다시 시도해 주세요.' })

  // ── 1 · 2. 네이버 ──
  const profile = await naverProfile(code, state)
  if (!profile) return reply(400, { error: '네이버 로그인을 확인하지 못했습니다. 다시 시도해 주세요.' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // ── 3. 명단과 잇기 ──
  const columns = 'id, display_name, status, user_id, naver_id, sex, birth_year'
  let { data: member } = await admin.from('members').select(columns).eq('naver_id', profile.id).maybeSingle()

  if (!member && profile.name.trim()) {
    // 이름이 같거나 이름으로 시작하는(동명이인 표시) 미연결 회원을 받아 앱과 같은 규칙으로 고른다.
    const name = profile.name.trim()
    const { data: candidates } = await admin
      .from('members')
      .select(columns)
      // LIKE 의 % · _ · \ 는 글자 그대로 찾게 막는다.
      .like('display_name', `${name.replace(/[\\%_]/g, '\\$&')}%`)
      .is('naver_id', null)
      .neq('status', 'inactive')
    const byName = rosterMatch((candidates ?? []) as MemberRow[], name, profile.birthYear)
    if (byName) {
      const { error } = await admin
        .from('members')
        .update({
          naver_id: profile.id,
          // 운영자가 비워 둔 칸만 네이버 값으로 채운다.
          sex: byName.sex ?? profile.sex,
          birth_year: byName.birth_year ?? profile.birthYear,
        })
        .eq('id', byName.id)
        .is('naver_id', null)
      if (error) {
        console.error('auto link failed', error)
        return reply(500, { error: '잠시 후 다시 시도해 주세요.' })
      }
      member = { ...byName, naver_id: profile.id }
    }
  }

  if (!member) {
    const { data: existing } = await admin
      .from('join_requests')
      .select('status')
      .eq('naver_id', profile.id)
      .maybeSingle()
    if (existing?.status === 'rejected') {
      return reply(403, { error: '가입 신청이 승인되지 않았습니다. 운영진에게 문의하세요.' })
    }
    const { error } = await admin.from('join_requests').upsert(
      {
        naver_id: profile.id,
        name: profile.name.slice(0, 60) || profile.nickname.slice(0, 60) || '이름 없음',
        nickname: profile.nickname.slice(0, 60),
        sex: profile.sex,
        birth_year: profile.birthYear,
      },
      { onConflict: 'naver_id' },
    )
    if (error) {
      console.error('join request failed', error)
      return reply(500, { error: '잠시 후 다시 시도해 주세요.' })
    }
    return reply(200, { status: 'pending', name: profile.name })
  }

  if (member.status === 'inactive') {
    return reply(403, { error: '사용이 중지된 계정입니다. 운영자에게 문의하세요.' })
  }

  // ── 4. 세션 ──
  const email = `${member.id}@${DOMAIN}`
  if (!member.user_id) {
    // 비밀번호는 쓰지 않는다 — 아무도 모르는 값으로 만든다. 나중에 운영자가 정해 줄 수는 있다.
    const random = crypto.getRandomValues(new Uint8Array(24))
    const password = btoa(String.fromCharCode(...random))
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error || !data.user) {
      console.error('createUser failed', error)
      return reply(500, { error: '계정을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.' })
    }
    const { error: linkError } = await admin
      .from('members')
      .update({ user_id: data.user.id, status: 'active' })
      .eq('id', member.id)
    if (linkError) {
      console.error('member link failed', linkError)
      await admin.auth.admin.deleteUser(data.user.id)
      return reply(500, { error: '계정을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.' })
    }
  } else if (member.status !== 'active') {
    await admin.from('members').update({ status: 'active' }).eq('id', member.id)
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const tokenHash = link?.properties?.hashed_token
  if (linkError || !tokenHash) {
    console.error('generateLink failed', linkError)
    return reply(500, { error: '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.' })
  }
  return reply(200, { status: 'member', tokenHash, displayName: member.display_name })
})

interface MemberRow {
  id: string
  display_name: string
  status: string
  user_id: string | null
  naver_id: string | null
  sex: 'M' | 'F' | null
  birth_year: number | null
}

/** 동명이인 표시 — 이름 뒤에 붙는 `A` · ` 2` · `(83)`. 한글은 받지 않는다. */
const SAME_NAME_MARK = /^\s?\(?[A-Za-z0-9]{1,4}\)?$/

/**
 * app/src/core/naver.ts 의 rosterMatch 와 **같은 규칙**(그쪽에 테스트가 있다). 고치면 둘 다 고친다.
 * 후보는 이미 "중지 아님 · 네이버 미연결"로 걸러져 들어온다.
 */
function rosterMatch(candidates: readonly MemberRow[], name: string, birthYear: number | null): MemberRow | null {
  if (birthYear === null) return null
  const exact = candidates.find((m) => m.display_name === name)
  if (exact) return exact.birth_year === birthYear ? exact : null
  const marked = candidates.filter(
    (m) => m.birth_year === birthYear && m.display_name.startsWith(name) && SAME_NAME_MARK.test(m.display_name.slice(name.length)),
  )
  return marked.length === 1 ? marked[0]! : null
}

async function naverProfile(code: string, state: string): Promise<NaverProfile | null> {
  const tokenUrl = new URL('https://nid.naver.com/oauth2.0/token')
  tokenUrl.search = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    state,
  }).toString()
  const tokenResponse = await fetch(tokenUrl, { method: 'POST' })
  const token = await tokenResponse.json().catch(() => null)
  if (!token?.access_token) {
    console.error('naver token failed', token?.error, token?.error_description)
    return null
  }

  const meResponse = await fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  const me = await meResponse.json().catch(() => null)
  const r = me?.response
  if (me?.resultcode !== '00' || !r?.id) {
    console.error('naver profile failed', me?.resultcode, me?.message)
    return null
  }
  const year = Number(r.birthyear)
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    nickname: String(r.nickname ?? ''),
    sex: r.gender === 'M' || r.gender === 'F' ? r.gender : null,
    birthYear: Number.isInteger(year) && year >= 1920 && year <= 2020 ? year : null,
  }
}
