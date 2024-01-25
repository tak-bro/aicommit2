import { KnownError } from './error.js';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DiscussServiceClient } = require('@google-ai/generativelanguage');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GoogleAuth } = require('google-auth-library');
import { CommitType } from './config.js';
import { generatePrompt } from './prompt.js';

export const generateBardCommitMessage = async (
    key: string,
    locale: string,
    diff: string,
    completions: number,
    maxLength: number,
    type: CommitType,
    timeout: number,
    proxy?: string
): Promise<string[]> => {
    // return [
    //     'google(temp): test google message',
    //     'google(temp): test google message2'
    // ];

    try {
        const discussServiceClient = new DiscussServiceClient({ authClient: new GoogleAuth().fromAPIKey(key) });
        const result = await discussServiceClient.generateMessage(
            {
                model: 'models/chat-bison-001',
                prompt: {
                    context: '',
                    messages: [{ content: generatePrompt(locale, maxLength, type) + `\nHere is diff: ${diff}` }],
                },
                candidateCount: 1,
                temperature: 0.7,
                top_p: 1,
                top_k: 40,
                context: '',
                examples: [],
                format: 'json',
            },
            {
                timeout,
                maxResults: completions,
            }
        );
        return result;
    } catch (error) {
        const errorAsAny = error as any;
        if (errorAsAny.code === 'ENOTFOUND') {
            throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall})`);
        }
        throw errorAsAny;
    }
};
