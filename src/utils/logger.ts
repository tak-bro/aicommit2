import path from 'path';

import winston from 'winston';
import 'winston-daily-rotate-file';

import { AICOMMIT_EXCEPTION_LOG_FILE_PATH, AICOMMIT_MAIN_LOG_FILE_PATH } from './config.js';
import { ensureDirectoryExists } from './utils.js';

let loggerInstance: winston.Logger | undefined = undefined;
let currentLogLevel: string = 'info';

export async function initializeLogger(options?: {
    logLevel?: string;
    logFilePath?: string;
    exceptionLogFilePath?: string;
    logging?: boolean;
}): Promise<void> {
    if (loggerInstance) {
        console.warn('Logger already initialized. Skipping re-initialization.');
        return;
    }

    const logLevel = options?.logLevel || 'info';
    currentLogLevel = logLevel;
    const logFilePath = options?.logFilePath || AICOMMIT_MAIN_LOG_FILE_PATH;
    const exceptionLogFilePath = options?.exceptionLogFilePath || AICOMMIT_EXCEPTION_LOG_FILE_PATH;
    const logging = options?.logging ?? true; // Default to true

    await ensureDirectoryExists(path.dirname(logFilePath));
    await ensureDirectoryExists(path.dirname(exceptionLogFilePath));

    const transports: winston.transport[] = [
        // new winston.transports.Console({
        //   level: logLevel,
        //   format: winston.format.combine(
        //     winston.format.colorize(),
        //     winston.format.timestamp(),
        //     winston.format.printf(({ level, message, timestamp }) => {
        //       return `[${timestamp}] ${level}: ${message}`;
        //     })
        //   ),
        // }),
    ];

    if (logging) {
        transports.push(
            new (winston.transports as any).DailyRotateFile({
                filename: logFilePath,
                datePattern: 'YYYY-MM-DD',
                zippedArchive: true,
                maxSize: '20m',
                maxFiles: '14d',
                level: logLevel,
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.printf(({ level, message, timestamp }) => {
                        return `[${timestamp}] ${level}: ${message}`;
                    })
                ),
            })
        );
    } else {
        transports.push(new winston.transports.Console({ silent: true }));
    }

    loggerInstance = winston.createLogger({
        level: logLevel,
        format: winston.format.json(),
        transports: transports,
        exceptionHandlers: logging
            ? [
                  new (winston.transports as any).DailyRotateFile({
                      filename: exceptionLogFilePath,
                      datePattern: 'YYYY-MM-DD',
                      zippedArchive: true,
                      maxSize: '20m',
                      maxFiles: '14d',
                      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
                  }),
              ]
            : [],
        exitOnError: false, // Do not exit on handled exceptions
        silent: !logging,
    });
}

export const logger: winston.Logger = new Proxy({} as winston.Logger, {
    get: (target, prop, receiver) => {
        if (!loggerInstance) {
            throw new Error('Logger not initialized. Call initializeLogger() first.');
        }
        return Reflect.get(loggerInstance, prop, receiver);
    },
});

export function getCurrentLogLevel(): string {
    return currentLogLevel;
}

export function isVerboseLoggingEnabled(): boolean {
    const levels = winston.config.npm.levels;
    const levelValue = levels[currentLogLevel] ?? levels.info;
    return levelValue >= levels.verbose;
}
