export interface RateLimiterOptions {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
}

export interface RateLimiterBucket {
  minuteRequests: {
    count: number;
    resetTime: number;
  };
  hourRequests: {
    count: number;
    resetTime: number;
  };
}