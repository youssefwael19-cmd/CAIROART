// Minimal ProductEcho MCP client (JSON-RPC over HTTP, SSE-aware).
// Usage: node scripts/pe-mcp.mjs tools/list
//        node scripts/pe-mcp.mjs tools/call '{"name":"get_workspace_info","arguments":{}}'
const url = 'https://api.productecho.com/mcp';
const key = process.env.PRODUCT_ECHO_API_KEY;
if (!key) {
  console.error('PRODUCT_ECHO_API_KEY is not set');
  process.exit(1);
}

let session = null;

async function rpc(payload) {
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
  const type = res.headers.get('content-type') || '';
  if (res.status === 401 || res.status === 403) {
    console.error('HTTP', res.status, text.slice(0, 500));
    process.exit(2);
  }
  if (!type.includes('text/event-stream')) {
    try {
      return { status: res.status, body: JSON.parse(text), text };
    } catch {
      return { status: res.status, body: null, text };
    }
  }
  let found = null;
  for (const block of text.split(/\n\n/)) {
    const line = block.split('\n').find((l) => l.startsWith('data:'));
    if (!line) continue;
    try {
      const data = JSON.parse(line.slice(5).trim());
      if (data.id === payload.id) found = data;
    } catch {}
  }
  return { status: res.status, body: found, text };
}

const method = process.argv[2] || 'tools/list';
const rawParams = process.argv[3] ? JSON.parse(process.argv[3]) : {};

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
if (!init.body?.result) {
  console.error('initialize failed:', init.status, init.text.slice(0, 800));
  process.exit(3);
}
await rpc({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });

const out = await rpc({ jsonrpc: '2.0', id: 2, method, params: rawParams });
if (!out.body) {
  console.error('no JSON-RPC reply:', out.status, out.text.slice(0, 800));
  process.exit(4);
}
if (out.body.error) {
  console.error(JSON.stringify(out.body.error, null, 2));
  process.exit(5);
}
console.log(JSON.stringify(out.body.result, null, 2));
