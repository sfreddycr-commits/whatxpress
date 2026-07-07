// src/services/agentLoop.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  runAgentLoop,
  AgentLoopTimeoutError,
  MAX_AGENT_ITERATIONS,
} from "./agentLoop";
import type { ToolContext } from "./agentLoop";

interface ChatResponse {
  text?: string;
  functionCalls?: Array<{ name: string; args: any }>;
}

function makeMockChat(responses: ChatResponse[]) {
  const calls: any[] = [];
  return {
    calls,
    sendMessage: vi.fn(async (msg: any) => {
      calls.push(msg);
      const next = responses.shift();
      if (!next) throw new Error("Mock chat ran out of responses");
      return next;
    }),
  };
}

function makeSpyExecutor(
  results: Record<string, any> = {}
) {
  const calls: Array<{ name: string; args: any; ctx: ToolContext }> = [];
  const executor = vi.fn(
    async (name: string, args: any, ctx: ToolContext) => {
      calls.push({ name, args, ctx });
      if (name in results) return results[name];
      return { ok: true };
    }
  );
  return { executor, calls };
}

const ctx: ToolContext = { tenantId: "test-tenant", phone: "+1234567890" };

describe("runAgentLoop", () => {
  it("returns text immediately when there are no function calls", async () => {
    const chat = makeMockChat([{ text: "hello" }]);
    const { executor, calls } = makeSpyExecutor();
    const result = await runAgentLoop(chat as any, [], executor, ctx);
    expect(result).toBe("hello");
    expect(chat.sendMessage).toHaveBeenCalledTimes(1);
    expect(executor).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("executes a single tool call and returns final text", async () => {
    const chat = makeMockChat([
      { functionCalls: [{ name: "ping", args: { x: 1 } }] },
      { text: "done" },
    ]);
    const { executor, calls } = makeSpyExecutor({ ping: { y: 2 } });
    const result = await runAgentLoop(chat as any, [], executor, ctx);
    expect(result).toBe("done");
    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor).toHaveBeenCalledWith("ping", { x: 1 }, ctx);
    expect(calls[0]).toEqual({ name: "ping", args: { x: 1 }, ctx });
    expect(chat.sendMessage).toHaveBeenCalledTimes(2);
  });

  it("executes 3 parallel tool calls in one round", async () => {
    const chat = makeMockChat([
      {
        functionCalls: [
          { name: "a", args: { n: 1 } },
          { name: "b", args: { n: 2 } },
          { name: "c", args: { n: 3 } },
        ],
      },
      { text: "all done" },
    ]);
    const { executor } = makeSpyExecutor({ a: 1, b: 2, c: 3 });
    const result = await runAgentLoop(chat as any, [], executor, ctx);
    expect(result).toBe("all done");
    expect(executor).toHaveBeenCalledTimes(3);
  });

  it("chains 2 rounds of tool calls", async () => {
    const chat = makeMockChat([
      { functionCalls: [{ name: "first", args: { q: 1 } }] },
      { functionCalls: [{ name: "second", args: { r: 2 } }] },
      { text: "chained result" },
    ]);
    const { executor } = makeSpyExecutor({ first: { ok: 1 }, second: { ok: 2 } });
    const result = await runAgentLoop(chat as any, [], executor, ctx);
    expect(result).toBe("chained result");
    expect(executor).toHaveBeenCalledTimes(2);
    expect(chat.sendMessage).toHaveBeenCalledTimes(3);
  });

  it("chains 3 rounds of tool calls", async () => {
    const chat = makeMockChat([
      { functionCalls: [{ name: "t1", args: {} }] },
      { functionCalls: [{ name: "t2", args: {} }] },
      { functionCalls: [{ name: "t3", args: {} }] },
      { text: "after 3" },
    ]);
    const { executor } = makeSpyExecutor();
    const result = await runAgentLoop(chat as any, [], executor, ctx);
    expect(result).toBe("after 3");
    expect(executor).toHaveBeenCalledTimes(3);
  });

  it("throws AgentLoopTimeoutError when MAX_ITERATIONS exceeded", async () => {
    const chat = makeMockChat([
      { functionCalls: [{ name: "loop", args: {} }] },
      { functionCalls: [{ name: "loop", args: {} }] },
      { functionCalls: [{ name: "loop", args: {} }] },
      { functionCalls: [{ name: "loop", args: {} }] },
    ]);
    const { executor } = makeSpyExecutor();
    await expect(
      runAgentLoop(chat as any, [], executor, ctx, { maxIterations: 3 })
    ).rejects.toBeInstanceOf(AgentLoopTimeoutError);
    expect(executor).toHaveBeenCalledTimes(3);
  });

  it("continues when a tool throws (default error wrapping)", async () => {
    const chat = makeMockChat([
      { functionCalls: [{ name: "bad", args: {} }] },
      { text: "recovered" },
    ]);
    const executor = vi.fn(async (name: string) => {
      if (name === "bad") throw new Error("kaboom");
      return { ok: true };
    });
    const result = await runAgentLoop(chat as any, [], executor, ctx);
    expect(result).toBe("recovered");
    expect(executor).toHaveBeenCalledTimes(1);
    // The error was sent back to the model as { error: "kaboom" }.
    const secondCall = chat.calls[1];
    expect(secondCall[0].functionResponse.response.result).toEqual({
      error: "kaboom",
    });
  });

  it("uses onToolError hook return value when provided", async () => {
    const chat = makeMockChat([
      { functionCalls: [{ name: "bad", args: {} }] },
      { text: "ok" },
    ]);
    const executor = vi.fn(async () => {
      throw new Error("original");
    });
    const onToolError = vi.fn((name: string, err: Error) => ({
      fallback: true,
      tool: name,
      msg: err.message,
    }));
    const result = await runAgentLoop(chat as any, [], executor, ctx, {
      onToolError,
    });
    expect(result).toBe("ok");
    expect(onToolError).toHaveBeenCalledWith("bad", expect.any(Error));
    const secondCall = chat.calls[1];
    expect(secondCall[0].functionResponse.response.result).toEqual({
      fallback: true,
      tool: "bad",
      msg: "original",
    });
  });

  it("unknown tool name returns error result and loop continues", async () => {
    const toolRegistryError = new Error("Tool 'mystery' not found");
    const { executeTool } = await import("./toolRegistry");
    const chat = makeMockChat([
      { functionCalls: [{ name: "mystery", args: {} }] },
      { text: "ok" },
    ]);
    const result = await runAgentLoop(
      chat as any,
      [],
      executeTool,
      ctx
    );
    expect(result).toBe("ok");
    const secondCall = chat.calls[1];
    expect(secondCall[0].functionResponse.response.result.error).toBe(
      toolRegistryError.message
    );
  });
});

describe("MAX_AGENT_ITERATIONS", () => {
  it("is exported as 5", () => {
    expect(MAX_AGENT_ITERATIONS).toBe(5);
  });
});