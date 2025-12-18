import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly SALT_ROUNDS = 10;

  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const hashed = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, password: hashed },
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    });
    return user;
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: number, dto: UpdateUserDto) {
    // Re-hash si le mot de passe est fourni
    const data: any = { ...dto };
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
    }

    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
      });
    } catch {
      throw new NotFoundException('User not found');
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.user.delete({ where: { id } });
      return { deleted: true };
    } catch {
      throw new NotFoundException('User not found');
    }
  }

  // Utilisé par l'auth
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
