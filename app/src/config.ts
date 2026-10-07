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
