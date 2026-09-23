import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { zstdCompressSync } from "node:zlib";
import { startCodexProxy } from "../src/proxy.mjs";

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

function createUpstream(received) {
  return http.createServer(async (request, response) => {
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
}

test("rewrites a real Codex model plus effort while preserving streaming", async () => {
  const received = [];
  const upstream = createUpstream(received);
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
        model: "gpt-5.6-luna",
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
    assert.equal(catalog.models[0].slug, "gpt-5.6-luna");
    assert.equal(catalog.models.some((model) => model.slug === "jev-router"), false);

    await fetch(`http://127.0.0.1:${proxy.port}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
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

test("routes a zstd-compressed Codex request as uncompressed JSON", async () => {
  const forwarded = [];
  const proxy = await startCodexProxy({
    fetchImpl: async (url, options) => {
      if (url.endsWith("/models")) return new Response(null, { status: 503 });
      forwarded.push(options);
      return new Response('event: response.created\ndata: {"type":"response.created"}\n\n', {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    },
    route: async () => ({
      choice: "gpt-5.6-sol",
      confidence: 0.95,
      metrics: { reasoningRequired: 0.95 },
    }),
  });

  try {
    const response = await fetch(`http://127.0.0.1:${proxy.port}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json", "content-encoding": "zstd" },
      body: zstdCompressSync(Buffer.from(JSON.stringify({
        model: "gpt-5.6-luna",
        input: [
          { type: "additional_tools", tools: [] },
          { role: "user", content: [{ type: "input_text", text: "Implement the authentication flow" }] },
        ],
        reasoning: { effort: "medium" },
      }))),
    });
    const responseText = await response.text();

    assert.equal(response.status, 200);
    const upstreamBody = JSON.parse(forwarded[0].body.toString());
    assert.equal(upstreamBody.model, "gpt-5.6-sol");
    assert.equal(upstreamBody.reasoning.effort, "max");
    assert.equal(forwarded[0].headers["content-encoding"], undefined);
    assert.match(responseText, /\[Jev\] routed this turn to gpt-5\.6-sol/);
  } finally {
    await proxy.close();
  }
});

test("rejects invalid or unsupported compressed routed requests", async () => {
  let upstreamCalls = 0;
  const proxy = await startCodexProxy({
    fetchImpl: async () => {
      upstreamCalls += 1;
      return new Response("unexpected upstream call", { status: 200 });
    },
  });

  try {
    for (const [encoding, body, status] of [
      ["zstd", Buffer.from("not zstd"), 400],
      ["br", Buffer.from("not brotli"), 415],
    ]) {
      const response = await fetch(`http://127.0.0.1:${proxy.port}/responses`, {
        method: "POST",
        headers: { "content-type": "application/json", "content-encoding": encoding },
        body,
      });
      await response.text();
      assert.equal(response.status, status);
    }
    assert.equal(upstreamCalls, 0);
  } finally {
    await proxy.close();
  }
});

test("explicit model forwards its compressed request unchanged", async () => {
  const forwarded = [];
  const proxy = await startCodexProxy({
    routeModels: false,
    fetchImpl: async (_url, options) => {
      forwarded.push(options);
      return new Response("ok", { status: 200 });
    },
  });
  const body = zstdCompressSync(Buffer.from(JSON.stringify({ model: "gpt-5.6-luna", input: [] })));

  try {
    const response = await fetch(`http://127.0.0.1:${proxy.port}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json", "content-encoding": "zstd" },
      body,
    });
    await response.text();

    assert.equal(response.status, 200);
    assert.deepEqual(forwarded[0].body, body);
    assert.equal(forwarded[0].headers["content-encoding"], "zstd");
  } finally {
    await proxy.close();
  }
});

test("routeModels=false preserves an explicit Codex model", async () => {
  const received = [];
  const upstream = createUpstream(received);
  const upstreamBase = await listen(upstream);
  const proxy = await startCodexProxy({
    upstreamBaseUrl: `${upstreamBase}/v1`,
    routeModels: false,
    route: async () => {
      throw new Error("Jev should not run when the model was explicitly selected");
    },
  });

  try {
    const response = await fetch(`http://127.0.0.1:${proxy.port}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        input: [
          { type: "additional_tools", tools: [] },
          { role: "user", content: [{ type: "input_text", text: "Keep this model" }] },
        ],
        reasoning: { effort: "low" },
      }),
    });
    await response.text();

    assert.equal(received[0].model, "gpt-5.6-luna");
    assert.equal(received[0].reasoning.effort, "low");
  } finally {
    await proxy.close();
    await close(upstream);
  }
});

test("rejects WebSocket upgrades with 426 so Codex falls back to HTTP", async () => {
  const proxy = await startCodexProxy();

  try {
    const statusCode = await new Promise((resolve, reject) => {
      const request = http.request({
        host: "127.0.0.1",
        port: proxy.port,
        path: "/responses",
        headers: {
          connection: "Upgrade",
          upgrade: "websocket",
        },
      });
      request.on("response", (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode));
      });
      request.on("upgrade", () => reject(new Error("proxy unexpectedly accepted WebSocket upgrade")));
      request.on("error", reject);
      request.end();
    });

    assert.equal(statusCode, 426);
  } finally {
    await proxy.close();
  }
});
