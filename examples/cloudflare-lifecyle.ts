import { DomainService } from "../src/core/domain.service";
import { InMemoryDomainStore } from "../src/core/store.memory";
import { NodeDnsResolver } from "../src/dns/dns.node";

// Pure Cloudflare Adapter using REST API
import { CloudflareAdapter } from "./adapters/cloudflare.adapter";
// Install cloudflare SDK: npm install cloudflare
// import { CloudflareAdapter } from "./adapters/cloudflare.sdk.adapter";


const CNAME_TARGET = "edge.nexonauts.com";
const CLIENT_DOMAIN = "go.kanak.eu.org";


async function main() {
  const store = new InMemoryDomainStore();
  // Fake DNS starts with no token, we inject it after createDomain
  const dns = new NodeDnsResolver();

  // ONLY WORKING WITH REAL CLOUDFLARE ACCOUNT with SSL Certificate provisioning: Edit permissions in Cloudflare Dashboard
  const cloudflare = new CloudflareAdapter(
    process.env.CLOUDFLARE_ACCOUNT_ID!,
    process.env.CLOUDFLARE_API_TOKEN!,
    process.env.CLOUDFLARE_ZONE_ID!
  );

  const service = new DomainService({
    store,
    dns,
    adapter: cloudflare,
    cnameTarget: CNAME_TARGET,
  });

  console.log("\n=== createDomain ===");
  const created = await service.createDomain(CLIENT_DOMAIN);
  console.log(created);

  // Inject verification token into fake DNS
  if (!created.verification) {
    throw new Error("Expected verification instructions");
  }
  // dns.setVerificationToken(created.verification.value);

  console.log("\n=== checkVerification ===");
  const verified = await service.checkVerification(CLIENT_DOMAIN);
  console.log(verified);
  console.log("\n=== getDnsInstructions ===");
  const dnsStep = await service.getDnsInstructions(CLIENT_DOMAIN);
  console.log(dnsStep);

  console.log("\n=== provisionDomain ===");
  const provisioning = await service.provisionDomain(CLIENT_DOMAIN);
  console.log(provisioning);

  console.log("\n=== syncStatus (1) ===");
  const pending = await service.syncStatus(CLIENT_DOMAIN);
  console.log(pending);

  console.log("\n=== syncStatus (2) ===");
  const active = await service.syncStatus(CLIENT_DOMAIN);
  console.log(active);
}

main().catch(err => {
  console.error("\n❌ Manual lifecycle failed\n", err);
  process.exit(1);
});
