// Client-side language metadata. Snippets live on the server.

export type LangId =
  | "javascript"
  | "typescript"
  | "python"
  | "java"
  | "csharp"
  | "cpp"
  | "go"
  | "rust";

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
  { id: "rust", label: "Rust", color: "#dea584", icon: "RS" }
];

export const DIFFICULTIES: { id: Difficulty; label: string; desc: string }[] = [
  { id: "easy", label: "Fácil", desc: "Snippets curtos, sintaxe básica" },
  { id: "medium", label: "Médio", desc: "Snippets do dia a dia, ~10 linhas" },
  { id: "hard", label: "Difícil", desc: "Snippets longos com sintaxe avançada" }
];

export function langById(id: string): LangMeta | undefined {
  return LANGUAGES.find(l => l.id === id);
}
