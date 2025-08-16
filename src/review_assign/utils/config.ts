import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Obtener la ruta del directorio actual para módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ruta al archivo de configuración MCP
const MCP_CONFIG_PATH = path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');

/**
 * Interfaz para la configuración de logs
 */
export interface LogConfig {
  enableFileLogs: boolean;
  logLevel: string;
  logDir?: string;
}

// Obtener la ruta por defecto para los logs
const DEFAULT_LOG_DIR = path.join(__dirname, '../logs');

/**
 * Configuración por defecto para logs
 */
export const DEFAULT_LOG_CONFIG: LogConfig = {
  enableFileLogs: true,
  logLevel: 'info'
  // logDir se calculará automáticamente si no se especifica
};

/**
 * Obtiene el directorio de logs
 * @returns Ruta al directorio de logs
 */
export function getLogDir(): string {
  return DEFAULT_LOG_DIR;
}

/**
 * Carga la configuración desde el archivo MCP
 * @returns Configuración de logs
 */
export function loadLogConfig(): LogConfig {
  try {
    // Si el archivo no existe, usar configuración por defecto
    if (!fs.existsSync(MCP_CONFIG_PATH)) {
      return DEFAULT_LOG_CONFIG;
    }
    
    // Leer y parsear el archivo
    const config = JSON.parse(fs.readFileSync(MCP_CONFIG_PATH, 'utf-8'));
    
    // Obtener la configuración específica para review_assign
    const reviewConfig = config.reviewAssign || {};
    
    // Obtener la configuración de logs o un objeto vacío si no existe
    const logConfig = reviewConfig.logs || {};
    
    // Combinar con valores por defecto
    return {
      enableFileLogs: logConfig.enableFileLogs !== undefined ? 
                     logConfig.enableFileLogs : DEFAULT_LOG_CONFIG.enableFileLogs,
      logLevel: logConfig.logLevel || DEFAULT_LOG_CONFIG.logLevel,
      // El logDir es opcional, si no se especifica se usará el valor por defecto
      ...(logConfig.logDir ? { logDir: logConfig.logDir } : {})
    };
  } catch (error) {
    // En caso de error, usar configuración por defecto
    console.error(`Error al cargar la configuración de logs: ${error}`);
    return DEFAULT_LOG_CONFIG;
  }
}
