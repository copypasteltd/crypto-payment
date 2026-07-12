import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";

async function importEgressProxyModule() {
  return import(new URL("../dist/services/egress-proxy.js", import.meta.url));
}

async function startHttpServer(handler) {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const entry = {
      method: request.method ?? "",
      url: request.url ?? "",
      headers: request.headers,
      body: Buffer.concat(chunks).toString("utf8"),
    };
    requests.push(entry);
    await handler(entry, response, requests.length);
  });

  await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve(undefined));
    server.once("error", reject);
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");

  return {
    requests,
    port: address.port,
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(undefined);
        });
      });
    },
  };
}

async function startEchoTcpServer() {
  const server = net.createServer((socket) => {
    socket.on("data", (chunk) => {
      socket.write(chunk);
    });
  });

  await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve(undefined));
    server.once("error", reject);
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");

  return {
    port: address.port,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(undefined);
        });
      });
    },
  };
}

function createProxyAuthHeader(proxyUrl) {
  return `Basic ${Buffer.from(
    `${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`,
    "utf8"
  ).toString("base64")}`;
}

async function sendHttpProxyRequest(input) {
  return await new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port: input.proxyPort,
        method: input.method,
        path: input.targetUrl,
        headers: {
          "proxy-authorization": input.proxyAuth,
          ...(input.headers ?? {}),
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );

    request.once("error", reject);
    if (input.body) {
      request.write(input.body);
    }
    request.end();
  });
}

async function sendConnectRequest(input) {
  return await new Promise((resolve, reject) => {
    const socket = net.connect(input.proxyPort, "127.0.0.1");
    let buffered = "";
    let connected = false;

    socket.once("error", reject);
    socket.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      if (!connected) {
        buffered += text;
        if (!buffered.includes("\r\n\r\n")) {
          return;
        }

        connected = true;
        if (!buffered.startsWith("HTTP/1.1 200")) {
          socket.end();
          resolve({
            statusLine: buffered.split("\r\n", 1)[0],
            tunneledPayload: null,
          });
          return;
        }

        socket.write(input.payload);
        return;
      }

      socket.end();
      resolve({
        statusLine: buffered.split("\r\n", 1)[0],
        tunneledPayload: text,
      });
    });

    socket.once("connect", () => {
      socket.write(
        `CONNECT ${input.authority} HTTP/1.1\r\nHost: ${input.authority}\r\nProxy-Authorization: ${input.proxyAuth}\r\n\r\n`
      );
    });
  });
}

test("RuntimeEgressProxyServer forwards allowlisted HTTP requests and blocks non-allowlisted targets", async () => {
  const {
    buildRuntimeEgressPolicy,
    RuntimeEgressProxyServer,
  } = await importEgressProxyModule();
  const allowedUpstream = await startHttpServer(async (entry, response) => {
    assert.equal(entry.method, "POST");
    assert.equal(entry.url, "/allowed");
    assert.equal(entry.body, JSON.stringify({ ok: true }));
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "x-egress-proxy": "allowlisted",
    });
    response.end(JSON.stringify({ accepted: true }));
  });
  const blockedUpstream = await startHttpServer(async (_entry, response) => {
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
    });
    response.end(JSON.stringify({ shouldNotReach: true }));
  });

  const proxy = new RuntimeEgressProxyServer({
    policy: buildRuntimeEgressPolicy({
      configuredAllowedBaseUrls: [`${allowedUpstream.baseUrl}/allowed`],
    }),
    host: "127.0.0.1",
  });

  try {
    await proxy.start();
    const proxyUrl = new URL(
      proxy.buildProxyEnv(["127.0.0.1", "localhost"], "127.0.0.1").HTTP_PROXY
    );
    const proxyAuth = createProxyAuthHeader(proxyUrl);

    const allowedResponse = await sendHttpProxyRequest({
      proxyPort: proxy.port,
      proxyAuth,
      method: "POST",
      targetUrl: `${allowedUpstream.baseUrl}/allowed`,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ ok: true }),
    });
    assert.equal(allowedResponse.statusCode, 200);
    assert.equal(allowedResponse.headers["x-egress-proxy"], "allowlisted");
    assert.deepEqual(JSON.parse(allowedResponse.body), { accepted: true });
    assert.equal(allowedUpstream.requests.length, 1);

    const blockedResponse = await sendHttpProxyRequest({
      proxyPort: proxy.port,
      proxyAuth,
      method: "GET",
      targetUrl: `${blockedUpstream.baseUrl}/blocked`,
    });
    assert.equal(blockedResponse.statusCode, 403);
    assert.match(blockedResponse.body, /not allowlisted/i);
    assert.equal(blockedUpstream.requests.length, 0);
  } finally {
    await proxy.stop();
    await allowedUpstream.close();
    await blockedUpstream.close();
  }
});

test("RuntimeEgressProxyServer tunnels allowlisted CONNECT requests and rejects blocked authorities", async () => {
  const {
    buildRuntimeEgressPolicy,
    RuntimeEgressProxyServer,
  } = await importEgressProxyModule();
  const allowedEcho = await startEchoTcpServer();
  const blockedEcho = await startEchoTcpServer();

  const proxy = new RuntimeEgressProxyServer({
    policy: buildRuntimeEgressPolicy({
      configuredAllowedBaseUrls: [`https://127.0.0.1:${allowedEcho.port}/`],
    }),
    host: "127.0.0.1",
  });

  try {
    await proxy.start();
    const proxyUrl = new URL(
      proxy.buildProxyEnv(["127.0.0.1", "localhost"], "127.0.0.1").HTTP_PROXY
    );
    const proxyAuth = createProxyAuthHeader(proxyUrl);

    const allowedConnect = await sendConnectRequest({
      proxyPort: proxy.port,
      proxyAuth,
      authority: `127.0.0.1:${allowedEcho.port}`,
      payload: "ping-through-connect",
    });
    assert.equal(allowedConnect.statusLine, "HTTP/1.1 200 Connection Established");
    assert.equal(allowedConnect.tunneledPayload, "ping-through-connect");

    const blockedConnect = await sendConnectRequest({
      proxyPort: proxy.port,
      proxyAuth,
      authority: `127.0.0.1:${blockedEcho.port}`,
      payload: "should-not-pass",
    });
    assert.equal(blockedConnect.statusLine, "HTTP/1.1 403 Forbidden");
    assert.equal(blockedConnect.tunneledPayload, null);
  } finally {
    await proxy.stop();
    await allowedEcho.close();
    await blockedEcho.close();
  }
});
