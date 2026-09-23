import type { LlmProvider, LlmRequest } from '../types.ts';
import { config } from '../config.ts';
import { DemoProvider } from './demo.ts';
import { OpenAICompatibleProvider } from './openai-compatible.ts';
import { AnthropicProvider } from './anthropic.ts';

export * from './guard.ts';

export function createProvider(): LlmProvider {
  switch (config.ai.provider) {
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config.ai);
    case 'anthropic':
      return new AnthropicProvider(config.ai);
    case 'demo':
    default:
      return new DemoProvider();
  }
}

export { DemoProvider };