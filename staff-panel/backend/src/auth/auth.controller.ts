import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RateLimit } from '../common/rate-limit.decorator';
import { Public } from '../rbac/public.decorator';
import type { StaffRequest } from '../rbac/staff-request';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @RateLimit({
    limit: 10,
    windowMs: 60_000,
    key: 'ip+username',
    message: 'Te veel pogingen. Probeer later opnieuw.',
  })
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip =
      req.ip ||
      req.socket.remoteAddress ||
      'unknown';
    const rateKey = `login:${ip}:${(body.username || '').trim().toLowerCase()}`;

    const { sessionId, session } = await this.auth.login(
      body.username,
      body.password,
      rateKey,
    );

    res.cookie(this.auth.cookieName(), sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.auth.cookieSecure(),
      maxAge: this.auth.cookieMaxAgeMs(),
      path: '/',
    });

    return {
      ok: true,
      user: {
        id: session.userId,
        username: session.username,
        permissions: session.permissions,
        roleIds: session.roleIds,
      },
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionId = req.cookies?.[this.auth.cookieName()] as
      | string
      | undefined;
    this.auth.logout(sessionId);
    res.clearCookie(this.auth.cookieName(), { path: '/' });
    return { ok: true };
  }

  @Get('me')
  me(@Req() req: StaffRequest) {
    const session = req.staffSession;
    if (!session) {
      throw new UnauthorizedException('Niet ingelogd');
    }
    const fresh =
      this.auth.refreshSessionPermissions(req.staffSessionId) ?? session;
    return {
      id: fresh.userId,
      username: fresh.username,
      permissions: fresh.permissions,
      roleIds: fresh.roleIds,
    };
  }
}
