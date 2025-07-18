import fs from 'fs';
import path from 'path';

import { xxh64 } from '@pacote/xxhash';
import winston from 'winston';


import { AICOMMIT_LOGS_DIR } from './config.js';

export type RequestType = 'review' | 'commit';

// AI 서비스별 로거들
const serviceLoggers = new Map<string, winston.Logger>();

// 로거 생성 또는 가져오기
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

// AI 요청 시작 로깅 (config 체크 포함)
export const logAIRequest = (
    diff: string,
    requestType: RequestType,
    aiName: string,
    model: string,
    url: string,
    headers: any,
    logging: boolean = true
) => {
    if (!logging) {return;}

    const logger = getOrCreateServiceLogger(aiName, diff, requestType);
    logger.info(`Making request to ${aiName} API with model: ${model}`);
    logger.info(`Request URL: ${url}`);
    logger.info('Request headers:', headers);
};

// AI 요청 페이로드 로깅
export const logAIPayload = (diff: string, requestType: RequestType, aiName: string, payload: any, logging: boolean = true) => {
    if (!logging) {return;}

    const logger = getOrCreateServiceLogger(aiName, diff, requestType);
    logger.info('Request payload:', payload);
};

// AI 프롬프트 정보 로깅 (시스템 프롬프트와 사용자 프롬프트)
export const logAIPrompt = (
    diff: string,
    requestType: RequestType,
    aiName: string,
    systemPrompt: string,
    userPrompt: string,
    logging: boolean = true
) => {
    if (!logging) {return;}

    const logger = getOrCreateServiceLogger(aiName, diff, requestType);
    logger.info('System prompt:', { prompt: systemPrompt });
    logger.info('User prompt:', { prompt: userPrompt });
};

// AI 응답 로깅
export const logAIResponse = (diff: string, requestType: RequestType, aiName: string, response: any, logging: boolean = true) => {
    if (!logging) {return;}

    const logger = getOrCreateServiceLogger(aiName, diff, requestType);
    logger.info('Response received:', response);
};

// AI 에러 로깅
export const logAIError = (diff: string, requestType: RequestType, aiName: string, error: any, logging: boolean = true) => {
    if (!logging) {return;}

    const logger = getOrCreateServiceLogger(aiName, diff, requestType);
    logger.error('API request failed:', error);
};

// AI 요청 완료 로깅 (성공시)
export const logAIComplete = (
    diff: string,
    requestType: RequestType,
    aiName: string,
    duration?: number,
    finalResponse?: string,
    logging: boolean = true
) => {
    if (!logging) {return;}

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
    if (!logging) {return;}

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

// 세션 완료 시 로거 정리
export const finishLogSession = (sessionKey: string) => {
    // 해당 세션과 관련된 모든 서비스 로거들을 정리
    const loggerKeysToRemove: string[] = [];

    for (const [loggerKey, logger] of serviceLoggers.entries()) {
        if (loggerKey.includes(sessionKey)) {
            logger.close();
            loggerKeysToRemove.push(loggerKey);
        }
    }

    loggerKeysToRemove.forEach(key => serviceLoggers.delete(key));
};

// 레거시 함수 - 새로운 시스템으로 리다이렉트
export const createLogResponse = (
    aiName: string,
    diff: string,
    prompt: string,
    response: string,
    requestType: RequestType,
    logging: boolean = true
) => {
    if (!logging) {return;}
    addLogEntry(diff, requestType, aiName, prompt, response, undefined, undefined, logging);
};

// 성능 측정과 함께 로그 추가
export const logWithTiming = (
    diff: string,
    requestType: RequestType,
    aiName: string,
    prompt: string,
    response: string,
    startTime: Date,
    error?: string,
    logging: boolean = true
) => {
    if (!logging) {return;}
    const duration = Date.now() - startTime.getTime();
    addLogEntry(diff, requestType, aiName, prompt, response, duration, error, logging);
};

// 서비스별 파일명 생성
const generateServiceLogFileName = (date: Date, aiName: string, diff: string, requestType: RequestType) => {
    const { year, month, day, hours, minutes, seconds } = getDateString(date);
    const hasher = xxh64(0);
    const hash = hasher.update(diff).digest('hex').substring(0, 8);
    const serviceName = aiName.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (requestType === 'review') {
        return `${serviceName}_review_${year}-${month}-${day}_${hours}-${minutes}-${seconds}_${hash}.log`;
    }
    return `${serviceName}_commit_${year}-${month}-${day}_${hours}-${minutes}-${seconds}_${hash}.log`;
};

// 파일명 생성 (기존 호환성)
export const generateLogFileName = (date: Date, diff: string, requestType: RequestType) => {
    const { year, month, day, hours, minutes, seconds } = getDateString(date);
    const hasher = xxh64(0);
    const hash = hasher.update(diff).digest('hex').substring(0, 8);
    if (requestType === 'review') {
        return `aic2_review_${year}-${month}-${day}_${hours}-${minutes}-${seconds}_${hash}.log`;
    }
    return `aic2_${year}-${month}-${day}_${hours}-${minutes}-${seconds}_${hash}.log`;
};

// 타이머 유틸리티
export const createTimer = () => {
    const start = Date.now();
    return () => Date.now() - start;
};

// 날짜 문자열 생성
export const getDateString = (date: Date) => {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    return { year, month, day, hours, minutes, seconds };
};

// 파일 쓰기 유틸리티
export const writeFileSyncRecursive = (fileName: string, content: string = '') => {
    try {
        fs.mkdirSync(path.dirname(fileName), { recursive: true });
        fs.writeFileSync(fileName, content, 'utf-8');
    } catch (error) {
        console.error(`Failed to write log file ${fileName}:`, error);
    }
};

// 로그 상태 확인
export const getLogStatus = () => {
    return {
        activeServiceLoggers: serviceLoggers.size,
        loggers: Array.from(serviceLoggers.keys()),
    };
};

// 프로세스 종료 시 정리
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
    if (!fs.existsSync(logDir)) {return;}

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
