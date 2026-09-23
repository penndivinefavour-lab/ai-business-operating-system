// src/adapters/database/index.ts

import { PocketBaseClient } from './PocketBaseClient.js';
import type { PBListResult, PBRecord } from './PocketBaseClient.js';
import type {
  Tenant, Room, Customer, Conversation, Message,
  Lead, Booking, Feedback, Escalation, AuditLog, KnowledgeDocument,
} from '../../types/index.js';

export interface DatabaseClient {
  authenticate(email: string, password: string): Promise<void>;
  create(collection: string, data: Record<string, unknown>): Promise<PBRecord>;
  list(collection: string, filter?: string, page?: number, perPage?: number): Promise<PBListResult<never>>;
  
  // Tenants
  getTenant(id: string): Promise<Tenant>;
  getTenantBySlug(slug: string): Promise<Tenant>;
  
  // Rooms
  getRooms(tenantId: string): Promise<Room[]>;
  getRoom(tenantId: string, roomId: string): Promise<Room>;
  
  // Customers
  getCustomerByPhone(tenantId: string, phone: string): Promise<Customer | null>;
  createCustomer(data: Omit<Customer, 'id' | 'created_at'>): Promise<Customer>;
  updateCustomer(id: string, data: Partial<Customer>): Promise<Customer>;
  
  // Conversations
  createConversation(data: Omit<Conversation, 'id' | 'created_at'>): Promise<Conversation>;
  getConversation(tenantId: string, conversationId: string): Promise<Conversation>;
  updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation>;
  
  // Messages
  addMessage(data: Message): Promise<Message>;
  getMessages(tenantId: string, conversationId: string): Promise<Message[]>;
  
  // Leads
  createLead(data: Omit<Lead, 'id' | 'created_at'>): Promise<Lead>;
  updateLead(id: string, data: Partial<Lead>): Promise<Lead>;
  getLeads(tenantId: string, status?: string): Promise<Lead[]>;
  
  // Bookings
  createBooking(data: Omit<Booking, 'id' | 'created_at'>): Promise<Booking>;
  updateBooking(id: string, data: Partial<Booking>): Promise<Booking>;
  getBookings(tenantId: string, filters?: Record<string, string>): Promise<Booking[]>;
  getOverlappingBookings(tenantId: string, roomId: string, checkIn: string, checkOut: string): Promise<Booking[]>;
  
  // Feedback
  createFeedback(data: Omit<Feedback, 'id' | 'created_at'>): Promise<Feedback>;
  getFeedback(tenantId: string): Promise<Feedback[]>;
  
  // Escalations
  createEscalation(data: Omit<Escalation, 'id' | 'created_at'>): Promise<Escalation>;
  updateEscalation(id: string, data: Partial<Escalation>): Promise<Escalation>;
  getEscalations(tenantId: string): Promise<Escalation[]>;
  
