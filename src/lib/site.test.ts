import { describe, it, expect } from "vitest";
import { resolveSiteUrl, SITE } from "./site";

// `SITE.url` é a identidade pública do site: vira o `<link rel="canonical">`, o
// `Host:`/`Sitemap:` do robots.txt, o `<loc>` do sitemap, o `og:image` de todo
// link compartilhado e o `url` do JSON-LD. Um valor errado aqui não quebra o
// build — só apaga o preview de todo convite e entrega a indexação para outra
// origem (#117). Por isso a precedência e a normalização são versionadas.

describe("resolveSiteUrl — precedência", () => {
  it("NEXT_PUBLIC_SITE_URL vence tudo (override explícito do dono)", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: "https://coderacer.app",
        NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "code-racer-three.vercel.app",
        VERCEL_URL: "code-racer-abc123.vercel.app"
      })
    ).toBe("https://coderacer.app");
  });

  it("sem a env, usa o domínio de produção do provedor (estável entre deploys)", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "code-racer-three.vercel.app",
        VERCEL_URL: "code-racer-abc123.vercel.app"
      })
    ).toBe("https://code-racer-three.vercel.app");
  });

  it("aceita a variável de produção sem prefixo público (contexto de servidor)", () => {
    expect(
      resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "code-racer-three.vercel.app" })
    ).toBe("https://code-racer-three.vercel.app");
  });

  it("cai no domínio do deploy corrente quando não há domínio de produção", () => {
    expect(resolveSiteUrl({ VERCEL_URL: "code-racer-abc123.vercel.app" })).toBe(
      "https://code-racer-abc123.vercel.app"
    );
  });

  it("prefere a variante pública à sem prefixo no mesmo degrau", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_VERCEL_URL: "publico.vercel.app",
        VERCEL_URL: "servidor.vercel.app"
      })
    ).toBe("https://publico.vercel.app");
  });

  it("sem nada disponível, cai no fallback de dev — nunca num domínio de terceiro", () => {
    expect(resolveSiteUrl({})).toBe("http://localhost:3000");
  });
});

describe("resolveSiteUrl — normalização", () => {
  it("remove a barra final (contrato: origem absoluta sem trailing slash)", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://exemplo.com/" })).toBe(
      "https://exemplo.com"
    );
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://exemplo.com///" })).toBe(
      "https://exemplo.com"
    );
  });

  it("preserva o path quando o deploy vive num subcaminho", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://exemplo.com/app/" })).toBe(
      "https://exemplo.com/app"
    );
  });

  it("acrescenta https:// ao hostname puro que a Vercel injeta", () => {
    expect(resolveSiteUrl({ VERCEL_URL: "code-racer.vercel.app" })).toBe(
      "https://code-racer.vercel.app"
    );
  });

  it("preserva http:// explícito (dev local em outra porta)", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "http://localhost:4000" })).toBe(
      "http://localhost:4000"
    );
  });

  it("ignora valor vazio, em branco ou inválido e segue a cadeia", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: "   ",
        NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "",
        VERCEL_URL: "code-racer-three.vercel.app"
      })
    ).toBe("https://code-racer-three.vercel.app");
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://" })).toBe("http://localhost:3000");
  });

  it("recusa protocolo não-http (nada de javascript: virando canonical)", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "javascript:alert(1)" })).toBe(
      "http://localhost:3000"
    );
  });
});

describe("SITE.url — contrato do consumidor", () => {
  it("é uma origem http(s) absoluta sem barra final", () => {
    expect(SITE.url).toMatch(/^https?:\/\/[^\s]+$/);
    expect(SITE.url.endsWith("/")).toBe(false);
    expect(() => new URL(SITE.url)).not.toThrow();
  });
});
