import { Injectable, Logger } from '@nestjs/common';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  key?: string;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly cache = new Map<string, { value: any; expires: number }>();
  private readonly defaultTtl = 300; // 5 minutes default

  constructor() {
    // Clean expired cache entries every minute
    setInterval(() => this.cleanExpiredEntries(), 60000);
  }

  async get<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expires) {
      this.cache.delete(key);
      this.logger.debug(`Cache expired for key: ${key}`);
      return null;
    }

    this.logger.debug(`Cache hit for key: ${key}`);
    return cached.value as T;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const expirationTime = Date.now() + (ttl || this.defaultTtl) * 1000;
    
    this.cache.set(key, {
      value,
      expires: expirationTime,
    });

    this.logger.debug(`Cache set for key: ${key}, TTL: ${ttl || this.defaultTtl}s`);
  }

  async del(key: string): Promise<void> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.logger.debug(`Cache deleted for key: ${key}`);
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.logger.debug('Cache cleared');
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());
    
    if (!pattern) {
      return allKeys;
    }

    // Simple pattern matching with * wildcard
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return allKeys.filter(key => regex.test(key));
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  private cleanExpiredEntries(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expires) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.logger.debug(`Cleaned ${expiredCount} expired cache entries`);
    }
  }
}