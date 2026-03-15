import chalk from 'chalk';

/**
 * Color theme for error messages (matches CLI purple gradient theme)
 */
const theme = {
    label: chalk.bold.green, // Fix:, Solution: - 초록색 (긍정적)
    command: chalk.bold.white, // 명령어 - 흰색 볼드 (눈에 띄게)
    hint: chalk.gray, // Tip:, Note: - 회색
    highlight: chalk.bold.magenta, // 강조 - 보라색 (테마 컬러)
    dim: chalk.dim, // 부가 설명
};

/**
 * Standardized error codes for consistent error handling
 */
export const ErrorCode = {
    // Authentication errors
    MISSING_API_KEY: 'MISSING_API_KEY',
    INVALID_API_KEY: 'INVALID_API_KEY',
    AUTH_FAILED: 'AUTH_FAILED',

    // Rate limiting
    RATE_LIMITED: 'RATE_LIMITED',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

    // Model errors
    MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
    MODEL_ACCESS_DENIED: 'MODEL_ACCESS_DENIED',

    // Network errors
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

    // VCS errors
    NO_STAGED_CHANGES: 'NO_STAGED_CHANGES',
    EMPTY_COMMIT_MESSAGE: 'EMPTY_COMMIT_MESSAGE',
    VCS_NOT_FOUND: 'VCS_NOT_FOUND',

    // Config errors
    INVALID_CONFIG: 'INVALID_CONFIG',
    CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',

    // Server errors
    SERVER_ERROR: 'SERVER_ERROR',

    // Unknown
    UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Error message generators for common scenarios
 * All messages follow the pattern: Problem → Fix → Help link (when applicable)
 */
export const ErrorMessages = {
    // ============================================
    // API Key Errors
    // ============================================
    missingApiKey: (provider: string): string => {
        const upperProvider = provider.toUpperCase();
        return [
            `Missing API key for ${theme.highlight(upperProvider)}.`,
            '',
            `${theme.label('→')} Run: ${theme.command(`aicommit2 config set ${upperProvider}.key=YOUR_API_KEY`)}`,
        ].join('\n');
    },

    invalidApiKey: (provider: string): string => {
        const upperProvider = provider.toUpperCase();
        return [
            `Invalid or expired API key for ${theme.highlight(upperProvider)}.`,
            '',
            `${theme.label('→')} Update: ${theme.command(`aicommit2 config set ${upperProvider}.key=YOUR_NEW_KEY`)}`,
        ].join('\n');
    },

    noApiKeysConfigured: (): string => {
        return [
            'No AI provider API keys configured.',
            '',
            `${theme.label('→')} Set at least one API key:`,
            `    ${theme.command('aicommit2 config set OPENAI.key=sk-...')}`,
            `    ${theme.command('aicommit2 config set ANTHROPIC.key=sk-ant-...')}`,
            `    ${theme.command('aicommit2 config set OLLAMA.model=llama3.2')} ${theme.dim('(no key needed)')}`,
            '',
            `${theme.hint('Tip:')} ${theme.command('aicommit2 config get')} ${theme.hint('to see current config')}`,
        ].join('\n');
    },

    // ============================================
    // Rate Limiting Errors
    // ============================================
    rateLimited: (provider?: string): string => {
        const providerText = provider ? ` for ${theme.highlight(provider)}` : '';
        return [
            `Rate limit exceeded${providerText}.`,
            '',
            `${theme.label('→')} Wait a moment and try again`,
            `${theme.label('→')} Or use a different AI provider`,
        ].join('\n');
    },

    quotaExceeded: (provider?: string): string => {
        const providerText = provider ? ` for ${theme.highlight(provider)}` : '';
        return [`API quota exceeded${providerText}.`, '', `${theme.label('→')} Upgrade your API plan or wait for reset`].join('\n');
    },

    // ============================================
    // Model Errors
    // ============================================
    modelNotFound: (model: string, provider: string): string => {
        const upperProvider = provider.toUpperCase();
        return [
            `Model ${theme.highlight(`"${model}"`)} not found for ${theme.highlight(upperProvider)}.`,
            '',
            `${theme.label('→')} Update: ${theme.command(`aicommit2 config set ${upperProvider}.model=VALID_MODEL`)}`,
        ].join('\n');
    },

    modelAccessDenied: (model: string, provider: string): string => {
        return [
            `Access denied to model ${theme.highlight(`"${model}"`)} on ${theme.highlight(provider)}.`,
            '',
            `${theme.label('→')} Check API access or upgrade your plan`,
        ].join('\n');
    },

    // ============================================
    // Network Errors
    // ============================================
    networkError: (provider?: string): string => {
        const providerText = provider ? ` to ${theme.highlight(provider)}` : '';
        return [`Network connection failed${providerText}.`, '', `${theme.label('→')} Check internet connectivity and try again`].join(
            '\n'
        );
    },

    timeout: (timeoutMs: number, provider?: string): string => {
        const providerText = provider ? ` from ${theme.highlight(provider)}` : '';
        const suggestedTimeout = Math.round(timeoutMs * 1.5);
        return [
            `Request timed out${providerText} after ${timeoutMs}ms.`,
            '',
            `${theme.label('→')} Increase: ${theme.command(`aicommit2 config set timeout=${suggestedTimeout}`)}`,
        ].join('\n');
    },

    serviceUnavailable: (provider: string): string => {
        return [
            `${theme.highlight(provider)} service is temporarily unavailable.`,
            '',
            `${theme.label('→')} Try again in a few minutes`,
        ].join('\n');
    },

    // ============================================
    // VCS Errors
    // ============================================
    noStagedChanges: (vcs: string): string => {
        const stageCommand = vcs.toLowerCase() === 'jujutsu' ? 'jj' : vcs.toLowerCase() === 'yadm' ? 'yadm add' : 'git add';
        return [
            `No staged changes found in ${theme.highlight(vcs)} repository.`,
            '',
            `${theme.label('→')} Stage: ${theme.command(`${stageCommand} <files>`)}`,
            `${theme.label('→')} Or use: ${theme.command('aicommit2 --all')}`,
        ].join('\n');
    },

    emptyCommitMessage: (): string => {
        return 'Commit message cannot be empty.';
    },

    vcsNotFound: (vcs: string): string => {
        const installLinks: Record<string, string> = {
            git: 'https://git-scm.com/downloads',
            yadm: 'https://yadm.io/docs/install',
            jujutsu: 'https://github.com/jj-vcs/jj#installation',
        };
        const link = installLinks[vcs.toLowerCase()] || '';
        return [
            `${theme.highlight(vcs)} is not installed or not found in PATH.`,
            '',
            link ? `${theme.label('→')} Install: ${theme.command(link)}` : '',
        ]
            .filter(Boolean)
            .join('\n');
    },

    notInRepository: (vcs: string): string => {
        return [
            `Not in a ${theme.highlight(vcs)} repository.`,
            '',
            `${theme.label('→')} Init: ${theme.command(`${vcs.toLowerCase()} init`)}`,
        ].join('\n');
    },

    // ============================================
    // Config Errors
    // ============================================
    invalidConfigFormat: (key: string): string => {
        return [
            `Invalid configuration format for ${theme.highlight(`"${key}"`)}`,
            '',
            `${theme.label('→')} Use: ${theme.command('aicommit2 config set PROVIDER.key=value')}`,
        ].join('\n');
    },

    invalidConfigValue: (key: string, expected: string): string => {
        return [`Invalid value for ${theme.highlight(`"${key}"`)}`, '', `${theme.label('→')} Expected: ${theme.dim(expected)}`].join('\n');
    },

    // ============================================
    // Server Errors
    // ============================================
    serverError: (provider: string, statusCode?: number): string => {
        const codeText = statusCode ? ` ${theme.dim(`(HTTP ${statusCode})`)}` : '';
        return `${theme.highlight(provider)} server error${codeText}. Try again later.`;
    },

    // ============================================
    // Ollama Specific
    // ============================================
    ollamaNotRunning: (): string => {
        return [
            `${theme.highlight('Ollama')} is not running or not accessible.`,
            '',
            `${theme.label('→')} Start: ${theme.command('ollama serve')}`,
        ].join('\n');
    },

    ollamaModelNotPulled: (model: string): string => {
        return [
            `Ollama model ${theme.highlight(`"${model}"`)} is not available locally.`,
            '',
            `${theme.label('→')} Pull: ${theme.command(`ollama pull ${model}`)}`,
        ].join('\n');
    },
} as const;

/**
 * HTTP status code to error code mapping
 */
export const httpStatusToErrorCode = (status: number): ErrorCodeType => {
    const mapping: Record<number, ErrorCodeType> = {
        401: ErrorCode.INVALID_API_KEY,
        403: ErrorCode.MODEL_ACCESS_DENIED,
        404: ErrorCode.MODEL_NOT_FOUND,
        429: ErrorCode.RATE_LIMITED,
        500: ErrorCode.SERVER_ERROR,
        502: ErrorCode.SERVICE_UNAVAILABLE,
        503: ErrorCode.SERVICE_UNAVAILABLE,
        504: ErrorCode.TIMEOUT,
    };
    return mapping[status] || ErrorCode.UNKNOWN;
};

/**
 * Detect error code from error message
 */
export const detectErrorCode = (errorMsg: string): ErrorCodeType => {
    const lowerMsg = errorMsg.toLowerCase();

    // API key errors
    if (lowerMsg.includes('api key') || lowerMsg.includes('api_key') || lowerMsg.includes('apikey')) {
        return lowerMsg.includes('missing') ? ErrorCode.MISSING_API_KEY : ErrorCode.INVALID_API_KEY;
    }

    // Authentication
    if (lowerMsg.includes('401') || lowerMsg.includes('unauthorized') || lowerMsg.includes('authentication')) {
        return ErrorCode.AUTH_FAILED;
    }

    // Rate limiting
    if (lowerMsg.includes('rate') || lowerMsg.includes('429') || lowerMsg.includes('too many')) {
        return ErrorCode.RATE_LIMITED;
    }

    // Quota
    if (lowerMsg.includes('quota') || lowerMsg.includes('usage') || lowerMsg.includes('limit exceeded')) {
        return ErrorCode.QUOTA_EXCEEDED;
    }

    // Model errors
    if (lowerMsg.includes('model') && (lowerMsg.includes('not found') || lowerMsg.includes('404'))) {
        return ErrorCode.MODEL_NOT_FOUND;
    }
    if (lowerMsg.includes('403') || lowerMsg.includes('forbidden') || lowerMsg.includes('access denied')) {
        return ErrorCode.MODEL_ACCESS_DENIED;
    }

    // Network errors
    if (lowerMsg.includes('econnrefused') || lowerMsg.includes('network') || lowerMsg.includes('connection')) {
        return ErrorCode.NETWORK_ERROR;
    }

    // Timeout
    if (lowerMsg.includes('timeout') || lowerMsg.includes('timed out') || lowerMsg.includes('504')) {
        return ErrorCode.TIMEOUT;
    }

    // Service unavailable
    if (lowerMsg.includes('unavailable') || lowerMsg.includes('overloaded') || lowerMsg.includes('503') || lowerMsg.includes('502')) {
        return ErrorCode.SERVICE_UNAVAILABLE;
    }

    // Server errors
    if (lowerMsg.includes('500') || lowerMsg.includes('internal server error')) {
        return ErrorCode.SERVER_ERROR;
    }

    return ErrorCode.UNKNOWN;
};

/**
 * Plain text error messages for select lists (no ANSI colors)
 * Used in ReactiveListChoice where colors don't render properly
 */
export const PlainErrorMessages = {
    missingApiKey: (provider: string): string => `Missing API key for ${provider.toUpperCase()}`,
    invalidApiKey: (provider: string): string => `Invalid API key for ${provider.toUpperCase()}`,
    rateLimited: (provider?: string): string => `Rate limit exceeded${provider ? ` for ${provider}` : ''}`,
    quotaExceeded: (provider?: string): string => `API quota exceeded${provider ? ` for ${provider}` : ''}`,
    modelNotFound: (model: string, provider: string): string => `Model "${model}" not found for ${provider.toUpperCase()}`,
    modelAccessDenied: (model: string, provider: string): string => `Access denied to model "${model}" on ${provider}`,
    networkError: (provider?: string): string => `Network connection failed${provider ? ` to ${provider}` : ''}`,
    timeout: (timeoutMs: number, provider?: string): string =>
        `Request timed out${provider ? ` from ${provider}` : ''} after ${timeoutMs}ms`,
    serviceUnavailable: (provider: string): string => `${provider} service is temporarily unavailable`,
    serverError: (provider: string, statusCode?: number): string => `${provider} server error${statusCode ? ` (HTTP ${statusCode})` : ''}`,
    unknown: (provider: string): string => `An error occurred with ${provider}. Please try again.`,
    // Ollama specific
    ollamaNotRunning: (): string => 'Ollama is not running. Start with: ollama serve',
    ollamaModelNotPulled: (model: string): string => `Ollama model "${model}" not found. Pull with: ollama pull ${model}`,
} as const;

/**
 * Get plain text error message for select lists (no colors)
 */
export const getPlainErrorMessage = (
    code: ErrorCodeType,
    context: { provider?: string; model?: string; timeout?: number } = {}
): string => {
    const { provider = 'AI', model, timeout } = context;

    switch (code) {
        case ErrorCode.MISSING_API_KEY:
            return PlainErrorMessages.missingApiKey(provider);
        case ErrorCode.INVALID_API_KEY:
        case ErrorCode.AUTH_FAILED:
            return PlainErrorMessages.invalidApiKey(provider);
        case ErrorCode.RATE_LIMITED:
            return PlainErrorMessages.rateLimited(provider);
        case ErrorCode.QUOTA_EXCEEDED:
            return PlainErrorMessages.quotaExceeded(provider);
        case ErrorCode.MODEL_NOT_FOUND:
            return PlainErrorMessages.modelNotFound(model || 'unknown', provider);
        case ErrorCode.MODEL_ACCESS_DENIED:
            return PlainErrorMessages.modelAccessDenied(model || 'unknown', provider);
        case ErrorCode.NETWORK_ERROR:
            return PlainErrorMessages.networkError(provider);
        case ErrorCode.TIMEOUT:
            return PlainErrorMessages.timeout(timeout || 10000, provider);
        case ErrorCode.SERVICE_UNAVAILABLE:
            return PlainErrorMessages.serviceUnavailable(provider);
        case ErrorCode.SERVER_ERROR:
            return PlainErrorMessages.serverError(provider);
        default:
            return PlainErrorMessages.unknown(provider);
    }
};
