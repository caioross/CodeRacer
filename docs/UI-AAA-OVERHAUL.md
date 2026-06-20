<div align="center">

# 🏁 CodeRacer — Especificação de Design, Experiência & Engenharia AAA

**Documento mestre de elevação de qualidade · v2.0 · jun/2026**

*Da boa execução à excelência julgável por programadores.*

</div>

---

## 📖 Como ler este documento

Este não é um brainstorm — é uma **especificação de produção**. Cada animação tem gatilho, duração, curva e fallback. Cada decisão de UX tem um porquê ancorado no público (programadores) e em métricas (performance, acessibilidade). Cada item de engenharia aponta para arquivo e linha reais.

| Parte | Conteúdo | Para quem |
|-------|----------|-----------|
| **0** | Filosofia, princípios de design, personas, o que será julgado | Todos — leia primeiro |
| **I** | Design system: tokens de cor, tipografia, espaçamento, **sistema de movimento**, **sistema de som**, layout, acessibilidade, **orçamentos de performance** | Design + Front-end |
| **II** | React Bits: catálogo, custo técnico, estratégia de integração e re-tematização | Front-end |
| **III** | **Spec tela a tela** — cada elemento, cada estado, cada animação, responsivo, a11y, som | Front-end + Design |
| **IV** | **O coração — game feel da corrida** em profundidade (syntax, caret, combo, nitro, pista) | Front-end + Game design |
| **V** | Features & progressão (XP, ranks, achievements, perfil, practice, daily, social) | Produto + Eng |
| **VI** | Engenharia & qualidade (conteúdo, anti-cheat, testes, CI/CD, observabilidade, docs) | Eng |
| **VII** | Roadmap faseado, sequência unificada, métricas de sucesso | Liderança |
| **Apêndices** | Tabelas de referência: animações, sons, tokens, atalhos de teclado, inventário | Consulta rápida |

> **Convenção de notação.** Durações em ms. Curvas como `cubic-bezier(...)` ou nome de token (§I.3). Springs como `{ stiffness, damping }` (framer-motion). `arquivo.tsx:linha` é clicável. 🔴 = prioridade crítica · 🟠 = alta · 🟡 = média · 🟢 = baixo risco/alto ROI.

---

# PARTE 0 — Filosofia & Princípios

## 0.1 A tese central

CodeRacer **já funciona bem**. O salto para AAA não está em features novas soltas, mas em **densidade de qualidade percebida**: o intervalo entre apertar uma tecla e sentir o jogo responder, a coerência do movimento, o peso do som, a clareza sob pressão. Programadores não perdoam latência nem firula vazia — mas reconhecem e respeitam **polimento com propósito**.

Três pilares sustentam tudo:

1. **IDENTIDADE** — a primeira impressão precisa comunicar "isto é um jogo de verdade, feito por quem entende", em menos de 3 segundos. Hoje parece um bom projeto; precisa parecer um *produto*.
2. **FEEL (game juice)** — a camada que transforma "digitar" em "dirigir em alta velocidade". É a maior alavanca e está quase ausente hoje. Som, syntax highlighting, caret vivo, combo, partículas, nitro.
3. **MOMENTOS** — os picos emocionais (largada, ultrapassagem, vitória) precisam de coreografia cinematográfica, não de cortes secos.

## 0.2 Os sete princípios de design (a régua de toda decisão)

Toda proposta neste documento passa por estes filtros. Se um efeito viola um princípio, ele não entra.

1. **Performance é uma feature, não um luxo.** 60fps na corrida é inegociável. Latência tecla→pixel < 1 frame. Programadores *medem* isso. Um efeito lindo a 45fps é um bug.
2. **Movimento com significado.** Toda animação responde a uma pergunta do usuário: "o que mudou? para onde olho? o que aconteceu?". Animação decorativa que não informa é ruído — corta.
3. **Teclado em primeiro lugar.** O público vive no teclado. Tudo navegável e acionável sem mouse. Atalhos visíveis. O mouse é opcional, nunca obrigatório.
4. **Legibilidade acima de espetáculo.** O snippet de código é sagrado. Nenhum efeito pode reduzir contraste, clareza ou foco durante a digitação. Glow a serviço da leitura, nunca contra.
5. **Autenticidade técnica.** Código real, syntax highlighting real, WPM calculado pelo padrão da indústria, sem números falsos. Se um dev abrir o DevTools, deve encontrar craftsmanship, não teatro.
6. **Respeito ao usuário.** `prefers-reduced-motion`, mute fácil, sem autoplay invasivo, sem dark patterns, sem cadastro forçado, sem cobrar atenção que o jogo não merece naquele instante.
7. **Coerência sistêmica.** Um token, um easing, um espaçamento — reutilizados em todo lugar. Inconsistência é a assinatura do amadorismo. Nada de springs aleatórios por arquivo.

## 0.3 Personas & o que cada uma julga

| Persona | Perfil | O que repara primeiro | O que o conquista |
|---------|--------|----------------------|-------------------|
| **O Cético Sênior** | 10+ anos, já viu de tudo, abre o Network tab | Bundle size, latência de input, se o WPM bate com a realidade, FOUC/CLS | Performance impecável, código aberto limpo, syntax highlight correto por linguagem |
| **O Competitivo** | Quer ser o nº1 no leaderboard, joga de novo e de novo | Variedade de snippets, justiça (anti-cheat), precisão das métricas, responsividade do input | Ranqueado confiável, ghost/PB, progressão (rank/XP), repetição sem repetir conteúdo |
| **O Social/Casual** | Joga com amigos no Discord, quer rir | Facilidade de criar/convidar, chat, reações, o "uau" visual | Onboarding zero-fricção, momentos compartilháveis (share card), emotes, pódio divertido |
| **O Iniciante** | Aprendendo a programar, treina digitação | Clareza do que fazer, feedback de erro compreensível, modo treino | Practice/solo, dificuldade fácil generosa, feedback de erro gentil, sensação de progresso |
| **O Mobile** | Caiu pelo link no celular | Se carrega rápido, se dá pra jogar com teclado virtual | Layout mobile real, peso leve, toque responsivo |

> **Decisão de produto:** otimizamos para **O Cético Sênior** e **O Competitivo** sem alienar os demais. Se conquistarmos os dois mais exigentes, os outros vêm junto. Performance e autenticidade não são negociáveis; espetáculo e social são camadas opcionais por cima.

## 0.4 A regra de ouro (inegociável)

> **A área de digitação ativa é território sagrado.** Durante a corrida: zero WebGL pesado atrás do editor, zero animação que dispute CPU/GPU com o input, zero layout shift. Efeitos pesados (backgrounds shader, partículas densas, Hyperspeed) vivem em menus, lobby, countdown e resultados — **nunca** competindo com a `textarea`. Latência de input ganha de tudo.

---

# PARTE I — Design System (a fundação)

> Tudo que se segue deriva daqui. Estes tokens viram CSS variables + um `lib/tokens.ts` / `lib/motion.ts` (§VI). Hoje os valores estão espalhados e divergentes (springs `120/22`, `100/20`, `160/14` em arquivos diferentes) — unificar é o passo zero da consistência.

## I.1 Cor

### I.1.1 Paleta base (preservar — já é forte)

| Token | Hex | Papel semântico | Uso |
|-------|-----|-----------------|-----|
| `--bg-void` | `#05060a` | Fundo absoluto | `body`, base de tudo |
| `--bg-soft` | `#0a0c14` | Superfície recuada | inputs, áreas internas |
| `--bg-card` | `#0f1220` | Superfície elevada | cards, painéis |
| `--bg-line` | `#1a1f33` | Bordas, divisórias | `border`, separadores |
| `--neon-green` | `#00ff88` | **Primária** — ação, sucesso, foco | botões primários, CTA, caret, progresso |
| `--neon-cyan` | `#00e5ff` | **Secundária** — info, secundário | links, secundário, dificuldade |
| `--neon-violet` | `#a855f7` | **Acento** — especial, raro | destaques, conquistas, keywords no código |
| `--neon-amber` | `#fbbf24` | **Ouro** — aviso, glória | pódio, líder, ranking, warnings |
| `--neon-red` | `#ff3860` | **Perigo** — erro | erros de digitação, desistir, destrutivo |
| `--text` | `#e6edf3` | Texto primário | corpo, títulos |
| `--text-muted` | `#7d8590` | Texto secundário | labels, metadados |
| `--text-dim` | `#484f58` | Texto terciário | hints, decorativo |

### I.1.2 Contraste & acessibilidade (WCAG — programadores reparam)

| Combinação | Ratio | Veredito |
|------------|------:|----------|
| `--text` sobre `--bg-void` | ~15.8:1 | ✅ AAA (excelente) |
| `--text-muted` sobre `--bg-void` | ~5.9:1 | ✅ AA para texto normal |
| `--text-dim` sobre `--bg-void` | ~2.9:1 | ⚠️ **só** decorativo/texto grande — nunca conteúdo essencial |
| `--neon-green` sobre `--bg-void` | ~12:1 | ✅ AAA |
| `--neon-green` como **fundo** de botão + texto `--bg-void` | alto | ✅ (texto escuro sobre neon claro) |

**Regras:** (1) `--text-dim` proibido para informação acionável. (2) Texto sobre neon usa sempre `--bg-void` (escuro sobre claro), nunca branco. (3) Estados de foco têm contraste ≥ 3:1 contra o entorno. (4) Cor nunca é o único portador de informação (erro tem cor + ícone + posição + som).

### I.1.3 Paleta de jogadores (8 cores determinísticas — `room.ts:87`)

`#00ff88 #00e5ff #a855f7 #fbbf24 #ff3860 #f472b6 #34d399 #60a5fa` — atribuídas por hash do id (`colorForId`). **Garantir** que todas tenham contraste ≥ 4.5:1 sobre `--bg-card` (validar `#60a5fa` e `#f472b6`; se falharem, clarear a variante de texto e reservar o tom puro só para glows/markers).

### I.1.4 Camadas de profundidade (combater o "flat" atual)

O design hoje é chapado. Introduzir 3 planos coerentes:

```
z-[-10]  PLANO DE FUNDO   background vivo (WebGL/canvas) + vinheta radial
z-[0..10] PLANO DE CONTEÚDO  cards "glass" com borda neon + brilho interno sutil
z-[20+]  PLANO DE OVERLAY  header sticky, modais, toasts, tooltips
```

Cada superfície ganha: borda 1px `--bg-line`, brilho interno opcional (`box-shadow inset`), e elevação por sombra real (não só glow) — ver I.5.

## I.2 Tipografia

**Família:** JetBrains Mono (self-hosted via `next/font`, já implementado) — perfeita para o tema e para código. Pesos disponíveis: 300–800.

### I.2.1 Escala tipográfica (ritmo, não ad-hoc)

| Token | Tamanho | Line-height | Peso | Uso |
|-------|--------:|------------:|-----:|-----|
| `display-xl` | 96–128px (clamp) | 1.0 | 800 | Logo title-screen (home) |
| `display` | 48–72px | 1.05 | 800 | Countdown, números do pódio |
| `h1` | 30px | 1.2 | 700 | Títulos de tela |
| `h2` | 24px | 1.25 | 700 | Seções |
| `h3` | 20px | 1.3 | 600 | Sub-seções, nomes |
| `body-lg` | 18px | 1.5 | 400 | Destaque de parágrafo |
| `body` | 15px | 1.5 | 400 | Texto padrão |
| `code` | 15px | 1.7 (28px) | 400 | **Snippet** — leading generoso p/ legibilidade |
| `caption` | 12px | 1.4 | 500 | Labels, metadados |
| `micro` | 11px | 1.3 | 500 | Chips, hints |

**Regras:** (1) `clamp()` para títulos responsivos (sem media-query manual). (2) `tabular-nums` (font-feature) em **todos** os números que mudam ao vivo (WPM, precisão, tempo, contadores) — evita "tremor" de largura. 🔴 Hoje os números pulam de largura; isso é amador e some com `font-variant-numeric: tabular-nums`. (3) `text-wrap: balance` em títulos (já usado). (4) Tracking levemente positivo em uppercase labels (já feito).

## I.3 Sistema de movimento (o coração da sensação AAA)

> Movimento é linguagem. Um sistema coerente de curvas e durações é o que separa "animado" de "polido". Tudo abaixo vira `lib/motion.ts`.

### I.3.1 Curvas de easing (cubic-bezier nomeados)

