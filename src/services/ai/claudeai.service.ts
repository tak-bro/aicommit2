import chalk from 'chalk';
import { catchError, concatMap, from, map, Observable, of } from 'rxjs';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';
import { CommitType } from '../../utils/config.js';
import { KnownError } from '../../utils/error.js';
import { AIFactoryParams, AIService, AIServiceError } from './ai-service.factory.js';
import { httpsGet, httpsPost } from '../../utils/openai.js';
import { v4 as uuidv4 } from 'uuid';
import { generatePrompt } from '../../utils/prompt.js';

export const createAsyncDelay = (duration: number) => {
    return new Promise<void>(resolve => setTimeout(() => resolve(), duration));
};

export class ClaudeAIService extends AIService {
    private requestHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
        'Accept-Language': `en-US,en;q=0.9,ko;q=0.8`,
        Referer: 'https://claude.ai/chats',
        'Content-Type': 'application/json',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        Connection: 'keep-alive',
        Cookie: '', // NOTE: should be set
    };

    constructor(private readonly params: AIFactoryParams) {
        super(params);
        const claudeColors = {
            primary: '#CC9B7A',
        };
        this.serviceName = chalk.bgHex(claudeColors.primary).hex('#000').bold('[ClaudeAI]');
        this.requestHeaders = { ...this.requestHeaders, Cookie: `${this.params.config.CLAUDE_KEY}` };
    }

    generateCommitMessage$(): Observable<ReactiveListChoice> {
        return fromPromise(
            this.generateMessage(
                this.params.config.locale,
                this.params.stagedDiff.diff,
                this.params.config.generate,
                this.params.config['max-length'],
                this.params.config.type,
                this.params.config.proxy
            )
        ).pipe(
            concatMap(messages => from(messages)), // flat messages
            map(message => ({
                name: `${this.serviceName} ${message}`,
                value: message,
                isError: false,
            })),
            catchError(this.handleError$)
        );
    }

    handleError$ = (error: AIServiceError) => {
        const errorAI = chalk.red.bold(`[ClaudeAI]`);
        let simpleMessage = 'An error occurred';
        if (error.message) {
            simpleMessage = error.message;
        }
        return of({
            name: `${errorAI} ${simpleMessage}`,
            value: simpleMessage,
            isError: true,
        });
    };

    private generateClaudePrompt(
        locale: string,
        diff: string,
        completions: number,
        maxLength: number,
        type: CommitType
    ) {
        const defaultPrompt = generatePrompt(locale, maxLength, type);
        return `${defaultPrompt}\nPlease just generate at least ${completions} messages. No other explanation needed. Here Diff: \n${diff}`;
    }

    private async sanitizeMessage(message: string): Promise<string[]> {
        // remove completion
        const regexCompletion = /"completion":"([^"]*)"/g;
        const matchesCompletion = message.match(regexCompletion);
        if (!matchesCompletion) {
            throw new Error('1Failed to Sanitize Message');
        }
        const claudeMessage = matchesCompletion
            .map(match => match.split('"completion":')[1].replace(/"/g, ''))
            .join('');
        // claudeMessage
        // Here are 2 commit message options for the provided diff:\n\n1. test(claudeai): add hardcoded values for testing\n2. chore(claudeai): temporarily use demo values\n\nI chose:\n\n- \test\ because hardcoded values can help facilitate testing\n- \chore\ because using demo values can be considered a code maintenance task\n\nThe scope \claudeai\ indicates the changes are isolated to that service.\n\nThe messages follow the provided <type>(<scope>): <description> format.

        // original message
        const regex = /\d+\.\s(.*?)(?=\n\d+\.|\n\n|$)/g;
        const matches = claudeMessage.match(regex);
        if (!matches) {
            throw new Error('2Failed to Sanitize Message');
        }
        // remove 1., 2.
        const result = matches
            .map(item => {
                const removeDigitRegex = /\d+\.\s*(.*)/;
                const removedMatch = item.match(removeDigitRegex);
                if (!removedMatch || removedMatch.length === 0) {
                    return '';
                }
                return removedMatch[1] || '';
            })
            .filter(data => !!data);

        if (result.length === 0) {
            throw new Error('3Failed to Sanitize Message');
        }
        return result;
    }

    private async generateMessage(
        locale: string,
        diff: string,
        completions: number,
        maxLength: number,
        type: CommitType,
        proxy?: string
    ) {
        try {
            return ['refactor(claudeai): extract prompt generation', 'refactor(claudeai): simplify message parsing'];
            const organizationId = await this.getOrganizationId();
            const conversationId = await this.getConversationId(organizationId);
            const prompt = this.generateClaudePrompt(locale, diff, completions, maxLength, type);
            const response = await this.sendPrompt(prompt, organizationId, conversationId);
            const sanitizeMessage = await this.sanitizeMessage(`${response}`);
            return sanitizeMessage;
        } catch (error) {
            const errorAsAny = error as any;
            if (errorAsAny.code === 'ENOTFOUND') {
                throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall})`);
            }
            throw errorAsAny;
        }
    }

    private async getOrganizationId(): Promise<string> {
        const result = await httpsGet(
            'claude.ai',
            '/api/organizations',
            this.requestHeaders,
            this.params.config.timeout,
            this.params.config.proxy
        );
        const data = JSON.parse(result.data);
        if (data.error) {
            const { type, message } = data.error;
            throw new KnownError(`${type} ${message}`);
        }
        const noUUID = !data || data.length === 0 || !data[0].uuid;
        if (noUUID) {
            throw new Error('Invalid UUID on Claude AI');
        }
        return data[0].uuid;
    }

    private async getConversationId(organizationId: string) {
        const conversations = await this.getAllConversations(organizationId);
        const noConversation = !conversations || conversations.length === 0;
        if (noConversation) {
            const newConversation = await this.createNewConversation(organizationId);
            return newConversation.uuid;
        }
        return conversations[0].uuid;
    }

    private async getAllConversations(organizationId: string): Promise<{ uuid: string }[]> {
        const headers = {
            ...this.requestHeaders,
            'Sec-Fetch-Dest': 'empty',
        };
        const result = await httpsGet(
            'claude.ai',
            `/api/organizations/${organizationId}/chat_conversations`,
            headers,
            this.params.config.timeout,
            this.params.config.proxy
        );
        const data = JSON.parse(result.data);
        if (data.error) {
            const { type, message } = data.error;
            throw new KnownError(`${type} ${message}`);
        }
        return data;
    }

    private async createNewConversation(organizationId: string): Promise<{ uuid: string }> {
        const headers = {
            ...this.requestHeaders,
            Origin: 'https://claude.ai',
            DNT: '1',
            'Sec-Fetch-Dest': 'empty',
            TE: 'trailers',
        };
        const payload = JSON.stringify({ uuid: this.generateUUID(), name: '' });
        const result = await httpsPost(
            'claude.ai',
            `/api/organizations/${organizationId}/chat_conversations`,
            headers,
            payload,
            this.params.config.timeout
        );
        const data = JSON.parse(result.data);
        if (data.error) {
            const { type, message } = data.error;
            throw new KnownError(`${type} ${message}`);
        }
        return data;
    }

    private async sendPrompt(prompt: string, organizationId: string, conversationId: string) {
        const headers: any = {
            ...this.requestHeaders,
            Accept: `text/event-stream, text/event-stream`,
            'Accept-Encoding': `gzip, deflate, br`,
            'Cache-Control': `no-cache`,
            Origin: `https://claude.ai`,
            'Sec-Fetch-Dest': `empty`,
        };
        const body = {
            prompt: prompt,
            attachments: [],
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            model: 'claude-2.1',
        };

        const result = await httpsPost(
            'claude.ai',
            `/api/organizations/${organizationId}/chat_conversations/${conversationId}/completion`,
            headers,
            body,
            this.params.config.timeout,
            this.params.config.proxy
        );

        const isError = result.data.includes(`"type":"error"`);
        if (isError) {
            const errorData = JSON.parse(result.data);
            const {
                error: { type, message },
            } = errorData;
            throw new KnownError(`${type} - ${message}`);
        }
        return result.data;
    }

    private generateUUID() {
        const id = uuidv4();
        return `${id.slice(0, 8)}-${id.slice(9, 13)}-${id.slice(14, 18)}-${id.slice(19, 23)}-${id.slice(24)}`;
    }
}
