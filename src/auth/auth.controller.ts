import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Controller('api')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(
    @Body('username') username: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!this.auth.isValid(username)) {
      throw new HttpException(
        '水晶球沒有映照出這個名字',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const name = username.trim();
    this.auth.setSessionCookie(res, name);
    return { ok: true, username: name };
  }

  /** LINE LIFF 登入:已通過 LINE 驗證的使用者直接建立 session */
  @Post('login/line')
  @HttpCode(200)
  lineLogin(
    @Body('displayName') displayName: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const name = (displayName || 'LINE 使用者').trim();
    this.auth.setSessionCookie(res, name, { line: true });
    return { ok: true, username: name };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    this.auth.clearSessionCookie(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: Request) {
    const session = this.auth.getSessionFromRequest(req)!;
    return { ok: true, username: session.username, line: !!session.line };
  }
}
