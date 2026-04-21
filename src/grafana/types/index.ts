export * from './dashboards.types.js';
export * from './metrics.types.js';
export * from './logs.types.js';
export * from './datasources.types.js';

export interface Config {
  grafana: GrafanaConfig;
}

export interface LogConfig {
  enableFileLogs: boolean;
  logLevel: string;
  logDir?: string;
}

export interface GrafanaConfig {
  baseUrl: string;
  apiKey: string;
  orgId?: number;
  logs?: LogConfig;
}
