<div align="center">

<img src="./docs/banner.png" alt="CodeRacer — corrida de digitação de código multiplayer" width="100%" />

# ⌨️ CodeRacer

### 🇧🇷 Corrida de digitação multiplayer para programadores — digite o código mais rápido e vença.
### 🇺🇸 Multiplayer typing race for programmers — type the code fastest and win.

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-14.2-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase Realtime](https://img.shields.io/badge/Supabase-Realtime-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-11-0055FF?style=for-the-badge&logo=framer&logoColor=white)](https://www.framer.com/motion/)

[![License: MIT](https://img.shields.io/badge/License-MIT-00ff88?style=flat-square)](#-licença--license)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-00e5ff?style=flat-square)](#-contribuindo--contributing)
[![Deploy on Vercel](https://img.shields.io/badge/deploy-Vercel-000?style=flat-square&logo=vercel&logoColor=white)](#-seo--deploy)
[![CI](https://img.shields.io/badge/CI-build-green?style=flat-square&logo=githubactions&logoColor=white)](./.github/workflows/ci.yml)

<br/>

**🇧🇷 [Português](#-português) · 🇺🇸 [English](#-english)**

```
> _ CodeRacer · sem cadastro · tempo real · só você, seu teclado e a glória
```

</div>

---

## 🇧🇷 Português
<a name="-português"></a>

> **TL;DR** — Abra uma sala, mande o link pros amigos e dispute, em tempo real, quem digita o
> snippet de código mais rápido (e com menos erro). **8 linguagens**, **WPM e precisão ao vivo**,
> **pódio**, **chat**, **placar global** (Supabase) e um visual *dark hacker* com chuva de Matrix.
> Sem login, sem firula.

### ⚡ O que é

**CodeRacer** é uma **corrida de digitação multiplayer feita para quem programa**. Em vez de
*"o rato roeu a roupa do rei"*, você digita código de verdade — um `debounce`, um `LRU cache`,
uma goroutine. Cada partida sorteia um snippet, dá o `3·2·1·GO!` e a pista enche de `🚀` correndo
em tempo real conforme cada um digita.

As **salas ao vivo vivem em memória** (reiniciou, sumiram), mas cada **partida terminada é salva no
Supabase** pra alimentar um **placar global** — dá pra ver quem é o dev mais rápido em
[`/leaderboard`](#-placar-global--supabase). Zero cadastro, zero atrito: é só criar e jogar.

### ✨ Recursos

| | Recurso | Detalhe |
|:--:|:--|:--|
| 🏁 | **Salas em tempo real** | Código de **6 letras** pra convidar — ou só mande o link. Até **30 jogadores**. |
| 💻 | **8 linguagens** | JavaScript, TypeScript, Python, Java, C#, C++, Go e Rust — em **fácil / médio / difícil**. |
| 📊 | **Métricas ao vivo** | **WPM**, **precisão**, **erros** e progresso por jogador, atualizados a cada tecla. |
| 🏆 | **Pódio** | Ouro/prata/bronze ao final + classificação completa com tempo. O líder reinicia a partida. |
| 🌍 | **Placar global** | Toda partida terminada é salva no **Supabase** — ranking de recorde de WPM por jogador em `/leaderboard`. |
| 💬 | **Chat na sala** | Provoque os amigos antes, durante e depois — com avisos do sistema (entrou, terminou, desistiu). |
| 🔑 | **Login com Google** *(opcional)* | Entre com o Google p/ usar seu **nome e avatar** — ou jogue como convidado, do mesmo jeito. |
| 🌧️ | **Visual dark hacker** | Tema neon, *grid* de fundo e **MatrixRain** opcional. Respeita `prefers-reduced-motion`. |
| 🚫 | **Anti-trapaça** | **Paste desabilitado** no input; backspace é permitido, mas só acerto *forward* conta. |
| 📱 | **PWA-ready** | Manifest, ícones e *theme-color* — dá pra "instalar" no celular. |

### 🕹️ Como jogar

1. Na home, escolha seu **nick**.
2. **Criar sala** → escolha **linguagem**, **dificuldade** e **máx. de jogadores**.
3. Compartilhe o **código de 6 letras** (ou o link da sala).
4. O líder clica em **Iniciar partida** → contagem `3 · 2 · 1 · GO!`.
5. **Digite!** Posição em tempo real no topo, suas stats embaixo (WPM, precisão, erros, progresso).
6. Quem termina vai pro **pódio**. O líder pode **jogar de novo** num clique.

> 💡 Abriu um link de sala sem nick? Sem prompt feio do navegador — uma tela estilizada pede seu
> nick antes de te jogar na corrida.

### 🚀 Rodando localmente

Pré-requisitos: **Node 18+** e **pnpm** (ou npm).

```bash
# 1. instale as dependências
pnpm install          # ou: npm install

# 2. configure o Supabase (copie .env.example → .env.local e preencha)
#    e crie as tabelas:
pnpm db:migrate

# 3. modo desenvolvimento
pnpm dev              # → http://localhost:3000

# 4. produção
pnpm build && pnpm start
```

Variáveis de ambiente (copie `.env.example` → `.env.local` — e replique na Vercel):

| Variável | Para quê |
|:--|:--|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase (cliente — usada pelo Realtime). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave **anon** do Supabase (cliente — Realtime). |
| `SUPABASE_URL` | URL do Supabase (servidor — API routes). |
| `SUPABASE_SERVICE_ROLE_KEY` | **Service role** (servidor — escreve salas/placar). **Nunca exponha no cliente.** |
| `DATABASE_URL` | Connection string do Postgres (usada por `pnpm db:migrate`). |
| `NEXT_PUBLIC_SITE_URL` | URL pública p/ SEO (canonical, Open Graph, sitemap). Sem barra no final. |

Scripts úteis: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm db:migrate`.

#### 🔬 Harness das telas pós-corrida (só em dev)

A tela de **Resultado/pódio** só aparece depois de uma corrida completa (lobby → countdown →
racing → finished), o que torna caro verificá-la no browser. Com `pnpm dev` rodando, abra
**http://localhost:3000/harness/results** para montá-la direto, com dados sintéticos:

| Cenário | URL | Para quê |
|:--|:--|:--|
| 0 jogadores | `?n=empty` | estado vazio (ninguém terminou) |
| 1 | `?n=solo` | resultado "herói" solo |
| 2 | `?n=duo` | pódio de 2 colunas |
| 3 | `?n=trio` | pódio completo (padrão) |
| 5 | `?n=crowd` | com desistentes na tabela |

Adicione `&leader=0` para ver a tela pelos olhos de quem **não** é líder. Os fixtures ficam em
`src/components/dev/results.fixtures.ts` e são tipados por `src/lib/types.ts`. **A rota não
existe em produção:** o gate é `NODE_ENV` (variável de build), então o `import()` do harness é
eliminado pelo webpack e `/harness/results` responde 404 no build de produção.

### 🧠 Como o WPM é calculado

Segue o **padrão da indústria** (igual a Monkeytype/TypeRacer):

```
WPM = (caracteres corretos / 5) / minutos decorridos
precisão = 1 − (erros / total de teclas) → em %
```

- Uma "palavra" = **5 caracteres** (convenção universal de testes de digitação).
- Backspace **não** conta como acerto (você pode corrigir, mas não ganha por isso).
- A precisão penaliza cada tecla errada digitada, mesmo que você corrija depois.

### 🏆 Placar global & Supabase
<a name="-placar-global--supabase"></a>

O **Supabase faz dois trabalhos** no CodeRacer: o **tempo real** (presence p/ o roster + broadcast
p/ progresso e chat) e a **persistência** (estado durável da sala + placar global). É ele que faz o
multiplayer rodar 100% na **Vercel**, sem servidor próprio.

**1. Variáveis** (em `.env.local`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...     # cliente (Realtime)
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...         # servidor — NUNCA exponha no cliente
DATABASE_URL=postgresql://postgres:SENHA@db.SEU_PROJETO.supabase.co:5432/postgres
```

**2. Crie as tabelas** (aplica os SQLs de `supabase/migrations/`):

```bash
pnpm db:migrate
```

Cria `rooms` (estado durável + Realtime habilitado), `matches`, `scores` e a view `leaderboard`,
com **RLS**: leitura pública, escrita só pelas **API routes** (service role). O progresso a cada
tecla viaja por **broadcast** (efêmero, não toca o banco) — só o resultado final é gravado.

**3. Login com Google** *(opcional)* — usa o **Supabase Auth** (a secret fica só no Supabase, nunca
no código):

- **Supabase → Authentication → Providers → Google:** ative e cole o **Client ID** e o
  **Client Secret** (do Google Cloud).
- **Supabase → Authentication → URL Configuration:** em *Redirect URLs*, adicione sua URL de
  produção (ex.: `https://code-racer-three.vercel.app/**`) e `http://localhost:3000/**`.
- **Google Cloud Console → Credentials → seu OAuth client:** em *Authorized redirect URIs*, adicione
  `https://SEU_PROJETO.supabase.co/auth/v1/callback`.

O app chama `signInWithOAuth({ provider: "google" })` (PKCE, client-side) — sem precisar de
nada além do **anon key**. Login é opcional: dá pra jogar como convidado.

### 🏗️ Arquitetura

**Sem servidor próprio.** O multiplayer roda em **Supabase Realtime** + **API routes serverless** —
por isso publica direto na **Vercel**:

- **Estado durável** (config/status/snippet/resultado) → tabela `rooms` + `postgres_changes`.
- **Roster** → **Presence** (entra/sai automático).
- **Progresso por tecla + chat** → **Broadcast** (efêmero, não toca o banco).
- **Mutações** (criar/iniciar/terminar/reset/settings) → **API routes** com service role. A contagem
  regressiva é derivada de `start_at` — sem timer no servidor.

```
.
├── supabase/migrations/          # schema SQL: rooms, matches, scores, view leaderboard
├── scripts/                      # pnpm db:migrate + realtime-test (teste e2e do multiplayer)
├── src/
│   ├── app/
│   │   ├── api/rooms/route.ts          # POST criar sala
│   │   ├── api/rooms/[code]/route.ts   # GET sala · POST ações (settings/start/finish/reset)
│   │   ├── layout.tsx            # metadata/SEO, next/font, JSON-LD, theme-color
│   │   ├── page.tsx · globals.css
│   │   ├── leaderboard/page.tsx  # ranking global (lê do Supabase)
│   │   ├── room/[id]/page.tsx    # sala (noindex + título dinâmico)
│   │   ├── opengraph-image.tsx   # card social 1200×630 gerado on-the-fly (edge)
│   │   ├── twitter-image.tsx · apple-icon.tsx
│   │   ├── robots.ts · sitemap.ts · manifest.ts
│   │   ├── not-found.tsx · error.tsx · loading.tsx · global-error.tsx
│   ├── components/
│   │   ├── HomeView · RoomView   # orquestram estados (NameGate, lobby, race, results)
│   │   ├── Lobby · Countdown · Race · Results
│   │   ├── RaceTrack (🚀) · CodeDisplay (char-by-char)
│   │   ├── Chat · PlayerList · Logo · MatrixRain
│   │   └── ui/ (Modal · Toast)
│   └── lib/
│       ├── useRoom.ts            # hook do tempo real (presence + broadcast + postgres_changes)
│       ├── supabase-browser.ts   # client anon (Realtime) · supabase.ts = leitura server-side
│       ├── room.ts · snippets.ts # tipos/constantes da sala · pool de snippets
│       ├── languages.ts · types.ts · utils.ts · site.ts (config SEO)
```

#### Fluxo de uma partida

```mermaid
sequenceDiagram
    participant L as Líder
    participant API as API routes (Vercel)
    participant DB as Supabase (rooms + Realtime)
    participant P as Jogadores
    L->>API: POST /api/rooms (criar)
    API->>DB: insert room
    P->>DB: subscribe canal (presence · broadcast · changes)
    L->>API: POST start
    API->>DB: status=racing, snippet, start_at
    DB-->>P: postgres_changes (racing)
    Note over P: countdown derivado de start_at
    loop a cada tecla
        P-->>P: broadcast progress (efêmero)
    end
    L->>API: POST finish {standings}
    API->>DB: status=finished + grava matches/scores
    DB-->>P: postgres_changes (finished) → pódio 🥇
```

#### Tempo real & API

**Canal `coderacer:room:{code}`** (Supabase Realtime):
- **Presence** — roster ao vivo (quem está na sala).
- **Broadcast `progress`** — `{ id, progress, wpm, accuracy, errors, finishedAt }` por jogador.
- **Broadcast `chat`** — mensagens da sala.
- **postgres_changes** em `rooms` — status, snippet, `start_at`, líder e resultados.

**API routes** (`/api/rooms`, com service role):

| Rota | O que faz |
|:--|:--|
| `POST /api/rooms` | cria a sala (gera o código de 6 letras) |
| `GET /api/rooms/[code]` | estado atual da sala |
| `POST /api/rooms/[code]` `{action}` | `settings` · `start` (sorteia snippet) · `finish` (grava placar) · `reset` · `claim-leader` |

> Salas vazias somem por inatividade; se o líder sai, o próximo jogador assume (eleição via presence).

### 🌐 SEO & Deploy

O projeto vem com **SEO de produção** pronto:

- ✅ **Metadata completo** — Open Graph + Twitter Cards, `keywords`, `canonical`, `robots`.
- ✅ **Card social dinâmico** — `opengraph-image` gerado em runtime (o banner aqui em cima 👆).
- ✅ **Dados estruturados** — JSON-LD `WebApplication` para *rich results*.
- ✅ **`sitemap.xml`, `robots.txt` e `manifest.webmanifest`** gerados pelo App Router.
- ✅ **Fonte self-hosted** via `next/font` — sem request render-blocking, melhor *Core Web Vitals*.
- ✅ Salas (`/room/*`) marcadas como **`noindex`** (conteúdo efêmero não polui o índice).

**Deploy na Vercel** (roda nativo — o tempo real é todo Supabase, sem servidor próprio):

1. Importe o repo na [Vercel](https://vercel.com/new) — ela detecta o Next.js sozinha.
2. Em **Settings → Environment Variables**, defina: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e
   `NEXT_PUBLIC_SITE_URL` (sua URL da Vercel).
3. Rode `pnpm db:migrate` uma vez (local, com o `DATABASE_URL`) pra criar as tabelas.
4. **Deploy!** Mande a URL pra galera e corram. 🏁

> 💡 Como o multiplayer usa **Supabase Realtime** (e não um WebSocket próprio), funciona no
> serverless da Vercel sem gambiarra nenhuma.

### 🛠️ Stack

- **Next.js 14** (App Router) + **TypeScript** — UI **e** API routes serverless
- **Tailwind CSS** + **Framer Motion** (visual *dark hacker*)
- **Supabase Realtime** — multiplayer (presence + broadcast); **Postgres** p/ salas e placar
- **Vercel** — deploy serverless nativo (sem servidor próprio)
- Utilitários: `nanoid`, `clsx`, `tailwind-merge`, `lucide-react`

### 🗺️ Roadmap

- [ ] Persistência opcional (Supabase / SQLite) para histórico de partidas
- [ ] Modo solo contra **fantasmas** (replay de partidas)
- [ ] Modo **"code review"** — corrigir bugs em vez de só digitar
- [ ] Voice chat (WebRTC) e tema claro
- [ ] Mais snippets via PR da comunidade

### 🤝 Contribuindo

Contribuições são muito bem-vindas! 🎉

1. Faça um **fork** e crie um branch: `git checkout -b feat/minha-ideia`
2. Rode `pnpm typecheck` e `pnpm lint` antes de commitar
3. Abra um **Pull Request** descrevendo a mudança

**Quer só adicionar snippets?** É o jeito mais fácil de ajudar: edite
[`src/lib/snippets.ts`](src/lib/snippets.ts), adicione seu trecho na linguagem e
dificuldade certas e mande o PR. 🙌

### 📄 Licença / License

Distribuído sob a licença **MIT**. Veja [`LICENSE`](./LICENSE).

---

## 🇺🇸 English
<a name="-english"></a>

> **TL;DR** — Spin up a room, share the link, and race in real time to type the code snippet
> fastest (with the fewest errors). **8 languages**, **live WPM & accuracy**, a **podium**, **chat**
> and a *dark-hacker* look with Matrix rain. No login, no fluff.

### ⚡ What it is

**CodeRacer** is a **multiplayer typing race built for people who code**. Instead of *"the quick
brown fox"*, you type real code — a `debounce`, an `LRU cache`, a goroutine. Each match draws a
snippet, fires the `3·2·1·GO!`, and the track fills with `🚀` racing live as everyone types.

**Live rooms run in memory** (restart and they vanish), but every **finished match is saved to
Supabase** to power a **global leaderboard** — see who's the fastest dev at `/leaderboard`. No
signup, no friction: just create and play.

### ✨ Features

| | Feature | Detail |
|:--:|:--|:--|
| 🏁 | **Real-time rooms** | **6-letter** invite code — or just share the link. Up to **30 players**. |
| 💻 | **8 languages** | JavaScript, TypeScript, Python, Java, C#, C++, Go and Rust — in **easy / medium / hard**. |
| 📊 | **Live metrics** | **WPM**, **accuracy**, **errors** and per-player progress, updated on every keystroke. |
| 🏆 | **Podium** | Gold/silver/bronze at the end + full standings with time. The leader restarts the match. |
| 🌍 | **Global leaderboard** | Every finished match is saved to **Supabase** — a per-player best-WPM ranking at `/leaderboard`. |
| 💬 | **In-room chat** | Trash-talk before, during and after — with system messages (joined, finished, gave up). |
| 🔑 | **Google login** *(optional)* | Sign in with Google to use your **name and avatar** — or just play as a guest. |
| 🌧️ | **Dark-hacker look** | Neon theme, background grid and optional **MatrixRain**. Honors `prefers-reduced-motion`. |
| 🚫 | **Anti-cheat** | **Paste disabled** in the input; backspace allowed, but only *forward* hits count. |
| 📱 | **PWA-ready** | Manifest, icons and theme-color — installable on mobile. |

### 🕹️ How to play

1. On the home screen, pick your **nick**.
2. **Create room** → choose **language**, **difficulty** and **max players**.
3. Share the **6-letter code** (or the room link).
4. The leader hits **Start** → `3 · 2 · 1 · GO!` countdown.
5. **Type!** Live standings on top, your stats below (WPM, accuracy, errors, progress).
6. Finishers hit the **podium**. The leader can **play again** in one click.

> 💡 Opened a room link without a nick? No ugly browser prompt — a styled screen asks for your nick
> before dropping you into the race.

### 🚀 Run it locally

Requirements: **Node 18+** and **pnpm** (or npm).

```bash
# 1. install dependencies
pnpm install          # or: npm install

# 2. configure Supabase (.env.example → .env.local) and create the tables
pnpm db:migrate

# 3. dev mode
pnpm dev              # → http://localhost:3000

# 4. production
pnpm build && pnpm start
```

Environment variables (copy `.env.example` → `.env.local` — and mirror them on Vercel):

| Variable | Purpose |
|:--|:--|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (client — used by Realtime). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase **anon** key (client — Realtime). |
| `SUPABASE_URL` | Supabase URL (server — API routes). |
| `SUPABASE_SERVICE_ROLE_KEY` | **Service role** (server — writes rooms/leaderboard). **Never expose it.** |
| `DATABASE_URL` | Postgres connection string (used by `pnpm db:migrate`). |
| `NEXT_PUBLIC_SITE_URL` | Public URL for SEO (canonical, OG, sitemap). No trailing slash. |

Handy scripts: `pnpm typecheck` · `pnpm lint` · `pnpm db:migrate`.

### 🧠 How WPM is calculated

Follows the **industry standard** (same as Monkeytype/TypeRacer):

```
WPM = (correct characters / 5) / elapsed minutes
accuracy = 1 − (errors / total keystrokes) → as %
```

- One "word" = **5 characters** (the universal typing-test convention).
- Backspace does **not** count as a hit (you can fix mistakes, but you don't get credit for them).
- Accuracy penalizes every wrong keystroke, even if you correct it afterwards.

### 🏗️ Architecture

**No standalone server** — the multiplayer runs on **Supabase Realtime** (presence + broadcast) plus
**serverless API routes**, so it deploys straight to **Vercel**. See the Portuguese section above for
the full file tree, the room channel and the API route tables.

```mermaid
sequenceDiagram
    participant L as Leader
    participant API as API routes (Vercel)
    participant DB as Supabase (rooms + Realtime)
    participant P as Players
    L->>API: POST /api/rooms (create)
    API->>DB: insert room
    P->>DB: subscribe channel (presence · broadcast · changes)
    L->>API: POST start
    API->>DB: status=racing, snippet, start_at
    DB-->>P: postgres_changes (racing)
    Note over P: countdown derived from start_at
    loop every keystroke
        P-->>P: broadcast progress (ephemeral)
    end
    L->>API: POST finish {standings}
    API->>DB: status=finished + save matches/scores
    DB-->>P: postgres_changes (finished) → podium 🥇
```

### 🌐 SEO & Deploy

The project ships with **production-grade SEO**: full Open Graph + Twitter metadata, a dynamic
`opengraph-image` social card (the banner above), `WebApplication` JSON-LD, `sitemap.xml`,
`robots.txt`, a PWA `manifest`, and a self-hosted font via `next/font` for better Core Web Vitals.
Ephemeral rooms are `noindex`.

**Deploy on Vercel** (native — the realtime layer is all Supabase, no standalone server): import the
repo at [vercel.com/new](https://vercel.com/new) → set `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL`
→ run `pnpm db:migrate` once to create the tables → deploy and share the URL. 🏁

> 💡 Because multiplayer uses **Supabase Realtime** (not a custom WebSocket), it runs on Vercel's
> serverless with zero workarounds.

### 🛠️ Stack

**Next.js 14** (App Router) + TypeScript (UI **and** serverless API routes) · **Tailwind CSS** +
Framer Motion · **Supabase Realtime** for multiplayer (presence + broadcast) and **Postgres** for
rooms + leaderboard · deployed on **Vercel**. Helpers: `nanoid`, `clsx`, `tailwind-merge`,
`lucide-react`.

### 🗺️ Roadmap

- [ ] Optional persistence (Supabase / SQLite) for match history
- [ ] Solo mode vs **ghosts** (match replays)
- [ ] **"Code review"** mode — fix bugs instead of just typing
- [ ] Voice chat (WebRTC) and a light theme
- [ ] More snippets via community PRs

### 🤝 Contributing

Contributions are very welcome! 🎉 Fork, create a branch, run `pnpm typecheck` and `pnpm lint`,
then open a PR. **The easiest way to help is adding snippets** — edit
[`src/lib/snippets.ts`](src/lib/snippets.ts) and send a PR. 🙌

### 📄 License

Released under the **MIT** license. See [`LICENSE`](./LICENSE).

---

<div align="center">

*Feito com cafeína ☕ e segfaults · Part of **Caio**'s project ecosystem.*

<sub>⭐ Curtiu? Deixa uma star no repo — ajuda muito! / Liked it? Drop a star — it helps a lot!</sub>

</div>
