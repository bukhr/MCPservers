// Tipos para Jenkins MCP

export interface Config {
  jenkins: JenkinsConfig;
}

export interface LogConfig {
  enableFileLogs: boolean;
  logLevel: string;
  logDir?: string;
}

export interface JenkinsConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
  logs?: LogConfig;
}

export interface JenkinsBuild {
  number: number;
  result?: string;
  building?: boolean;
  timestamp?: number;
  duration?: number;
  url?: string;
}
