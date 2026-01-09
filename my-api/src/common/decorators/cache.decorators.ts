import { SetMetadata } from '@nestjs/common';
import {
  CACHE_KEY_METADATA,
  CACHE_TTL_METADATA,
  CACHE_DISABLED_METADATA,
} from '../interceptors/cache.interceptor';
import { CACHE_INVALIDATE_METADATA } from '../interceptors/cache-invalidate.interceptor';

/**
 * Decorator to set a custom cache key for a method
 * @param key - The cache key template. Can use placeholders like :userId, :url, :params
 * 
 * @example
 * @CacheKey('user:profile::userId')
 * @CacheKey('posts:list::query')
 */
export const CacheKey = (key: string) => SetMetadata(CACHE_KEY_METADATA, key);

/**
 * Decorator to set cache TTL (time to live) in seconds
 * @param seconds - Cache duration in seconds
 * 
 * @example
 * @CacheTTL(600) // Cache for 10 minutes
 * @CacheTTL(3600) // Cache for 1 hour
 */
export const CacheTTL = (seconds: number) => SetMetadata(CACHE_TTL_METADATA, seconds);

/**
 * Decorator to disable caching for a specific method
 * 
 * @example
 * @NoCache()
 * async getSensitiveData() { ... }
 */
export const NoCache = () => SetMetadata(CACHE_DISABLED_METADATA, true);

/**
 * Decorator to specify cache invalidation patterns
 * @param patterns - Array of cache key patterns to invalidate
 * 
 * @example
 * @CacheInvalidate(['user:*', 'posts:*'])
 * @CacheInvalidate(['user::userId:*'])
 */
export const CacheInvalidate = (patterns: string[]) =>
  SetMetadata(CACHE_INVALIDATE_METADATA, patterns);

/**
 * Decorator to cache method result with default 5 minute TTL
 * 
 * @example
 * @Cacheable()
 * async getData() { ... }
 */
export const Cacheable = (ttl: number = 300) => (
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor,
) => {
  SetMetadata(CACHE_TTL_METADATA, ttl)(target, propertyKey, descriptor);
};

/**
 * Combined decorator for common caching scenarios
 */
export const Cache = {
  /**
   * Cache for 5 minutes (default)
   */
  Short: () => CacheTTL(300),
  
  /**
   * Cache for 1 hour
   */
  Medium: () => CacheTTL(3600),
  
  /**
   * Cache for 24 hours
   */
  Long: () => CacheTTL(86400),
  
  /**
   * Cache forever (very long TTL)
   */
  Forever: () => CacheTTL(999999999),
  
  /**
   * User-specific cache key
   */
  User: (suffix: string = '') => 
    CacheKey(`user::userId:${suffix ? suffix + ':' : ''}:url`),
  
  /**
   * Global cache key
   */
  Global: (key: string) => CacheKey(`global:${key}`),
};

/**
 * Decorator for user profile caching
 */
export const CacheUserProfile = () => (
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor,
) => {
  CacheKey('user:profile::userId')(target, propertyKey, descriptor);
  CacheTTL(1800)(target, propertyKey, descriptor); // 30 minutes
};

/**
 * Decorator for user list caching
 */
export const CacheUserList = () => (
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor,
) => {
  CacheKey('users:list::query')(target, propertyKey, descriptor);
  CacheTTL(600)(target, propertyKey, descriptor); // 10 minutes
};

/**
 * Decorator to invalidate user-related cache
 */
export const InvalidateUserCache = () =>
  CacheInvalidate(['user::userId:*', 'users:*']);

/**
 * Decorator to invalidate all cache
 */
export const InvalidateAllCache = () =>
  CacheInvalidate(['*']);