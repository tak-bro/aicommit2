import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';
import { v4 as uuidv4 } from 'uuid';

import { AIService, AIServiceParams } from './ai.service.js';
import { hasOwn } from '../../utils/config.js';
import { KnownError } from '../../utils/error.js';
import { deduplicateMessages, httpsGet } from '../../utils/openai.js';
import { isValidConventionalMessage, isValidGitmojiMessage } from '../../utils/prompt.js';

export class HuggingService extends AIService {
    private hostname = `huggingface.co`;
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
            map(message => ({
                name: `${this.serviceName} ${message}`,
                value: message,
                isError: false,
            })),
            catchError(this.handleError$)
        );
    }

    private async generateMessage(): Promise<string[]> {
        return ['test: test'];
        try {
            const { locale, generate, type } = this.params.config;
            const maxLength = this.params.config['max-length'];
            const diff = this.params.stagedDiff.diff;
            const prompt = this.buildPrompt(locale, diff, generate, maxLength, type);
            const { conversationId } = await this.getNewConversationId();
            await this.prepareConversation(conversationId);
            const generatedText = await this.sendMessage(conversationId, prompt);
            await this.deleteConversation(conversationId);
            return deduplicateMessages(this.sanitizeMessage(generatedText));
        } catch (error) {
            const errorAsAny = error as any;
            if (errorAsAny.code === 'ENOTFOUND') {
                throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall})`);
            }
            throw errorAsAny;
        }
    }

    private sanitizeMessage(generatedText: string) {
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
        return finalAnswerObj.text
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

    // for the 1st chat, the conversation needs to be summarized.
    private async prepareConversation(conversationId: string, end: string = '11') {
        const headers = {
            Cookie: this.cookie,
        };
        return httpsGet(
            this.hostname,
            `/chat/conversation/${conversationId}/__data.json?x-sveltekit-invalidated=${end}`,
            headers,
            this.params.config.timeout,
            this.params.config.proxy
        );
    }

    private async getNewConversationId(): Promise<{ conversationId: string }> {
        const headers = {
            'content-type': 'application/json',
            Cookie: this.cookie,
        };
        const payload = JSON.stringify({ model: this.params.config.HUGGING_MODEL });
        const fetched = await fetch(`https://${this.hostname}/chat/conversation`, {
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
        const deleted = await fetch(`https://${this.hostname}/chat/conversation/${conversationId}`, {
            method: 'DELETE',
            headers: {
                ...headers,
            },
            body: null,
        });
        return await deleted.text();
    }

    private async sendMessage(conversationId: string, message: string) {
        const fetched = await fetch(`https://${this.hostname}/chat/conversation/${conversationId}`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                cookie: this.cookie,
            },
            body: JSON.stringify({
                inputs: message,
                parameters: {
                    temperature: this.params.config.temperature,
                    truncate: 1000,
                    max_new_tokens: this.params.config['max-tokens'],
                    stop: ['</s>'],
                    top_p: 0.95,
                    repetition_penalty: 1.2,
                    top_k: 50,
                    return_full_text: false,
                },
                stream: true,
                options: {
                    id: uuidv4(),
                    response_id: uuidv4(),
                    is_retry: false,
                    use_cache: false,
                    web_search_id: '',
                },
            }),
        });
        return await fetched.text();
    }
}
