#!/usr/bin/env node
// Minimal Streamable HTTP MCP client for the SimFuse eSIM storefront.
// No dependencies: Node 18+ only, using the built-in fetch.
//
//   node examples/plan-trip.mjs
//   node examples/plan-trip.mjs JP:7 KR:5 --currency=USD --usage=heavy
//
// Read-only. It calls initialize, tools/list and plan-trip. It never calls
// create-checkout-session, so nothing is ever bought by running this.

const ENDPOINT = 'https://api.simfuse.app/agentic/mcp';

let sessionId = null;
let nextId = 1;

async function rpc(method, params) {
  const headers = {
    'Content-Type': 'application/json',
    // Streamable HTTP servers may answer with either, so accept both.
    Accept: 'application/json, text/event-stream',
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;

  const body = { jsonrpc: '2.0', method };
  if (params !== undefined) body.params = params;
  const isNotification = method.startsWith('notifications/');
  if (!isNotification) body.id = nextId++;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const returned = res.headers.get('mcp-session-id');
  if (returned) sessionId = returned;

  if (isNotification) return null;
  if (!res.ok) throw new Error(`${method} failed: HTTP ${res.status} ${await res.text()}`);

  const text = await res.text();
  const payload = parseBody(res.headers.get('content-type') || '', text);
  if (payload.error) throw new Error(`${method} failed: ${payload.error.message}`);
  return payload.result;
}

// A Streamable HTTP server may reply with plain JSON or with a single
// SSE frame carrying the same JSON. Handle both.
function parseBody(contentType, text) {
  if (!contentType.includes('text/event-stream')) return JSON.parse(text);
  for (const line of text.split('\n')) {
    if (line.startsWith('data:')) return JSON.parse(line.slice(5).trim());
  }
  throw new Error('No data frame in SSE response');
}

async function callTool(name, args) {
  const result = await rpc('tools/call', { name, arguments: args });
  if (result.isError) throw new Error(`${name}: ${JSON.stringify(result.content)}`);
  // Every SimFuse tool returns structuredContent matching its outputSchema.
  return result.structuredContent ?? JSON.parse(result.content[0].text);
}

function parseArgs(argv) {
  const stops = [];
  const opts = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      opts[key] = value;
      continue;
    }
    const [country, days] = arg.split(':');
    stops.push({ country: country.toUpperCase(), days: Number(days || 7) });
  }
  if (stops.length === 0) {
    stops.push({ country: 'JP', days: 7 }, { country: 'KR', days: 5 });
  }
  return { stops, opts };
}

const { stops, opts } = parseArgs(process.argv.slice(2));

const init = await rpc('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'simfuse-plan-trip-example', version: '1.0.0' },
});
await rpc('notifications/initialized');

console.log(`Server: ${init.serverInfo.name} ${init.serverInfo.version} (MCP ${init.protocolVersion})`);

const { tools } = await rpc('tools/list');
console.log(`Tools:  ${tools.map((t) => t.name).join(', ')}\n`);

const trip = { stops, currency: opts.currency || 'EUR' };
if (opts.usage) trip.usage = opts.usage;
if (opts.start) trip.start = opts.start;

console.log(`Planning: ${stops.map((s) => `${s.country} ${s.days}d`).join(' -> ')}`);

const plan = await callTool('plan-trip', trip);

for (const stop of plan.trip.stops) {
  console.log(`  ${stop.country}  ${stop.arrive} to ${stop.depart}  needs about ${stop.estimated_data}`);
}

console.log('\nOptions compared:');
for (const option of plan.options) {
  const mark = option.recommended ? '*' : ' ';
  const gaps = option.complete ? '' : '  (leaves a stop uncovered)';
  console.log(`${mark} ${option.strategy.padEnd(11)} ${option.esims} eSIM(s)  ${option.total}${gaps}`);
}

const best = plan.options.find((option) => option.recommended);
console.log(`\nRecommended: ${plan.recommendation}`);
console.log(`Why: ${plan.reason}`);

if (best) {
  console.log('\nWhat to buy:');
  for (const line of best.items) {
    console.log(`  - ${line.name}`);
    console.log(`    ${line.data}, ${line.validity_days} days, ${line.price}  covers ${line.covers.join(', ')}`);
    console.log(`    plan id ${line.package_id}`);
  }
}

for (const warning of plan.warnings) console.log(`\nWarning: ${warning}`);

console.log(`\nSame trip on the site: ${plan.planner_url}`);
console.log('Pass plan.checkout.items to create-checkout-session when the traveller is ready.');
