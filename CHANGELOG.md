# Changelog

Formato livre por data; o histórico anterior a nov/2026 está nos commits (`git log`)
e no Diário de Bordo da frota (issue #4).

## [0.2.0] — 2026-11-03 · programa "elevar os jogos" (pedido 253)

Branch `melhorias-2026-11`.

### Novo
- **Interface em 12 idiomas**: português (Brasil), English, español, français, Deutsch,
  italiano, 日本語, 简体中文, 한국어, русский, हिन्दी e العربية (direita para a esquerda, com
  o código sempre da esquerda para a direita). Detecção pelo navegador, `?lang=xx` em
  qualquer link, cookie de preferência e seletor no cabeçalho. Plural, ordinal, número e
  tempo relativo pelo `Intl` de cada idioma; metadados, manifest e JSON-LD por idioma;
  `hreflang` no `<head>` e no sitemap.
- **Áudio**: bipes da contagem, largada, som de erro (existia e nunca tocava), arpejo de
  chegada, fanfarra do pódio e "plim" nos marcos de sequência — tudo sintetizado, sem
  arquivo, respeitando o mudo.
- **Juice**: contador de sequência de acertos com pulso nos marcos (25/50/100/…),
  confete no 1º lugar e no recorde pessoal.
- **Recorde pessoal no Treino Livre** por linguagem + nível (no navegador).
- **"Como jogar"** em 3 passos na primeira visita.
- **PWA**: ícones PNG 192/512 e `maskable`.

### Corrigido
- Domínio padrão do site (`coderacer.app`) era de terceiro — canonical, `og:image` e
  sitemap apontavam para ele. Agora `coderacer.caiorossi.com` (#117).
- Link de convite de sala sem prévia: o `robots.txt` bloqueava `/room/` (#118).
- `/practice` fora do sitemap e sem metadados próprios (#84).
- Barra de progresso animava `width` ao lado da textarea (#114).
- Relógio da contagem seguia a 10 Hz a corrida inteira (#111).
- `prefers-reduced-motion` não alcançava as animações do framer-motion (#108).
- Modal sem `role="dialog"`, sem foco preso (#128); avisos mudos para leitor de tela (#129);
  tabelas sem `scope` e sem `tabular-nums` (#93).
- Ranking travava ~7,6 s quando o banco não respondia — agora desiste em 2,5 s e avisa.
- `next build` falhava no Windows (`EBUSY` ao copiar edge-chunks para o standalone).
- `pnpm lint` não rodava (sem configuração do ESLint).

### Segurança
- `next` 14.2.18 → 14.2.35 (bypass de middleware e DoS de Server Components da linha 14).
- Otimizador de imagem desligado (`images.unoptimized`): o app não usa `next/image` e o
  endpoint era a superfície dos RCE críticos que só a linha 15.5 corrige.
