/**
 * BDIT Key Rotation Script
 *
 * Usage: npx ts-node packages/bdit/src/rotate-keys.ts
 *
 * This script generates a new key pair and outputs the environment
 * variables needed for a safe rotation:
 *
 * 1. Set PAYJARVIS_PUBLIC_KEY_PREV and PAYJARVIS_KEY_ID_PREV to current values
 * 2. Set PAYJARVIS_PUBLIC_KEY and PAYJARVIS_PRIVATE_KEY to new values
 * 3. Set PAYJARVIS_KEY_ID to new key ID
 * 4. Restart the API server
 * 5. Wait at least 5 minutes (token TTL) for old tokens to expire
 * 6. Remove PAYJARVIS_PUBLIC_KEY_PREV and PAYJARVIS_KEY_ID_PREV
 * 7. Restart again
 */

import { generateKeyPair, exportPKCS8, exportSPKI } from "jose";

async function main() {
  const env = process.env.BDIT_ENV ?? process.env.NODE_ENV ?? "production";
  const timestamp = Date.now();
  const newKeyId = `payjarvis-${env}-${timestamp}`;

  console.log("=== BDIT Key Rotation ===\n");
  console.log(`Environment: ${env}`);
  console.log(`New Key ID: ${newKeyId}\n`);

  const { publicKey, privateKey } = await generateKeyPair("RS256", {
    modulusLength: 2048,
  });

  const privatePem = await exportPKCS8(privateKey);
  const publicPem = await exportSPKI(publicKey);

  console.log("── Step 1: Add these to your .env (BEFORE removing old keys) ──\n");

  console.log("# Move current keys to PREV slots:");
  console.log(`PAYJARVIS_PUBLIC_KEY_PREV="\${PAYJARVIS_PUBLIC_KEY}"`);
  console.log(`PAYJARVIS_KEY_ID_PREV="\${PAYJARVIS_KEY_ID}"\n`);

  console.log("# Set new keys:");
  console.log(`PAYJARVIS_PRIVATE_KEY="${privatePem.replace(/\n/g, "\\n")}"`);
  console.log(`PAYJARVIS_PUBLIC_KEY="${publicPem.replace(/\n/g, "\\n")}"`);
  console.log(`PAYJARVIS_KEY_ID="${newKeyId}"\n`);

  console.log("── Step 2: Restart API server ──\n");
  console.log("pm2 restart payjarvis-api\n");

  console.log("── Step 3: Wait 5+ minutes for old tokens to expire ──\n");
  console.log("sleep 300\n");

  console.log("── Step 4: Remove PREV keys from .env ──\n");
  console.log("# Remove PAYJARVIS_PUBLIC_KEY_PREV and PAYJARVIS_KEY_ID_PREV\n");

  console.log("── Step 5: Restart again ──\n");
  console.log("pm2 restart payjarvis-api\n");

  console.log("=== Rotation complete ===");
}

main().catch(console.error);
