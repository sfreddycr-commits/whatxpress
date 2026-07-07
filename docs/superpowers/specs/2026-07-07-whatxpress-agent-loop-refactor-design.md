# WhatXpress Agent Loop Refactor — Design

**Date:** 2026-07-07
**Status:** Approved (brainstorming phase complete)
**Author:** Brainstorming session with user
**Target repo:** `sfreddycr-commits/whatxpress`
**Related:** Comparison of `KitsAndVet (Kira)` and `WhatXpress` AI agent architectures

---

## 1. Problem

`src/services/aiService.ts` (701 lines) implements the WhatXpress AI agent in a single file with:

- A **misleading comment** on line 463 claiming *"supports recursive function calling"* — the actual code is a single-round `for (const call of response.functionCalls)` loop, not iterative.
- **No iteration cap**: if Gemini returns 50 tool calls, all 50 execute sequentially with no limit.
- **Tools defined inline** as TypeScript `FunctionDeclaration` objects, mixed with their execution switch and the system prompts.
- **Legacy duplicate** at `src/whatsappService.ts` (624 lines) — a separate WhatsApp bot that uses JSON-mode instead of tool calling. Only the newer `src/services/whatsappService.ts` is imported by `server.ts`, but the legacy file is shipped.

Comparison with `KitsAndVet (KiraBotService)` showed that KitsAndVet implements a real ReAct-style loop with `while (iterations < 5)`, allowing the model to chain tool calls across multiple rounds. WhatXpress's `for`-only pattern forces the model to predict all needed tools upfront in a single response.

## 2. Goal

Add a **real iterative agent loop** to WhatXpress while:

- Preserving the existing operational infrastructure (`api_pool` key rotation, `ai_config` per-tenant customization, `whatsapp_chat_control` human handoff, `customerQueues` race protection, Haversine delivery fees, transactional order writes).
- Extracting tools to dedicated files for clarity and future extensibility (e.g., a future MCP-style catalog).
- Removing the legacy duplicate code.
- Adding unit tests for the new loop.

## 3. Non-goals (explicit)

- **No streaming to client** — same single-response UX as today.
- **No dual provider (OpenAI/DeepSeek)** — Gemini SDK only.
- **No changes to DB schema** — no new tables, no migrations.
- **No feature flag for rollout** — hard cutover.
- **No MCP protocol** — Gemini `functionDeclarations` + local executor only.
- **No multi-tenant isolation changes** — tools remain scoped to `tenantId` as today.

## 4. Architecture

### File structure (after)

```
src/
├── services/
│   ├── aiService.ts        ← thin orchestrator (~150 lines)
│   ├── agentLoop.ts        ← runAgentLoop() pure function
│   ├── toolRegistry.ts     ← dispatch call.name → handler
│   └── whatsappService.ts  ← (unchanged)
├── tools/
│   ├── adminTools.ts       ← 10 admin tool declarations
│   ├── adminHandlers.ts    ← 10 admin implementations
│   ├── customerTools.ts    ← 7 customer tool declarations
│   └── customerHandlers.ts ← 7 customer implementations
```

### Agent flow

```
processCustomerWhatsAppChat(tenantId, phone, name, message, history)
  1. Build system instruction from ai_config (per tenant)
  2. Create chat session with Gemini SDK (model + tools config)
  3. runAgentLoop(chat, customerTools, toolRegistry.execute, { tenantId, phone })
       ├─ Round 1: chat.sendMessage(message)
       ├─ If response.functionCalls → executeTool(...) for each → re-feed
       ├─ Round 2: chat.sendMessage(parts)
       ├─ If still functionCalls → repeat (up to MAX_AGENT_ITERATIONS = 5)
       └─ Return response.text
  4. Log final reply to ai_logs
  5. Return finalReply
```

## 5. The agent loop (`src/services/agentLoop.ts`)

### Public API

```ts
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
  // future: db, logger, etc. passed explicitly if needed
}

export type ToolExecutor = (
  name: string,
  args: any,
  context: ToolContext
) => Promise<any>;

export interface AgentLoopOptions {
  maxIterations?: number;            // default MAX_AGENT_ITERATIONS
  onIteration?: (i: number, calls: ToolCall[]) => void;
  onToolError?: (name: string, err: Error) => any;
}

export async function runAgentLoop(
  chat: Chat,                        // @google/genai Chat instance
  tools: FunctionDeclaration[],
  executor: ToolExecutor,
  context: ToolContext,
  opts: AgentLoopOptions = {}
): Promise<string>;
```

