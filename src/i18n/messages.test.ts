import { describe, expect, it } from "vitest";
import { LOCALES, matchLocale, negotiateLocale, resolveLocale } from "./config";
import { isPluralNode, leafKeys, lookup, placeholders, translate, translatePlural, type MessageTree } from "./core";
import { createTranslator } from "./translator";
import { loadMessages } from "./messages";
import ptBR from "./messages/pt-BR";
import en from "./messages/en";
import { buildShareText } from "../lib/share";

const source = ptBR as unknown as MessageTree;
const sourceKeys = leafKeys(source).sort();
const TAG = /<(\w+)>/g;
const tags = (v: unknown) =>
  [...new Set([...String(typeof v === "string" ? v : Object.values(v as object).join(" ")).matchAll(TAG)].map(m => m[1]))].sort();

describe("dicionários — os 12 idiomas têm o mesmo formato do pt-BR", () => {
  for (const locale of LOCALES) {
    it(`${locale}: mesmas chaves, placeholders e tags; nada vazio`, async () => {
      const tree = (await loadMessages(locale)) as unknown as MessageTree;
      expect(leafKeys(tree).sort()).toEqual(sourceKeys);
      for (const key of sourceKeys) {
        const src = lookup(source, key) as string;
        const dst = lookup(tree, key) as string;
        expect(placeholders(dst as never), `${locale} ${key}`).toEqual(placeholders(src as never));
        expect(tags(dst), `${locale} ${key} (tags)`).toEqual(tags(src));
        if (isPluralNode(dst)) {
          expect(dst.other, `${locale} ${key}.other`).toBeTruthy();
        } else {
          expect(String(dst).trim().length, `${locale} ${key} vazio`).toBeGreaterThan(0);
        }
      }
    });
  }

  it("os 11 idiomas traduzidos não são cópia do pt-BR (no máximo 25% de folhas iguais)", async () => {
    for (const locale of LOCALES.filter(l => l !== "pt-BR")) {
      const tree = (await loadMessages(locale)) as unknown as MessageTree;
      const same = sourceKeys.filter(k => JSON.stringify(lookup(tree, k)) === JSON.stringify(lookup(source, k)));
      expect(same.length / sourceKeys.length, `${locale}: ${same.slice(0, 8).join(", ")}`).toBeLessThan(0.25);
    }
  });
});

describe("núcleo de tradução", () => {
  it("interpola e formata número pelo idioma", () => {
    expect(translate(source, "pt-BR", "lobby.players", { n: 3, max: 30 })).toBe("3/30 jogadores");
    expect(translate(en as unknown as MessageTree, "en", "home.featPlayersTitle", { n: 1000 })).toBe("up to 1,000 players");
  });

  it("chave que não existe devolve a própria chave (nunca quebra a tela)", () => {
    expect(translate(source, "pt-BR", "nao.existe")).toBe("nao.existe");
  });

  it("plural escolhe a categoria certa por idioma", async () => {
    expect(translatePlural(source, "pt-BR", "practice.errorsCount", 1)).toBe("1 erro");
    expect(translatePlural(source, "pt-BR", "practice.errorsCount", 4)).toBe("4 erros");
    const ru = (await loadMessages("ru")) as unknown as MessageTree;
    expect(translatePlural(ru, "ru", "practice.errorsCount", 1)).toBe("1 ошибка");
    expect(translatePlural(ru, "ru", "practice.errorsCount", 3)).toBe("3 ошибки");
    expect(translatePlural(ru, "ru", "practice.errorsCount", 5)).toBe("5 ошибок");
    const ar = (await loadMessages("ar")) as unknown as MessageTree;
    expect(translatePlural(ar, "ar", "practice.errorsCount", 0)).toBe("بلا أخطاء");
    expect(translatePlural(ar, "ar", "practice.errorsCount", 2)).toBe("خطآن");
  });

  it("ordinal: 1º, 2nd, 3rd, 1er, 1位, 第1名", async () => {
    expect(createTranslator("pt-BR", ptBR).ord(1)).toBe("1º");
    const tEn = createTranslator("en", en);
    expect([1, 2, 3, 4, 11, 22].map(tEn.ord)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "22nd"]);
    expect(createTranslator("fr", await loadMessages("fr")).ord(1)).toBe("1er");
    expect(createTranslator("ja", await loadMessages("ja")).ord(1)).toBe("1位");
    expect(createTranslator("zh-Hans", await loadMessages("zh-Hans")).ord(1)).toBe("第1名");
  });

  it("erro da API em pt vira texto do idioma; desconhecido passa como veio", () => {
    const tEn = createTranslator("en", en);
    expect(tEn.apiError("Sala não encontrada")).toBe("Room not found");
    expect(tEn.apiError("Partida já começou")).toBe("The race has already started");
    expect(tEn.apiError(undefined, "home.createError")).toBe("Couldn't create the room");
    expect(tEn.apiError("TypeError: fetch failed")).toBe("TypeError: fetch failed");
  });

  it("tempo relativo usa o Intl do idioma", () => {
    const now = Date.parse("2026-11-03T12:00:00Z");
    const tEn = createTranslator("en", en);
    expect(tEn.ago("2026-11-03T11:55:00Z", now)).toMatch(/5 min/);
    expect(tEn.ago("2026-11-03T11:59:58Z", now)).toBe("now");
  });

  it("texto de compartilhar sai no idioma, sem vazar a sala", () => {
    const tEn = createTranslator("en", en);
    const player = { id: "x", name: "ABC123", color: "#fff", progress: 1, wpm: 84.6, accuracy: 97.4, errors: 1, finishedAt: 1, place: 2, ready: true, abandoned: false };
    const txt = buildShareText(player, "https://coderacer.caiorossi.com", {
      withPlace: tEn.t("results.shareWithPlace"),
      noPlace: tEn.t("results.shareNoPlace"),
      ord: tEn.ord
    });
    expect(txt).toBe("I hit 85 WPM (97%) and finished 2nd on CodeRacer 🏁 catch me: https://coderacer.caiorossi.com");
    expect(txt).not.toContain("ABC123");
  });
});

describe("escolha do idioma", () => {
  it("casa etiquetas BCP 47 com os idiomas suportados", () => {
    expect(matchLocale("pt")).toBe("pt-BR");
    expect(matchLocale("pt-PT")).toBe("pt-BR");
    expect(matchLocale("zh-CN")).toBe("zh-Hans");
    expect(matchLocale("zh-Hant-TW")).toBe("zh-Hans");
    expect(matchLocale("es-MX")).toBe("es");
    expect(matchLocale("EN_us")).toBe("en");
    expect(matchLocale("tlh")).toBeNull();
    expect(matchLocale("")).toBeNull();
  });

  it("Accept-Language respeita os pesos q", () => {
    expect(negotiateLocale("fr-CA,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(negotiateLocale("tlh,de;q=0.5,ja;q=0.7")).toBe("ja");
    expect(negotiateLocale("*")).toBeNull();
    expect(negotiateLocale(null)).toBeNull();
  });

  it("ordem: ?lang (cabeçalho) > cookie > navegador > inglês", () => {
    expect(resolveLocale({ header: "ko", cookie: "de", acceptLanguage: "ja" })).toBe("ko");
    expect(resolveLocale({ cookie: "de", acceptLanguage: "ja" })).toBe("de");
    expect(resolveLocale({ cookie: "xx", acceptLanguage: "ja" })).toBe("ja");
    expect(resolveLocale({})).toBe("en");
  });
});
