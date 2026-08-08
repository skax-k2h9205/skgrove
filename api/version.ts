// 현재 배포의 식별자를 돌려준다. 프론트(versionWatch)가 자기가 뜬 시점의 값과 비교해,
// 새 배포가 나오면 스스로 새로고침한다 — 옛 번들 탭이 공유 DB 를 옛 로직으로 되돌리는
// 사고(계정 사진 소실·권한 원복)를 막는다. 캐시하지 않는다: 항상 '지금 배포'를 반영해야 한다.
//
// export default handler 로 두면 Vercel 이 (req,res) 로 불러 Response 를 버린다(api/ai.ts 참고).
// 메서드별 named export 를 쓴다.
function env(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

export async function GET(): Promise<Response> {
  // 배포마다 유일한 값. 같은 커밋을 다시 배포해도 달라지도록 DEPLOYMENT_ID 를 우선한다.
  const id = env('VERCEL_DEPLOYMENT_ID') || env('VERCEL_GIT_COMMIT_SHA') || 'dev';
  return new Response(JSON.stringify({ id }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
