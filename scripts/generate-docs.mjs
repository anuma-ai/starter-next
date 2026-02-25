import { execSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const DOCS_SRC = "documents";
const DOCS_OUT = join("docs", DOCS_SRC);
const TMP_CONFIG = ".typedoc.generate.json";

// Recursively collect all directories under a root (including the root itself).
function collectDirs(root) {
  const dirs = [root];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      dirs.push(...collectDirs(join(root, entry.name)));
    }
  }
  return dirs;
}

const dirs = collectDirs(DOCS_SRC);

// Build a temporary TypeDoc config with per-directory globs.
// The ** glob is unreliable across environments, so we resolve it ourselves.
const config = JSON.parse(readFileSync("typedoc.json", "utf8"));
config.projectDocuments = dirs.map((d) => `${d}/*.md`);
writeFileSync(TMP_CONFIG, JSON.stringify(config, null, 2));

try {
  execSync("rimraf docs", { stdio: "inherit" });
  execSync(`typedoc --options ${TMP_CONFIG}`, { stdio: "inherit" });
} finally {
  if (existsSync(TMP_CONFIG)) unlinkSync(TMP_CONFIG);
}

// Strip nested #region / #endregion comment lines from generated code blocks.
// TypeDoc strips markers for the extracted region but leaves nested ones intact.
function collectMdFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectMdFiles(full));
    else if (entry.name.endsWith(".md")) files.push(full);
  }
  return files;
}

const regionLine = /^\s*\/\/\s*#(?:region|endregion)\b.*$/;

for (const file of collectMdFiles("docs")) {
  const src = readFileSync(file, "utf8");
  let out = "";
  let inCode = false;
  let changed = false;
  for (const line of src.split("\n")) {
    if (line.startsWith("```")) inCode = !inCode;
    if (inCode && regionLine.test(line)) {
      changed = true;
      continue;
    }
    out += line + "\n";
  }
  if (changed) {
    // Remove trailing extra newline added by split/join
    writeFileSync(file, out.replace(/\n$/, ""));
  }
}

// Remove the auto-generated README (we copy our own).
const generatedReadme = join("docs", "README.md");
if (existsSync(generatedReadme)) unlinkSync(generatedReadme);

// Copy project README into docs output.
copyFileSync("README.md", join(DOCS_OUT, "README.md"));

// Copy all _meta.js files to their corresponding output directories.
for (const dir of dirs) {
  const src = join(dir, "_meta.js");
  const dest = join("docs", dir, "_meta.js");
  if (existsSync(src)) {
    copyFileSync(src, dest);
  }
}
