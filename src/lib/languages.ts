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
  | "swift"
  | "lua"
  | "dart"
  | "scala"
  | "elixir"
  | "erlang"
  | "haskell"
  | "julia"
  | "clojure"
  | "fortran"
  | "cobol";

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
  { id: "swift", label: "Swift", color: "#f05138", icon: "SW" },
  { id: "lua", label: "Lua", color: "#2c2d72", icon: "LUA" },
  { id: "dart", label: "Dart", color: "#0175c2", icon: "DT" },
  { id: "scala", label: "Scala", color: "#dc322f", icon: "SC" },
  { id: "elixir", label: "Elixir", color: "#4b275f", icon: "EX" },
  { id: "erlang", label: "Erlang", color: "#a90533", icon: "ERL" },
  { id: "haskell", label: "Haskell", color: "#5e5086", icon: "HS" },
  { id: "julia", label: "Julia", color: "#9558b2", icon: "JL" },
  { id: "clojure", label: "Clojure", color: "#5881d8", icon: "CLJ" },
  { id: "fortran", label: "Fortran", color: "#734f96", icon: "F90" },
  { id: "cobol", label: "COBOL", color: "#005ca5", icon: "CBL" }
];

// Nomes inspirados na carreira dev (#73): a progressão continua clara, mas com a
// identidade do CodeRacer. Só a NOMENCLATURA muda — os `id` seguem easy/medium/hard,
// que são a chave de tudo (allowlist da API, snippets, leaderboard, filtros).
export const DIFFICULTIES: { id: Difficulty; label: string; desc: string }[] = [
  { id: "easy", label: "🟢 Júnior", desc: "Snippets curtos, sintaxe básica" },
  { id: "medium", label: "🔵 Pleno", desc: "Snippets do dia a dia, ~10 linhas" },
  { id: "hard", label: "🟣 Sênior", desc: "Snippets longos com sintaxe avançada" }
];

export function langById(id: string): LangMeta | undefined {
  return LANGUAGES.find(l => l.id === id);
}
