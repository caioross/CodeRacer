#!/usr/bin/env python3
"""
Guarda de PreToolUse — nega o que nenhuma rodada desacompanhada deveria fazer.

POR QUE EXISTE

As travas que importam moram fora do agente: o ruleset do GitHub recusa push na
main, e o token do agente não tem escopo para remover o ruleset. Este hook é a
camada rápida — ele responde em milissegundos e diz *por quê*, em vez de deixar
o agente descobrir com um erro de rede trinta segundos depois.

Ele não é a última linha de defesa. É a primeira, e a que ensina.

UM SCRIPT, DOIS RUNTIMES

Codex e Antigravity leem formatos de resposta diferentes:

  Codex/Claude : {"hookSpecificOutput": {"permissionDecision": "deny", ...}}
  Antigravity  : {"decision": "deny", "reason": ...}

Emitir as DUAS chaves no mesmo JSON satisfaz os dois — cada um lê a sua e
ignora a outra. É mais simples que manter dois scripts em sincronia, e um
script que existe em duas cópias é um script que vai divergir.

SAÍDA SEMPRE 0

Hook que sai não-zero vira "hook quebrado" e, em algumas implementações, é
ignorado — exatamente o contrário do que se quer de uma trava. O veredito vai
no JSON, nunca no código de saída.
"""
import json
import re
import sys

# --- O que nunca se lê ------------------------------------------------------
# .env e amigos: segredo do projeto. mcp_config.json / auth.json / oauth_creds:
# segredo das FERRAMENTAS — e é onde mora hoje um PAT de conta do Supabase e um
# do GitHub, em texto puro. O CodeRacer é um repositório PÚBLICO: um segredo que
# entre num PR daqui está exposto para o mundo no mesmo segundo.
SEGREDOS = re.compile(
    r"""(
        \.env(\.|\b)            # .env, .env.local, .env.production
      | mcp_config\.json
      | auth\.json
      | oauth_creds
      | google_accounts
      | \.sandbox-secrets
      | id_rsa | id_ed25519
      | credenciais\.md
    )""",
    re.IGNORECASE | re.VERBOSE,
)

# Formas de token: se aparecerem num comando, alguém está copiando segredo.
FORMA_DE_TOKEN = re.compile(r"\b(sbp_[a-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,})")

# --- O que nunca se escreve -------------------------------------------------
# A ordem importa: 'push --force' é negado mesmo com destino inocente, porque
# force-push em branch de outro agente destrói trabalho que ninguém pediu.
PUSH_NA_MAIN = re.compile(
    r"""git\s+(?:-C\s+\S+\s+)*push\b      # git push, com ou sem -C
        (?!.*--dry-run)                    # dry-run é leitura, deixa passar
        .*?\b(?:origin\s+)?
        (?:HEAD:)?(?:main|master)\b
        (?!\s*-)                           # 'main-alguma-coisa' não conta
    """,
    re.IGNORECASE | re.VERBOSE,
)
FORCE_PUSH = re.compile(r"git\s+(?:-C\s+\S+\s+)*push\b.*?(--force(?!-with-lease)|(?<![\w-])-f(?![\w-]))",
                        re.IGNORECASE)
REESCREVER_HISTORIA = re.compile(
    r"git\s+(?:-C\s+\S+\s+)*(?:rebase\s+(?:-i|--interactive)|filter-branch|reset\s+--hard\s+origin)",
    re.IGNORECASE)

# Desligar a própria proteção.
BURLAR = re.compile(r"dangerously-bypass|--ignore-rules|--ignore-user-config", re.IGNORECASE)

# Aplicar migração no banco de produção — o §7.1 do HANDBOOK, em código.
MIGRAR = re.compile(r"(pnpm|npm|yarn)\s+db:migrate|supabase\s+db\s+push", re.IGNORECASE)

REGRAS = [
    (BURLAR,            "Desligar sandbox, hooks ou regras nao e permitido numa rodada desacompanhada (AGENTS.md §D)."),
    (FORCE_PUSH,        "force-push destroi trabalho de outro agente. Use --force-with-lease, e so na propria branch (HANDBOOK §8)."),
    (PUSH_NA_MAIN,      "main e producao: merge = deploy. Abra PR — o ruleset do GitHub recusaria isto de qualquer forma (AGENTS.md §D)."),
    (REESCREVER_HISTORIA, "Reescrever historico e proibido (HANDBOOK §8)."),
    (MIGRAR,            "Agente cria o arquivo de migracao; quem aplica e o dono (HANDBOOK §7.1)."),
    (FORMA_DE_TOKEN,    "Isso tem forma de token. O CodeRacer e um repositorio PUBLICO."),
    (SEGREDOS,          "Arquivo de segredo. Nunca ler, imprimir ou commitar (HANDBOOK §8)."),
]


def texto_do_comando(entrada: dict) -> str:
    """O comando pode vir com nomes diferentes conforme o runtime e a ferramenta.

    Em vez de mapear cada um — e errar no próximo que aparecer — junta-se tudo
    que for string dentro da entrada da ferramenta. Uma trava que falha por não
    reconhecer o formato do dia não é uma trava.
    """
    alvo = entrada.get("tool_input", entrada.get("toolInput", entrada.get("input", {})))
    if isinstance(alvo, str):
        return alvo
    if not isinstance(alvo, dict):
        return json.dumps(entrada, ensure_ascii=False)
    partes = []
    for chave, valor in alvo.items():
        if isinstance(valor, str):
            partes.append(valor)
        elif isinstance(valor, (list, tuple)):
            partes.extend(str(v) for v in valor)
    return " ".join(partes) if partes else json.dumps(alvo, ensure_ascii=False)


def responder(decisao: str, motivo: str = "") -> None:
    saida = {
        # Antigravity
        "decision": decisao,
        "reason": motivo,
        # Codex / Claude Code
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decisao,
            "permissionDecisionReason": motivo,
        },
    }
    # ensure_ascii=True de proposito: o hook nao controla a codificacao do
    # consumidor, e no Windows o stdout do Python sai em cp1252 por padrao.
    # Um "nao" que chega como mojibake vira um "nao" que ninguem le. Escapar
    # para sequencias unicode mantem o JSON valido em qualquer leitor, sem
    # depender de sorte. Descoberto testando: 11 de 20 casos "falharam" e a
    # falha era do leitor, nao da regra.
    sys.stdout.write(json.dumps(saida, ensure_ascii=True) + chr(10))
    sys.stdout.flush()
    sys.exit(0)


def main() -> None:
    bruto = sys.stdin.read()
    try:
        entrada = json.loads(bruto) if bruto.strip() else {}
    except json.JSONDecodeError:
        # Entrada ilegível não é motivo para bloquear o trabalho: o hook cala e
        # deixa as camadas de fora (ruleset, escopo do token) fazerem o serviço.
        responder("allow", "entrada do hook ilegivel; seguindo")

    comando = texto_do_comando(entrada)
    for regra, motivo in REGRAS:
        if regra.search(comando):
            responder("deny", motivo)
    responder("allow")


if __name__ == "__main__":
    main()
