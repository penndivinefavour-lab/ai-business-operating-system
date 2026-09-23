import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.ts';
import { getHotelById, writeAudit } from '../db/repositories.ts';

/**
 * Official Meta WhatsApp Cloud API channel (production).
 * Inactive until WHATSAPP_* env vars are configured. Everything is adapter-based:
 * the core app only calls `sendText`, so a bridge (Evolution/Baileys) could
 * replace this implementation without touching the orchestrator.
 */

const active = (): boolean => Boolean(config.whatsapp.accessToken && config.whatsapp.phoneNumberId);

/** Send a plain text message to a WhatsApp number (only within open service window / templates in prod). */
export async function sendWhatsAppText(to: string, text: string, hotelId: number): Promise<{ ok: boolean; error?: string }> {
  if (!active()) return { ok: false, error: 'whatsapp not configured' };
  if (!to) return { ok: false, error: 'to is required' };
  const hotel = getHotelById(hotelId);
  if (!hotel) return { ok: false, error: 'hotel not found' };

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
    if (!res.ok) return { ok: false, error: `WA_API ${res.status}: ${(await res.text()).slice(0, 200)}` };
    writeAudit({ hotelId, actorType: 'ai', actorId: 'whatsapp', action: 'wa_send', entity: 'message', details: `to=${to} len=${text.length}` });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Verify the X-Hub-Signature-256 for webhook payloads. */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = (signatureHeader.startsWith('sha256=') ? signatureHeader.slice(7) : signatureHeader).toLowerCase();
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(provided, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Normalize an inbound WhatsApp payload (v21+) into our message shape. */
export function normalizeInbound(payload: Record<string, unknown>): Array<{ from: string; text: string; timestamp: string }> {
  const entries: Array<{ from: string; text: string; timestamp: string }> = [];
  const changes = payload.entry as Array<{ changes?: Array<{ value?: { messages?: Array<{ from?: string; text?: { body?: string }; timestamp?: string }> } }> }> ?? [];
  for (const entry of changes) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        if (msg.from && msg.text?.body) {
          entries.push({ from: msg.from, text: msg.text.body, timestamp: msg.timestamp ?? String(Date.now()) });
        }
      }
    }
  }
  return entries;
}

export function webhookReady(): boolean {
  return active() && Boolean(config.whatsapp.verifyToken);
}

export function isWaTextInbound(payload: Record<string, unknown>): boolean {
  return normalizeInbound(payload).length > 0;
}