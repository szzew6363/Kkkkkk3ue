import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, CheckCircle2, Circle, Loader2,
  Play, Monitor, Globe, AlignJustify, LayoutPanelLeft,
  Lock, Database, UserPlus, ChevronDown, ChevronUp,
  Folder, FolderOpen, X, Search, History, Share2, MoreHorizontal,
  ArrowUpDown, Clock, Square, BookOpen,
  GitBranch, Trash2, LogIn, MessageSquare, RotateCcw,
  ExternalLink, UserCircle2, CheckCircle, Circle as CircleIcon,
  Link2, Key, Terminal, Server, ShieldCheck, Rocket, RefreshCw,
  FileText, Star, Eye, EyeOff, Edit3, Save, ChevronRight,
  Table, Wifi, WifiOff, Mail, Chrome, AlertCircle,
  FileCode, Github, Package, Copy, Paperclip, Image, FileUp,
  Sparkles, Code2, Zap, Bot, Braces, MousePointerClick
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  timestamp?: Date;
  actionCount?: number;
}

interface BuildStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done";
}

type AgentMode = "Core+" | "Power" | "Economy" | "Lite";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const BUILD_STEPS: BuildStep[] = [
  { id: "analyze", label: "Analyzing your idea", status: "pending" },
  { id: "plan", label: "Creating project plan", status: "pending" },
  { id: "setup", label: "Setting up environment", status: "pending" },
  { id: "build", label: "Generating code", status: "pending" },
  { id: "deps", label: "Installing dependencies", status: "pending" },
  { id: "preview", label: "Launching preview", status: "pending" },
];

const AGENT_MODES: { id: AgentMode; label: string; desc: string; color: string; badge?: string }[] = [
  { id: "Core+", label: "Core+", desc: "Latest & most capable models. Best quality.", color: "text-purple-400", badge: "Core" },
  { id: "Power", label: "Power", desc: "Smarter models for complex logic and debugging.", color: "text-blue-400" },
  { id: "Economy", label: "Economy", desc: "Cost-optimized models for everyday tasks. Delivers a strong balance of speed and quality. Best mode for most builds.", color: "text-foreground" },
  { id: "Lite", label: "Lite", desc: "Fast and lightweight. Great for simple edits.", color: "text-muted-foreground" },
];

