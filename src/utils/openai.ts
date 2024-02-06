import https from 'https';

import {
    type TiktokenModel,
    encoding_for_model,
    // encoding_for_model,
} from '@dqbd/tiktoken';
import createHttpsProxyAgent from 'https-proxy-agent';

import { KnownError } from './error.js';
import { generatePrompt, isValidConventionalMessage, isValidGitmojiMessage } from './prompt.js';

import type { CommitType } from './config.js';
import type { ClientRequest, IncomingMessage } from 'http';
import type { CreateChatCompletionRequest, CreateChatCompletionResponse } from 'openai';

export const httpsGet = async (
    hostname: string,
    path: string,
    headers: Record<string, string>,
    timeout: number,
    proxy?: string
) =>
    new Promise<{
        request: ClientRequest;
        response: IncomingMessage;
        data: string;
    }>((resolve, reject) => {
        const request = https.request(
            {
                hostname,
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
            reject(
                new KnownError(`Time out error: request took over ${timeout}ms. Try increasing the \`timeout\` config`)
            );
        });
        request.end();
    });

export const httpsPost = async (
    hostname: string,
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
        const request = https.request(
            {
                port: port ? port : undefined,
                hostname,
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
            reject(
                new KnownError(`Time out error: request took over ${timeout}ms. Try increasing the \`timeout\` config`)
            );
        });

        request.write(postContent);
        request.end();
    });

const createChatCompletion = async (
    apiKey: string,
    json: CreateChatCompletionRequest,
    timeout: number,
    proxy?: string
) => {
    const { response, data } = await httpsPost(
        'api.openai.com',
        '/v1/chat/completions',
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

export const deduplicateMessages = (array: string[]) => Array.from(new Set(array));

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
    proxy?: string
) => {
    try {
        const completion = await createChatCompletion(
            apiKey,
            {
                model,
                messages: [
                    {
                        role: 'system',
                        content: generatePrompt(locale, maxLength, type),
                    },
                    {
                        role: 'user',
                        content: diff,
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

        return deduplicateMessages(
            completion.choices
                .filter(choice => choice.message?.content)
                .map(choice => sanitizeMessage(choice.message!.content))
                .map(message => {
                    if (type === 'conventional') {
                        const regex = /: (\w)/;
                        return message.replace(
                            regex,
                            (_: any, firstLetter: string) => `: ${firstLetter.toLowerCase()}`
                        );
                    }
                    return message;
                })
                .filter((message: string) => {
                    switch (type) {
                        case 'gitmoji':
                            return isValidGitmojiMessage(message);
                        case 'conventional':
                            return isValidConventionalMessage(message);
                        case '':
                        default:
                            return true;
                    }
                })
        );
    } catch (error) {
        const errorAsAny = error as any;
        if (errorAsAny.code === 'ENOTFOUND') {
            throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall})`);
        }
        throw errorAsAny;
    }
};
