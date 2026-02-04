# Custom Domain SDK

A production-grade TypeScript SDK for managing custom domains using Cloudflare like Custom Hostnames. This SDK is framework-agnostic, database-agnostic, and implements a strict domain lifecycle state machine.

## Features

- **Strict State Machine**: Ensures deterministic transitions (`created` → `pending_verification` → `verified` → `pending_dns` → `provisioning_ssl` → `active`).
- **Framework Agnostic**: Works in Node.js, Bun, or any other JS runtime.
- **Provider Agnostic (Persistence)**: Abstracted behind a `DomainStore` interface.
- **Provider Agnostic (DNS)**: Abstracted behind a `DnsResolver` interface.
- **Typed Errors**: Proper error handling for easier debugging.

For detailed usage, architecture, and API reference, see [DOCUMENTATION.md](DOCUMENTATION.md).

## Installation

```bash
# bun
bun add custom-domain-sdk
# npm
npm install custom-domain-sdk
# yarn
yarn add custom-domain-sdk
# pnpm
pnpm add custom-domain-sdk
```

## Quick Start

```typescript
import { 
  DomainService, 
  MemoryDomainStore, 
  NodeDnsResolver 
} from "custom-domain-sdk";

const sdk = new DomainService({
  store: new MemoryDomainStore(),
  dns: new NodeDnsResolver(),
  adapter: myCloudflareAdapter,
  cnameTarget: "edge.yourapp.com"
});

// 1. Start lifecycle
const instructions = await sdk.createDomain("customer.com");

// 2. Poll for verification
await sdk.checkVerification("customer.com");

// 3. Get DNS target
const dnsInfo = await sdk.getDnsInstructions("customer.com");

// 4. Provision SSL
await sdk.provisionDomain("customer.com");

// 5. Sync status
await sdk.syncStatus("customer.com");
```

## Domain Lifecycle

The SDK enforces the following state transitions:

1. **created**: Internal record created.
2. **pending_verification**: Waiting for TXT record verification.
3. **verified**: TXT record matched.
4. **pending_dns**: Waiting for CNAME/A record to point to our edge.
5. **provisioning_ssl**: Calling Cloudflare to issue certificates.
6. **active**: Domain is live.
7. **failed**: Terminating state for any step.

## Architecture

```mermaid
graph TD
    User([User API]) --> SDK[DomainService]
    SDK --> Store{DomainStore}
    SDK --> DNS{DnsResolver}
    SDK --> CF{CloudflareAdapter}
    
    subgraph Core
      SDK
      Store
    end
    
    subgraph Infrastructure
      DNS
      CF
    end
```

## Why this exists

Custom domains look trivial until you try to ship them properly.

At first it’s just: `"Add a TXT record, point a CNAME, redirect traffic."`

Then reality hits:

- Subdomains vs apex domains behave differently
- DNS propagation lies to you
- CNAME-only checks break with ALIAS / flattened records
- TLS provisioning is asynchronous and stateful
- Providers return half-documented statuses
- You end up rewriting the same glue code in every project

Most implementations mix all of this directly into app code, with hidden assumptions and implicit state transitions. It works.. until it doesn’t, and then it’s painful to debug.

This SDK exists to make that logic *explicit, deterministic, and reusable*.

## Non-goals

This project is intentionally scoped. If you're looking for an all-in-one platform, this is probably not it.

This SDK **does not**:

- Try to be a DNS provider

- Serve HTTP traffic or handle redirects

- Automatically retry, poll, or "eventually fix" DNS issues

- Hide provider limitations or quota constraints

- Manage databases, background jobs, or cron workers

- Abstract away infrastructure reality

It also does not attempt to:

- Guess DNS intent (CNAME vs A vs ALIAS)

- Verify ownership at parent domains for convenience

- Auto-advance states behind the scenes

- Paper over Cloudflare (or any provider) errors

Every state transition is explicit.\
Every failure is surfaced.\
Retries and polling are the caller's responsibility by design.

If you want something that "just works" by doing magic in the background, this SDK will feel strict.

## Contributing

Contributions are welcome! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started, our development workflow, and how to submit pull requests.

## License

This project is licensed under the MIT License. See the [LICENSE.md](LICENSE.md) file for details.
