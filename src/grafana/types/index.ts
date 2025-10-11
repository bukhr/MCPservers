export * from './dashboards.types.js';
export * from './metrics.types.js';
export * from './logs.types.js';
export * from './datasources.types.js';

export interface LogConfig {
  enableFileLogs: boolean;
  logLevel: string;
  logDir?: string;
}

export interface GrafanaConfig {
  baseUrl: string;
  apiKey: string;
  orgId?: number;
}
