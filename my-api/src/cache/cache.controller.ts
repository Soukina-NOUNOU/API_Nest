import {
  Controller,
  Delete,
  Get,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CacheService } from './cache.service';
import { NoCache } from '../common/decorators/cache.decorators';

@Controller('cache')
@UseGuards(JwtAuthGuard)
export class CacheController {
  constructor(private readonly cacheService: CacheService) {}

  @Get('stats')
  @NoCache()
  getStats() {
    return this.cacheService.getStats();
  }

  @Get('keys')
  @NoCache()
  async getKeys(@Query('pattern') pattern?: string) {
    const keys = await this.cacheService.keys(pattern);
    return { keys, count: keys.length };
  }

  @Get(':key')
  @NoCache()
  async getCacheValue(@Param('key') key: string) {
    const value = await this.cacheService.get(key);
    return { key, value, exists: value !== null };
  }

  @Delete('clear')
  @NoCache()
  async clearCache() {
    await this.cacheService.clear();
    return { message: 'Cache cleared successfully' };
  }

  @Delete(':key')
  @NoCache()
  async deleteKey(@Param('key') key: string) {
    await this.cacheService.del(key);
    return { message: `Key "${key}" deleted successfully` };
  }

  @Delete('pattern/:pattern')
  @NoCache()
  async deleteByPattern(@Param('pattern') pattern: string) {
    const keys = await this.cacheService.keys(pattern);
    let deletedCount = 0;

    for (const key of keys) {
      await this.cacheService.del(key);
      deletedCount++;
    }

    return { 
      message: `Deleted ${deletedCount} keys matching pattern "${pattern}"`,
      deletedCount,
      keys 
    };
  }
}