/**
 * 빌드 때 환경변수에서 박아 넣는 값(`app/build.ts` 의 define).
 *
 * 둘 중 하나라도 비어 있으면 데모 모드(LocalBackend)로 뜬다.
 * anon 키는 공개돼도 된다 — RLS 가 지킨다. service_role 키는 절대 여기 두지 않는다.
 */
declare const __SUPABASE_URL__: string
declare const __SUPABASE_ANON_KEY__: string

export const SUPABASE_URL: string = __SUPABASE_URL__
export const SUPABASE_ANON_KEY: string = __SUPABASE_ANON_KEY__

/**
 * 네이버 로그인 Client ID(ADR-0012). 공개값이다 — 인증 화면 주소에 그대로 실린다.
 * Client Secret 은 Edge Function 환경변수에만 둔다. 비어 있으면 네이버 버튼이 없다.
 */
declare const __NAVER_CLIENT_ID__: string
export const NAVER_CLIENT_ID: string = __NAVER_CLIENT_ID__
