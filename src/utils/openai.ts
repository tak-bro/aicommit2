import http from 'http';
import https from 'https';

import {
    type TiktokenModel,
    encoding_for_model,
    // encoding_for_model,
} from '@dqbd/tiktoken';
import createHttpsProxyAgent from 'https-proxy-agent';

import { KnownError } from './error.js';
import { createLogResponse } from './log.js';
import { generateDefaultPrompt, isValidConventionalMessage, isValidGitmojiMessage } from './prompt.js';
import { CommitMessage, ParsedMessage } from '../services/ai/ai.service.js';

import type { CommitType } from './config.js';
import type { ClientRequest, IncomingMessage } from 'http';
import type { CreateChatCompletionRequest, CreateChatCompletionResponse } from 'openai';

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

const createChatCompletion = async (
    url: string,
    path: string,
    apiKey: string,
    json: CreateChatCompletionRequest,
    timeout: number,
    proxy?: string
) => {
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
        let errorMessage = `OpenAI API Error: ${response.statusCode} - ${response.statusMessage}`;

        if (data) {
            errorMessage += `\n\n${data}`;
        }

        if (response.statusCode === 500) {
            errorMessage += '\n\nCheck the API status: https://status.openai.com';
        }

        throw new KnownError(errorMessage);
    }

    return JSON.parse(data) as CreateChatCompletionResponse;
};

const sanitizeMessage = (message: string) =>
    message
        .trim()
        .replace(/[\n\r]/g, '')
        .replace(/(\w)\.$/, '$1');

export const deduplicateMessages = (array: CommitMessage[]) => Array.from(new Set(array));

const generateStringFromLength = (length: number) => {
    let result = '';
    const highestTokenChar = 'z';
    for (let i = 0; i < length; i += 1) {
        result += highestTokenChar;
    }
    return result;
};

const getTokens = (prompt: string, model: TiktokenModel) => {
    const encoder = encoding_for_model(model);
    const tokens = encoder.encode(prompt).length;
    // Free the encoder to avoid possible memory leaks.
    encoder.free();
    return tokens;
};

export const generateCommitMessage = async (
    url: string,
    path: string,
    apiKey: string,
    model: TiktokenModel,
    locale: string,
    diff: string,
    completions: number,
    maxLength: number,
    type: CommitType,
    timeout: number,
    maxTokens: number,
    temperature: number,
    prompt: string,
    logging: boolean,
    proxy?: string
) => {
    try {
        const systemPrompt = generateDefaultPrompt(locale, maxLength, type, prompt);

        const completion = await createChatCompletion(
            url,
            path,
            apiKey,
            {
                model,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt,
                    },
                    {
                        role: 'user',
                        content: `Here are diff: ${diff}`,
                    },
                ],
                temperature,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
                max_tokens: maxTokens,
                stream: false,
                n: completions,
            },
            timeout,
            proxy
        );

        const fullText = completion.choices
            .filter(choice => choice.message?.content)
            .map(choice => sanitizeMessage(choice.message!.content as string))
            .join();
        logging && createLogResponse('OPEN AI', diff, systemPrompt, fullText);
        return parseCommitMessage(fullText, type, completions);
    } catch (error) {
        const errorAsAny = error as any;
        if (errorAsAny.code === 'ENOTFOUND') {
            throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall})`);
        }
        throw errorAsAny;
    }
};

const parseCommitMessage = (generatedText: string, type: CommitType, maxCount: number): CommitMessage[] => {
    const jsonPattern = /\[[\s\S]*?\]/;

    try {
        const jsonMatch = generatedText.match(jsonPattern);
        if (!jsonMatch) {
            // No valid JSON array found in the response
            return [];
        }
        const jsonStr = jsonMatch[0];
        const commitMessages: ParsedMessage[] = JSON.parse(jsonStr);
        const filtedMessages = commitMessages
            .filter(data => {
                switch (type) {
                    case 'conventional':
                        return isValidConventionalMessage(data.message);
                    case 'gitmoji':
                        return isValidGitmojiMessage(data.message);
                    default:
                        return true;
                }
            })
            .map((data: ParsedMessage) => {
                return {
                    title: `${data.message}`,
                    value: data.body ? `${data.message}\n\n${data.body}` : `${data.message}`,
                };
            });

        if (filtedMessages.length > maxCount) {
            return filtedMessages.slice(0, maxCount);
        }
        return filtedMessages;
    } catch (e) {
        // Error parsing JSON
        return [];
    }
};
