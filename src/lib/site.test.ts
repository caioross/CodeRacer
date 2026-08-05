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
        NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "code-racer-three.vercel.app"
      })
    ).toBe("https://coderacer.app");
  });

  it("sem a env, usa o domínio de produção do provedor (estável entre deploys)", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "code-racer-three.vercel.app"
      })
    ).toBe("https://code-racer-three.vercel.app");
  });

  it("aceita a variável de produção sem prefixo público (contexto de servidor)", () => {
    expect(
      resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "code-racer-three.vercel.app" })
    ).toBe("https://code-racer-three.vercel.app");
  });

  it("prefere a variante pública à sem prefixo no mesmo degrau", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "publico.vercel.app",
        VERCEL_PROJECT_PRODUCTION_URL: "servidor.vercel.app"
      })
    ).toBe("https://publico.vercel.app");
  });

  // A URL única do deployment (`VERCEL_URL`) NÃO entra na cadeia: medida no
  // deploy real deste projeto, ela responde 302 para o SSO da Vercel com
  // `X-Robots-Tag: noindex` e muda a cada deploy. Se um dia voltar à cadeia,
  // este teste falha e o revisor é obrigado a justificar.
  it("ignora a URL única do deployment — não é identidade pública", () => {
    // Sem anotação de tipo de propósito: `VERCEL_URL` não faz mais parte de
    // `SiteUrlEnv`, e o teste existe justamente para provar que ela é ignorada.
    const comUrlDoDeploy = { VERCEL: "1", VERCEL_URL: "code-racer-abc123.vercel.app" };
    expect(() => resolveSiteUrl(comUrlDoDeploy)).toThrow(/Origem pública indefinida/);
  });

  it("num build da Vercel sem origem descoberta, LANÇA em vez de publicar localhost", () => {
    expect(() => resolveSiteUrl({ VERCEL: "1" })).toThrow(/Origem pública indefinida/);
    // A mensagem tem de dizer ao dono o que fazer — ela é a única pista no log.
    expect(() => resolveSiteUrl({ VERCEL: "1" })).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("dentro da Vercel, o override do dono continua bastando (não lança)", () => {
    expect(resolveSiteUrl({ VERCEL: "1", NEXT_PUBLIC_SITE_URL: "https://meu.dev" })).toBe(
      "https://meu.dev"
    );
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

  // Preservar o path é o comportamento da função, NÃO uma promessa de que deploy
  // em subcaminho funcione ponta a ponta: o canonical de `layout.tsx:30` e o de
  // `room/[id]/page.tsx:13` são relativos e o Next os resolve contra o
  // `metadataBase`, descartando o `/app`, enquanto sitemap e JSON-LD o mantêm.
  // Suportar subcaminho de verdade exigiria `basePath` no `next.config.mjs`
  // (hoje ausente). Aqui só travamos que a função não corrompe o valor do dono.
  it("preserva o path do valor informado (sem prometer suporte a subcaminho)", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://exemplo.com/app/" })).toBe(
      "https://exemplo.com/app"
    );
  });

  it("acrescenta https:// ao hostname puro que a Vercel injeta", () => {
    expect(
      resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "code-racer.vercel.app" })
    ).toBe("https://code-racer.vercel.app");
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
        VERCEL_PROJECT_PRODUCTION_URL: "code-racer-three.vercel.app"
      })
    ).toBe("https://code-racer-three.vercel.app");
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://" })).toBe("http://localhost:3000");
  });

  it("recusa esquema que não seja http(s) — nada de javascript:/data:/ftp: no canonical", () => {
    for (const hostil of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "ftp://arquivos.exemplo.com",
      "file:///etc/passwd"
    ]) {
      expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: hostil })).toBe("http://localhost:3000");
    }
  });
});

// `SITE.url` é interpolado VERBATIM no `Host:` do robots.txt (`robots.ts:17`), no
// `<loc>` do sitemap (`sitemap.ts:7,13`) e dentro do `<script type="application/ld+json">`
// do JSON-LD (`layout.tsx:115`, `dangerouslySetInnerHTML`) — nenhum dos três escapa
// nada. Se `normalizeOrigin` devolvesse a string crua, um valor de env malformado
// sairia intacto nesses três lugares. Estes casos são a trava.
describe("resolveSiteUrl — a saída é reconstruída do parse, não a string crua", () => {
  it("não deixa `</script>` sobreviver para dentro do JSON-LD", () => {
    const veneno = "https://exemplo.com/</script><script>alert(1)</script>";
    const url = resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: veneno });
    expect(url).not.toContain("<");
    expect(url).not.toContain(">");
    expect(url).toBe("https://exemplo.com/%3C/script%3E%3Cscript%3Ealert(1)%3C/script%3E");
  });

  it("não deixa CR/LF sobreviver para dentro do robots.txt", () => {
    const url = resolveSiteUrl({
      NEXT_PUBLIC_SITE_URL: "https://exemplo.com/x\r\nDisallow: /"
    });
    expect(url).not.toMatch(/[\r\n]/);
  });

  it("descarta credencial embutida — ela vazaria no robots.txt público", () => {
    const url = resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://user:pass@exemplo.com" });
    expect(url).toBe("https://exemplo.com");
    expect(url).not.toContain("pass");
  });

  it("descarta query e fragmento — não fazem parte de uma origem", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://exemplo.com/?a=1" })).toBe(
      "https://exemplo.com"
    );
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://exemplo.com#frag" })).toBe(
      "https://exemplo.com"
    );
  });

  it("normaliza `//host` protocol-relative em vez de gerar `https:////host`", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "//exemplo.com" })).toBe(
      "https://exemplo.com"
    );
  });

  it("neutraliza espaço, TAB e NUL em vez de propagá-los", () => {
    // Montados por código para não depender de caractere de controle literal
    // no fonte: 0x20 espaço, 0x09 TAB, 0x00 NUL.
    for (const codigo of [0x20, 0x09, 0x00]) {
      const sujo = `https://exemplo.com/a${String.fromCharCode(codigo)}b`;
      const url = resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: sujo });
      expect(url).toMatch(/^https?:\/\/\S+$/);
      expect(url).not.toContain(String.fromCharCode(codigo));
    }
  });
});

describe("SITE.url — contrato do consumidor", () => {
  it("é uma origem http(s) absoluta sem barra final", () => {
    expect(SITE.url).toMatch(/^https?:\/\/[^\s]+$/);
    expect(SITE.url.endsWith("/")).toBe(false);
    expect(() => new URL(SITE.url)).not.toThrow();
  });
});
