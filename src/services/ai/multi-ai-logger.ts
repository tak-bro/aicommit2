import { AIResponse } from './ai.service.js';
import { RequestType, addLogEntry, createTimer, finishLogSession, startLogSession } from '../../utils/ai-log.js';
import { logger } from '../../utils/logger.js';

export interface MultiAIResult {
    serviceName: string;
    success: boolean;
    response?: AIResponse[];
    error?: string;
    duration: number;
}

export class MultiAILogger {
    private sessionKey: string;
    private startTime: Date;
    private results: MultiAIResult[] = [];
    private sessionTimer: () => number;

    constructor(
        private diff: string,
        private requestType: RequestType
    ) {
        this.sessionKey = startLogSession(diff, requestType);
        this.startTime = new Date();
        this.sessionTimer = createTimer();

        logger.info(`Multi-AI session started: ${this.sessionKey} (${requestType})`);
    }

    // AI 서비스 실행 전에 호출
    startService(serviceName: string): ServiceLogger {
        return new ServiceLogger(this.sessionKey, serviceName, this.requestType);
    }

    // AI 서비스 실행 결과 기록
    recordResult(result: MultiAIResult): void {
        this.results.push(result);

        if (result.success) {
            logger.info(`${result.serviceName} completed successfully in ${result.duration}ms`);
        } else {
            logger.error(`${result.serviceName} failed in ${result.duration}ms: ${result.error}`);
        }
    }

    // 모든 서비스 완료 후 세션 종료
    finishSession(): MultiAISessionSummary {
        const totalDuration = this.sessionTimer();
        const successful = this.results.filter(r => r.success).length;
        const failed = this.results.filter(r => !r.success).length;

        const summary: MultiAISessionSummary = {
            sessionKey: this.sessionKey,
            requestType: this.requestType,
            startTime: this.startTime,
            endTime: new Date(),
            totalDuration,
            totalServices: this.results.length,
            successful,
            failed,
            results: this.results,
        };

        logger.info(
            `Multi-AI session completed: ${this.sessionKey} - ${successful}/${this.results.length} successful in ${totalDuration}ms`
        );

        finishLogSession(this.sessionKey);

        return summary;
    }

    // 현재 세션 상태 반환
    getSessionStatus(): {
        sessionKey: string;
        activeServices: number;
        completedServices: number;
        duration: number;
    } {
        return {
            sessionKey: this.sessionKey,
            activeServices: this.results.filter(r => r.success || r.error).length,
            completedServices: this.results.length,
            duration: this.sessionTimer(),
        };
    }
}

// 개별 AI 서비스용 로거
export class ServiceLogger {
    private timer: () => number;
    private serviceName: string;

    constructor(
        private sessionKey: string,
        serviceName: string,
        private requestType: RequestType
    ) {
        this.serviceName = serviceName.replace(/\[|\]/g, '').trim();
        this.timer = createTimer();
    }

    // 성공적인 요청 로깅
    logSuccess(prompt: string, response: string): MultiAIResult {
        const duration = this.timer();
        addLogEntry(this.sessionKey, this.serviceName, prompt, response, duration);

        return {
            serviceName: this.serviceName,
            success: true,
            response: [{ title: response.substring(0, 50) + '...', value: response }],
            duration,
        };
    }

    // 실패한 요청 로깅
    logError(prompt: string, error: string): MultiAIResult {
        const duration = this.timer();
        addLogEntry(this.sessionKey, this.serviceName, prompt, '', duration, error);

        return {
            serviceName: this.serviceName,
            success: false,
            error,
            duration,
        };
    }

    // 응답과 함께 성공 로깅
    logSuccessWithResponse(prompt: string, response: AIResponse[]): MultiAIResult {
        const duration = this.timer();
        const responseText = response.map(r => r.value).join('\n---\n');
        addLogEntry(this.sessionKey, this.serviceName, prompt, responseText, duration);

        return {
            serviceName: this.serviceName,
            success: true,
            response,
            duration,
        };
    }
}

// 세션 요약 인터페이스
export interface MultiAISessionSummary {
    sessionKey: string;
    requestType: RequestType;
    startTime: Date;
    endTime: Date;
    totalDuration: number;
    totalServices: number;
    successful: number;
    failed: number;
    results: MultiAIResult[];
}

// 유틸리티 함수들
export const createMultiAILogger = (diff: string, requestType: RequestType): MultiAILogger => {
    return new MultiAILogger(diff, requestType);
};

export const formatSessionSummary = (summary: MultiAISessionSummary): string => {
    const successRate = summary.totalServices > 0 ? ((summary.successful / summary.totalServices) * 100).toFixed(1) : '0';
    const avgDuration =
        summary.results.length > 0 ? Math.round(summary.results.reduce((sum, r) => sum + r.duration, 0) / summary.results.length) : 0;

    return `Session ${summary.sessionKey}: ${summary.successful}/${summary.totalServices} services (${successRate}%) - Total: ${summary.totalDuration}ms, Avg: ${avgDuration}ms`;
};

export const getTopPerformingServices = (summary: MultiAISessionSummary, limit: number = 3): MultiAIResult[] => {
    return summary.results
        .filter(r => r.success)
        .sort((a, b) => a.duration - b.duration)
        .slice(0, limit);
};

export const getFailedServices = (summary: MultiAISessionSummary): MultiAIResult[] => {
    return summary.results.filter(r => !r.success);
};
