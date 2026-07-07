# WhatXpress Agent Loop Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-round tool dispatch in `src/services/aiService.ts` with a real iterative agent loop (matching the pattern in `KitsAndVet/KiraBotService`), extract tools to dedicated files, and delete the legacy duplicate at `src/whatsappService.ts`.

**Architecture:** A pure `runAgentLoop()` function takes a Gemini chat session, tool declarations, and an executor function. It loops up to `MAX_AGENT_ITERATIONS = 5` times, executing tools and re-feeding results to the model until the model emits text. Tools are split into per-domain files (`src/tools/adminTools.ts`, `adminHandlers.ts`, `customerTools.ts`, `customerHandlers.ts`) and dispatched via a typed `toolRegistry`. `aiService.ts` shrinks from 701 lines to ~150.

**Tech Stack:** TypeScript (ESM, Node 20), `@google/genai` v1.29.0, Vitest (already configured), Express 4, MySQL via `pg`/`mysql2` via custom `DBWrapper`.

**Spec:** `docs/superpowers/specs/2026-07-07-whatxpress-agent-loop-refactor-design.md` (in this repo).

## Global Constraints

- **No new dependencies** — use existing `@google/genai`, `vitest`, `pino` logger.
- **No DB schema changes** — preserve all existing tables.
- **No new env vars** — keep `GEMINI_API_KEY`, `JWT_SECRET`, etc. as-is.
- **No streaming to client** — final response only, returned as a string.
- **Hardcoded `MAX_AGENT_ITERATIONS = 5`** — exported constant, no per-tenant config.
- **Naming**: handler key in `HANDLERS` registry MUST equal `FunctionDeclaration.name`. Enforced by TypeScript `Record<string, ToolHandler>`.
- **Handler signature**: `(args, ctx) => Promise<any>` — registry strips the name.
- **Git remote**: `sfreddycr-commits/whatxpress`, branch `main`. Auto-deploys via Dokploy on push.

---

### Task 1: Write agentLoop tests (TDD — failing first)

**Files:**
- Create: `src/services/agentLoop.test.ts`

**Interfaces:**
- Consumes: `runAgentLoop` (will be created in Task 2)
- Produces: 9 test cases covering all loop paths

**Context:** The agent loop must work with any object that has a `sendMessage` method (we mock it; not a real `@google/genai` Chat). The executor receives `(name, args, context)`. The function returns a string.

- [ ] **Step 1: Create `src/services/agentLoop.test.ts` with all 9 test cases**

Write the full file below. The mocks at the top build a fake `chat` object whose `sendMessage` pops from a pre-loaded queue; the `executor` is a spy that returns predefined results.

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail (missing implementation)**

```bash
cd /root/workspace/whatxpress
npx vitest run src/services/agentLoop.test.ts
```

Expected: FAIL with errors like `Cannot find module './agentLoop'` or `Cannot find module './toolRegistry'`.

- [ ] **Step 3: Commit the failing tests**

```bash
cd /root/workspace/whatxpress
git add src/services/agentLoop.test.ts
git commit -m "test: add failing tests for runAgentLoop"
```

---

### Task 2: Implement runAgentLoop to make tests pass

**Files:**
- Create: `src/services/agentLoop.ts`

**Interfaces:**
- Consumes: a chat object with `sendMessage(msg): Promise<{ text?, functionCalls? }>`
- Produces: `runAgentLoop(chat, tools, executor, context, opts) => Promise<string>`, exports `MAX_AGENT_ITERATIONS = 5` and class `AgentLoopTimeoutError`.

- [ ] **Step 1: Create `src/services/agentLoop.ts`**

```ts
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
```

- [ ] **Step 2: Run tests — expect failures only on "unknown tool" test (toolRegistry not yet created)**

```bash
cd /root/workspace/whatxpress
npx vitest run src/services/agentLoop.test.ts
```

Expected: 8 of 9 tests pass. The "unknown tool name" test fails because `./toolRegistry` does not exist. (`MAX_AGENT_ITERATIONS` test passes by definition.)

- [ ] **Step 3: Commit the loop implementation**

```bash
cd /root/workspace/whatxpress
git add src/services/agentLoop.ts
git commit -m "feat: add runAgentLoop pure function with iteration cap"
```

---

### Task 3: Create minimal `toolRegistry` (unblocks the last test)

