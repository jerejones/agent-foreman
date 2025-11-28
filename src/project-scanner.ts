/**
 * Project directory structure scanner
 * Provides basic directory structure scanning for AI analysis
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { glob } from "glob";
import type { DirectoryStructure } from "./types.js";

/**
 * Scan directory structure of a project
 */
export async function scanDirectoryStructure(basePath: string): Promise<DirectoryStructure> {
  const structure: DirectoryStructure = {
    entryPoints: [],
    srcDirs: [],
    testDirs: [],
    configFiles: [],
  };

  // Common entry points
  const entryPatterns = [
    "src/index.{ts,tsx,js,jsx}",
    "src/main.{ts,tsx,js,jsx}",
    "src/app.{ts,tsx,js,jsx}",
    "main.{go,ts,js,py}",
    "app.{py,ts,js}",
    "cmd/*/main.go",
    "server.{ts,js,py}",
    "index.{ts,js}",
  ];

  for (const pattern of entryPatterns) {
    const matches = await glob(pattern, { cwd: basePath });
    structure.entryPoints.push(...matches);
  }

  // Source directories
  const srcPatterns = ["src", "lib", "pkg", "internal", "app", "api", "core"];
  for (const dir of srcPatterns) {
    try {
      const stat = await fs.stat(path.join(basePath, dir));
      if (stat.isDirectory()) structure.srcDirs.push(dir);
    } catch {}
  }

  // Test directories
  const testPatterns = ["tests", "test", "__tests__", "spec", "e2e"];
  for (const dir of testPatterns) {
    try {
      const stat = await fs.stat(path.join(basePath, dir));
      if (stat.isDirectory()) structure.testDirs.push(dir);
    } catch {}
  }

  // Config files
  const configPatterns = [
    "*.config.{ts,js,json,mjs,cjs}",
    "tsconfig*.json",
    ".eslintrc*",
    ".prettierrc*",
    "vite.config.*",
    "next.config.*",
    "nuxt.config.*",
    "astro.config.*",
  ];

  for (const pattern of configPatterns) {
    const matches = await glob(pattern, { cwd: basePath });
    structure.configFiles.push(...matches);
  }

  return structure;
}
