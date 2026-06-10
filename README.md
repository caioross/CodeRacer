<div align="center">

<img src="./docs/banner.png" alt="CodeRacer — corrida de digitação de código multiplayer" width="100%" />

# ⌨️ CodeRacer

### 🇧🇷 Corrida de digitação multiplayer para programadores — digite o código mais rápido e vença.
### 🇺🇸 Multiplayer typing race for programmers — type the code fastest and win.

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-14.2-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-11-0055FF?style=for-the-badge&logo=framer&logoColor=white)](https://www.framer.com/motion/)

[![License: MIT](https://img.shields.io/badge/License-MIT-00ff88?style=flat-square)](#-licença--license)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-00e5ff?style=flat-square)](#-contribuindo--contributing)
[![No database](https://img.shields.io/badge/database-none_(in--memory)-a855f7?style=flat-square)](#-arquitetura)
[![CI](https://img.shields.io/badge/CI-build-green?style=flat-square&logo=githubactions&logoColor=white)](./.github/workflows/ci.yml)

<br/>

**🇧🇷 [Português](#-português) · 🇺🇸 [English](#-english)**

```
> _ CodeRacer · sem cadastro · sem banco · só você, seu teclado e a glória
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
| 🏁 | **Salas em tempo real** | Código de **6 letras** pra convidar — ou só mande o link. Até **12 jogadores**. |
| 💻 | **8 linguagens** | JavaScript, TypeScript, Python, Java, C#, C++, Go e Rust — em **fácil / médio / difícil**. |
| 📊 | **Métricas ao vivo** | **WPM**, **precisão**, **erros** e progresso por jogador, atualizados a cada tecla. |
| 🏆 | **Pódio** | Ouro/prata/bronze ao final + classificação completa com tempo. O líder reinicia a partida. |
| 🌍 | **Placar global** | Toda partida terminada é salva no **Supabase** — ranking de recorde de WPM por jogador em `/leaderboard`. |
| 💬 | **Chat na sala** | Provoque os amigos antes, durante e depois — com avisos do sistema (entrou, terminou, desistiu). |
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

# 2. modo desenvolvimento (Next + Socket.io na MESMA porta, via server.js)
pnpm dev              # → http://localhost:3000

# 3. produção
pnpm build
pnpm start            # NODE_ENV=production node server.js
```

Variáveis de ambiente (copie `.env.example` → `.env.local`):

| Variável | Para quê | Padrão |
|:--|:--|:--|
| `NEXT_PUBLIC_SITE_URL` | URL pública usada no SEO (canonical, Open Graph, sitemap, JSON-LD). Sem barra no final. | `https://coderacer.app` |
| `PORT` | Porta do servidor (Next + Socket.io juntos). | `3000` |

Scripts úteis: `pnpm typecheck` · `pnpm lint`.

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

O CodeRacer **funciona 100% sem banco** — mas, se você configurar o **Supabase**, toda partida
terminada é salva e vira um **ranking global** em `/leaderboard`.

**1. Variáveis** (em `.env.local`):

```bash
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...        # server-only — NUNCA exponha no cliente
DATABASE_URL=postgresql://postgres:SENHA@db.SEU_PROJETO.supabase.co:5432/postgres
```

**2. Crie as tabelas** (aplica os SQLs de `supabase/migrations/`):

```bash
pnpm db:migrate
```

Isso cria `matches`, `scores` e a view `leaderboard`, com **RLS**: leitura pública, escrita só pelo
servidor (service role). O servidor grava a partida assim que ela termina, de forma *best-effort* —
se o banco estiver fora, o jogo continua normal, só não registra o placar.

### 🏗️ Arquitetura

Um **custom server Node** roda o Next.js e o Socket.io na **mesma porta** — simples de hospedar,
sem serviço separado de websocket.

```
.
├── server.js                     # custom server: Next + Socket.io; grava partidas no Supabase
├── Dockerfile · render.yaml      # deploy (Node persistente + WebSockets)
├── supabase/migrations/          # schema SQL: matches, scores, view leaderboard
├── scripts/                      # pnpm db:migrate + utilitários de banco
├── src/
│   ├── app/
│   │   ├── layout.tsx            # metadata/SEO completo, next/font, JSON-LD, theme-color
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
│       ├── snippets-server.js    # snippets (CommonJS, consumido pelo server)
│       ├── supabase-server.js    # escrita no banco (CJS); supabase.ts = leitura (placar)
│       ├── languages.ts · types.ts · utils.ts · socket-client.ts · site.ts (config SEO)
```

#### Fluxo de uma partida

```mermaid
sequenceDiagram
    participant L as Líder
    participant S as Server (Socket.io)
    participant P as Jogadores
    L->>S: room:create {name, settings}
    S-->>L: {code, room}
    P->>S: room:join {name, code}
    S-->>P: room:state
    L->>S: race:start
    S-->>P: race:countdown 3·2·1·0
    loop a cada tecla
        P->>S: race:progress {progress, wpm, accuracy, errors}
        S-->>P: room:state (posições ao vivo)
    end
    Note over S,P: 1º a terminar lidera o pódio 🥇
```

#### Eventos Socket.io

<table>
<tr><th align="left">client → server</th><th align="left">server → client</th></tr>
<tr><td valign="top">

| Evento | Payload |
|:--|:--|
| `room:create` | `{ name, settings }` |
| `room:join` | `{ code, name }` |
| `room:updateSettings` | `{ settings }` |
| `chat:send` | `{ text }` |
| `race:start` | — |
| `race:progress` | `{ progress, wpm, accuracy, errors }` |
| `race:abandon` | — |
| `race:reset` | — |

</td><td valign="top">

| Evento | Payload |
|:--|:--|
| `room:state` | `RoomState` completo |
| `race:countdown` | `n` = 3, 2, 1, 0 |

**Regras do servidor**
- Sala vazia se autodestrói.
- Líder saiu? O próximo jogador assume.
- Tudo validado/limitado no servidor (nome, max players 2–12, etc.).

</td></tr>
</table>

### 🌐 SEO & Deploy

O projeto vem com **SEO de produção** pronto:

- ✅ **Metadata completo** — Open Graph + Twitter Cards, `keywords`, `canonical`, `robots`.
- ✅ **Card social dinâmico** — `opengraph-image` gerado em runtime (o banner aqui em cima 👆).
- ✅ **Dados estruturados** — JSON-LD `WebApplication` para *rich results*.
- ✅ **`sitemap.xml`, `robots.txt` e `manifest.webmanifest`** gerados pelo App Router.
- ✅ **Fonte self-hosted** via `next/font` — sem request render-blocking, melhor *Core Web Vitals*.
- ✅ Salas (`/room/*`) marcadas como **`noindex`** (conteúdo efêmero não polui o índice).

**Deploy (Render, grátis — tem `render.yaml` e `Dockerfile` prontos):**

1. Suba o repo no GitHub. No [Render](https://render.com): **New → Blueprint** apontando pro repo
   (ele lê o `render.yaml`).
2. No painel, defina: `NEXT_PUBLIC_SITE_URL` (sua URL do Render), `SUPABASE_URL` e
   `SUPABASE_SERVICE_ROLE_KEY`.
3. Rode `pnpm db:migrate` uma vez (local, com `DATABASE_URL`) pra criar as tabelas.
4. Deploy! Mande a URL pra galera e corram. 🏁

> ⚠️ **Por que não Vercel?** O CodeRacer usa **custom server + WebSockets** (Socket.io), que **não
> roda no Vercel serverless**. Use um host com **processo Node persistente** — **Render**,
> **Railway**, **Fly.io** ou **VPS** (o `Dockerfile` serve pra todos).

### 🛠️ Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + **Framer Motion** (visual *dark hacker*)
- **Socket.io** sobre um **custom server Node** (`server.js`) — mesma porta do Next
- **Supabase (Postgres)** — persiste partidas terminadas p/ o placar; salas ao vivo em memória
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
[`src/lib/snippets-server.js`](src/lib/snippets-server.js), adicione seu trecho na linguagem e
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
| 🏁 | **Real-time rooms** | **6-letter** invite code — or just share the link. Up to **12 players**. |
| 💻 | **8 languages** | JavaScript, TypeScript, Python, Java, C#, C++, Go and Rust — in **easy / medium / hard**. |
| 📊 | **Live metrics** | **WPM**, **accuracy**, **errors** and per-player progress, updated on every keystroke. |
| 🏆 | **Podium** | Gold/silver/bronze at the end + full standings with time. The leader restarts the match. |
| 🌍 | **Global leaderboard** | Every finished match is saved to **Supabase** — a per-player best-WPM ranking at `/leaderboard`. |
| 💬 | **In-room chat** | Trash-talk before, during and after — with system messages (joined, finished, gave up). |
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

# 2. dev mode (Next + Socket.io on the SAME port, via server.js)
pnpm dev              # → http://localhost:3000

# 3. production
pnpm build
pnpm start            # NODE_ENV=production node server.js
```

Environment variables (copy `.env.example` → `.env.local`):

| Variable | Purpose | Default |
|:--|:--|:--|
| `NEXT_PUBLIC_SITE_URL` | Public URL used for SEO (canonical, Open Graph, sitemap, JSON-LD). No trailing slash. | `https://coderacer.app` |
| `PORT` | Server port (Next + Socket.io together). | `3000` |

Handy scripts: `pnpm typecheck` · `pnpm lint`.

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

A **custom Node server** runs Next.js and Socket.io on the **same port** — simple to host, no
separate websocket service. See the Portuguese section above for the full file tree, the message
sequence diagram and the Socket.io event tables.

```mermaid
sequenceDiagram
    participant L as Leader
    participant S as Server (Socket.io)
    participant P as Players
    L->>S: room:create {name, settings}
    S-->>L: {code, room}
    P->>S: room:join {name, code}
    S-->>P: room:state
    L->>S: race:start
    S-->>P: race:countdown 3·2·1·0
    loop every keystroke
        P->>S: race:progress {progress, wpm, accuracy, errors}
        S-->>P: room:state (live standings)
    end
    Note over S,P: first to finish tops the podium 🥇
```

### 🌐 SEO & Deploy

The project ships with **production-grade SEO**: full Open Graph + Twitter metadata, a dynamic
`opengraph-image` social card (the banner above), `WebApplication` JSON-LD, `sitemap.xml`,
`robots.txt`, a PWA `manifest`, and a self-hosted font via `next/font` for better Core Web Vitals.
Ephemeral rooms are `noindex`.

**Deploy (Render, free — `render.yaml` and `Dockerfile` included):** push to GitHub → on Render,
**New → Blueprint** pointing at the repo → set `NEXT_PUBLIC_SITE_URL`, `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` → run `pnpm db:migrate` once to create the tables → deploy and share
the URL. 🏁

> ⚠️ **Why not Vercel?** CodeRacer uses a **custom server + WebSockets** (Socket.io), which **won't
> run on Vercel serverless**. Host it where a **persistent Node process** lives — **Render**,
> **Railway**, **Fly.io** or a **VPS** (the `Dockerfile` works for all).

### 🛠️ Stack

**Next.js 14** (App Router) + TypeScript · **Tailwind CSS** + Framer Motion · **Socket.io** on a
**custom Node server** (`server.js`, same port as Next) · **Supabase** (Postgres) persistence for the
leaderboard, live rooms in memory. Helpers: `nanoid`, `clsx`, `tailwind-merge`, `lucide-react`.

### 🗺️ Roadmap

- [ ] Optional persistence (Supabase / SQLite) for match history
- [ ] Solo mode vs **ghosts** (match replays)
- [ ] **"Code review"** mode — fix bugs instead of just typing
- [ ] Voice chat (WebRTC) and a light theme
- [ ] More snippets via community PRs

### 🤝 Contributing

Contributions are very welcome! 🎉 Fork, create a branch, run `pnpm typecheck` and `pnpm lint`,
then open a PR. **The easiest way to help is adding snippets** — edit
[`src/lib/snippets-server.js`](src/lib/snippets-server.js) and send a PR. 🙌

### 📄 License

Released under the **MIT** license. See [`LICENSE`](./LICENSE).

---

<div align="center">

*Feito com cafeína ☕ e segfaults · Part of **Caio**'s project ecosystem.*

<sub>⭐ Curtiu? Deixa uma star no repo — ajuda muito! / Liked it? Drop a star — it helps a lot!</sub>

</div>
