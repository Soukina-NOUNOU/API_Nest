import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: number | string; // Support both local and Clerk IDs
  email: string;
  clerkId?: string; // For Clerk users
  clerk_user?: boolean; // Flag to identify Clerk users
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'fallback-secret',
    });
  }

  async validate(payload: JwtPayload) {
    let user;
    
    // Check if this is a Clerk user token
    if (payload.clerk_user && payload.clerkId) {
      user = await this.usersService.findByClerkId(payload.clerkId);
    } else {
      // Traditional local user - ensure sub is a number
      const userId = typeof payload.sub === 'number' ? payload.sub : parseInt(payload.sub.toString(), 10);
      user = await this.usersService.findOne(userId);
    }
    
    if (!user) {
      throw new UnauthorizedException();
    }
    
    // The user is already without a password from findOne/findByClerkId
    return user;
  }
}