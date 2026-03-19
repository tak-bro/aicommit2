// AI Service exports
export { AIService } from './ai.service.js';
export type { AIServiceParams, AIServiceError, AIResponse, RawCommitMessage, Theme } from './ai.service.js';
export { AIServiceFactory } from './ai-service.factory.js';
export { createErrorChoice, ProviderRegistry, withProviderMetadata } from './provider-registry.js';

// Individual service exports are intentionally removed from this barrel.
// Services are lazy-loaded via ProviderRegistry to avoid importing heavy SDKs at startup.
// Import individual services directly from their files if needed:
//   import { AnthropicService } from './anthropic.service.js';
