# Créditos

## Código e conteúdo
- Jogo, código e snippets: Caio Rossi ([@caioross](https://github.com/caioross)) e a frota de agentes do
  projeto (ver `AGENTS.md` e o Diário de Bordo, issue #4). Licença do projeto: MIT (`LICENSE`).

## Fonte
- **JetBrains Mono** — JetBrains, SIL Open Font License 1.1, servida pelo `next/font` (Google Fonts).
- Texto de interface em japonês, chinês, coreano, cirílico, devanágari e árabe usa as fontes do
  sistema do jogador (nenhuma fonte extra é baixada).

## Ícones
- **Lucide** (`lucide-react`) — ISC License.
- Ícone do app (`>_`), favicon, `apple-icon.png` e `public/icons/*.png`: desenho próprio do projeto;
  os PNG foram renderizados a partir de `public/icon.svg` e `public/favicon.svg` (Chromium headless).

## Som
- Todos os sons são **sintetizados em tempo real** pelo Web Audio API (`src/lib/sound.ts`) — não há
  arquivo de áudio nem amostra de terceiros.

## Imagens
- Estandartes das linguagens (`public/banners/*.webp`) e card social (`src/app/opengraph-image.tsx`):
  arte do projeto. Os logotipos de linguagens referenciados são marcas dos respectivos donos.

## Bibliotecas
- Next.js, React, Tailwind CSS, Framer Motion, three.js, ammo.js (`ammojs-typed`), supabase-js,
  nanoid, clsx, tailwind-merge — licenças no `node_modules` de cada pacote (MIT/Apache-2.0/zlib).

## Tradução e ferramentas de IA
- As traduções da interface (11 idiomas além do português) foram escritas por um assistente de IA
  (Claude, Anthropic) em nov/2026 a partir do texto original em português, com revisão automática de
  chaves, placeholders e plurais (`src/i18n/messages.test.ts`). Correções de falantes nativos são
  bem-vindas via issue/PR.
- Código das melhorias de nov/2026 escrito com o Claude Code (os commits trazem `Co-Authored-By`).
  Nenhuma arte, som ou texto do jogo foi gerado por modelo de imagem/áudio.
