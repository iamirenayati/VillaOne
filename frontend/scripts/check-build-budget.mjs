import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist", "client");
const budgets = {
  js: 1_250_000,
  css: 450_000,
  image: 3_000_000,
};

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(filePath));
    else files.push(filePath);
  }
  return files;
}

const files = await filesIn(root);
const violations = [];
for (const filePath of files) {
  const extension = path.extname(filePath).toLowerCase();
  const kind = extension === ".js" ? "js" : extension === ".css" ? "css" : [".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(extension) ? "image" : null;
  if (!kind) continue;
  const bytes = (await stat(filePath)).size;
  if (bytes > budgets[kind]) violations.push({ filePath, kind, bytes, budget: budgets[kind] });
}

if (violations.length) {
  console.error("Build performance budget exceeded:");
  for (const violation of violations) {
    console.error(`- ${path.relative(process.cwd(), violation.filePath)}: ${violation.bytes} bytes (budget ${violation.budget})`);
  }
  process.exit(1);
}

console.log(`Build performance budgets passed (${files.length} client files checked).`);
