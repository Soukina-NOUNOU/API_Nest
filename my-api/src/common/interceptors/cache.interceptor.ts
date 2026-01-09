import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CacheService } from '../../cache/cache.service';

export const CACHE_KEY_METADATA = 'cache_key';
export const CACHE_TTL_METADATA = 'cache_ttl';
export const CACHE_DISABLED_METADATA = 'cache_disabled';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    // Check if caching is disabled for this handler
    const isCacheDisabled = this.reflector.get<boolean>(
      CACHE_DISABLED_METADATA,
      context.getHandler(),
    );

    if (isCacheDisabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    
    // Only cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    const cacheKey = this.generateCacheKey(context, request);
    const ttl = this.reflector.get<number>(CACHE_TTL_METADATA, context.getHandler()) || 300;

    // Try to get from cache
    const cachedValue = await this.cacheService.get(cacheKey);
    if (cachedValue !== null) {
      return of(cachedValue);
    }

    // Execute the handler and cache the result
    return next.handle().pipe(
      tap(async (data) => {
        if (data !== undefined && data !== null) {
          await this.cacheService.set(cacheKey, data, ttl);
        }
      }),
    );
  }

  private generateCacheKey(context: ExecutionContext, request: Request): string {
    // Get custom cache key from metadata
    const customKey = this.reflector.get<string>(
      CACHE_KEY_METADATA,
      context.getHandler(),
    );

    if (customKey) {
      return this.interpolateKey(customKey, request);
    }

    // Generate default cache key
    const className = context.getClass().name;
    const methodName = context.getHandler().name;
    const url = request.url;
    const userId = (request as any).user?.id || 'anonymous';

    return `${className}:${methodName}:${url}:${userId}`;
  }

  private interpolateKey(template: string, request: Request): string {
    return template
      .replace(':url', request.url)
      .replace(':path', request.path)
      .replace(':method', request.method.toLowerCase())
      .replace(':userId', (request as any).user?.id || 'anonymous')
      .replace(':params', JSON.stringify(request.params))
      .replace(':query', JSON.stringify(request.query));
  }
}