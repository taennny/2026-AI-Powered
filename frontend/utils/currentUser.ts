/**
 * 지금 로그인한 사용자의 id — GPS 큐가 좌표의 주인을 표시하는 데 쓴다.
 *
 * **액세스 토큰(JWT)의 `sub`에서 꺼낸다.** 백엔드가 `{"sub": user_id, ...}`로 발급한다
 * (`backend/app/utils/jwt.py`). 서버는 요청에 붙은 토큰으로 주인을 정하므로,
 * 그 토큰에서 뽑은 id가 곧 "이 좌표가 저장될 계정"이다 — 별도로 받아 저장하면
 * 두 값이 어긋날 수 있는데 이 방식은 어긋날 여지가 없다.
 *
 * `fetchMe()`를 쓰지 않는 이유는 네트워크가 필요해서다. 응답 전이거나 실패하면
 * 주인을 모르는 구간이 생기고, 그동안의 좌표는 버리거나 남의 계정에 붙일 수밖에 없다.
 *
 * 서명은 검증하지 않는다. 우리 디스크의 토큰에서 라벨만 읽는 용도이고,
 * 검증은 서버가 한다. 토큰이 없으면(=로그아웃) null이다.
 */

import {getAccessToken} from '@/utils/tokenStorage';

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * base64url을 직접 푼다. `atob`는 런타임(Hermes 버전)에 따라 없을 수 있는데,
 * 없으면 주인을 못 정해 업로드가 통째로 막힌다 — 그 위험을 지운다.
 * payload는 ASCII(JSON)라 바이트를 그대로 문자로 읽으면 된다.
 */
function decodeBase64Url(input: string): string {
  const clean = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  let bits = 0;
  let acc = 0;
  let out = '';

  for (const char of clean) {
    const value = BASE64_ALPHABET.indexOf(char);
    if (value === -1) throw new Error('invalid base64');

    acc = (acc << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((acc >> bits) & 0xff);
    }
  }

  return out;
}

function decodeSub(token: string): string | null {
  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    const {sub} = JSON.parse(decodeBase64Url(payload));
    return typeof sub === 'string' && sub ? sub : null;
  } catch {
    return null;
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  const token = await getAccessToken();
  return token ? decodeSub(token) : null;
}
