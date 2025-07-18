import fs from 'fs';
import path from 'path';

import { xxh64 } from '@pacote/xxhash';
import winston from 'winston';


import { AICOMMIT_LOGS_DIR } from './config.js';

export type RequestType = 'review' | 'commit';

// winston 로거 생성
let logger: winston.Logger | null = null;

// 로그 항목 인터페이스
interface LogEntry {
    aiName: string;
    prompt: string;
    response: string;
    timestamp: Date;
    duration?: number;
    error?: string;
}

// 단일 diff 파일 기반 로깅 시스템
const activeLogFiles = new Map<
    string,
    {
        filePath: string;
        diff: string;
        requestType: RequestType;
        entries: LogEntry[];
        startTime: Date;
        diffHash: string;
    }
>();

// winston 로거 초기화
const getOrCreateLogger = (diff: string, requestType: RequestType): winston.Logger => {
    const diffHash = xxh64(0).update(diff).digest('hex').substring(0, 8);
    const logKey = `${requestType}_${diffHash}`;

    if (logger && activeLogFiles.has(logKey)) {
        return logger;
    }

    const startTime = new Date();
    const fileName = generateLogFileName(startTime, diff, requestType);
    const filePath = `${AICOMMIT_LOGS_DIR}/${fileName}`;

    // winston 로거 설정
    logger = winston.createLogger({
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

    const logFile = {
        filePath,
        diff,
        requestType,
        entries: [],
        startTime,
        diffHash,
    };

    activeLogFiles.set(logKey, logFile);
    return logger;
};

// diff 해시 기반 로그 파일 생성 또는 기존 파일 가져오기
const getOrCreateLogFile = (diff: string, requestType: RequestType) => {
    const diffHash = xxh64(0).update(diff).digest('hex').substring(0, 8);
    const logKey = `${requestType}_${diffHash}`;

    if (activeLogFiles.has(logKey)) {
        return activeLogFiles.get(logKey)!;
    }

    const startTime = new Date();
    const fileName = generateLogFileName(startTime, diff, requestType);
    const filePath = `${AICOMMIT_LOGS_DIR}/${fileName}`;

    const logFile = {
        filePath,
        diff,
        requestType,
        entries: [],
        startTime,
        diffHash,
    };

    activeLogFiles.set(logKey, logFile);
    return logFile;
};

// winston으로 실시간 로깅
export const logAIRequest = (diff: string, requestType: RequestType, aiName: string, model: string, url?: string) => {
    const logger = getOrCreateLogger(diff, requestType);
    logger.info(`Making request to ${aiName} API with model: ${model}`);
    if (url) {
        logger.info(`Request URL: ${url}`);
    }
};

export const logAIPayload = (diff: string, requestType: RequestType, payload: any) => {
    const logger = getOrCreateLogger(diff, requestType);
    logger.info('Request payload:', payload);
};

export const logAIResponse = (diff: string, requestType: RequestType, response: any) => {
    const logger = getOrCreateLogger(diff, requestType);
    logger.info('Response received:', response);
};

export const logAIError = (diff: string, requestType: RequestType, error: any) => {
    const logger = getOrCreateLogger(diff, requestType);
    logger.error('API request failed:', error);
};

// 로그 엔트리 추가 (기존 함수 유지 - 호환성)
export const addLogEntry = (
    diff: string,
    requestType: RequestType,
    aiName: string,
    prompt: string,
    response: string,
    duration?: number,
    error?: string
) => {
    const logger = getOrCreateLogger(diff, requestType);

    if (error) {
        logger.error(`[${aiName}] Request failed after ${duration}ms: ${error}`);
    } else {
        logger.info(`[${aiName}] Request completed in ${duration}ms`);
        logger.info(`[${aiName}] Response: ${response}`);
    }

    // 백업용 파일 시스템 로그도 유지
    const logFile = getOrCreateLogFile(diff, requestType);
    logFile.entries.push({
        aiName,
        prompt,
        response,
        timestamp: new Date(),
        duration,
        error,
    });
};

// 로그 파일 쓰기
const writeLogFile = (logFile: {
    filePath: string;
    diff: string;
    requestType: RequestType;
    entries: LogEntry[];
    startTime: Date;
    diffHash: string;
}) => {
    const content = buildLogContent(logFile);
    writeFileSyncRecursive(logFile.filePath, content);
};

// copilot 스타일 로그 내용 구성
const buildLogContent = (logFile: {
    filePath: string;
    diff: string;
    requestType: RequestType;
    entries: LogEntry[];
    startTime: Date;
    diffHash: string;
}): string => {
    const header =
        `=== AI Commit Log (${logFile.requestType.toUpperCase()}) ===\n` +
        `Diff Hash: ${logFile.diffHash}\n` +
        `Start Time: ${logFile.startTime.toISOString()}\n` +
        `Total Services: ${logFile.entries.length}\n\n`;

    const diffSection = `[Git Diff]\n${logFile.diff}\n\n`;

    // copilot 스타일 로그 형식
    const entriesSection = logFile.entries
        .map((entry, index) => {
            const duration = entry.duration ? ` (${entry.duration}ms)` : '';
            const timestamp = entry.timestamp.toISOString();
            const status = entry.error ? '❌ FAILED' : '✅ SUCCESS';

            let section = `[${entry.aiName}] ${status}${duration} - ${timestamp}\n`;
            section += `- System Prompt\n${entry.prompt}\n\n`;

            if (entry.error) {
                section += `- Error\n${entry.error}\n`;
            } else {
                section += `- Response\n${entry.response}\n`;
            }

            return section;
        })
        .join('\n' + '='.repeat(80) + '\n\n');

    // 요약 정보
    const successful = logFile.entries.filter(e => !e.error).length;
    const failed = logFile.entries.filter(e => e.error).length;
    const totalDuration = logFile.entries.reduce((sum, e) => sum + (e.duration || 0), 0);
    const avgDuration = logFile.entries.length > 0 ? Math.round(totalDuration / logFile.entries.length) : 0;
    const endTime = new Date();
    const sessionDuration = endTime.getTime() - logFile.startTime.getTime();

    const summary =
        `\n${'='.repeat(80)}\n` +
        `=== SESSION SUMMARY ===\n` +
        `Total Services: ${logFile.entries.length}\n` +
        `Successful: ${successful}\n` +
        `Failed: ${failed}\n` +
        `Success Rate: ${logFile.entries.length > 0 ? ((successful / logFile.entries.length) * 100).toFixed(1) : 0}%\n` +
        `Total AI Duration: ${totalDuration}ms\n` +
        `Average AI Duration: ${avgDuration}ms\n` +
        `Session Duration: ${sessionDuration}ms\n` +
        `End Time: ${endTime.toISOString()}\n` +
        `${'='.repeat(80)}\n`;

    return header + diffSection + entriesSection + summary;
};

// 로그 세션 시작 (MultiAI 로거용)
export const startLogSession = (diff: string, requestType: RequestType): string => {
    const diffHash = xxh64(0).update(diff).digest('hex').substring(0, 8);
    const logKey = `${requestType}_${diffHash}`;

    // 로그 파일 초기화
    getOrCreateLogFile(diff, requestType);

    return logKey;
};

// 세션 완료 시 파일 정리
export const finishLogSession = (sessionKey: string) => {
    const logFile = activeLogFiles.get(sessionKey);
    if (logFile) {
        // 최종 파일 쓰기
        writeLogFile(logFile);
        // 메모리에서 제거
        activeLogFiles.delete(sessionKey);
    }
};

// 레거시 함수 - 새로운 시스템으로 리다이렉트
export const createLogResponse = (aiName: string, diff: string, prompt: string, response: string, requestType: RequestType) => {
    addLogEntry(diff, requestType, aiName, prompt, response);
};

// 성능 측정과 함께 로그 추가
export const logWithTiming = (
    diff: string,
    requestType: RequestType,
    aiName: string,
    prompt: string,
    response: string,
    startTime: Date,
    error?: string
) => {
    const duration = Date.now() - startTime.getTime();
    addLogEntry(diff, requestType, aiName, prompt, response, duration, error);
};

// 파일명 생성
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
        activeFiles: activeLogFiles.size,
        files: Array.from(activeLogFiles.entries()).map(([key, file]) => ({
            key,
            diffHash: file.diffHash,
            requestType: file.requestType,
            entriesCount: file.entries.length,
            filePath: file.filePath,
            startTime: file.startTime,
        })),
    };
};

// 프로세스 종료 시 정리
const cleanup = () => {
    for (const [key, logFile] of activeLogFiles.entries()) {
        try {
            writeLogFile(logFile);
        } catch (error) {
            console.error(`Failed to write log file on cleanup: ${error}`);
        }
    }
    activeLogFiles.clear();
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
