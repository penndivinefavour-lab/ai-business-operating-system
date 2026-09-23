import type { LlmRequest } from '../types.ts';

/**
 * Hallucination guard.
 *
 * A model MAY rephrase the agent's reply, but it must never introduce new
 * business amounts/claims. We extract every money figure (… FCFA) from the
 * model output and require each to appear in the verified tool facts.
 * Otherwise the deterministic agent reply is used instead.
 */

export function extractFcfaAmounts(text: string): string[] {
  const amounts: string[] = [];
  const re = /([\d][\d .\u00a0]{0,12})\s*FCFA/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const digits = (m[1] ?? '').replace(/[^\d]/g, '');
    if (digits.length > 0 && digits.length <= 9) amounts.push(digits);
  }
  return amounts;
}

export function amountsFromFacts(facts: string[]): Set<string> {
  const set = new Set<string>();
  for (const f of facts) {
    for (const a of extractFcfaAmounts(f)) set.add(a);
  }
  return set;
}

/**
 * Returns true when every FCFA amount stated by the model is backed by a fact,
 * or when the model states none (but then the reply must not contradict the
 * facts' figures either).
 */
export function verifyReplyAgainstFacts(modelReply: string, facts: string[], proposedReply: string): boolean {
  const stated = extractFcfaAmounts(modelReply);
  if (stated.length === 0) {
    // Model introduced no amounts. It may not contradict proposed facts either —
    // here we allow it (contextual), production would run a judge pass.
    return true;
  }
  const legitimate = amountsFromFacts([...facts, proposedReply]);
  return stated.every((amount) => legitimate.has(amount));
}