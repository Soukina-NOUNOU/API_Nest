import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '../common/exceptions';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class UsersService {
  private readonly SALT_ROUNDS = 10;

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  async create(dto: CreateUserDto) {
    if (!dto.email || !dto.password) {
      throw new BadRequestException('Email and password are required');
    }

    try {
      const hashed = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
      const user = await this.prisma.user.create({
        data: { email: dto.email, name: dto.name, password: hashed },
        select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
      });
      return user;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
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

  async findByClerkId(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, email: true, name: true, clerkId: true, createdAt: true, updatedAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: number, dto: UpdateUserDto) {
    if (!id || id <= 0) {
      throw new BadRequestException('Invalid user ID');
    }

    const data = { ...dto };
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
    }

    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      if (error.code === 'P2002') {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  async remove(id: number) {
    if (!id || id <= 0) {
      throw new BadRequestException('Invalid user ID');
    }

    try {
      await this.prisma.user.delete({ where: { id } });
      return { deleted: true };
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<any> {
    const cacheKey = `user:email:${email}`;
    
    // Try to get from cache first
    const cachedUser = await this.cacheService.get<any>(cacheKey);
    if (cachedUser) {
      return cachedUser;
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    
    // Cache the result if user exists
    if (user) {
      await this.cacheService.set(cacheKey, user, 300); // Cache for 5 minutes
    }
    
    return user;
  }
}
