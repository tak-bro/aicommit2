import { AxiosResponse } from 'axios';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIService, AIServiceParams } from './ai.service.js';
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
        const { locale, generate, type } = this.params.config;
        const maxLength = this.params.config['max-length'];
        const diff = this.params.stagedDiff.diff;
        const prompt = this.buildPrompt(locale, diff, generate, maxLength, type);
        // 1. get all conversationIds
        // const originConversationIds = await this.getAllConversationIds();
        // console.log(originConversationIds);
        const test = await this.sendMessage('test');

        // 2. generate message(send prompt)
        // 3. get all conversations
        // 4. check new conversation ID from first
        // 5. sanitize Message on conversation => [message]
        // 6. delete new conversation Id
        // 7. return meesage

        return ['test: test'];
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

    private async getNewConversationId(): Promise<{ conversationId: string }> {
        const headers = {
            'content-type': 'application/json',
            Cookie: this.cookie,
        };
        const payload = JSON.stringify({ model: this.params.config.HUGGING_MODEL });
        const fetched = await fetch(`https://${this.host}/chat/conversation`, {
            headers: headers,
            body: payload,
            method: 'POST',
        });
        const jsonData = await fetched.json();
        if (!jsonData.conversationId) {
            throw new Error(`No conversationId on Hugging service`);
        }
        return jsonData;
    }

    private async deleteConversation(conversationId: string): Promise<any> {
        const headers = {
            Cookie: this.cookie,
        };
        const deleted = await fetch(`https://${this.host}/chat/conversation/${conversationId}`, {
            method: 'DELETE',
            headers: {
                ...headers,
            },
            body: null,
        });
        return await deleted.text();
    }

    private async sendMessage(message: string) {
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
                Cookie: this.cookie,
            })
            .setBody(form)
            .execute();
        const result = response.data;
        console.log('result', result);
        return 'test';

        // axios({
        //     method: "post",
        //     url: `${this.host}/api/v1/generate`,
        //     data: form2,
        //     responseType: 'stream',
        //     headers: { "Content-Type": "multipart/form-data", Cookie: this.cookie },
        // })
        //     .then(function (response) {
        //         //handle success
        //         console.log(response);
        //     })
        //     .catch(function (response) {
        //         //handle error
        //         console.log(response);
        //     });

        // const result = response.data;
        // console.log(response.data)
        // console.log(result)
        // if (!result) {
        //     throw new Error(`No content on sendMessage ClovaX`);
        // }

        // ------WebKitFormBoundaryeBGJ30Wqm3bZAAnO
        // Content-Disposition: form-data; name="form"; filename="blob"
        // Content-Type: application/json
        //
        // {"text":"bard color  로고 알아?","action":"generate","parentTurnId":"cPFAL2kxnkQ7wIE6SJt2Z","conversationId":"CsJ7vpVkMZgnNUL__Za4X"}
        // ------WebKitFormBoundaryeBGJ30Wqm3bZAAnO--

        // const fetched = await fetch(`https://${this.host}/api/v1/generate`, {
        //     method: 'POST',
        //     headers: {
        //         'content-type': 'application/json',
        //         cookie: this.cookie,
        //     },
        //     body: JSON.stringify({
        //         inputs: message,
        //         parameters: {
        //             temperature: this.params.config.temperature,
        //             truncate: 1000,
        //             max_new_tokens: this.params.config['max-tokens'],
        //             stop: ['</s>'],
        //             top_p: 0.95,
        //             repetition_penalty: 1.2,
        //             top_k: 50,
        //             return_full_text: false,
        //         },
        //         stream: true,
        //         options: {
        //             id: uuidv4(),
        //             response_id: uuidv4(),
        //             is_retry: false,
        //             use_cache: false,
        //             web_search_id: '',
        //         },
        //     }),
        // });
        // return await fetched.text();
    }

    private generateRandomString(length: number): string {
        const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

    private sanitizeMessage(generatedText: string) {
        return generatedText
            .split('\n')
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
}
