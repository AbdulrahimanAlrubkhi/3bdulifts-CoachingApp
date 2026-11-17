// Back up or restore every progress photo (the database backup does not include the image files).
//
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/photos-backup.mjs backup  ./photos-2026-11-17
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/photos-backup.mjs restore ./photos-2026-11-17
//
// The service key bypasses all privacy rules: run this only on your own computer, paste the key into
// the terminal for that one command, never save it in a file in this project, and keep the backup
// folder somewhere private (it contains every client's photos).
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const [mode, dir] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!["backup", "restore"].includes(mode) || !dir || !url || !key) {
  console.error("Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/photos-backup.mjs <backup|restore> <folder>");
  process.exit(2);
}
const bucket = "progress-photos";
const storage = createClient(url, key, { auth: { persistSession: false } }).storage.from(bucket);

/** Every file path in the bucket (folders are listed level by level). */
async function listAll(prefix = "") {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) out.push(...(await listAll(full))); // a folder
      else out.push(full);
    }
    if (data.length < 1000) return out;
  }
}

function filesUnder(root, rel = "") {
  return fs.readdirSync(path.join(root, rel), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(root, path.join(rel, e.name)) : [path.join(rel, e.name).split(path.sep).join("/")],
  );
}

if (mode === "backup") {
  const files = await listAll();
  for (const name of files) {
    const { data, error } = await storage.download(name);
    if (error) throw new Error(`${name}: ${error.message}`);
    const target = path.join(dir, ...name.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.from(await data.arrayBuffer()));
  }
  console.log(`Backed up ${files.length} photo(s) to ${dir}`);
} else {
  const files = filesUnder(dir);
  for (const name of files) {
    const { error } = await storage.upload(name, fs.readFileSync(path.join(dir, name)), { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(`${name}: ${error.message}`);
  }
  console.log(`Restored ${files.length} photo(s) from ${dir}`);
}
