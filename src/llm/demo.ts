import type { LlmProvider, LlmRequest } from '../types.ts';

/**
 * Deterministic offline "AI". Returns the specialist agent's composed reply
 * verbatim. The product is fully demonstrable with this provider and no
 * credentials or network access.
 */
export class DemoProvider implements LlmProvider {
  readonly name = 'demo';

  async composeReply(req: LlmRequest): Promise<string> {
    return req.proposedReply;
  }
}