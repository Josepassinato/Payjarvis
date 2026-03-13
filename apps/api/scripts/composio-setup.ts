/**
 * Composio Setup Script
 *
 * Creates connected accounts for commerce providers on Composio.
 * Run: COMPOSIO_API_KEY=xxx TICKETMASTER_API_KEY=yyy npx tsx scripts/composio-setup.ts
 *
 * This only needs to be run once per provider, or when API keys change.
 */

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;
if (!COMPOSIO_API_KEY) {
  console.error("ERROR: Set COMPOSIO_API_KEY env var");
  process.exit(1);
}

const BASE = "https://backend.composio.dev/api/v1";
const headers = {
  "x-api-key": COMPOSIO_API_KEY,
  "Content-Type": "application/json",
};

interface Provider {
  appName: string;
  appId: string;
  authScheme: string;
  envKey: string;
  fieldName: string; // Composio field name for the API key
}

const PROVIDERS: Provider[] = [
  {
    appName: "ticketmaster",
    appId: "55ca7f95-cab8-4e6a-aae5-337e0b24c274",
    authScheme: "API_KEY",
    envKey: "TICKETMASTER_API_KEY",
    fieldName: "generic_api_key",
  },
];

async function setup() {
  console.log("=== Composio Provider Setup ===\n");

  for (const provider of PROVIDERS) {
    const apiKey = process.env[provider.envKey];
    if (!apiKey) {
      console.log(`⏭  ${provider.appName}: skipped (${provider.envKey} not set)`);
      continue;
    }

    console.log(`🔧 ${provider.appName}: setting up...`);

    // 1. Find or create integration
    const intRes = await fetch(`${BASE}/integrations?appName=${provider.appName}`, { headers });
    const intData = await intRes.json() as any;
    let integrationId: string;

    if (intData.items?.length > 0) {
      integrationId = intData.items[0].id;
      console.log(`   Integration exists: ${integrationId}`);
    } else {
      const createRes = await fetch(`${BASE}/integrations`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          appId: provider.appId,
          name: `${provider.appName}-apikey`,
          authScheme: provider.authScheme,
          authConfig: {},
          useComposioAuth: false,
        }),
      });
      const createData = await createRes.json() as any;
      integrationId = createData.id;
      console.log(`   Integration created: ${integrationId}`);
    }

    // 2. Check existing connected accounts
    const connRes = await fetch(`${BASE}/connectedAccounts?integrationId=${integrationId}`, { headers });
    const connData = await connRes.json() as any;

    if (connData.items?.some((c: any) => c.status === "ACTIVE")) {
      console.log(`   ✅ Already connected and active`);
      continue;
    }

    // 3. Create connected account
    const connCreateRes = await fetch(`${BASE}/connectedAccounts`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        integrationId,
        data: { [provider.fieldName]: apiKey },
        entityId: "default",
      }),
    });
    const connCreateData = await connCreateRes.json() as any;

    if (connCreateData.id || connCreateData.connectedAccountId) {
      console.log(`   ✅ Connected account created: ${connCreateData.id || connCreateData.connectedAccountId}`);
    } else {
      console.log(`   ❌ Failed:`, JSON.stringify(connCreateData).slice(0, 200));
    }
  }

  console.log("\nDone! Events service will now use Composio for Ticketmaster.");
}

setup().catch((e) => {
  console.error("Setup failed:", e.message);
  process.exit(1);
});
