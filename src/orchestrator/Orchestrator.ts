// src/orchestrator/Orchestrator.ts

import type { DatabaseClient } from '../adapters/database/index.js';
import type { AiAdapter } from '../adapters/ai/AiAdapter.js';
import type { WhatsAppAdapter } from '../adapters/whatsapp/WhatsAppAdapter.js';
import type {
  IntentType, IntentClassification, ToolResult, ConversationContext,
  IncomingMessage, Tenant, Message,
} from '../types/index.js';
import { checkAvailability, getRoomPrice } from '../tools/availability.js';
import { createBooking, cancelBooking, getCustomerBookings } from '../tools/booking.js';
import { getCustomerByPhone, createCustomer } from '../tools/customer.js';
import { createLead, getLeads } from '../tools/lead.js';
import { submitFeedback } from '../tools/feedback.js';
import { escalateToHuman, getEscalations } from '../tools/escalation.js';
import { searchKnowledge, getPolicy } from '../tools/knowledge.js';

export class Orchestrator {
  private db: DatabaseClient;
  private ai: AiAdapter;
  private whatsapp: WhatsAppAdapter;
  private contexts: Map<string, ConversationContext> = new Map();

  constructor(db: DatabaseClient, ai: AiAdapter, whatsapp: WhatsAppAdapter) {
    this.db = db;
    this.ai = ai;
    this.whatsapp = whatsapp;
  }

  async handleMessage(incoming: IncomingMessage): Promise<string> {
    const { tenant_id, customer_phone, content, channel } = incoming;
    let response = '';

    try {
      // Get or create conversation
      let context = this.getContext(tenant_id, customer_phone);
      if (!context) {
        context = await this.createConversation(tenant_id, customer_phone, channel);
      }

      // Add user message to context
      context.messages.push({ role: 'user', content });

      // Add to database
      await this.db.addMessage({
        id: crypto.randomUUID(),
        conversation_id: context.conversation_id,
        tenant_id,
        direction: 'in',
        content,
        actor: 'system',
        metadata: { channel },
        created_at: new Date().toISOString(),
      } as Message);

      // Classify intent
      const intent = await this.ai.classifyIntent(content, context);
      context.current_intent = intent.intent;

      // Route to appropriate tool(s)
      const toolResult = await this.routeToTool(intent.intent, context, content);

      // Generate response
      response = await this.ai.generateResponse(context, toolResult as unknown as Record<string, unknown>);

      // Add assistant response to context
      context.messages.push({ role: 'assistant', content: response });

      // Send response via channel
      if (channel === 'whatsapp') {
        await this.whatsapp.send(customer_phone, response);
      }

      // Add to database
      await this.db.addMessage({
        id: crypto.randomUUID(),
        conversation_id: context.conversation_id,
        tenant_id,
        direction: 'out',
        content: response,
        actor: 'ai',
        metadata: { intent: intent.intent },
        created_at: new Date().toISOString(),
      } as Message);

      // Log to audit
      await this.db.addAuditLog({
        tenant_id,
        actor: 'ai',
        action: 'process_message',
        entity: 'conversation',
        entity_id: context.conversation_id,
        details: { intent: intent.intent, confidence: intent.confidence, tool_result: toolResult.success },
      });
    } catch (error: any) {
      console.error(`[Orchestrator] Error handling message: ${error.message}`);
      response = 'Sorry, I encountered an error. Please try again.';
      // Log error
      await this.db.addAuditLog({
        tenant_id,
        actor: 'system',
        action: 'error',
        entity: 'message',
        entity_id: incoming.id,
        details: { error: error.message, content },
      });
    }

    return response;
  }

  private getContext(tenant_id: string, customer_phone: string): ConversationContext | undefined {
    const key = `${tenant_id}:${customer_phone}`;
    return this.contexts.get(key);
  }

  private async createConversation(tenant_id: string, customer_phone: string, channel: string): Promise<ConversationContext> {
    // Check for existing customer
    const customer = await this.db.getCustomerByPhone(tenant_id, customer_phone);

    const conversation = await this.db.createConversation({
      tenant_id,
      customer_id: customer?.id || '',
      channel: channel as 'whatsapp' | 'web',
      status: 'active',
      metadata: { customer_phone },
    });

    const context: ConversationContext = {
      conversation_id: conversation.id,
      tenant_id,
      customer_id: customer?.id,
      messages: [],
      metadata: { customer_phone, channel },
    };

    const key = `${tenant_id}:${customer_phone}`;
    this.contexts.set(key, context);
    return context;
  }