**Files:**
- Create: `src/services/toolRegistry.ts`

**Interfaces:**
- Consumes: handler modules from `src/tools/adminHandlers.ts` and `src/tools/customerHandlers.ts` (Tasks 4 and 5)
- Produces: `executeTool(name, args, context): Promise<any>` returning `{ error: "..." }` for unknown names

- [ ] **Step 1: Create a placeholder `toolRegistry.ts`**

The handlers don't exist yet, but the registry needs to exist for the test in Task 1. Create a minimal version that returns "not found" for everything (the admin/customer handler modules will be added in Tasks 4–5; they will populate `HANDLERS` via re-export).

```ts
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
```

- [ ] **Step 2: Run tests — all 9 should now pass**

```bash
cd /root/workspace/whatxpress
npx vitest run src/services/agentLoop.test.ts
```

Expected: 9 tests pass.

- [ ] **Step 3: Run lint**

```bash
cd /root/workspace/whatxpress
npm run lint:check
```

Expected: 0 errors. (If the logger import path differs, see "Implementation notes" at the end of this plan.)

- [ ] **Step 4: Commit**

```bash
cd /root/workspace/whatxpress
git add src/services/toolRegistry.ts
git commit -m "feat: add tool registry skeleton with registerHandlers"
```

---

### Task 4: Extract admin tool declarations

**Files:**
- Create: `src/tools/adminTools.ts`

**Interfaces:**
- Produces: `adminTools: FunctionDeclaration[]` and `adminToolNames: string[]`

**Context:** The 10 tool declarations currently live inline at `src/services/aiService.ts` lines 20–138. The engineer must read that range verbatim and copy each `FunctionDeclaration` into the new file without modification.

- [ ] **Step 1: Read the current admin tool declarations**

```bash
sed -n '20,138p' /root/workspace/whatxpress/src/services/aiService.ts
```

Expected: 10 `FunctionDeclaration` objects named `list_tenants`, `get_metrics`, `create_tenant`, `create_plan`, `update_tenant_plan`, `suspend_tenant`, `create_table`, `add_dish_variant`, `update_kitchen_order_status`, `apply_promo_coupon`.

- [ ] **Step 2: Create `src/tools/adminTools.ts` with the declarations copied verbatim**

```ts
// src/tools/adminTools.ts
import type { FunctionDeclaration } from "@google/genai";

// PASTE THE 10 FunctionDeclaration OBJECTS VERBATIM from aiService.ts:20-138 here.
// Do not change names, descriptions, or parameter schemas.

export const adminTools: FunctionDeclaration[] = [
  // ... 10 entries copied verbatim ...
];

export const adminToolNames = adminTools.map((t) => t.name);
```

(Engineer: replace the comment block with the actual 10 declarations.)

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /root/workspace/whatxpress
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd /root/workspace/whatxpress
git add src/tools/adminTools.ts
git commit -m "refactor: extract admin tool declarations to src/tools/adminTools.ts"
```

---

### Task 5: Extract admin handlers and register them

**Files:**
- Create: `src/tools/adminHandlers.ts`

**Interfaces:**
- Produces: a module whose named exports are the 10 handler functions, each `(args, ctx) => Promise<any>`.

**Context:** The 10 implementations currently live inline at `src/services/aiService.ts` lines 151–236 inside `processSystemAdminChat`. The exact logic (including the SQL and logger calls) must be copied verbatim into named exports.

- [ ] **Step 1: Read the current admin handler implementations**

```bash
sed -n '151,236p' /root/workspace/whatxpress/src/services/aiService.ts
```

Expected: a sequence of `if (call.name === "...")` branches that handle each tool name.

- [ ] **Step 2: Create `src/tools/adminHandlers.ts` with the logic as named exports**

```ts
// src/tools/adminHandlers.ts
import { db } from "../db";
import { logger } from "../lib/logger";
import type { ToolContext } from "../services/agentLoop";

// One named export per tool. Names MUST match FunctionDeclaration.name exactly.
// PASTE the body of each `if (call.name === "X")` branch as the body of
// `export async function X(args, ctx) { ... }`. Replace `call.args.X` with `args.X`.
// Pass `ctx` through to any DB call that previously used tenantId from closure.

export async function list_tenants(args: any, ctx: ToolContext) {
  // ... body verbatim from aiService.ts ...
}

