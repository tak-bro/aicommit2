import chalk from 'chalk';

import { AIServiceParams } from './ai.service.js';
import { OpenAICompatibleService } from './openai-compatible.service.js';

export class AtlasCloudService extends OpenAICompatibleService {
    constructor(params: AIServiceParams) {
        super({ ...params, keyName: 'ATLASCLOUD' });
        this.colors = {
            primary: '#111827',
            secondary: '#ffffff',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold(`[Atlas Cloud${this.formatModelSuffix()}]`);
        this.errorPrefix = chalk.red.bold(`[Atlas Cloud${this.formatModelSuffix()}]`);
    }
}
