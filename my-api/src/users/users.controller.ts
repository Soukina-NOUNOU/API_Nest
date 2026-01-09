import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserDto } from 'src/users/dto/user.dto';
import {
  CacheInterceptor,
  CacheInvalidateInterceptor,
  CacheUserProfile,
  CacheUserList,
  InvalidateUserCache,
  Cache,
  CacheKey,
} from '../common';

@Controller('users')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CacheInterceptor, CacheInvalidateInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @InvalidateUserCache()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @CacheUserList()
  findAll() {
    return this.usersService.findAll();
  }

  @Get('me')
  @CacheUserProfile()
  getMyProfile(@CurrentUser() user: UserDto) {
    return user;
  }

  @Get(':id')
  @Cache.Medium()
  @CacheKey('user:detail::id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @InvalidateUserCache()
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto, @CurrentUser() user: UserDto) {
    if (user.id !== id) {
      throw new Error('You can only update your own profile');
    }
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @InvalidateUserCache()
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: UserDto) {
    if (user.id !== id) {
      throw new Error('You can only delete your own profile');
    }
    return this.usersService.remove(id);
  }
}