// ... 9 more handlers ...
```

(Engineer: copy each branch verbatim, parameterize by `(args, ctx)`. Use `ctx.tenantId` where the original closure passed `tenantId`.)

- [ ] **Step 3: Wire the handlers into the registry**

Modify `src/services/toolRegistry.ts` to import and register the admin handlers:

```ts
// Replace the empty `const HANDLERS` block with:
import * as adminHandlers from "../tools/adminHandlers";

const HANDLERS: Record<string, ToolHandler> = {
  ...adminHandlers,
};
```

Remove the placeholder `registerHandlers` function (it is no longer needed once the imports are static). Keep `executeTool` unchanged.

- [ ] **Step 4: Verify compile and tests still pass**

```bash
cd /root/workspace/whatxpress
npm run lint:check && npx vitest run src/services/agentLoop.test.ts
```

Expected: 0 lint errors, 9 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /root/workspace/whatxpress
git add src/tools/adminHandlers.ts src/services/toolRegistry.ts
git commit -m "refactor: extract admin handlers and register them"
```

---

### Task 6: Extract customer tool declarations

**Files:**
- Create: `src/tools/customerTools.ts`

**Interfaces:**
- Produces: `customerTools: FunctionDeclaration[]` and `customerToolNames: string[]`

**Context:** The 7 customer tool declarations currently live inline at `src/services/aiService.ts` lines 354–430. Copy them verbatim.

- [ ] **Step 1: Read the current customer tool declarations**

```bash
sed -n '354,430p' /root/workspace/whatxpress/src/services/aiService.ts
```

Expected: 7 `FunctionDeclaration` objects: `consultar_menu`, `consultar_detalles_platillo`, `calcular_costo_envio`, `consultar_promociones`, `registrar_pedido_pos`, `consultar_estado_pedido`, `transferir_a_humano`.

- [ ] **Step 2: Create `src/tools/customerTools.ts`**

```ts
// src/tools/customerTools.ts
import type { FunctionDeclaration } from "@google/genai";

// PASTE THE 7 FunctionDeclaration OBJECTS VERBATIM from aiService.ts:354-430 here.

export const customerTools: FunctionDeclaration[] = [
  // ... 7 entries ...
];

export const customerToolNames = customerTools.map((t) => t.name);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /root/workspace/whatxpress
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd /root/workspace/whatxpress
git add src/tools/customerTools.ts
git commit -m "refactor: extract customer tool declarations to src/tools/customerTools.ts"
```

---

### Task 7: Extract customer handlers and register them

**Files:**
- Create: `src/tools/customerHandlers.ts`
- Modify: `src/services/toolRegistry.ts`

**Interfaces:**
- Produces: 7 named handler exports matching the `customerToolNames` array.
- Preserves: the transactional `BEGIN TRANSACTION / COMMIT / ROLLBACK` block in `registrar_pedido_pos`.

- [ ] **Step 1: Read the current customer handler implementations**

```bash
sed -n '464,670p' /root/workspace/whatxpress/src/services/aiService.ts
```

Expected: the large dispatcher block at the bottom of `processCustomerWhatsAppChat` containing the 7 tool handlers.

- [ ] **Step 2: Create `src/tools/customerHandlers.ts`**

```ts
// src/tools/customerHandlers.ts
import { db } from "../db";
import { logger } from "../lib/logger";
import type { ToolContext } from "../services/agentLoop";

// One named export per tool. Names MUST match FunctionDeclaration.name exactly.
// PASTE the body of each `if (call.name === "X")` branch as the body of
// `export async function X(args, ctx) { ... }`. Preserve BEGIN TRANSACTION /
// COMMIT / ROLLBACK verbatim. Use ctx.tenantId and ctx.phone where needed.

export async function consultar_menu(args: any, ctx: ToolContext) {
  // ...
}

// ... 6 more handlers, including the long transactional registrar_pedido_pos ...
```

(Engineer: copy the 7 branches verbatim, parameterize by `(args, ctx)`. Keep `Math.random()` ID generation as-is — out of scope for this refactor.)

- [ ] **Step 3: Register customer handlers in the registry**

Edit `src/services/toolRegistry.ts`:

