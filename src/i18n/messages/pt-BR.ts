// Idioma de ORIGEM. Toda chave nova nasce aqui; os outros 11 idiomas têm o mesmo
// formato (o TypeScript e o `messages.test.ts` acusam chave faltando ou placeholder perdido).
// Convenções: `{nome}` = valor interpolado; `<a>…</a>` = trecho com estilo (ver `rich.tsx`);
// objeto com `one`/`other`… = plural (`#` vira o número).

const ptBR = {
  meta: {
    title: "CodeRacer — corrida de digitação multiplayer para devs",
    description:
      "Corrida de digitação multiplayer para programadores. Crie uma sala, mande o link pros amigos e dispute quem digita o snippet de código mais rápido — sem cadastro, sem firula. 24 linguagens, WPM e precisão em tempo real, pódio e chat.",
    descriptionShort:
      "Dispute com amigos quem digita código mais rápido. 24 linguagens, WPM em tempo real, sem cadastro.",
    ogAlt: "CodeRacer — corrida de digitação de código multiplayer, tema dark hacker com neon verde",
    tagline: "dispute com os amigos, uma tecla de cada vez",
    practiceTitle: "Treino Livre — digite código sem sala",
    practiceDescription:
      "Treine digitação de código sozinho no CodeRacer: escolha linguagem e dificuldade e corra contra o relógio — sem sala, sem cadastro.",
    leaderboardTitle: "Ranking Global — os devs mais rápidos",
    leaderboardDescription:
      "Veja quem digita código mais rápido no CodeRacer: ranking global de WPM, precisão e partidas recentes.",
    roomTitle: "Sala {code} — entre na corrida",
    roomDescription: "Entre na sala {code} e dispute quem digita o código mais rápido no CodeRacer."
  },
  common: {
    home: "home",
    backHome: "Voltar para a home",
    back: "voltar",
    you: " (você)",
    youWord: "(você)",
    leader: "líder",
    ready: "pronto",
    cancel: "cancelar",
    close: "Fechar",
    share: "Compartilhar",
    linkCopied: "Link copiado!",
    copyFailed: "Falha ao copiar",
    language: "linguagem",
    difficulty: "dificuldade",
    maxPlayers: "jogadores máx ({n})",
    wpm: "wpm",
    accuracy: "precisão",
    errors: "erros",
    time: "tempo",
    player: "jogador",
    ranking: "ranking",
    online: "online",
    tryAgain: "tentar de novo",
    noConnection: "Sem conexão com o servidor",
    uiLanguage: "Idioma",
    footer: "feito com café ☕ & segfaults",
    ordinal: { other: "#º" },
    place: "{ord} lugar"
  },
  difficulty: {
    easy: { label: "🟢 Júnior", desc: "Snippets curtos, sintaxe básica" },
    medium: { label: "🔵 Pleno", desc: "Snippets do dia a dia, ~10 linhas" },
    hard: { label: "🟣 Sênior", desc: "Snippets longos com sintaxe avançada" }
  },
  home: {
    srTitle:
      "CodeRacer — corrida de digitação para programadores: treine sozinho ou jogue multiplayer com amigos, digitando código mais rápido, sem cadastro.",
    tagline:
      "Digite código de verdade — treine sozinho ou crie uma sala e chame os amigos. Quem for mais rápido leva. Sem cadastro, sem firula.",
    chipRealtime: "tempo real",
    chipMultiplayer: "multiplayer",
    chipLanguages: "{n} linguagens",
    signOut: "sair",
    signIn: "entrar com Google",
    signInTitle: "Opcional — entrar só pré-preenche seu nick. Dá para jogar sem conta.",
    signInAria: "Entrar com Google (opcional — dá para jogar sem conta)",
    optional: "opcional",
    namePlaceholder: "Ex.: caio_dev",
    nameAria: "Seu nick de jogador",
    nameHint: "é só o nick — sem conta, sem e-mail",
    createRoom: "Criar sala",
    orJoin: "ou entre numa sala",
    codePlaceholder: "CÓDIGO",
    codeAria: "Código de 6 letras da sala",
    joinAria: "Entrar na sala com o código",
    orSolo: "ou sozinho",
    practiceCta: "treinar sozinho →",
    practiceAria: "Treinar sozinho, sem criar sala",
    featSnippetsTitle: "snippets reais",
    featSnippetsText:
      "{n} linguagens, 300+ trechos de código de verdade em 3 níveis. Cada partida sorteia um diferente.",
    featPlayersTitle: "até {n} jogadores",
    featPlayersText: "Compartilhe o código de 6 letras ou o link da sala — gente entra na hora.",
    featStatsTitle: "WPM + precisão",
    featStatsText:
      "Posição em tempo real no topo, estatísticas no final. Pódio com ouro/prata/bronze.",
    modalTitle: "// configurar sala",
    creating: "criando...",
    create: "criar sala →",
    publicRoom: "sala pública",
    privateRoom: "sala privada",
    publicHint: "aparece na busca de salas da home",
    privateHint: "só entra quem tem o código ou link",
    roomsTitle: "salas públicas abertas",
    refresh: "atualizar",
    refreshAria: "Atualizar lista de salas",
    roomsEmpty: "nenhuma sala pública aberta agora —",
    roomsEmptyCta: "crie a primeira!",
    upTo: "até {n}p",
    enter: "entrar",
    needName: "Coloca um nome aí, fera",
    needCode: "Cola o código da sala",
    createError: "Erro ao criar sala",
    raceInProgress: "Partida em andamento, aguarda terminar",
    howTitle: "como jogar",
    how1: "Escolha um nick (sem conta) e crie uma sala — ou treine sozinho.",
    how2: "Mande o código de 6 letras pros amigos. O líder larga quando todos estiverem prontos.",
    how3: "Digite o código igualzinho. Tab e Enter já colocam a indentação. Erro conta, colar não vale.",
    howClose: "entendi"
  },
  practice: {
    title: "Treino Livre",
    subtitle: "só você e o código — o cronômetro dispara na primeira tecla",
    done: "// treino concluído",
    errorsCount: { one: "# erro", other: "# erros" },
    again: "treinar de novo",
    withFriends: "criar sala com amigos",
    loadError: "Não deu para sortear um snippet — tenta de novo.",
    finishedPlaceholder: "✅ terminou! bora treinar de novo?",
    newBest: "novo recorde pessoal!",
    best: "recorde: {wpm} WPM"
  },
  typing: {
    idleTitle: "⚠️ Você está inativo",
    idleText: "Digite qualquer tecla para continuar na corrida.",
    idleIn: "desistência em",
    statsTitle: "// suas estatísticas",
    timeSeconds: "tempo {s}s",
    statWpm: "WPM",
    statAccuracy: "Precisão",
    statProgress: "Progresso",
    statErrors: "Erros (total)",
    statErrorsTitle: "Teclas erradas digitadas ao longo da corrida — inclui as que você já corrigiu.",
    streak: "sequência",
    youFinished: "// você terminou!",
    soundOff: "Desligar som",
    soundOn: "Ligar som",
    soundIsOn: "Som: ligado",
    soundIsOff: "Som: desligado",
    editorOptions: "Opções do editor",
    options: "Opções",
    fontSize: "tamanho da fonte",
    fontDown: "Diminuir fonte",
    fontUp: "Aumentar fonte",
    wrap: "quebrar linha",
    on: "on",
    off: "off",
    error: "erro",
    placeholder: "$ comece a digitar...",
    finishedPlaceholder: "✅ terminou! veja a posição dos outros...",
    chars: "{n} chars",
    rules: "paste off · backspace não pontua",
    forfeit: "desistir",
    inputAria: "Digite aqui o código mostrado ao lado",
    targetAria: "Código para digitar"
  },
  lobby: {
    title: "lobby",
    players: "{n}/{max} jogadores",
    leaderIntro:
      "Você é o <a>líder</a>. Configure a partida — você só inicia quando todos marcarem <b>pronto</b>.",
    guestIntro: "Marque que você está <b>pronto</b> — o líder começa quando todos estiverem.",
    settings: "configurações",
    settingsHint: "(dificuldade e limite: só o líder · linguagem: todos votam)",
    languageVote: "linguagem — votação",
    noVotes: "ninguém votou ainda — a linguagem padrão da sala será usada",
    winning: { one: "vencendo: {lang} · # voto", other: "vencendo: {lang} · # votos" },
    tie: "empate: {langs} — sorteio no início",
    voteHint: "todos votam · você pode trocar até o início · a mais votada vence",
    votesAria: { one: "{lang} — # voto", other: "{lang} — # votos" },
    start: "Iniciar partida",
    readyDone: "pronto!",
    getReady: "Ficar pronto",
    noOthers: "// sem outros jogadores — inicie quando quiser",
    allReady: "// todos prontos! manda ver 🚀",
    readyCount: "// prontos: {ready}/{total} — aguardando todos marcarem pronto",
    inRoom: "na sala",
    kick: "Remover {name} da sala",
    waiting: "aguardando..."
  },
  room: {
    connecting: "conectando à sala {code}...",
    invited: "você foi convidado",
    invitedText: "entre na sala <code>{code}</code> e mostre quem digita mais rápido.",
    chooseNick: "escolha seu nick",
    joinRace: "Entrar na corrida",
    copyLinkTitle: "Copiar link da sala",
    roomWord: "sala",
    copyLink: "copiar link"
  },
  countdown: {
    getSet: "prepare seus dedos...",
    go: "vai vai vai!"
  },
  track: {
    title: "// posição em tempo real",
    finishedCount: "{done}/{total} terminaram",
    position: "posição {n}",
    finished: "✓ terminou",
    abandoned: "desistiu"
  },
  spectator: {
    title: "Partida em andamento",
    text: "Você entrou como espectador.",
    hint: "// assim que esta rodada terminar você participa automaticamente da próxima"
  },
  chat: {
    title: "// chat",
    placeholder: "// digite uma msg...",
    floatingPlaceholder: "// provoca a galera...",
    send: "Enviar mensagem",
    joined: "{name} entrou na sala",
    left: "{name} saiu",
    kicked: "{name} foi removido da sala pelo líder"
  },
  players: {
    title: "// jogadores"
  },
  results: {
    finished: "Partida finalizada",
    youPlaced: "// você terminou em {ord}",
    youDnf: "// você não terminou esta corrida",
    fullTable: "// classificação completa",
    playAgain: "Jogar de novo",
    waitingLeader: "// aguardando líder reiniciar...",
    viewRanking: "ver ranking global",
    nobody: "// ninguém terminou esta corrida",
    dnf: "// não terminou",
    copied: "Resultado copiado!",
    shareAria: "Compartilhar meu resultado",
    shareWithPlace: "Fiz {wpm} WPM ({accuracy}%) e terminei em {ord} no CodeRacer 🏁 me alcança: {url}",
    shareNoPlace: "Fiz {wpm} WPM ({accuracy}%) no CodeRacer 🏁 me alcança: {url}",
    bestStreak: "melhor sequência: {n}"
  },
  leaderboard: {
    title: "Ranking Global",
    subtitle: "os programadores que digitam código mais rápido — recorde de WPM por jogador.",
    notConfigured: "⚠ Banco não configurado.",
    notConfiguredHint: "Defina <c>SUPABASE_URL</c> e <c>SUPABASE_SERVICE_ROLE_KEY</c> para registrar partidas.",
    unavailable: "⚠ O ranking não respondeu agora — tente de novo em instantes.",
    empty: "Ainda não há partidas registradas.",
    emptyHint: "Seja o primeiro recorde — chame a galera e corra!",
    playNow: "jogar agora",
    best: "// melhores WPM",
    lang: "lang",
    recent: "// partidas recentes",
    none: "nenhuma ainda"
  },
  notFound: {
    error: "rota não encontrada",
    text: "essa sala não existe, expirou ou o link veio torto.",
    back: "voltar pra pista"
  },
  error: {
    title: "algo quebrou na pista",
    text: "um erro inesperado tirou você da corrida. tenta de novo?"
  },
  demo: {
    live: "ao vivo"
  },
  errors: {
    roomNotFound: "Sala não encontrada",
    roomLoad: "Não foi possível carregar a sala",
    roomGeneric: "Erro na sala",
    realtimeFailed: "Conexão em tempo real falhou",
    kickedYou: "Você foi removido da sala pelo líder",
    notConfigured: "O servidor da sala não está configurado",
    leaderOnly: "Só o líder pode fazer isso",
    alreadyStarted: "A partida já começou",
    notFinished: "A partida ainda não terminou",
    invalidLanguage: "Linguagem inválida",
    invalidDifficulty: "Dificuldade inválida",
    roomCreate: "Não foi possível gerar a sala",
    roomUpdate: "Não foi possível atualizar a sala",
    roomConfirm: "Não foi possível confirmar a alteração",
    finishFailed: "Não foi possível encerrar a partida",
    invalidTarget: "Alvo inválido",
    kickLimit: "Limite de expulsões desta sala atingido",
    kickUnavailable: "Expulsão indisponível no momento",
    invalidAction: "Ação inválida",
    missingPlayer: "Jogador não identificado"
  }
};

export default ptBR;
export type SourceMessages = typeof ptBR;
