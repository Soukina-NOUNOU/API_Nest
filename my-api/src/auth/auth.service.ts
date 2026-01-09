import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(email: string, password: string, name?: string) {
    const existingUser = await this.usersService.findByEmail(email); 
    if (existingUser) { throw new ConflictException('Un utilisateur avec cet email existe déjà'); }
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
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.password);
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
    return this.usersService.findOne(payload.sub);
  }
}
