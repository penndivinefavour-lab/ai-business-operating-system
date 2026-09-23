/** Shared domain types for the AI Digital Front Desk. */

export type RoomStatus = 'clean' | 'dirty' | 'maintenance' | 'out_of_service';

export type ReservationStatus =
  | 'requested'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'declined';

export type ConversationStatus = 'open' | 'awaiting' | 'escalated' | 'resolved';

export type Sender = 'guest' | 'ai' | 'human' | 'system';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

export type Intent =
  | 'greeting'
  | 'availability'
  | 'price'
  | 'booking'
  | 'booking_confirm'
  | 'booking_cancel'
  | 'location'
  | 'checkin_policy'
  | 'checkout_time'
  | 'amenities'
  | 'faq'
  | 'feedback'
  | 'escalation'
  | 'lead_capture'
  | 'customer_lookup'
  | 'thanks'
  | 'goodbye'
  | 'unknown';

export interface Hotel {
  id: number;
  slug: string;
  name: string;
  description: string;
  email: string;
  phone: string;
  whatsapp_phone: string;
  address: string;
  city: string;
  country: string;
  currency: string;
  check_in_time: string;
  check_out_time: string;
  tax_rate: number;
  timezone: string;
  demo_enabled: number;
  settings: string;
  created_at: string;
}

export interface HotelUser {
  id: number;
  hotel_id: number;
  name: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'staff';
  created_at: string;
}

export interface Room {
  id: number;
  hotel_id: number;
  number: string;
  name: string;
  room_type: string;
  floor: number;
  capacity: number;
  base_price: number;
  amenities: string;
  status: RoomStatus;
  maintenance: number;
  active: number;
}

export interface Customer {
  id: number;
  hotel_id: number;
  name: string;
  phone: string;
  email: string;
  language: string;
  notes: string;
  source: string;
  created_at: string;
}

export interface Conversation {
  id: number;
  hotel_id: number;
  customer_id: number | null;
  channel: string;
  status: ConversationStatus;
  intent_last: string;
  started_at: string;
  last_message_at: string;
}

export interface MessageRow {
  id: number;
  conversation_id: number;
  hotel_id: number;
  sender: Sender;
  body: string;
  kind: string;
  ref_id: number | null;
  created_at: string;
}

export interface Reservation {
  id: number;
  hotel_id: number;
  customer_id: number | null;
  lead_id: number | null;
  check_in: string;
  check_out: string;
  guests: number;
  room_ids: string;
  status: ReservationStatus;
  total_amount: number;
  currency: string;
  source: string;
  notes: string;
  created_at: string;
  confirmed_at: string | null;
}

export interface Lead {
  id: number;
  hotel_id: number;
  customer_id: number | null;
  name: string;
  phone: string;
  email: string;
  intent: string;
  source: string;
  status: LeadStatus;
  notes: string;
  created_at: string;
}

export interface KnowledgeItem {
  id: number;
  hotel_id: number;
  category: string;
  question: string;
  answer: string;
  keywords: string;
  active: number;
}

export interface FeedbackRow {
  id: number;
  hotel_id: number;
  customer_id: number | null;
  reservation_id: number | null;
  rating: number | null;
  comment: string;
  status: string;
  created_at: string;
}

export interface Followup {
  id: number;
  hotel_id: number;
  customer_id: number | null;
  conversation_id: number | null;
  due_at: string;
  task: string;
  status: 'pending' | 'done' | 'cancelled';
  created_at: string;
}

export interface Escalation {
  id: number;
  hotel_id: number;
  conversation_id: number | null;
  customer_id: number | null;
  reason: string;
  requested_by_guest: number;
  status: string;
  assigned_to: string;
  handled_at: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: number;
  hotel_id: number | null;
  actor_type: 'system' | 'ai' | 'human' | 'admin';
  actor_id: string;
  action: string;
  entity: string;
  entity_id: number | null;
  details: string;
  created_at: string;
}

export interface AgentRun {
  id: number;
  hotel_id: number;
  conversation_id: number | null;
  intent: Intent;
  confidence: number;
  actions: string;
  latency_ms: number;
  created_at: string;
}

/** A controlled business tool invocation result. */
export interface ToolResult {
  ok: boolean;
  tool: string;
  data: unknown;
  error?: string;
  /** Human readable summary used by the reply composer (the ONLY facts allowed). */
  facts: string[];
  createdId?: number;
}

export interface ResolvedEntities {
  phone?: string;
  email?: string;
  name?: string;
  guests?: number;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  roomType?: string;
  rating?: number;
  dateRef?: string;
}

export interface Classification {
  intent: Intent;
  confidence: number;
  entities: ResolvedEntities;
  matches: string[];
}

export interface AgentContext {
  hotel: Hotel;
  customer: Customer | null;
  conversationId: number;
  history: MessageRow[];
  classification: Classification;
}

export interface OrchestratorResult {
  reply: string;
  intent: Intent;
  confidence: number;
  actions: ToolResult[];
  conversationId: number;
  customer: Customer | null;
  changed: boolean;
  provider: string;
}

export interface UserMessage {
  hotelId: number;
  conversationId?: number;
  customerId?: number | null;
  channel: string;
  text: string;
  /** supplying a guest identity for web/simulated channels */
  contact?: { phone?: string; name?: string; email?: string };
}

export interface LlmRequest {
  hotel: Hotel;
  customer: Customer | null;
  conversationId: number;
  history: MessageRow[];
  language: 'fr' | 'en';
  intent: string;
  facts: string[];
  actions: ToolResult[];
  /** deterministic reply composed by the specialist agent (fallback + guard baseline) */
  proposedReply: string;
}

export interface LlmProvider {
  name: string;
  composeReply(req: LlmRequest): Promise<string>;
}

// ─── AI Employee & Onboarding types ────────────────────────────────────────

export interface EmployeeProfile {
  id: number;
  hotel_id: number;
  name: string;
  role: string;
  personality: string;
  tone: string;
  languages: string;
  avatar_emoji: string;
  welcome_message: string;
  escalation_trigger: string;
  escalation_message: string;
  pause_on_escalation: number;
  max_response_length: number;
  custom_greeting: string;
  status: 'draft' | 'active' | 'paused';
  onboarding_step: number;
  onboarding_completed: number;
  created_at: string;
  updated_at: string;
}

export interface BusinessService {
  id: number;
  hotel_id: number;
  name: string;
  description: string;
  category: string;
  price: number | null;
  price_unit: string;
  available: number;
  sort_order: number;
  created_at: string;
}

export interface BusinessPolicy {
  id: number;
  hotel_id: number;
  policy_type: string;
  title: string;
  content: string;
  active: number;
  sort_order: number;
  created_at: string;
}

export interface OnboardingChecklist {
  id: number;
  hotel_id: number;
  step_key: string;
  step_name: string;
  completed: number;
  completed_at: string | null;
}

export const ONBOARDING_STEPS = [
  { key: 'business_info', name: 'Informations entreprise' },
  { key: 'employee_identity', name: 'Identité employé IA' },
  { key: 'services', name: 'Services et tarifs' },
  { key: 'policies', name: 'Règles et politiques' },
  { key: 'knowledge', name: 'FAQ et connaissances' },
  { key: 'escalation', name: 'Escalade humain' },
  { key: 'test', name: 'Tester employé' },
  { key: 'activate', name: 'Activer' },
] as const;