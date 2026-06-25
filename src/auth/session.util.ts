import { createHmac, timingSafeEqual } from 'crypto';

export const SESSION_COOKIE = 'auth_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

export interface SessionPayload {
  username: string;
  exp: number;
  line?: boolean;
}

function secret(): string {
  return process.env.SESSION_SECRET ?? 'advertise-agent-dev-secret';
}

function b64url(data: string | Buffer): string {
  return Buffer.from(data)
    .toString('base64url')
    .replace(/=/g, '');
}

function fromB64url(data: string): Buffer {
  const pad = data.length % 4 === 0 ? '' : '='.repeat(4 - (data.length % 4));
  return Buffer.from(data + pad, 'base64url');
}

export function createSessionToken(
  username: string,
  opts?: { line?: boolean },
): string {
  const payload: SessionPayload = {
    username,
    exp: Date.now() + SESSION_TTL_MS,
    ...(opts?.line ? { line: true } : {}),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac('sha256', secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = b64url(createHmac('sha256', secret()).update(body).digest());
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as SessionPayload;
    if (!payload.username || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

export function sessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  maxAge: number;
  path: string;
} {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/',
  };
}

export function buildSetCookieHeader(
  name: string,
  value: string,
  opts: ReturnType<typeof sessionCookieOptions>,
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${opts.path}`,
    `Max-Age=${Math.floor(opts.maxAge / 1000)}`,
    `SameSite=${opts.sameSite}`,
  ];
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  return parts.join('; ');
}

export function buildClearCookieHeader(name: string): string {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=lax`;
}
