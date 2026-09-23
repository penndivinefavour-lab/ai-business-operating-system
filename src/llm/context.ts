/**
 * AI Business Operating System — LLM Context Builder
 * 
 * Assembles the full context for LLM replies, including:
 * - Employee identity, personality, tone, languages
 * - Business information (hotel details, services, policies)
 * - Customer context and conversation history
 * - Verified facts from deterministic tools
 * 
 * This ensures the LLM speaks AS the configured employee, not as a generic AI.
 */

import type { Hotel, Customer, MessageRow, LlmRequest, EmployeeProfile, BusinessService, BusinessPolicy, KnowledgeItem } from '../types.ts';
import { getEmployeeProfile, listBusinessServices, listBusinessPolicies, listKnowledge } from '../db/repositories.ts';

export interface EmployeeContext {
  profile: EmployeeProfile | null;
  services: BusinessService[];
  policies: BusinessPolicy[];
  knowledge: KnowledgeItem[];
}

export function buildEmployeeContext(hotelId: number): EmployeeContext {
  const profile = getEmployeeProfile(hotelId) ?? null;
  const services = listBusinessServices(hotelId).filter(s => s.available === 1);
  const policies = listBusinessPolicies(hotelId).filter(p => p.active === 1);
  const knowledge = listKnowledge(hotelId).filter(k => k.active === 1);
  return { profile, services, policies, knowledge };
}

/**
 * Build the system prompt for the LLM.
 * This is the ONLY place where employee configuration enters the LLM.
 */
export function buildSystemPrompt(
  hotel: Hotel,
  empCtx: EmployeeContext,
  language: 'fr' | 'en',
): string {
  const p = empCtx.profile;
  const isFr = language === 'fr';

  // Employee identity
  const empName = p?.name ?? (isFr ? 'Assistant' : 'Assistant');
  const empRole = p?.role ?? (isFr ? 'Réceptionniste' : 'Receptionist');
  const personality = p?.personality ?? 'professional_friendly';
  const tone = p?.tone ?? 'warm_professional';
  const languages = p?.languages ?? 'fr,en';

  const personalityDesc: Record<string, string> = {
    professional_friendly: isFr ? 'professionnel(le) et chaleureux(se)' : 'professional and warm',
    formal_elegant: isFr ? 'formel(le) et élégant(e)' : 'formal and elegant',
    casual_helpful: isFr ? 'détendu(e) et serviable' : 'casual and helpful',
  };

  const toneDesc: Record<string, string> = {
    warm_professional: isFr ? 'ton chaleureux mais professionnel' : 'warm but professional tone',
    formal_polite: isFr ? 'ton formel et poli' : 'formal and polite tone',
    friendly_helpful: isFr ? 'ton amical et utile' : 'friendly and helpful tone',
  };

  const lines: string[] = [];

  // Identity
  lines.push(isFr
    ? `Vous êtes ${empName}, ${empRole} numérique de l'hôtel "${hotel.name}".`
    : `You are ${empName}, the digital ${empRole} for "${hotel.name}".`);

  // Personality
  lines.push(isFr
    ? `Personalité : ${personalityDesc[personality] ?? personality}.`
    : `Personality: ${personalityDesc[personality] ?? personality}.`);

  // Tone
  lines.push(isFr
    ? `Ton : ${toneDesc[tone] ?? tone}.`
    : `Tone: ${toneDesc[tone] ?? tone}.`);

  // Languages
  const langList = languages.split(',').map(l => l.trim());
  if (langList.includes('fr') && langList.includes('en')) {
    lines.push(isFr
      ? 'Vous répondez en français ou en anglais selon la langue du client.'
      : 'You reply in French or English depending on the guest\'s language.');
  } else if (langList.includes('en')) {
    lines.push(isFr ? 'Vous répondez en anglais.' : 'You reply in English.');
  } else {
    lines.push(isFr ? 'Vous répondez en français.' : 'You reply in French.');
  }

  // Critical rule: no hallucination
  lines.push(isFr
    ? 'RÈGLE CRITIQUE : Vous NE DEVEZ JAMAIS inventer ou estimer de prix, disponibilité, date, chambre ou politique. Utilisez UNIQUEMENT les FACTS VÉRIFIÉS fournis. Si vous n\'êtes pas sûr, reformulez les faits vérifiés ou demandez l\'aide d\'un collègue (humain).'
    : 'CRITICAL RULE: You MUST NEVER invent or estimate any price, availability, date, room, or policy. Use ONLY the VERIFIED FACTS provided. If unsure, restate the verified facts only or ask a colleague (human) for help.');

  // Keep it concise
  const maxLen = p?.max_response_length ?? 500;
  lines.push(isFr
    ? `Gardez vos réponses courtes (max ${maxLen} caractères). Naturelles, comme une vraie réceptionniste.`
    : `Keep replies short (max ${maxLen} chars). Natural, like a real front desk agent.`);

  // Business context
  if (empCtx.services.length > 0) {
    lines.push(isFr
      ? `\nServices proposés par l'hôtel :\n${empCtx.services.map(s => `- ${s.name}${s.price ? ` : ${s.price} FCFA` : ''}`).join('\n')}`
      : `\nHotel services:\n${empCtx.services.map(s => `- ${s.name}${s.price ? `: ${s.price} FCFA` : ''}`).join('\n')}`);
  }

  if (empCtx.policies.length > 0) {
    lines.push(isFr
      ? `\nPolitiques importantes :\n${empCtx.policies.map(p => `- ${p.title}: ${p.content.slice(0, 100)}`).join('\n')}`
      : `\nImportant policies:\n${empCtx.policies.map(p => `- ${p.title}: ${p.content.slice(0, 100)}`).join('\n')}`);
  }

  return lines.join('\n');
}

/**
 * Build the user message that asks the LLM to rephrase the deterministic reply.
 */
export function buildRephrasePrompt(
  proposedReply: string,
  _verifiedFacts: string[],
  language: 'fr' | 'en',
): string {
  const isFr = language === 'fr';
  return isFr
    ? `Reformulez naturellement la réponse ci-dessous (en français, comme ${proposedReply.includes('vous') ? 'vous' : 'la réceptionniste'}), en restant 100% fidèle aux faits vérifiés. Gardez le même sens, le même niveau de détail :\n\n"""\n${proposedReply}\n"""`
    : `Naturally rephrase the reply below (in English, as the front desk agent), staying 100% faithful to the verified facts. Keep the same meaning and level of detail:\n\n"""\n${proposedReply}\n"""`
}

/**
 * Augment LlmRequest with employee context.
 */
export function augmentRequestWithEmployee(
  req: LlmRequest,
  empCtx: EmployeeContext,
): LlmRequest {
  // Add employee-aware facts
  const extraFacts: string[] = [];
  const p = empCtx.profile;
  if (p) {
    if (p.name) extraFacts.push(`Employee name: ${p.name}`);
    if (p.role) extraFacts.push(`Employee role: ${p.role}`);
    if (p.welcome_message && req.history.length <= 2) {
      extraFacts.push(`Welcome message: ${p.welcome_message}`);
    }
  }
  for (const svc of empCtx.services.slice(0, 10)) {
    extraFacts.push(`Service: ${svc.name}${svc.price ? ` (${svc.price} FCFA)` : ''}`);
  }
  for (const pol of empCtx.policies.slice(0, 5)) {
    extraFacts.push(`Policy (${pol.policy_type}): ${pol.title}`);
  }
  return {
    ...req,
    facts: [...req.facts, ...extraFacts],
  };
}
