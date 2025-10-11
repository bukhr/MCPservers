import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { LogConfig, GrafanaConfig } from '../types/index.js';

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = dirname(currentFilename);

export const MCP_CONFIG_PATH = path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');

const DEFAULT_LOG_DIR = path.join(currentDirname, '../logs');

export const DEFAULT_LOG_CONFIG: LogConfig = {
  enableFileLogs: true,
  logLevel: 'info'
};

/**
 * Lee la configuración de MCP desde el archivo de configuración
 * @returns Configuración de MCP o null si no se encuentra el archivo
 */
function readMcpConfig(): any | null {
  try {
    if (!fs.existsSync(MCP_CONFIG_PATH)) return null;
    const raw = fs.readFileSync(MCP_CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Resuelve una referencia de entorno
 * @param value Valor a resolver
 * @returns Valor resuelto
 */
function resolveEnvRef(value: any): any {
  if (typeof value === 'string' && value.startsWith('env:')) {
    const envName = value.slice(4);
    return process.env[envName] ?? '';
  }
  return value;
}

/**
 * Obtiene el directorio de logs
 * @returns Directorio de logs
 */
export const getLogDir = (): string => {
  return DEFAULT_LOG_DIR;
}

/**
 * Carga la configuración de logs
 * @returns Configuración de logs
 */
export const loadLogConfig = (): LogConfig => {
  try {
    if (!fs.existsSync(MCP_CONFIG_PATH)) {
      return DEFAULT_LOG_CONFIG;
    }
    
    const config = readMcpConfig();
    const logConfig = (config.grafana?.logs) || config.logs || {};
    
    return {
      enableFileLogs: logConfig.enableFileLogs !== undefined ? 
                     logConfig.enableFileLogs : DEFAULT_LOG_CONFIG.enableFileLogs,
      logLevel: logConfig.logLevel || DEFAULT_LOG_CONFIG.logLevel,
      ...(logConfig.logDir ? { logDir: logConfig.logDir } : {})
    };
  } catch (error) {
    console.error(`Failed to load log configuration: ${error}`);
    return DEFAULT_LOG_CONFIG;
  }
}

/**
 * Carga la configuración de Grafana
 * @returns Configuración de Grafana
 */
export const loadGrafanaConfig = (): GrafanaConfig => {
  const config = readMcpConfig();
  const grafanaConfig = config?.grafana || {};

  const fileBaseUrl = resolveEnvRef(grafanaConfig.baseUrl);
  
  const baseUrl = (process.env.GRAFANA_BASE_URL || fileBaseUrl || '').toString();
  const apiKey = (process.env.GRAFANA_API_KEY || resolveEnvRef(grafanaConfig.apiKey) || '').toString();
  const orgId = process.env.GRAFANA_ORG_ID || grafanaConfig.orgId || '1';

  if (!baseUrl) throw new Error('Missing GRAFANA_BASE_URL (or grafana.baseUrl in mcp_config.json)');
  if (!apiKey) throw new Error('Missing GRAFANA_API_KEY (or grafana.apiKey in mcp_config.json)');

  return { 
    baseUrl: baseUrl.replace(/\/$/, ''), 
    apiKey, 
    ...(orgId ? { orgId: Number(orgId) } : {}) 
  };
}
