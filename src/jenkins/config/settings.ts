import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { LogConfig, JenkinsConfig, Config } from '../types/index.js';

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = dirname(currentFilename);

const MCP_CONFIG_PATH = path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');
const GEMINI_CONFIG_PATH = path.join(os.homedir(), '.gemini', 'settings.json');

const DEFAULT_LOG_DIR = path.join(currentDirname, '../logs');

export const DEFAULT_LOG_CONFIG: LogConfig = {
  enableFileLogs: true,
  logLevel: 'info'
};

/**
 * Lee la configuración de Jenkins desde el archivo de configuración
 * @param path Ruta del archivo de configuración
 * @returns Configuración de Jenkins o null si no se encuentra el archivo
 */
const readConfigIfAvailable = (path: string): Config | null => {
  if (fs.existsSync(path)) {
    const raw = fs.readFileSync(path, 'utf-8');
    const json = JSON.parse(raw);
    return json.jenkins ? json : null;
  }
  return null;
}

/**
 * Lee la configuración de MCP desde el archivo de configuración
 * Intenta leer primero de MCP_CONFIG_PATH y si no existe, de GEMINI_CONFIG_PATH
 * @returns Configuración de MCP o null si no se encuentra el archivo
 */
const readMcpConfig = (): Config | null => {
  try {
    let config: Config | null = null;

    config = readConfigIfAvailable(MCP_CONFIG_PATH);
    
    if (config === null) {
      config = readConfigIfAvailable(GEMINI_CONFIG_PATH);
    }

    return config;
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
    const config = readMcpConfig();

    if (!config) {
      return DEFAULT_LOG_CONFIG;
    }
    
    // Solo buscar la configuración de logs dentro de jenkins
    const logConfig: LogConfig | any = config.jenkins?.logs || {};
    
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
 * Carga la configuración de Jenkins
 * @returns Configuración de Jenkins
 */
export const loadJenkinsConfig = (): JenkinsConfig => {
  const config = readMcpConfig();
  const jenkinsConfig: JenkinsConfig | any = config?.jenkins || {};

  const fileBaseUrl = resolveEnvRef(jenkinsConfig.baseUrl);
  const auth = jenkinsConfig.auth || {};

  const baseUrl = (process.env.JENKINS_BASE_URL || fileBaseUrl || '').toString();
  const username = (process.env.JENKINS_USERNAME || resolveEnvRef(auth.username) || '').toString();
  const apiToken = (process.env.JENKINS_API_TOKEN || resolveEnvRef(auth.apiToken) || '').toString();

  if (!baseUrl) throw new Error('Missing JENKINS_BASE_URL (or jenkins.baseUrl in mcp_config.json)');
  if (!username) throw new Error('Missing JENKINS_USERNAME (or jenkins.auth.username in mcp_config.json)');
  if (!apiToken) throw new Error('Missing JENKINS_API_TOKEN (or jenkins.auth.apiToken in mcp_config.json)');

  return { baseUrl: baseUrl.replace(/\/$/, ''), username, apiToken };
}