  private async routeToTool(intent: IntentType, context: ConversationContext, rawMessage: string): Promise<ToolResult> {
    const { tenant_id } = context;

    switch (intent) {
      case 'check_availability': {
        // Extract date from message (simplified - production would use NLP)
        const dateMatch = rawMessage.match(/(\d{4}-\d{2}-\d{2})/) || 
                          rawMessage.match(/friday|tomorrow|today|saturday|sunday|monday|tuesday|wednesday|thursday/i);
        let date = new Date().toISOString().split('T')[0];
        
        if (dateMatch) {
          if (dateMatch[0].includes('-')) {
            date = dateMatch[0];
          } else {
            date = this.resolveRelativeDate(dateMatch[0]);
          }
        }

        return checkAvailability(this.db, { tenant_id, date });
      }

      case 'get_price': {
        const roomTypeMatch = rawMessage.match(/(standard|executive|deluxe|suite|family|single|double|presidential)/i);
        const roomType = roomTypeMatch ? roomTypeMatch[1] : rawMessage.replace(/.*(?:how much|price|cost|rate|tarif|prix).*/, '').trim();
        
        return getRoomPrice(this.db, { tenant_id, room_type: roomType || 'room' });
      }

      case 'booking_request': {
        // For demo, create a simple booking with available room
        const rooms = await this.db.getRooms(tenant_id);
        if (!rooms.length) {
          return { success: false, message: 'No rooms available at this time.' };
        }

        // Find or create customer
        const phone = context.metadata.customer_phone as string;
        let customer = await this.db.getCustomerByPhone(tenant_id, phone);
        if (!customer) {
          const nameMatch = rawMessage.match(/(?:name is|i'm|i am|je m'appelle)\s+(\w+)/i);
          customer = await this.db.createCustomer({
            tenant_id,
            name: nameMatch ? nameMatch[1] : 'Guest',
            phone: phone || '',
            email: '',
            total_stays: 0,
            total_spent_cents: 0,
            preferences: '',
            notes: '',
          });
        }

        // Extract dates from message
        const dateMatch = rawMessage.match(/(\d{4}-\d{2}-\d{2})/);
        const checkIn = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
        const checkOutMatch = rawMessage.match(/(\d+)\s*nights?/i);
        const nights = checkOutMatch ? parseInt(checkOutMatch[1]) : 1;
        
        const checkOutDate = new Date(checkIn);
        checkOutDate.setDate(checkOutDate.getDate() + nights);
        const checkOut = checkOutDate.toISOString().split('T')[0];

        return createBooking(this.db, {
          tenant_id,
          customer_id: customer.id,
          room_id: rooms[0].id,
          check_in: checkIn,
          check_out: checkOut,
          special_requests: '',
        });
      }

      case 'policy_question': {
        const topicMatch = rawMessage.match(/(?:about|for)\s+(.+)/i);
        const query = topicMatch ? topicMatch[1] : rawMessage;
        return searchKnowledge(this.db, { tenant_id, query, type: 'policy' });
      }

      case 'location_question': {
        return searchKnowledge(this.db, { tenant_id, query: 'location address where', type: 'location' });
      }

      case 'services_question': {
        return searchKnowledge(this.db, { tenant_id, query: 'services amenities facilities', type: 'service' });
      }

      case 'feedback_complaint': {
        const ratingMatch = rawMessage.match(/([1-5])\s*(?:\/5|stars?)?/);
        const rating = ratingMatch ? parseInt(ratingMatch[1]) : 2; // Default low for complaints
        
        return submitFeedback(this.db, {
          tenant_id,
          customer_id: context.customer_id,
          booking_id: '',
          rating,
          comment: rawMessage,
        });
      }

      case 'human_escalation': {
        return escalateToHuman(this.db, {
          tenant_id,
          conversation_id: context.conversation_id,
          reason: 'Customer requested human assistance',
          context: { last_intent: context.current_intent },
        });
      }

      case 'cancel_booking': {
        const bookings = await this.db.getBookings(tenant_id, { customer_id: context.customer_id || '' });
        if (!bookings.length) {
          return { success: false, message: "I couldn't find any bookings to cancel." };
        }
        return cancelBooking(this.db, {
          tenant_id,
          booking_id: bookings[0].id,
          reason: rawMessage,
        });
      }

      case 'general_info':
      case 'small_talk':
      default: {
        return searchKnowledge(this.db, { tenant_id, query: rawMessage, type: 'general' });
      }
    }
  }

  private resolveRelativeDate(text: string): string {
    const lower = text.toLowerCase();
    const today = new Date();
    
    if (lower.includes('tomorrow')) {
      today.setDate(today.getDate() + 1);
    } else if (lower.includes('friday')) {
      today.setDate(today.getDate() + (5 - today.getDay() + 7) % 7);
    } else if (lower.includes('saturday')) {
      today.setDate(today.getDate() + (6 - today.getDay() + 7) % 7);
    } else if (lower.includes('sunday')) {
      today.setDate(today.getDate() + (0 - today.getDay() + 7) % 7);
    } else if (lower.includes('monday')) {
      today.setDate(today.getDate() + (1 - today.getDay() + 7) % 7);
    } else if (lower.includes('tuesday')) {
      today.setDate(today.getDate() + (2 - today.getDay() + 7) % 7);
    } else if (lower.includes('wednesday')) {
      today.setDate(today.getDate() + (3 - today.getDay() + 7) % 7);
    } else if (lower.includes('thursday')) {
      today.setDate(today.getDate() + (4 - today.getDay() + 7) % 7);
    }
    
    return today.toISOString().split('T')[0];
  }
}
