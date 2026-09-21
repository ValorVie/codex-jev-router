import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startCodexProxy } from "../src/proxy.mjs";
import { AUTO_MODEL } from "../src/catalog.mjs";

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}

test("serves a Jev model entry and rewrites model plus effort while preserving streaming", async () => {
  const received = [];
  const upstream = http.createServer(async (request, response) => {
    if (request.url === "/v1/models") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({
        models: [
          {
            slug: "gpt-5.6-luna",
            supported_reasoning_levels: [{ effort: "low" }, { effort: "medium" }],
            default_reasoning_level: "medium",
          },
          {
            slug: "gpt-5.6-sol",
            supported_reasoning_levels: [{ effort: "medium" }, { effort: "high" }, { effort: "max" }],
            default_reasoning_level: "medium",
          },
        ],
      }));
      return;
    }

    received.push(await readJson(request));
    response.setHeader("content-type", "application/octet-stream");
    response.end('event: response.created\ndata: {"type":"response.created"}\n\n');
  });
  const upstreamBase = await listen(upstream);
  const proxy = await startCodexProxy({
    upstreamBaseUrl: `${upstreamBase}/v1`,
    route: async () => ({
      choice: "gpt-5.6-sol",
      confidence: 0.95,
      metrics: { reasoningRequired: 0.95 },
    }),
  });

  try {
    const firstResponse = await fetch(`http://127.0.0.1:${proxy.port}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: AUTO_MODEL,
        prompt_cache_key: "thread-1",
        input: [
          { type: "additional_tools", tools: [] },
          { role: "user", content: [{ type: "input_text", text: "Implement the authentication flow" }] },
        ],
        reasoning: { effort: "medium" },
      }),
    });
    const firstText = await firstResponse.text();
    assert.equal(received[0].model, "gpt-5.6-sol");
    assert.equal(received[0].reasoning.effort, "max");
    assert.match(firstText, /🔹 \[Jev\] routed this turn/);
    assert.match(firstText, /\[Jev\] routed this turn to gpt-5\.6-sol/);
    assert.match(firstText, /response\.created/);
    assert.ok(firstText.indexOf("response.created") < firstText.indexOf("[Jev]"));

    const modelsResponse = await fetch(`http://127.0.0.1:${proxy.port}/models`);
    const catalog = await modelsResponse.json();
    assert.equal(catalog.models[0].slug, AUTO_MODEL);

    await fetch(`http://127.0.0.1:${proxy.port}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: AUTO_MODEL,
        prompt_cache_key: "thread-1",
        input: [
          { type: "additional_tools", tools: [] },
          { role: "user", content: [{ type: "input_text", text: "Implement the authentication flow" }] },
          { type: "function_call_output", output: "tool result" },
        ],
        reasoning: { effort: "low" },
      }),
    });
    assert.equal(received[1].model, "gpt-5.6-sol");
    assert.equal(received[1].reasoning.effort, "max");
  } finally {
    await proxy.close();
    await close(upstream);
  }
});
