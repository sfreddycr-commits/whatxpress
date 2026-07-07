// src/services/agentLoop.ts
import { logger } from "../lib/logger";

export const MAX_AGENT_ITERATIONS = 5;

export class AgentLoopTimeoutError extends Error {
  constructor(public readonly iterations: number) {
    super(`Agent loop exceeded ${iterations} iterations`);
    this.name = "AgentLoopTimeoutError";
  }
}

export interface ToolContext {
  tenantId: string;
  phone?: string;
}

export interface FunctionCall {
  name: string;
  args: any;
}

export interface ChatResponse {
  text?: string;
  functionCalls?: FunctionCall[];
}

export interface AgentLike {
  sendMessage(message: any): Promise<ChatResponse>;
}

export type ToolExecutor = (
  name: string,
  args: any,
  context: ToolContext
) => Promise<any>;

export interface AgentLoopOptions {
  maxIterations?: number;
  onIteration?: (i: number, calls: FunctionCall[]) => void;
  onToolError?: (name: string, err: Error) => any;
}

export async function runAgentLoop(
  chat: AgentLike,
  _tools: unknown[],
  executor: ToolExecutor,
  context: ToolContext,
  opts: AgentLoopOptions = {}
): Promise<string> {
  const maxIterations = opts.maxIterations ?? MAX_AGENT_ITERATIONS;
  let response = await chat.sendMessage({});
  let iterations = 0;

  while (iterations < maxIterations) {
    const functionCalls = response.functionCalls ?? [];

    if (functionCalls.length === 0) {
      return response.text ?? "";
    }

    const results = await Promise.all(
      functionCalls.map((call) =>
        executor(call.name, call.args, context).catch((err: Error) => {
          logger.warn(
            { tool: call.name, err: err.message, context },
            "tool_execution_failed"
          );
          return opts.onToolError
            ? opts.onToolError(call.name, err)
            : { error: err.message };
        })
      )
    );

    const parts = functionCalls.map((call, i) => ({
      functionResponse: {
        name: call.name,
        response: { result: results[i] },
      },
    }));

    iterations += 1;
    opts.onIteration?.(iterations, functionCalls);
    response = await chat.sendMessage(parts);
  }

  // Loop exhausted with pending function calls.
  throw new AgentLoopTimeoutError(iterations);
}
