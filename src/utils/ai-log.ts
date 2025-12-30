import fs from 'fs';
import path from 'path';

import { xxh64 } from '@pacote/xxhash';
import winston from 'winston';

import { AICOMMIT_LOGS_DIR } from './config.js';

export type RequestType = 'review' | 'commit';

const serviceLoggers = new Map<string, winston.Logger>();

const getOrCreateServiceLogger = (aiName: string, diff: string, requestType: RequestType): winston.Logger => {
    const diffHash = xxh64(0).update(diff).digest('hex').substring(0, 8);
    const loggerKey = `${aiName}_${diffHash}_${requestType}`;

    if (serviceLoggers.has(loggerKey)) {
        return serviceLoggers.get(loggerKey)!;
    }

    // 서비스별 로그 파일명 생성
    const startTime = new Date();
    const fileName = generateServiceLogFileName(startTime, aiName, diff, requestType);
    const filePath = `${AICOMMIT_LOGS_DIR}/${fileName}`;

    // winston 로거 생성
    const logger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                if (meta && Object.keys(meta).length > 0) {
                    return `[${timestamp}] ${level}: ${message} ${JSON.stringify(meta, null, 2)}`;
                }
                return `[${timestamp}] ${level}: ${message}`;
            })
        ),
        transports: [new winston.transports.File({ filename: filePath })],
    });

    // 로그 헤더 작성
    logger.info(`=== ${aiName.toUpperCase()} AI SERVICE LOG ===`);
    logger.info(`Diff Hash: ${diffHash}`);
    logger.info(`Request Type: ${requestType.toUpperCase()}`);
    logger.info(`Start Time: ${startTime.toISOString()}`);
    logger.info('='.repeat(50));
    logger.info('');

    serviceLoggers.set(loggerKey, logger);
    return logger;
};

const maskApiKeys = (headers: any): any => {
    const masked = { ...headers };
    const keyFields = ['authorization', 'x-api-key', 'x-goog-api-key', 'api-key', 'x-amzn-bedrock-application-key'];

    for (const field of keyFields) {
        const lowerField = field.toLowerCase();
        const foundKey = Object.keys(masked).find(key => key.toLowerCase() === lowerField);
        if (foundKey && masked[foundKey]) {
            if (typeof masked[foundKey] === 'string') {
                if (masked[foundKey].startsWith('Bearer ')) {
                    masked[foundKey] = 'Bearer [MASKED]';
                } else {
                    masked[foundKey] = '[MASKED]';
                }
            }
        }
    }
    return masked;
};

export const logAIRequest = (
    diff: string,
    requestType: RequestType,
    aiName: string,
    model: string,
    url: string,
    headers: any,
    logging: boolean = true
) => {
    if (!logging) {
        return;
    }

    const logger = getOrCreateServiceLogger(aiName, diff, requestType);
    logger.info(`Making request to ${aiName} API with model: ${model}`);
    logger.info(`Request URL: ${url}`);
    logger.info('Request headers:', maskApiKeys(headers));
};

export const logAIPayload = (diff: string, requestType: RequestType, aiName: string, payload: any, logging: boolean = true) => {
    if (!logging) {
        return;
    }

    const logger = getOrCreateServiceLogger(aiName, diff, requestType);
    logger.info('Request payload:', payload);
};

export const logAIPrompt = (
    diff: string,
    requestType: RequestType,
    aiName: string,
    systemPrompt: string,
    userPrompt: string,
    logging: boolean = true
) => {
    if (!logging) {
        return;
    }

    const logger = getOrCreateServiceLogger(aiName, diff, requestType);
    logger.info('System prompt:', { prompt: systemPrompt });
    logger.info('User prompt:', { prompt: userPrompt });
};

export const logAIResponse = (diff: string, requestType: RequestType, aiName: string, response: any, logging: boolean = true) => {
    if (!logging) {
        return;
    }

    const logger = getOrCreateServiceLogger(aiName, diff, requestType);
    logger.info('Response received:', response);
};

