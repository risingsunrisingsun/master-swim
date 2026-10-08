/**
 * 운영자가 회원 비밀번호를 직접 정한다 (ADR-0011 보완).
 *
 * 처음에는 운영자가 명단을 일괄 입력하면서 비밀번호도 정해 준다. 회원은 초대코드 없이
 * 이름과 그 비밀번호로 바로 들어오고, '내 계정'에서 자기 비밀번호로 바꾼다.
 *
 * 입력 `{ entries: [{ memberId, password }] }` → 출력 `{ results: [{ memberId, error }] }`.
 * - 가입 전 회원: Auth 사용자를 만들고 members.user_id 에 잇고 '사용 중'으로 바꾼다.
 * - 가입한 회원: 비밀번호만 바꾼다(운영자가 해 주는 분실 처리).
 * - 어느 쪽이든 그 회원의 안 쓴 초대코드는 무효로 한다 — 코드로 비밀번호가 다시 바뀌지 않게.
 * - Auth 사용자 메타데이터에 `temp_password: true` 를 남긴다. 회원이 스스로 바꾸면 앱이 끈다.
 *
 * 부르는 사람이 **활성 운영자인지 이 함수가 확인한다.** service_role 로 RLS 를 넘기 때문이다.
 * JWT 검사는 게이트웨이에 맡기지 않고(--no-verify-jwt) 여기서 getUser 로 한다.
 * Deno 런타임 — 앱 번들과 tsconfig 에 들어가지 않는다.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

const PASSWORD_MIN = 6
/** bcrypt 가 72바이트에서 자른다. 한글 비밀번호면 24자쯤. */
const PASSWORD_MAX_BYTES = 72
const BATCH_MAX = 100
const DOMAIN = Deno.env.get('AUTH_EMAIL_DOMAIN') ?? 'members.nineteen.invalid'

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

interface Entry {
  memberId: string
  password: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return reply(405, { error: 'POST 만 받습니다.' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // ── 부른 사람이 운영자인가 ──
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: caller } = token ? await admin.auth.getUser(token) : { data: { user: null } }
  if (!caller.user) return reply(401, { error: '다시 로그인해 주세요.' })
  const { data: me } = await admin
    .from('members')
    .select('id')
    .eq('user_id', caller.user.id)
    .eq('role', 'admin')
    .eq('status', 'active')
    .maybeSingle()
  if (!me) return reply(403, { error: '운영자만 비밀번호를 정할 수 있습니다.' })

  // ── 입력 ──
  let entries: Entry[] = []
  try {
    const body = await request.json()
    if (!Array.isArray(body.entries)) throw new Error('entries')
    entries = body.entries.map((e: Record<string, unknown>) => ({
      memberId: String(e.memberId ?? ''),
      password: String(e.password ?? ''),
    }))
  } catch {
    return reply(400, { error: '요청 형식이 잘못됐습니다.' })
  }
  if (entries.length === 0 || entries.length > BATCH_MAX) {
    return reply(400, { error: `한 번에 1~${BATCH_MAX}명까지입니다.` })
  }

  // ── 한 명씩 ──
  const results: { memberId: string; error: string | null }[] = []
  for (const { memberId, password } of entries) {
    results.push({ memberId, error: await setOne(admin, memberId, password) })
  }
  return reply(200, { results })
})

// deno-lint-ignore no-explicit-any
async function setOne(admin: any, memberId: string, password: string): Promise<string | null> {
  if (password.length < PASSWORD_MIN) return `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return '비밀번호가 너무 깁니다.'

  const { data: member } = await admin
    .from('members')
    .select('id, status, user_id')
    .eq('id', memberId)
    .maybeSingle()
  if (!member) return '회원을 찾을 수 없습니다.'
  if (member.status === 'inactive') return '사용이 중지된 회원입니다.'

  const metadata = { temp_password: true }
  if (member.user_id) {
    const { error } = await admin.auth.admin.updateUserById(member.user_id, { password, user_metadata: metadata })
    if (error) {
      console.error('password update failed', memberId, error)
      return '비밀번호를 바꾸지 못했습니다.'
    }
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: `${member.id}@${DOMAIN}`,
      password,
      email_confirm: true,
      user_metadata: metadata,
    })
    if (error || !data.user) {
      console.error('createUser failed', memberId, error)
      return '계정을 만들지 못했습니다.'
    }
    const { error: linkError } = await admin
      .from('members')
      .update({ user_id: data.user.id, status: 'active' })
      .eq('id', member.id)
    if (linkError) {
      console.error('member link failed', memberId, linkError)
      await admin.auth.admin.deleteUser(data.user.id)
      return '계정을 만들지 못했습니다.'
    }
  }

  if (member.user_id && member.status !== 'active') {
    await admin.from('members').update({ status: 'active' }).eq('id', member.id)
  }
  // 남은 초대코드로 비밀번호가 다시 바뀌지 않게.
  await admin.from('invites').update({ used_at: new Date().toISOString() }).eq('member_id', member.id).is('used_at', null)
  return null
}