| Token | cubic-bezier | Sensação | Quando usar |
|-------|--------------|----------|-------------|
| `ease-out-quad` | `0.25, 0.46, 0.45, 0.94` | Natural, suave | Entradas padrão, fades |
| `ease-out-expo` | `0.16, 1, 0.3, 1` | Rápido então desacelera — **premium** | Reveals de UI, painéis, modais |
| `ease-in-out-quart` | `0.76, 0, 0.24, 1` | Simétrico, fluido | Transições de estado, troca de tela |
| `ease-back-out` | `0.34, 1.56, 0.64, 1` | Overshoot/pop | Badges, combo, pódio, "stamps" |
| `ease-in-quad` | `0.55, 0.085, 0.68, 0.53` | Acelera p/ sair | Saídas/exits |

### I.3.2 Durações (tokens)

| Token | ms | Uso |
|-------|---:|-----|
| `dur-instant` | 80 | Hover de cor, feedback micro |
| `dur-fast` | 150 | Botões, toggles, tooltips |
| `dur-base` | 250 | Maioria das transições |
| `dur-slow` | 400 | Modais, seções de página |
| `dur-slower` | 600 | Heros, reveals dramáticos |
| `dur-cinematic` | 800–1200 | Countdown, pódio |

**Regra de fricção:** quanto mais frequente a interação, mais curta a animação. Um botão clicado 100×/sessão usa `dur-fast`; um pódio visto 1× usa `dur-cinematic`. Inverter isso causa fadiga.

### I.3.3 Presets de spring (framer-motion)

| Preset | `{ stiffness, damping }` | Sensação | Uso |
|--------|--------------------------|----------|-----|
| `spring-snappy` | `400, 30` | Responde rápido, sem balanço | Botões, toggles, hovers |
| `spring-smooth` | `200, 26` | Suave, controlado | Cards, painéis, layout |
| `spring-bouncy` | `300, 18` | Brincalhão, com overshoot | Combo, badges, emotes |
| `spring-gentle` | `120, 22` | Lento, fluido | Barras de progresso, pista (mantém o atual) |
| `spring-caret` | `700, 40` | Quase instantâneo mas suave | **Caret** do editor (§IV.2) |

### I.3.4 Coreografia (orchestration)

- **Stagger:** filhos entram com 30–60ms de defasagem; listas 40ms; pódio 100ms; nunca tudo de uma vez (o erro atual — todo elemento faz `fadeUp` idêntico simultâneo).
- **Sequência hero (home):** logo decifra (800ms) → tagline desliza palavra a palavra (stagger 40ms) → chips aparecem (stagger 60ms) → painel sobe (expo, 400ms). Tempo total ~1.4s, percebido como "abertura", não "carregamento".
- **Entrada vs. saída:** entradas com `ease-out-expo` (chegam com confiança); saídas com `ease-in-quad` mais curtas (somem sem chamar atenção). Regra: **saída ≈ 60% da duração da entrada**.
- **Origem espacial:** elementos entram da direção de onde "vêm" (o painel de baixo, o toast da direita, o caret segue o texto). Movimento sem origem lógica parece aleatório.

### I.3.5 Estratégia de `prefers-reduced-motion` (disciplina da casa)

Já respeitado globalmente (`globals.css:50`). **Regra para cada efeito novo:**

| Efeito normal | Fallback reduced-motion |
|---------------|-------------------------|
| Transform/slide | Cross-fade ≤ 120ms (sem movimento) |
| Parallax | Estático |
| Partículas, shake, confete | Removido (flash de cor opcional) |
| Background WebGL animado | Frame estático único |
| Count-up de número | Valor final imediato |
| Caret deslizante | Caret reposiciona sem tween |

Nenhuma informação pode existir *apenas* no movimento. O jogo deve ser 100% jogável e claro com motion zero.

## I.4 Sistema de som (40% do "feel" — hoje 0%)

> Som é o canal de feedback mais subestimado. Um jogo AAA sem áudio parece um protótipo. Arquitetura em `lib/sound.ts` (§VI).

### I.4.1 Arquitetura (Web Audio API)

```
AudioContext (único, destravado no 1º gesto do usuário — política de autoplay)
 └─ masterGain (volume global + mute, persistido em localStorage)
     ├─ uiBus      (cliques, hovers, toasts)
     ├─ gameBus    (teclas, erros, combo, nitro, finish)
     └─ musicBus   (ambiente opcional — com ducking)
```

- **Buffers pré-carregados** (sprites de áudio curtos, lazy após 1º gesto). Latência de disparo < 10ms.
- **Ducking:** `musicBus` abaixa −12dB durante countdown e finish para destacar SFX.
- **Anti-monotonia:** sons de tecla têm 3–4 amostras em round-robin + variação de pitch ±5% — digitar rápido não vira metralhadora idêntica.
- **Controles:** toggle mute (tecla `M`), slider de volume, persistido. **Nunca** toca antes de interação. Honra um "modo silencioso" próprio (independente de reduced-motion).

### I.4.2 Mapa de sons (catálogo)

| Evento | Som | Bus | Notas |
|--------|-----|-----|-------|
| `ui.hover` | tick suave | ui | só em pointer fino (não em touch) |
| `ui.click` | clique tátil | ui | |
| `ui.back` | clique grave | ui | voltar/cancelar |
| `room.join` | blip ascendente | game | jogador entra no lobby |
| `room.leave` | blip descendente | game | |
| `room.ready` | confirmação dupla | ui | ready-check |
| `countdown.tick` | beep (pitch sobe 3→2→1) | game | sincronizado ao número |
| `countdown.go` | buzina/horn grave | game | + ducking da música |
| `type.key` | clique mecânico (×4 samples) | game | volume baixo, pitch ±5% |
| `type.error` | "thock" grave | game | + shake visual (§IV.3) |
| `type.newline` | clique de "enter" distinto | game | recompensa fechar uma linha |
| `combo.milestone` | acorde ascendente (25/50/100) | game | escala em brilho |
| `combo.break` | descida curta | game | quebrou o streak |
| `nitro.enter` | whoosh + sub-bass | game | entra no modo nitro |
| `nitro.loop` | drone sutil | game | sustenta enquanto rápido |
| `race.overtake` | swish + ping | game | você passou alguém / foi passado (timbres distintos) |
| `race.finish.self` | chime de conclusão | game | você terminou |
| `results.win` | fanfarra curta | game | 1º lugar |
| `results.podium` | shimmer | game | entrada do pódio |
| `achievement.unlock` | jingle de conquista | game | + toast especial |
| `toast.notify` | pop discreto | ui | |
| `ambient.menu` | loop lo-fi/synth opcional | music | off por padrão, toggle |

## I.5 Elevação, sombra & glow

Hoje só há glow neon. Adicionar **elevação real** para profundidade (glow ≠ sombra):

| Token | Valor | Uso |
|-------|-------|-----|
| `elevation-1` | `0 1px 2px rgba(0,0,0,.4)` | cards em repouso |
| `elevation-2` | `0 4px 12px rgba(0,0,0,.5)` | cards hover, dropdowns |
| `elevation-3` | `0 12px 32px rgba(0,0,0,.6)` | modais |
| `glow-green` | `0 0 24px rgba(0,255,136,.25), 0 0 4px rgba(0,255,136,.4)` | foco/ação (existente) |
| `glow-amber` | idem amber | pódio/líder |
| `glow-inset` | `inset 0 0 0 1px rgba(0,255,136,.35), inset 0 0 24px rgba(0,255,136,.15)` | `neon-border` (existente) |

Regra: **glow comunica energia/estado** (foco, sucesso, perigo); **sombra comunica hierarquia** (o que está acima do quê). Não confundir os dois.

## I.6 Espaçamento, raio & grid

- **Espaçamento** (base 4px): `4 8 12 16 20 24 32 40 48 64 80 96`. Ritmo vertical consistente; seções respiram com `64–96`.
- **Raio:** `sm 4 · md 6 · lg 8 · xl 12 · 2xl 16 · full`. Cards `xl`, botões `md`, chips `full` (mantém o atual).
- **Grid de conteúdo:** `max-w-5xl` (home/leaderboard), `max-w-7xl` (sala). Gutters `px-4 md:px-6`.
- **Breakpoints (Tailwind):** `sm 640 · md 768 · lg 1024 · xl 1280`. Mobile-first sempre.

## I.7 Acessibilidade (padrão de qualidade, não checkbox)

Programadores reparam — e muitos dependem. Metas:

- **WCAG 2.1 AA** mínimo; AAA onde barato (contraste de texto já é AAA).
- **Teclado 100%:** todo fluxo jogável sem mouse. Ordem de tab lógica. `:focus-visible` neon (existente). Atalhos documentados (Apêndice D): `Enter` (confirmar), `Esc` (fechar/voltar), `M` (mute), `?` (atalhos), `Tab` (navegar).
- **Foco gerenciado:** modal faz focus-trap + restaura foco ao fechar (hoje `Modal` fecha no Esc mas não trapa foco — corrigir). Auto-focus no input certo (race, name-gate — já feito).
- **ARIA:** live regions para WPM/posição ("você está em 2º"), status de countdown, mensagens de chat (`aria-live="polite"`), erros (`role="alert"`). Labels em todo controle (maioria já existe).
- **`prefers-reduced-motion`** (§I.3.5) e **mute** (§I.4) sempre.
- **Touch targets ≥ 44×44px** no mobile.
- **Teste automatizado:** `axe` em CI nos componentes-chave (§VI).

## I.8 Orçamentos de performance (os números que o Cético vai medir)

> Metas que **falham o CI** se regredirem (§VI.15). Performance é contrato, não aspiração.

| Métrica | Meta | Por quê |
|---------|------|---------|
| **FPS na corrida** | 60 sustentado (sem drops < 55) | Input e leitura dependem disso |
| **Latência tecla→pixel** | < 16ms (1 frame) | Sensação de resposta direta |
| **Feedback de keystroke** | < 32ms percebido | Som + visual juntos |
| **LCP** | < 2.0s | Melhor que o "good" do Google (2.5s) |
| **INP** | < 200ms | Responsividade de interação |
| **CLS** | < 0.05 | Zero "pulo" de layout (font self-hosted ajuda) |
| **Bundle inicial (home, gzip)** | < 180KB JS | three.js **nunca** aqui — só lazy chunks |
| **Background WebGL** | 30–60fps, pausa em `visibilitychange`, off em Save-Data/low-mem | Não torrar bateria/CPU |

**Táticas:** code-splitting agressivo (`next/dynamic ssr:false` para efeitos pesados), `content-visibility` em listas longas, memoização do render de caracteres do snippet (§IV.1), throttle de broadcast já existente (120ms), `will-change` cirúrgico (nunca global), pausar RAF de backgrounds quando a aba está oculta.

---

# PARTE II — React Bits: integração com critério

## II.1 O que é (e o que isso implica)

