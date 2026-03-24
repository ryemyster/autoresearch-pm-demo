// Artifact store — Manages all file I/O for the MCP discovery layer:
//   artifacts/ideas/       ← IdeaArtifact JSON (one per idea)
//   artifacts/sessions/    ← StageSession JSON (preflight state, cleared after full run)
//   artifacts/epics/       ← raw.json written by define_epic (seeds autoresearch)
//   artifacts/working/     ← templates the user drops in (auto-discovered by tools)
//
// injectArtifact() is also used by the autoresearch loop to push the best epic
// into the target project — the same function bridges both layers.

import * as fs from "fs";
import * as path from "path";
import { settings } from "../../shared/config.js";
import type { IdeaArtifact, StageSession, Epic } from "../../shared/types/index.js";

const ARTIFACTS_ROOT = settings.artifactsRoot;

// ─── Directory Helpers ────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function ideasDir(): string {
  return path.join(ARTIFACTS_ROOT, "ideas");
}

function sessionsDir(): string {
  return path.join(ARTIFACTS_ROOT, "sessions");
}

function epicsDir(ideaId: string): string {
  return path.join(ARTIFACTS_ROOT, "epics", ideaId);
}

function workingDir(): string {
  return path.join(ARTIFACTS_ROOT, "working");
}

// ─── Idea CRUD ────────────────────────────────────────────────────────────────

export function createIdea(problemStatement: string): IdeaArtifact {
  const slug = problemStatement
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40)
    .replace(/-+$/, "");
  const ts = Date.now().toString(36);
  const idea_id = `${slug}-${ts}`;
  const now = new Date().toISOString();

  const artifact: IdeaArtifact = {
    idea_id,
    created_at: now,
    updated_at: now,
    problem_statement: problemStatement,
  };

  saveIdea(artifact);
  return artifact;
}

export function loadIdea(ideaId: string): IdeaArtifact | null {
  const filePath = path.join(ideasDir(), `${ideaId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as IdeaArtifact;
}

export function saveIdea(artifact: IdeaArtifact): void {
  artifact.updated_at = new Date().toISOString();
  ensureDir(ideasDir());
  const filePath = path.join(ideasDir(), `${artifact.idea_id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(artifact, null, 2), "utf-8");
}

export function listIdeas(): IdeaArtifact[] {
  ensureDir(ideasDir());
  return fs
    .readdirSync(ideasDir())
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(ideasDir(), f), "utf-8")) as IdeaArtifact)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

// ─── Session (preflight state) ────────────────────────────────────────────────

export function saveSession(session: StageSession): void {
  ensureDir(sessionsDir());
  session.updated_at = new Date().toISOString();
  const filePath = path.join(sessionsDir(), `${session.idea_id}-${session.tool_name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2), "utf-8");
}

export function loadSession(ideaId: string, toolName: string): StageSession | null {
  const filePath = path.join(sessionsDir(), `${ideaId}-${toolName}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as StageSession;
}

export function clearSession(ideaId: string, toolName: string): void {
  const filePath = path.join(sessionsDir(), `${ideaId}-${toolName}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

// ─── Epic Output (seeds autoresearch) ────────────────────────────────────────

export function saveRawEpic(ideaId: string, epic: Epic): string {
  const dir = epicsDir(ideaId);
  ensureDir(dir);
  const filePath = path.join(dir, "raw.json");
  fs.writeFileSync(filePath, JSON.stringify(epic, null, 2), "utf-8");
  return filePath;
}

export function loadRawEpic(ideaId: string): Epic | null {
  const filePath = path.join(epicsDir(ideaId), "raw.json");
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Epic;
}

// ─── inject_artifact — writes content to an external project directory ────────
// Called by both:
//   1. develop.ts (define_epic output → docs/ of a target project, like inject_artifact in founder-os)
//   2. autoresearch/loop.ts (best epic → target project)
//
// targetDir must be an absolute path.

export function injectArtifact(targetDir: string, filename: string, content: string): string {
  if (!path.isAbsolute(targetDir)) {
    throw new Error(`targetDir must be an absolute path. Got: ${targetDir}`);
  }
  ensureDir(targetDir);
  const filePath = path.join(targetDir, filename);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

// ─── Working Templates ────────────────────────────────────────────────────────
// Users drop pre-filled markdown templates in artifacts/working/.
// Tools auto-discover the oldest matching template for their phase number.

export interface WorkingTemplate {
  filePath: string;
  content: string;
}

export function discoverWorkingTemplate(templateNum: number): WorkingTemplate | null {
  const dir = workingDir();
  if (!fs.existsSync(dir)) return null;

  const prefix = templateNum.toString().padStart(2, "0");
  const matches = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".md"))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime); // oldest first

  if (matches.length === 0) return null;

  const filePath = path.join(dir, matches[0].name);
  return { filePath, content: fs.readFileSync(filePath, "utf-8") };
}

export function extractIdeaId(templateContent: string): string | null {
  const match = templateContent.match(/##\s*Idea ID\s*\n+([^\n]+)/);
  return match ? match[1].trim() : null;
}

// Write the next phase template to artifacts/working/ with idea_id pre-filled
export function writeNextTemplate(nextNum: number, ideaId: string, priorContextSummary: string): string {
  const templateNames: Record<number, string> = {
    1: "validate-problem",
    2: "prioritize-opportunities",
    3: "define-epic",
  };
  const name = templateNames[nextNum] ?? `phase-${nextNum}`;
  const filename = `${String(nextNum).padStart(2, "0")}-${name}-${ideaId}.md`;
  const dir = workingDir();
  ensureDir(dir);

  const content = `# Phase ${nextNum}: ${name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}

## Idea ID
${ideaId}

## Prior Context
${priorContextSummary}

## Your Notes
(Add your notes here before calling the tool with proceed=true)
`;

  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

// ─── WORKFLOW_NEXT map ────────────────────────────────────────────────────────
// Maps phase number → next phase number (null = end of pipeline)
export const WORKFLOW_NEXT: Record<number, number | null> = {
  1: 2, // validate_problem → prioritize_opportunities
  2: 3, // prioritize_opportunities → define_epic
  3: null, // define_epic → run autoresearch CLI (no next template)
};
