// Lightweight, dependency-free, multi-language tokenizer for the editor look.
// Not a true parser — a generic single-pass lexer (comments, strings, numbers,
// keywords, calls, types, punctuation) themed to the CodeRacer neon palette.
// Good enough to make code "look like an editor" across all our languages.

export type TokType =
  | "comment"
  | "string"
  | "number"
  | "keyword"
  | "function"
  | "type"
  | "punctuation"
  | "plain";

export interface Tok {
  text: string;
  type: TokType;
}

const COLORS: Record<TokType, string> = {
  comment: "#5c6675",
  string: "#fbbf24",
  number: "#00e5ff",
  keyword: "#c084fc",
  function: "#00ff88",
  type: "#5ed6df",
  punctuation: "#9aa4b2",
  plain: "#e6edf3"
};

export function tokColor(t: TokType): string {
  return COLORS[t];
}

const KEYWORDS = new Set([
  // js / ts
  "const", "let", "var", "function", "return", "if", "else", "for", "while", "do", "switch",
  "case", "break", "continue", "class", "extends", "implements", "interface", "enum", "import",
  "export", "from", "default", "new", "this", "super", "typeof", "instanceof", "in", "of", "await",
  "async", "yield", "try", "catch", "finally", "throw", "delete", "void", "static", "readonly",
  "abstract", "namespace", "declare", "as", "is", "keyof", "type", "satisfies", "get", "set",
  // python
  "def", "elif", "except", "with", "pass", "lambda", "None", "True", "False", "and", "or", "not",
  "global", "nonlocal", "del", "raise", "assert", "self",
  // java / c# / kotlin / swift
  "public", "private", "protected", "internal", "final", "override", "virtual", "sealed", "data",
  "fun", "val", "when", "companion", "object", "init", "suspend", "func", "guard", "defer",
  "protocol", "extension", "where", "throws", "rethrows", "inout", "mutating", "weak", "unowned",
  "lazy", "using", "record", "let", "boolean", "int", "long", "short", "byte", "char", "float",
  "double", "bool", "string", "null", "nil", "true", "false",
  // c / c++ / rust / go
  "include", "template", "typename", "auto", "constexpr", "nullptr", "struct", "union", "operator",
  "fn", "pub", "mut", "impl", "trait", "mod", "use", "match", "ref", "move", "unsafe", "dyn",
  "package", "go", "chan", "range", "select", "map", "defer",
  // bash / php / ruby
  "echo", "local", "then", "fi", "done", "esac", "require", "require_relative", "module", "begin",
  "rescue", "ensure", "unless", "until", "puts", "print", "println", "foreach", "endforeach",
  "attr_reader", "attr_accessor", "end"
]);

const SQL_UPPER = new Set([
  "SELECT", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "GROUP", "BY", "ORDER",
  "HAVING", "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "CREATE", "TABLE", "ALTER",
  "DROP", "AND", "OR", "NOT", "NULL", "AS", "ON", "DISTINCT", "LIMIT", "OFFSET", "UNION", "ALL",
  "WITH", "RECURSIVE", "CASE", "WHEN", "THEN", "ELSE", "END", "OVER", "PARTITION", "BETWEEN",
  "IN", "IS", "DESC", "ASC", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "DEFAULT", "UNIQUE",
  "CONFLICT", "RETURNING", "EXCLUDED", "EXISTS", "IF", "ROWS", "PRECEDING", "CURRENT", "ROW",
  "UNBOUNDED", "FOLLOWING"
]);

export function tokenize(code: string): Tok[] {
  const out: Tok[] = [];
  const n = code.length;
  let i = 0;
  const push = (text: string, type: TokType) => {
    if (text) out.push({ text, type });
  };

  while (i < n) {
    const c = code[i];

    // line comments: // # --
    if (
      (c === "/" && code[i + 1] === "/") ||
      c === "#" ||
      (c === "-" && code[i + 1] === "-")
    ) {
      const e = code.indexOf("\n", i);
      const end = e === -1 ? n : e;
      push(code.slice(i, end), "comment");
      i = end;
      continue;
    }
    // block comment
    if (c === "/" && code[i + 1] === "*") {
      const e = code.indexOf("*/", i + 2);
      const end = e === -1 ? n : e + 2;
      push(code.slice(i, end), "comment");
      i = end;
      continue;
    }
    // strings
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n) {
        if (code[j] === "\\") {
          j += 2;
          continue;
        }
        if (code[j] === c) {
          j++;
          break;
        }
        j++;
      }
      push(code.slice(i, j), "string");
      i = j;
      continue;
    }
    // numbers
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(code[i + 1] || ""))) {
      const m = code.slice(i).match(/^(0x[0-9a-fA-F]+|0b[01]+|\d[\d_]*\.?\d*(e[+-]?\d+)?[fFlLuU]*)/);
      if (m) {
        push(m[0], "number");
        i += m[0].length;
        continue;
      }
    }
    // identifiers / keywords / calls / types
    if (/[A-Za-z_$@]/.test(c)) {
      const m = code.slice(i).match(/^[A-Za-z_$@][A-Za-z0-9_$]*/);
      if (m) {
        const word = m[0];
        const after = code.slice(i + word.length).match(/^\s*\(/);
        let type: TokType = "plain";
        if (KEYWORDS.has(word) || SQL_UPPER.has(word)) type = "keyword";
        else if (after) type = "function";
        else if (/^[A-Z]/.test(word)) type = "type";
        push(word, type);
        i += word.length;
        continue;
      }
    }
    // whitespace stays plain (kept verbatim so layout matches)
    if (/\s/.test(c)) {
      let j = i + 1;
      while (j < n && /\s/.test(code[j])) j++;
      push(code.slice(i, j), "plain");
      i = j;
      continue;
    }
    // punctuation / operators
    push(c, "punctuation");
    i++;
  }
  return out;
}

/** Per-character color array aligned to `code` (for the CodeDisplay overlay). */
export function charColors(code: string): string[] {
  const arr: string[] = [];
  for (const t of tokenize(code)) {
    const col = tokColor(t.type);
    for (let k = 0; k < t.text.length; k++) arr.push(col);
  }
  return arr;
}
