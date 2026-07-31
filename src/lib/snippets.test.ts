import { describe, it, expect } from "vitest";
import { SNIPPETS, pickSnippet } from "./snippets";
import { LANGUAGES, type Difficulty } from "./languages";

// O pool de snippets é o conteúdo do produto: a revanche ("jogar de novo") sorteia
// dele a cada partida, e o WPM da corrida vai direto ao ranking global. Este suite
// versiona duas coisas que antes só existiam como medição de rodada: os invariantes
// do próprio pool (todos os buckets populados, títulos únicos dentro do bucket) e o
// contrato de exclusão da #115 — sem títulos únicos, excluir por título não é uma
// operação bem-definida.

const DIFFS: Difficulty[] = ["easy", "medium", "hard"];
const LANG_IDS = LANGUAGES.map(l => l.id);
/** Sorteios por caso. Com buckets de 3–5, some sem repetir seria improvável demais. */
const DRAWS = 60;

const bucketOf = (lang: string, diff: Difficulty) => SNIPPETS[lang]?.[diff] ?? [];

describe("SNIPPETS — invariantes do pool", () => {
  it("toda linguagem de LANGUAGES tem os 3 buckets populados", () => {
    const vazios: string[] = [];
    for (const lang of LANG_IDS) {
      for (const diff of DIFFS) {
        if (bucketOf(lang, diff).length === 0) vazios.push(`${lang}/${diff}`);
      }
    }
    expect(vazios).toEqual([]);
  });

  it("títulos são únicos dentro de cada bucket (base da exclusão por título)", () => {
    const duplicados: string[] = [];
    for (const lang of LANG_IDS) {
      for (const diff of DIFFS) {
        const bucket = bucketOf(lang, diff);
        const titulos = new Set(bucket.map(s => s.title));
        if (titulos.size !== bucket.length) duplicados.push(`${lang}/${diff}`);
      }
    }
    expect(duplicados).toEqual([]);
  });

  it("nenhum snippet tem título ou código vazio", () => {
    const ruins: string[] = [];
    for (const lang of LANG_IDS) {
      for (const diff of DIFFS) {
        for (const s of bucketOf(lang, diff)) {
          if (!s.title.trim() || !s.code.trim()) ruins.push(`${lang}/${diff}: ${s.title}`);
        }
      }
    }
    expect(ruins).toEqual([]);
  });
});

describe("pickSnippet — sorteio", () => {
  it("sempre devolve um snippet do bucket pedido, com language/difficulty coerentes", () => {
    for (const lang of LANG_IDS) {
      for (const diff of DIFFS) {
        const titulos = new Set(bucketOf(lang, diff).map(s => s.title));
        const picked = pickSnippet(lang, diff);
        expect(titulos.has(picked.title)).toBe(true);
        expect(picked.language).toBe(lang);
        expect(picked.difficulty).toBe(diff);
        expect(picked.code.length).toBeGreaterThan(0);
      }
    }
  });

  it("cobre o bucket inteiro ao longo de vários sorteios (não fixa num só)", () => {
    for (const lang of LANG_IDS) {
      for (const diff of DIFFS) {
        const esperado = new Set(bucketOf(lang, diff).map(s => s.title));
        const vistos = new Set<string>();
        for (let i = 0; i < DRAWS * 4; i++) vistos.add(pickSnippet(lang, diff).title);
        expect([...esperado].filter(t => !vistos.has(t))).toEqual([]);
      }
    }
  });

  it("dificuldade inválida cai em medium; linguagem desconhecida cai no pool de javascript", () => {
    const md = new Set(bucketOf("javascript", "medium").map(s => s.title));
    expect(pickSnippet("javascript", "impossível").difficulty).toBe("medium");
    expect(md.has(pickSnippet("javascript", "impossível").title)).toBe(true);
    // Comportamento pré-existente, mantido de propósito: reporta a linguagem pedida.
    const desconhecida = pickSnippet("klingon", "easy");
    expect(desconhecida.language).toBe("klingon");
    const jsEasy = new Set(bucketOf("javascript", "easy").map(s => s.title));
    expect(jsEasy.has(desconhecida.title)).toBe(true);
  });

  it("aceita os apelidos de linguagem (ts/js/py/c++/c#)", () => {
    expect(pickSnippet("TS", "easy").language).toBe("typescript");
    expect(pickSnippet("js", "easy").language).toBe("javascript");
    expect(pickSnippet("py", "easy").language).toBe("python");
    expect(pickSnippet("C++", "easy").language).toBe("cpp");
    expect(pickSnippet("c#", "easy").language).toBe("csharp");
  });
});

