#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ASSETLINKS_PATH = path.join(ROOT, "apps/web/public/.well-known/assetlinks.json");
const AASA_PATH = path.join(ROOT, "apps/web/public/.well-known/apple-app-site-association");
const ANDROID_MANIFEST_PATH = path.join(ROOT, "apps/web/android/app/src/main/AndroidManifest.xml");
const IOS_ENTITLEMENTS_PATH = path.join(ROOT, "apps/web/ios/App/App/App.entitlements");

const DEFAULT_PACKAGE_NAME = "ao.klasse.app";
const DEFAULT_HOST = "app.klasse.ao";
const DEFAULT_PATHS = ["/aluno/*", "/professor/*"];
const PLACEHOLDERS = ["YOUR_SHA256_CERT_FINGERPRINT_HERE", "TEAM_ID.ao.klasse.app", "TEAM_ID"];

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");
const shouldCheck = args.has("--check");

if (!shouldWrite && !shouldCheck) {
  console.error("Use --write para gerar ou --check para validar.");
  process.exit(1);
}

function env(name, fallback = "") {
  return (process.env[name] ?? fallback).trim();
}

function splitList(value) {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function parseJsonFile(filePath) {
  return JSON.parse(readText(filePath));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNoPlaceholders(filePath) {
  const content = readText(filePath);
  for (const placeholder of PLACEHOLDERS) {
    assert(!content.includes(placeholder), `${filePath} ainda contem placeholder: ${placeholder}`);
  }
}

function assertFingerprint(fingerprint) {
  assert(
    /^[A-F0-9]{2}(:[A-F0-9]{2}){31}$/i.test(fingerprint),
    `Fingerprint Android invalido: ${fingerprint}. Use SHA-256 no formato AA:BB:... com 32 bytes.`,
  );
}

function buildConfigFromEnv() {
  const packageName = env("KLASSE_ANDROID_PACKAGE_NAME", DEFAULT_PACKAGE_NAME);
  const bundleId = env("KLASSE_APPLE_BUNDLE_ID", DEFAULT_PACKAGE_NAME);
  const host = env("KLASSE_DEEPLINK_HOST", DEFAULT_HOST);
  const paths = splitList(env("KLASSE_DEEPLINK_PATHS", DEFAULT_PATHS.join(",")));
  const fingerprints = splitList(env("KLASSE_ANDROID_SHA256_CERT_FINGERPRINTS"));
  const appleTeamId = env("KLASSE_APPLE_TEAM_ID");

  assert(packageName, "KLASSE_ANDROID_PACKAGE_NAME vazio.");
  assert(bundleId, "KLASSE_APPLE_BUNDLE_ID vazio.");
  assert(host, "KLASSE_DEEPLINK_HOST vazio.");
  assert(paths.length > 0, "KLASSE_DEEPLINK_PATHS vazio.");
  assert(fingerprints.length > 0, "Defina KLASSE_ANDROID_SHA256_CERT_FINGERPRINTS.");
  assert(appleTeamId, "Defina KLASSE_APPLE_TEAM_ID.");

  for (const fingerprint of fingerprints) {
    assertFingerprint(fingerprint);
  }

  return { packageName, bundleId, host, paths, fingerprints, appleTeamId };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function generate() {
  const config = buildConfigFromEnv();

  writeJson(ASSETLINKS_PATH, [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: config.packageName,
        sha256_cert_fingerprints: config.fingerprints,
      },
    },
  ]);

  writeJson(AASA_PATH, {
    applinks: {
      apps: [],
      details: [
        {
          appID: `${config.appleTeamId}.${config.bundleId}`,
          paths: config.paths,
        },
      ],
    },
  });

  console.log(`Deep links gerados para ${config.host}.`);
}

function check() {
  assertNoPlaceholders(ASSETLINKS_PATH);
  assertNoPlaceholders(AASA_PATH);

  const assetlinks = parseJsonFile(ASSETLINKS_PATH);
  assert(Array.isArray(assetlinks) && assetlinks.length > 0, "assetlinks.json deve conter pelo menos uma entrada.");
  const target = assetlinks[0]?.target;
  assert(target?.namespace === "android_app", "assetlinks.json target.namespace deve ser android_app.");
  assert(target?.package_name === DEFAULT_PACKAGE_NAME, `assetlinks.json package_name deve ser ${DEFAULT_PACKAGE_NAME}.`);
  assert(Array.isArray(target?.sha256_cert_fingerprints), "assetlinks.json deve conter sha256_cert_fingerprints.");
  for (const fingerprint of target.sha256_cert_fingerprints) {
    assertFingerprint(fingerprint);
  }

  const aasa = parseJsonFile(AASA_PATH);
  const details = aasa?.applinks?.details;
  assert(Array.isArray(details) && details.length > 0, "AASA deve conter applinks.details.");
  assert(
    details.some((entry) => typeof entry?.appID === "string" && entry.appID.endsWith(`.${DEFAULT_PACKAGE_NAME}`)),
    `AASA deve conter appID terminando em .${DEFAULT_PACKAGE_NAME}.`,
  );
  const allPaths = details.flatMap((entry) => entry?.paths ?? []);
  for (const requiredPath of DEFAULT_PATHS) {
    assert(allPaths.includes(requiredPath), `AASA deve conter path ${requiredPath}.`);
  }

  const manifest = readText(ANDROID_MANIFEST_PATH);
  assert(manifest.includes('android:autoVerify="true"'), "AndroidManifest.xml deve conter android:autoVerify=true.");
  assert(manifest.includes('android.intent.action.VIEW'), "AndroidManifest.xml deve conter action VIEW.");
  assert(manifest.includes('android.intent.category.BROWSABLE'), "AndroidManifest.xml deve conter category BROWSABLE.");
  assert(manifest.includes(`android:host="${DEFAULT_HOST}"`), `AndroidManifest.xml deve conter host ${DEFAULT_HOST}.`);

  const entitlements = readText(IOS_ENTITLEMENTS_PATH);
  assert(
    entitlements.includes(`applinks:${DEFAULT_HOST}`),
    `App.entitlements deve conter applinks:${DEFAULT_HOST}.`,
  );

  console.log("Deep links mobile validos.");
}

try {
  if (shouldWrite) generate();
  if (shouldCheck) check();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
