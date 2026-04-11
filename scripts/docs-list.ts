import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type DocMetadata = {
  path: string;
  readWhen: string[];
};

function readFile(path: string): string {
  return readFileSync(path, "utf8");
}

function parseReadWhenFromFrontmatter(content: string): string[] {
  if (!content.startsWith("---\n")) {
    return [];
  }

  const closingIndex = content.indexOf("\n---\n", 4);
  if (closingIndex < 0) {
    return [];
  }

  const frontmatter = content.slice(4, closingIndex);
  const lines = frontmatter.split("\n");
  const readWhenIndex = lines.findIndex((line) => line.trim() === "read_when:");
  if (readWhenIndex < 0) {
    return [];
  }

  const items: string[] = [];
  for (let index = readWhenIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!line.startsWith("  - ")) {
      break;
    }
    const value = line.replace("  - ", "").trim();
    if (value) {
      items.push(value);
    }
  }

  return items;
}

function parseReadOrder(indexContent: string): string[] {
  const lines = indexContent.split("\n");
  const sectionStart = lines.findIndex((line) => line.trim() === "## Read Order (Session Start)");
  if (sectionStart < 0) {
    return [];
  }

  const section: string[] = [];
  for (let index = sectionStart + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.startsWith("## ")) {
      break;
    }
    section.push(line);
  }

  return section
    .map((line) => {
      const match = line.match(/^\d+\.\s+`([^`]+)`\s*$/u);
      return match?.[1] ?? "";
    })
    .filter(Boolean);
}

function collectDocsMetadata(root: string): DocMetadata[] {
  const docsDir = join(root, "docs");
  const files = readdirSync(docsDir)
    .filter((entry) => entry.endsWith(".md"))
    .sort((left, right) => left.localeCompare(right));

  return files.map((file) => {
    const fullPath = join(docsDir, file);
    const readWhen = parseReadWhenFromFrontmatter(readFile(fullPath));
    return {
      path: `docs/${file}`,
      readWhen
    };
  });
}

function printDocsList(root: string): void {
  const indexPath = join(root, "docs", "INDEX.md");
  const indexContent = readFile(indexPath);
  const readOrder = parseReadOrder(indexContent);
  const docs = collectDocsMetadata(root);

  console.log("Clipify docs:list");
  console.log("");
  console.log("Session Read Order");
  for (const [index, path] of readOrder.entries()) {
    console.log(`${index + 1}. ${path}`);
  }

  console.log("");
  console.log("Docs + read_when");
  for (const doc of docs) {
    if (doc.readWhen.length === 0) {
      console.log(`- ${doc.path}`);
      continue;
    }

    console.log(`- ${doc.path} :: ${doc.readWhen.join(" | ")}`);
  }
}

printDocsList(process.cwd());