describe("pickSnippet — exclusão da revanche (#115)", () => {
  it("exaustivo: com bucket ≥2, o título excluído nunca sai (24 langs × 3 dificuldades)", () => {
    const falhas: string[] = [];
    for (const lang of LANG_IDS) {
      for (const diff of DIFFS) {
        const bucket = bucketOf(lang, diff);
        if (bucket.length < 2) continue; // coberto pelo caso de bucket unitário abaixo
        for (const alvo of bucket) {
          for (let i = 0; i < DRAWS; i++) {
            const picked = pickSnippet(lang, diff, alvo.title);
            if (picked.title === alvo.title) falhas.push(`${lang}/${diff} repetiu "${alvo.title}"`);
          }
        }
      }
    }
    expect(falhas).toEqual([]);
  });

  it("duas partidas consecutivas na mesma sala nunca trazem o mesmo título", () => {
    // Espelha o que a action `start` faz: sorteia passando o título da corrida
    // anterior, que sobrevive ao `reset` na linha da sala.
    const falhas: string[] = [];
    for (const lang of LANG_IDS) {
      for (const diff of DIFFS) {
        let anterior: string | undefined;
        for (let partida = 0; partida < DRAWS; partida++) {
          const atual = pickSnippet(lang, diff, anterior).title;
          if (anterior && atual === anterior) falhas.push(`${lang}/${diff}: ${atual}`);
          anterior = atual;
        }
      }
    }
    expect(falhas).toEqual([]);
  });

  it("excludeTitle de outra linguagem é no-op (dá para trocar o idioma no lobby)", () => {
    const alvo = bucketOf("javascript", "easy")[0].title;
    const esperado = new Set(bucketOf("python", "easy").map(s => s.title));
    const vistos = new Set<string>();
    for (let i = 0; i < DRAWS * 4; i++) vistos.add(pickSnippet("python", "easy", alvo).title);
    expect([...esperado].filter(t => !vistos.has(t))).toEqual([]);
  });

  it("excludeTitle vazio/nulo não filtra nada", () => {
    const esperado = new Set(bucketOf("go", "hard").map(s => s.title));
    const vistos = new Set<string>();
    for (let i = 0; i < DRAWS * 4; i++) {
      vistos.add(pickSnippet("go", "hard", i % 2 === 0 ? null : "").title);
    }
    expect([...esperado].filter(t => !vistos.has(t))).toEqual([]);
  });
});

describe("pickSnippet — degradação (buckets que o pool real não tem)", () => {
  // Nenhum bucket real é unitário, vazio ou tem título repetido — os invariantes
  // acima garantem isso. Estes casos injetam buckets temporários no pool para provar
  // o comportamento sob eles: são exatamente as formas em que o sorteio quebrava
  // (TypeError em `choice.title`) ou passaria a quebrar se o filtro esvaziasse o pool.
  const comPoolFake = (nome: string, bucket: (typeof SNIPPETS)[string], fn: () => void) => {
    SNIPPETS[nome] = bucket;
    try {
      fn();
    } finally {
      delete SNIPPETS[nome];
    }
  };

  it("bucket de 1 snippet: devolve esse snippet mesmo excluindo o título dele", () => {
    comPoolFake("fakeunico", { medium: [{ title: "Único", code: "x" }] }, () => {
      const picked = pickSnippet("fakeunico", "medium", "Único");
      expect(picked.title).toBe("Único");
      expect(picked.language).toBe("fakeunico");
    });
  });

  it("bucket com títulos repetidos: excluir não esvazia o sorteio", () => {
    const seeds = [
      { title: "Igual", code: "a" },
      { title: "Igual", code: "b" }
    ];
    comPoolFake("fakedup", { hard: seeds }, () => {
      const picked = pickSnippet("fakedup", "hard", "Igual");
      expect(picked.title).toBe("Igual");
    });
  });

  it("bucket presente mas vazio cai para medium/easy da mesma linguagem, sem estourar", () => {
    comPoolFake("fakevazio", { hard: [], medium: [], easy: [{ title: "Resto", code: "z" }] }, () => {
      expect(pickSnippet("fakevazio", "hard").title).toBe("Resto");
    });
  });

  it("linguagem inteira sem snippets cai para o pool de javascript", () => {
    comPoolFake("fakeoco", { easy: [], medium: [], hard: [] }, () => {
      const jsEasy = new Set(bucketOf("javascript", "easy").map(s => s.title));
      const picked = pickSnippet("fakeoco", "easy");
      expect(jsEasy.has(picked.title)).toBe(true);
    });
  });
});
