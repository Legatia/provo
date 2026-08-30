#!/usr/bin/env node
/**
 * x402 buyer — buys Provo Monitor engine credits with USDC on Base.
 *
 *   npm install x402-fetch
 *   export WALLET_PRIVATE_KEY=0x...        # funded with USDC on Base
 *   node scripts/x402-buy.mjs https://determined-eagle-361.convex.site/api/credits?credits=100
 *
 * Flow: GET → 402 with payment terms → wallet signs USDC (EIP-3009) →
 * retry with X-PAYMENT → credits minted.
 */

const url = process.argv[2] ?? "https://determined-eagle-361.convex.site/api/credits?credits=100";
const key = process.env.WALLET_PRIVATE_KEY;

if (!key) {
  console.error("Set WALLET_PRIVATE_KEY (funded with USDC on Base) and install x402-fetch:");
  console.error("  npm install x402-fetch");
  process.exit(1);
}

let fetchWithPayment;
try {
  ({ fetchWithPayment } = await import("x402-fetch"));
} catch {
  console.error("x402-fetch not installed — run: npm install x402-fetch");
  process.exit(1);
}

// x402-fetch wraps a viem wallet client for signing the USDC transfer (EIP-3009).
const { createWalletClient, http, privateKeyToAccount } = await import("viem");
const { base } = await import("viem/chains");
const account = privateKeyToAccount(key);
const walletClient = createWalletClient({ account, chain: base, transport: http() });

const paid = await fetchWithPayment(walletClient)(url, { method: "GET" });
const body = await paid.json();
console.log("status:", paid.status);
console.log(JSON.stringify(body, null, 2));
