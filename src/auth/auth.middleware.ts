import { Injectable } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AuthService } from './auth.service';

/** 本機 Puppeteer 截封面時略過登入檢查 */
function isLocalRequest(req: Request): boolean {
  const ip = req.ip ?? req.socket.remoteAddress ?? '';
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.endsWith('127.0.0.1')
  );
}

function needsAuth(path: string): boolean {
  if (path.startsWith('/storage/covers/')) return false;
  if (path.startsWith('/storage/')) return true;
  if (path === '/' || path === '/index.html') return true;
  return false;
}

@Injectable()
export class AuthMiddleware {
  constructor(private readonly auth: AuthService) {}

  handle(req: Request, res: Response, next: NextFunction): void {
    const path = req.path;
    if (!needsAuth(path)) {
      next();
      return;
    }
    if (isLocalRequest(req)) {
      next();
      return;
    }
    const session = this.auth.getSessionFromRequest(req);
    if (!session) {
      const nextUrl = encodeURIComponent(req.originalUrl || path);
      if (path.endsWith('.html') || req.accepts('html')) {
        res.redirect(`/login.html?next=${nextUrl}`);
        return;
      }
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!this.auth.canAccessStoragePath(session.username, path)) {
      if (path.endsWith('.html') || req.accepts('html')) {
        res.redirect('/');
        return;
      }
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    next();
  }
}

export function createAuthMiddleware(auth: AuthService) {
  const mw = new AuthMiddleware(auth);
  return (req: Request, res: Response, next: NextFunction) => mw.handle(req, res, next);
}
