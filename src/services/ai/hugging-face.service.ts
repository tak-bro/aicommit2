import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { RequestType, logAIComplete, logAIError, logAIPrompt, logAIRequest, logAIResponse } from '../../utils/ai-log.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt } from '../../utils/prompt.js';

interface Conversation {
    id: string;
    model: string;
    systemPrompt: string;
    title: string;
    history: History[];
}

interface History {
    id: string;
    role: string;
    content: string;
    createdAt: number;
    updatedAt: number;
}

interface Model {
    id: string | null;
    name: string | null;
    displayName: string | null;
    preprompt: string | null;
    promptExamples: { title: string; prompt: string }[];
    websiteUrl: string | null;
    description: string | null;
    datasetName: string | null;
    datasetUrl: string | null;
    modelUrl: string | null;
    parameters: { [key: string]: any };
}

interface ChatResponse {
    id: string | undefined;
    stream: ReadableStream | undefined;
    completeResponsePromise: () => Promise<string>;
}

// refer: https://github.com/rahulsushilsharma/huggingface-chat
export class HuggingFaceService extends AIService {
    private headers: Record<string, string> = {};
    private models: Model[] = [];
    private currentModel: Model | undefined;
    private currentModelId: string | null = null;
    private currentConversation: Conversation | undefined = undefined;
    private currentConversionID: string | undefined = undefined;
    private cookie = '';

    constructor(protected readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#FED21F',
            secondary: '#000',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold('[HuggingFace]');
        this.errorPrefix = chalk.red.bold(`[HuggingFace]`);
        this.cookie = this.params.config.cookie;

        const baseUrl = this.params.config.url || 'https://huggingface.co';
        this.headers = {
            accept: '*/*',
            'accept-language': 'en-US,en;q=0.9',
            'sec-ch-ua': '"Chromium";v="116", "Not)A;Brand";v="24", "Google Chrome";v="116"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            origin: baseUrl,
            'Referrer-Policy': 'strict-origin-when-cross-origin',
        };
    }

