import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createStructuredCompletion,
  extractJsonValue,
  LlmStructuredOutputError,
} from "@/lib/llm/structured-output";
import type { LlmClient, LlmCompletionRequest } from "@/lib/llm/types";

const schema = z.object({
  name: z.string().min(1),
  count: z.number().int().min(0),
}).strict();

function client(outputs: string[]): { client: LlmClient; complete: ReturnType<typeof vi.fn> } {
  const complete = vi.fn(async (_request: LlmCompletionRequest) => ({
    choices: [{ message: { content: outputs.shift() ?? "" } }],
  }));
  return {
    complete,
    client: { createCompletion: complete } as unknown as LlmClient,
  };
}

const request = {
  messages: [{ role: "user" as const, content: "Return data" }],
  reasoning: "disabled" as const,
};

const options = {
  schema,
  schemaName: "test_payload",
  schemaHint: "strict object {name:string,count:non-negative integer}",
  maxRepairAttempts: 1 as const,
};

describe("extractJsonValue", () => {
  it("extracts a balanced JSON value without changing braces inside strings", () => {
    expect(extractJsonValue('Preamble: {"name":"a } b", "count":2} trailing')).toEqual({
      name: "a } b",
      count: 2,
    });
    expect(extractJsonValue('```json\n[{"name":"x"}]\n```')).toEqual([{ name: "x" }]);
  });
});

describe("createStructuredCompletion — R3-08", () => {
  it("returns only schema-validated output without a repair call", async () => {
    const fixture = client(['```json\n{"name":"valid","count":3}\n```']);

    await expect(createStructuredCompletion(fixture.client, request, options)).resolves.toEqual({
      name: "valid",
      count: 3,
    });
    expect(fixture.complete).toHaveBeenCalledOnce();
  });

  it("performs at most one repair for schema-invalid JSON", async () => {
    const fixture = client([
      '{"name":7,"count":"wrong"}',
      '{"name":"repaired","count":4}',
    ]);

    await expect(createStructuredCompletion(fixture.client, request, options)).resolves.toEqual({
      name: "repaired",
      count: 4,
    });
    expect(fixture.complete).toHaveBeenCalledTimes(2);
    const repairRequest = fixture.complete.mock.calls[1][0] as LlmCompletionRequest;
    expect(repairRequest.temperature).toBe(0);
    expect(repairRequest.messages[0].content).toContain("untrusted data");
    expect(repairRequest.messages[1].content).toContain("schema_invalid");
  });

  it("throws a typed error after the single repair also fails", async () => {
    const fixture = client(["not-json", "still-not-json"]);

    const error = await createStructuredCompletion(fixture.client, request, options).catch((value) => value);

    expect(error).toBeInstanceOf(LlmStructuredOutputError);
    expect(error).toMatchObject({ schemaName: "test_payload", reason: "invalid_json", attempts: 2 });
    expect(error.message).not.toContain("still-not-json");
    expect(fixture.complete).toHaveBeenCalledTimes(2);
  });

  it("can disable repair and rejects valid JSON with an invalid domain shape", async () => {
    const fixture = client(['{"name":"valid","count":-2}']);

    const error = await createStructuredCompletion(fixture.client, request, {
      ...options,
      maxRepairAttempts: 0,
    }).catch((value) => value);

    expect(error).toMatchObject({ reason: "schema_invalid", attempts: 1 });
    expect(error.issues).toContain("count: too_small");
    expect(fixture.complete).toHaveBeenCalledOnce();
  });

  it("rejects oversized output without copying it into the error", async () => {
    const fixture = client([`{"name":"${"x".repeat(200)}","count":1}`]);

    const error = await createStructuredCompletion(fixture.client, request, {
      ...options,
      maxRepairAttempts: 0,
      maxRawCharacters: 100,
    }).catch((value) => value);

    expect(error).toMatchObject({ reason: "too_large", attempts: 1 });
    expect(error.message.length).toBeLessThan(200);
  });
});
