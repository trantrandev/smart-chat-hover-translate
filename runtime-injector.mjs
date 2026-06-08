#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const port = Number(process.env.AG_ENVI_DEBUG_PORT || 9333);
const scriptPath = new URL("./ag-envi-hover.js", import.meta.url);
const script = await readFile(scriptPath, "utf8");
const injectedTargets = new Set();
let messageId = 0;

console.log(`ag-envi-hover runtime injector listening on CDP port ${port}`);
console.log("Keep this terminal open while using Antigravity.");

while (true) {
  try {
    const targets = await getTargets();
    for (const target of targets) {
      if (!isAgentTarget(target)) continue;
      if (injectedTargets.has(target.id)) continue;

      await inject(target);
      injectedTargets.add(target.id);
      console.log(`Injected into: ${target.title || target.url || target.id}`);
    }
  } catch (err) {
    console.error("Error in injector loop:", err);
  }

  await delay(1500);
}

async function getTargets() {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) return [];
  return await response.json();
}

function isAgentTarget(target) {
  const text = `${target.title || ""} ${target.url || ""}`.toLowerCase();
  return target.type === "page"
    && (
      text.includes("workbench-jetski-agent")
      || text.includes("/workbench/workbench.html")
      || text.includes("agent manager")
      || text.includes("antigravity")
    )
    && target.webSocketDebuggerUrl;
}

async function inject(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await onceOpen(socket);

  try {
    await send(socket, "Runtime.enable");
    const result = await send(socket, "Runtime.evaluate", {
      expression: script,
      awaitPromise: false,
      includeCommandLineAPI: false,
    });
    if (result.exceptionDetails) {
      const message = result.exceptionDetails.exception?.description
        || result.exceptionDetails.text
        || "unknown Runtime.evaluate exception";
      throw new Error(message);
    }
  } finally {
    socket.close();
  }
}

function onceOpen(socket) {
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
}

function send(socket, method, params = {}) {
  const id = ++messageId;
  socket.send(JSON.stringify({ id, method, params }));

  return new Promise((resolve, reject) => {
    const onMessage = event => {
      const payload = JSON.parse(event.data);
      if (payload.id !== id) return;
      socket.removeEventListener("message", onMessage);
      if (payload.error) reject(new Error(payload.error.message));
      else resolve(payload.result);
    };

    socket.addEventListener("message", onMessage);
  });
}