```ts
import * as adminHandlers from "../tools/adminHandlers";
import * as customerHandlers from "../tools/customerHandlers";

const HANDLERS: Record<string, ToolHandler> = {
  ...adminHandlers,
  ...customerHandlers,
};
```

- [ ] **Step 4: Verify everything compiles**

```bash
cd /root/workspace/whatxpress
npm run lint:check && npx vitest run
```

Expected: 0 lint errors, all tests pass (agentLoop.test.ts × 9).

- [ ] **Step 5: Commit**

```bash
cd /root/workspace/whatxpress
git add src/tools/customerHandlers.ts src/services/toolRegistry.ts
git commit -m "refactor: extract customer handlers and register them"
```

---

### Task 8: Refactor `aiService.ts` to use new components

**Files:**
- Modify: `src/services/aiService.ts` — replace inline tools and loop with imports + `runAgentLoop`.

**Interfaces:**
- Preserves the public API: `processSystemAdminChat`, `processCustomerWhatsAppChat`, `generateAIContent`, `startAPIKeyHealthChecker`, `getAiClient`.
- Removes inline tool declarations, inline handler switch, inline `for` loop over `functionCalls`, and the misleading "supports recursive function calling" comment.

- [ ] **Step 1: Read the current `processSystemAdminChat` (lines ~10–250)**

```bash
sed -n '1,250p' /root/workspace/whatxpress/src/services/aiService.ts
```

- [ ] **Step 2: Replace the body of `processSystemAdminChat`**

Replace the entire function body (everything between `export async function processSystemAdminChat(` and the next `export`) with:

```ts
export async function processSystemAdminChat(message: string): Promise<string> {
  const ai = getAiClient();
  const chat = ai.chats.create({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: ADMIN_SYSTEM_PROMPT,
      tools: [{ functionDeclarations: adminTools }],
    },
    history: await loadAdminHistory(),
  });
  return runAgentLoop(chat, adminTools, executeTool, {
    tenantId: "system_admin",
  });
}
```

Add at the top of the file (preserving the existing imports):

```ts
import { runAgentLoop } from "./agentLoop";
import { executeTool } from "./toolRegistry";
import { adminTools } from "../tools/adminTools";
import { customerTools } from "../tools/customerTools";
```

Keep the `ADMIN_SYSTEM_PROMPT` constant and `loadAdminHistory` helper unchanged.

- [ ] **Step 3: Replace the body of `processCustomerWhatsAppChat`**

Find the function (around line 320+) and replace its body (everything after the function signature and before the next `export`) with:

```ts
export async function processCustomerWhatsAppChat(
  tenantId: string,
  phone: string,
  name: string,
  message: string,
  history: any[]
): Promise<string> {
  const ai = getAiClient();
  const aiConfig = await db.get(
    "SELECT * FROM ai_config WHERE tenant_id = ?",
    [tenantId]
  );
  const chat = ai.chats.create({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: buildCashierSystemPrompt(aiConfig, tenantId),
      tools: [{ functionDeclarations: customerTools }],
    },
    history,
  });
  return runAgentLoop(chat, customerTools, executeTool, {
    tenantId,
    phone,
  });
}
```

Keep `buildCashierSystemPrompt` unchanged.

- [ ] **Step 4: Delete the inline tool declarations and inline dispatcher**

Delete the 10 `adminTools` declarations (lines 20–138) and the 7 `customerTools` declarations (lines 354–430).

Delete the `if (call.name === "...")` switch blocks inside both functions (lines 151–236 for admin, 464–670 for customer). Their bodies now live in `src/tools/{admin,customer}Handlers.ts`.

Delete the misleading comment line that says *"supports recursive function calling"*.

`aiService.ts` should now be ~150 lines.

- [ ] **Step 5: Verify lint + tests + build**

```bash
cd /root/workspace/whatxpress
npm run lint:check && npm run test:ci && npm run build
```

Expected: 0 lint errors, all tests pass, build succeeds.

- [ ] **Step 6: Commit**

```bash
cd /root/workspace/whatxpress
git add src/services/aiService.ts
git commit -m "refactor: use runAgentLoop + extracted tools in aiService.ts"
```

---

### Task 9: Delete legacy `src/whatsappService.ts`

**Files:**
- Delete: `src/whatsappService.ts` (624 lines)

**Interfaces:**
- No public API change. `server.ts` already imports `./src/services/whatsappService.js`.

