// src/services/toolRegistry.ts
import { logger } from "../lib/logger";
import * as adminHandlers from "../tools/adminHandlers";
import * as customerHandlers from "../tools/customerHandlers";
import type { ToolContext } from "./agentLoop";

export type ToolHandler = (args: any, context: ToolContext) => Promise<any>;

// Populated via side-effect-free spread imports of all tool handler modules.
const HANDLERS: Record<string, ToolHandler> = {
  ...adminHandlers,
  ...customerHandlers,
};

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
  logger.info({ tool: name, args, context }, "[Tool Exec] Executing tool handler");
  try {
    const result = await handler(args, context);
    logger.info({ tool: name, result }, "[Tool Exec] Tool handler result");
    return result;
  } catch (err: any) {
    logger.error({ tool: name, err: err.message || err }, "[Tool Exec] Tool handler threw error");
    throw err;
  }
}