import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CacheService } from '../../cache/cache.service';

export const CACHE_INVALIDATE_METADATA = 'cache_invalidate';

@Injectable()
export class CacheInvalidateInterceptor implements NestInterceptor {
  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Get invalidation patterns from metadata
    const invalidatePatterns = this.reflector.get<string[]>(
      CACHE_INVALIDATE_METADATA,
      context.getHandler(),
    );

    return next.handle().pipe(
      tap(async () => {
        if (invalidatePatterns && invalidatePatterns.length > 0) {
          for (const pattern of invalidatePatterns) {
            await this.invalidateCache(pattern, request);
          }
        } else {
          // Default invalidation for non-GET requests
          if (request.method !== 'GET') {
            await this.defaultInvalidation(context, request);
          }
        }
      }),
    );
  }

  private async invalidateCache(pattern: string, request: Request): Promise<void> {
    const interpolatedPattern = this.interpolatePattern(pattern, request);
    const keys = await this.cacheService.keys(interpolatedPattern);
    
    for (const key of keys) {
      await this.cacheService.del(key);
    }
  }

  private async defaultInvalidation(context: ExecutionContext, request: Request): Promise<void> {
    const className = context.getClass().name;
    const userId = (request as any).user?.id;

    // Invalidate cache for the current class
    const classPattern = `${className}:*`;
    const classKeys = await this.cacheService.keys(classPattern);
    
    for (const key of classKeys) {
      await this.cacheService.del(key);
    }

    // Also invalidate user-specific cache if user is available
    if (userId) {
      const userPattern = `*:${userId}`;
      const userKeys = await this.cacheService.keys(userPattern);
      
      for (const key of userKeys) {
        await this.cacheService.del(key);
      }
    }
  }

  private interpolatePattern(template: string, request: Request): string {
    return template
      .replace(':userId', (request as any).user?.id || '*')
      .replace(':params', JSON.stringify(request.params))
      .replace(':id', request.params?.id || '*');
  }
}