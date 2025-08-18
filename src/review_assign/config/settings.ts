import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Config, LogConfig } from '../types/index.js';

// En ESM, evitar usar los identificadores especiales __filename/__dirname para no colisionar con CJS
const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = dirname(currentFilename);

export const MCP_CONFIG_PATH = path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');

const DEFAULT_LOG_DIR = path.join(currentDirname, '../logs');

export const DEFAULT_LOG_CONFIG: LogConfig = {
  enableFileLogs: true,
  logLevel: 'info'
};

export const loadConfiguration = (): Config => {
    try {
      if (!fs.existsSync(MCP_CONFIG_PATH)) {
        throw new Error(`Archivo de configuración no encontrado: ${MCP_CONFIG_PATH}`);
      }

      const configData = JSON.parse(fs.readFileSync(MCP_CONFIG_PATH, 'utf8'));
      const config = configData.reviewAssign || { teams: [], reviewDays: 15 };
      
      return config;
    } catch (error) {
      console.error(`Error al cargar la configuración: ${error}`);
      throw error;
    }
}

export const getLogDir = (): string => {
  return DEFAULT_LOG_DIR;
}

export const loadLogConfig = (): LogConfig => {
  try {
    if (!fs.existsSync(MCP_CONFIG_PATH)) {
      return DEFAULT_LOG_CONFIG;
    }
    
    const config = JSON.parse(fs.readFileSync(MCP_CONFIG_PATH, 'utf-8'));
    
    const reviewConfig = config.reviewAssign || {};
    
    const logConfig = reviewConfig.logs || {};
    
    return {
      enableFileLogs: logConfig.enableFileLogs !== undefined ? 
                     logConfig.enableFileLogs : DEFAULT_LOG_CONFIG.enableFileLogs,
      logLevel: logConfig.logLevel || DEFAULT_LOG_CONFIG.logLevel,
      ...(logConfig.logDir ? { logDir: logConfig.logDir } : {})
    };
  } catch (error) {
    console.error(`Error al cargar la configuración de logs: ${error}`);
    return DEFAULT_LOG_CONFIG;
  }
}