  // Audit Logs
  addAuditLog(data: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog>;
  
  // Knowledge
  getKnowledgeDocuments(tenantId: string): Promise<KnowledgeDocument[]>;
  searchKnowledge(tenantId: string, query: string): Promise<KnowledgeDocument[]>;
}

export function createDatabaseClient(baseUrl: string): DatabaseClient {
  const pb = new PocketBaseClient(baseUrl);

  const now = () => new Date().toISOString();

  return {
    authenticate: (email: string, password: string) => pb.authenticate(email, password),
    create: (collection: string, data: Record<string, unknown>) => pb.create(collection, data),
    list: (collection: string, filter?: string, page?: number, perPage?: number) => pb.list(collection, filter, page, perPage),

    async getTenant(id: string): Promise<Tenant> {
      return pb.getFirstListItem('tenants', `id="${id}"`) as unknown as Promise<Tenant>;
    },

    async getTenantBySlug(slug: string): Promise<Tenant> {
      return pb.getFirstListItem('tenants', `slug="${slug}"`) as unknown as Promise<Tenant>;
    },

    async getRooms(tenantId: string): Promise<Room[]> {
      const res = await pb.list('rooms', `tenant_id="${tenantId}"`);
      return res.items as unknown as Room[];
    },

    async getRoom(tenantId: string, roomId: string): Promise<Room> {
      return pb.getFirstListItem('rooms', `tenant_id="${tenantId}" && id="${roomId}"`) as unknown as Promise<Room>;
    },

    async getCustomerByPhone(tenantId: string, phone: string): Promise<Customer | null> {
      try {
        return await pb.getFirstListItem('customers', `tenant_id="${tenantId}" && phone="${phone}"`) as unknown as Customer;
      } catch { return null; }
    },

    async createCustomer(data: Omit<Customer, 'id' | 'created_at'>): Promise<Customer> {
      return pb.create('customers', { ...data, created_at: now() }) as unknown as Promise<Customer>;
    },

    async updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
      return pb.update('customers', id, data) as unknown as Promise<Customer>;
    },

    async createConversation(data: Omit<Conversation, 'id' | 'created_at'>): Promise<Conversation> {
      return pb.create('conversations', { ...data, created_at: now() }) as unknown as Promise<Conversation>;
    },

    async getConversation(tenantId: string, conversationId: string): Promise<Conversation> {
      return pb.getFirstListItem('conversations', `tenant_id="${tenantId}" && id="${conversationId}"`) as unknown as Promise<Conversation>;
    },

    async updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation> {
      return pb.update('conversations', id, data) as unknown as Promise<Conversation>;
    },

    async addMessage(data: Message): Promise<Message> {
      return pb.create('messages', data as unknown as Record<string, unknown>) as unknown as Promise<Message>;
    },

    async getMessages(tenantId: string, conversationId: string): Promise<Message[]> {
      const res = await pb.list('messages', `conversation_id="${conversationId}"`);
      return res.items as unknown as Message[];
    },

    async createLead(data: Omit<Lead, 'id' | 'created_at'>): Promise<Lead> {
      return pb.create('leads', { ...data, created_at: now() }) as unknown as Promise<Lead>;
    },

    async updateLead(id: string, data: Partial<Lead>): Promise<Lead> {
      return pb.update('leads', id, data) as unknown as Promise<Lead>;
    },

    async getLeads(tenantId: string, status?: string): Promise<Lead[]> {
      const filter = status ? `tenant_id="${tenantId}" && status="${status}"` : `tenant_id="${tenantId}"`;
      const res = await pb.list('leads', filter);
      return res.items as unknown as Lead[];
    },

    async createBooking(data: Omit<Booking, 'id' | 'created_at'>): Promise<Booking> {
      return pb.create('bookings', { ...data, created_at: now() }) as unknown as Promise<Booking>;
    },

    async updateBooking(id: string, data: Partial<Booking>): Promise<Booking> {
      return pb.update('bookings', id, data) as unknown as Promise<Booking>;
    },

    async getBookings(tenantId: string, filters?: Record<string, string>): Promise<Booking[]> {
      let filter = `tenant_id="${tenantId}"`;
      if (filters) {
        for (const [k, v] of Object.entries(filters)) {
          filter += ` && ${k}="${v}"`;
        }
      }
      const res = await pb.list('bookings', filter);
      return res.items as unknown as Booking[];
    },

    async getOverlappingBookings(tenantId: string, roomId: string, checkIn: string, checkOut: string): Promise<Booking[]> {
      // Find bookings where: check_in < new_check_out AND check_out > new_check_in
      const filter = `tenant_id="${tenantId}" && room_id="${roomId}" && status!="cancelled" && check_in<"${checkOut}" && check_out>"${checkIn}"`;
      const res = await pb.list('bookings', filter, 1, 100);
      return res.items as unknown as Booking[];
    },

    async createFeedback(data: Omit<Feedback, 'id' | 'created_at'>): Promise<Feedback> {
      return pb.create('feedback', { ...data, created_at: now() }) as unknown as Promise<Feedback>;
    },

    async getFeedback(tenantId: string): Promise<Feedback[]> {
      const res = await pb.list('feedback', `tenant_id="${tenantId}"`);
      return res.items as unknown as Feedback[];
    },

    async createEscalation(data: Omit<Escalation, 'id' | 'created_at'>): Promise<Escalation> {
      return pb.create('escalations', { ...data, created_at: now() }) as unknown as Promise<Escalation>;
    },

    async updateEscalation(id: string, data: Partial<Escalation>): Promise<Escalation> {
      return pb.update('escalations', id, data) as unknown as Promise<Escalation>;
    },

    async getEscalations(tenantId: string): Promise<Escalation[]> {
      const res = await pb.list('escalations', `tenant_id="${tenantId}"`);
      return res.items as unknown as Escalation[];
    },

    async addAuditLog(data: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> {
      return pb.create('audit_logs', { ...data, created_at: now() }) as unknown as Promise<AuditLog>;
    },

    async getKnowledgeDocuments(tenantId: string): Promise<KnowledgeDocument[]> {
      const res = await pb.list('knowledge', `tenant_id="${tenantId}"`);
      return res.items as unknown as KnowledgeDocument[];
    },

    async searchKnowledge(tenantId: string, query: string): Promise<KnowledgeDocument[]> {
      // For MVP: fetch all and filter in-memory
      // Production: use pgvector or similar
      const docs = await this.getKnowledgeDocuments(tenantId);
      const queryLower = query.toLowerCase();
      const queryTerms = queryLower.split(/\s+/);
      
      return docs
        .map(doc => {
          const content = `${doc.title} ${doc.content}`.toLowerCase();
          let score = 0;
          for (const term of queryTerms) {
            if (content.includes(term)) score++;
            // Bonus for exact phrase match
            if (content.includes(queryLower)) score += 2;
          }
          return { doc, score };
        })
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(r => r.doc);
    },
  };
}
