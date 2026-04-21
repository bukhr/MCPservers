import { createLogger } from '../utils/logger.js';
import { RateLimiterOptions, RateLimiterBucket } from '../types/rate-limiter.js';

const limiterLogger = createLogger('rate_limiter');

/**
 * Servicio de limitación de tasas para las consultas a Grafana
 * Permite limitar las solicitudes por categoría de herramienta
 */
export class RateLimiter {
  private limits: Map<string, RateLimiterBucket> = new Map();
  private options: RateLimiterOptions;

  constructor(options: RateLimiterOptions = { maxRequestsPerMinute: 5, maxRequestsPerHour: 200 }) {
    this.options = options;
  }

  /**
   * Verifica si una nueva solicitud está permitida según los límites configurados
   * @param category Categoría de la solicitud (dashboards, metrics, logs, datasources)
   * @returns true si la solicitud está permitida, false si excede los límites
   */
  public allowRequest(category: string): boolean {
    const now = Date.now();
    
    if (!this.limits.has(category)) {
      this.initializeCategory(category, now);
      return true;
    }

    const bucket = this.limits.get(category)!;
    
    if (now > bucket.minuteRequests.resetTime) {
      bucket.minuteRequests = {
        count: 0,
        resetTime: now + 60 * 1000
      };
    }
    
    if (now > bucket.hourRequests.resetTime) {
      bucket.hourRequests = {
        count: 0,
        resetTime: now + 60 * 60 * 1000
      };
    }
    
    if (
      bucket.minuteRequests.count >= this.options.maxRequestsPerMinute ||
      bucket.hourRequests.count >= this.options.maxRequestsPerHour
    ) {
      limiterLogger.warn(`Rate limit excedido para ${category}`, {
        minuteCount: bucket.minuteRequests.count,
        hourCount: bucket.hourRequests.count,
        minuteLimit: this.options.maxRequestsPerMinute,
        hourLimit: this.options.maxRequestsPerHour
      });
      return false;
    }
    
    bucket.minuteRequests.count++;
    bucket.hourRequests.count++;
    this.limits.set(category, bucket);
    
    return true;
  }

  /**
   * Inicializa una nueva categoría de limitación
   */
  private initializeCategory(category: string, now: number): void {
    const bucket: RateLimiterBucket = {
      minuteRequests: {
        count: 1,
        resetTime: now + 60 * 1000
      },
      hourRequests: {
        count: 1,
        resetTime: now + 60 * 60 * 1000
      }
    };
    
    this.limits.set(category, bucket);
  }

  /**
   * Obtiene las estadísticas actuales de uso para una categoría
   */
  public getStats(category: string): { minuteCount: number; hourCount: number } | null {
    if (!this.limits.has(category)) {
      return null;
    }
    
    const bucket = this.limits.get(category)!;
    return {
      minuteCount: bucket.minuteRequests.count,
      hourCount: bucket.hourRequests.count
    };
  }
}

export const rateLimiter = new RateLimiter();
