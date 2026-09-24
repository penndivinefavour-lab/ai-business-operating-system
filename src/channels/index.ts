/**
 * AI Business Operating System — Channel Abstraction Layer
 * 
 * Architecture:
 *   Inbound: Channel → normalize → processMessage → Channel → send
 *   Outbound: Orchestrator result → Channel adapter → external delivery
 * 
 * Current channels:
 * - web: In-browser widget (stateless, HTTP-based)
 * - whatsapp: WhatsApp Business Cloud API (webhook-based)
 * 
 * Future: voice, sms, telegram, etc.
 */

import type { OrchestratorResult, UserMessage } from '../types.ts';
import type { Session } from '../auth.ts';

export interface InboundMessage {
  channel: string;
  externalId: string;
  from: string;
  text: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ChannelAdapter {
  readonly name: string;
  sendText(to: string, text: string, metadata?: Record<string, unknown>): Promise<{ ok: boolean; error?: string }>;
  normalizeInbound(payload: unknown): InboundMessage[];
  isActive(): boolean;
}

export interface ChannelConfig {
  id: string;
  businessId: number;
  channelType: 'web' | 'whatsapp' | 'sms';
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Web Channel (Stateless Widget) ────────────────────────────────────────

export class WebChannel implements ChannelAdapter {
  readonly name = 'web';
  
  async sendText(): Promise<{ ok: boolean }> {
    // Web channel sends responses directly via HTTP
    return { ok: true };
  }
  
  normalizeInbound(payload: unknown): InboundMessage[] {
    const p = payload as { text?: string; from?: string; sessionId?: string };
    if (!p.text) return [];
    return [{
      channel: 'web',
      externalId: p.sessionId ?? `web_${Date.now()}`,
      from: p.from ?? 'anonymous',
      text: p.text,
      timestamp: new Date().toISOString(),
    }];
  }
  
  isActive(): boolean {
    return true;
  }
}

// ─── WhatsApp Channel (Official Cloud API) ─────────────────────────────────

import { config } from '../config.ts';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { writeAudit } from '../db/repositories.ts';

export class WhatsAppChannel implements ChannelAdapter {
  readonly name = 'whatsapp';
  
  async sendText(to: string, text: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.isActive()) {
      return { ok: false, error: 'WhatsApp not configured' };
    }
    
    if (!to) {
      return { ok: false, error: 'Recipient phone number required' };
    }
    
    const url = `${config.whatsapp.graphUrl}/${config.whatsapp.phoneNumberId}/messages`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        }),
      });
      
      if (!res.ok) {
        const errorText = (await res.text()).slice(0, 300);
        return { ok: false, error: `WA_API ${res.status}: ${errorText}` };
      }
      
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }
  
  normalizeInbound(payload: unknown): InboundMessage[] {
    const entries: InboundMessage[] = [];
    const p = payload as Record<string, unknown>;
    
    const entry = p.entry as Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{
            from?: string;
            text?: { body?: string };
            timestamp?: string;
            id?: string;
          }>;
        };
      }>;
    }> ?? [];
    
    for (const e of entry) {
      for (const change of e.changes ?? []) {
        for (const msg of change.value?.messages ?? []) {
          if (msg.from && msg.text?.body) {
            entries.push({
              channel: 'whatsapp',
              externalId: msg.id ?? `wa_${Date.now()}`,
              from: msg.from,
              text: msg.text.body,
              timestamp: msg.timestamp ?? new Date().toISOString(),
            });
          }
        }
      }
    }
    
    return entries;
  }
  
  verifyWebhook(rawBody: string, signature: string | undefined): boolean {
    if (!signature || !config.whatsapp.accessToken) return false;
    const expected = createHmac('sha256', config.whatsapp.accessToken)
      .update(rawBody)
      .digest('hex');
    const provided = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(provided, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }
  
  isActive(): boolean {
    return Boolean(config.whatsapp.accessToken && config.whatsapp.phoneNumberId);
  }
}

// ─── Channel Registry ──────────────────────────────────────

export class ChannelRegistry {
  private channels = new Map<string, ChannelAdapter>();
  
  register(channel: ChannelAdapter): void {
    this.channels.set(channel.name, channel);
  }
  
  get(name: string): ChannelAdapter | undefined {
    return this.channels.get(name);
  }
  
  list(): ChannelAdapter[] {
    return Array.from(this.channels.values());
  }
  
  getActive(): ChannelAdapter[] {
    return this.list().filter(c => c.isActive());
  }
}

export const channelRegistry = new ChannelRegistry();
channelRegistry.register(new WebChannel());
channelRegistry.register(new WhatsAppChannel());

export function getActiveChannels(): string[] {
  return channelRegistry.getActive().map(c => c.name);
}
