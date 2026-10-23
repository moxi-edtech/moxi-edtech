import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../apps/web/src/app");
const ROUTE_ENTRY = /^(?:page|route)\.(?:[cm]?[jt]sx?)$/;

function routeSegment(segment) {
  let match = /^\[\[\.\.\.([^\]]+)\]\]$/.exec(segment);
  if (match) return { kind: "optional-catch-all", name: match[1] };
  match = /^\[\.\.\.([^\]]+)\]$/.exec(segment);
  if (match) return { kind: "catch-all", name: match[1] };
  match = /^\[([^\]\[]+)\]$/.exec(segment);
  if (match) return { kind: "dynamic", name: match[1] };
  return null;
}

function isPathlessSegment(segment) {
  return segment.startsWith("@") || (/^\([^)]*\)$/.test(segment) && !segment.startsWith("(.)"));
}

export function findDynamicRouteCollisions(appRoot = DEFAULT_APP_ROOT) {
  const entries = [];
  const walk = (directory, segments) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(resolve(directory, entry.name), [...segments, entry.name]);
      } else if (entry.isFile() && ROUTE_ENTRY.test(entry.name)) {
        entries.push([...segments, entry.name]);
      }
    }
  };
  walk(appRoot, []);

  // Route groups and parallel slots do not appear in the public pathname.
  // Normalizing ancestor dynamic names catches clashes even under different groups.
  const groups = new Map();
  for (const entry of entries) {
    const path = entry.slice(0, -1).filter((segment) => !isPathlessSegment(segment));
    const normalized = [];
    for (const segment of path) {
      const dynamic = routeSegment(segment);
      if (!dynamic) {
        normalized.push(segment);
        continue;
      }
      const key = JSON.stringify([normalized, dynamic.kind]);
      if (!groups.has(key)) {
        groups.set(key, { parent: normalized.join("/") || "/", kind: dynamic.kind, names: new Set(), files: new Set() });
      }
      const group = groups.get(key);
      group.names.add(dynamic.name);
      group.files.add(entry.join("/"));
      normalized.push("[" + dynamic.kind + "]");
    }
  }

  return [...groups.values()]
    .filter((group) => group.names.size > 1)
    .map((group) => ({
      parent: group.parent,
      kind: group.kind,
      names: [...group.names].sort(),
      files: [...group.files].sort(),
    }))
    .sort((a, b) => a.parent.localeCompare(b.parent));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const appRoot = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_APP_ROOT;
  const collisions = findDynamicRouteCollisions(appRoot);
  if (collisions.length > 0) {
    console.error("Next.js dynamic route parameter collision(s):");
    console.error(JSON.stringify(collisions, null, 2));
    process.exitCode = 1;
  } else {
    console.log("Next.js dynamic route segment names are consistent.");
  }
}
