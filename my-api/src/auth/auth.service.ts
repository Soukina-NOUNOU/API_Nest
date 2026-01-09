import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from './strategies/jwt.strategy';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '../common/exceptions';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(email: string, password: string, name?: string) {
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const existingUser = await this.usersService.findByEmail(email); 
    if (existingUser) { 
      throw new ConflictException('Un utilisateur avec cet email existe déjà'); 
    }
    
    const createdUser = await this.usersService.create({ email, password, name });
    
    // Generate a JWT token for the new user
    const payload: JwtPayload = { sub: createdUser.id, email: createdUser.email };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: createdUser,
    };
  }

  async login(email: string, password: string) {
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.password as string);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    // Generate a JWT token
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const access_token = this.jwtService.sign(payload);

    const { password: _, ...userWithoutPassword } = user;
    return {
      access_token,
      user: userWithoutPassword,
    };
  }

  async validateUser(payload: JwtPayload) {
    // Handle both Clerk and local users
    if (payload.clerk_user && payload.clerkId) {
      return this.usersService.findByClerkId(payload.clerkId);
    } else {
      const userId = typeof payload.sub === 'number' ? payload.sub : parseInt(payload.sub.toString(), 10);
      return this.usersService.findOne(userId);
    }
  }

    // Generate a JWT token
  generateToken(payload: any) {
    return this.jwtService.sign(payload);
  }
}
