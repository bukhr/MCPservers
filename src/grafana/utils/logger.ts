import fs from 'fs';
import path from 'path';
import winston from 'winston';
import { loadLogConfig, getLogDir } from '../config/settings.js';

const winstonFormat = winston.format;
const winstonTransports = winston.transports;
const { combine, timestamp, printf, colorize } = winstonFormat;

const logFormat = printf(({ level, message, timestamp, service, toolName, ...metadata }) => {
  const metaStr = Object.keys(metadata).length ? `\n${JSON.stringify(metadata, null, 2)}` : '';
  const toolInfo = toolName ? `[${toolName}] ` : '';
  return `${timestamp} [${service}] ${level}: ${toolInfo}${message}${metaStr}`;
});

/**
 * Configura un logger con transports basados en la configuración
 * @param service Nombre del servicio para identificar en los logs
 * @param toolName Nombre opcional de la herramienta específica
 */
export const createLogger = (service: string, toolName?: string) => {
  const logConfig = loadLogConfig();
  const logLevel = logConfig.logLevel || 'info';
  const logDir = logConfig.logDir || getLogDir();
  
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const logTransports: winston.transport[] = [
    new winstonTransports.Console({
      format: combine(
        colorize(),
        timestamp(),
        logFormat
      )
    })
  ];
  
  if (logConfig.enableFileLogs) {
    logTransports.push(new winstonTransports.File({
      filename: path.join(logDir, 'combined.log'),
      format: combine(timestamp(), logFormat)
    }));
    
    logTransports.push(new winstonTransports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: combine(timestamp(), logFormat)
    }));
    
    if (toolName) {
      logTransports.push(new winstonTransports.File({
        filename: path.join(logDir, `${toolName}.log`),
        format: combine(timestamp(), logFormat)
      }));
    }
  }
  
  return winston.createLogger({
    level: logLevel,
    defaultMeta: { service, ...(toolName ? { toolName } : {}) },
    transports: logTransports
  });
};

export const appLogger = createLogger('grafana_mcp' as unknown as string);