- [ ] **Step 1: Verify no imports reference the legacy path**

```bash
cd /root/workspace/whatxpress
grep -rn "src/whatsappService['\"]" src/ server.ts 2>/dev/null
grep -rn "from ['\"]\./whatsappService['\"]" src/ server.ts 2>/dev/null
```

Expected: 0 matches for both commands. (If any match exists, fix the imports to use `./src/services/whatsappService.js` and re-run before deletion.)

- [ ] **Step 2: Delete the file**

```bash
cd /root/workspace/whatxpress
git rm src/whatsappService.ts
```

- [ ] **Step 3: Verify build still works**

```bash
cd /root/workspace/whatxpress
npm run build
```

Expected: build succeeds. (The 624-line legacy file is gone; the active `src/services/whatsappService.ts` is untouched.)

- [ ] **Step 4: Commit**

```bash
cd /root/workspace/whatxpress
git commit -m "chore: delete legacy src/whatsappService.ts (624 lines)"
```

---

### Task 10: Final verification and deploy

**Files:** none modified — this task only runs validation and pushes.

- [ ] **Step 1: Run full CI pipeline locally**

```bash
cd /root/workspace/whatxpress
npm run lint:check && npm run test:ci && npm run build
```

Expected: all 3 commands exit 0.

- [ ] **Step 2: Push to main**

```bash
cd /root/workspace/whatxpress
git push origin main
```

Expected: Dokploy auto-deploys `whatxpress-prod` within ~2 minutes.

- [ ] **Step 3: Verify deployment in Dokploy logs**

Look for new log lines indicating the agent loop ran. If absent, redeploy manually from Dokploy UI.

- [ ] **Step 4: Test on WhatsApp**

Send a simple message ("hola") — should get 1 reply, agent loop should run for 1 round.

Send a multi-step order ("quiero 2 hamburguesas para delivery a Av. Reforma 123") — should see 2–3 iterations in logs as `consultar_menu` → `calcular_costo_envio` → `registrar_pedido_pos` chain.

Send a request that triggers `transferir_a_humano` — bot should stop responding after that.

- [ ] **Step 5: Verify `ai_logs` table populates correctly**

```sql
SELECT COUNT(*), MAX(timestamp) FROM ai_logs WHERE timestamp > NOW() - INTERVAL '1 hour';
```

Expected: count > 0, max timestamp recent.

---

## Implementation notes (for the engineer)

- **Logger path**: `src/lib/logger.ts` exports `logger`. If `pino` is not configured yet, fall back to `console`. Check `src/services/aiService.ts` line ~5 for the existing import pattern.
- **`db` wrapper**: `src/db.ts` exports a singleton `db` with `db.get(sql, params)`, `db.all(sql, params)`, `db.run(sql, params)`. Do NOT introduce raw SQL strings that bypass it.
- **`@google/genai` types**: `FunctionDeclaration` is exported from `@google/genai`. `Chat` is the type returned by `ai.chats.create({...}).sendMessage(msg)`. In tests we use `as any` to avoid coupling to the SDK's exact return shape.
- **WhatsApp message queue**: `customerQueues[phone]` serialization in `src/services/whatsappService.ts` is independent of the agent loop and should be preserved. Do not move queue logic into `agentLoop.ts`.
- **API key rotation**: `startAPIKeyHealthChecker()` and the failover in `getAiClient()` stay in `aiService.ts`. They are orthogonal to the loop.
- **Hardcoded Spanish comments** in the original handlers (e.g. comments referencing "tenant") should be preserved verbatim when extracting handlers. Only variable references change (`call.name` → function name, `call.args.x` → `args.x`).
- **No trailing newlines, no format changes** in copied code beyond the wrapping function signature. The point of "verbatim" is to make code review trivial.

## Acceptance criteria (from spec §13)

- [ ] `npm run lint:check` passes with 0 errors.
- [ ] `npm run test:ci` passes with all new test cases green.
- [ ] `npm run build` succeeds.
- [ ] `src/whatsappService.ts` is deleted; no broken imports.
- [ ] In production, a multi-step WhatsApp order produces 2+ visible iterations in app logs.
- [ ] `transferir_a_humano` still flips `whatsapp_chat_control.is_bot_active = 0`.
- [ ] API key rotation (`api_pool`) still works under load.
- [ ] No new DB tables or schema changes.