import type { Customer, Hotel, ToolResult } from '../../types.ts';
import { writeAudit } from '../../db/repositories.ts';

export type ToolPermission = 'read' | 'write' | 'admin';

export interface ToolContext {
  hotel: Hotel;
  customer: Customer | null;
  conversationId: number;
}

export interface ToolDef {
  name: string;
  summary: string;
  permission: ToolPermission;
  run(ctx: ToolContext, args: Record<string, unknown>): ToolResult | Promise<ToolResult>;
}

/**
 * Tool registry + permission sandbox.
 *
 * Persistent state may ONLY change through registered tools. Each tool declares
 * the permission it needs; each agent is granted an explicit capability set, so
 * a compromised/buggy agent can still never perform operations outside its
 * capability list. Every invocation is written to the audit log.
 */
export class ToolRegistry {
  private tools = new Map<string, ToolDef>();

  register(tool: ToolDef): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDef | undefined {
    return this.tools.get(name);
  }

  list(): ToolDef[] {
    return [...this.tools.values()];
  }
}

export class ToolSandbox {
  /** Every execution outcome, in order (for audit/UI/agent-run records). */
  readonly results: ToolResult[] = [];

  private readonly registry: ToolRegistry;
  private readonly allowed: ReadonlySet<string>;
  private readonly actorId: string;

  constructor(registry: ToolRegistry, allowed: ReadonlySet<string>, actorId = 'ai') {
    this.registry = registry;
    this.allowed = allowed;
    this.actorId = actorId;
  }

  async execute(ctx: ToolContext, name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.registry.get(name);
    if (!tool) {
      return this.record({ ok: false, tool: name, data: null, error: `unknown tool: ${name}`, facts: [] });
    }
    if (!this.allowed.has(name)) {
      writeAudit({
        hotelId: ctx.hotel.id,
        actorType: 'ai',
        actorId: this.actorId,
        action: 'tool_denied',
        entity: `tool:${name}`,
        details: 'attempted tool outside agent capability set',
      });
      return this.record({
        ok: false,
        tool: name,
        data: null,
        error: `permission_denied: agent cannot call tool ${name}`,
        facts: [],
      });
    }

    writeAudit({
      hotelId: ctx.hotel.id,
      actorType: 'ai',
      actorId: this.actorId,
      action: `tool_call:${name}`,
      entity: `tool:${name}`,
      details: JSON.stringify(args).slice(0, 2000),
    });

    const started = Date.now();
    try {
      const result = await tool.run(ctx, args);
      if (result.ok) {
        writeAudit({
          hotelId: ctx.hotel.id,
          actorType: 'ai',
          actorId: this.actorId,
          action: `tool_success:${name}`,
          entity: `tool:${name}`,
          details: result.facts.slice(0, 8).join(' | ').slice(0, 2000),
        });
      } else {
        writeAudit({
          hotelId: ctx.hotel.id,
          actorType: 'ai',
          actorId: this.actorId,
          action: `tool_failure:${name}`,
          entity: `tool:${name}`,
          details: result.error ?? 'unknown',
        });
      }
      return this.record(result);
    } catch (err) {
      writeAudit({
        hotelId: ctx.hotel.id,
        actorType: 'ai',
        actorId: this.actorId,
        action: `tool_error:${name}`,
        entity: `tool:${name}`,
        details: err instanceof Error ? err.message : String(err),
      });
      return this.record({ ok: false, tool: name, data: null, error: err instanceof Error ? err.message : String(err), facts: [] });
    } finally {
      const latency = Date.now() - started;
      if (latency > 100) {
        writeAudit({
          hotelId: ctx.hotel.id,
          actorType: 'ai',
          actorId: this.actorId,
          action: 'tool_slow',
          entity: `tool:${name}`,
          details: `${latency}ms`,
        });
      }
    }
  }

  private record(result: ToolResult): ToolResult {
    this.results.push(result);
    return result;
  }
}

export function okResult(tool: string, data: unknown, facts: string[], createdId?: number): ToolResult {
  const r: ToolResult = { ok: true, tool, data, facts };
  if (createdId !== undefined) r.createdId = createdId;
  return r;
}

export function errResult(tool: string, error: string): ToolResult {
  return { ok: false, tool, data: null, error, facts: [] };
}