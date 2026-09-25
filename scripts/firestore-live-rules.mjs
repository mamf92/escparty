// Prints the Firestore security rules currently released in production, so
// CI can diff them against firestore.rules before and after a deploy (see
// .github/workflows/firestore-rules.yml). firebase-tools can deploy rules but
// has no command to read the live ones back, hence this script.
//
//   GOOGLE_APPLICATION_CREDENTIALS=key.json FIREBASE_PROJECT_ID=... \
//     node scripts/firestore-live-rules.mjs > live.rules
//
// Needs a service account with read access to Firebase Rules (the
// github-rules-deployer account's Firebase Rules Admin role covers it). No
// dependencies: the OAuth token comes from a JWT signed with node:crypto.
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!keyPath || !projectId) {
  console.error("Set GOOGLE_APPLICATION_CREDENTIALS and FIREBASE_PROJECT_ID.");
  process.exit(2);
}

const key = JSON.parse(readFileSync(keyPath, "utf8"));
const tokenUri = key.token_uri ?? "https://oauth2.googleapis.com/token";

const base64url = (value) => Buffer.from(value).toString("base64url");

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: key.private_key_id }));
  const claims = base64url(JSON.stringify({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/firebase.readonly",
    aud: tokenUri,
    iat: now,
    exp: now + 600,
  }));
  const signature = createSign("RSA-SHA256")
    .update(`${header}.${claims}`)
    .sign(key.private_key, "base64url");

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()).access_token;
}

async function getJson(url, token) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

const token = await accessToken();
const api = "https://firebaserules.googleapis.com/v1";
// "cloud.firestore" is the release for the (default) database — the only one
// this app uses.
const release = await getJson(`${api}/projects/${projectId}/releases/cloud.firestore`, token);
const ruleset = await getJson(`${api}/${release.rulesetName}`, token);
const files = ruleset.source?.files ?? [];
if (files.length !== 1) {
  throw new Error(`Expected one rules file in ${release.rulesetName}, found ${files.length}`);
}

console.error(`Live ruleset: ${release.rulesetName} (released ${release.updateTime})`);
process.stdout.write(files[0].content);
