// Núcleo puro do i18n (sem React, sem Next) — testado em `core.test.ts`.
//
// Formato das mensagens: árvore de objetos cujas folhas são strings com placeholders `{nome}`.
// Um nó de PLURAL é um objeto só com categorias do `Intl.PluralRules` (`zero`, `one`, `two`,
// `few`, `many`, `other`) — `other` é obrigatório. `#` dentro de um plural vira o número formatado.
import type { Locale } from "./config";

export type PluralForms = {
  other: string;
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
};

export type MessageTree = { [k: string]: string | PluralForms | MessageTree };

/** Caminhos "a.b.c" cujas folhas são strings simples. */
export type StringPaths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends PluralForms
      ? never
      : StringPaths<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Caminhos "a.b.c" que apontam para um nó de plural. */
export type PluralPaths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? never
    : T[K] extends PluralForms
      ? `${P}${K}`
      : PluralPaths<T[K], `${P}${K}.`>;
}[keyof T & string];

export type Vars = Record<string, string | number>;

const PLURAL_KEYS = new Set(["zero", "one", "two", "few", "many", "other"]);

export function isPluralNode(v: unknown): v is PluralForms {
  if (!v || typeof v !== "object") return false;
  const keys = Object.keys(v);
  return keys.length > 0 && keys.includes("other") && keys.every(k => PLURAL_KEYS.has(k));
}

export function lookup(tree: MessageTree, key: string): unknown {
  let node: unknown = tree;
  for (const part of key.split(".")) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

const numberFormats = new Map<string, Intl.NumberFormat>();
export function formatNumber(locale: Locale, n: number, opts?: Intl.NumberFormatOptions): string {
  const k = locale + JSON.stringify(opts ?? {});
  let f = numberFormats.get(k);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, opts);
    } catch {
      f = new Intl.NumberFormat("en", opts);
    }
    numberFormats.set(k, f);
  }
  return f.format(n);
}

/** Troca `{nome}` pelos valores; números passam pelo `Intl.NumberFormat` do idioma. */
export function interpolate(template: string, locale: Locale, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const v = vars[name];
    if (v === undefined) return whole;
    return typeof v === "number" ? formatNumber(locale, v) : v;
  });
}

const pluralRules = new Map<string, Intl.PluralRules>();
export function pluralCategory(locale: Locale, n: number): Intl.LDMLPluralRule {
  let r = pluralRules.get(locale);
  if (!r) {
    try {
      r = new Intl.PluralRules(locale);
    } catch {
      r = new Intl.PluralRules("en");
    }
    pluralRules.set(locale, r);
  }
  return r.select(n);
}

export function translate(tree: MessageTree, locale: Locale, key: string, vars?: Vars): string {
  const v = lookup(tree, key);
  if (typeof v === "string") return interpolate(v, locale, vars);
  if (isPluralNode(v)) return interpolate(v.other, locale, vars);
  return key;
}

export function translatePlural(
  tree: MessageTree,
  locale: Locale,
  key: string,
  count: number,
  vars?: Vars
): string {
  const v = lookup(tree, key);
  if (!isPluralNode(v)) return typeof v === "string" ? interpolate(v, locale, { count, ...vars }) : key;
  // Regra do ICU: `zero` explícito vale para o número 0 mesmo em idiomas cuja regra não tem "zero".
  const cat = count === 0 && v.zero ? "zero" : pluralCategory(locale, count);
  const form = v[cat] ?? v.other;
  return interpolate(form.replace(/#/g, formatNumber(locale, count)), locale, { count, ...vars });
}

/** Lista as chaves-folha (strings e plurais) — usado pelos testes de cobertura entre idiomas. */
export function leafKeys(tree: MessageTree, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string" || isPluralNode(v)) out.push(path);
    else out.push(...leafKeys(v as MessageTree, path));
  }
  return out;
}

/** Placeholders `{x}` de uma folha (para conferir que a tradução não perdeu nenhum). */
export function placeholders(v: string | PluralForms): string[] {
  const text = typeof v === "string" ? v : Object.values(v).join(" ");
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]))].sort();
}
