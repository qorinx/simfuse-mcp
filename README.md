# SimFuse eSIM Storefront, MCP server

Travel eSIMs for 200+ countries, as an MCP server. It lets an assistant browse
destinations, regions and data plans, read a plan's real terms (allowance,
validity, fair-use policy, hotspot, the network it runs on), check which
countries a plan actually covers, build a plan to a traveller's spec, price a
whole multi-country trip against live retail prices, and hand over a checkout
link or open a checkout session at frozen prices. After purchase it can report
an order's status, return the eSIM's QR code and install details, show data
usage and list compatible top-ups. Payment happens on
[simfuse.app](https://simfuse.app/); the server itself never charges anything.

- **Endpoint:** `https://simfuse.app/agentic/mcp`
- **Transport:** Streamable HTTP
- **Auth:** none. Catalog tools are public; order tools are scoped by the
  order id plus the email that bought it.

## Quick start

Add this to your MCP client configuration (also in [`mcp.json`](mcp.json)):

```json
{
  "mcpServers": {
    "simfuse": {
      "type": "http",
      "url": "https://simfuse.app/agentic/mcp"
    }
  }
}
```

## Connect

### Claude (claude.ai, Claude Desktop)

Open **Customize > Connectors**, click **+**, then **Add custom connector**,
paste the endpoint URL and click **Add**. Leave the OAuth fields in Advanced
settings empty, this server needs no credentials.

Claude connects from Anthropic's cloud rather than from your machine, so no
local proxy is involved.

### Claude Code

```bash
claude mcp add --transport http simfuse https://simfuse.app/agentic/mcp
```

Or in `.mcp.json`:

```json
{
  "mcpServers": {
    "simfuse": {
      "type": "http",
      "url": "https://simfuse.app/agentic/mcp"
    }
  }
}
```

The `"type"` field is required. An entry with a `url` and no `type` is read as
a stdio server and fails.

### ChatGPT

Requires a Pro, Plus, Business, Enterprise or Education account on the web.
Turn on **Developer mode** in **Settings > Security and login** (some builds
put it under **Settings > Apps & Connectors > Advanced**), then go to
`chatgpt.com/plugins`, press **+** and create a developer-mode app pointing at
the endpoint URL. Choose **No Authentication**.

### VS Code (Copilot agent mode)

In `.vscode/mcp.json`. Note the top-level key here is `servers`, not
`mcpServers`:

```json
{
  "servers": {
    "simfuse": {
      "type": "http",
      "url": "https://simfuse.app/agentic/mcp"
    }
  }
}
```

### Cursor

In `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):

```json
{
  "mcpServers": {
    "simfuse": {
      "url": "https://simfuse.app/agentic/mcp"
    }
  }
}
```

### Clients that only speak stdio

Bridge with [`mcp-remote`](https://github.com/geelen/mcp-remote):

```json
{
  "mcpServers": {
    "simfuse": {
      "command": "npx",
      "args": ["mcp-remote", "https://simfuse.app/agentic/mcp", "--transport", "http-only"]
    }
  }
}
```

### curl

```bash
curl -s https://simfuse.app/agentic/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}'

curl -s https://simfuse.app/agentic/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

## Tools

### Catalog and trip planning

| Tool | What it does | Key parameters | Read-only |
|---|---|---|---|
| `list-destinations` | Every country on sale, with the cheapest plan price for each. Turns a place name into the two-letter code the other tools take. | `search`, `currency`, `limit` | yes |
| `list-regions` | Regional and worldwide scopes with their slugs, member countries and starting prices. | `search`, `currency`, `limit` | yes |
| `get-destination-info` | One destination in summary: codes, region, plan count, price range, smallest and largest bundle, storefront page. | `destination` (required), `currency` | yes |
| `list-plans` | The plans on sale for one country or region, or a catalog-wide search narrowed by allowance, validity and price. | `destination` or `region`, `min_data_amount_mb`, `max_data_amount_mb`, `min_validity_days`, `max_validity_days`, `min_price_cents`, `max_price_cents`, `currency`, `limit` | yes |
| `get-plan` | One plan in full: allowance, validity, fair-use policy, hotspot and top-up support, network, price. | `plan_id` (required), `currency` | yes |
| `build-plan` | Finds the one real plan matching a requested data amount, validity, network and voice option, and explains any adjustment to the nearest plan on sale. | `country_code`, `data_mb`, `validity_days` (required), `network`, `voice`, `currency` | yes |
| `get-plan-coverage` | Every country a plan works in, plus any country of its own region it leaves out. | `plan_id` (required) | yes |
| `check-coverage` | A yes or no on whether one plan works in one destination. | `plan_id`, `destination` (required) | yes |
| `plan-trip` | Prices a whole trip. Compares one plan for the route against one plan per country against a mix, and returns the cheapest complete option with a reason. | `stops` (required), `usage`, `start`, `currency` | yes |

### Buying

| Tool | What it does | Key parameters | Read-only |
|---|---|---|---|
| `get-checkout-link` | The page where a person buys one plan (Apple Pay, Google Pay, card). Charges nothing; the buyer needs no account. | `plan_id` (required), `currency`, `source` | yes |
| `create-checkout-session` | Opens a checkout session for one or more plans at frozen prices and returns a bearer agent key, for an agent settling the purchase itself. Charges nothing and reserves nothing. | `items` (required), `currency`, `buyer_email`, `agent_name` | no |

### After purchase

| Tool | What it does | Key parameters | Read-only |
|---|---|---|---|
| `get-order-status` | Whether an order completed and whether its eSIMs are provisioned yet. | `order_id`, `email` (required) | yes |
| `get-esim-activation` | QR code, LPA string, SM-DP+ address and activation code, one-tap install links and a hosted install page. | `order_id`, `email` (required) | yes |
| `check-esim-usage` | Data used and remaining on one eSIM. | `order_id`, `email`, `iccid` (required) | yes |
| `list-topup-options` | Top-ups the eSIM's network will accept, with the link that opens it in the SimFuse app. Top-ups are bought in the app, not here. | `order_id`, `email`, `iccid` (required), `currency` | yes |

Good to know:

- Every tool returns `structuredContent` matching the `outputSchema` it
  publishes in `tools/list`. Read that rather than parsing the text block,
  which is the same answer serialized for clients that cannot.
- Prices are integer minor units of the currency you asked for, so `1250` in
  EUR is 12.50 EUR. Pass `currency` explicitly so you always know what you are
  quoting.
- Data allowances are megabytes. 1 GB is 1024 MB.
- Plan ids are 26-character ULIDs and only ever come from a tool response.
  Never invent one, and look destination codes up rather than guessing.
- Quotes and sessions are offers, not reservations. The charged total is
  computed at checkout, and a session's prices hold only until its
  `price_locked_until`.

## Worked example: a two-country trip

`examples/plan-trip.mjs` is a dependency-free Node script (Node 18+, using the
built-in `fetch`) that runs `initialize`, `tools/list` and one `plan-trip`.
Node was chosen because it needs no install step and no virtualenv, so the
example is a single file you can run straight from a clone. It is read-only and
never calls `create-checkout-session`.

```bash
node examples/plan-trip.mjs JP:7 KR:5
```

Real output, seven days in Japan then five in South Korea:

```
Server: SimFuse Storefront 1.2.0 (MCP 2025-06-18)
Tools:  plan-trip, list-destinations, list-regions, get-destination-info, list-plans, get-plan, build-plan, get-plan-coverage, check-coverage, get-checkout-link, create-checkout-session, get-order-status, get-esim-activation, check-esim-usage, list-topup-options

Planning: JP 7d -> KR 5d
  JP  2026-11-07 to 2026-11-14  needs about 5.5 GB
  KR  2026-11-14 to 2026-11-19  needs about 3.9 GB

Options compared:
* single      1 eSIM(s)  €10.69
  per_country 2 eSIM(s)  €22.48

Recommended: single
Why: One eSIM, Asia 10 GB - 30 days, covers all 2 stops for €10.69. It saves €11.79 over the next cheapest way to cover the route.

What to buy:
  - Asia 10 GB - 30 days
    10 GB, 30 days, €10.69  covers JP, KR
    plan id 01m0ja69csf77d26hm18vacjb4

Same trip on the site: https://simfuse.app/planner/?trip=2026-11-07.jp7r_kr5r
Pass plan.checkout.items to create-checkout-session when the traveller is ready.
```

The underlying response also carries a `checkout.items` array shaped for
`create-checkout-session`, per-stop data estimates, a `warnings` list naming any
country not covered, and the full fair-use policy for each plan. Prices and
plan ids change with the catalog, so your run will differ.

## How it fits together

The server reads the same catalog, the same pricing rules and the same currency
conversion as simfuse.app. A price quoted here is the price a person sees on the
website in that currency at that moment. `plan-trip` runs the same
recommendation engine the website's trip planner draws its comparison from, so
the two surfaces cannot quote different answers.

There is no agent-only inventory and no agent-only pricing. Checkout sessions
opened here go through the same checkout engine as a web or in-app purchase,
and the eSIM is delivered by email once payment settles.

Plans are shown with their carrier and network type. Upstream supplier
identities are not published, and the server says so rather than guessing if
asked.

## Links

- Website: https://simfuse.app/
- Agent documentation: https://simfuse.app/agent/
- Smithery listing: https://smithery.ai/servers/simfuse/esim-storefront
- mcp.so listing: https://mcp.so/servers/simfuse-esim-storefront
- Glama listing: https://glama.ai/mcp/connectors/app.simfuse.api/sim-fuse-e-sim-storefront
- Registry name: `app.simfuse/esim-storefront`
- `server.json` in this repo is the MCP registry manifest for the server.

## Licence

The contents of this repository, the documentation and the example code, are
released under the [MIT licence](LICENSE). That licence covers this repository
only. It does not cover the SimFuse service, the API, or the eSIM plans sold
through it, which are governed by the terms published on
[simfuse.app](https://simfuse.app/).
