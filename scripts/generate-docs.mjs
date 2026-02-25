import { execSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const DOCS_SRC = "documents";
const GITHUB_BASE =
  "https://github.com/anuma-ai/starter-next/blob/main/";
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
// TypeDoc rewrites relative links (e.g. [Tools](tools)) to point at a _media
// directory (e.g. [Tools](../_media/tools)). Rewrite them back by replacing
// "_media" with "documents" so the paths resolve correctly within docs/.
const mediaLinkRe = /(\[[^\]]*\]\([^)]*?)_media([^)]*\))/g;

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
  // Rewrite _media links outside of code blocks (applied to the full text).
  const rewritten = out.replace(mediaLinkRe, "$1documents$2");
  if (rewritten !== out) changed = true;
  out = rewritten;
  if (changed) {
    writeFileSync(file, out.replace(/\n$/, ""));
  }
}

// Remove the _media directory TypeDoc creates for relative links it can't resolve.
const mediaDir = join("docs", "_media");
if (existsSync(mediaDir)) rmSync(mediaDir, { recursive: true });

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

// Inject source links into generated docs.
// Each {@includeCode} in the source becomes a code block in the output.
// We parse the source to build an ordered list telling us which code blocks
// came from {@includeCode} (with their resolved file path and region) vs
// hand-written inline blocks (null). Then we walk the generated output and
// append a source link (with line numbers) after each {@includeCode} block.
const includeCodeLine = /^\{@includeCode\s+(\S+?)(?:#(\S+))?\s*\}$/;

// Find the line range of a #region in a source file. Returns "#L<start>-L<end>"
// or "" if the region isn't found or the directive includes the whole file.
let warnings = 0;
function warn(msg) {
  console.warn(`  warn: ${msg}`);
  warnings++;
}

const regionCache = new Map();
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findRegionLines(filePath, region) {
  if (!region) return "";
  const key = `${filePath}#${region}`;
  if (regionCache.has(key)) return regionCache.get(key);

  let result = "";
  if (!existsSync(filePath)) {
    warn(`source file not found: ${filePath}`);
  } else {
    const escaped = escapeRegExp(region);
    const lines = readFileSync(filePath, "utf8").split("\n");
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (start === -1 && trimmed.match(new RegExp(`^//\\s*#region\\s+${escaped}$`))) {
        start = i + 2; // line after the marker (1-indexed)
      } else if (start !== -1 && trimmed.match(new RegExp(`^//\\s*#endregion\\s+${escaped}$`))) {
        result = `#L${start}-L${i}`;
        break;
      }
    }
    if (!result) {
      warn(`region "${region}" not found in ${filePath}`);
    }
  }
  regionCache.set(key, result);
  return result;
}

for (const outFile of collectMdFiles(DOCS_OUT)) {
  const srcFile = outFile.replace(/^docs\//, "");
  if (!existsSync(srcFile)) continue;

  // Build ordered map: one entry per code block, { path, region } or null.
  const srcContent = readFileSync(srcFile, "utf8");
  const blocks = [];
  let inSrcCode = false;
  for (const line of srcContent.split("\n")) {
    if (line.startsWith("```")) {
      if (!inSrcCode) {
        inSrcCode = true;
        blocks.push(null);
      } else {
        inSrcCode = false;
      }
      continue;
    }
    const m = line.match(includeCodeLine);
    if (m) {
      const abs = resolve(dirname(srcFile), m[1]);
      blocks.push({ path: relative(".", abs), region: m[2] || null });
    }
  }

  if (blocks.every((b) => b === null)) continue;

  // Walk generated output, inserting links after matching code blocks.
  const lines = readFileSync(outFile, "utf8").split("\n");
  const result = [];
  let inCode = false;
  let blockIdx = 0;

  for (const line of lines) {
    result.push(line);
    if (line.startsWith("```")) {
      if (!inCode) {
        inCode = true;
      } else {
        inCode = false;
        const block = blocks[blockIdx];
        if (block) {
          const fragment = findRegionLines(block.path, block.region);
          result.push(
            `\n[${block.path}](${GITHUB_BASE}${block.path}${fragment})`
          );
        }
        blockIdx++;
      }
    }
  }

  if (blockIdx !== blocks.length) {
    warn(
      `code block count mismatch in ${outFile}: expected ${blocks.length}, found ${blockIdx}`
    );
  }

  writeFileSync(outFile, result.join("\n"));
}

if (warnings > 0) {
  console.warn(`\n${warnings} warning(s) during source link injection`);
  process.exitCode = 1;
}
