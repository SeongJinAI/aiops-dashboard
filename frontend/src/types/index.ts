export interface HookLog {
  ts: string;
  hook: string;
  script: string;
  exit: number;
  ms: number;
  repo: string;
  error?: string;
  session?: string;
}

export interface PromptLog {
  ts: string;
  prompt: string;
  repo: string;
  tokens: number;
  session?: string;
}

export interface WorkflowCheckpoint {
  ts: string;
  workflow: string;
  step: string;
  stepNum: number;
  total: number;
  repo: string;
  session?: string;
}

export interface Project {
  name: string;
  url: string;
  domain: string;
  repoPath?: string;
  status: "active" | "ready" | "archived";
}

export interface RepoNode {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
  fixed: boolean;
}

export interface RepoConnection {
  from: string;
  to: string;
  label: string;
  type: "read" | "write" | "config";
  color: string;
}

export interface HealthData {
  status: string;
  activeProject: Project | null;
  hooks: {
    total: number;
    success: number;
    failed: number;
    successRate: number;
  };
  prompts: {
    total: number;
    avgTokens: number;
  };
  workflow: {
    compliance: number;
  };
  recentActivity: HookLog[];
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  text: string;
}

// --- 레포 데이터 타입 ---

export interface GitCommit {
  hash: string;
  short: string;
  message: string;
  author: string;
  date: string;
  refs: string;
}

export interface GitStats {
  totalCommits: number;
  currentBranch: string;
  last7days: number;
  hotspots: { file: string; changes: number }[];
}

export interface DocFile {
  name: string;
  path: string;
  category: string;
  modified: string;
  size: number;
}

export interface DocsData {
  total: number;
  categories: Record<string, number>;
  files: DocFile[];
}

export interface TestResult {
  name: string;
  environment: string;
  date: string;
  status: string;
  size: number;
  path: string;
}

export interface TestData {
  total: number;
  passCount: number;
  passRate: number;
  environments: Record<string, number>;
  results: TestResult[];
}

export interface PromptStats {
  total: number;
  today: number;
  avgTokens: number;
  byRepo: { repo: string; cnt: number }[];
}

// --- Claude 설정 타입 ---

export interface ClaudeConfigRule {
  name: string;
  content: string;
  size: number;
  modified: string;
}

export interface ClaudeConfigAgent {
  name: string;
  content: string;
  size: number;
  modified: string;
}

export interface ClaudeConfigSkill {
  name: string;
  description: string;
  size: number;
  modified: string;
}

export interface ClaudeConfigHook {
  event: string;
  matcher: string;
  command: string;
}

export interface ClaudeConfigHookScript {
  name: string;
  size: number;
  modified: string;
}

export interface ClaudeConfigData {
  scope: string;
  repoPath?: string;
  repoName?: string;
  sourcePath?: string;
  governancePath?: string;
  hasClaude?: boolean;
  settings: {
    exists: boolean;
    permissions: { allow?: string[]; deny?: string[] };
    plugins: string[];
    raw: Record<string, unknown> | null;
  };
  claudeMd: {
    exists: boolean;
    content: string;
    info: { size?: number; modified?: string };
  };
  rules: ClaudeConfigRule[];
  agents: ClaudeConfigAgent[];
  skills: ClaudeConfigSkill[];
  hooks: ClaudeConfigHook[];
  hookScripts?: ClaudeConfigHookScript[];
  mcp?: {
    exists: boolean;
    servers: string[];
    raw: Record<string, unknown> | null;
  };
  summary: { totalItems: number };
}
