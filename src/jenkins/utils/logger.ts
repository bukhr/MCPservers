import winston from 'winston';
import fs from 'fs';
import { loadLogConfig, getLogDir } from '../config/settings.js';
import { LogConfig } from '../types/index.js';

const logConfig: LogConfig = loadLogConfig();

const logDir = logConfig.logDir || getLogDir();

if (logConfig.enableFileLogs) {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

const commonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

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
    new winston.transports.Console({
      format: consoleFormat
    })
  ];

  if (logConfig.enableFileLogs) {
    if (filename) {
      transports.push(
        new winston.transports.File({ 
          filename: `${logDir}/${filename}.log`
        })
      );
    }

    transports.push(
      new winston.transports.File({ 
        filename: `${logDir}/combined.log`
      })
    );

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

export const appLogger = createLogger('jenkins_mcp');
