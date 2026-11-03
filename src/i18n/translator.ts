// Fábrica do tradutor — a mesma para Server Components (`getServerI18n`) e para o cliente
// (`useI18n`). Tudo aqui é barato e sem estado: `t()` é uma busca em objeto + replace.
import type { ReactNode } from "react";
import { LOCALE_META, type Locale } from "./config";
import {
  formatNumber,
  interpolate,
  lookup,
  translate,
  translatePlural,
  type MessageTree,
  type PluralForms,
  type PluralPaths,
  type StringPaths,
  type Vars
} from "./core";
import type { SourceMessages } from "./messages/pt-BR";
import type { Messages } from "./types";
import { renderRich, type RichRenderers } from "./rich";

export type MessageKey = StringPaths<SourceMessages>;
export type PluralKey = PluralPaths<SourceMessages>;
type ErrorKey = keyof SourceMessages["errors"];

// As rotas de API respondem em português (é a língua do servidor e dos logs). O cliente
// troca a frase conhecida pela chave traduzida; frase desconhecida passa como veio.
const API_ERRORS: Record<string, ErrorKey | "noConnection" | "createError"> = {
  "Sala não encontrada": "roomNotFound",
  "Não foi possível carregar a sala": "roomLoad",
  "Erro na sala": "roomGeneric",
  "Conexão em tempo real falhou": "realtimeFailed",
  "Você foi removido da sala pelo líder": "kickedYou",
  "Supabase não configurado": "notConfigured",
  "Só o líder pode fazer isso": "leaderOnly",
  "Partida já começou": "alreadyStarted",
  "A partida já começou": "alreadyStarted",
  "A partida ainda não terminou": "notFinished",
  "language inválido — use uma das linguagens suportadas": "invalidLanguage",
  "difficulty inválido — use easy, medium ou hard": "invalidDifficulty",
  "Linguagem inválida": "invalidLanguage",
  "Dificuldade inválida": "invalidDifficulty",
  "Não foi possível gerar a sala": "roomCreate",
  "Não foi possível atualizar a sala": "roomUpdate",
  "Não foi possível confirmar a alteração": "roomConfirm",
  "Não foi possível encerrar a partida": "finishFailed",
  "Alvo inválido": "invalidTarget",
  "Limite de expulsões desta sala atingido": "kickLimit",
  "Expulsão indisponível — migração pendente": "kickUnavailable",
  "Ação inválida": "invalidAction",
  "playerId obrigatório": "missingPlayer",
  playerId: "missingPlayer",
  "Sem conexão com o servidor": "noConnection",
  "Erro ao criar sala": "createError"
};

const ordinalRules = new Map<string, Intl.PluralRules>();
function ordinalCategory(locale: Locale, n: number): Intl.LDMLPluralRule {
  let r = ordinalRules.get(locale);
  if (!r) {
    try {
      r = new Intl.PluralRules(locale, { type: "ordinal" });
    } catch {
      r = new Intl.PluralRules("en", { type: "ordinal" });
    }
    ordinalRules.set(locale, r);
  }
  return r.select(n);
}

const relFormats = new Map<string, Intl.RelativeTimeFormat>();
function relFormat(locale: Locale): Intl.RelativeTimeFormat {
  let f = relFormats.get(locale);
  if (!f) {
    try {
      f = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
    } catch {
      f = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });
    }
    relFormats.set(locale, f);
  }
  return f;
}

export function createTranslator(locale: Locale, messages: Messages) {
  const tree = messages as unknown as MessageTree;

  const t = (key: MessageKey, vars?: Vars): string => translate(tree, locale, key, vars);
  const tp = (key: PluralKey, count: number, vars?: Vars): string =>
    translatePlural(tree, locale, key, count, vars);

  /** "1º", "1st", "1位", "第1名"… */
  const ord = (n: number): string => {
    const forms = lookup(tree, "common.ordinal") as PluralForms | undefined;
    if (!forms) return String(n);
    const form = forms[ordinalCategory(locale, n)] ?? forms.other;
    return form.replace(/#/g, formatNumber(locale, n));
  };

  /** "agora", "há 5 min", "5 min ago"… a partir de um ISO. */
  const ago = (iso: string, now = Date.now()): string => {
    const s = Math.round((new Date(iso).getTime() - now) / 1000);
    const abs = Math.abs(s);
    const f = relFormat(locale);
    if (abs < 60) return f.format(0, "second");
    if (abs < 3600) return f.format(Math.round(s / 60), "minute");
    if (abs < 86400) return f.format(Math.round(s / 3600), "hour");
    return f.format(Math.round(s / 86400), "day");
  };

  const rich = (key: MessageKey, renderers: RichRenderers, vars?: Vars): ReactNode =>
    renderRich(t(key, vars), renderers);

  const difficulty = (id: string): string => {
    const v = lookup(tree, `difficulty.${id}.label`);
    return typeof v === "string" ? v : id;
  };

  const apiError = (msg: string | null | undefined, fallback: MessageKey = "errors.roomGeneric"): string => {
    if (!msg) return t(fallback);
    const k = API_ERRORS[msg];
    if (!k) return msg;
    if (k === "noConnection") return t("common.noConnection");
    if (k === "createError") return t("home.createError");
    return t(`errors.${k}` as MessageKey);
  };

  return {
    locale,
    dir: LOCALE_META[locale].dir,
    messages,
    t,
    tp,
    ord,
    ago,
    rich,
    difficulty,
    apiError,
    num: (n: number, opts?: Intl.NumberFormatOptions) => formatNumber(locale, n, opts),
    fill: (template: string, vars?: Vars) => interpolate(template, locale, vars)
  };
}

export type Translator = ReturnType<typeof createTranslator>;
