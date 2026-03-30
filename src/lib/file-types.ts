// File types that Claude CLI / Agent SDK can read via the Read tool

export type SourceFileType =
  | "text"
  | "markdown"
  | "pdf"
  | "image"
  | "code"
  | "data"
  | "notebook"
  | "document";

const EXT_MAP: Record<string, SourceFileType> = {
  // Text
  ".txt": "text",
  ".log": "text",
  ".ini": "text",
  ".cfg": "text",
  ".conf": "text",
  ".env": "text",
  ".rtf": "text",

  // Markdown
  ".md": "markdown",
  ".mdx": "markdown",
  ".markdown": "markdown",

  // PDF
  ".pdf": "pdf",

  // Images (Claude is multimodal)
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".gif": "image",
  ".webp": "image",
  ".svg": "image",

  // Code
  ".js": "code",
  ".jsx": "code",
  ".ts": "code",
  ".tsx": "code",
  ".py": "code",
  ".go": "code",
  ".rs": "code",
  ".java": "code",
  ".c": "code",
  ".cpp": "code",
  ".h": "code",
  ".cs": "code",
  ".rb": "code",
  ".php": "code",
  ".swift": "code",
  ".kt": "code",
  ".sh": "code",
  ".bash": "code",
  ".ps1": "code",
  ".sql": "code",
  ".r": "code",
  ".html": "code",
  ".css": "code",
  ".scss": "code",
  ".less": "code",
  ".vue": "code",
  ".svelte": "code",

  // Data / structured
  ".json": "data",
  ".jsonl": "data",
  ".csv": "data",
  ".tsv": "data",
  ".xml": "data",
  ".yaml": "data",
  ".yml": "data",
  ".toml": "data",

  // Notebooks
  ".ipynb": "notebook",

  // Documents (text-extractable)
  ".docx": "document",
  ".doc": "document",
  ".pptx": "document",
  ".ppt": "document",
  ".xlsx": "document",
  ".xls": "document",
};

export function detectFileType(filename: string): SourceFileType {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  return EXT_MAP[ext] ?? "text";
}

export function isReadableAsText(fileType: SourceFileType): boolean {
  return ["text", "markdown", "code", "data"].includes(fileType);
}

export function isBinaryFile(fileType: SourceFileType): boolean {
  return ["pdf", "image", "document", "notebook"].includes(fileType);
}

// Extensions accepted by the file picker
export const ACCEPTED_EXTENSIONS = Object.keys(EXT_MAP).join(",");

// Human-readable description
export const SUPPORTED_TYPES_LABEL =
  "Text, Markdown, PDF, Images, Code, CSV/JSON/XML/YAML, Jupyter notebooks, Word/Excel/PowerPoint";
