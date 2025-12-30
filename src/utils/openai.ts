import http from 'http';
import https from 'https';

import { type TiktokenModel } from '@dqbd/tiktoken';
import createHttpsProxyAgent from 'https-proxy-agent';

import { RequestType, logAIComplete, logAIError, logAIPayload, logAIPrompt, logAIRequest, logAIResponse } from './ai-log.js';
import { KnownError } from './error.js';
import { generateUserPrompt } from './prompt.js';

import type { ClientRequest, IncomingMessage } from 'http';

export const httpsGet = async (url: URL, path: string, headers: Record<string, string>, timeout: number, proxy?: string) =>
    new Promise<{
        request: ClientRequest;
        response: IncomingMessage;
        data: string;
    }>((resolve, reject) => {
        const httpModule = url.protocol.includes('https') ? https : http;
        const request = https.request(
            {
                hostname: url.hostname,
                path,
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
                timeout,
                agent: proxy ? createHttpsProxyAgent(proxy) : undefined,
            },
            response => {
                const body: Buffer[] = [];
                response.on('data', chunk => body.push(chunk));
                response.on('end', () => {
                    resolve({
                        request,
                        response,
                        data: Buffer.concat(body).toString(),
                    });
                });
            }
        );
        request.on('error', reject);
        request.on('timeout', () => {
            request.destroy();
            reject(new KnownError(`Time out error: request took over ${timeout}ms. Try increasing the \`timeout\` config`));
        });
        request.end();
    });

export const httpsPost = async (
    url: URL,
    path: string,
    headers: Record<string, string>,
    json: unknown,
    timeout: number,
    proxy?: string,
    port?: number
) =>
    new Promise<{
        request: ClientRequest;
        response: IncomingMessage;
        data: string;
    }>((resolve, reject) => {
        const postContent = JSON.stringify(json);
        const httpModule = url.protocol.includes('https') ? https : http;
        const request = httpModule.request(
            {
                port: port ? port : undefined,
                hostname: url.hostname,
                path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postContent),
                    ...headers,
                },
                timeout,
                agent: proxy ? createHttpsProxyAgent(proxy) : undefined,
            },
            response => {
                const body: Buffer[] = [];
                response.on('data', chunk => body.push(chunk));
                response.on('end', () => {
                    resolve({
                        request,
                        response,
                        data: Buffer.concat(body).toString(),
                    });
                });
            }
        );
        request.on('error', reject);
        request.on('timeout', () => {
            request.destroy();
            reject(new KnownError(`Time out error: request took over ${timeout}ms. Try increasing the \`timeout\` config`));
        });

        request.write(postContent);
        request.end();
    });

const createChatCompletion = async (url: string, path: string, apiKey: string, json: any, timeout: number, proxy?: string) => {
    const openAIUrl = new URL(url);
    const { response, data } = await httpsPost(
        openAIUrl,
        path,
        {
            Authorization: `Bearer ${apiKey}`,
        },
        json,
        timeout,
        proxy
    );

    if (!response.statusCode || response.statusCode < 200 || response.statusCode > 299) {
        let errorMessage = `API Error: ${response.statusCode} - ${response.statusMessage}`;

        if (data) {
            errorMessage += `\n\n${data}`;
        }

        if (response.statusCode === 500) {
            errorMessage += `\n\nCheck the API status: ${url}`;
        }

        throw new KnownError(errorMessage);
    }

    return JSON.parse(data);
};

export const sanitizeMessage = (message: string) => message.trim();

/**
 * List of model prefixes that require special API parameters.
 * These models use max_completion_tokens instead of max_tokens and don't support top_p.
 * Includes:
 * - GPT-5 series (gpt-5, gpt-5-mini, gpt-5-nano, gpt-5-codex)
 * - O-series reasoning models (o1, o1-mini, o1-pro, o3, o3-mini, o3-pro, o4-mini)
 */