export const logAIError = (diff: string, requestType: RequestType, aiName: string, error: any, logging: boolean = true) => {
    if (!logging) {
        return;
    }

    const logger = getOrCreateServiceLogger(aiName, diff, requestType);
    logger.error('API request failed:', error);
};

export const logAIComplete = (
    diff: string,
    requestType: RequestType,
    aiName: string,
    duration?: number,
    finalResponse?: string,
    logging: boolean = true
) => {
    if (!logging) {
        return;
    }

    const logger = getOrCreateServiceLogger(aiName, diff, requestType);

    if (duration) {
        logger.info(`Request completed successfully in ${duration}ms`);
    } else {
        logger.info('Request completed successfully');
    }

    if (finalResponse) {
        logger.info('Final processed response:', { response: finalResponse });
    }

    logger.info('');
    logger.info('='.repeat(50));
    logger.info(`End Time: ${new Date().toISOString()}`);
    logger.info('=== REQUEST COMPLETED ===');
};

// 로그 엔트리 추가 (기존 함수 유지 - 호환성)
export const addLogEntry = (
    diff: string,
    requestType: RequestType,
    aiName: string,
    prompt: string,
    response: string,
    duration?: number,
    error?: string,
    logging: boolean = true
) => {
    if (!logging) {
        return;
    }

    const logger = getOrCreateServiceLogger(aiName, diff, requestType);

    if (error) {
        logger.error(`Request failed after ${duration}ms:`, { error });
    } else {
        logger.info(`Request completed in ${duration}ms`);
        logger.info('Response:', { response });
    }

    logAIComplete(diff, requestType, aiName, duration, response, logging);
};

// 로그 세션 시작 (MultiAI 로거용) - 각 서비스별로 개별 세션
export const startLogSession = (diff: string, requestType: RequestType): string => {
    const diffHash = xxh64(0).update(diff).digest('hex').substring(0, 8);
    return `${requestType}_${diffHash}`;
};

export const finishLogSession = (sessionKey: string) => {
    const loggerKeysToRemove: string[] = [];

    for (const [loggerKey, logger] of serviceLoggers.entries()) {
        if (loggerKey.includes(sessionKey)) {
            logger.close();
            loggerKeysToRemove.push(loggerKey);
        }
    }

    loggerKeysToRemove.forEach(key => serviceLoggers.delete(key));
};

const generateServiceLogFileName = (date: Date, aiName: string, diff: string, requestType: RequestType) => {
    const { year, month, day, hours, minutes, seconds } = getDateString(date);
    const hasher = xxh64(0);
    const hash = hasher.update(diff).digest('hex').substring(0, 8);
    const serviceName = aiName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20);

    if (requestType === 'review') {
        return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}_${hash}_${serviceName}_review.log`;
    }
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}_${hash}_${serviceName}_commit.log`;
};

export const createTimer = () => {
    const start = Date.now();
    return () => Date.now() - start;
};

export const getDateString = (date: Date) => {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    return { year, month, day, hours, minutes, seconds };
};

const cleanup = () => {
    for (const [key, logger] of serviceLoggers.entries()) {
        try {
            logger.close();
        } catch (error) {
            console.error(`Failed to close logger ${key}:`, error);
        }
    }
    serviceLoggers.clear();
};

process.on('exit', cleanup);
process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
});
process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
});

// 오래된 로그 파일 정리
export const compressOldLogs = async (daysToKeep: number = 7) => {
    const logDir = AICOMMIT_LOGS_DIR;
    if (!fs.existsSync(logDir)) {
        return;
    }

    const files = fs.readdirSync(logDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    for (const file of files) {
        if (file.endsWith('.log')) {
            const filePath = path.join(logDir, file);
            const stats = fs.statSync(filePath);

            if (stats.mtime < cutoffDate) {
                try {
                    fs.unlinkSync(filePath);
                } catch (error) {
                    console.error(`Failed to delete old log file ${file}:`, error);
                }
            }
        }
    }
};