[React Bits](https://www.reactbits.dev) **não é um pacote npm**. É uma coleção de componentes **copy-paste / CLI** (via `jsrepo` ou registry shadcn). Você **cola o código no projeto e vira dono dele** — o que é ideal: permite **re-tematizar com nossos tokens** (§I.1) em vez de herdar as cores default. Toda peça do React Bits que entrar **deve** ser passada pelo nosso design system: cores → CSS vars, durações/easings → tokens de movimento (§I.3), e ganhar fallback de reduced-motion (§I.3.5).

## II.2 Custo técnico por tier (decisão de performance, não de gosto)

| Tier | Dependência | Peso aprox. | Política |
|------|-------------|------------:|----------|
| **Leve** | React + framer-motion (já temos) ou canvas puro | ~0 KB | ✅ Livre, inclusive perto do gameplay |
| **GSAP** | `gsap` | ~50 KB | ✅ OK; usado por alguns text/card effects |
| **OGL** | `ogl` (WebGL minimalista) | ~25 KB | ✅ Backgrounds de menu/lobby/results (lazy) |
| **three.js** | `three` (+ `postprocessing`) | ~150–600 KB | ⚠️ **Só** `next/dynamic ssr:false`, jamais no bundle crítico, jamais atrás do editor |

> **Veredito de bundle:** preferir sempre **canvas puro** ou **OGL**. `three.js` (Hyperspeed, Ballpit, Pixel Blast, Dither, Lanyard) entra só como chunk sob demanda em momentos específicos (ex.: nitro, pódio) e atrás de um perf-gate. Medir com `size-limit` no CI (§VI.15).

## II.3 Mapa curado: componente → uso → tier → justificativa

> Curadoria, não "usar tudo". Cada escolha resolve um problema real de uma tela específica. Specs de aplicação detalhados na Parte III/IV.

### Backgrounds
| Componente | Tier | Onde | Por quê (vs. alternativas) |
|------------|------|------|----------------------------|
| **LetterGlitch** | Leve (canvas) | Home, NameGate | **Par perfeito** do tema: caracteres que glitcham. Zero-dep, evolui o MatrixRain atual sem custo |
| **FaultyTerminal** | OGL | Home (alternativa premium) | "Terminal corrompido" — altíssima sinergia hacker; A/B contra LetterGlitch |
| **Aurora** / **Silk** | OGL | Lobby, Results | Clima calmo/nobre; movimento orgânico lento, não distrai |
| **Beams** / **LightRays** | OGL | Countdown, Results (vencedor) | Raios de luz = drama de largada e de glória |
| **Dither** / **Particles** | OGL/three | Profundidade sutil opcional | Só se passar no perf-budget |

### Texto
| Componente | Tier | Onde | Por quê |
|------------|------|------|---------|
| **DecryptedText** | Leve | Logo (home), título do snippet, código da sala | "Descriptografa" — temático e satisfatório |
| **ShinyText** | Leve | Logo (loop sutil), CTAs | Brilho que passa, vida sem distração |
| **GlitchText** | Leve | Logo (hover/erro 404), momentos de tensão | Reforça identidade hacker |
| **SplitText** / **BlurText** | Leve | Headings, taglines | Entrada palavra a palavra, premium |
| **CountUp** / **Counter** | Leve | WPM, precisão, pódio, countdown | Números que sobem = dopamina; **crítico** |
| **TrueFocus** | Leve | Destaques de seção | Foco que "puxa" o olho |

### Animações & interação
| Componente | Tier | Onde | Por quê |
|------------|------|------|---------|
| **StarBorder** | Leve | Botões primários (criar, iniciar, jogar de novo) | Borda viva = "este é o botão importante" |
| **ClickSpark** | Leve | Botões de ação | Faísca no clique = feedback tátil |
| **GlareHover** | Leve | Cards, botões secundários | Reflexo que segue o mouse |
| **SpotlightCard** | Leve | Painel da home, cards de feature, leaderboard | Brilho que segue o cursor — premium |
| **MagicBento** | Leve | Grid de features (home) | Grid com glow/partícula — assinatura React Bits |
| **TiltedCard** | Leve | Cards de jogador, seleção de linguagem | Profundidade 3D no hover |
| **Crosshair** | Leve | Cursor global (desktop, menus) | Mira hacker; off em touch/race |
| **AnimatedList** | Leve | Chat, lista de jogadores, ranking | Entrada com stagger |
| **Hyperspeed** | three (lazy) | Nitro (race), transição p/ corrida | Velocidade literal — só sob demanda |
| **Confetti** (custom/canvas) | Leve | Vitória | Clímax do pódio |

## II.4 Regras de integração (não-negociáveis)

1. **Re-tematizar sempre:** trocar cores hardcoded pelos tokens (§I.1). Um efeito com cor "fora da paleta" denuncia copy-paste preguiçoso.
2. **Tokenizar movimento:** durações/easings do componente → tokens (§I.3). Coerência sistêmica.
3. **Fallback obrigatório:** todo componente colado ganha branch de `prefers-reduced-motion`.
4. **Perf-gate nos pesados:** WebGL atrás de `next/dynamic`, `Suspense`, e do "performance mode" (§I.8). Pausar em aba oculta.
5. **Isolar:** cada efeito num wrapper nosso (`<Spark/>`, `<GlowButton/>`) — nunca espalhar a implementação do React Bits pelos componentes de negócio. Facilita trocar/remover.

---

# PARTE III — Especificação tela a tela

> Para cada tela: **objetivo & metas do usuário · estado atual · layout · cada elemento · cada animação (gatilho/duração/curva/valores) · estados (loading/empty/error) · responsivo · acessibilidade · som · React Bits**. Esta é a parte executável.

## III.1 Home / Title Screen — `HomeView.tsx`

### Objetivo & metas do usuário
"Em 3 segundos, entender o que é, sentir que é de qualidade, e ter um caminho óbvio para jogar." O usuário quer: criar sala **ou** entrar com código, rápido, sem fricção. A home é o **handshake de credibilidade** — é onde O Cético decide se continua.

### Estado atual (`HomeView.tsx`)
MatrixRain sutil + Logo (pulse de opacidade) + parágrafo + 3 chips + painel criar/entrar + 3 cards de feature + footer. Tudo entra com `fadeUp` quase idêntico e simultâneo. Funcional, sem "uau".

### Layout (alvo)
```
┌─ HEADER (sticky, glass) ──────────────────────────────────┐
│ [Logo sm]                    [ranking] [auth] [● online]   │
├─ HERO (centrado, max-w-5xl) ──────────────────────────────┤
│                  [LOGO display-xl, decrypt]                │
│              tagline (split, palavra a palavra)            │
│         [chip tempo-real] [chip multi] [chip 8 langs]      │
│                                                            │
│   ┌─ PAINEL (SpotlightCard, neon-border) ──────────────┐   │
│   │  player_name  [_______________________]            │   │
│   │  [ Criar sala (StarBorder) ]  [CÓDIGO][→]          │   │
│   └────────────────────────────────────────────────────┘   │
│                                                            │
│   [MagicBento: 3 features com glow/spotlight]              │
│   footer terminal-prompt                                   │
└────────────────────────────────────────────────────────────┘
Fundo: LetterGlitch (z-[-10]) + vinheta radial central
```

### Elementos & animações (spec)

**Sequência de abertura (orquestrada — §I.3.4):**
| t (ms) | Elemento | Animação | Duração | Curva |
|-------:|----------|----------|--------:|-------|
| 0 | Background LetterGlitch | fade-in 0→1 opacidade | 600 | `ease-out-quad` |
| 150 | Logo | **DecryptedText** decifra "CodeRacer" + scale 0.96→1 | 800 | `ease-out-expo` |
| 600 | Tagline | **SplitText** palavra a palavra, y:8→0 + fade | stagger 40 | `ease-out-expo` |
| 850 | 3 chips | fade + y:6→0, stagger | stagger 60 | `ease-back-out` |
| 1000 | Painel | y:16→0 + fade + scale 0.98→1 | 400 | `ease-out-expo` |
| 1200 | Features (Bento) | stagger reveal | stagger 80 | `ease-out-quad` |

Depois do load, o logo mantém **ShinyText** em loop lento (brilho cruza a cada ~4s) — vida sem distração.

**Microinterações contínuas:**
- **Painel = SpotlightCard:** um brilho radial (`--neon-green` a 8% alpha) segue o cursor com lag suave (lerp ~0.1). Em reduced-motion: brilho estático no topo.
- **Botão "Criar sala" = StarBorder + ClickSpark:** borda com gradiente girando (período ~3s); no clique, faíscas verdes (8–12 partículas, vida 400ms, `ease-out-quad`) + `ui.click` + scale 0.98 (já existe) + abre modal.
- **Input de código:** ao focar, borda anima para `--neon-green` + `glow-green` (`dur-fast`); cada caractere digitado faz um "stamp" sutil (scale 1.05→1 no container, 80ms). Uppercase + tracking `0.3em` (mantém o atual).
- **Botão entrar (→):** `GlareHover` (reflexo diagonal passa no hover).
- **Cursor:** `Crosshair` global (desktop apenas; `pointer: fine`). Esconde o cursor nativo, desenha uma mira fina `--neon-green` 30% que segue com lerp. Off em touch e na tela de corrida.

**Features (MagicBento):** 3 cards (snippets reais / até 12 jogadores / WPM+precisão). Cada um: hover levanta (`elevation-2` + scale 1.02, `spring-snappy`), borda ganha cor do tema, e uma partícula/spotlight interno acende. Ícone com micro-bounce no hover.

**Header:** aparece com slide-down sutil (−8→0) no load (200ms). "● online" pulsa (mantém). Auth/ranking com `GlareHover`. Sticky com `backdrop-blur` ao rolar.

### Estados
- **Loading (criar/entrar):** botão entra em estado loading — texto vira "criando..." + spinner inline (3 dots pulsando em sequência, 1.2s loop) + desabilita. Sem bloquear a tela.
- **Erro:** toast (§III.9) — "Sala não encontrada", "Sem conexão". Input de código treme (shake 4px, 300ms) em erro de validação.
- **Empty:** N/A (home é sempre cheia).

### Responsivo
- Mobile: logo `display` (não xl), painel full-width, botões empilham (`grid-cols-1`), features viram 1 coluna com scroll. Crosshair off. LetterGlitch com densidade reduzida (perf).
- O painel nunca encosta nas bordas (`px-4` mínimo).

### Acessibilidade
- H1 real `sr-only` (mantém — SEO + leitores). Logo é `aria-hidden`.
- Foco inicial: **não** roubar foco automático (home não é tarefa urgente); primeiro tab vai ao input de nome.
- Crosshair respeita `prefers-reduced-motion` (vira cursor normal). Todos os reveals têm fallback de fade.
- Contraste dos chips validado (texto neon sobre `--bg-card`).

### Som
`ui.hover` nos itens do header e botões; `ui.click` ao abrir modal; `ambient.menu` disponível (off por padrão).

### React Bits
LetterGlitch/FaultyTerminal · DecryptedText · ShinyText · SplitText · SpotlightCard · MagicBento · StarBorder · ClickSpark · GlareHover · Crosshair.

---

## III.2 Modal "Configurar sala" — `HomeView.tsx:293`

### Objetivo
Escolher linguagem, dificuldade e máx. de jogadores **sem fricção**, com preview do que cada opção significa.

### Spec
- **Entrada do modal:** backdrop fade (0→1, 250ms) + `backdrop-blur`; card sobe (y:20→0, scale 0.98→1, `ease-out-expo`, 400ms). Saída: 60% da duração, `ease-in-quad`. (Base já existe em `Modal.tsx` — refinar valores e adicionar focus-trap.)
- **Seleção de linguagem (grid 4 col):** cada botão é um mini-card. Selecionado: borda `--neon-green` + `bg-neon-green/10` + `glow-green` + ícone com micro-scale 1→1.1 (`spring-bouncy`). Hover: `TiltedCard` leve (rotateX/Y ≤ 6°). A cor de cada linguagem (`languages.ts`) tinge o glow do hover (JS amarelo, Rust laranja...) — detalhe que devs notam.
- **Dificuldade (3 col):** idem, cor cyan. Mostra `desc` (já existe). Selecionado pulsa 1× ao trocar.
- **Slider de jogadores:** trilho customizado (não o nativo cru) — preenchimento `--neon-green`, thumb com `glow-green`, valor em `tabular-nums` que faz count-up ao arrastar. Marcas em 2 e 12.
- **Botão "criar sala →":** StarBorder + estado loading.

### Acessibilidade
Focus-trap (entrar no modal foca o 1º controle; `Tab` cicla dentro; `Esc` fecha e **restaura** foco ao botão que abriu). Grupos de linguagem/dificuldade como `role="radiogroup"` com setas navegáveis. `aria-label` no slider com valor atual.

### Som
`ui.click` em cada seleção (pitch sutilmente diferente por categoria); `ui.back` no cancelar.

---

## III.3 NameGate (convite) — `RoomView.tsx:165`

### Objetivo
Alguém clicou num link de convite. Reduzir ao máximo o atrito até entrar — e já transmitir qualidade + social proof.

### Spec
- Card central (neon-border) entra com `ease-out-expo` (y:16→0, 400ms). Logo `md` no topo.
- **Código da sala:** renderizado com **DecryptedText** (decifra ao montar) + tracking `0.25em` — parece "acessando sala segura".
- **Social proof (novo):** "🟢 N jogadores na sala" — puxa o `presence.count` via um fetch leve antes de entrar. Number com count-up. Reduz hesitação ("tem gente lá").
- **Input nick:** auto-focus (já feito), prefill do localStorage (já feito). Enter submete.
- **Botão "Entrar na corrida":** StarBorder + ClickSpark; ao submeter, transição para "connecting" com **PixelTransition** ou fade rápido (não corte seco).
- Background LetterGlitch `opacity 0.06`.

### Estados
- **Sala cheia / em corrida:** mensagem clara + CTA alternativo ("entrar como espectador" se §V spectator existir; senão "voltar à home").
- **Sala inexistente:** estado de erro in-card (não só toast) — ícone 🏁 + "essa sala não existe ou expirou" + botão criar nova.

### Acessibilidade
Form semântico (`<form>`, label associada — já feito). `aria-live` no contador de jogadores.

---

## III.4 Lobby — `Lobby.tsx`

### Objetivo & metas
Sala de espera: configurar (líder), ver quem está, convidar mais, e **sentir antecipação**. O usuário quer saber "quando começa?" e "quem tá comigo?".

### Estado atual
Card welcome + settings (lang/diff/maxplayers, só líder) + grid de jogadores + sidebar (PlayerList + Chat). Sólido, mas estático.

### Layout (alvo)
Background `Aurora`/`Silk` (OGL, lento, cyan, z-[-10]). Coluna principal: welcome → settings → grid de jogadores. Sidebar: PlayerList + Chat (sticky).

### Elementos & animações
- **Welcome card:** entra (y:8→0, fade). Contador "X/Y jogadores" em `tabular-nums`, count-up quando alguém entra/sai.
- **Settings:** botões de linguagem/dificuldade = `TiltedCard` + `GlareHover`, com a cor da linguagem no glow. Trocar setting (líder) faz o card alvo pulsar 1× (`spring-bouncy`) e propaga via realtime — para os outros jogadores, a mudança chega com um highlight de 400ms (eles veem "o líder mudou para Python") + linha no chat. **Feedback de mudança remota é crucial** e hoje é silencioso.
- **Grid de jogadores (`AnimatedList`/`BounceCards`):** cada jogador entra com pop (scale 0.9→1, `spring-bouncy`) + `room.join` + glow na cor dele expandindo 1×. Sai com fade+scale-down. Avatar com anel neon na cor do player; líder com coroa âmbar que tem micro-flutuação (y ±2px, 3s loop).
- **Ready-check (feature nova, §V):** cada jogador tem um toggle "pronto" (tecla `R`). Avatar ganha um anel de "check" verde quando pronto. O botão "Iniciar" do líder mostra "3/5 prontos" e pulsa quando todos prontos. Reduz largadas com gente AFK.
- **Botão "Iniciar partida":** StarBorder grande + ClickSpark + `countdown.go` preview; ao clicar, transição cinematográfica para o countdown (§III.5).
- **Compartilhar:** botão copia link + **feedback rico** — o botão vira "✓ copiado!" por 1.5s com check animado (draw-in do path SVG, 300ms) além do toast.

### Estados
- **Sozinho na sala:** estado especial — "compartilhe o link para chamar a galera" com o link destacado + botões de share (Discord/WhatsApp/copiar). Evita o vazio desanimador.
- **Não-líder:** settings em readonly com "(só o líder edita)" — mas mostrar claramente *quem* é o líder e que você pode assumir se ele sair.

### Responsivo
Mobile: sidebar (PlayerList+Chat) vira abas/drawer abaixo do conteúdo; grid de jogadores 2 col; settings em coluna única. Aurora com qualidade reduzida.

### Acessibilidade
Mudanças de settings e entradas/saídas anunciadas em `aria-live="polite"`. Ready-check operável por teclado. Foco vai ao botão "Iniciar" para o líder ao entrar.

### Som
`room.join`/`room.leave`, `room.ready`, `ui.click` nas settings.

### React Bits
Aurora/Silk · TiltedCard · GlareHover · AnimatedList/BounceCards · StarBorder · ClickSpark.

---

## III.5 Countdown — `Countdown.tsx`

### Objetivo
Construir **tensão** e sincronizar todos para a largada. Este é um pico emocional de ~4s — merece tratamento cinematográfico. Hoje: number pop com troca de cor. Bom, mas não cria adrenalina.

### Spec (cinematográfica)
A contagem deriva de `start_at` (já implementado, sem timer no servidor — `useRoom.ts:263`). Sequência por número:

| Número | Cor | Escala de tensão | Efeitos |
|--------|-----|------------------|---------|
| 3 | `--neon-cyan` | calma | número entra (scale 0.4→1, rotate −8→0, `ease-back-out`), `countdown.tick` (pitch baixo) |
| 2 | `--neon-cyan` | sobe | + leve screen-shake (2px), vinheta fecha 5% |
| 1 | `--neon-amber` | alta | + shake 4px, `LightRays` âmbar pulsam atrás, vinheta 10% |
| GO! | `--neon-green` (explosivo) | clímax | flash branco 80ms, shake 6px, `countdown.go` (horn), partículas radiais, racers dão "lurch" na pista |

- Cada número usa **AnimatePresence mode=wait** (já existe): entra (scale 0.4→1, 400ms `ease-back-out`), sai (scale 1.6→0, fade, 250ms). O exit "estoura" para fora — sensação de aceleração.
- **Subtítulo** ("prepare seus dedos..." → "vai vai vai!") com `SplitText`.
- **Pista visível por trás** (semi-transparente) — os jogadores veem os racers prontos, vibrando levemente, e o lurch no GO. Antecipação compartilhada.
- **Ducking de áudio:** música abaixa, SFX de countdown no centro do mix.

### Reduced-motion
Sem shake, sem flash, sem partículas. Números trocam por cross-fade ≤120ms. `LightRays` estático. O `countdown.go` ainda toca (áudio é opt-out separado).

### Acessibilidade
`aria-live="assertive"` anuncia "3, 2, 1, vai!". O flash branco respeita reduced-motion (vira mudança de cor suave) — importante para fotossensibilidade (nunca flash > 3Hz).

---

## III.6 Race (nível de tela) — `Race.tsx`

> A mecânica de feel (syntax, caret, combo, nitro, pista) está na **Parte IV**. Aqui: layout, stats e estrutura da tela.

### Objetivo & metas
Foco total. O usuário quer: ler o código com clareza, ver seu progresso e o dos outros, e sentir velocidade. Tudo secundário (chat, decoração) cede espaço ao essencial. **A regra de ouro (§0.4) reina aqui.**

### Layout (alvo — `grid lg:grid-cols-[1fr_320px]`)
```
┌─ HEADER (sticky, slim) ─ logo · código · [mute] [?] ──────┐
├─ PISTA (RaceTrack redesenhada — §IV.6) ───────────────────┤
├─ ┌ EDITOR (CodeDisplay §IV.1) ┐ ┌ INPUT + stats vivas ┐ ─┤
│  │ código c/ syntax highlight │ │ textarea + caret    │   │
│  │ + caret + estados          │ │ WPM · acc · combo   │   │
│  └────────────────────────────┘ └─────────────────────┘   │
├─ STATS pessoais (WPM/acc/prog/erros + sparkline §IV.5) ───┤
│  SIDEBAR (lg): Chat compacto                              │
└────────────────────────────────────────────────────────────┘
```

### Stats vivas (spec)
- **WPM, precisão, progresso, erros** (`Race.tsx:157`) — todos em `tabular-nums`, atualizados com **micro count-up** (não salto seco): quando o WPM vai de 78→81, anima em 200ms (`ease-out-quad`). Cor da precisão escala (verde≥95, cyan≥85, amber abaixo — mantém a lógica).
- **Barra de progresso pessoal:** gradiente green→cyan (`Race.tsx:183`), `spring-gentle`, com **brilho que intensifica com a velocidade** (box-shadow alpha ∝ WPM) — feedback subliminar de "você está voando".
- **Mini-sparkline de WPM** (§IV.5) ao lado das stats.
- **Contador de combo** (§IV.4) — destaque visual quando ativo.

### Estados
- **Você terminou:** input desabilita com classe clara, placeholder "✅ terminou! veja os outros" (já existe), e a tela transiciona o foco para a pista (onde a disputa continua). Sua linha na pista ganha o medal.
- **Última pessoa digitando:** quando só resta você, sutil destaque ("todos esperando você 👀") — pressão social divertida, sem ser cruel.
- **Desconexão/realtime caiu:** banner discreto "reconectando..." sem tirar você da corrida; input continua local.

### Responsivo (mobile — crítico, hoje frágil)
- Layout **vertical**: pista vira faixa compacta fixa no topo (só você + líder + posição), editor em destaque, input abaixo, chat em drawer.
- Fonte do código maior (16px+) para o teclado virtual. Testar latência real do teclado virtual (iOS/Android).
- Stats em pílula horizontal compacta (scroll-x se preciso).
- Nitro/partículas reduzidos no mobile (perf).

### Acessibilidade
- `aria-live="polite"` para mudanças de posição ("você passou para 2º") — sem spammar (throttle).
- Editor e input com labels claras. `Esc` não fecha a corrida (evita saída acidental); "desistir" exige confirmação.
- Caret e estados de erro têm contraste suficiente; erro nunca é só cor (tem fundo + posição + som).

### Som
`type.key`, `type.error`, `type.newline`, `combo.*`, `nitro.*`, `race.overtake`, `race.finish.self` — todos em §IV.

---

## III.7 Results / Pódio — `Results.tsx`

### Objetivo
**Clímax e recompensa.** O usuário quer saber: ganhei? como me saí? e quero jogar de novo. Este é o momento mais compartilhável — merece ser lindo. Hoje: headline + pódio (alturas fixas) + tabela + ações. Morno.

### Sequência cinematográfica (entrada)
| t (ms) | Elemento | Animação |
|-------:|----------|----------|
| 0 | Background vira `Aurora` âmbar + `LightRays` no topo | fade-in |
| 200 | Headline "Partida finalizada" | DecryptedText + scale (mantém o spirit do atual) |
| 400 | Pódio 2º lugar | sobe da base (y:40→0, `ease-out-expo`) |
| 550 | Pódio 1º lugar | sobe mais alto + `glow-amber` + coroa cai com bounce + **confete** + `results.win` |
| 700 | Pódio 3º lugar | sobe |
| 900 | Stats de cada pódio | **CountUp** do WPM (0→valor, 800ms) |
| 1100 | Tabela completa | linhas com `AnimatedList` stagger 40ms |
| 1300 | Ações (jogar de novo / ranking / share) | fade-up |

### Elementos (spec)
- **Pódio:** ordem visual 2-1-3 (mantém). 1º lugar: card maior, borda âmbar, `glow-amber`, coroa flutuante, e um `SpotlightCard` interno. Avatar grande. Se for você: badge "(você)" + destaque extra.
- **Confete:** canvas leve (não three.js) — ~120 partículas nas cores dos jogadores, gravidade + drift, vida 2.5s, dispara 1× no reveal do 1º. Reduced-motion: sem confete (flash âmbar sutil).
- **CountUp das stats:** WPM e precisão sobem do zero — o número "trabalhando" é profundamente satisfatório e faz o jogador *reler* sua performance.
- **Badges da partida:** se o jogador desbloqueou conquista (§V.3) — "🎯 Flawless", "⚡ 100 WPM" — aparecem com `ease-back-out` + `achievement.unlock`.
- **Tabela completa:** sua linha (`isMe`) com `bg-neon-green/5` (mantém) + leve pulse. Colunas em `tabular-nums`.
- **Share card (feature viral, §V):** botão "compartilhar resultado" gera uma imagem (canvas/OG) "Terminei em Xº · Y WPM · Z% no CodeRacer" com o tema neon → baixar/compartilhar. Loop de aquisição.

### Ações
- **Líder:** "Jogar de novo" (StarBorder + ClickSpark) → reset para lobby (mantém a próxima sala). 
- **Não-líder:** "aguardando líder reiniciar..." com pulse (mantém), mas adicionar **voto de rematch** ("👍 quero de novo (3/5)") — pressão social positiva.
- Link para ranking global (mantém).

### Acessibilidade
`aria-live` anuncia o resultado ("você terminou em 2º, 81 WPM"). Confete `aria-hidden`. Ordem de leitura: resultado pessoal primeiro, depois pódio, depois tabela.

### Som
`results.podium`, `results.win` (1º) ou `results.reveal` (demais), `achievement.unlock`, `ui.click` nas ações.

### React Bits
Aurora · LightRays · DecryptedText · CountUp · SpotlightCard · AnimatedList · Confetti (custom).

---

## III.8 Leaderboard global — `leaderboard/page.tsx`

### Objetivo
Glória pública e prova social. O competitivo vem aqui medir-se; o novato vem sonhar. SSR (bom p/ SEO — manter).

### Spec
- Manter SSR; **hidratar com vida** (sem prejudicar o LCP).
- **Pódio top-3 (novo):** antes da tabela, um pódio visual dos 3 melhores com `ChromaGrid`/`SpotlightCard` — fotos/avatares, WPM grande, cor de rank. Transforma uma tabela seca em destaque.
- **Tabela:** linhas com hover `SpotlightCard` (brilho segue o mouse). WPM em `tabular-nums` + **CountUp ao entrar no viewport** (`ScrollReveal` — anima 1× quando a linha aparece). Top-3 com fundo âmbar (mantém).
- **Badge de rank** por jogador (Bronze→Diamond, §V.2) ao lado do nome — status visível.
- **Filtros (novo):** por linguagem, dificuldade, período (hoje/semana/todos). Chips clicáveis no topo. Atualiza via query param (mantém SSR/SEO).
- **Partidas recentes (sidebar):** mantém, com entrada `AnimatedList` e `timeAgo` ao vivo.
- **Estado vazio:** já tem (🏁 + CTA — bom). Refinar com ilustração/ASCII art.
- **Supabase não configurado:** aviso âmbar (mantém).

### Acessibilidade
Tabela semântica com `<th scope>`. Filtros como `role="tablist"`/toggles navegáveis. CountUp respeita reduced-motion (valor final imediato).

### Som
Discreto — `ui.hover`/`ui.click` nos filtros. Sem música (página de consulta).

---

## III.9 Perfil / Dashboard (tela nova) — `profile/[name]/page.tsx`

### Objetivo
Casa do jogador: identidade, progressão e histórico. Motor de retenção. Páginas indexáveis (SEO por jogador). Depende de persistência (Supabase + auth — já temos).

### Spec
- **Header de identidade:** avatar grande (anel de rank), nome, rank atual (Bronze→Code Master) com barra de XP até o próximo nível (CountUp + fill animado), país (opcional).
- **Stats cards:** melhor WPM, precisão média, corridas, vitórias, win-rate, linguagem favorita — cada um com ícone, `tabular-nums`, e micro-sparkline de evolução.
- **Gráfico de evolução:** WPM ao longo do tempo (área com gradiente neon, draw-in animado).
- **Coleção de badges:** grid de conquistas (desbloqueadas coloridas, bloqueadas em silhueta com hint). Hover = `TiltedCard` + descrição.
- **Histórico recente:** lista de partidas (`AnimatedList`).
- **Compartilhar perfil:** card OG.

### Acessibilidade & Som
Gráficos com `<title>`/`aria-label` descritivos e tabela alternativa. Som discreto.

### React Bits
SpotlightCard · TiltedCard · CountUp · AnimatedList · ChromaGrid (badges).

---

## III.10 Primitivas de UI (a base reutilizável)

> Hoje são classes `@apply` em `globals.css`. **Extrair para componentes React** (`<Button>`, `<Card>`, `<Input>`, `<Stat>`, `<Badge>`, `<Chip>`) para compor wrappers React Bits de forma consistente (§VI.13). Sem isso, cada tela reinventa e a coerência morre.

### `<Button>` (variantes: primary, secondary, ghost, danger)
- Base: `dur-fast`, `active:scale-[0.98]` (já existe), `:focus-visible` neon.
- **Primary:** `--neon-green` fill, texto `--bg-void`, `glow-green`; hover intensifica glow. Opção `StarBorder` para CTAs heróicos. Loading: spinner inline + texto, sem mudar largura (reserva espaço). `ClickSpark` opcional.
- **Secondary:** borda + `GlareHover`. **Ghost:** texto, hover sutil. **Danger:** borda vermelha, hover preenche 10% + `glow-red` + exige confirmação para ações destrutivas.
- **Estados:** default · hover · active · focus · loading · disabled (opacity 50, mantém). Todos especificados, não improvisados.

### `<Card>`
Glass + borda `--bg-line` + raio `xl` + `elevation-1`. Variante `neon-border`. Hover (quando interativo): `elevation-2` + scale 1.01 (`spring-snappy`). Opção `SpotlightCard`.

### `<Input>`
Borda `--bg-line` → foco `--neon-green` + `glow-green` (`dur-fast`, já existe). Erro: borda vermelha + shake + `role="alert"`. `tabular-nums` quando numérico.

### `<Toast>` — `ui/Toast.tsx`
- Entra da direita (x:40→0, fade, `spring-snappy`); empilha com `AnimatedList`. Auto-dismiss 3.5s (mantém) com **barra de progresso** consumindo na borda inferior. **Ícone por tipo** (✓ sucesso, ✕ erro, ℹ info) — hoje só cor. `toast.notify` sutil. Pausa o timer no hover. `aria-live` apropriado (`polite`/`assertive` por tipo).

### `<Modal>` — `ui/Modal.tsx`
Refinar (§III.2): focus-trap + restauração de foco, `aria-modal`, `role="dialog"`, `aria-labelledby`. Backdrop blur (mantém). Opção de transição `PixelTransition`.

### Loading & Empty (hoje fracos)
- **Skeletons:** usar a classe `.shimmer` (existe em `globals.css:147`, **não usada**!) em vez de "conectando..." cru. Cards/listas mostram skeleton com shimmer enquanto carregam.
- **Empty states:** sempre com ilustração/ASCII + 1 frase + 1 CTA. Nunca um vazio mudo.
- **Spinners:** 3 dots em sequência (1.2s) ou um `>_` piscando — coerente com o tema.

### Estados de erro globais — `error.tsx`, `not-found.tsx`
404 com personalidade: `GlitchText` "404", ASCII art, "essa rota deu segfault" + botão home. Error boundary com opção "recarregar" + reportar (Sentry, §VI.16).

---

# PARTE IV — O coração: game feel da corrida

> Aqui mora a diferença entre "bom" e "AAA". Quase nada disto existe hoje. É a maior alavanca do projeto e o que mais será julgado por quem joga. Cada subsistema tem spec de comportamento, performance e fallback.

## IV.1 Syntax highlighting real 🔴 (a maior perda visual atual)

### O problema
`CodeDisplay.tsx` pinta o código em **cinza monocromático** com 3 estados (done/erro/atual). Para um jogo de **digitar código**, isso é como um jogo de corrida sem texturas. Um dev olha e pensa "isso é um `<textarea>` estilizado", não "um editor".

### Arquitetura (duas camadas)
Renderizar o snippet em **duas camadas sobrepostas**, pixel-perfeitas (mesma fonte mono, mesmo leading):

```
Camada 1 (base):  SYNTAX — cada token colorido por categoria (keyword, string, número, comentário, função, operador, tipo)
Camada 2 (estado): TYPING — overlay por caractere: done (dim), erro (fundo vermelho), atual (caret/highlight)
```

A camada de estado **modula** a de sintaxe (ex.: já digitado = sintaxe esmaecida a 45% opacidade; não digitado = sintaxe plena; erro = vermelho domina). O olho lê **código bonito** e **estado de progresso** ao mesmo tempo.

### Implementação
- **Tokenização no servidor** (já temos o snippet no server — `snippets.ts`/API). Pré-tokenizar com **Shiki** (TextMate grammars, preciso e lindo) ou `prism-react-renderer` (mais leve). Enviar os tokens prontos com o snippet → **zero custo de tokenização no cliente durante a corrida** (crítico para o budget de §I.8).
- **Tema:** mapear os escopos para nossos tokens neon (keyword `--neon-violet`, string `--neon-amber`, número `--neon-cyan`, comentário `--text-dim`, função `--neon-green`, tipo `--neon-cyan`, operador `--text`). Um tema "CodeRacer Neon" customizado — coerente com a marca.
- **Render:** memoizar por caractere/token (`useMemo`), `key` estável. A camada de estado atualiza só os índices que mudaram (não re-renderiza tudo a cada tecla). 
- **Por linguagem:** Shiki cobre todas as 8 (e futuras). O highlight correto **por linguagem** é exatamente o tipo de autenticidade que o público valoriza.

### Performance
Tokenização fora do hot-path. Render de ~600 chars memoizado. Scroll suave já existe (`CodeDisplay.tsx:31`). Meta: zero impacto no FPS da digitação.

### Reduced-motion / fallback
Syntax highlight é estático (não é "motion") — sempre on. Se a tokenização falhar (snippet novo sem tokens), degradar graciosamente para o render atual monocromático.

## IV.2 Caret animado 🟠 (a assinatura de feel de typing games)

### O problema
O caractere atual é só um `box-shadow` estático (`globals.css:171`). Os melhores typing games (Monkeytype) têm um **caret que desliza** — é *o* detalhe que comunica fluidez.

### Spec
- **Caret block** (ou linha grossa) na cor `--neon-green` que **desliza** entre as posições dos caracteres com `spring-caret` (`{700, 40}` — quase instantâneo mas suave, nunca preguiçoso).
- **Blink** quando parado > 500ms (opacidade 1→0.3→1, 1s, `steps`-free senoidal). Para de piscar ao digitar.
- **Smear sutil:** ao mover rápido, o caret pode esticar levemente na direção do movimento (scaleX 1.15 por 60ms) — micro-detalhe de velocidade.
- **Posicionamento:** medido via o `<span data-i>` do caractere atual (já existe a infra de posição). O caret é um elemento absoluto que anima `left/top` para a posição do próximo char.
- **Newline:** ao chegar no fim da linha, o caret desliza para o início da próxima com um arco sutil + `type.newline`.

### Performance
Um único elemento animado (não re-renderiza o texto). `transform: translate` (GPU), não `left/top` se possível. 60fps trivial.

### Reduced-motion
Caret reposiciona instantaneamente (sem tween), ainda pisca (ou não, se o usuário preferir). Sempre visível e claro.

## IV.3 Feedback por keystroke 🔴 (a dopamina por tecla)

### O problema
Digitar certo não dá **nada**. Sem recompensa, sem peso. Erro só pinta de vermelho. Falta tato.

### Spec — acerto
- **Som:** `type.key` (4 samples round-robin, pitch ±5%) — volume baixo, satisfatório.
- **Visual sutil:** o caractere recém-acertado faz um micro-flash (scale 1→1.08→1 em 100ms, ou um brilho verde rápido). **Discreto** — não pode cansar em 600 teclas.
- **Em streak alto:** o flash fica mais quente (ver combo §IV.4) — partículas começam a subir do caret.

### Spec — erro
- **Som:** `type.error` ("thock" grave).
- **Visual:** o caractere errado ganha fundo vermelho (mantém) + **screen-shake** cirúrgico: o *card do editor* treme 4–6px por 80ms (`ease-out`, decai). Não a tela toda (enjoa) — só o editor, comunicando "erro aqui".
- **Háptico (mobile):** `navigator.vibrate(15)` no erro (se suportado e não silenciado).
- O combo quebra (§IV.4).

### Performance & acessibilidade
Shake via `transform` (GPU). **Reduced-motion:** sem shake — o erro vira um flash de cor + ícone na margem da linha (sem movimento). Fotossensibilidade: nada pisca > 3Hz. Som é opt-out separado. O erro **nunca** é comunicado só por cor (cor + fundo + posição + som + opcional háptico).

## IV.4 Combo / Streak / Multiplicador 🔴 (o motor de tensão risco-recompensa)

### Conceito
Caracteres corretos consecutivos formam um **combo**. Quanto maior, mais recompensa visual/sonora e maior o **multiplicador de score** (um score além do WPM puro). **Um erro zera o combo.** Isso cria a tensão central: ir rápido demais arrisca o combo; precisão o sustenta. Dá objetivo a *cada tecla*.

### Regras
- `combo` = nº de chars corretos seguidos (reseta a 0 no erro).
- **Milestones:** 25, 50, 100, 200... → "flare" visual + `combo.milestone` (acorde sobe) + o número do combo "pega fogo" (glow intensifica, cor migra green→cyan→violet→amber conforme escala).
- **Multiplicador:** `mult = 1 + floor(combo/25) * 0.25` (cap em ex. 3×). Alimenta um **score** = Σ(valor do char × mult no momento). Exibido junto às stats.
- **Quebra:** erro → combo 0, `combo.break` (descida curta), o contador "estilhaça" (shatter, partículas caem) e o multiplicador volta a 1×. A perda é *sentida*.

### Visual
- Contador "x37" perto do input, em `tabular-nums`, escala de tamanho/calor com o valor (`spring-bouncy` em cada incremento de milestone).
- Em combos altos, um leve aura/glow envolve o editor — feedback periférico de "você está on fire".

### Por que isso eleva o jogo
Transforma um teste de digitação linear num **loop de decisão contínuo**. É o tipo de sistema que faz o competitivo jogar "só mais uma". E é justo: recompensa precisão sob velocidade — exatamente a skill que o jogo mede.

### Reduced-motion / acessibilidade
Sem partículas/shatter — o contador troca de valor e cor sem movimento. Som comunica o milestone. Score sempre legível.

## IV.5 Live WPM sparkline 🟠

Mini-gráfico (largura das stats, ~48px alt) que **desenha o WPM ao longo do tempo** enquanto você digita. Canvas leve ou SVG path com draw incremental. Dá leitura de ritmo ("comecei forte, caí") e fica lindo. Linha com gradiente neon, área sob a curva a 10% alpha, ponto atual pulsando. Reduced-motion: atualiza sem animar o traço. Atualiza no mesmo tick do heartbeat já existente (`Race.tsx:68`, 1s) + on-type.

## IV.6 Racer & pista redesenhada 🟠

### O problema
A pista (`RaceTrack.tsx`) é uma barra de progresso com um emoji 🚀 estático e um marcador. Funciona, mas está a anos-luz de "corrida".

### Spec — racer
- Trocar 🚀 por um **racer SVG/sprite** na cor do jogador (carro/cápsula/nave estilizada — algo coerente com o tema "code"). 
- **Trail de motion:** rastro que se alonga com a velocidade (WPM) — partículas/gradiente atrás do racer.
- **Idle bob:** parado/lento, flutua sutil (y ±2px). Acelerando, inclina pra frente.
- **Lurch na largada:** no "GO!", todos dão um arranque (scale + shake + trail burst).
- **Overtake:** ao mudar de posição, o racer faz um "whoosh" lateral (swoosh + `race.overtake` com timbre distinto se foi *você* passando vs. sendo passado) e sua **lane** reordena com `spring-smooth` — a troca de posição é *visível e sentida*, não um número que muda.
- **Finish:** ao cruzar, faíscas + a linha de chegada quadriculada acende + medal estampa na lane.

### Spec — pista
- Lanes com profundidade (leve perspectiva ou divisórias claras), grid sutil (mantém o spirit do atual `RaceTrack.tsx:61`), linha de chegada **quadriculada animada** (não um traço fino).
- Ordenação por progresso (mantém — leader no topo), mas com transição de reordenação suave (`spring-smooth`) quando posições trocam.
- **Você** sempre destacado (peso, glow na sua lane).
- Contador "X/Y terminaram" (mantém) com count-up.

### Performance
SVG/CSS, sem WebGL (regra de ouro). Trails via `transform`/opacity. Em mobile, simplificar (menos partículas). Reduced-motion: racers reposicionam sem trail/whoosh; barra ainda anima suave.

## IV.7 Nitro / modo velocidade 🔴 (o pico de adrenalina)

### Conceito
Quando o WPM instantâneo cruza um **limiar** (ex.: > 1.3× a média do jogador, ou > 80 WPM), entra o **modo nitro**: o jogo inteiro comunica velocidade.

### Spec
- **Bordas do editor:** speed-lines (canvas leve, **não** three.js por padrão) correm para trás — sensação de túnel de vento. 
- **Racer:** ganha boost trail + leve aumento de escala.
- **Som:** `nitro.enter` (whoosh + sub-bass) → `nitro.loop` (drone) enquanto sustenta → `nitro.exit` ao cair.
- **Cor:** acento migra para cyan/violet (energia), o glow do progresso intensifica.
- **Opção premium:** em desktop potente (perf-gate), o background pode brevemente puxar **Hyperspeed** (three.js, lazy chunk) — mas **fora do editor** e só se o budget permitir. Por padrão, speed-lines canvas.
- **Quebra:** erro durante nitro quebra o combo **e** o nitro (sai com `nitro.exit`) — reforça a tensão risco-recompensa (§IV.4).

### Guardrail (regra de ouro)
As speed-lines vivem nas **bordas/fundo do card do editor**, nunca sobre o texto. Performance gated: se FPS cair < 55, o nitro reduz para só som + glow (sem speed-lines). Reduced-motion: nitro = só som + mudança de cor, sem linhas/movimento.

## IV.8 Anti-distração (a contrapartida madura)

Todo o juice acima serve à imersão — mas **durante a leitura/digitação ativa**, nada pode roubar foco do código. Princípios:
- Efeitos de combo/nitro vivem na **periferia** (bordas, cantos, sidebar), nunca sobre o snippet.
- Partículas são **sutis e efêmeras**; densidade cai se o FPS cair.
- O usuário pode baixar a intensidade de efeitos num toggle ("efeitos: completo / reduzido / mínimo") — respeito a quem quer só competir.
- Tudo desligável via reduced-motion + mute. O jogo continua **100% jogável e justo** sem nenhum efeito.

## IV.9 Resumo de impacto (priorização interna do feel)

| Sistema | Impacto no feel | Esforço | Risco de latência | Prioridade |
|---------|:---------------:|:-------:|:-----------------:|:----------:|
| Syntax highlighting (IV.1) | 🔴 Altíssimo | Médio | Baixo (pré-tokeniza) | **1** |
| Som (I.4 / IV.3) | 🔴 Altíssimo | Médio | Nenhum | **1** |
| Caret animado (IV.2) | 🟠 Alto | Baixo | Nenhum | **2** |
| Keystroke fx (IV.3) | 🔴 Alto | Baixo | Baixo | **2** |
| Combo/Nitro (IV.4/IV.7) | 🔴 Alto | Médio | Médio (gated) | **3** |
| WPM sparkline (IV.5) | 🟠 Médio | Baixo | Nenhum | **3** |
| Racer/pista (IV.6) | 🟠 Médio | Médio | Baixo | **4** |

---

# PARTE V — Features & Progressão (retenção)

> Um jogo AAA dá **motivo para voltar**. Já temos auth Google (`useAuth`) + Supabase — a base de persistência está pronta. Estas features estão alinhadas com o roadmap que o próprio README já declara (modo solo/ghost, code-review, mais snippets).

## V.1 Sistema de som (pré-requisito de tudo) 🔴
Já especificado em §I.4. Reforço: **sem som, nenhuma feature de feel chega a AAA**. É a primeira coisa a construir na trilha de feel. `lib/sound.ts` + sprites de áudio + toggle.

## V.2 Progressão: XP, níveis & ranks 🟠

### Conceito
Cada corrida rende XP; XP sobe níveis; níveis (e performance) definem o **rank** competitivo. Dá sensação de crescimento e status.

### Fórmula (proposta — ajustável)
```
XP_da_corrida = round( WPM × (precisão/100)² × fator_posição × fator_dificuldade )
  fator_posição: 1º=1.5 · 2º=1.2 · 3º=1.1 · resto=1.0
  fator_dificuldade: easy=1.0 · medium=1.3 · hard=1.7
nível: curva suave (ex.: XP_total para nível n = 100 · n^1.5)
```
A precisão ao quadrado **premia jogar limpo** — coerente com a alma do jogo.

### Ranks (tiers visuais)
`Bronze → Prata → Ouro → Platina → Diamante → Code Master`. Cada um com cor/moldura própria (Diamante cyan-brilhante, Code Master com efeito especial). O rank aparece no lobby, na pista, no results e no leaderboard. Subir de rank é um **momento** (animação dedicada + `achievement.unlock`).

### UX
Barra de XP no perfil + no fim da corrida (a barra enche com CountUp, e se subir de nível, "LEVEL UP" com `ease-back-out` + som). Rank-up com tela/badge especial.

## V.3 Conquistas / Achievements 🟠

Coleção de badges desbloqueáveis — o tipo de meta que faz o competitivo caçar. Exemplos:

| Badge | Condição | Raridade |
|-------|----------|----------|
| 🩸 First Blood | 1ª vitória | comum |
| ⚡ Century | 100+ WPM numa corrida | incomum |
| 🎯 Flawless | 100% de precisão | incomum |
| 🔥 Streak Demon | combo de 100+ | raro |
| 🐢 Comeback | vencer estando em último na metade | raro |
| 🌐 Polyglot | vencer em 5 linguagens diferentes | raro |
| 💎 Code Master | atingir o rank máximo | épico |
| 🌙 Night Owl | jogar às 3h da manhã | secreto |
| 🏎️ Nitro Junkie | sustentar nitro por 30s | incomum |

**UX:** desbloqueio in-game = toast especial (`achievement.unlock` + badge com `ease-back-out`) sem interromper a corrida. Coleção no perfil (§III.9). Badges secretos aparecem como "???" até desbloquear — devs adoram caçar easter eggs.

## V.4 Perfil / Dashboard 🟠
Tela especificada em §III.9. Motor de retenção + SEO (página por jogador). Depende de V.2/V.3 para conteúdo.

## V.5 Practice / Solo mode 🟠

### Por quê
Resolve três coisas de uma vez: **onboarding** (treinar sem precisar de sala/amigos), **conteúdo solo** (jogar sozinho a qualquer hora) e **SEO** (uma landing jogável, indexável). Reusa ~90% do `Race`.

### Modos
- **Treino livre:** escolhe linguagem/dificuldade, corre sozinho, vê stats. Sem pressão.
- **Contra seu ghost (PB):** um "fantasma" replica seu melhor resultado na pista — você corre contra si mesmo. Profundamente viciante e tecnicamente elegante (replay = sequência de timestamps de progresso, leve de armazenar).
- **Contra bots:** WPM-alvo configurável (40/60/80/100) — bom para iniciantes terem com quem competir.

### UX
Acessível direto da home ("treinar →") sem criar sala. Reduz a barreira de "preciso de gente para jogar".

## V.6 Daily Challenge 🟡

Snippet do dia **seeded por data** (todos pegam o mesmo, determinístico — `id` do snippet derivado da data). Leaderboard exclusivo do dia. Cria **hábito diário** (a mecânica de retenção mais forte que existe). Fácil sobre a infra atual. Badge de "streak diário" (jogou N dias seguidos).

## V.7 Emotes / Reações ao vivo 🟡

Durante a corrida, reações rápidas (👏🔥😂🧊💀) que **flutuam sobre o racer/avatar** do emissor (sobem e somem, 1.5s). Via broadcast (canal já existe — `useRoom.ts`). Atalhos de teclado (1-5) ou um mini-menu. Social, divertido, e **não atrapalha** (vivem na pista/periferia, não sobre o código). Cooldown anti-spam.

## V.8 Spectator mode 🟡

Hoje quem chega durante a corrida é **barrado** (`HomeView.tsx:101`). Permitir entrar como **espectador**: vê a pista e o código ao vivo (read-only), entra automaticamente na próxima corrida. Aproveita todo o realtime existente. Ótimo para grupos grandes e para "ver antes de jogar".

## V.9 Temas & Skins 🟡

- **Temas de cor:** Matrix (atual), Synthwave (rosa/roxo), Dracula, Nord, Solarized, Light (modo claro do README roadmap). Troca as CSS vars (§I.1) — por isso a tokenização é pré-requisito.
- **Skins de pista/racer:** desbloqueáveis por nível/conquista.
- **Tema do syntax highlight** acompanha o tema global.
- **UX:** seletor no perfil/settings com preview ao vivo. Alto valor percebido, possível eixo de monetização futura (cosmético, não pay-to-win — devs respeitam isso).

## V.10 Modos especiais (do roadmap do README) 🟡

- **Code Review mode:** em vez de digitar, **corrigir bugs** no snippet (achar e consertar). Mecânica nova sobre a mesma base. Diferencial forte.
- **Chaos mode (opcional, opt-in):** modificadores divertidos (linha some depois de digitada, typo-bombs, blur progressivo). Só em salas "casual".

## V.11 Internacionalização & PWA 🟡
- **i18n:** o jogo já é PT-BR; estruturar para EN (o README já é bilíngue, há base). `next-intl`. Amplia alcance/SEO.
- **PWA/offline:** manifest já existe. Practice mode poderia funcionar offline (snippets locais). "Instalar no celular" já anunciado no README.

---

# PARTE VI — Engenharia & Qualidade

> "AAA" não é só verniz. Um jogo competitivo com leaderboard global precisa de uma base que sustente o crescimento. Tudo aqui é específico do CodeRacer, baseado em leitura do código atual.

## VI.12 Conteúdo de jogo: biblioteca de snippets

### Estado atual (medido)
`src/lib/snippets.ts` tem **30 snippets**, muito desiguais:

| Linguagem | easy | medium | hard | total |
|-----------|:----:|:------:|:----:|:-----:|
| JavaScript | 3 | 2 | 1 | 6 |
| TypeScript | 2 | 1 | 1 | 4 |
| Python | 2 | 2 | 1 | 5 |
| Java | 1 | 1 | 1 | 3 |
| C# | 1 | 1 | 1 | 3 |
| C++ | 1 | 1 | 1 | 3 |
| Go | 1 | 1 | 1 | 3 |
| Rust | 1 | 1 | 1 | 3 |

🔴 **19 dos 24 buckets têm um único snippet.** `pickSnippet` (`snippets.ts:507`) sorteia random → ~79% das combinações entregam **sempre o mesmo código**. Isso mata a replayability — o motor do jogo. Para um público que rejoga para subir no ranking, é o gargalo nº1 de conteúdo.

### Metas
- **Curto prazo:** ≥ 8 por bucket (~192 snippets). Nenhum bucket < 5.
- **Médio:** 12–15 por bucket + novas linguagens.
- **Paridade** entre linguagens (não deixar JS rico e Rust pobre).

### Estrutura de dados (evoluir `SnippetSeed`)
```ts
interface SnippetSeed {
  id: string;          // estável — daily seed, anti-repetição, analytics
  title: string;
  code: string;
  tags?: string[];     // "recursion","async","data-structures","regex"
  chars?: number;      // derivado — validação/estimativa de duração
  author?: string;     // atribuição de PRs
}
```
Habilita filtros (§III.8), daily challenge (§V.6), packs temáticos e analytics (quais snippets são mais odiados/difíceis).

### Anti-repetição
`pickSnippet` deve evitar repetir os últimos N da sala (passar histórico ou usar `start_at`/round como seed). Mudança pequena, impacto percebido grande.

### Guidelines de qualidade para digitação (viram teste automatizado — §VI.14)
- **Sem tabs** (espaços consistentes — tabs quebram a contagem char-a-char).
- **Sem trailing whitespace, sem `\r`** (line endings `\n`) — atrapalham o match exato.
- **Comprimento por dificuldade:** easy ~120–280 chars · medium ~300–650 · hard ~650–1300. Consistência faz a dificuldade significar algo.
- **Código real, idiomático e digitável** (já é o caso — manter).
- **Título único** por bucket. **Compila/faz sentido** (é código de verdade).

### Expansão
- **Novas linguagens** (encaixam em `LANGUAGES`+`SNIPPETS`): SQL, HTML/CSS, Bash, PHP, Ruby, Kotlin, Swift, Lua.
- **Packs temáticos** (via `tags`): algoritmos clássicos, one-liners, estruturas de dados, regex, APIs/HTTP.
- **Escala com qualidade:** curadoria + PRs da comunidade (o README já convida) formalizados em `CONTRIBUTING.md` com as guidelines acima, e o **teste de validação barra PR ruim automaticamente**. Geração assistida sempre com revisão humana (licença/atribuição limpa).

## VI.13 Qualidade de código & integridade

### Pontos fortes atuais (manter)
- `tsconfig` com **`strict: true`** ✅ (`tsconfig.json:7`).
- **README forte e bilíngue** ✅ (documenta env, arquitetura, WPM, deploy).
- `.env.example` presente ✅, `reactStrictMode: true` ✅, `poweredByHeader: false` ✅.

### 🔴 Integridade / anti-cheat (o mais importante para um ranking)
**O leaderboard global é forjável.** No `finish` (`api/rooms/[code]/route.ts:67`) o servidor grava `body.results` (WPM/precisão/erros) **exatamente como o cliente mandou**, sem validar. O progresso por tecla viaja por broadcast P2P (`useRoom.ts:341`) — o servidor nunca vê a digitação real. Um cliente alterado submete `9999 WPM` e contamina `/leaderboard`.

**Mitigações (confiança total é impossível em broadcast; meta = plausibilidade server-side):**
- Validar/clampar no `finish`: `accuracy ∈ [0,100]`, `progress ≤ 1`, `errors ≥ 0`, `wpm ≤ TETO` (ex. 300).
- **Coerência temporal:** o servidor conhece `start_at` e o tamanho do `snippet`. Rejeitar/sinalizar o impossível (terminar 800 chars em 2s → ~480 WPM).
- **Separar "ranqueado" de "casual":** só partidas validadas entram no leaderboard global.
- zod (abaixo) cobre o shape; a plausibilidade é regra de negócio testável (§VI.14).

> Nota de honestidade: anti-cheat perfeito num jogo client-authoritative é inviável. A meta é **elevar o custo da trapaça** e manter o ranking *plausível* — suficiente para credibilidade.

### Validação de input (zod)
Rotas usam `body as any` (`route.ts:18`, `[code]/route.ts:28`) e `(error as any).code`. Schemas **zod** para `create/settings/start/finish/claim-leader`: rejeitam payload malformado cedo, com erro claro, e eliminam os `any`. Habilita o anti-cheat acima.

### `claim-leader` sem autorização
`claim-leader` (`[code]/route.ts:89`) aceita qualquer `playerId` e troca a liderança sem verificar se o líder saiu (o comentário admite confiar no cliente). Baixo risco (trolagem), mas restringir a quem está presente + logar. Dívida de segurança conhecida.

### Rate limiting
`POST /api/rooms` e as ações não têm limite → spam de salas. Rate limit (Upstash Redis / Vercel KV) por IP/sessão antes de divulgar publicamente.

### Débito técnico & consistência
- **`lib/types.ts` deprecado mas ainda importado** (Race, Results, RaceTrack...). Consolidar com `lib/room.ts` (uma fonte de verdade).
- **Springs hardcoded divergentes** → unificar em `lib/motion.ts` (§I.3).
- **ESLint sem config explícita na raiz** (não há `.eslintrc*`) e **não roda no CI**. Estabelecer config (`next/core-web-vitals` + `jsx-a11y` + `import/order` + `react-hooks/exhaustive-deps`) e rodar no CI. Vários `useEffect` em `useRoom.ts` têm deps sensíveis que `exhaustive-deps` ajudaria a auditar.
- **Inconsistência de doc:** README diz "salas vivem em memória (reiniciou, sumiram)" (`README.md:51`), mas a arquitetura usa a tabela durável `rooms` no Supabase — resquício da era pré-Supabase (Socket.io). Corrigir.

## VI.14 Estratégia de testes

**Hoje: zero testes, nenhum runner.** Clean slate. Stack: **Vitest** (unit/integração) + **React Testing Library** (componentes) + **Playwright** (E2E multiplayer).

### Refactor habilitador (faça primeiro)
A lógica mais valiosa está presa em componentes/hooks. Extrair para `lib/` puro torna tudo testável sem render — e melhora a arquitetura:
- WPM/precisão/progresso → `lib/scoring.ts` (hoje inline em `Race.tsx:49`).
- Eleição de líder + atribuição de `place` → `lib/roster.ts` (hoje em `useRoom.ts:255` e `:295`).
- Plausibilidade anti-cheat → `lib/scoring.ts` (testável isoladamente).

### Pirâmide aplicada
**Unit (base, maior ROI):**
| Alvo | Validar | Origem |
|------|---------|--------|
| `pickSnippet` | normalização (`ts→typescript`, `c++→cpp`), fallback de diff/lang, shape | `snippets.ts:490` |
| `colorForId` | determinismo; estável na paleta | `room.ts:99` |
| **scoring** (extraído) | WPM=(corretos/5)/min; acc=1−err/teclas; 0 teclas→100%; tempo 0; clamp | `Race.tsx:49` |
| **anti-cheat** (novo) | clamps + coerência tamanho×tempo | §VI.13 |
| **eleição/place** (extraído) | ordena por `joinedAt`, desempata por `id`; finishers por `finishedAt` | `useRoom.ts:255/295` |
| utils | `formatMs`, `ordinal`, `medal`, `cn` | `utils.ts` |
| **validação de snippets** (data-driven) | TODOS: sem tab/`\r`/trailing ws; tamanho por diff; título único; não vazio | §VI.12 |
| **combo/score** (novo) | incremento, reset no erro, multiplicador, milestones | §IV.4 |

**Component (RTL):** `CodeDisplay` (estados done/erro/atual + camada de syntax) · `Countdown` (render por n) · `RaceTrack` (ordena por progress) · `Toast`/`Modal` (abre/fecha, Escape, focus-trap, auto-dismiss) · caret (posição correta).

**Integração (API — Vitest + Supabase mock):** máquina de estados `create→settings→start→finish→reset`; autorização (não-líder 403); `settings` fora do lobby (409); 404/400; **transição condicional `racing→finished`** (só 1º persiste — `route.ts:70`); retry de colisão `23505` (`rooms/route.ts:28`); `persistMatch` grava match+scores; **validação anti-cheat rejeita resultado impossível**.

**E2E (Playwright):** 2 contextos de browser → criar → entrar por código → líder inicia → countdown (derivado de `start_at`) → ambos digitam → pódio. Validar: paste off, backspace não pontua, saída do líder → eleição, reconexão. `scripts/realtime-test.mjs` é ponto de partida. Requer projeto Supabase de teste (ou stub do canal).

**Visual regression (opcional):** Playwright screenshots das telas-chave — pega regressão de UI nos efeitos novos.

### Metas
~90%+ em `lib/` puro; smoke nos componentes-chave; 1 E2E feliz + 2 de borda. Unit/integração em todo PR; E2E em PR ou nightly.

## VI.15 CI/CD

### Atual
`.github/workflows/ci.yml`: um job → `install (frozen) → typecheck → build`, em push/PR para `main`. Sólido mas incompleto: **não roda lint** (o script existe!), não roda teste, sem guardrails de perf/bundle, sem security.

### Pipeline-alvo
| # | Job | Por quê | Novo? |
|---|-----|---------|:-----:|
| 1 | **Lint & format** (`pnpm lint` + `prettier --check`) | lint existe mas **não roda no CI** | 🆕 |
| 2 | **Typecheck** | já existe | ✅ |
| 3 | **Unit + integração** (Vitest + coverage) | rede de segurança (§VI.14) | 🆕 |
| 4 | **Build** | valida bundle/SSR | ✅ |
| 5 | **E2E** (Playwright, browsers cacheados, trace em falha) | fluxo multiplayer | 🆕 |
| 6 | **Lighthouse CI / Web Vitals budget** | guardrail automático contra efeitos pesados (§I.8) — falha se LCP/INP/CLS regredir | 🆕 |
| 7 | **size-limit / bundle check** | impede `three.js` vazar pro bundle crítico (§II.2) | 🆕 |
| 8 | **a11y** (axe nos componentes-chave) | acessibilidade como gate | 🆕 |
| 9 | **Security** (Dependabot + `pnpm audit` + CodeQL) | higiene/SAST | 🆕 |

Com **caching** (pnpm store, browsers Playwright, build cache Next). Jobs 1–4 em todo PR; 5–8 gated/nightly se necessário por custo.

### CD & releases
- **Vercel preview por PR** (provavelmente já ativo) + comentário com URL e (opcional) score Lighthouse. Formalizar.
- **Migrations:** `scripts/migrate.mjs` + `supabase/migrations/*` (já há `0001_init`, `0002_realtime_rooms`). Automatizar **gated e não-destrutivo** (job manual em prod). Documentar ordem/idempotência.
- **Branch protection:** CI verde + 1 review para merge em `main`. Commits convencionais (commitlint) opcional → changelog.
- **Ambientes:** Supabase/secrets separados para preview vs. produção.

## VI.16 Observabilidade & operações
- **Error tracking (Sentry)** — client + server/edge. Hoje só `console.warn` (`route.ts:136`, `supabase.ts:57`). Essencial em multiplayer.
- **Analytics de produto** (Vercel Analytics / PostHog) — funil criar→entrar→correr→terminar, retenção, eventos de jogo (WPM médio, langs/snippets populares) para guiar conteúdo com dados.
- **Web Vitals reais (RUM)** — monitorar LCP/INP/CLS em produção; crítico dado o foco em efeitos.
- **Rate limiting & anti-abuso** (§VI.13).
- **Uptime/healthcheck** — ping na home + Supabase.

## VI.17 Documentação & DX
- **README:** já forte. Adicionar seção de **testes** e **guidelines de snippet** (§VI.12); **corrigir** a inconsistência "salas em memória" (`README.md:51`).
- **`CONTRIBUTING.md`:** extrair/expandir do README; formalizar o fluxo de adicionar snippet (que o teste valida).
- **`ARCHITECTURE.md` / ADRs:** decisões-chave (por que Supabase Realtime vs. Socket.io — já no histórico git; documentar o porquê), modelo de dados, máquina de estados.
- **Docs de jogo:** regras de WPM/score/ranks/achievements.
- **DX:** scripts pnpm (`test`, `test:e2e`, `lint:fix`, `format`); **pre-commit hooks** (husky + lint-staged) rodando lint/format/typecheck antes do commit.

## VI.18 Engenharia de performance (transversal)
Liga aos budgets de §I.8 — como cumpri-los:
- **Code-splitting:** efeitos WebGL via `next/dynamic ssr:false` + `Suspense`. `three.js` só em chunks sob demanda (nitro, pódio).
- **Perf-mode** (auto: `prefers-reduced-motion` + `deviceMemory` + `saveData`) desliga backgrounds pesados → gradiente estático.
- **RAF discipline:** backgrounds pausam em `visibilitychange` (aba oculta) e degradam FPS se necessário.
- **Render do editor:** memoização por token, atualização só dos índices alterados (§IV.1) — o hot-path mais sensível.
- **`content-visibility`** em listas longas (leaderboard, histórico).
- **`will-change` cirúrgico** (só no caret/racer durante movimento, removido depois) — nunca global.
- **Medição contínua:** Lighthouse CI + size-limit no pipeline (§VI.15) + RUM em prod (§VI.16). O que não é medido, regride.

---

# PARTE VII — Roadmap, sequência & métricas

## VII.1 Trilha de Experiência/UI (faseada)

| Fase | Entrega | Impacto | Risco | Dependências |
|------|---------|:-------:|:-----:|--------------|
| **0 — Fundações** | Design tokens + `lib/motion.ts` + tema em CSS vars + `lib/sound.ts` (scaffold) + perf-mode + extrair primitivas (`Button`/`Card`/`Stat`) + setup React Bits | 🔧 habilitador | Baixo | — |
| **1 — Identidade** | Home/Title (LetterGlitch, decrypt logo, MagicBento, StarBorder, Crosshair) + NameGate + transições de rota + Toast/Modal polish | 🟢 alto/uau | Baixo | Fase 0 |
| **2 — Feel da corrida** | Som completo + **syntax highlighting** + caret animado + keystroke fx + combo/nitro + sparkline + racer/pista + CountUp nas stats | 🔴 core AAA | Médio | Fase 0; EngFase A |
| **3 — Momentos** | Countdown cinematográfico + Results/pódio (confete, CountUp, share card) + Leaderboard com brilho | 🟠 clímax | Baixo | Fases 1–2 |
| **4 — Progressão** | XP/níveis/ranks + achievements + perfil + practice/ghost | 🟠 retenção | Médio | Persistência; EngFase B |
| **5 — Social** | Daily challenge + emotes + spectator + temas/skins + i18n | 🟡 profundidade | Baixo | Fases anteriores |

## VII.2 Trilha de Engenharia (paralela)

| EngFase | Entrega | Pré-requisito de |
|---------|---------|------------------|
| **A — Rede de segurança** | Vitest + extrair `lib/scoring.ts`/`lib/roster.ts` + testes da lógica pura + teste de validação de snippets + **lint+test no CI** + config ESLint + seção de testes no README | refatorar UI com segurança (Fases 1–2) |
| **B — Conteúdo & integridade** | snippets ≥8/bucket (+ anti-repetição + metadados) + zod nas rotas + **anti-cheat no `finish`** + rate limiting | leaderboard confiável (Fase 4) |
| **C — Qualidade contínua** | Prettier + pre-commit + **E2E Playwright** + **Lighthouse CI + size-limit** + Sentry + analytics | proteger budgets de perf dos efeitos (Fase 2–3) |
| **D — Escala & ops** | novas linguagens + packs + daily seed + CodeQL/Dependabot + migrations automatizadas + ADRs | escala sustentável (Fase 5) |

## VII.3 Sequência unificada recomendada

> As duas trilhas se entrelaçam. A regra: **rede de testes antes de refatorar; guardrails de perf antes de escalar efeitos.**

| Etapa | Experiência | Engenharia | Racional |
|:-----:|-------------|------------|----------|
| **1** | — | **EngFase A** | Rede de segurança antes de mexer |
| **2** | **Fase 0** (fundações) | — | Habilitadores consistentes |
| **3** | **Fase 1** (Home) + POC feel | **EngFase B** (conteúdo + anti-cheat) | "Uau" visual + integridade em paralelo |
| **4** | **Fase 2** (feel da corrida) | **EngFase C** (E2E + guardrails perf + Sentry) | Core AAA com perf vigiada |
| **5** | **Fase 3** (momentos) | — | Picos emocionais |
| **6** | **Fase 4** (progressão) | **EngFase D** (escala + ops) | Retenção + sustentabilidade |
| **7** | **Fase 5** (social) | — | Profundidade contínua |

## VII.4 Métricas de sucesso (definition of "AAA pronto")

**Experiência (qualitativo + observável):**
- [ ] A home comunica "jogo de verdade" em < 3s (teste com 5 devs que nunca viram).
- [ ] Digitar dá dopamina: som + caret vivo + combo + partícula a cada tecla.
- [ ] Código com syntax highlighting correto por linguagem, legível sob pressão.
- [ ] Largada e vitória têm clímax (countdown tenso, confete/fanfarra).
- [ ] A pista parece corrida (racer + ultrapassagem visível), não barra de progresso.
- [ ] Há motivo para voltar (rank/XP/daily/achievements/ghost).
- [ ] Mobile jogável e gostoso.

**Performance (medido — falha o CI se regredir):**
- [ ] 60fps sustentado na corrida (hardware médio); latência tecla→pixel < 16ms.
- [ ] LCP < 2.0s · INP < 200ms · CLS < 0.05.
- [ ] Bundle inicial < 180KB gzip; `three.js` ausente do chunk crítico.

**Qualidade (objetivo):**
- [ ] Cobertura ≥ 90% em `lib/` puro; E2E do fluxo multiplayer verde.
- [ ] CI roda lint + test + build + perf budget + a11y.
- [ ] Leaderboard com validação anti-cheat (resultado impossível é rejeitado).
- [ ] ≥ 8 snippets por bucket; teste de validação de conteúdo passando.

**Respeito ao usuário (binário):**
- [ ] 100% jogável e justo com motion zero + som mudo.
- [ ] `prefers-reduced-motion` honrado em cada efeito; sem flash > 3Hz.
- [ ] Teclado 100%; foco gerenciado; WCAG AA.

## VII.5 Próximos passos imediatos
1. **Validar este documento** e ajustar prioridades ao tempo disponível.
2. **EngFase A, passo 1:** Vitest + extrair `lib/scoring.ts`/`lib/roster.ts` + primeiros testes + lint/test no CI. *Fundação que destrava a refatoração.*
3. **POC dupla em paralelo:** (a) Home AAA (Fase 1) valida a tese de identidade; (b) slice de feel (caret + som de tecla + syntax highlight num branch) valida a tese de juice. As duas POCs provam as teses centrais antes do investimento maior.
4. **Encher 1 bucket de snippet** (ex.: Rust hard → 8) + o **teste de validação** — prova o fluxo de conteúdo ponta a ponta.

> As trilhas se reforçam: a EngFase A dá confiança para o redesign; os guardrails da EngFase C protegem as metas de performance dos efeitos AAA. Fazer só uma deixa o "AAA" pela metade — ou bonito e frágil, ou sólido e sem graça.

---

# APÊNDICES

## Apêndice A — Tabela mestra de animações

> Referência rápida de cada animação proposta. Valores são ponto de partida, afináveis na implementação.

| # | Animação | Tela | Gatilho | Duração | Curva/Spring | Reduced-motion |
|---|----------|------|---------|--------:|--------------|----------------|
| A1 | Logo decrypt | Home | load | 800 | `ease-out-expo` | valor final imediato |
| A2 | Tagline split | Home | load+150 | stagger 40 | `ease-out-expo` | fade simples |
| A3 | Painel reveal | Home | load+1000 | 400 | `ease-out-expo` | fade |
| A4 | Spotlight follow | Home/cards | mousemove | lerp 0.1 | — | estático |
| A5 | StarBorder spin | botões CTA | contínuo | ~3s loop | linear | estático |
| A6 | ClickSpark | botões | click | 400 | `ease-out-quad` | sem partícula |
| A7 | Modal in | modais | open | 400 | `ease-out-expo` | fade |
| A8 | Countdown number | Countdown | por tick | 400/250 | `ease-back-out` | cross-fade 120 |
| A9 | Countdown shake | Countdown | 2/1/GO | 80 | decay | removido |
| A10 | GO flash | Countdown | GO | 80 | — | mudança de cor |
| A11 | Caret slide | Race | char move | spring | `spring-caret` 700/40 | reposiciona sem tween |
| A12 | Caret blink | Race | idle>500ms | 1s loop | senoidal | opcional |
| A13 | Keystroke flash | Race | acerto | 100 | `ease-out` | sem (ou flash cor) |
| A14 | Error shake | Race | erro | 80 | decay | flash + ícone |
| A15 | Combo tick | Race | milestone | spring | `spring-bouncy` | troca valor/cor |
| A16 | Combo shatter | Race | quebra | 400 | `ease-in-quad` | sem partícula |
| A17 | Nitro speed-lines | Race | WPM>limiar | loop | linear | só cor/som |
| A18 | Racer overtake | Race | troca posição | spring | `spring-smooth` | reposiciona |
| A19 | Progress bar | Race | progresso | spring | `spring-gentle` 120/22 | anima suave |
| A20 | WPM count-up | Race/Results | mudança | 200/800 | `ease-out-quad` | imediato |
| A21 | Podium rise | Results | reveal | 400–700 | `ease-out-expo` stagger 150 | fade |
| A22 | Confetti | Results | 1º lugar | 2.5s | gravidade | removido |
| A23 | Crown drop | Results | 1º lugar | spring | `spring-bouncy` | estático |
| A24 | Badge unlock | Results/toast | conquista | spring | `spring-bouncy` | fade |
| A25 | List stagger | Chat/Lobby/LB | item novo | 40/item | `ease-out-quad` | fade |
| A26 | Toast in + progress | global | push | spring | `spring-snappy` | fade |
| A27 | Player join pop | Lobby | join | spring | `spring-bouncy` | fade |
| A28 | Route transition | global | navegação | 250 | `ease-in-out-quart` | cross-fade |

## Apêndice B — Tabela mestra de sons
Ver §I.4.2 (catálogo completo). Resumo de buses: **ui** (hover/click/back/toggle/toast), **game** (join/leave/countdown/key/error/combo/nitro/overtake/finish/win/achievement), **music** (ambient com ducking). Todos opt-out via mute (tecla `M`), volume persistido, sem autoplay.

## Apêndice C — Tokens (resumo)
- **Cor:** §I.1.1 (11 tokens base + 8 player colors).
- **Tipografia:** §I.2.1 (10 níveis de escala; `tabular-nums` em números vivos).
- **Movimento:** §I.3 (5 easings, 6 durações, 5 springs).
- **Elevação/glow:** §I.5. **Espaçamento/raio:** §I.6. **Z-index:** §I.1.4.

## Apêndice D — Atalhos de teclado (a definir/implementar)
| Tecla | Ação | Contexto |
|-------|------|----------|
| `Enter` | confirmar / criar / enviar | formulários, chat |
| `Esc` | fechar modal / voltar | modais, menus (não na corrida ativa) |
| `M` | mute/unmute | global |
| `?` | mostrar atalhos | global |
| `R` | pronto (ready-check) | lobby |
| `1`–`5` | emote rápido | corrida |
| `Tab` | navegar foco | global |
| `Ctrl/Cmd+Enter` | iniciar partida (líder) | lobby |

## Apêndice E — Inventário de componentes (atual → alvo)

| Componente | Arquivo | Mudança principal |
|------------|---------|-------------------|
| HomeView | `HomeView.tsx` | bg vivo, hero orquestrado, MagicBento, SpotlightCard, StarBorder, Crosshair |
| RoomView/NameGate | `RoomView.tsx` | transições, decrypt do código, social proof |
| Lobby | `Lobby.tsx` | bg Aurora, ready-check, feedback de settings remoto, AnimatedList |
| Countdown | `Countdown.tsx` | cinematográfico (shake, luz, som, lurch) |
| Race | `Race.tsx` | CountUp, sparkline, combo, layout mobile |
| CodeDisplay | `CodeDisplay.tsx` | **syntax highlighting** + caret animado |
| RaceTrack | `RaceTrack.tsx` | racer real, trail, overtake, pista com profundidade |
| Results | `Results.tsx` | confete, CountUp, share card, spotlight |
| Leaderboard | `leaderboard/page.tsx` | pódio top-3, filtros, hover spotlight, badges de rank |
| Chat | `Chat.tsx` | AnimatedList, polish |
| PlayerList | `PlayerList.tsx` | anel de rank, ready state |
| Modal/Toast | `ui/*` | focus-trap, ícones, barra de progresso |
| Logo | `Logo.tsx` | variante title-screen (decrypt/shiny) |
| MatrixRain | `MatrixRain.tsx` | → LetterGlitch/FaultyTerminal (ou coexistir) |
| **(novos)** | — | `lib/tokens.ts`, `lib/motion.ts`, `lib/sound.ts`, `lib/scoring.ts`, `lib/roster.ts`, `Button/Card/Stat/Badge`, Profile, Practice |

## Apêndice F — Glossário
- **Juice / game feel:** a camada de feedback (som, partícula, movimento) que torna a interação satisfatória sem mudar a mecânica.
- **Combo/streak:** acertos consecutivos; alimenta multiplicador de score.
- **Nitro:** modo de velocidade ativado por WPM alto.
- **Ghost:** replay do próprio PB para correr contra si mesmo.
- **Perf-gate:** condição (FPS/memória/save-data) que desliga efeitos pesados.
- **Ducking:** abaixar a música para destacar SFX.
- **Token:** valor de design reutilizável (cor, duração, easing).

---

<div align="center">

*Documento vivo. Cada decisão aqui serve a um princípio (§0.2) e a uma persona (§0.3). Quando em dúvida: performance e legibilidade ganham de espetáculo. Feito com esmero — porque programadores reparam.* 🏁

</div>