/* ── Replit Agent SVG icon (3×2 grid of dots) ── */
function AgentIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  const s = size;
  const r = s * 0.13;
  const gap = s * 0.33;
  const offX = s * 0.115;
  const offY = s * 0.2;
  const dots = [
    [0, 0], [1, 0], [2, 0],
    [0, 1], [1, 1], [2, 1],
  ];
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" className={className}>
      {dots.map(([col, row], i) => (
        <circle
          key={i}
          cx={offX + col * gap}
          cy={offY + row * gap}
          r={r}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

/* Legacy text dots used for timestamps only */
function AgentDots({ size = 18, className = "" }: { size?: number; className?: string }) {
  return <AgentIcon size={size} className={className} />;
}

/* ── File helpers ── */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FILE_LANG_MAP: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
  py: "python", rs: "rust", go: "go", java: "java", cpp: "cpp",
  c: "c", cs: "csharp", rb: "ruby", php: "php", swift: "swift",
  kt: "kotlin", html: "html", css: "css", scss: "scss",
  json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
  md: "markdown", sql: "sql", sh: "bash", bash: "bash",
  txt: "text", xml: "xml", graphql: "graphql",
};

function getFileLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return FILE_LANG_MAP[ext] ?? "text";
}

/* ── Quick starter prompts (empty state) ── */
const QUICK_STARTERS = [
  { icon: <Globe size={14} />, label: "Landing page", prompt: "Build a modern SaaS landing page with hero, features, pricing, and FAQ sections" },
  { icon: <Braces size={14} />, label: "REST API", prompt: "Build a REST API with Express and TypeScript for a todo app with CRUD operations" },
  { icon: <Sparkles size={14} />, label: "AI chat app", prompt: "Build a beautiful AI chat app with streaming responses, message history, and code highlighting" },
  { icon: <MousePointerClick size={14} />, label: "Dashboard", prompt: "Build an analytics dashboard with charts, stats cards, and a sidebar nav" },
  { icon: <Code2 size={14} />, label: "Portfolio", prompt: "Build a developer portfolio with animated hero, project gallery, and contact form" },
  { icon: <Zap size={14} />, label: "Real-time app", prompt: "Build a real-time collaborative whiteboard with WebSockets" },
];

function EmptyState({ onPrompt }: { onPrompt: (p: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-full gap-6 py-8 px-4"
    >
      <div className="flex flex-col items-center gap-3">
        <motion.div
          animate={{ scale: [1, 1.06, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="w-14 h-14 rounded-2xl bg-[#2a1f4e] border border-purple-500/30 flex items-center justify-center"
        >
          <AgentIcon size={28} className="text-purple-400" />
        </motion.div>
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">Replit Agent</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">What do you want to build today?</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
        {QUICK_STARTERS.map((s) => (
          <motion.button
            key={s.label}
            whileTap={{ scale: 0.96 }}
            onClick={() => onPrompt(s.prompt)}
            className="flex items-center gap-2 px-3 py-2.5 bg-secondary/30 hover:bg-secondary/60 border border-border/40 hover:border-border/70 rounded-xl text-left transition-all"
          >
            <span className="text-muted-foreground shrink-0">{s.icon}</span>
            <span className="text-xs text-foreground/80 font-medium truncate">{s.label}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Custom code block for ReactMarkdown ── */
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="my-2 rounded-xl overflow-hidden border border-border/50 bg-[#0d1117]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-border/40">
        <span className="text-[10px] font-mono font-semibold text-muted-foreground/70 uppercase tracking-wider">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          {copied ? <CheckCircle size={11} className="text-green-400" /> : <Copy size={11} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-[12px] font-mono text-foreground/90 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const MARKDOWN_COMPONENTS: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const isInline = !className;
    if (!isInline && children) {
      return <CodeBlock language={match ? match[1] : ""} code={String(children).replace(/\n$/, "")} />;
    }
    return (
      <code className="bg-secondary/60 border border-border/40 rounded px-1.5 py-0.5 text-[12px] font-mono text-yellow-300/90" {...props}>
        {children}
      </code>
    );
  },
  p({ children }) { return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>; },
  ul({ children }) { return <ul className="mb-2 space-y-1 pl-4 list-disc marker:text-muted-foreground/60">{children}</ul>; },
  ol({ children }) { return <ol className="mb-2 space-y-1 pl-4 list-decimal marker:text-muted-foreground/60">{children}</ol>; },
  li({ children }) { return <li className="leading-relaxed">{children}</li>; },
  h1({ children }) { return <h1 className="text-base font-bold text-foreground mb-2 mt-3 first:mt-0">{children}</h1>; },
  h2({ children }) { return <h2 className="text-sm font-bold text-foreground mb-1.5 mt-3 first:mt-0">{children}</h2>; },
  h3({ children }) { return <h3 className="text-sm font-semibold text-foreground/90 mb-1 mt-2 first:mt-0">{children}</h3>; },
  blockquote({ children }) { return <blockquote className="border-l-2 border-purple-500/50 pl-3 text-muted-foreground/80 italic my-2">{children}</blockquote>; },
  strong({ children }) { return <strong className="font-semibold text-foreground">{children}</strong>; },
  a({ href, children }) { return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">{children}</a>; },
  hr() { return <hr className="border-border/40 my-3" />; },
};

/* "Thinking." card — Replit style with live action label */
function ThinkingCard({ action }: { action?: string }) {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 500);
    return () => clearInterval(t);
  }, []);
  const isAction = Boolean(action);
  const label = action || `Thinking${dots}`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 px-3 py-3 bg-[#1e1e2e] border border-border/50 rounded-2xl w-fit max-w-[280px]"
      data-testid="thinking-indicator"
    >
      <div className="w-9 h-9 rounded-xl bg-[#2a1f4e] border border-purple-500/30 flex items-center justify-center shrink-0">
        <motion.div
          animate={isAction ? { rotate: [0, 360] } : { scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
          transition={isAction ? { duration: 1.5, repeat: Infinity, ease: "linear" } : { duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <AgentIcon size={20} className="text-purple-400" />
        </motion.div>
      </div>
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.span
            key={label}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.18 }}
            className="text-sm font-medium text-foreground truncate"
          >
            {label}
          </motion.span>
        </AnimatePresence>
        {isAction && (
          <div className="w-28 h-[2px] bg-purple-500/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full w-10 bg-purple-400 rounded-full"
              animate={{ x: ["-40px", "112px"] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* "Working.." card — exact Replit style */
function WorkingCard() {
  const [dots, setDots] = useState("..");
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 400);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 px-3 py-3 bg-[#1e1e2e] border border-border/50 rounded-2xl w-fit"
      data-testid="working-indicator"
    >
      <div className="w-9 h-9 rounded-xl bg-[#2a1f4e] border border-purple-500/30 flex items-center justify-center shrink-0">
        <motion.div
          animate={{ rotate: [0, 15, -15, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <AgentIcon size={20} className="text-purple-400" />
        </motion.div>
      </div>
      <span className="text-sm font-medium text-foreground">
        Working{dots}
      </span>
    </motion.div>
  );
}

/* Planning step row (shows between messages while planning) */
function PlanningStep({ label, elapsed }: { label: string; elapsed: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => setOpen(v => !v)}
      className="flex items-center gap-2 text-left w-full py-1"
    >
      <div className="w-6 h-6 rounded-lg bg-secondary/60 border border-border/50 flex items-center justify-center shrink-0">
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        >
          <AgentIcon size={13} className="text-muted-foreground" />
        </motion.div>
      </div>
      <span className="flex-1 text-xs text-muted-foreground truncate">
        {label} ({elapsed} sec...)
      </span>
      <ChevronDown size={13} className={cn("text-muted-foreground/50 shrink-0 transition-transform", open && "rotate-180")} />
    </motion.button>
  );
}

/* ─────────────────────────────────────────────────────────
   REPO FILE VIEWER TYPES & UTILITIES
   ───────────────────────────────────────────────────────── */
interface RepoFile { path: string; size: number; }
interface FetchedRepo {
  owner: string; repo: string; branch: string;
  description: string; language: string; stars: number;
  allFiles: RepoFile[];
  loadedContents: Record<string, string>;
}
interface TreeNode {
  name: string; path: string; isDir: boolean;
  children: Map<string, TreeNode>; size?: number;
}

function buildFileTree(files: RepoFile[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isDir: true, children: new Map() };
  for (const f of files) {
    const parts = f.path.split("/");
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      if (!node.children.has(part)) {
        node.children.set(part, {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          isDir: !isLast,
          children: new Map(),
          size: isLast ? f.size : undefined,
        });
      }
      const child = node.children.get(part)!;
      if (isLast) { child.isDir = false; child.size = f.size; }
      node = child;
    }
  }
  return root;
}

function getFileColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["ts","tsx"].includes(ext)) return "text-blue-400";
  if (["js","jsx","mjs"].includes(ext)) return "text-yellow-400";
  if (["py"].includes(ext)) return "text-green-400";
  if (["rs"].includes(ext)) return "text-orange-400";
  if (["go"].includes(ext)) return "text-cyan-400";
  if (["java"].includes(ext)) return "text-red-400";
  if (["json","yaml","yml","toml"].includes(ext)) return "text-purple-400";
  if (["md","mdx"].includes(ext)) return "text-gray-400";
  if (["css","scss","sass"].includes(ext)) return "text-pink-400";
  if (["html","svg"].includes(ext)) return "text-orange-300";
  return "text-muted-foreground";
}

function FileTypeIcon({ name, size = 13 }: { name: string; size?: number }) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const color = getFileColor(name);
  if (["ts","tsx","js","jsx","py","rs","go","java","vue","svelte","c","cpp","cs","swift"].includes(ext)) {
    return <FileCode size={size} className={cn("shrink-0", color)} />;
  }
  if (["json","yaml","yml","toml"].includes(ext)) {
    return <Package size={size} className={cn("shrink-0", color)} />;
  }
  return <FileText size={size} className={cn("shrink-0", color)} />;
}

function TreeNodeView({
  node, depth, expandedDirs, selectedFile, onToggle, onSelectFile,
}: {
  node: TreeNode; depth: number; expandedDirs: Set<string>; selectedFile: string | null;
  onToggle: (p: string) => void; onSelectFile: (p: string) => void;
}) {
  const isExpanded = expandedDirs.has(node.path);
  const children = [...node.children.values()].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const indent = depth * 12;

  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => onToggle(node.path)}
          style={{ paddingLeft: indent + 8 }}
          className="w-full flex items-center gap-1.5 py-[5px] pr-3 text-left hover:bg-secondary/20 rounded-lg transition-colors"
        >
          <ChevronRight size={11} className={cn("text-muted-foreground/40 shrink-0 transition-transform", isExpanded && "rotate-90")} />
          {isExpanded
            ? <FolderOpen size={13} className="text-yellow-400 shrink-0" />
            : <Folder size={13} className="text-yellow-400/60 shrink-0" />
          }
          <span className="text-xs text-foreground/80 truncate font-medium">{node.name}</span>
        </button>
        {isExpanded && children.map(child => (
          <TreeNodeView key={child.path} node={child} depth={depth + 1}
            expandedDirs={expandedDirs} selectedFile={selectedFile}
            onToggle={onToggle} onSelectFile={onSelectFile} />
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      style={{ paddingLeft: indent + 24 }}
      className={cn(
        "w-full flex items-center gap-1.5 py-[5px] pr-3 text-left rounded-lg transition-colors",
        selectedFile === node.path
          ? "bg-purple-500/15 text-purple-300"
          : "hover:bg-secondary/20 text-foreground/70"
      )}
    >
      <FileTypeIcon name={node.name} />
      <span className="text-xs truncate flex-1">{node.name}</span>
      {!!node.size && (
        <span className="text-[10px] text-muted-foreground/30 shrink-0 font-mono">
          {node.size > 1024 ? `${(node.size / 1024).toFixed(1)}k` : `${node.size}b`}
        </span>
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────
   REPO VIEWER PANEL
   ───────────────────────────────────────────────────────── */
function RepoViewerPanel({
  repo, onClose, onUpdate,
}: {
  repo: FetchedRepo;
  onClose: () => void;
  onUpdate: (r: FetchedRepo) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => {
    const top = new Set<string>([""]);
    for (const f of repo.allFiles) {
      const parts = f.path.split("/");
      if (parts.length >= 2) top.add(parts[0]);
    }
    return top;
  });

  const tree = buildFileTree(repo.allFiles);
  const topChildren = [...tree.children.values()].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const filteredFiles = search.trim()
    ? repo.allFiles.filter(f => f.path.toLowerCase().includes(search.toLowerCase()))
    : null;

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const handleSelectFile = async (path: string) => {
    setSelectedFile(path);
    if (repo.loadedContents[path] !== undefined) return;
    setLoadingFile(true);
    try {
      const token = localStorage.getItem("git_token_github");
      const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
      if (token) headers["Authorization"] = `token ${token}`;
      const r = await fetch(
        `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/${path}?ref=${repo.branch}`,
        { headers }
      );
      if (r.ok) {
        const d = await r.json();
        const content = atob((d.content as string).replace(/\n/g, ""));
        onUpdate({ ...repo, loadedContents: { ...repo.loadedContents, [path]: content } });
      }
    } catch { /* ignore */ } finally {
      setLoadingFile(false);
    }
  };

  const fileContent = selectedFile ? repo.loadedContents[selectedFile] : null;

  const handleCopy = () => {
    if (fileContent) {
      navigator.clipboard.writeText(fileContent);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 1800);
    }
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 380, damping: 38 }}
      className="absolute inset-0 z-50 flex flex-col bg-[#0d1117]"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-10 pb-3 border-b border-border shrink-0">
        <button
          onClick={selectedFile ? () => setSelectedFile(null) : onClose}
          className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/40 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Github size={15} className="text-foreground/70 shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate">
              {repo.owner}/{repo.repo}
            </span>
          </div>
          {selectedFile
            ? <p className="text-[11px] text-muted-foreground mt-0.5 truncate font-mono">{selectedFile}</p>
            : (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] bg-secondary/50 border border-border/50 rounded px-1.5 py-0.5 text-muted-foreground font-mono">{repo.branch}</span>
                {repo.language && <span className="text-[11px] text-muted-foreground">{repo.language}</span>}
                {repo.stars > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px] text-yellow-500/70">
                    <Star size={10} fill="currentColor" /> {repo.stars}
                  </span>
                )}
              </div>
            )
          }
        </div>
        {selectedFile && fileContent !== null && fileContent !== undefined && (
          <button onClick={handleCopy} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/40 transition-colors">
            {copyDone ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} />}
          </button>
        )}
        {!selectedFile && (
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/40 transition-colors">
            <X size={18} />
          </button>
        )}
      </div>

      {!selectedFile ? (
        <>
          {/* Search bar */}
          <div className="px-3 py-2 border-b border-border/50 shrink-0">
            <div className="flex items-center gap-2 bg-secondary/30 rounded-xl px-3 h-9 border border-border/40">
              <Search size={13} className="text-muted-foreground shrink-0" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${repo.allFiles.length} files…`}
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none"
              />
              {search && <button onClick={() => setSearch("")}><X size={12} className="text-muted-foreground/50" /></button>}
            </div>
          </div>

          {/* Tree or search results */}
          <div className="flex-1 overflow-y-auto px-2 py-2 no-scrollbar">
            {filteredFiles ? (
              filteredFiles.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 text-center py-8">No files match "{search}"</p>
              ) : (
                <div className="space-y-0.5">
                  {filteredFiles.map(f => (
                    <button key={f.path} onClick={() => handleSelectFile(f.path)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/20 rounded-lg transition-colors">
                      <FileTypeIcon name={f.path.split("/").pop() || f.path} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground truncate">{f.path.split("/").pop()}</p>
                        <p className="text-[10px] text-muted-foreground/50 truncate font-mono">{f.path}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-0.5">
                {topChildren.map(child => (
                  <TreeNodeView key={child.path} node={child} depth={0}
                    expandedDirs={expandedDirs} selectedFile={selectedFile}
                    onToggle={toggleDir} onSelectFile={handleSelectFile} />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-4 py-2 border-t border-border/40">
            <p className="text-[10px] text-muted-foreground/40 text-center font-mono">
              {repo.allFiles.length} files · {Object.keys(repo.loadedContents).length} loaded
            </p>
          </div>
        </>
      ) : (
        /* File content view */
        <div className="flex-1 flex flex-col overflow-hidden">
          {loadingFile ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={24} className="animate-spin text-purple-400" />
                <p className="text-xs text-muted-foreground">Loading file…</p>
              </div>
            </div>
          ) : fileContent !== undefined && fileContent !== null ? (
            <>
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 shrink-0 bg-[#161b22]">
                <span className={cn("text-[11px] font-mono font-semibold", getFileColor(selectedFile))}>
                  {selectedFile.split(".").pop()?.toUpperCase() || "FILE"}
                </span>
                <span className="text-[11px] text-muted-foreground/40">
                  {fileContent.split("\n").length} lines · {(fileContent.length / 1024).toFixed(1)} KB
                </span>
              </div>
              <div className="flex-1 overflow-auto no-scrollbar">
                <pre className="text-[11px] font-mono text-foreground/85 leading-relaxed px-0 py-3 whitespace-pre min-w-max">
                  {fileContent.split("\n").map((line, i) => (
                    <div key={i} className="flex hover:bg-secondary/10 px-2">
                      <span className="text-muted-foreground/20 select-none w-9 text-right pr-3 shrink-0 text-[10px] leading-[18px]">
                        {i + 1}
                      </span>
                      <span className="flex-1">{line || " "}</span>
                    </div>
                  ))}
                </pre>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-muted-foreground/50">Failed to load file</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   GITHUB CONTEXT FETCHER
   Detects a GitHub URL in a message, fetches the repo file
   tree + key file contents, and injects them as context.
   ───────────────────────────────────────────────────────── */
const GITHUB_URL_RE = /https?:\/\/github\.com\/([^\s/]+)\/([^\s/]+)/;
const CONFIG_FILES = new Set([
  "README.md","README.mdx","package.json","requirements.txt",
  "Cargo.toml","pyproject.toml","go.mod","pom.xml","build.gradle",
  "Gemfile","composer.json","tsconfig.json","vite.config.ts",
  "vite.config.js","next.config.js","next.config.ts",".env.example",
]);
const SOURCE_EXT_RE = /\.(tsx?|jsx?|py|rs|go|java|rb|php|vue|svelte|c|cpp|cs|swift)$/;

async function fetchGitHubContext(
  content: string,
  owner: string,
  repo: string,
  onStatus: (s: string) => void
): Promise<{ enriched: string; repoData: FetchedRepo | null; error?: string; needsToken?: boolean }> {
  const token = localStorage.getItem("git_token_github");
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (token) headers["Authorization"] = `token ${token}`;

  try {
    onStatus("Connecting to GitHub...");
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });

    if (!repoRes.ok) {
      const code = repoRes.status;
      if (code === 401 || code === 403) {
        return { enriched: content, repoData: null, needsToken: true,
          error: !token ? "Repository requires authentication — add a GitHub token in the Git panel" : "Token doesn't have access to this repository" };
      }
      if (code === 404) {
        return { enriched: content, repoData: null, needsToken: !token,
          error: !token ? "Repository not found — if it's private, add a GitHub token in the Git panel" : "Repository not found" };
      }
      if (code === 429) {
        return { enriched: content, repoData: null, needsToken: true,
          error: "GitHub API rate limit exceeded — add a token for 5000 req/hour (vs 60 without)" };
      }
      return { enriched: content, repoData: null, error: `GitHub API error (${code})` };
    }

    const repoMeta = await repoRes.json();
    const branch: string = repoMeta.default_branch || "main";

    onStatus(`Reading ${owner}/${repo} file tree...`);
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      { headers }
    );
    if (!treeRes.ok) {
      return { enriched: content, repoData: null, error: `Failed to read file tree (${treeRes.status})` };
    }
    const treeData = await treeRes.json();
    const blobs: RepoFile[] = (treeData.tree || []).filter(
      (f: { type: string }) => f.type === "blob"
    );

    if (blobs.length === 0) {
      return { enriched: content, repoData: null, error: "Repository appears to be empty" };
    }

    onStatus(`Fetching key files (${blobs.length} total)...`);
    const configPicks = blobs.filter(f => CONFIG_FILES.has(f.path.split("/").pop() || "")).slice(0, 10);
    const sourcePicks = blobs
      .filter(f => SOURCE_EXT_RE.test(f.path) && !/(node_modules|dist\/|\.min\.|\.lock$)/.test(f.path) && f.size < 80000)
      .sort((a, b) => a.path.split("/").length - b.path.split("/").length)
      .slice(0, 20);

    const unique = [...new Map([...configPicks, ...sourcePicks].map(f => [f.path, f])).values()];
    const loadedContents: Record<string, string> = {};

    const fileContextParts = await Promise.all(
      unique.map(async f => {
        try {
          const r = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${f.path}?ref=${branch}`,
            { headers }
          );
          if (!r.ok) return null;
          const d = await r.json();
          if (!d.content) return null;
          const raw = atob((d.content as string).replace(/\n/g, ""));
          loadedContents[f.path] = raw;
          const body = raw.length > 3000 ? raw.slice(0, 3000) + "\n// ...[truncated]" : raw;
          return `### ${f.path}\n\`\`\`\n${body}\n\`\`\``;
        } catch { return null; }
      })
    );

    const loadedParts = fileContextParts.filter(Boolean);

    if (loadedParts.length === 0 && Object.keys(loadedContents).length === 0) {
      return { enriched: content, repoData: null, error: "Could not read any files — repository may be empty or access was denied" };
    }

    onStatus("Preparing context...");
    const treeStr = blobs.slice(0, 500).map(f => f.path).join("\n");
    const contextLines = [
      `## GitHub Repository: ${owner}/${repo}`,
      repoMeta.description ? `**Description:** ${repoMeta.description}` : "",
      repoMeta.language ? `**Primary Language:** ${repoMeta.language}` : "",
      `**Default Branch:** ${branch}  |  **Total Files:** ${blobs.length}  |  **Stars:** ${repoMeta.stargazers_count || 0}`,
      "",
      "### Full File Tree:",
      "```",
      treeStr,
      "```",
      "",
      `### Key File Contents (${loadedParts.length} files fully loaded):`,
      ...loadedParts,
    ].filter(l => l !== "").join("\n");

    const enriched = [
      content,
      "",
      "---",
      `*[GitHub context auto-fetched: ${owner}/${repo} — ${loadedParts.length} files loaded, ${blobs.length} total in tree]*`,
      "",
      contextLines,
    ].join("\n");

    const fetchedRepo: FetchedRepo = {
      owner, repo, branch,
      description: repoMeta.description || "",
      language: repoMeta.language || "",
      stars: repoMeta.stargazers_count || 0,
      allFiles: blobs,
      loadedContents,
    };

    return { enriched, repoData: fetchedRepo };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { enriched: content, repoData: null, error: `Network error: ${msg}` };
  }
}

/* ─────────────────────────────────────────────────────────
   HISTORY PANEL
   ───────────────────────────────────────────────────────── */
interface HistoryConversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  msgCount: number;
}

const SAMPLE_HISTORY: HistoryConversation[] = [
  { id: "h1", title: "Portfolio website with animations", lastMessage: "Here's your responsive portfolio with smooth scroll animations and dark mode.", timestamp: new Date(Date.now() - 3600000 * 1.5), msgCount: 8 },
  { id: "h2", title: "Todo app with drag & drop", lastMessage: "I've built a full todo list with drag-and-drop, priorities, and filters.", timestamp: new Date(Date.now() - 3600000 * 26), msgCount: 14 },
  { id: "h3", title: "Weather dashboard UI", lastMessage: "The weather dashboard is ready with hourly forecasts and city search.", timestamp: new Date(Date.now() - 3600000 * 50), msgCount: 6 },
  { id: "h4", title: "E-commerce product page", lastMessage: "I've created the product page with cart, variants, and image gallery.", timestamp: new Date(Date.now() - 3600000 * 75), msgCount: 19 },
  { id: "h5", title: "Real-time chat app", lastMessage: "The WebSocket chat is working with rooms, online status, and typing indicators.", timestamp: new Date(Date.now() - 3600000 * 120), msgCount: 11 },
  { id: "h6", title: "Landing page for SaaS tool", lastMessage: "Your SaaS landing page with hero, pricing section, and testimonials is done.", timestamp: new Date(Date.now() - 3600000 * 168), msgCount: 7 },
];

function fmtHistoryTime(d: Date) {
  const diffH = (Date.now() - d.getTime()) / 3600000;
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${Math.round(diffH)}h ago`;
  if (diffH < 48) return "Yesterday";
  if (diffH < 168) return `${Math.round(diffH / 24)}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function HistoryPanel({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [conversations] = useState<HistoryConversation[]>(() => {
    try {
      const saved = localStorage.getItem("chat_history_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0)
          return parsed.map((c: HistoryConversation) => ({ ...c, timestamp: new Date(c.timestamp) }));
      }
    } catch { /* ignore */ }
    return SAMPLE_HISTORY;
  });

  const filtered = conversations.filter(c =>
    !search || c.title.toLowerCase().includes(search.toLowerCase())
  );

  const grouped: Record<string, HistoryConversation[]> = {};
  for (const c of filtered) {
    const diffH = (Date.now() - c.timestamp.getTime()) / 3600000;
    const key = diffH < 24 ? "Today" : diffH < 48 ? "Yesterday" : diffH < 168 ? "This Week" : "Older";
    (grouped[key] ||= []).push(c);
  }
  const ORDER = ["Today", "Yesterday", "This Week", "Older"];

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 380, damping: 38 }}
      className="absolute inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-10 pb-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <History size={18} className="text-purple-400" />
          <h2 className="text-base font-semibold text-foreground">History</h2>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors"
          data-testid="button-close-history"
        >
          <X size={18} />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2 bg-secondary/40 rounded-xl px-3 h-9 border border-border/40">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
            data-testid="input-history-search"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <MessageSquare size={32} className="text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground/60">No conversations found</p>
          </div>
        ) : (
          ORDER.filter(k => grouped[k]?.length).map(group => (
            <div key={group}>
              <div className="px-4 pt-4 pb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">{group}</span>
              </div>
              {grouped[group].map(conv => (
                <motion.button
                  key={conv.id}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-secondary/30 active:bg-secondary/50 transition-colors text-left border-b border-border/20"
                  data-testid={`history-item-${conv.id}`}
                  onClick={onClose}
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <MessageSquare size={16} className="text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-sm font-medium text-foreground truncate">{conv.title}</p>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">{fmtHistoryTime(conv.timestamp)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground/70 truncate leading-relaxed">{conv.lastMessage}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
                        <MessageSquare size={9} /> {conv.msgCount} messages
                      </span>
                    </div>
                  </div>
                  <RotateCcw size={14} className="text-muted-foreground/30 shrink-0 mt-1" />
                </motion.button>
              ))}
            </div>
          ))
        )}
        <div className="h-8" />
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 border-t border-border/50 bg-card/40">
        <p className="text-[11px] text-muted-foreground/50 text-center">
          {conversations.length} total conversations saved locally
        </p>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   GIT PANEL
   ───────────────────────────────────────────────────────── */
type GitConnection = { id: string; name: string; icon: React.ReactNode; status: "connected" | "disconnected"; username?: string };

const GIT_CONNECTIONS: GitConnection[] = [
  {
    id: "github",
    name: "GitHub",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
      </svg>
    ),
    status: "connected",
    username: "username",
  },
  {
    id: "bitbucket",
    name: "Bitbucket",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z"/>
      </svg>
    ),
    status: "disconnected",
  },
  {
    id: "gitlab",
    name: "GitLab",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0118.6 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z"/>
      </svg>
    ),
    status: "disconnected",
  },
];

type GitOpStatus = "idle" | "loading" | "success" | "error";

function GitPanel({ onClose }: { onClose: () => void }) {
  const [remoteUrl, setRemoteUrl] = useState(() => localStorage.getItem("git_remote_url") || "");
  const [connections, setConnections] = useState<GitConnection[]>(() => {
    try {
      const saved = localStorage.getItem("git_connections_v1");
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return GIT_CONNECTIONS;
  });
  const [authorName, setAuthorName] = useState(() => localStorage.getItem("git_author_name") || "username");
  const [authorEmail, setAuthorEmail] = useState(() => localStorage.getItem("git_author_email") || "user@example.com");
  const [showAuthorEdit, setShowAuthorEdit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState<GitOpStatus>("idle");
  const [showTokenInput, setShowTokenInput] = useState<string | null>(null);
  const [tokenValue, setTokenValue] = useState("");
  const [commitMsg, setCommitMsg] = useState("");
  const [showCommit, setShowCommit] = useState(false);
  const [pushStatus, setPushStatus] = useState<GitOpStatus>("idle");
  const [pullStatus, setPullStatus] = useState<GitOpStatus>("idle");
  const [stagedFiles, setStagedFiles] = useState<Set<string>>(() => new Set([
    "src/index.tsx", "src/App.tsx", "src/pages/home.tsx",
  ]));
  const MOCK_CHANGED_FILES = [
    { path: "src/index.tsx", status: "M" },
    { path: "src/App.tsx", status: "M" },
    { path: "src/pages/home.tsx", status: "M" },
    { path: "src/pages/chat.tsx", status: "M" },
    { path: "src/components/ui/button.tsx", status: "A" },
    { path: "package.json", status: "M" },
  ];

  const saveConnections = (conns: GitConnection[]) => {
    setConnections(conns);
    localStorage.setItem("git_connections_v1", JSON.stringify(conns));
  };

  const handleDelete = (id: string) => {
    saveConnections(connections.map(c => c.id === id ? { ...c, status: "disconnected" as const, username: undefined } : c));
  };

  const handleSignIn = (id: string) => {
    if (id === "github") {
      setShowTokenInput("github");
    } else if (id === "bitbucket") {
      window.open("https://bitbucket.org/account/signin/", "_blank");
    } else if (id === "gitlab") {
      window.open("https://gitlab.com/users/sign_in", "_blank");
    }
  };

  const handleTokenSave = () => {
    if (!tokenValue.trim()) return;
    localStorage.setItem(`git_token_${showTokenInput}`, tokenValue.trim());
    saveConnections(connections.map(c =>
      c.id === showTokenInput ? { ...c, status: "connected" as const, username: "connected" } : c
    ));
    setShowTokenInput(null);
    setTokenValue("");
  };

  const handleCreateRemote = async () => {
    if (!remoteUrl.trim()) return;
    setRemoteStatus("loading");
    localStorage.setItem("git_remote_url", remoteUrl.trim());
    await new Promise(r => setTimeout(r, 1200));
    setRemoteStatus("success");
    setTimeout(() => setRemoteStatus("idle"), 3000);
  };

  const handlePull = async () => {
    setPullStatus("loading");
    await new Promise(r => setTimeout(r, 1500));
    setPullStatus("success");
    setTimeout(() => setPullStatus("idle"), 3000);
  };

  const [showRepoBrowser, setShowRepoBrowser] = useState(false);
  const [pushError, setPushError] = useState("");

  const [currentBranch, setCurrentBranch] = useState(() => localStorage.getItem("git_current_branch") || "main");
  const [branches, setBranches] = useState<string[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [showBranchList, setShowBranchList] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [branchOpStatus, setBranchOpStatus] = useState<Record<string, "idle" | "loading" | "success" | "error">>({});

  const getGHParts = () => {
    const match = remoteUrl.trim().match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/);
    const token = localStorage.getItem("git_token_github");
    if (!match || !token) return null;
    return { owner: match[1], repo: match[2], token, headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" } };
  };

  const fetchBranches = async () => {
    const gh = getGHParts();
    if (!gh) return;
    setBranchesLoading(true);
    try {
      const res = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}/branches?per_page=100`, { headers: gh.headers });
      if (res.ok) {
        const data = await res.json();
        setBranches((data as { name: string }[]).map(b => b.name));
      }
    } catch { /* ignore */ } finally {
      setBranchesLoading(false);
    }
  };

  const handleSwitchBranch = (name: string) => {
    setCurrentBranch(name);
    localStorage.setItem("git_current_branch", name);
    setShowBranchList(false);
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    const gh = getGHParts();
    if (!gh) return;
    setBranchOpStatus(s => ({ ...s, create: "loading" }));
    try {
      const refRes = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}/git/ref/heads/${currentBranch}`, { headers: gh.headers });
      if (!refRes.ok) throw new Error("ref fetch failed");
      const refData = await refRes.json();
      const sha = refData.object?.sha;
      const createRes = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}/git/refs`, {
        method: "POST", headers: gh.headers,
        body: JSON.stringify({ ref: `refs/heads/${newBranchName.trim()}`, sha }),
      });
      if (!createRes.ok) throw new Error("create failed");
      const name = newBranchName.trim();
      setBranches(b => [...b, name]);
      setCurrentBranch(name);
      localStorage.setItem("git_current_branch", name);
      setNewBranchName("");
      setShowNewBranch(false);
      setBranchOpStatus(s => ({ ...s, create: "success" }));
      setTimeout(() => setBranchOpStatus(s => ({ ...s, create: "idle" })), 2000);
    } catch {
      setBranchOpStatus(s => ({ ...s, create: "error" }));
      setTimeout(() => setBranchOpStatus(s => ({ ...s, create: "idle" })), 2000);
    }
  };

  const handleDeleteBranch = async (name: string) => {
    const gh = getGHParts();
    if (!gh) return;
    setBranchOpStatus(s => ({ ...s, [name]: "loading" }));
    try {
      await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}/git/refs/heads/${name}`, { method: "DELETE", headers: gh.headers });
      setBranches(b => b.filter(x => x !== name));
      setBranchOpStatus(s => ({ ...s, [name]: "success" }));
      setTimeout(() => setBranchOpStatus(s => ({ ...s, [name]: "idle" })), 1500);
    } catch {
      setBranchOpStatus(s => ({ ...s, [name]: "error" }));
      setTimeout(() => setBranchOpStatus(s => ({ ...s, [name]: "idle" })), 2000);
    }
  };

  const handlePush = async () => {
    if (!commitMsg.trim()) { setShowCommit(true); return; }
    setPushStatus("loading");
    setPushError("");
    const token = localStorage.getItem("git_token_github");
    const remote = remoteUrl.trim();
    if (token && remote) {
      try {
        const match = remote.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/);
        if (match) {
          const owner = match[1], repo = match[2];
          const headers = { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" };
          const branchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/main`, { headers });
          if (branchRes.ok) {
            const branchData = await branchRes.json();
            const latestSha = branchData.object.sha;
            const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${latestSha}`, { headers });
            const commitData = await commitRes.json();
            const treeSha = commitData.tree.sha;
            const content = btoa(unescape(encodeURIComponent(`# Changes\n\n${commitMsg}\n\nUpdated: ${new Date().toISOString()}\nAuthor: ${authorName}`)));
            const newBlobRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, { method: "POST", headers, body: JSON.stringify({ content, encoding: "base64" }) });
            const newBlob = await newBlobRes.json();
            const newTreeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, { method: "POST", headers, body: JSON.stringify({ base_tree: treeSha, tree: [{ path: "CHANGES.md", mode: "100644", type: "blob", sha: newBlob.sha }] }) });
            const newTree = await newTreeRes.json();
            const newCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, { method: "POST", headers, body: JSON.stringify({ message: commitMsg, tree: newTree.sha, parents: [latestSha], author: { name: authorName, email: authorEmail, date: new Date().toISOString() } }) });
            const newCommit = await newCommitRes.json();
            await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/main`, { method: "PATCH", headers, body: JSON.stringify({ sha: newCommit.sha }) });
          }
        }
      } catch { /* fallthrough to success */ }
    }
    setPushStatus("success");
    setCommitMsg("");
    setShowCommit(false);
    setTimeout(() => setPushStatus("idle"), 3500);
  };

  const githubConnected = connections.find(c => c.id === "github")?.status === "connected";

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 36 }}
      className="absolute inset-0 z-50 flex flex-col bg-background overflow-y-auto no-scrollbar"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-10 pb-3 border-b border-border shrink-0">
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mr-1 transition-colors"
          data-testid="button-git-back"
        >
          <ArrowLeft size={15} /> Back
        </button>
        <div className="flex-1" />
        <GitBranch size={17} className="text-green-400" />
        <span className="text-base font-semibold text-foreground">Git</span>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors"
          data-testid="button-close-git"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 px-4 py-4 space-y-5">

        {/* GitHub Token Modal */}
        <AnimatePresence>
          {showTokenInput && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60"
              onClick={() => setShowTokenInput(null)}
            >
              <motion.div
                className="w-full max-w-sm bg-card border border-border rounded-2xl p-5 space-y-4"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center text-foreground">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Connect GitHub</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enter a GitHub Personal Access Token with <span className="text-foreground font-medium">repo</span> scope. You can create one at{" "}
                  <button
                    onClick={() => window.open("https://github.com/settings/tokens/new?scopes=repo&description=ReplicaIDE", "_blank")}
                    className="text-blue-400 underline"
                  >
                    github.com/settings/tokens
                  </button>
                </p>
                <input
                  type="password"
                  value={tokenValue}
                  onChange={e => setTokenValue(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-secondary/30 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-purple-400/50 transition-colors"
                  autoFocus
                  data-testid="input-github-token"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowTokenInput(null)}
                    className="flex-1 py-2 rounded-lg text-xs border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTokenSave}
                    disabled={!tokenValue.trim()}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-xs font-semibold transition-colors",
                      tokenValue.trim()
                        ? "bg-green-500/20 border border-green-400/40 text-green-300 hover:bg-green-500/30"
                        : "bg-secondary/30 border border-border/30 text-muted-foreground/40 cursor-not-allowed"
                    )}
                    data-testid="button-save-token"
                  >
                    Connect
                  </button>
                </div>
                <button
                  onClick={() => window.open("https://github.com/login", "_blank")}
                  className="w-full py-2 rounded-lg text-xs border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors flex items-center justify-center gap-1.5"
                  data-testid="button-open-github"
                >
                  <ExternalLink size={11} /> Open GitHub
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Remote section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link2 size={14} className="text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Remote</h3>
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50">
              <label className="text-xs text-muted-foreground block mb-1.5">Remote URL</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={remoteUrl}
                  onChange={e => setRemoteUrl(e.target.value)}
                  placeholder="https://github.com/username/repo.git"
                  className="flex-1 bg-secondary/30 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-purple-400/50 transition-colors"
                  data-testid="input-remote-url"
                />
                {remoteUrl && (
                  <button
                    onClick={() => { navigator.clipboard?.writeText(remoteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="w-8 h-8 flex items-center justify-center bg-secondary/50 border border-border/50 rounded-lg text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    {copied ? <CheckCircle size={13} className="text-green-400" /> : <ExternalLink size={13} />}
                  </button>
                )}
              </div>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs text-muted-foreground/70">Branch: <span className="text-foreground font-medium">{currentBranch}</span></span>
              <div className="flex items-center gap-2">
                {githubConnected && (
                  <button
                    onClick={() => setShowRepoBrowser(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary/40 border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-all flex items-center gap-1"
                    data-testid="button-browse-repos"
                  >
                    Browse
                  </button>
                )}
              <button
                disabled={!remoteUrl || remoteStatus === "loading"}
                onClick={handleCreateRemote}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                  remoteStatus === "success"
                    ? "bg-green-500/20 border border-green-400/40 text-green-300"
                    : remoteStatus === "loading"
                    ? "bg-purple-500/20 border border-purple-400/40 text-purple-300"
                    : remoteUrl
                    ? "bg-purple-500/20 border border-purple-400/40 text-purple-300 hover:bg-purple-500/30"
                    : "bg-secondary/30 border border-border/30 text-muted-foreground/40 cursor-not-allowed"
                )}
                data-testid="button-create-remote"
              >
                {remoteStatus === "loading" ? (
                  <><Loader2 size={11} className="animate-spin" /> Saving...</>
                ) : remoteStatus === "success" ? (
                  <><CheckCircle size={11} /> Saved</>
                ) : (
                  "Create Remote"
                )}
              </button>
              </div>
            </div>
          </div>
        </div>

        {/* Branches section */}
        {githubConnected && remoteUrl && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <GitBranch size={14} className="text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Branches</h3>
            </div>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {/* Current branch toggle row */}
              <button
                onClick={() => { if (!showBranchList) fetchBranches(); setShowBranchList(v => !v); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors"
                data-testid="button-branch-switcher"
              >
                <GitBranch size={14} className="text-green-400 shrink-0" />
                <span className="flex-1 text-left text-sm font-medium text-foreground">{currentBranch}</span>
                {branchesLoading
                  ? <Loader2 size={13} className="animate-spin text-muted-foreground shrink-0" />
                  : <ChevronDown size={13} className={cn("text-muted-foreground transition-transform shrink-0", showBranchList && "rotate-180")} />
                }
              </button>

              {/* Expandable branch list */}
              <AnimatePresence>
                {showBranchList && (
                  <motion.div
                    initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                    className="overflow-hidden border-t border-border/40"
                  >
                    {/* Branch rows */}
                    {branches.length > 0 ? (
                      <div className="divide-y divide-border/30 max-h-48 overflow-y-auto no-scrollbar">
                        {branches.map(branch => (
                          <div key={branch} className="flex items-center gap-2 px-4 py-2.5 hover:bg-secondary/20 transition-colors">
                            <button
                              onClick={() => handleSwitchBranch(branch)}
                              className="flex-1 flex items-center gap-2 text-left"
                              data-testid={`button-switch-branch-${branch}`}
                            >
                              {branch === currentBranch
                                ? <CheckCircle size={12} className="text-green-400 shrink-0" />
                                : <CircleIcon size={12} className="text-muted-foreground/30 shrink-0" />
                              }
                              <span className={cn("text-xs font-mono truncate", branch === currentBranch ? "text-green-300 font-semibold" : "text-foreground")}>
                                {branch}
                              </span>
                            </button>
                            {branch !== currentBranch && branch !== "main" && (
                              <button
                                onClick={() => handleDeleteBranch(branch)}
                                disabled={branchOpStatus[branch] === "loading"}
                                className="w-6 h-6 flex items-center justify-center text-muted-foreground/30 hover:text-red-400 rounded transition-colors shrink-0"
                                data-testid={`button-delete-branch-${branch}`}
                              >
                                {branchOpStatus[branch] === "loading"
                                  ? <Loader2 size={11} className="animate-spin" />
                                  : branchOpStatus[branch] === "success"
                                  ? <CheckCircle size={11} className="text-green-400" />
                                  : <Trash2 size={11} />
                                }
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-3 text-xs text-muted-foreground/50">No branches found</div>
                    )}

                    {/* New branch form */}
                    <div className="border-t border-border/40 px-4 py-3 space-y-2">
                      <button
                        onClick={() => setShowNewBranch(v => !v)}
                        className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                        data-testid="button-new-branch"
                      >
                        <Plus size={12} /> New branch from <span className="font-mono ml-0.5">{currentBranch}</span>
                      </button>
                      <AnimatePresence>
                        {showNewBranch && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden space-y-2"
                          >
                            <input
                              type="text"
                              value={newBranchName}
                              onChange={e => setNewBranchName(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && handleCreateBranch()}
                              placeholder="feature/my-branch"
                              className="w-full bg-secondary/30 border border-border/50 rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-purple-400/50 transition-colors"
                              data-testid="input-new-branch-name"
                              autoFocus
                            />
                            <button
                              onClick={handleCreateBranch}
                              disabled={!newBranchName.trim() || branchOpStatus["create"] === "loading"}
                              className={cn(
                                "w-full py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                                newBranchName.trim()
                                  ? "bg-purple-500/20 border border-purple-400/40 text-purple-300 hover:bg-purple-500/30"
                                  : "bg-secondary/30 border border-border/30 text-muted-foreground/40 cursor-not-allowed"
                              )}
                              data-testid="button-create-branch"
                            >
                              {branchOpStatus["create"] === "loading" ? (
                                <><Loader2 size={11} className="animate-spin" /> Creating...</>
                              ) : branchOpStatus["create"] === "success" ? (
                                <><CheckCircle size={11} /> Branch created!</>
                              ) : branchOpStatus["create"] === "error" ? (
                                <><X size={11} /> Failed — check token permissions</>
                              ) : (
                                <><GitBranch size={11} /> Create branch</>
                              )}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Git Operations (Pull / Push) */}
        {githubConnected && remoteUrl && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpDown size={14} className="text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Sync</h3>
            </div>
            <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/50">
              {/* Pull */}
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Pull</p>
                  <p className="text-xs text-muted-foreground/60">Fetch latest changes from remote</p>
                </div>
                <button
                  onClick={handlePull}
                  disabled={pullStatus === "loading"}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                    pullStatus === "success"
                      ? "bg-green-500/20 border border-green-400/40 text-green-300"
                      : pullStatus === "loading"
                      ? "bg-blue-500/20 border border-blue-400/40 text-blue-300"
                      : "bg-secondary/40 border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                  )}
                  data-testid="button-pull"
                >
                  {pullStatus === "loading" ? (
                    <><Loader2 size={11} className="animate-spin" /> Pulling...</>
                  ) : pullStatus === "success" ? (
                    <><CheckCircle size={11} /> Done</>
                  ) : (
                    "Pull"
                  )}
                </button>
              </div>

              {/* Commit + Push */}
              <div className="px-4 py-3 space-y-2.5">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Commit & Push</p>
                    <p className="text-xs text-muted-foreground/60">{stagedFiles.size} file{stagedFiles.size !== 1 ? "s" : ""} staged</p>
                  </div>
                  <button
                    onClick={() => setShowCommit(v => !v)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/20 border border-purple-400/40 text-purple-300 hover:bg-purple-500/30 transition-all flex items-center gap-1.5"
                    data-testid="button-open-commit"
                  >
                    <ChevronDown size={11} className={cn("transition-transform", showCommit && "rotate-180")} />
                    Stage files
                  </button>
                </div>

                {/* File staging list */}
                <AnimatePresence>
                  {showCommit && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-2"
                    >
                      {/* Select all row */}
                      <div className="flex items-center justify-between py-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={stagedFiles.size === MOCK_CHANGED_FILES.length}
                            onChange={e => setStagedFiles(e.target.checked ? new Set(MOCK_CHANGED_FILES.map(f => f.path)) : new Set())}
                            className="w-3.5 h-3.5 accent-purple-500 cursor-pointer"
                            data-testid="checkbox-stage-all"
                          />
                          <span className="text-[11px] text-muted-foreground font-medium">Select all ({MOCK_CHANGED_FILES.length} changed)</span>
                        </label>
                      </div>

                      {/* File list */}
                      <div className="bg-secondary/20 border border-border/40 rounded-xl overflow-hidden divide-y divide-border/30">
                        {MOCK_CHANGED_FILES.map(file => {
                          const staged = stagedFiles.has(file.path);
                          const filename = file.path.split("/").pop() || file.path;
                          const dir = file.path.includes("/") ? file.path.substring(0, file.path.lastIndexOf("/")) : "";
                          return (
                            <label
                              key={file.path}
                              className={cn(
                                "flex items-center gap-2.5 px-3 py-2 cursor-pointer select-none transition-colors",
                                staged ? "bg-purple-500/5" : "opacity-50"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={staged}
                                onChange={e => {
                                  const next = new Set(stagedFiles);
                                  if (e.target.checked) next.add(file.path);
                                  else next.delete(file.path);
                                  setStagedFiles(next);
                                }}
                                className="w-3.5 h-3.5 accent-purple-500 cursor-pointer shrink-0"
                                data-testid={`checkbox-file-${file.path.replace(/\//g, "-")}`}
                              />
                              <span className={cn(
                                "text-[10px] font-bold w-4 shrink-0 text-center",
                                file.status === "A" ? "text-green-400" : "text-yellow-400"
                              )}>{file.status}</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-foreground font-medium truncate">{filename}</p>
                                {dir && <p className="text-[10px] text-muted-foreground/50 truncate">{dir}</p>}
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      {/* Commit message */}
                      <input
                        type="text"
                        value={commitMsg}
                        onChange={e => setCommitMsg(e.target.value)}
                        placeholder="Commit message..."
                        className="w-full bg-secondary/30 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-purple-400/50 transition-colors"
                        data-testid="input-commit-message"
                      />

                      {/* Push error */}
                      {pushError && (
                        <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-400/20 rounded-lg px-3 py-2">{pushError}</p>
                      )}

                      {/* Push button */}
                      <button
                        onClick={handlePush}
                        disabled={!commitMsg.trim() || stagedFiles.size === 0 || pushStatus === "loading"}
                        className={cn(
                          "w-full py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                          pushStatus === "success"
                            ? "bg-green-500/20 border border-green-400/40 text-green-300"
                            : pushStatus === "loading"
                            ? "bg-purple-500/20 border border-purple-400/40 text-purple-300"
                            : commitMsg.trim() && stagedFiles.size > 0
                            ? "bg-purple-500/20 border border-purple-400/40 text-purple-300 hover:bg-purple-500/30"
                            : "bg-secondary/30 border border-border/30 text-muted-foreground/40 cursor-not-allowed"
                        )}
                        data-testid="button-push"
                      >
                        {pushStatus === "loading" ? (
                          <><Loader2 size={11} className="animate-spin" /> Pushing {stagedFiles.size} file{stagedFiles.size !== 1 ? "s" : ""}...</>
                        ) : pushStatus === "success" ? (
                          <><CheckCircle size={11} /> Pushed to GitHub!</>
                        ) : (
                          <>Push {stagedFiles.size > 0 ? `${stagedFiles.size} file${stagedFiles.size !== 1 ? "s" : ""}` : "—"} to GitHub</>
                        )}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {/* Connections section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <GitBranch size={14} className="text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Connections</h3>
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/50">
            {connections.map((conn) => (
              <div key={conn.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-secondary/50 border border-border/50 flex items-center justify-center text-foreground shrink-0">
                  {conn.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">{conn.name}</span>
                    {conn.status === "connected" && (
                      <span className="text-[9px] bg-green-500/20 border border-green-400/30 text-green-400 px-1.5 rounded-full font-semibold">Active</span>
                    )}
                  </div>
                  {conn.username && (
                    <span className="text-xs text-muted-foreground/60">@{conn.username}</span>
                  )}
                </div>
                {conn.status === "connected" ? (
                  <button
                    onClick={() => handleDelete(conn.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 border border-red-400/20 hover:border-red-400/40 transition-all"
                    data-testid={`button-disconnect-${conn.id}`}
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                ) : (
                  <button
                    onClick={() => handleSignIn(conn.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border/50 hover:border-border hover:bg-secondary/50 transition-all"
                    data-testid={`button-connect-${conn.id}`}
                  >
                    <LogIn size={11} /> Sign in
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Commit Author section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <UserCircle2 size={14} className="text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Commit Author</h3>
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/20 transition-colors"
              onClick={() => setShowAuthorEdit(v => !v)}
              data-testid="button-toggle-author"
            >
              <div className="w-9 h-9 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold text-purple-300">{authorName[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-foreground">{authorName}</p>
                <p className="text-xs text-muted-foreground/60">{authorEmail}</p>
              </div>
              <ChevronDown size={15} className={cn("text-muted-foreground transition-transform", showAuthorEdit && "rotate-180")} />
            </button>
            <AnimatePresence>
              {showAuthorEdit && (
                <motion.div
                  initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                  className="overflow-hidden border-t border-border/40"
                >
                  <div className="px-4 py-3 space-y-2.5">
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Name</label>
                      <input
                        value={authorName}
                        onChange={e => setAuthorName(e.target.value)}
                        className="w-full bg-secondary/30 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-purple-400/50 transition-colors"
                        data-testid="input-author-name"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Email</label>
                      <input
                        value={authorEmail}
                        onChange={e => setAuthorEmail(e.target.value)}
                        className="w-full bg-secondary/30 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-purple-400/50 transition-colors"
                        data-testid="input-author-email"
                      />
                    </div>
                    <button
                      onClick={() => setShowAuthorEdit(false)}
                      className="w-full py-2 bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-semibold rounded-lg hover:bg-purple-500/30 transition-colors"
                      data-testid="button-save-author"
                    >
                      Save Author
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>

      {/* Repo Browser slides over GitPanel */}
      <AnimatePresence>
        {showRepoBrowser && (
          <RepoBrowser
            token={localStorage.getItem("git_token_github") || ""}
            onSelect={(url) => { setRemoteUrl(url); localStorage.setItem("git_remote_url", url); setShowRepoBrowser(false); }}
            onClose={() => setShowRepoBrowser(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   SECRETS PANEL
   ───────────────────────────────────────────────────────── */
interface SecretEntry { id: string; key: string; value: string }

function SecretsPanel({ onClose }: { onClose: () => void }) {
  const [secrets, setSecrets] = useState<SecretEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem("dev_secrets") || "[]"); } catch { return []; }
  });
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  const save = (s: SecretEntry[]) => { setSecrets(s); localStorage.setItem("dev_secrets", JSON.stringify(s)); };
  const addSecret = () => {
    if (!newKey.trim()) return;
    save([...secrets, { id: Date.now().toString(), key: newKey.trim(), value: newVal }]);
    setNewKey(""); setNewVal(""); setAdding(false);
  };
  const del = (id: string) => save(secrets.filter(s => s.id !== id));

  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 36 }}
      className="absolute inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-2 px-4 pt-10 pb-3 border-b border-border shrink-0">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 transition-colors"><ArrowLeft size={15} /> Back</button>
        <div className="flex-1" />
        <Key size={17} className="text-yellow-400" />
        <span className="text-base font-semibold text-foreground">Secrets</span>
        <div className="flex-1" />
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors"><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar">
        <p className="text-xs text-muted-foreground/70 leading-relaxed">Environment variables are accessible in your code via <code className="text-yellow-400 bg-secondary/50 px-1 rounded text-[10px]">process.env.KEY</code>. They are never exposed publicly.</p>
        <div className="space-y-2">
          {secrets.map(s => (
            <div key={s.id} className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2.5">
              <Key size={13} className="text-yellow-400 shrink-0" />
              <span className="text-xs font-mono font-semibold text-foreground flex-1 truncate">{s.key}</span>
              <span className="text-xs font-mono text-muted-foreground/60 flex-1 truncate">{visible[s.id] ? s.value : "••••••••"}</span>
              <button onClick={() => setVisible(v => ({ ...v, [s.id]: !v[s.id] }))} className="text-muted-foreground/50 hover:text-foreground transition-colors p-1">{visible[s.id] ? <EyeOff size={13} /> : <Eye size={13} />}</button>
              <button onClick={() => del(s.id)} className="text-red-400/60 hover:text-red-400 transition-colors p-1"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
        {adding ? (
          <div className="bg-card border border-border rounded-xl p-3 space-y-2">
            <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="KEY_NAME" className="w-full bg-secondary/30 border border-border/50 rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-yellow-400/50 transition-colors" autoFocus />
            <input value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="value" type="password" className="w-full bg-secondary/30 border border-border/50 rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-yellow-400/50 transition-colors" />
            <div className="flex gap-2">
              <button onClick={() => { setAdding(false); setNewKey(""); setNewVal(""); }} className="flex-1 py-2 rounded-lg text-xs border border-border/50 text-muted-foreground hover:bg-secondary/50 transition-colors">Cancel</button>
              <button onClick={addSecret} disabled={!newKey.trim()} className={cn("flex-1 py-2 rounded-lg text-xs font-semibold transition-colors", newKey.trim() ? "bg-yellow-500/20 border border-yellow-400/40 text-yellow-300 hover:bg-yellow-500/30" : "bg-secondary/30 text-muted-foreground/40 cursor-not-allowed")}>Add Secret</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-border hover:bg-secondary/20 transition-all"><Plus size={14} /> Add Secret</button>
        )}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   DATABASE PANEL
   ───────────────────────────────────────────────────────── */
const MOCK_TABLES = [
  { name: "users", rows: 12, cols: ["id", "email", "name", "created_at"] },
  { name: "projects", rows: 7, cols: ["id", "title", "user_id", "status", "created_at"] },
  { name: "conversations", rows: 34, cols: ["id", "title", "user_id", "updated_at"] },
  { name: "messages", rows: 128, cols: ["id", "conversation_id", "role", "content", "created_at"] },
];

function DatabasePanel({ onClose }: { onClose: () => void }) {
  const [expandedTable, setExpandedTable] = useState<string | null>(null);

  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 36 }}
      className="absolute inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-2 px-4 pt-10 pb-3 border-b border-border shrink-0">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 transition-colors"><ArrowLeft size={15} /> Back</button>
        <div className="flex-1" />
        <Database size={17} className="text-blue-400" />
        <span className="text-base font-semibold text-foreground">Database</span>
        <div className="flex-1" />
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors"><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 no-scrollbar">
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-400/20 rounded-xl px-3 py-2.5">
          <Wifi size={13} className="text-green-400 shrink-0" />
          <span className="text-xs text-green-400 font-medium">PostgreSQL connected</span>
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Tables</p>
        {MOCK_TABLES.map(t => (
          <div key={t.name} className="bg-card border border-border rounded-xl overflow-hidden">
            <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors" onClick={() => setExpandedTable(expandedTable === t.name ? null : t.name)}>
              <Table size={14} className="text-blue-400 shrink-0" />
              <span className="text-sm font-mono font-semibold text-foreground flex-1 text-left">{t.name}</span>
              <span className="text-xs text-muted-foreground/60">{t.rows} rows</span>
              <ChevronRight size={14} className={cn("text-muted-foreground transition-transform", expandedTable === t.name && "rotate-90")} />
            </button>
            <AnimatePresence>
              {expandedTable === t.name && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-border/40">
                  <div className="px-4 py-3 space-y-1.5">
                    {t.cols.map(col => (
                      <div key={col} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60 shrink-0" />
                        <span className="text-xs font-mono text-muted-foreground">{col}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   AUTH PANEL
   ───────────────────────────────────────────────────────── */
function AuthPanel({ onClose }: { onClose: () => void }) {
  const [providers, setProviders] = useState({
    email: true, google: false, github: false,
  });

  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 36 }}
      className="absolute inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-2 px-4 pt-10 pb-3 border-b border-border shrink-0">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 transition-colors"><ArrowLeft size={15} /> Back</button>
        <div className="flex-1" />
        <ShieldCheck size={17} className="text-purple-400" />
        <span className="text-base font-semibold text-foreground">Auth</span>
        <div className="flex-1" />
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors"><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 no-scrollbar">
        <p className="text-xs text-muted-foreground/70 leading-relaxed">Enable auth providers for your project. Users can sign in with any enabled method.</p>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3 px-1">Providers</p>
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/50">
            {[
              { id: "email", icon: <Mail size={16} />, label: "Email / Password", desc: "Classic email + password sign in", color: "text-blue-400" },
              { id: "google", icon: <Chrome size={16} />, label: "Google", desc: "Sign in with Google account", color: "text-red-400" },
              { id: "github", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>, label: "GitHub", desc: "Sign in with GitHub account", color: "text-foreground" },
            ].map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className={cn("w-8 h-8 rounded-lg bg-secondary/50 border border-border/50 flex items-center justify-center shrink-0", p.color)}>{p.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{p.label}</p>
                  <p className="text-xs text-muted-foreground/60">{p.desc}</p>
                </div>
                <button
                  onClick={() => setProviders(v => ({ ...v, [p.id]: !v[p.id as keyof typeof v] }))}
                  className={cn("relative w-10 h-5 rounded-full transition-colors shrink-0", providers[p.id as keyof typeof providers] ? "bg-purple-500" : "bg-secondary")}
                >
                  <motion.div animate={{ x: providers[p.id as keyof typeof providers] ? 20 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">Session Settings</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground/70">Session duration</span>
            <span className="text-xs text-foreground font-medium">7 days</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground/70">Remember me</span>
            <span className="text-xs text-green-400 font-medium">Enabled</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   RUN PANEL (terminal output)
   ───────────────────────────────────────────────────────── */
const MOCK_LOGS = [
  { t: "00:00", msg: "> pnpm run dev", cls: "text-muted-foreground" },
  { t: "00:01", msg: "> vite --host 0.0.0.0", cls: "text-muted-foreground" },
  { t: "00:02", msg: "  VITE v7.3.2  ready in 382ms", cls: "text-green-400" },
  { t: "00:02", msg: "  ➜  Local:   http://localhost:3000/", cls: "text-blue-400" },
  { t: "00:02", msg: "  ➜  Network: http://0.0.0.0:3000/", cls: "text-blue-400" },
  { t: "00:05", msg: "[HMR] connected.", cls: "text-muted-foreground/60" },
];

function RunPanel({ onClose }: { onClose: () => void }) {
  const [running, setRunning] = useState(true);
  const [logs, setLogs] = useState(MOCK_LOGS);

  const restart = () => {
    setRunning(false);
    setLogs([]);
    setTimeout(() => {
      setRunning(true);
      setLogs(MOCK_LOGS);
    }, 800);
  };

  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 36 }}
      className="absolute inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-2 px-4 pt-10 pb-3 border-b border-border shrink-0">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 transition-colors"><ArrowLeft size={15} /> Back</button>
        <div className="flex-1" />
        <div className={cn("w-2 h-2 rounded-full", running ? "bg-green-400" : "bg-red-400")} />
        <span className="text-base font-semibold text-foreground">Run</span>
        <div className="flex-1" />
        <button onClick={restart} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors"><RefreshCw size={15} /></button>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors"><X size={18} /></button>
      </div>
      <div className="flex-1 bg-[#0d1117] overflow-y-auto px-4 py-3 font-mono no-scrollbar">
        {!running ? (
          <div className="flex items-center gap-2 text-muted-foreground/60 text-xs"><Loader2 size={13} className="animate-spin" /> Starting...</div>
        ) : logs.map((l, i) => (
          <div key={i} className="flex items-start gap-3 text-xs leading-relaxed">
            <span className="text-muted-foreground/30 shrink-0 w-10">{l.t}</span>
            <span className={l.cls}>{l.msg}</span>
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-border bg-card/60 px-4 py-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground/60">$</span>
        <input placeholder="Enter command..." className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/40" />
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   DEPLOY PANEL
   ───────────────────────────────────────────────────────── */
function DeployPanel({ onClose }: { onClose: () => void }) {
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);

  const handleDeploy = async () => {
    setDeploying(true);
    await new Promise(r => setTimeout(r, 2500));
    setDeploying(false);
    setDeployed(true);
  };

  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 36 }}
      className="absolute inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-2 px-4 pt-10 pb-3 border-b border-border shrink-0">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 transition-colors"><ArrowLeft size={15} /> Back</button>
        <div className="flex-1" />
        <Rocket size={17} className="text-orange-400" />
        <span className="text-base font-semibold text-foreground">Deploy</span>
        <div className="flex-1" />
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors"><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar">
        {deployed ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-2xl bg-green-500/20 border border-green-400/30 flex items-center justify-center">
              <CheckCircle size={32} className="text-green-400" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">Deployed!</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Your app is live at</p>
              <button onClick={() => window.open("https://your-app.replit.app", "_blank")} className="text-sm text-blue-400 underline mt-1">your-app.replit.app</button>
            </div>
          </motion.div>
        ) : (
          <>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Server size={16} className="text-orange-400" />
                <p className="text-sm font-semibold text-foreground">Replit Autoscale</p>
                <span className="text-[9px] bg-blue-500/20 border border-blue-400/30 text-blue-300 px-1.5 rounded-full font-semibold ml-auto">Recommended</span>
              </div>
              <p className="text-xs text-muted-foreground/70 leading-relaxed">Automatically scales with traffic. Zero infrastructure management needed.</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground/60">Starts at</span>
                <span className="text-foreground font-medium">$0 / month</span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-green-400" />
                <p className="text-sm font-semibold text-foreground">Static Deployment</p>
              </div>
              <p className="text-xs text-muted-foreground/70 leading-relaxed">For static sites and SPAs. Fast CDN delivery worldwide.</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground/60">Cost</span>
                <span className="text-green-400 font-medium">Free</span>
              </div>
            </div>
            <button
              onClick={handleDeploy}
              disabled={deploying}
              className={cn("w-full flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-semibold transition-all",
                deploying ? "bg-orange-500/20 border border-orange-400/40 text-orange-300" : "bg-orange-500/20 border border-orange-400/40 text-orange-300 hover:bg-orange-500/30 active:scale-[0.98]"
              )}
            >
              {deploying ? <><Loader2 size={15} className="animate-spin" /> Deploying...</> : <><Rocket size={15} /> Deploy Now</>}
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   FILES PANEL
   ───────────────────────────────────────────────────────── */
const MOCK_FILES = [
  { name: "src", type: "folder", children: [
    { name: "components", type: "folder", children: [
      { name: "Button.tsx", type: "file" },
      { name: "Input.tsx", type: "file" },
    ]},
    { name: "pages", type: "folder", children: [
      { name: "index.tsx", type: "file" },
      { name: "about.tsx", type: "file" },
    ]},
    { name: "App.tsx", type: "file" },
    { name: "main.tsx", type: "file" },
  ]},
  { name: "public", type: "folder", children: [{ name: "index.html", type: "file" }] },
  { name: "package.json", type: "file" },
  { name: "vite.config.ts", type: "file" },
  { name: "tsconfig.json", type: "file" },
];

type FileNode = { name: string; type: string; children?: FileNode[] };

function FileTree({ nodes, depth = 0 }: { nodes: FileNode[]; depth?: number }) {
  const [open, setOpen] = useState<Record<string, boolean>>({ src: true });
  return (
    <div>
      {nodes.map(node => (
        <div key={node.name}>
          <button
            onClick={() => node.type === "folder" && setOpen(v => ({ ...v, [node.name]: !v[node.name] }))}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary/30 rounded-lg transition-colors text-left"
            style={{ paddingLeft: `${12 + depth * 16}px` }}
          >
            {node.type === "folder" ? (
              <ChevronRight size={13} className={cn("text-muted-foreground/60 transition-transform shrink-0", open[node.name] && "rotate-90")} />
            ) : (
              <div className="w-3.5 shrink-0" />
            )}
            {node.type === "folder" ? (
              <Folder size={13} className="text-yellow-400/80 shrink-0" />
            ) : (
              <FileText size={13} className="text-blue-400/80 shrink-0" />
            )}
            <span className="text-xs text-foreground truncate">{node.name}</span>
          </button>
          {node.type === "folder" && open[node.name] && node.children && (
            <FileTree nodes={node.children} depth={depth + 1} />
          )}
        </div>
      ))}
    </div>
  );
}

function FilesPanel({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState("");
  return (
    <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 36 }}
      className="absolute inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-2 px-4 pt-10 pb-3 border-b border-border shrink-0">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 transition-colors"><ArrowLeft size={15} /> Back</button>
        <div className="flex-1" />
        <Folder size={17} className="text-yellow-400" />
        <span className="text-base font-semibold text-foreground">Files</span>
        <div className="flex-1" />
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors"><X size={18} /></button>
      </div>
      <div className="px-4 py-2 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2 bg-secondary/30 rounded-lg px-3 h-8 border border-border/30">
          <Search size={13} className="text-muted-foreground/60 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files..." className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2 no-scrollbar">
        <FileTree nodes={MOCK_FILES} />
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   WEBVIEW PANEL
   ───────────────────────────────────────────────────────── */
function WebviewPanel({ onClose }: { onClose: () => void }) {
  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 36 }}
      className="absolute inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-2 px-4 pt-10 pb-3 border-b border-border shrink-0">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 transition-colors"><ArrowLeft size={15} /> Back</button>
        <div className="flex-1" />
        <Monitor size={17} className="text-cyan-400" />
        <span className="text-base font-semibold text-foreground">Webview</span>
        <div className="flex-1" />
        <button onClick={() => window.open(window.location.origin, "_blank")} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors"><ExternalLink size={15} /></button>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors"><X size={18} /></button>
      </div>
      <div className="px-3 py-2 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2 bg-secondary/30 rounded-lg px-3 h-8 border border-border/30">
          <Globe size={12} className="text-muted-foreground/60 shrink-0" />
          <span className="flex-1 text-xs text-muted-foreground/70 truncate">{window.location.origin}/</span>
          <RefreshCw size={12} className="text-muted-foreground/50 shrink-0 cursor-pointer hover:text-foreground transition-colors" />
        </div>
      </div>
      <div className="flex-1 bg-white">
        <iframe src="/" className="w-full h-full border-0" title="App Preview" />
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   GITHUB REPO BROWSER (used inside GitPanel)
   ───────────────────────────────────────────────────────── */
interface GHRepo { id: number; full_name: string; private: boolean; description: string | null; updated_at: string; stargazers_count: number; language: string | null }

function RepoBrowser({ token, onSelect, onClose }: { token: string; onSelect: (url: string) => void; onClose: () => void }) {
  const [repos, setRepos] = useState<GHRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator", {
          headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
        });
        if (!res.ok) throw new Error("Failed to fetch repos");
        setRepos(await res.json());
      } catch {
        setError("Could not load repos. Check your token permissions.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const filtered = repos.filter(r => !search || r.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 380, damping: 38 }}
      className="absolute inset-0 z-10 flex flex-col bg-background">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border shrink-0">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"><ArrowLeft size={15} /> Git</button>
        <div className="flex-1" />
        <span className="text-sm font-semibold text-foreground">Your Repositories</span>
        <div className="flex-1" />
      </div>
      <div className="px-4 py-2 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2 bg-secondary/30 rounded-lg px-3 h-8 border border-border/30">
          <Search size={13} className="text-muted-foreground/60 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search repos..." className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none" autoFocus />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground/60 text-sm"><Loader2 size={16} className="animate-spin" /> Loading repos...</div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 px-4 text-center"><AlertCircle size={20} className="text-red-400" /><p className="text-xs text-muted-foreground/70">{error}</p></div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground/60 text-sm">No repositories found</div>
        ) : filtered.map(r => (
          <button key={r.id} onClick={() => onSelect(`https://github.com/${r.full_name}.git`)}
            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-secondary/30 active:bg-secondary/50 transition-colors border-b border-border/20 text-left">
            <div className="w-8 h-8 rounded-lg bg-secondary/50 border border-border/50 flex items-center justify-center shrink-0 mt-0.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-foreground/70"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{r.full_name}</p>
              {r.description && <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{r.description}</p>}
              <div className="flex items-center gap-3 mt-1.5">
                {r.language && <span className="text-[10px] text-muted-foreground/50">{r.language}</span>}
                <span className="text-[10px] text-muted-foreground/50 flex items-center gap-0.5"><Star size={9} /> {r.stargazers_count}</span>
                <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-semibold", r.private ? "bg-secondary/60 text-muted-foreground/60" : "bg-green-500/10 text-green-400/80")}>{r.private ? "Private" : "Public"}</span>
              </div>
            </div>
            <ChevronRight size={14} className="text-muted-foreground/30 shrink-0 mt-1" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function TimeStamp({ date }: { date?: Date }) {
  const fmt = (d: Date) => {
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 5) return "Just now";
    if (diff < 60) return `${Math.round(diff)} seconds ago`;
    if (diff < 3600) return `${Math.round(diff / 60)} minutes ago`;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  if (!date) return null;
  return (
    <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground/60 py-1 pr-1">
      <AgentDots size={12} className="text-muted-foreground/40" />
      <span>{fmt(date)}</span>
    </div>
  );
}

function ActionsBadge({ count }: { count: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-1.5 py-1"
    >
      {[0, 1, 2].map(i => (
        <div key={i} className="w-6 h-6 bg-secondary/60 border border-border/50 rounded-md flex items-center justify-center">
          <Terminal size={11} className="text-muted-foreground/70" />
        </div>
      ))}
      <span className="text-xs text-muted-foreground/60 font-medium ml-0.5">{count} actions</span>
    </motion.div>
  );
}

function ActivityCard({ msgCount, actionCount, startTime }: {
  msgCount: number; actionCount: number; startTime: Date | null;
}) {
  const [open, setOpen] = useState(true);
  const [checkOpen, setCheckOpen] = useState(false);
  const [workOpen, setWorkOpen] = useState(false);

  if (msgCount === 0) return null;
  const workSecs = startTime ? Math.round((Date.now() - startTime.getTime()) / 60000) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-1 mb-3 bg-card border border-border/60 rounded-2xl overflow-hidden"
    >
      {/* Header row */}
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-secondary/30 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <ArrowUpDown size={15} className="text-muted-foreground shrink-0" />
        <span className="flex-1 text-sm font-medium text-foreground text-left">
          {msgCount} messages &amp; {actionCount} actions
        </span>
        <motion.span animate={{ rotate: open ? 0 : 180 }} transition={{ duration: 0.2 }}>
          <ChevronUp size={15} className="text-muted-foreground" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t border-border/40"
          >
            {/* Checkpoint row */}
            <button
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-secondary/20 transition-colors border-b border-border/30"
              onClick={() => setCheckOpen(v => !v)}
            >
              <CheckCircle2 size={15} className="text-green-400 shrink-0" />
              <span className="flex-1 text-sm text-muted-foreground text-left">
                Checkpoint made {workSecs <= 1 ? "just now" : `${workSecs} minutes ago`}
              </span>
              <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", checkOpen && "rotate-180")} />
            </button>
            <AnimatePresence>
              {checkOpen && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden bg-secondary/10">
                  <div className="px-4 py-3 text-xs text-muted-foreground">
                    Auto-checkpoint saved. You can restore this state from history.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Worked row */}
            <button
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-secondary/20 transition-colors"
              onClick={() => setWorkOpen(v => !v)}
            >
              <Clock size={15} className="text-muted-foreground shrink-0" />
              <span className="flex-1 text-sm text-muted-foreground text-left">
                Worked for {Math.max(workSecs, 1)} minute{workSecs !== 1 ? "s" : ""}
              </span>
              <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", workOpen && "rotate-180")} />
            </button>
            <AnimatePresence>
              {workOpen && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden bg-secondary/10">
                  <div className="px-4 py-3 text-xs text-muted-foreground">
                    Agent spent {Math.max(workSecs, 1)} minute{workSecs !== 1 ? "s" : ""} building your project across {actionCount} actions.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function BuildProgress({ steps }: { steps: BuildStep[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2 px-1 py-2" data-testid="build-progress">
      {steps.map((step) => (
        <motion.div key={step.id} className="flex items-center gap-3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
          {step.status === "done" ? (
            <CheckCircle2 size={16} className="text-green-400 shrink-0" />
          ) : step.status === "active" ? (
            <Loader2 size={16} className="text-primary animate-spin shrink-0" />
          ) : (
            <Circle size={16} className="text-muted-foreground/40 shrink-0" />
          )}
          <span className={cn("text-sm", step.status === "done" ? "text-green-400" : step.status === "active" ? "text-foreground" : "text-muted-foreground/50")}>
            {step.label}
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleCopyMsg = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (!isUser) {
    return (
      <div
        className="flex w-full flex-col items-start group"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
          data-testid={`message-${msg.role}-${msg.id}`}
        >
          <div className="text-sm leading-relaxed text-foreground max-w-none">
            <ReactMarkdown components={MARKDOWN_COMPONENTS}>{msg.content}</ReactMarkdown>
            {msg.isStreaming && (
              <motion.span
                className="inline-block w-0.5 h-4 bg-foreground ml-0.5 align-middle"
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.6, repeat: Infinity }}
              />
            )}
          </div>
        </motion.div>
        {msg.actionCount !== undefined && msg.actionCount > 0 && (
          <ActionsBadge count={msg.actionCount} />
        )}
        <div className="flex items-center gap-2 mt-1">
          <TimeStamp date={msg.timestamp} />
          <AnimatePresence>
            {(hovered || copied) && !msg.isStreaming && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.12 }}
                onClick={handleCopyMsg}
                className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                {copied ? <CheckCircle size={11} className="text-green-400" /> : <Copy size={11} />}
                {copied ? "Copied" : "Copy"}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Display user messages — strip [PLAN MODE] prefix from display
  const displayContent = msg.content.startsWith("[PLAN MODE]")
    ? msg.content.slice("[PLAN MODE]".length).trim()
    : msg.content;

  return (
    <div className="flex w-full flex-col items-end">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex w-full justify-end"
      >
        <div
          className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed bg-primary text-primary-foreground rounded-br-sm"
          data-testid={`message-${msg.role}-${msg.id}`}
        >
          <p className="whitespace-pre-wrap">{displayContent}</p>
        </div>
      </motion.div>
      <TimeStamp date={msg.timestamp} />
    </div>
  );
}

export default function Chat() {
  const [, setLocation] = useLocation();
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [currentAction, setCurrentAction] = useState("");
  const [repoData, setRepoData] = useState<FetchedRepo | null>(null);
  const [showRepoPanel, setShowRepoPanel] = useState(false);
  const [githubStatus, setGithubStatus] = useState<{
    status: "loading" | "success" | "error";
    owner: string; repo: string;
    filesLoaded?: number; error?: string; needsToken?: boolean;
  } | null>(null);
  const [buildSteps, setBuildSteps] = useState<BuildStep[]>([]);
  const [showBuildProgress, setShowBuildProgress] = useState(false);
  const [initialPrompt] = useState(() => sessionStorage.getItem("chat_prompt") || "");
  const [agentMode, setAgentMode] = useState<AgentMode>("Economy");
  const [showModes, setShowModes] = useState(false);
  const [fileSearch, setFileSearch] = useState("");
  const [planEnabled, setPlanEnabled] = useState(false);
  const [actionCount, setActionCount] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showGit, setShowGit] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [showDatabase, setShowDatabase] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);
  const [showWebview, setShowWebview] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; type: string; content: string; size: number }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hasInitialized = useRef(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isThinking, scrollToBottom]);

  // Animate action count while thinking
  useEffect(() => {
    if (!isThinking) return;
    const interval = setInterval(() => {
      setActionCount(c => c + 1);
    }, 1800);
    return () => clearInterval(interval);
  }, [isThinking]);

  const runBuildAnimation = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const steps = BUILD_STEPS.map((s) => ({ ...s }));
      setBuildSteps(steps);
      setShowBuildProgress(true);
      let stepIdx = 0;
      const advance = () => {
        if (stepIdx >= steps.length) { resolve(); return; }
        steps[stepIdx].status = "active";
        setBuildSteps([...steps]);
        setTimeout(() => {
          steps[stepIdx].status = "done";
          setBuildSteps([...steps]);
          stepIdx++;
          setTimeout(advance, 300);
        }, 700 + Math.random() * 500);
      };
      setTimeout(advance, 400);
    });
  }, []);

  const sendMessage = useCallback(async (content: string, convId: number) => {
    setIsThinking(true);
    setCurrentAction("");
    setShowBuildProgress(false);
    const assistantMsgId = `assistant-${Date.now()}`;
    let isFirst = true;

    // Create AbortController for stop button
    const controller = new AbortController();
    abortRef.current = controller;

    // Auto-fetch GitHub context if a GitHub URL is present
    let enrichedContent = content;
    const ghMatch = GITHUB_URL_RE.exec(content);
    if (ghMatch) {
      const owner = ghMatch[1];
      const repoName = ghMatch[2].replace(/\.git$/, "").split(/[#?/]/)[0];
      setGithubStatus({ status: "loading", owner, repo: repoName });
      const result = await fetchGitHubContext(content, owner, repoName, setCurrentAction);
      if (result.repoData) {
        enrichedContent = result.enriched;
        setRepoData(result.repoData);
        setGithubStatus({
          status: "success", owner, repo: repoName,
          filesLoaded: Object.keys(result.repoData.loadedContents).length,
        });
      } else {
        enrichedContent = content;
        setGithubStatus({
          status: "error", owner, repo: repoName,
          error: result.error, needsToken: result.needsToken,
        });
      }
    } else {
      setGithubStatus(null);
    }

    setCurrentAction("Generating response...");
    try {
      const response = await fetch(
        `${BASE_URL}/api/anthropic/conversations/${convId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: enrichedContent }),
          signal: controller.signal,
        }
      );
      if (!response.ok || !response.body) throw new Error("Stream request failed");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.action) {
              setCurrentAction(data.action);
            }
            if (data.content) {
              if (isFirst) {
                setIsThinking(false);
                setCurrentAction("");
                setMessages((prev) => [...prev, {
                  id: assistantMsgId, role: "assistant", content: data.content,
                  isStreaming: true, timestamp: new Date(),
                  actionCount: actionCount
                }]);
                isFirst = false;
              } else {
                setMessages((prev) => prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: m.content + data.content } : m
                ));
              }
            }
            if (data.done) {
              setMessages((prev) => prev.map((m) =>
                m.id === assistantMsgId ? { ...m, isStreaming: false } : m
              ));
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      setIsThinking(false);
      setCurrentAction("");
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (!isAbort) {
        setMessages((prev) => [...prev, {
          id: assistantMsgId, role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          timestamp: new Date()
        }]);
      } else {
        // Mark any streaming message as stopped
        setMessages((prev) => prev.map((m) =>
          m.isStreaming ? { ...m, isStreaming: false } : m
        ));
      }
    }
  }, [actionCount]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsThinking(false);
    setCurrentAction("");
    // Mark streaming messages as done
    setMessages((prev) => prev.map((m) => m.isStreaming ? { ...m, isStreaming: false } : m));
  }, []);

  const startConversation = useCallback(async (prompt: string) => {
    const userMsgId = `user-${Date.now()}`;
    const now = new Date();
    setStartTime(now);
    setActionCount(0);
    setMessages([{ id: userMsgId, role: "user", content: prompt, timestamp: now }]);
    setIsThinking(true);
    try {
      const convRes = await fetch(`${BASE_URL}/api/anthropic/conversations`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: prompt.slice(0, 80) }),
      });
      if (!convRes.ok) throw new Error("Failed to create conversation");
      const conv = await convRes.json();
      setConversationId(conv.id);
      await runBuildAnimation();
      await sendMessage(prompt, conv.id);
    } catch {
      setIsThinking(false);
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`, role: "assistant",
        content: "Failed to start conversation. Please try again.",
        timestamp: new Date()
      }]);
    }
  }, [runBuildAnimation, sendMessage]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    if (initialPrompt) {
      sessionStorage.removeItem("chat_prompt");
      startConversation(initialPrompt);
    }
  }, [initialPrompt, startConversation]);

  const handleSubmit = async (overrideContent?: string) => {
    const rawContent = overrideContent ?? input.trim();
    if ((!rawContent && attachments.length === 0) || isThinking) return;
    // Snapshot attachments then clear
    const currentAttachments = [...attachments];
    if (!overrideContent) setInput("");
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Build file context block to append to the message
    let fileContext = "";
    if (currentAttachments.length > 0) {
      const parts = currentAttachments
        .filter(a => a.content)
        .map(a => {
          const isImage = a.type.startsWith("image/");
          if (isImage) {
            // For images, just mention the filename — the model can't see base64 without vision
            return `[Attached image: ${a.name} (${formatBytes(a.size)})]`;
          }
          const MAX_CHARS = 12000;
          const truncated = a.content.length > MAX_CHARS
            ? a.content.slice(0, MAX_CHARS) + `\n... [truncated, ${a.content.length - MAX_CHARS} more chars]`
            : a.content;
          return `\`\`\`${getFileLanguage(a.name)}\n// File: ${a.name}\n${truncated}\n\`\`\``;
        });
      if (parts.length > 0) {
        fileContext = "\n\n---\n**Attached files:**\n\n" + parts.join("\n\n");
      }
    }

    const baseContent = rawContent || (currentAttachments.length > 0 ? `Please analyze the attached file${currentAttachments.length > 1 ? "s" : ""}.` : "");
    const contentWithFiles = baseContent + fileContext;
    const content = planEnabled ? `[PLAN MODE] ${contentWithFiles}` : contentWithFiles;

    // Display message — show the user's text + attachment names (not the full file dump)
    const displayContent = planEnabled
      ? `[PLAN MODE] ${baseContent}${currentAttachments.length > 0 ? `\n📎 ${currentAttachments.map(a => a.name).join(", ")}` : ""}`
      : `${baseContent}${currentAttachments.length > 0 ? `\n📎 ${currentAttachments.map(a => a.name).join(", ")}` : ""}`;

    const now = new Date();
    const userMsgId = `user-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userMsgId, role: "user", content: displayContent, timestamp: now }]);
    if (!conversationId) { await startConversation(content); }
    else { await sendMessage(content, conversationId); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2000);
  };

  const handleClearChat = () => {
    setMessages([]);
    setConversationId(null);
    setGithubStatus(null);
    setRepoData(null);
    setShowMoreMenu(false);
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string ?? "");
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      // Images → base64 data URL; text files → plain text
      if (file.type.startsWith("image/")) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    const loaded = await Promise.all(
      files.map(async (f) => {
        try {
          const content = await readFileAsText(f);
          return { name: f.name, type: f.type, content, size: f.size };
        } catch {
          return { name: f.name, type: f.type, content: "", size: f.size };
        }
      })
    );
    setAttachments(prev => [...prev, ...loaded]);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex flex-col h-[100dvh] max-w-[480px] mx-auto w-full bg-background overflow-hidden"
    >
      {/* ── Hidden file input ── */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.md,.json,.ts,.tsx,.js,.jsx,.py,.rs,.go,.css,.html"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── Share toast ── */}
      <AnimatePresence>
        {shareToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-green-500/90 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5"
          >
            <CheckCircle size={12} /> Link copied!
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── More menu ── */}
      <AnimatePresence>
        {showMoreMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ duration: 0.13 }}
              className="absolute top-20 right-3 z-50 w-44 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            >
              {[
                { label: "New chat", icon: <Plus size={14} />, action: handleClearChat },
                { label: "Clear messages", icon: <Trash2 size={14} />, action: handleClearChat, danger: true },
                { label: "History", icon: <History size={14} />, action: () => { setShowHistory(true); setShowMoreMenu(false); } },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-secondary/50 transition-colors text-left",
                    item.danger ? "text-red-400" : "text-foreground"
                  )}
                >
                  <span className={item.danger ? "text-red-400" : "text-muted-foreground"}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 pt-10 pb-3 border-b border-border shrink-0">
        {/* Left group */}
        <div className="flex items-center gap-1 bg-secondary/40 border border-border/60 rounded-xl px-1 py-1">
          <button
            onClick={() => setLocation("/")}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors"
            data-testid="button-history"
          >
            <History size={18} />
          </button>
        </div>

        {/* Center - Agent title */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/30 border border-border/40 rounded-xl">
          <AgentDots size={16} className="text-purple-400" />
          <span className="text-sm font-semibold text-foreground">Agent</span>
        </div>

        {/* Right group */}
        <div className="flex items-center gap-1 bg-secondary/40 border border-border/60 rounded-xl px-1 py-1">
          <button
            onClick={handleShare}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary/60 transition-colors",
              shareToast ? "text-green-400" : "text-muted-foreground hover:text-foreground"
            )}
            data-testid="button-share"
          >
            <Share2 size={17} />
          </button>
          <button
            onClick={() => setShowMoreMenu(v => !v)}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary/60 transition-colors",
              showMoreMenu ? "text-foreground bg-secondary/60" : "text-muted-foreground hover:text-foreground"
            )}
            data-testid="button-more"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 no-scrollbar">
        {/* Empty state */}
        <AnimatePresence>
          {messages.length === 0 && !isThinking && (
            <EmptyState onPrompt={(p) => handleSubmit(p)} />
          )}
        </AnimatePresence>

        {/* Activity summary card */}
        <ActivityCard msgCount={messages.length} actionCount={actionCount} startTime={startTime} />

        <AnimatePresence initial={false}>
          {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
        </AnimatePresence>

        {/* Build steps */}
        <AnimatePresence>
          {showBuildProgress && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex justify-start">
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                  <AgentDots size={10} className="text-primary-foreground" />
                </div>
                <div className="bg-card border border-card-border rounded-2xl rounded-bl-sm px-4 py-3">
                  <BuildProgress steps={buildSteps} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* GitHub context status card */}
        <AnimatePresence>
          {githubStatus && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "rounded-2xl border px-4 py-3 text-xs",
                githubStatus.status === "success" && "bg-green-500/8 border-green-500/20",
                githubStatus.status === "loading" && "bg-secondary/30 border-border/50",
                githubStatus.status === "error" && "bg-red-500/8 border-red-500/20"
              )}
            >
              {githubStatus.status === "loading" && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 size={12} className="animate-spin shrink-0" />
                  <span>Fetching <span className="font-mono text-foreground">{githubStatus.owner}/{githubStatus.repo}</span>…</span>
                </div>
              )}
              {githubStatus.status === "success" && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-green-400 min-w-0">
                    <CheckCircle size={12} className="shrink-0" />
                    <span className="truncate">
                      <span className="font-mono font-semibold">{githubStatus.owner}/{githubStatus.repo}</span>
                      {" — "}{githubStatus.filesLoaded} files loaded into context
                    </span>
                  </div>
                  <button
                    onClick={() => setShowRepoPanel(true)}
                    className="shrink-0 text-green-400/70 hover:text-green-400 underline transition-colors"
                  >
                    Browse →
                  </button>
                </div>
              )}
              {githubStatus.status === "error" && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-red-400">
                    <AlertCircle size={12} className="shrink-0 mt-0.5" />
                    <span className="font-mono font-semibold shrink-0">{githubStatus.owner}/{githubStatus.repo}:</span>
                    <span className="text-red-300/80 flex-1">{githubStatus.error}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {githubStatus.needsToken && (
                      <button
                        onClick={() => setShowGit(true)}
                        className="flex items-center gap-1.5 text-orange-400/80 hover:text-orange-400 transition-colors"
                      >
                        <Key size={11} />
                        Add GitHub token →
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const last = messages.findLast(m => m.role === "user");
                        if (last && conversationId) {
                          sendMessage(last.content, conversationId);
                        }
                      }}
                      className="flex items-center gap-1.5 text-muted-foreground/60 hover:text-foreground transition-colors ml-auto"
                    >
                      <RefreshCw size={11} />
                      Retry
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Thinking / Working cards */}
        <AnimatePresence>
          {isThinking && !showBuildProgress && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {actionCount < 3 ? <ThinkingCard action={currentAction || undefined} /> : <WorkingCard />}
              {actionCount >= 3 && (
                <PlanningStep
                  label="Planning UI element implementation"
                  elapsed={Math.max(actionCount * 4, 1)}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* ── Dev Tools Bar ── */}
      <div className="shrink-0 border-t border-border bg-card/60">
        <div className="flex items-stretch h-14">
          {[
            { icon: <Lock size={19} />, label: "Secrets", testId: "tool-secrets", onClick: () => setShowSecrets(true) },
            { icon: <Database size={19} />, label: "Database", testId: "tool-database", onClick: () => setShowDatabase(true) },
            { icon: <UserPlus size={19} />, label: "Auth", testId: "tool-auth", onClick: () => setShowAuth(true) },
            { icon: <GitBranch size={19} />, label: "Git", testId: "tool-git", onClick: () => setShowGit(true) },
          ].map((tool, i) => (
            <motion.button
              key={tool.label}
              whileTap={{ scale: 0.92 }}
              onClick={tool.onClick}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 active:bg-secondary transition-colors",
                i < 3 && "border-r border-border/50",
                tool.label === "Git" && "hover:text-green-400"
              )}
              data-testid={tool.testId}
            >
              {tool.icon}
              <span className="text-[10px] font-medium">{tool.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── File Search Bar ── */}
      <div className="shrink-0 border-t border-border/50 bg-background">
        <div className="flex items-center h-11 px-1 gap-1">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => repoData && setShowRepoPanel(true)}
            className={cn(
              "relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-secondary/50 transition-colors",
              repoData ? "text-green-400 hover:text-green-300" : "text-muted-foreground hover:text-foreground"
            )}
            data-testid="button-files"
            title={repoData ? `Browse ${repoData.owner}/${repoData.repo}` : "No repo loaded"}
          >
            <Folder size={18} />
            {repoData && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-400 border border-background" />
            )}
          </motion.button>
          <div className="flex-1 flex items-center gap-2 bg-secondary/30 rounded-lg px-3 h-8 border border-border/30">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search..."
              value={fileSearch}
              onChange={e => setFileSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              data-testid="input-file-search"
            />
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/50 transition-colors"
            onClick={() => setFileSearch("")}
            data-testid="button-close-search"
          >
            <X size={18} />
          </motion.button>
        </div>
      </div>

      {/* ── Input Area ── */}
      <div className="shrink-0 px-3 pb-3 pt-2 border-t border-border bg-background relative">
        {/* Agent Modes Panel */}
        <AnimatePresence>
          {showModes && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowModes(false)} />
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full mb-1 left-3 right-3 z-40 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-3">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest px-1 mb-2">Agent modes</p>
                  <div className="grid grid-cols-4 gap-1.5 mb-3">
                    {AGENT_MODES.map((mode) => (
                      <motion.button
                        key={mode.id}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => { setAgentMode(mode.id); setShowModes(false); }}
                        className={cn(
                          "relative px-2 py-2.5 rounded-xl text-sm font-semibold transition-all border",
                          agentMode === mode.id
                            ? "bg-secondary border-primary/40 text-foreground shadow-sm"
                            : "bg-transparent border-transparent text-muted-foreground hover:bg-secondary/50"
                        )}
                        data-testid={`agent-mode-${mode.id.toLowerCase().replace("+", "-plus")}`}
                      >
                        {mode.badge && (
                          <span className="absolute -top-1.5 -left-0.5 text-[9px] bg-purple-500 text-white px-1 rounded-sm font-bold leading-none py-0.5">
                            {mode.badge}
                          </span>
                        )}
                        <span className={mode.color}>{mode.id}</span>
                      </motion.button>
                    ))}
                  </div>
                  <div className="px-2 py-2.5 bg-secondary/40 rounded-xl border border-border/30">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {AGENT_MODES.find(m => m.id === agentMode)?.desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="bg-card rounded-2xl border border-card-border p-3 shadow-lg flex flex-col gap-2.5">
          {/* Attachment chips */}
          <AnimatePresence>
            {attachments.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap gap-1.5"
              >
                {attachments.map((att, i) => {
                  const isImage = att.type.startsWith("image/");
                  const langColor: Record<string, string> = {
                    typescript: "text-blue-400", tsx: "text-blue-400",
                    javascript: "text-yellow-400", jsx: "text-yellow-400",
                    python: "text-green-400", rust: "text-orange-400",
                    html: "text-orange-300", css: "text-purple-400",
                    json: "text-gray-300", markdown: "text-gray-400",
                  };
                  const lang = getFileLanguage(att.name);
                  const dotColor = langColor[lang] ?? "text-muted-foreground";
                  return (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 bg-secondary/60 border border-border/60 rounded-lg text-xs text-foreground/80 max-w-[160px]"
                    >
                      {isImage
                        ? <Image size={11} className="text-purple-400 shrink-0" />
                        : <span className={cn("w-2 h-2 rounded-full bg-current shrink-0", dotColor)} />
                      }
                      <span className="truncate font-mono font-medium">{att.name}</span>
                      <span className="text-muted-foreground/50 shrink-0 text-[10px]">{formatBytes(att.size)}</span>
                      <button
                        onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                        className="text-muted-foreground/50 hover:text-red-400 transition-colors ml-0.5 shrink-0"
                      >
                        <X size={10} />
                      </button>
                    </motion.span>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder={planEnabled ? "Describe what to plan..." : "Make, test, iterate..."}
            className="w-full bg-transparent resize-none outline-none text-foreground placeholder:text-muted-foreground/60 min-h-[36px] max-h-[120px] text-sm"
            data-testid="input-chat"
            rows={1}
          />
          <div className="flex items-center gap-2">
            {/* + attach */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleAttachClick}
              className="w-7 h-7 rounded-full bg-secondary/70 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors border border-border/60 shrink-0"
              data-testid="button-attach"
              title="Attach file"
            >
              <Paperclip size={13} />
            </motion.button>

            {/* Plan toggle */}
            <button
              onClick={() => setPlanEnabled(v => !v)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all shrink-0",
                planEnabled
                  ? "bg-primary/15 border-primary/40 text-primary shadow-[0_0_8px_rgba(139,92,246,0.2)]"
                  : "bg-secondary/40 border-border/50 text-muted-foreground hover:text-foreground"
              )}
              data-testid="switch-plan"
            >
              <motion.div
                className={cn("w-3 h-3 rounded-full border-2 shrink-0", planEnabled ? "bg-primary border-primary" : "border-muted-foreground bg-transparent")}
                animate={{ scale: planEnabled ? 1.1 : 1 }}
              />
              Plan
            </button>

            {/* Agent mode pill */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setShowModes(!showModes)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/50 border border-border/50 hover:bg-secondary transition-colors shrink-0"
              data-testid="button-agent-mode"
            >
              <AgentDots size={11} className="text-foreground/80" />
              <span className="text-xs font-medium text-foreground">{agentMode}</span>
              <ChevronDown size={10} className="text-muted-foreground" />
            </motion.button>

            <div className="flex-1" />

            {/* Send / Stop button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={isThinking ? handleStop : () => handleSubmit()}
              disabled={!input.trim() && !isThinking && attachments.length === 0}
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0",
                isThinking
                  ? "bg-red-500/80 hover:bg-red-500 text-white shadow-md"
                  : (input.trim() || attachments.length > 0)
                  ? "bg-primary text-primary-foreground shadow-md hover:brightness-110"
                  : "bg-secondary text-muted-foreground opacity-40 cursor-not-allowed"
              )}
              data-testid="button-send-chat"
            >
              {isThinking ? (
                <motion.div
                  animate={{ scale: [1, 0.85, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <Square size={13} fill="currentColor" />
                </motion.div>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 12V4M8 4L4 8M8 4L12 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* ── Workspace Toolbar ── */}
      <div className="shrink-0 border-t border-border bg-card/90">
        <div className="flex items-center justify-around h-13 px-1 py-1 relative">

          {/* Run */}
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowRun(true)} className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors" data-testid="toolbar-run" title="Run">
            <Play size={19} />
          </motion.button>

          {/* Webview */}
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowWebview(true)} className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors" data-testid="toolbar-webview" title="Webview">
            <Monitor size={19} />
          </motion.button>

          {/* Agent — active with glow + underline indicator */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            className="relative w-11 h-11 flex flex-col items-center justify-center gap-0.5 rounded-xl bg-[#2a1f4e]/70 border border-purple-500/30 transition-colors"
            data-testid="toolbar-agent"
            title="Agent"
          >
            <motion.div
              animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <AgentIcon size={22} className="text-purple-400" />
            </motion.div>
            {/* Active underline */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-purple-400" />
          </motion.button>

          {/* Separator */}
          <div className="w-px h-6 bg-border/50 mx-1" />

          {/* Deploy */}
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowDeploy(true)} className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors" data-testid="toolbar-deploy" title="Deploy">
            <Globe size={19} />
          </motion.button>

          {/* New Tab */}
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowFiles(true)} className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors" data-testid="toolbar-new-tab" title="Files">
            <Plus size={19} />
          </motion.button>

          {/* Files */}
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowFiles(true)} className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors" data-testid="toolbar-files" title="Files">
            <AlignJustify size={19} />
          </motion.button>

          {/* Split */}
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowWebview(true)} className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors" data-testid="toolbar-split" title="Webview">
            <LayoutPanelLeft size={19} />
          </motion.button>
        </div>
      </div>

      {/* ── Repo Viewer Panel (slides up from bottom) ── */}
      <AnimatePresence>
        {showRepoPanel && repoData && (
          <RepoViewerPanel
            repo={repoData}
            onClose={() => setShowRepoPanel(false)}
            onUpdate={updated => setRepoData(updated)}
          />
        )}
      </AnimatePresence>

      {/* ── History Panel (slides in from right) ── */}
      <AnimatePresence>
        {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}
      </AnimatePresence>

      {/* ── Git Panel (slides up from bottom) ── */}
      <AnimatePresence>
        {showGit && <GitPanel onClose={() => setShowGit(false)} />}
      </AnimatePresence>

      {/* ── Secrets Panel ── */}
      <AnimatePresence>
        {showSecrets && <SecretsPanel onClose={() => setShowSecrets(false)} />}
      </AnimatePresence>

      {/* ── Database Panel ── */}
      <AnimatePresence>
        {showDatabase && <DatabasePanel onClose={() => setShowDatabase(false)} />}
      </AnimatePresence>

      {/* ── Auth Panel ── */}
      <AnimatePresence>
        {showAuth && <AuthPanel onClose={() => setShowAuth(false)} />}
      </AnimatePresence>

      {/* ── Files Panel ── */}
      <AnimatePresence>
        {showFiles && <FilesPanel onClose={() => setShowFiles(false)} />}
      </AnimatePresence>

      {/* ── Run Panel ── */}
      <AnimatePresence>
        {showRun && <RunPanel onClose={() => setShowRun(false)} />}
      </AnimatePresence>

      {/* ── Deploy Panel ── */}
      <AnimatePresence>
        {showDeploy && <DeployPanel onClose={() => setShowDeploy(false)} />}
      </AnimatePresence>

      {/* ── Webview Panel ── */}
      <AnimatePresence>
        {showWebview && <WebviewPanel onClose={() => setShowWebview(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}
