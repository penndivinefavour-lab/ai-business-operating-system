// src/adapters/ai/AiAdapter.ts

import type { IntentClassification, IntentType, ConversationContext } from '../../types/index.js';

export interface AiAdapter {
  classifyIntent(message: string, context?: ConversationContext): Promise<IntentClassification>;
  generateResponse(context: ConversationContext, toolResults: Record<string, unknown>): Promise<string>;
}

// Mock AI adapter for demo mode - no API keys needed
export function createMockAiAdapter(): AiAdapter {
  const intentPatterns: Array<{ pattern: RegExp; intent: IntentType }> = [
    { pattern: /do you have.*room|availability|available|free room/i, intent: 'check_availability' },
    { pattern: /how much|price|cost|rate|tarif|prix/i, intent: 'get_price' },
    { pattern: /want to book|book|reserve|reservation|réserver/i, intent: 'booking_request' },
    { pattern: /check.in|early|late.cancel|policy|police|condition/i, intent: 'policy_question' },
    { pattern: /where.*located|address|location|direction|où|adresse|situe/i, intent: 'location_question' },
    { pattern: /service|amenities|facility|wifi|pool|restaurant|parking/i, intent: 'services_question' },
    { pattern: /problem|issue|complaint|unsatisfied|disappointed|n'est pas/i, intent: 'feedback_complaint' },
    { pattern: /speak to someone|human|manager|person|quelqu'un|parler/i, intent: 'human_escalation' },
    { pattern: /cancel|annuler/i, intent: 'cancel_booking' },
    { pattern: /modify|change|update/i, intent: 'modify_booking' },
    { pattern: /thank|hi|hello|bonjour|salut/i, intent: 'small_talk' },
  ];

  return {
    async classifyIntent(message: string): Promise<IntentClassification> {
      for (const { pattern, intent } of intentPatterns) {
        if (pattern.test(message)) {
          return { intent, confidence: 0.85, entities: {} };
        }
      }
      return { intent: 'general_info', confidence: 0.5, entities: {} };
    },

    async generateResponse(context: ConversationContext, toolResults: Record<string, unknown>): Promise<string> {
      const lastMessage = context.messages[context.messages.length - 1]?.content || '';
      
      // Simple template responses based on last user message
      const lower = lastMessage.toLowerCase();
      
      if (lower.includes('thank') || lower.includes('merci')) {
        return "You're welcome! Is there anything else I can help you with?";
      }
      if (lower.includes('hi') || lower.includes('hello') || lower.includes('bonjour')) {
        return "Hello! Welcome to our hotel. How can I assist you today? I can help with room availability, pricing, bookings, or any questions about our services.";
      }
      
      // Return tool result message if available
      if (toolResults.message) {
        return toolResults.message as string;
      }
      
      return "I understand. Let me help you with that. Could you please provide more details?";
    },
  };
}

// OpenRouter adapter for real AI
export function createOpenRouterAiAdapter(apiKey: string, model: string = 'meta-llama/llama-3.3-70b-instruct:free'): AiAdapter {
  return {
    async classifyIntent(message: string): Promise<IntentClassification> {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `Classify the intent of this hotel customer message. Respond with JSON only:
{"intent": "check_availability|get_price|booking_request|policy_question|location_question|services_question|feedback_complaint|human_escalation|cancel_booking|modify_booking|general_info|small_talk", "confidence": 0.0-1.0, "entities": {}}`
            },
            { role: 'user', content: message },
          ],
          temperature: 0.1,
        }),
      });
      const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
      return JSON.parse(data.choices[0].message.content) as IntentClassification;
    },

    async generateResponse(context: ConversationContext): Promise<string> {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a hotel receptionist AI assistant. Be friendly, professional, and concise. Only state facts provided by tools. Never invent availability, prices, or policies.'
            },
            ...context.messages,
          ],
        }),
      });
      const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
      return data.choices[0].message.content;
    },
  };
}

// Anthropic Claude adapter
export function createAnthropicAiAdapter(apiKey: string, model: string = 'claude-3-5-haiku-20241022'): AiAdapter {
  return {
    async classifyIntent(message: string): Promise<IntentClassification> {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: `Classify intent: "${message}". Respond with JSON: {"intent": "...", "confidence": 0.X, "entities": {}}`
          }],
        }),
      });
      const data = (await res.json()) as { content: Array<{ text: string }> };
      return JSON.parse(data.content[0].text) as IntentClassification;
    },

    async generateResponse(context: ConversationContext): Promise<string> {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: 'You are a hotel receptionist AI. Be friendly, professional, and concise. Only use facts from tool results.',
          messages: context.messages,
        }),
      });
      const data = (await res.json()) as { content: Array<{ text: string }> };
      return data.content[0].text;
    },
  };
}

export function createAiAdapter(provider: string, apiKey?: string): AiAdapter {
  switch (provider) {
    case 'openrouter':
      return createOpenRouterAiAdapter(apiKey || '');
    case 'anthropic':
      return createAnthropicAiAdapter(apiKey || '');
    case 'deepseek':
      return createOpenRouterAiAdapter(apiKey || '', 'deepseek/deepseek-chat');
    case 'mock':
    default:
      return createMockAiAdapter();
  }
}
