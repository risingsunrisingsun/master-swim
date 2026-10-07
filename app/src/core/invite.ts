/**
 * 초대코드 모양(ADR-0011).
 *
 * 8자. 손으로 옮겨 적고 카톡으로 보내므로 헷갈리는 글자를 뺐다 —
 * 0/O, 1/I/L. 화면에는 `ABCD-EFGH` 로 끊어 보여주고, 입력은 하이픈·공백·소문자를 받는다.
 *
 * 서버(`issue_invite` SQL 함수)가 같은 알파벳으로 만든다. 바꾸면 둘 다 바꾼다.
 */

export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 8
/** 초대코드 유효기간. */
export const INVITE_DAYS = 7

/** 입력을 저장 형태로. 하이픈·공백을 지우고 대문자로. */
export function normalizeCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase()
}

export function isCodeShape(normalized: string): boolean {
  if (normalized.length !== CODE_LENGTH) return false
  return [...normalized].every((char) => CODE_ALPHABET.includes(char))
}

/** `ABCDEFGH` → `ABCD-EFGH` */
export function formatCode(normalized: string): string {
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`
}

/** 난수를 인자로 받는다 — 테스트가 결과를 고정할 수 있게. */
export function generateCode(random: () => number): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]
  }
  return code
}

/** 비밀번호 최소 조건. 동호회 앱이라 복잡도 규칙은 두지 않고 길이만 본다. */
export const PASSWORD_MIN = 6

export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < PASSWORD_MIN) return `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`
  if (password !== confirm) return '비밀번호 두 칸이 다릅니다.'
  return null
}
