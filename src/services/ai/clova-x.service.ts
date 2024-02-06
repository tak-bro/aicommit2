import { AxiosResponse } from 'axios';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIService, AIServiceParams } from './ai.service.js';
import { hasOwn } from '../../utils/config.js';
import { KnownError } from '../../utils/error.js';
import { deduplicateMessages } from '../../utils/openai.js';
import { isValidConventionalMessage, isValidGitmojiMessage } from '../../utils/prompt.js';
import { HttpRequestBuilder } from '../http/http-request.builder.js';


export interface ClovaXConversationContent {
    conversationId: string;
    title: string;
    createdTime: string;
    updatedTime?: string;
    botTurnText?: string;
    turnUpdatedTime?: string;
}

export interface ClovaXConversationResponse {
    content?: ClovaXConversationContent[];
    totalElements: number;
    page: number;
    size: number;
}

export class ClovaXService extends AIService {
    private host = `https://clova-x.naver.com`;
    private cookie = ``;

    constructor(private readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#00db9b',
            secondary: '#fff',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold('[CLOVA X]');
        this.errorPrefix = chalk.red.bold(`[CLOVA X]`);
        this.cookie = this.params.config.CLOVAX_COOKIE;
    }

    generateCommitMessage$(): Observable<ReactiveListChoice> {
        return fromPromise(this.generateMessage()).pipe(
            concatMap(messages => from(messages)),
            map(message => ({
                name: `${this.serviceName} ${message}`,
                value: message,
                isError: false,
            })),
            catchError(this.handleError$)
        );
    }

    private async generateMessage(): Promise<string[]> {
        try {
            const { locale, generate, type } = this.params.config;
            const maxLength = this.params.config['max-length'];
            const diff = this.params.stagedDiff.diff;
            const prompt = this.buildPrompt(locale, diff, generate, maxLength, type);
            await this.getAllConversationIds();
            const result = await this.sendMessage(prompt);
            const { conversationId, allText } = this.parseSendMessageResult(result);
            await this.deleteConversation(conversationId);
            return deduplicateMessages(this.sanitizeMessage(allText));
        } catch (error) {
            const errorAsAny = error as any;
            if (errorAsAny.code === 'ENOTFOUND') {
                throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall})`);
            }
            throw errorAsAny;
        }
    }

    private async getAllConversationIds(): Promise<string[]> {
        const response: AxiosResponse<ClovaXConversationResponse> = await new HttpRequestBuilder({
            method: 'GET',
            baseURL: `${this.host}/api/v1/conversations`,
            timeout: this.params.config.timeout,
        })
            .setHeaders({ Cookie: this.cookie })
            .setParams({ page: 0, size: 50, sort: `turnUpdatedTime,DESC` })
            .execute();
        const result = response.data;
        if (!result || !result.content) {
            throw new Error(`No content on conversations ClovaX`);
        }
        const hasNoConversations = result.content.length === 0;
        if (hasNoConversations) {
            return [];
        }
        return result.content.map(data => data.conversationId || '').filter(id => !!id);
    }

    private async deleteConversation(conversationId: string): Promise<any> {
        const response = await new HttpRequestBuilder({
            method: 'DELETE',
            baseURL: `${this.host}/api/v1/conversation/${conversationId}`,
            timeout: this.params.config.timeout,
        })
            .setHeaders({ Cookie: this.cookie })
            .execute();

        return response.data;
    }

    private async sendMessage(message: string): Promise<string> {
        const data = { text: message, action: 'new' };
        const form = new FormData();
        form.append('form', new Blob([JSON.stringify(data)], { type: 'application/json' }));

        const response = await new HttpRequestBuilder({
            method: 'POST',
            baseURL: `${this.host}/api/v1/generate`,
            timeout: this.params.config.timeout,
        })
            .setHeaders({
                'Content-Type': 'multipart/form-data',
                'Content-Length': this.getContentLength(form),
                Cookie: this.cookie,
            })
            .setBody(form)
            .execute();
        return response.data as string;
    }

    private parseSendMessageResult(generatedText: string): { conversationId: string; allText: string } {
        const regex = /data:{(.*)}/g; // data 이후 {} 형태의 텍스트만 추출
        const extracted = generatedText.match(regex);
        if (!extracted) {
            throw new Error('Failed to extract object from generated text');
        }
        const jsonStringData = extracted.map(data => data.trim().replace(/data:/g, '')); // remove 'data:'
        if (!jsonStringData || jsonStringData.length === 0) {
            throw new Error(`Cannot extract message`);
        }
        let conversationId = '';
        let allText = '';
        jsonStringData
            .map(data => {
                try {
                    return JSON.parse(data);
                } catch (e) {
                    /* empty */
                    return null;
                }
            })
            .filter(data => !!data)
            .forEach(data => {
                if (hasOwn(data, 'conversationId')) {
                    conversationId = data.conversationId;
                    return;
                }
                if (hasOwn(data, 'text')) {
                    allText += data.text;
                    return;
                }
            });
        if (!conversationId) {
            throw new Error(`No conversationId!`);
        }
        if (!allText) {
            throw new Error(`No allText!`);
        }
        return { conversationId, allText };
    }

    private sanitizeMessage(generatedText: string) {
        return generatedText
            .split('\n')
            .map((message: string) => message.trim().replace(/^\d+\.\s/, ''))
            .map((message: string) => {
                // lowercase
                if (this.params.config.type === 'conventional') {
                    const regex = /: (\w)/;
                    return message.replace(regex, (_: any, firstLetter: string) => `: ${firstLetter.toLowerCase()}`);
                }
                return message;
            })
            .filter((message: string) => {
                switch (this.params.config.type) {
                    case 'gitmoji':
                        return isValidGitmojiMessage(message);
                    case 'conventional':
                        return isValidConventionalMessage(message);
                    case '':
                    default:
                        return true;
                }
            });
    }

    private getContentLength(formData: FormData) {
        return Array.from(formData.entries(), ([key, prop]) => ({
            [key]: { ContentLength: typeof prop === 'string' ? prop.length : prop.size },
        }));
    }
}
