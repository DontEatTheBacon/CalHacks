// Generates Convex Auth signing keys and stores them on the Convex deployment named in .env.local.
// Values go straight to `convex env set` and are never printed or written to disk.
// Usage: node scripts/setup-auth-keys.mjs [site-url]   (default http://localhost:3000)
import { execFileSync } from "node:child_process";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const siteUrl = process.argv[2] ?? "http://localhost:3000";
const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
const privatePem = await exportPKCS8(privateKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...(await exportJWK(publicKey)) }] });

function set(name, value) {
  execFileSync("npx", ["convex", "env", "set", "--", name, value], { stdio: ["ignore", "ignore", "inherit"] });
  console.log(`${name} set`);
}

set("JWT_PRIVATE_KEY", privatePem.trimEnd().replace(/\n/g, " "));
set("JWKS", jwks);
set("SITE_URL", siteUrl);
