import winston from 'winston';
import 'winston-daily-rotate-file';

let loggerInstance: winston.Logger | undefined = undefined;

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
    const logFilePath = options?.logFilePath || 'logs/application-%DATE%.log';
    const exceptionLogFilePath = options?.exceptionLogFilePath || 'logs/exceptions-%DATE%.log';

    const logging = options?.logging ?? true; // Default to true

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
