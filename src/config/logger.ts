import winston, { format } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { combine, timestamp, json, printf } = format;

interface LogMeta {
  [key: string]: any;
}

const logger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json(),
    printf(({ level, message, timestamp, ...meta }) => {
      return JSON.stringify({
        level,
        message,
        timestamp,
        ...meta
      });
    })
  ),
  transports: [
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'info'
    }),
    new DailyRotateFile({
      filename: 'logs/errors-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error'
    })
  ]
});

// Interface pour le logger typé
interface AppLogger {
  info(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  http(message: string, meta?: LogMeta): void;
}

export default logger as AppLogger;