### Behavior

```
response = await chat.sendMessage(initial)
iterations = 0
while iterations < maxIterations:
    functionCalls = extractFunctionCalls(response)
    if functionCalls is empty:
        return response.text
    results = await Promise.all(
        functionCalls.map(call =>
            executor(call.name, call.args, context)
                .catch(err => opts.onToolError?.(call.name, err)
                             ?? { error: err.message })
        )
    )
    parts = functionCalls.map((call, i) => ({
        functionResponse: { name: call.name, response: { result: results[i] } }
    }))
    response = await chat.sendMessage(parts)
    iterations++
    opts.onIteration?.(iterations, functionCalls)
if response.functionCalls still present:
    throw AgentLoopTimeoutError(iterations)
return response.text
```

### Edge cases

| Case | Handling |
|---|---|
| No function calls | Return `response.text` immediately (1 round) |
| Single round, N parallel calls | Execute via `Promise.all`, return final text |
| Chained calls across rounds | Re-feed `functionResponse` parts, loop continues |
| Tool throws | Caught → `onToolError` or `{ error: msg }` → loop continues |
| Unknown tool name | Executor returns `{ error: "Tool X not found" }` → loop continues |
| `iterations === maxIterations` with pending calls | Throw `AgentLoopTimeoutError` |
| Chat session errors (network, 429, etc.) | Bubbles up unchanged (existing `api_pool` rotation handles key-level) |

## 6. Tool registry (`src/services/toolRegistry.ts`)

```ts
import * as adminHandlers from "../tools/adminHandlers";
import * as customerHandlers from "../tools/customerHandlers";

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
  return handler(args, context);
}
```

**Naming convention:** The string `name` in each `FunctionDeclaration` MUST equal the key in `HANDLERS`. This is checked at TypeScript compile time by the `Record<string, ToolHandler>` type.

## 7. Tool files

### `src/tools/adminTools.ts` — 10 admin tools

Tools (moved verbatim from `aiService.ts:20-138`):

1. `list_tenants`
2. `get_metrics`
3. `create_tenant`
4. `create_plan`
5. `update_tenant_plan`
6. `suspend_tenant`
7. `create_table`
8. `add_dish_variant`
9. `update_kitchen_order_status`
10. `apply_promo_coupon`

### `src/tools/adminHandlers.ts` — implementations

Each handler is `(args, ctx) => Promise<any>`. Logic moved **verbatim** from the current `if/else` chain inside `processSystemAdminChat` in `aiService.ts:151-236`.

### `src/tools/customerTools.ts` — 7 customer tools

1. `consultar_menu`
2. `consultar_detalles_platillo`
3. `calcular_costo_envio`
4. `consultar_promociones`
5. `registrar_pedido_pos`
6. `consultar_estado_pedido`
7. `transferir_a_humano`

### `src/tools/customerHandlers.ts` — implementations

Logic moved **verbatim** from `processCustomerWhatsAppChat` in `aiService.ts:464-670`. The transactional `BEGIN TRANSACTION / COMMIT / ROLLBACK` block in `registrar_pedido_pos` is preserved exactly.

## 8. `aiService.ts` (after)

```ts
import { runAgentLoop, MAX_AGENT_ITERATIONS } from "./agentLoop";
import { executeTool } from "./toolRegistry";
import { adminTools } from "../tools/adminTools";
import { customerTools } from "../tools/customerTools";

// ~150 lines total

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
  return runAgentLoop(chat, adminTools, executeTool, { tenantId: "system_admin" });
}

export async function processCustomerWhatsAppChat(
  tenantId: string,
  phone: string,
  name: string,
  message: string,
  history: any[]
): Promise<string> {
  const ai = getAiClient();
  const aiConfig = await db.get("SELECT * FROM ai_config WHERE tenant_id = ?", [tenantId]);
  const chat = ai.chats.create({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: buildCashierSystemPrompt(aiConfig, tenantId),
      tools: [{ functionDeclarations: customerTools }],
    },
    history,
  });
  return runAgentLoop(chat, customerTools, executeTool, { tenantId, phone });
}

// generateAIContent() and startAPIKeyHealthChecker() preserved unchanged
```

**Removed from `aiService.ts`:**
- Inline tool declarations
- Inline `switch` / `if-else` over `call.name`
- Inline loop over `functionCalls`
- The misleading "supports recursive function calling" comment

## 9. Legacy deletion

