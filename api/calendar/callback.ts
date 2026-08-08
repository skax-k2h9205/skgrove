// 구글 OAuth 리디렉션 목적지 — 코드를 액세스 토큰으로 바꿔 opener 창에 넘긴다.
//
// 이 경로가 곧 구글 콘솔의 '승인된 리디렉션 URI' 다:
//   http://127.0.0.1:8787/api/calendar/callback   (로컬 통합 프록시)
//   https://<배포주소>/api/calendar/callback       (Vercel)
// 쿼리 파라미터를 붙이지 않는다. 쿼리가 든 리디렉션 URI 는 구글 콘솔이 거부하는 경우가 있다.
import { TOKEN_URL, callbackPage, config } from './_shared.js';

/* 구글이 브라우저를 여기로 되돌려보내므로 GET 이다. `export default handler` 로 두면
   Vercel 이 (req, res) 로 불러서 돌려준 Response 가 버려진다 — index.ts 와 같은 이유. */
export async function GET(request: Request): Promise<Response> {
  const settings = config();
  const html = (body: string, status = 200) =>
    new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

  if (!settings) {
    return new Response('구글 캘린더 연동이 설정되지 않았습니다.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const url = new URL(request.url);

  // 사용자가 동의를 거부하면 code 대신 error 가 온다.
  const denied = url.searchParams.get('error');
  if (denied) return html(callbackPage(settings.appOrigin, { error: denied }));

  const code = url.searchParams.get('code');
  if (!code) return html(callbackPage(settings.appOrigin, { error: 'no code' }));

  try {
    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        redirect_uri: settings.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const data = (await tokenResponse.json().catch(() => null)) as
      | { access_token?: string; expires_in?: number; error_description?: string; error?: string }
      | null;
    if (!tokenResponse.ok || !data?.access_token) {
      const reason = data?.error_description || data?.error || 'token exchange failed';
      return html(callbackPage(settings.appOrigin, { error: reason }));
    }
    // expires_in 을 함께 넘긴다. 이게 없으면 프론트가 토큰을 언제 버려야 할지 몰라
    // 조회할 때마다 동의 팝업을 다시 띄우게 된다. 구글은 보통 3600(초)을 준다.
    return html(
      callbackPage(settings.appOrigin, {
        accessToken: data.access_token,
        expiresIn: Number(data.expires_in) || 0,
      }),
    );
  } catch (cause) {
    return html(callbackPage(settings.appOrigin, { error: String(cause) }));
  }
}
