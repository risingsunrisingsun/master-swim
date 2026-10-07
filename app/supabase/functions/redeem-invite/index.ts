/**
 * 초대코드로 가입 · 비밀번호 재설정 (ADR-0011).
 *
 * 입력 `{ code, password }` → 출력 `{ displayName }`. 앱은 받은 이름과 비밀번호로
 * 곧바로 로그인한다.
 *
 * - 처음 쓰는 회원: Auth 사용자를 만들고 members.user_id 에 잇는다.
 * - 이미 가입한 회원: 비밀번호만 바꾼다. 분실 처리가 이 흐름 하나다.
 *
 * service_role 키를 쓰므로 RLS 를 넘는다. 검사는 전부 이 파일 안에서 한다.
 * Deno 런타임 — 앱 번들과 tsconfig 에 들어가지 않는다.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const PASSWORD_MIN = 6
/** 보내지 않는 내부 주소의 도메인. 회원은 이 값을 볼 일이 없다. */
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

const BAD_CODE = '초대코드가 맞지 않거나 기한이 지났습니다. 운영자에게 새 코드를 받으세요.'

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return reply(405, { error: 'POST 만 받습니다.' })

  let code = ''
  let password = ''
  try {
    const body = await request.json()
    code = String(body.code ?? '').replace(/[\s-]/g, '').toUpperCase()
    password = String(body.password ?? '')
  } catch {
    return reply(400, { error: '요청 형식이 잘못됐습니다.' })
  }

  if (code.length !== 8 || ![...code].every((c) => ALPHABET.includes(c))) return reply(400, { error: BAD_CODE })
  if (password.length < PASSWORD_MIN) return reply(400, { error: `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.` })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const hash = await sha256Hex(code)

  // 먼저 "사용함"으로 찍어서 코드를 차지한다. 같은 코드가 동시에 두 번 들어와도 하나만 통과한다.
  const now = new Date().toISOString()
  const { data: claimed, error: claimError } = await admin
    .from('invites')
    .update({ used_at: now })
    .eq('code_hash', hash)
    .is('used_at', null)
    .gt('expires_at', now)
    .select('member_id')
  if (claimError) {
    // 대시보드 Edge Function 로그에 원인이 남게 한다. 회원에게는 일반 문구만 보낸다.
    console.error('invite claim failed', claimError)
    return reply(500, { error: '잠시 후 다시 시도해 주세요.' })
  }
  const memberId = claimed?.[0]?.member_id as string | undefined
  if (!memberId) return reply(400, { error: BAD_CODE })

  const release = () => admin.from('invites').update({ used_at: null }).eq('code_hash', hash)

  const { data: member } = await admin
    .from('members')
    .select('id, display_name, status, user_id')
    .eq('id', memberId)
    .single()
  if (!member || member.status === 'inactive') {
    return reply(403, { error: '사용이 중지된 계정입니다. 운영자에게 문의하세요.' })
  }

  if (member.user_id) {
    const { error } = await admin.auth.admin.updateUserById(member.user_id, { password })
    if (error) {
      console.error('password update failed', error)
      await release()
      return reply(500, { error: '비밀번호를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.' })
    }
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: `${member.id}@${DOMAIN}`,
      password,
      email_confirm: true,
    })
    if (error || !data.user) {
      console.error('createUser failed', error)
      await release()
      return reply(500, { error: '가입하지 못했습니다. 잠시 후 다시 시도해 주세요.' })
    }
    const { error: linkError } = await admin.from('members').update({ user_id: data.user.id }).eq('id', member.id)
    if (linkError) {
      console.error('member link failed', linkError)
      await admin.auth.admin.deleteUser(data.user.id)
      await release()
      return reply(500, { error: '가입하지 못했습니다. 잠시 후 다시 시도해 주세요.' })
    }
  }

  if (member.status !== 'active') {
    await admin.from('members').update({ status: 'active' }).eq('id', member.id)
  }

  return reply(200, { displayName: member.display_name })
})
