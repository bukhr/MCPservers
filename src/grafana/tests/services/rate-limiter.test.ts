import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { RateLimiter } from '../../services/rate-limiter.js';

const mockErrorLogger = jest.fn();
jest.unstable_mockModule('../../utils/logger.js', () => ({
  createLogger: () => ({
    error: mockErrorLogger,
    info: jest.fn(),
    warn: jest.fn(),
  })
}));

let rateLimiterModule: typeof import('../../services/rate-limiter.js');

beforeAll(async () => {
    rateLimiterModule = await import('../../services/rate-limiter.js');
});

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  const testCategory = 'test_category';
  
  beforeEach(() => {
    rateLimiter = new rateLimiterModule.RateLimiter({ maxRequestsPerMinute: 3, maxRequestsPerHour: 5 });
    jest.restoreAllMocks();
  });
  
  it('should allow requests within the minute limit', () => {
    expect(rateLimiter.allowRequest(testCategory)).toBe(true);
    expect(rateLimiter.allowRequest(testCategory)).toBe(true);
    expect(rateLimiter.allowRequest(testCategory)).toBe(true);
    expect(rateLimiter.allowRequest(testCategory)).toBe(false);
  });
  
  it('should allow requests again after resetting the minute counter', () => {
    const initialTime = 1633000000000;
    const mockNow = jest.spyOn(global.Date, 'now')
                     .mockImplementation(() => initialTime);
    
    const testRateLimiter = new rateLimiterModule.RateLimiter({ maxRequestsPerMinute: 3, maxRequestsPerHour: 5 });
    
    expect(testRateLimiter.allowRequest(testCategory)).toBe(true);
    expect(testRateLimiter.allowRequest(testCategory)).toBe(true);
    expect(testRateLimiter.allowRequest(testCategory)).toBe(true);
    expect(testRateLimiter.allowRequest(testCategory)).toBe(false);
    
    mockNow.mockImplementation(() => initialTime + 61 * 1000);
    
    expect(testRateLimiter.allowRequest(testCategory)).toBe(true);
  });
  
  it('should respect the hourly limit', () => {
    const initialTime = 1633000000000;
    const mockNow = jest.spyOn(global.Date, 'now')
                     .mockImplementation(() => initialTime);
    
    const testRateLimiter = new rateLimiterModule.RateLimiter({ maxRequestsPerMinute: 3, maxRequestsPerHour: 5 });
    
    expect(testRateLimiter.allowRequest(testCategory)).toBe(true);
    expect(testRateLimiter.allowRequest(testCategory)).toBe(true);
    expect(testRateLimiter.allowRequest(testCategory)).toBe(true);
    
    mockNow.mockImplementation(() => initialTime + 61 * 1000);
    
    expect(testRateLimiter.allowRequest(testCategory)).toBe(true);
    expect(testRateLimiter.allowRequest(testCategory)).toBe(true);
    
    expect(testRateLimiter.allowRequest(testCategory)).toBe(false);
    
    mockNow.mockImplementation(() => initialTime + 3601 * 1000);
    
    expect(testRateLimiter.allowRequest(testCategory)).toBe(true);
  });
  
  it('should handle separate categories', () => {
    const category1 = 'category1';
    const category2 = 'category2';
    
    expect(rateLimiter.allowRequest(category1)).toBe(true);
    expect(rateLimiter.allowRequest(category1)).toBe(true);
    expect(rateLimiter.allowRequest(category1)).toBe(true);
    expect(rateLimiter.allowRequest(category1)).toBe(false);
    
    expect(rateLimiter.allowRequest(category2)).toBe(true);
    expect(rateLimiter.allowRequest(category2)).toBe(true);
    expect(rateLimiter.allowRequest(category2)).toBe(true);
  });
  
  it('should provide correct statistics', () => {
    expect(rateLimiter.getStats(testCategory)).toBeNull();
    
    rateLimiter.allowRequest(testCategory);
    rateLimiter.allowRequest(testCategory);
    
    const stats = rateLimiter.getStats(testCategory);
    expect(stats).not.toBeNull();
    expect(stats?.minuteCount).toBe(2);
    expect(stats?.hourCount).toBe(2);
  });
});
