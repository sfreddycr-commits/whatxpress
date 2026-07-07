// src/services/toolRegistry.ts
import { logger } from "../lib/logger";
import * as adminHandlers from "../tools/adminHandlers";
import type { ToolContext } from "./agentLoop";

export type ToolHandler = (args: any, context: ToolContext) => Promise<any>;

// Populated via side-effect-free spread imports of all tool handler modules.
// Tasks 4–7 add additional handler modules here (customer tools).
const HANDLERS: Record<string, ToolHandler> = {
  ...adminHandlers,
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
  return handler(args, context);
}