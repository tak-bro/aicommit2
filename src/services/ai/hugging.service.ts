import { AxiosResponse } from 'axios';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIService, AIServiceParams } from './ai.service.js';
import { CommitType, hasOwn } from '../../utils/config.js';
import { KnownError, createErrorLog } from '../../utils/error.js';
import { deduplicateMessages } from '../../utils/openai.js';
import { HttpRequestBuilder } from '../http/http-request.builder.js';

export class HuggingService extends AIService {
    private host = `https://huggingface.co`;
    private cookie = ``;

    constructor(private readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#FED21F',
            secondary: '#000',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold('[HuggingFace]');
        this.errorPrefix = chalk.red.bold(`[HuggingFace]`);
        this.cookie = this.params.config.HUGGING_COOKIE;
    }

    generateCommitMessage$(): Observable<ReactiveListChoice> {
        return fromPromise(this.generateMessage()).pipe(
            concatMap(messages => from(messages)),
            map((message, index) => ({
                name: `${this.serviceName} ${message}`,
                value: message,
                isError: false,
            })),
            catchError(this.handleError$)
        );
    }

    private async generateMessage(): Promise<string[]> {
        try {
            const { locale, generate, type, prompt: userPrompt, ERROR_LOGGING } = this.params.config;
            const maxLength = this.params.config['max-length'];
            const diff = this.params.stagedDiff.diff;
            const prompt = this.buildPrompt(locale, diff, generate, maxLength, type, userPrompt);

            await this.prepareNewConversation();
            const { conversationId } = await this.getNewConversationId();
            await this.prepareConversationEvent(conversationId);
            const { lastMessageId } = await this.getConversationInfo(conversationId);
            const generatedText = await this.sendMessage(conversationId, prompt, lastMessageId);
            await this.deleteConversation(conversationId);

            const resultMessages = deduplicateMessages(
                this.sanitizeHuggingMessage(generatedText, this.params.config.type, generate)
            );
            const noMessages = !resultMessages || resultMessages.length === 0;
            if (noMessages && ERROR_LOGGING) {
                createErrorLog('HuggingFace', diff, generatedText);
            }
            return resultMessages;
        } catch (error) {
            const errorAsAny = error as any;
            if (errorAsAny.code === 'ENOTFOUND') {
                throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall})`);
            }
            throw errorAsAny;
        }
    }

    private sanitizeHuggingMessage(generatedText: string, type: CommitType, maxCount: number) {
        const regex = /{[^{}]*}/g;
        const extractedObjects = generatedText.match(regex);
        if (!extractedObjects) {
            throw new Error('Failed to extract object from generated text');
        }
        let finalAnswerObj: any = null;
        extractedObjects.forEach((obj, index) => {
            try {
                const parsedObj = JSON.parse(obj);
                if (hasOwn(parsedObj, 'type') && parsedObj.type === 'finalAnswer') {
                    finalAnswerObj = parsedObj;
                }
            } catch (error) {
                /* empty */
            }
        });
        if (!finalAnswerObj || !hasOwn(finalAnswerObj, 'text')) {
            throw new Error(`Cannot parse finalAnswer`);
        }
        return this.sanitizeMessage(finalAnswerObj['text'], type, maxCount);
    }

    private async prepareNewConversation() {
        const response = await new HttpRequestBuilder({
            method: 'POST',
            baseURL: `${this.host}/api/event`,
        })
            .setHeaders({
                'content-type': 'application/json',
                Cookie: this.cookie,
            })
            .setBody({
                d: 'huggingface.co',
                n: 'pageview',
                r: 'https://huggingface.co/chat/',
                u: 'https://huggingface.co/chat/',
            })
            .execute();
        return response.data;
    }

    private async prepareConversationEvent(conversationId: string) {
        const response = await new HttpRequestBuilder({
            method: 'POST',
            baseURL: `${this.host}/api/event`,
        })
            .setHeaders({
                'content-type': 'application/json',
                Cookie: this.cookie,
            })
            .setBody({
                d: 'huggingface.co',
                n: 'pageview',
                r: 'https://huggingface.co/chat/',
                u: `https://huggingface.co/chat/conversation/${conversationId}`,
            })
            .execute();
        return response.data;
    }

    private async getNewConversationId(): Promise<{ conversationId: string }> {
        const response: AxiosResponse<{ conversationId: string }> = await new HttpRequestBuilder({
            method: 'POST',
            baseURL: `${this.host}/chat/conversation`,
            timeout: this.params.config.timeout,
        })
            .setHeaders({
                'content-type': 'application/json',
                Cookie: this.cookie,
                Accept: '*/*',
                Connection: 'keep-alive',
                Host: 'huggingface.co',
                Origin: 'https://huggingface.co',
            })
            .setBody({
                model: this.params.config.HUGGING_MODEL,
                preprompt: '',
            })
            .execute();

        if (!response.data || !response.data.conversationId) {
            throw new Error(`No conversationId on Hugging service`);
        }
        return response.data;
    }

    private async getConversationInfo(
        conversationId: string
    ): Promise<{ conversationInfo: any; lastMessageId: string }> {
        const response: AxiosResponse<any> = await new HttpRequestBuilder({
            method: 'GET',
            baseURL: `${this.host}/chat/conversation/${conversationId}/__data.json`,
            timeout: this.params.config.timeout,
        })
            .setParams({ 'x-sveltekit-invalidated': '11' })
            .setHeaders({
                'Content-Type': 'application/json',
                Cookie: this.cookie,
                Accept: '*/*',
                Connection: 'keep-alive',
                Referer: 'https://huggingface.co/chat/',
            })
            .execute();

        const conversationInfo = response.data;
        const hasNoNodes = !conversationInfo || !conversationInfo.nodes || conversationInfo.nodes.length === 0;
        if (hasNoNodes) {
            throw new Error(`No Nodes on conversation info`);
        }
        const noData =
            !conversationInfo.nodes[1] ||
            !conversationInfo.nodes[1].data ||
            conversationInfo.nodes[1].data.length === 0 ||
            !conversationInfo.nodes[1].data[3];
        if (noData) {
            throw new Error(`No data on node`);
        }
        const lastMessageId = conversationInfo.nodes[1]?.data[3];
        return { conversationInfo, lastMessageId };
    }

    private async deleteConversation(conversationId: string): Promise<any> {
        await new HttpRequestBuilder({
            method: 'DELETE',
            baseURL: `${this.host}/chat/conversation/${conversationId}`,
            timeout: this.params.config.timeout,
        })
            .setHeaders({ Cookie: this.cookie })
            .execute();

        const updateChat = await new HttpRequestBuilder({
            method: 'GET',
            baseURL: `${this.host}/chat/__data.json`,
            timeout: this.params.config.timeout,
        })
            .setParams({ 'x-sveltekit-trailing-slash': '1', 'x-sveltekit-invalidated': '10' })
            .setHeaders({
                'Content-Type': 'application/json',
                Cookie: this.cookie,
                Accept: '*/*',
                Connection: 'keep-alive',
                Referer: 'https://huggingface.co/chat/',
            })
            .execute();

        return updateChat.data;
    }

    private async sendMessage(conversationId: string, message: string, id: string) {
        const response: AxiosResponse<string> = await new HttpRequestBuilder({
            method: 'POST',
            baseURL: `${this.host}/chat/conversation/${conversationId}`,
            timeout: this.params.config.timeout,
        })
            .setHeaders({
                'content-type': 'application/json',
                Cookie: this.cookie,
                authority: 'huggingface.co',
                accept: '*/*',
                origin: 'https://huggingface.co',
            })
            .setBody({
                files: [],
                id,
                inputs: message,
                is_continue: false,
                is_retry: false,
                use_cache: false,
            })
            .execute();

        return response.data;
    }
}
