// Client-side language metadata. Snippets live on the server.

export type LangId =
  | "javascript"
  | "typescript"
  | "python"
  | "java"
  | "csharp"
  | "cpp"
  | "go"
  | "rust"
  | "sql"
  | "bash"
  | "ruby"
  | "php"
  | "kotlin"
  | "swift";

export type Difficulty = "easy" | "medium" | "hard";

export interface LangMeta {
  id: LangId;
  label: string;
  color: string; // hex used for accent
  icon: string; // short label / emoji-ish for header
}

export const LANGUAGES: LangMeta[] = [
  { id: "javascript", label: "JavaScript", color: "#f7df1e", icon: "JS" },
  { id: "typescript", label: "TypeScript", color: "#3178c6", icon: "TS" },
  { id: "python", label: "Python", color: "#3776ab", icon: "PY" },
  { id: "java", label: "Java", color: "#f89820", icon: "JA" },
  { id: "csharp", label: "C#", color: "#9b4f96", icon: "C#" },
  { id: "cpp", label: "C++", color: "#00599c", icon: "C++" },
  { id: "go", label: "Go", color: "#00add8", icon: "GO" },
  { id: "rust", label: "Rust", color: "#dea584", icon: "RS" },
  { id: "sql", label: "SQL", color: "#e38c00", icon: "SQL" },
  { id: "bash", label: "Bash", color: "#4eaa25", icon: "SH" },
  { id: "ruby", label: "Ruby", color: "#cc342d", icon: "RB" },
  { id: "php", label: "PHP", color: "#777bb4", icon: "PHP" },
  { id: "kotlin", label: "Kotlin", color: "#7f52ff", icon: "KT" },
  { id: "swift", label: "Swift", color: "#f05138", icon: "SW" }
];

export const DIFFICULTIES: { id: Difficulty; label: string; desc: string }[] = [
  { id: "easy", label: "Fácil", desc: "Snippets curtos, sintaxe básica" },
  { id: "medium", label: "Médio", desc: "Snippets do dia a dia, ~10 linhas" },
  { id: "hard", label: "Difícil", desc: "Snippets longos com sintaxe avançada" }
];

export function langById(id: string): LangMeta | undefined {
  return LANGUAGES.find(l => l.id === id);
}
