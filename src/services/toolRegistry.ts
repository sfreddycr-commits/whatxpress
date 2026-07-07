// src/services/toolRegistry.ts
import { logger } from "../lib/logger";
import type { ToolContext } from "./agentLoop";

export type ToolHandler = (args: any, context: ToolContext) => Promise<any>;

// Populated by Tasks 4 & 5 via side-effect-free spread imports.
// Until those tasks land, HANDLERS is empty and every tool returns "not found".
const HANDLERS: Record<string, ToolHandler> = {};

export async function executeTool(
  name: string,
  args: any,
  context: ToolContext
): Promise<any> {
  const handler = HANDLERS[name];
  if (!handler) {
    logger.warn({ tool: name, context }, "unknown_tool_called");
    return { error: `Tool '${name}' not found` };
  }
  return handler(args, context);
}

export function registerHandlers(handlers: Record<string, ToolHandler>): void {
  Object.assign(HANDLERS, handlers);
}