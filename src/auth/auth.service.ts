import { Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import {
  buildClearCookieHeader,
  buildSetCookieHeader,
  createSessionToken,
  parseCookieHeader,
  SESSION_COOKIE,
  sessionCookieOptions,
  SessionPayload,
  verifySessionToken,
} from './session.util';

/**
 * 允許登入的帳號(寫死在這裡)。
 * 要新增 / 修改 / 刪除帳號,直接改這個陣列即可。
 * 不分大小寫、會自動去除前後空白。
 */
const ACCOUNTS = ['test'];

const HADALABO_ACCOUNT = 'hadalabo';
const HADALABO_PROJECTS = new Set<string>([]);

@Injectable()
export class AuthService {
  isValid(username: string): boolean {
    if (!username) return false;
    const name = username.trim().toLowerCase();
    return ACCOUNTS.some((a) => a.toLowerCase() === name);
  }

  isHadalaboUser(username: string | undefined): boolean {
    return username?.trim().toLowerCase() === HADALABO_ACCOUNT;
  }

  getHadalaboAllowedProjects(): ReadonlySet<string> {
    return HADALABO_PROJECTS;
  }

  /** hadalabo 僅能進白名單專案;其他帳號不受限 */
  canAccessStoragePath(username: string, path: string): boolean {
    if (!this.isHadalaboUser(username)) return true;
    if (!path.startsWith('/storage/')) return true;
    const match = path.match(/^\/storage\/[^/]+\/([^/]+)/);
    if (!match) return false;
    return HADALABO_PROJECTS.has(match[1]);
  }

  getSessionFromRequest(req: Request): SessionPayload | null {
    const cookies = parseCookieHeader(req.headers.cookie);
    return verifySessionToken(cookies[SESSION_COOKIE]);
  }

  setSessionCookie(res: Response, username: string, opts?: { line?: boolean }): void {
    const token = createSessionToken(username.trim(), opts);
    res.setHeader(
      'Set-Cookie',
      buildSetCookieHeader(SESSION_COOKIE, token, sessionCookieOptions()),
    );
  }

  clearSessionCookie(res: Response): void {
    res.setHeader('Set-Cookie', buildClearCookieHeader(SESSION_COOKIE));
  }
}