const REASONING_MODEL_PREFIXES = [
    // GPT-5 series
    'gpt-5',
    'gpt-5-mini',
    'gpt-5-nano',
    'gpt-5-codex',
    // O-series reasoning models
    'o1',
    'o1-mini',
    'o1-pro',
    'o3',
    'o3-mini',
    'o3-pro',
    'o4-mini',
] as const;

/**
 * Checks if the given model requires special reasoning model parameters.
 * These models require different API parameters than standard OpenAI models:
 * - Use `max_completion_tokens` instead of `max_tokens`
 * - Don't support `top_p` parameter
 * - Require `temperature: 1`
 *
 * @param model - The model identifier (e.g., "o1", "o3-mini", "gpt-5")
 * @returns true if the model is a reasoning model, false otherwise
 *
 * @example
 * isReasoningModel('o1') // true
 * isReasoningModel('o3-mini') // true
 * isReasoningModel('o3-mini-2025-01-31') // true (version suffix)
 * isReasoningModel('gpt-5') // true
 * isReasoningModel('gpt-5.2') // true (dot version suffix)
 * isReasoningModel('gpt-4o') // false
 * isReasoningModel('gpt-4') // false
 */
export const isReasoningModel = (model: string): boolean => {
    const normalizedModel = model.toLowerCase();
    return REASONING_MODEL_PREFIXES.some(
        prefix => normalizedModel === prefix || normalizedModel.startsWith(`${prefix}-`) || normalizedModel.startsWith(`${prefix}.`)
    );
};

/**
 * @deprecated Use isReasoningModel instead. This alias is kept for backward compatibility.
 */
export const isGPT5Model = isReasoningModel;

export const generateCommitMessage = async (
    serviceName: string,
    url: string,
    path: string,
    apiKey: string,
    model: TiktokenModel,
    diff: string,
    timeout: number,
    maxTokens: number,
    temperature: number,
    topP: number,
    systemPrompt: string,
    logging: boolean,
    requestType: RequestType,
    proxy?: string
) => {
    try {
        const userPrompt = generateUserPrompt(diff, requestType);

        const reasoningModel = isReasoningModel(model);

        const request: any = {
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            stream: false,
            n: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
            ...(reasoningModel
                ? {
                      // Reasoning models (o1, o3, gpt-5) use max_completion_tokens instead of max_tokens and don't support top_p
                      max_completion_tokens: maxTokens,
                      temperature: 1,
                  }
                : {
                      // Standard models use traditional parameters
                      max_tokens: maxTokens,
                      top_p: topP,
                      temperature: temperature,
                  }),
        };

        const fullUrl = new URL(url);
        const requestUrl = `${fullUrl.protocol}//${fullUrl.host}${path}`;
        const headers = {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        };

        // 상세 로깅 (이미 config에서 전달된 URL 사용)
        logAIRequest(diff, requestType, serviceName, model, requestUrl, headers, logging);
        logAIPrompt(diff, requestType, serviceName, systemPrompt, userPrompt, logging);
        logAIPayload(diff, requestType, serviceName, request, logging);

        const startTime = Date.now();
        const completion = await createChatCompletion(url, path, apiKey, request, timeout, proxy);
        const duration = Date.now() - startTime;

        // 응답 로깅
        logAIResponse(diff, requestType, serviceName, completion, logging);

        const fullText = completion.choices
            .filter(choice => choice.message?.content)
            .map(choice => sanitizeMessage(choice.message!.content as string))
            .join();

        // 완료 로깅
        logAIComplete(diff, requestType, serviceName, duration, fullText, logging);

        return completion.choices
            .filter(choice => choice.message?.content)
            .map(choice => sanitizeMessage(choice.message!.content as string));
    } catch (error) {
        // 에러 로깅
        logAIError(diff, requestType, serviceName, error, logging);

        const errorAsAny = error as any;
        if (errorAsAny.code === 'ENOTFOUND') {
            throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall})`);
        }
        throw errorAsAny;
    }
};
