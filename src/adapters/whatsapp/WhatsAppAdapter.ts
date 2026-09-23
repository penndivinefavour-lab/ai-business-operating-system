// src/adapters/whatsapp/WhatsAppAdapter.ts

export interface WhatsAppAdapter {
  send(to: string, message: string): Promise<void>;
  onMessage(handler: (from: string, message: string) => void): void;
}

export function createMockWhatsAppAdapter(): WhatsAppAdapter {
  let messageHandler: ((from: string, message: string) => void) | null = null;
  const sentMessages: Array<{ to: string; message: string; time: string }> = [];

  return {
    async send(to: string, message: string): Promise<void> {
      sentMessages.push({ to, message, time: new Date().toISOString() });
      console.log(`[Mock WhatsApp] → ${to}: ${message.substring(0, 80)}...`);
    },
    onMessage(handler: (from: string, message: string) => void): void {
      messageHandler = handler;
    },
    // Expose for testing/demo
    _simulateInbound(from: string, message: string) {
      if (messageHandler) messageHandler(from, message);
    },
    _getSentMessages() { return sentMessages; },
  } as WhatsAppAdapter & { _simulateInbound: (from: string, message: string) => void; _getSentMessages: () => Array<{ to: string; message: string; time: string }> };
}

export function createMetaWhatsAppAdapter(apiKey: string, phoneNumberId: string): WhatsAppAdapter {
  return {
    async send(to: string, message: string): Promise<void> {
      await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message },
        }),
      });
    },
    onMessage(_handler: (from: string, message: string) => void): void {
      // Handled via webhook route in API server
    },
  };
}

export function createWhatsAppAdapter(provider: string, apiKey?: string, phoneNumberId?: string): WhatsAppAdapter {
  switch (provider) {
    case 'whatsapp':
      return createMetaWhatsAppAdapter(apiKey || '', phoneNumberId || '');
    case 'mock':
    default:
      return createMockWhatsAppAdapter();
  }
}
