#!/usr/bin/env node
// Every command an RLS policy allows a role must also be granted to that role
// explicitly in supabase/schemas/core.sql (#94).
//
// The local stack's default privileges give anon and authenticated every
// command on a new table, but production's give them none, so a table that
// relies on defaults passes pgTAP and fails in production with "permission
// denied for table". A policy only filters rows the role is already granted.
//
// Usage: node scripts/check-grants.mjs [path/to/core.sql]

import { readFileSync } from "node:fs";

const COMMANDS = ["select", "insert", "update", "delete"];
const file = process.argv[2] ?? "supabase/schemas/core.sql";

const sql = readFileSync(file, "utf8")
  .replace(/\$\$[\s\S]*?\$\$/g, "$$$$") // function bodies
  .replace(/--.*$/gm, "");

const statements = sql
  .split(";")
  .map((s) => s.replace(/\s+/g, " ").trim().toLowerCase());

const table = (name) => name.replace(/^public\./, "");
const roles = (list) => list.split(",").map((r) => r.trim());

/** `${table} ${command} ${role}` → policy names that need it. */
const needed = new Map();
/** `${table} ${command} ${role}` granted explicitly (table or column level). */
const granted = new Set();

for (const s of statements) {
  const policy = s.match(
    /^create policy "([^"]+)" on ([\w.]+)(?: as \w+)?(?: for (all|select|insert|update|delete))? to ([\w, ]+?)(?: using| with check|$)/,
  );
  if (policy) {
    const [, name, t, command = "all", to] = policy;
    const commands = command === "all" ? COMMANDS : [command];
    for (const role of roles(to)) {
      if (role === "public" || role === "service_role") continue;
      for (const c of commands) {
        const key = `${table(t)} ${c} ${role}`;
        needed.set(key, [...(needed.get(key) ?? []), name]);
      }
    }
    continue;
  }

  const grant = s.match(/^grant (.+?) on (?:table )?([\w.]+) to ([\w, ]+)$/);
  if (grant && !/^(usage|execute)\b/.test(grant[1])) {
    const [, privileges, t, to] = grant;
    // "select (a, b), insert" -> ["select", "insert"]; "all [privileges]" -> all
    const commands = /^all\b/.test(privileges)
      ? COMMANDS
      : privileges
          .replace(/\([^)]*\)/g, "")
          .split(",")
          .map((p) => p.trim());
    for (const role of roles(to)) {
      for (const c of commands) granted.add(`${table(t)} ${c} ${role}`);
    }
  }
}

const missing = [...needed].filter(([key]) => !granted.has(key));

if (missing.length > 0) {
  console.error(
    `${file}: policies allow commands that are never granted. Production gives` +
      " no default privileges on new tables, so these fail with" +
      ' "permission denied for table" (#94). Add a grant next to the table:\n',
  );
  for (const [key, policies] of missing) {
    const [t, c, role] = key.split(" ");
    console.error(`  grant ${c} on ${t} to ${role};  -- ${policies.join("; ")}`);
  }
  process.exit(1);
}

console.log(`${file}: every policy's commands are granted.`);