**Delete file:** `src/whatsappService.ts` (624 lines).

**Pre-deletion validation:**
1. `grep -r "from ['\"]\./src/whatsappService['\"]" .` returns 0 matches.
2. `grep -r "from ['\"]\./src/services/whatsappService['\"]" .` returns the existing imports from `server.ts` (kept).
3. `git log --all -- src/whatsappService.ts` reviewed — no recent activity that would require keeping the file.

**Server.ts:** No changes. The active import path is `./src/services/whatsappService.js`.

## 10. Tests (`src/services/agentLoop.test.ts`)

Vitest is already configured (`vitest.config.ts`). Test cases:

1. **No function calls** — mock `chat.sendMessage` returns `{ text: "ok" }`. Expect `runAgentLoop` to return `"ok"` after 1 round.
2. **Single round, 1 tool call** — mock returns `{ functionCalls: [{ name: "x", args: {} }] }`, executor returns `{ ok: true }`, second mock returns `{ text: "done" }`. Expect executor called once with correct args; result text returned.
3. **Single round, 3 parallel tool calls** — mock returns 3 calls. Expect executor called 3 times; `Promise.all` semantics verified.
4. **Chained: 2 rounds** — mock 1 returns 1 call, mock 2 returns another call, mock 3 returns text. Expect 2 executor calls, 3 `sendMessage` calls total, final text returned.
5. **Chained: 3 rounds** — same as above but one more round.
6. **Reaches MAX_ITERATIONS with pending calls** — mock returns a new call each round; `maxIterations: 3`. Expect `AgentLoopTimeoutError(3)` thrown.
7. **Tool throws Error** — executor rejects. Expect loop continues with `{ error: msg }` result; final text returned normally.
8. **Tool throws + `onToolError` hook provided** — expect hook called with `(name, err)`, hook's return value used as result.
9. **Unknown tool name** — handler missing from registry. Expect `{ error: "Tool 'X' not found" }` returned to model; loop continues.

**Mocks:**
- `chat.sendMessage` → returns next entry from a pre-populated queue.
- `executor` → spy that records calls and returns predefined results.

## 11. Deployment

1. Local: `npm run lint:check && npm run test:ci && npm run build`
2. Commit on a feature branch (e.g., `refactor/agent-loop`), push.
3. PR review (optional — user decides).
4. Merge to `main` → Dokploy auto-deploys to `whatxpress-prod`.
5. Verify in logs: agent loop iteration markers visible.
6. Test on WhatsApp:
   - Simple message → 1 round, no iterations beyond 1.
   - Multi-step order flow → 2-3 rounds visible in logs.
   - `transferir_a_humano` → bot stops responding (existing behavior).
7. Verify `ai_logs` table continues to populate correctly.
8. Rollback path: Dokploy UI → redeploy previous deployment (<2 min).

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Tool name typo breaks dispatch | TypeScript `Record<string, ToolHandler>` enforces key match at compile time |
| Loop timeout in production | `MAX_AGENT_ITERATIONS = 5` is generous; worst case is bounded latency |
| Test mocks diverge from real Gemini behavior | Tests cover only the loop orchestration, not Gemini's responses. Real Gemini behavior validated in prod. |
| Legacy file removed breaks some hidden import | Pre-deletion grep; if any import found, update before delete |
| `Math.random()` IDs in `registrar_pedido_pos` (existing issue, not introduced) | Out of scope; preserved as-is |

## 13. Acceptance criteria

- [ ] `npm run lint:check` passes with 0 errors.
- [ ] `npm run test:ci` passes with all new test cases green.
- [ ] `npm run build` succeeds.
- [ ] `src/whatsappService.ts` is deleted; no broken imports.
- [ ] In production, a multi-step WhatsApp order produces 2+ visible iterations in app logs.
- [ ] `transferir_a_humano` still flips `whatsapp_chat_control.is_bot_active = 0`.
- [ ] API key rotation (`api_pool`) still works under load.
- [ ] No new DB tables or schema changes.

## 14. Future work (out of scope)

- Streaming responses (SSE) to client.
- OpenAI/DeepSeek dual provider routing via `ai_providers` table.
- MCP-style tool catalog in `mcp_servers` table.
- Per-tenant `max_agent_iterations` in `ai_config`.
- Tool call result logging (currently only args are logged).
- Stronger ID generation (replace `Math.random()` in `registrar_pedido_pos`).
- Fix `INSERT OR REPLACE` for PostgreSQL compatibility.