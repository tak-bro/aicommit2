// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DiscussServiceClient } = require('@google-ai/generativelanguage');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GoogleAuth } = require('google-auth-library');
import { CommitType } from './config.js';
import { generatePrompt } from './prompt.js';

export const generateBardCommitMessage = (
    abortSignal: AbortSignal,
    key: string,
    locale: string,
    diff: string,
    completions: number,
    maxLength: number,
    type: CommitType,
    timeout: number,
    proxy?: string
): Promise<any> => {
    return new Promise((resolve, reject) => {
        const error = new Error('AbortError: Generation aborted by the user');
        if (abortSignal.aborted) {
            return reject(error);
        }

        const timeoutId = setTimeout(() => {
            const discussServiceClient = new DiscussServiceClient({ authClient: new GoogleAuth().fromAPIKey(key) });
            discussServiceClient
                .generateMessage(
                    {
                        model: 'models/chat-bison-001',
                        prompt: {
                            context: '',
                            messages: [
                                { content: generatePrompt(locale, maxLength, type) + `\nHere is diff: ${diff}` },
                            ],
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
                )
                .then((res: any) => resolve(res))
                .catch((error: any) => reject(error));
        }, timeout);

        abortSignal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(error);
        });
    });
};
