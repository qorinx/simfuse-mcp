#!/usr/bin/env node
// Shows what buying one SimFuse eSIM over x402 would cost, without paying.
// No dependencies: Node 18+ only, using the built-in fetch.
//
//   node examples/x402-quote.mjs <plan_id>
//   node examples/x402-quote.mjs 01m0ja69csf77d26hm18vacjb4
//
// Read-only. It sends the purchase request WITHOUT a payment header, so the
// server answers 402 Payment Required with the offer and nothing is bought.
// Get a plan id from the MCP server (list-plans, get-plan, build-plan or
// plan-trip) or from GET https://simfuse.app/agentic/discovery/resources.

const BASE = 'https://simfuse.app/agentic';
const planId = process.argv[2];

if (!planId) {
  console.error('Usage: node examples/x402-quote.mjs <plan_id>');
  process.exit(1);
}

const url = `${BASE}/x402/purchase/${encodeURIComponent(planId)}`;
const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ quantity: 1 }),
});

if (res.status !== 402) {
  console.error(`Expected 402 Payment Required, got HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}

// x402 v2: the offer is base64 JSON in the PAYMENT-REQUIRED header.
const header = res.headers.get('payment-required');
if (!header) {
  console.error('No PAYMENT-REQUIRED header on the 402; x402 may be switched off right now.');
  process.exit(1);
}
const offer = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
const accepts = offer.accepts[0];

// USDC has 6 decimals, so the atomic amount 11890000 is 11.89 USDC.
const decimals = 6;
const amount = (Number(accepts.amount) / 10 ** decimals).toFixed(2);

console.log(`Resource:  ${offer.resource.url}`);
console.log(`What:      ${offer.resource.description.split(':')[0]}`);
console.log(`Pay:       ${amount} ${accepts.extra?.name ?? 'USDC'} (${accepts.amount} atomic units)`);
console.log(`Network:   ${accepts.network} (Base mainnet)`);
console.log(`Token:     ${accepts.asset}`);
console.log(`Pay to:    ${accepts.payTo}`);
console.log(`Valid for: ${accepts.maxTimeoutSeconds}s once signed`);

// The same 402 also offers card payment over MPP when it is enabled.
const mpp = res.headers.get('www-authenticate');
console.log(`Card (MPP): ${mpp && mpp.startsWith('Payment ') ? 'offered, see WWW-Authenticate' : 'not offered'}`);

console.log('\nTo buy: sign the offer as an EIP-3009 transfer and repeat this exact');
console.log('request with a PAYMENT-SIGNATURE header. See "Buying as an agent" in the README.');
