import { AIService, AIServiceParams } from './ai.service.js';

export class AIServiceFactory {
    static create<T extends AIService>(className: { new (params: AIServiceParams): T }, params: AIServiceParams): T {
        return new className(params);
    }
}
