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
import { AuthService } from './auth.service';

class LoginDto {
  username!: string;
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { sessionId, session } = await this.auth.login(
      body.username ?? '',
      body.password ?? '',
    );

    res.cookie(this.auth.cookieName(), sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // set true behind HTTPS in production
      maxAge: this.auth.cookieMaxAgeMs(),
      path: '/',
    });

    return {
      ok: true,
      user: {
        id: session.userId,
        username: session.username,
        permissions: session.permissions,
      },
    };
  }

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
  me(@Req() req: Request) {
    const sessionId = req.cookies?.[this.auth.cookieName()] as
      | string
      | undefined;
    const session = this.auth.getSession(sessionId);
    if (!session) {
      throw new UnauthorizedException('Niet ingelogd');
    }
    return {
      id: session.userId,
      username: session.username,
      permissions: session.permissions,
    };
  }
}
