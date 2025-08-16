import winston from 'winston';
import fs from 'fs';
import { loadLogConfig, LogConfig, getLogDir } from './config.js';

// Cargar la configuración de logs desde el archivo MCP
const logConfig: LogConfig = loadLogConfig();

// Determinar el directorio de logs (usar el por defecto si no se especificó uno)
const logDir = logConfig.logDir || getLogDir();

// Asegurar que el directorio de logs existe si están habilitados
if (logConfig.enableFileLogs) {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

// Formato común para todos los loggers
const commonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Formato para consola
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.simple()
);

/**
 * Crea un logger con la configuración estandarizada
 * @param service Nombre del servicio/módulo que genera los logs
 * @param filename Nombre del archivo de log específico (sin extensión)
 * @returns Instancia de winston logger
 */
export function createLogger(service: string, filename?: string): winston.Logger {
  const transports: winston.transport[] = [
    // Transporte para consola (siempre activo)
    new winston.transports.Console({
      format: consoleFormat
    })
  ];

  // Solo agregar transportes de archivo si están habilitados en la configuración
  if (logConfig.enableFileLogs) {
    // Si se especifica un nombre de archivo, agregar transporte de archivo
    if (filename) {
      transports.push(
        new winston.transports.File({ 
          filename: `${logDir}/${filename}.log`
        })
      );
    }

    // Siempre agregar logs al archivo combinado
    transports.push(
      new winston.transports.File({ 
        filename: `${logDir}/combined.log`
      })
    );

    // Agregar logs de error al archivo de errores
    transports.push(
      new winston.transports.File({ 
        filename: `${logDir}/error.log`,
        level: 'error'
      })
    );
  }

  return winston.createLogger({
    level: logConfig.logLevel || 'info',
    format: commonFormat,
    defaultMeta: { service },
    transports
  });
}

// Logger principal de la aplicación
export const appLogger = createLogger('review_assign_mcp');
