import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async signup(email: string, password: string, name?: string) {
    // délègue au service Users (qui hash déjà)
    return this.usersService.create({ email, password, name });
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const { id, email: em, name, createdAt, updatedAt } = user;
    return { authenticated: true, user: { id, email: em, name, createdAt, updatedAt } };
  }
}
