// Shared ProductEcho MCP client. Returns the tool result payload.
const url = 'https://api.productecho.com/mcp';
let session = null;

async function rpc(payload) {
  const key = process.env.PRODUCT_ECHO_API_KEY;
  if (!key) throw new Error('PRODUCT_ECHO_API_KEY is not set');
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'PRODUCT-ECHO-API-KEY': key,
  };
  if (session) headers['mcp-session-id'] = session;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
  const sid = res.headers.get('mcp-session-id');
  if (sid) session = sid;
  const text = await res.text();
  if (res.status === 401 || res.status === 403) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  if (!text.trim()) return {};
  if (!(res.headers.get('content-type') || '').includes('text/event-stream')) {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Unreadable reply: ${text.slice(0, 300)}`);
    }
  }
  for (const block of text.split(/\n\n/)) {
    const line = block.split('\n').find((l) => l.startsWith('data:'));
    if (!line) continue;
    try {
      const data = JSON.parse(line.slice(5).trim());
      if (data.id === payload.id) return data;
    } catch {}
  }
  throw new Error(`No JSON-RPC reply: ${text.slice(0, 300)}`);
}

export async function open() {
  const init = await rpc({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'freebuff-agent', version: '1.0.0' },
    },
  });
  if (init.error) throw new Error(JSON.stringify(init.error));
  await rpc({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
}

export async function callTool(name, args = {}) {
  await open();
  const out = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: args } });
  if (out.error) throw new Error(JSON.stringify(out.error));
  const result = out.result;
  if (result?.structuredContent) return result.structuredContent;
  const text = result?.content?.[0]?.text;
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

export async function listTools() {
  await open();
  const out = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  if (out.error) throw new Error(JSON.stringify(out.error));
  return out.result.tools;
}
