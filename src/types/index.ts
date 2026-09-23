// src/types/index.ts

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  check_in_time: string;
  check_out_time: string;
  currency: string;
  created_at: string;
}

export interface Room {
  id: string;
  tenant_id: string;
  type: string;
  name: string;
  description: string;
  price_cents: number;
  amenities: string[];
  total_count: number;
  images: string[];
  created_at: string;
}

export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  email: string;
  total_stays: number;
  total_spent_cents: number;
  preferences: string;
  notes: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  tenant_id: string;
  customer_id: string;
  channel: 'whatsapp' | 'web' | 'email';
  status: 'active' | 'closed' | 'escalated';
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  direction: 'in' | 'out';
  content: string;
  actor: 'ai' | 'human' | 'system';
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Lead {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  email: string;
  interest: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  source: string;
  converted_to_customer_id?: string;
  created_at: string;
}

export interface Booking {
  id: string;
  tenant_id: string;
  customer_id: string;
  room_id: string;
  check_in: string;
  check_out: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  total_cents: number;
  special_requests: string;
  created_at: string;
}

export interface Feedback {
  id: string;
  tenant_id: string;
  customer_id: string;
  booking_id: string;
  rating: number;
  comment: string;
  status: 'new' | 'reviewed' | 'responded';
  created_at: string;
}

export interface Escalation {
  id: string;
  tenant_id: string;
  conversation_id: string;
  reason: string;
  status: 'open' | 'assigned' | 'resolved';
  assigned_to: string;
  context: Record<string, unknown>;
  created_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  actor: string;
  action: string;
  entity: string;
  entity_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface KnowledgeDocument {
  id: string;
  tenant_id: string;
  type: 'policy' | 'faq' | 'service' | 'room' | 'location' | 'general';
  title: string;
  content: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface IncomingMessage {
  id: string;
  tenant_id: string;
  customer_phone: string;
  content: string;
  channel: 'whatsapp' | 'web';
  timestamp: string;
}

export interface OutgoingMessage {
  tenant_id: string;
  customer_phone: string;
  content: string;
  channel: 'whatsapp' | 'web';
  metadata?: Record<string, unknown>;
}

export type IntentType =
  | 'check_availability'
  | 'get_price'
  | 'booking_request'
  | 'policy_question'
  | 'location_question'
  | 'services_question'
  | 'feedback_complaint'
  | 'human_escalation'
  | 'modify_booking'
  | 'cancel_booking'
  | 'general_info'
  | 'small_talk';

export interface IntentClassification {
  intent: IntentType;
  confidence: number;
  entities: Record<string, string>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  message: string;
}

export interface ConversationContext {
  conversation_id: string;
  tenant_id: string;
  customer_id?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  current_intent?: IntentType;
  metadata: Record<string, unknown>;
}