    protected getServiceSpecificErrorMessage(error: AIServiceError): string | null {
        const errorMsg = error.message || '';

        // Hugging Face-specific error messages
        if (errorMsg.includes('cookie') || errorMsg.includes('Cookie')) {
            return 'Invalid cookie. Check your Hugging Face session cookie in configuration';
        }
        if (errorMsg.includes('model') || errorMsg.includes('Model')) {
            return 'Model not found or not accessible. Check if the Hugging Face model name is correct';
        }
        if (errorMsg.includes('conversation') || errorMsg.includes('conversion')) {
            return 'Failed to create conversation. Try again or check your session';
        }
        if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
            return 'Authentication failed. Your Hugging Face session may have expired';
        }
        if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
            return 'Access denied. You may not have permission to access this model';
        }
        if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
            return 'Model not found. Check your Hugging Face model configuration';
        }
        if (errorMsg.includes('500') || errorMsg.includes('Internal Server Error')) {
            return 'Hugging Face server error. Try again later';
        }
        if (errorMsg.includes('overloaded') || errorMsg.includes('capacity')) {
            return 'Hugging Face service is overloaded. Try again in a few minutes';
        }

        return null;
    }

    generateCommitMessage$(): Observable<ReactiveListChoice> {
        return fromPromise(this.generateMessage('commit')).pipe(
            concatMap(messages => from(messages)),
            map(data => ({
                name: `${this.serviceName} ${data.title}`,
                short: data.title,
                value: this.params.config.includeBody ? data.value : data.title,
                description: this.params.config.includeBody ? data.value : '',
                isError: false,
            })),
            catchError(this.handleError$)
        );
    }

    generateCodeReview$(): Observable<ReactiveListChoice> {
        return fromPromise(this.generateMessage('review')).pipe(
            concatMap(messages => from(messages)),
            map(data => ({
                name: `${this.serviceName} ${data.title}`,
                short: data.title,
                value: data.value,
                description: data.value,
                isError: false,
            })),
            catchError(this.handleError$)
        );
    }

    private async generateMessage(requestType: RequestType): Promise<AIResponse[]> {
        await this.initialize();

        const diff = this.params.stagedDiff.diff;
        const {
            systemPrompt,
            systemPromptPath,
            codeReviewPromptPath,
            logging,
            locale,
            generate,
            type,
            maxLength,
            temperature,
            maxTokens,
            topP,
            timeout,
        } = this.params.config;
        const promptOptions: PromptOptions = {
            ...DEFAULT_PROMPT_OPTIONS,
            locale,
            maxLength,
            type,
            generate,
            systemPrompt,
            systemPromptPath,
            codeReviewPromptPath,
        };
        const generatedSystemPrompt = requestType === 'review' ? codeReviewPrompt(promptOptions) : generatePrompt(promptOptions);

        const userPrompt = `Here is the diff: ${diff}`;
        const baseUrl = this.params.config.url || 'https://huggingface.co';
        const url = `${baseUrl}/chat/conversation`;
        const headers = { ...this.headers, cookie: this.cookie };

        // 상세 로깅
        logAIRequest(diff, requestType, 'HuggingFace', this.params.config.model, url, headers, logging);
        logAIPrompt(diff, requestType, 'HuggingFace', generatedSystemPrompt, userPrompt, logging);

        const startTime = Date.now();

        try {
            const conversation = await this.getNewChat(generatedSystemPrompt);
            const data = await this.sendMessage(userPrompt, conversation.id);
            const response = await data.completeResponsePromise();
            await this.deleteConversation(conversation.id);

            const duration = Date.now() - startTime;
            logAIResponse(diff, requestType, 'HuggingFace', { response }, logging);
            logAIComplete(diff, requestType, 'HuggingFace', duration, response, logging);

            if (requestType === 'review') {
                return this.sanitizeResponse(response);
            }
            return this.parseMessage(response, type, generate);
        } catch (error) {
            const duration = Date.now() - startTime;
            logAIError(diff, requestType, 'HuggingFace', error, logging);
            throw error;
        }
    }

    /**
     * Initializes the ChatBot instance.
     * @async
     * @returns {Promise<void>}
     */
    private async initialize(): Promise<void> {
        const models = await this.getRemoteLlms();
        const model = models.find(model => model.name?.toLowerCase() === this.params.config.model.toLowerCase())!;
        if (model) {
            this.currentModel = model;
            this.currentModelId = model.id;
            return;
        }
        this.currentModel = models[0];
        this.currentModelId = models[0].id;
    }

    /**
     * Fetches remote LLMs from a server.
     * @returns {Promise<Model[]>} A promise that resolves to an array of fetched conversations.
     * @throws {Error} If the server response is not successful.
     */
    private async getRemoteLlms(): Promise<Model[]> {
        const baseUrl = this.params.config.url || 'https://huggingface.co';
        const response = await fetch(`${baseUrl}/chat/__data.json`, {
            headers: {
                ...this.headers,
                cookie: this.cookie,
            },
            body: null,
            method: 'GET',
        });

        if (response.status !== 200) {
            throw new Error(`Failed to get remote LLMs with status code: ${response.status}`);
        }
        const json = await response.json();
        const data = json.nodes[0].data;
        const modelsIndices = data[data[0].models];
        const modelList: Model[] = [];

        const returnDataFromIndex = (index: number): any => (index === -1 ? null : data[index]);

        for (const modelIndex of modelsIndices) {
            const modelData = data[modelIndex];

            // Model is unlisted, skip it
            if (data[modelData.unlisted]) {
                continue;
            }

            const m: Model = {
                id: returnDataFromIndex(modelData.id),
                name: returnDataFromIndex(modelData.name),
                displayName: returnDataFromIndex(modelData.displayName),
                preprompt: returnDataFromIndex(modelData.preprompt),
                promptExamples: [],
                websiteUrl: returnDataFromIndex(modelData.websiteUrl),
                description: returnDataFromIndex(modelData.description),
                datasetName: returnDataFromIndex(modelData.datasetName),
                datasetUrl: returnDataFromIndex(modelData.datasetUrl),
                modelUrl: returnDataFromIndex(modelData.modelUrl),
                parameters: {},
            };

            const promptList = returnDataFromIndex(modelData.promptExamples);
            if (promptList !== null) {
                const _promptExamples = promptList.map((index: number) => returnDataFromIndex(index));
                m.promptExamples = _promptExamples.map((prompt: any) => ({
                    title: data[prompt.title],
                    prompt: data[prompt.prompt],
                }));
            }

            const indicesParametersDict: { [key: string]: number } = returnDataFromIndex(modelData.parameters);
            const outParametersDict: { [key: string]: any } = {};
            for (const [key, value] of Object.entries(indicesParametersDict)) {
                if (value === -1) {
                    outParametersDict[key] = null;
                    continue;
                }

                if (Array.isArray(data[value])) {
                    outParametersDict[key] = data[value].map((index: number) => data[index]);
                    continue;
                }

                outParametersDict[key] = data[value];
            }
            m.parameters = outParametersDict;
            modelList.push(m);
        }
        this.models = modelList;

        return modelList;
    }

    /**
     * Initializes a new chat conversation.
     * @returns {Promise<Conversation>} The conversation ID of the new chat.
     * @throws {Error} If the creation of a new conversation fails.
     */
    private async getNewChat(systemPrompt?: string): Promise<Conversation> {
        const model = {
            model: this.currentModelId,
            preprompt: systemPrompt,
        };
        let retry = 0;
        const baseUrl = this.params.config.url || 'https://huggingface.co';
        while (retry < 5) {
            const response = await fetch(`${baseUrl}/chat/conversation`, {
                headers: {
                    ...this.headers,
                    'content-type': 'application/json',
                    cookie: this.cookie,
                    Referer: `${baseUrl}/chat/`,
                },
                body: JSON.stringify(model),
                method: 'POST',
            });

            const { conversationId } = await response.json();

            if (conversationId) {
                this.currentConversionID = conversationId;
                break;
            } else {
                // console.error(`Failed to create new conversation error ${response.statusText}, retrying...`);
                retry++;
            }
        }

        if (!this.currentConversionID) {
            throw new Error('Failed to create new conversion');
        }

        return await this.getConversationHistory(this.currentConversionID);
    }

    /**
     * get the details of current conversation
     * @returns {Promise<Conversation>} A Promise that return conversation details
     * @throws {Error} If there is an api error
     */
    private async getConversationHistory(conversationId: string) {
        if (!conversationId) {
            throw new Error('conversationId is required for getConversationHistory');
        }
        const baseUrl = this.params.config.url || 'https://huggingface.co';
        const response = await fetch(`${baseUrl}/chat/conversation/${conversationId}/__data.json`, {
            headers: {
                ...this.headers,
                cookie: this.cookie,
                Referer: `${baseUrl}/chat/`,
            },
            body: null,
            method: 'GET',
        });

        if (response.status != 200) {
            throw new Error('Unable get conversation details ' + response);
        } else {
            const json = await response.json();
            return this.metadataParser(json, conversationId);
        }
    }

    private metadataParser(meta: Record<string, any>, conversationId: string) {
        const conversation: Conversation = {
            id: '',
            model: '',
            systemPrompt: '',
            title: '',
            history: [],
        };
        const data: any = meta.nodes[1].data;
        const model = data[data[0].model];
        const systemPrompt = data[data[0].preprompt];
        const title = data[data[0].title];

        const messages: any[] = data[data[0].messages];
        const history: any[] = [];

        for (const index of messages) {
            const nodeMeta = data[index];
            const createdAt = new Date(data[nodeMeta.createdAt][1]).getTime() / 1000;
            const updatedAt = new Date(data[nodeMeta.updatedAt][1]).getTime() / 1000;

            history.push({
                id: data[nodeMeta.id],
                role: data[nodeMeta.from],
                content: data[nodeMeta.content],
                createdAt,
                updatedAt,
            });
        }

        conversation.id = conversationId;
        conversation.model = model;
        conversation.systemPrompt = systemPrompt;
        conversation.title = title;
        conversation.history = history;
        this.currentConversation = conversation;
        return conversation;
    }

    /**
     * Initiates a chat with the provided text.
     * @param {string} text - The user's input text or prompt.
     * @param {string} currentConversionId - The conversation ID for the current chat.
     * @returns {Promise<ChatResponse>} An object containing conversation details.
     * @throws {Error} If there is an issue with the chat request.
     */
    private async sendMessage(text: string, currentConversionId?: string): Promise<ChatResponse> {
        if (text === '') {
            throw new Error('the prompt can not be empty.');
        }

        if (!currentConversionId && !this.currentConversionID) {
            await this.getNewChat(); // if no chat is available
        } else if (currentConversionId) {
            this.currentConversionID = currentConversionId;
            await this.getConversationHistory(currentConversionId);
        } else if (this.currentConversionID) {
            await this.getConversationHistory(this.currentConversionID);
        }

        if (!this.currentConversation) {
            throw new Error('Failed to create new conversion');
        }

        const data = {
            inputs: text,
            id: this.currentConversation.history[this.currentConversation.history.length - 1].id,
            is_retry: false,
            is_continue: false,
            web_search: false,
            tools: [],
        };
        const formData = new FormData();
        formData.append('data', JSON.stringify(data));

        const baseUrl = this.params.config.url || 'https://huggingface.co';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.params.config.timeout);

        const response = await fetch(`${baseUrl}/chat/conversation/${this.currentConversionID}`, {
            headers: {
                ...this.headers,
                cookie: this.cookie,
                Referer: `${baseUrl}/chat/conversation/${this.currentConversionID}`,
            },
            body: formData,
            method: 'POST',
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        function parseResponse(chunk: string) {
            try {
                // check if chunk contains multiple jsons
                const _jsonArr = chunk.split('\n');
                const newJsonArray: any[] = [];

                for (const val of _jsonArr) {
                    if (val.trim()) {
                        newJsonArray.push(JSON.parse(val));
                    }
                }
                return newJsonArray;
            } catch (error) {
                if (chunk) {
                    // console.error("Error parsing JSON:", chunk);
                }
                return [{}];
            }
        }
        const decoder = new TextDecoder();
        let completeResponse = '';

        const transformStream = new TransformStream({
            async transform(chunk, controller) {
                const decodedChunk = decoder.decode(chunk);

                try {
                    const modifiedDataArr = parseResponse(decodedChunk);

                    for (const modifiedData of modifiedDataArr) {
                        if (modifiedData.type === 'finalAnswer') {
                            completeResponse = modifiedData?.text || '';
                            controller.terminate();
                        } else if (modifiedData.type === 'stream') {
                            controller.enqueue(modifiedData?.token || '');
                        }
                    }
                } catch {
                    throw new Error('Error during parsing response');
                }
            },
        });
        const modifiedStream = response.body?.pipeThrough(transformStream);

        async function completeResponsePromise() {
            // eslint-disable-next-line no-async-promise-executor
            return new Promise<string>(async (resolve, reject) => {
                try {
                    if (!modifiedStream) {
                        reject(`ModifiedStream undefined`);
                    } else {
                        const reader = modifiedStream.getReader();

                        // eslint-disable-next-line no-constant-condition
                        while (true) {
                            const { done, value } = await reader.read();

                            if (done) {
                                resolve(completeResponse);
                                break; // The streaming has ended.
                            }
                        }
                    }
                } catch (error) {
                    reject(error); // Reject the promise with the caught error
                }
            });
        }

        return {
            id: this.currentConversionID,
            stream: modifiedStream,
            completeResponsePromise,
        };
    }

    private async deleteConversation(conversationId: string): Promise<any> {
        const baseUrl = this.params.config.url || 'https://huggingface.co';
        const response = await fetch(`${baseUrl}/chat/conversation/${conversationId}`, {
            headers: {
                ...this.headers,
                cookie: this.cookie,
                Referer: `${baseUrl}/chat/`,
            },
            body: null,
            method: 'DELETE',
        });

        return response.json();
    }
}
