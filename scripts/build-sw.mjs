import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, relative, join } from "node:path";
const root = resolve("dist");
async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.name !== "sw.js" && !entry.name.endsWith(".map"))
      files.push(path);
  }
  return files;
}
const files = (await walk(root)).sort(),
  hash = createHash("sha256");
for (const path of files)
  hash.update(relative(root, path)).update(await readFile(path));
const template = await readFile("public/sw.js", "utf8");
hash.update(template);
const revision = hash.digest("hex").slice(0, 16);
const worker = template
  .replaceAll("__BUILD_ID__", revision)
  .replace(
    "/* __PRECACHE__ */ []",
    JSON.stringify(
      files.map((path) => relative(root, path).split("\\").join("/")),
    ),
  );
await writeFile(join(root, "sw.js"), worker);
console.log(`Offline: ${files.length} assets, revision ${revision}`);
