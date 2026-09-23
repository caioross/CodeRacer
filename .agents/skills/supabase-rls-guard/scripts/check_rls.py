#!/usr/bin/env python3
"""
check_rls.py — Audita migrations Supabase e flageia:
  1. Tabelas com RLS não habilitado
  2. Tabelas com RLS habilitado mas sem nenhuma policy
  3. Policies usando USING (true) ou WITH CHECK (true) sem justificativa documentada

Uso:
  python3 check_rls.py --migrations-dir supabase/migrations/
  python3 check_rls.py --migrations-dir supabase/migrations/ --strict

Exit codes:
  0 — sem problemas
  1 — problemas encontrados (use -v ON_ERROR_STOP=1 no CI)
"""

import argparse
import re
import sys
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Finding:
    level: str   # "ERROR" | "WARNING" | "INFO"
    file: str
    line: int
    message: str


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Auditoria de RLS em migrations Supabase")
    p.add_argument("--migrations-dir", required=True,
                   help="Diretório com arquivos *.sql de migration")
    p.add_argument("--strict", action="store_true",
                   help="Trata warnings como erros (para CI)")
    p.add_argument("--schema", default=None,
                   help="Filtrar por schema específico (ex: linkapet)")
    return p.parse_args()


def load_migrations(migrations_dir: Path) -> list[tuple[Path, str]]:
    """Carrega todos os arquivos .sql em ordem cronológica."""
    sql_files = sorted(migrations_dir.glob("*.sql"))
    if not sql_files:
        print(f"AVISO: nenhum arquivo .sql encontrado em {migrations_dir}")
    return [(f, f.read_text(encoding="utf-8")) for f in sql_files]


def extract_tables(content: str, schema_filter: Optional[str] = None) -> set[str]:
    """Extrai nomes de tabelas criadas nas migrations."""
    # Padrão: CREATE TABLE [IF NOT EXISTS] [schema.]tabela
    pattern = re.compile(
        r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?'
        r'(?:(\w+)\.)?(\w+)',
        re.IGNORECASE
    )
    tables = set()
    for match in pattern.finditer(content):
        schema = match.group(1) or "public"
        table = match.group(2)
        if schema_filter and schema != schema_filter:
            continue
        tables.add(f"{schema}.{table}")
    return tables


def extract_rls_enabled(content: str) -> set[str]:
    """Extrai tabelas onde ENABLE ROW LEVEL SECURITY foi aplicado."""
    pattern = re.compile(
        r'ALTER\s+TABLE\s+(?:ONLY\s+)?(?:(\w+)\.)?(\w+)\s+'
        r'ENABLE\s+ROW\s+LEVEL\s+SECURITY',
        re.IGNORECASE
    )
    tables = set()
    for match in pattern.finditer(content):
        schema = match.group(1) or "public"
        table = match.group(2)
        tables.add(f"{schema}.{table}")
    return tables


def extract_policies(content: str) -> dict[str, list[dict]]:
    """Extrai policies criadas — retorna mapa tabela → lista de policies."""
    # CREATE POLICY nome ON [schema.]tabela ...
    pattern = re.compile(
        r'CREATE\s+POLICY\s+(\w+)\s+ON\s+(?:(\w+)\.)?(\w+)',
        re.IGNORECASE
    )
    policies: dict[str, list[dict]] = {}
    for match in pattern.finditer(content):
        policy_name = match.group(1)
        schema = match.group(2) or "public"
        table = f"{schema}.{match.group(3)}"
        policies.setdefault(table, []).append({"name": policy_name})
    return policies


def find_permissive_policies(content: str, filepath: str) -> list[Finding]:
    """Detecta USING (true) e WITH CHECK (true) sem justificativa."""
    findings = []
    lines = content.splitlines()

    for i, line in enumerate(lines, start=1):
        line_upper = line.upper()

        if re.search(r'USING\s*\(\s*true\s*\)', line, re.IGNORECASE) or \
           re.search(r'WITH\s+CHECK\s*\(\s*true\s*\)', line, re.IGNORECASE):

            # Verifica se a linha ou a anterior tem comentário de justificativa
            prev_line = lines[i - 2] if i > 1 else ""
            has_justification = (
                "justificativa:" in line.lower() or
                "justificativa:" in prev_line.lower() or
                "-- public" in line.lower() or
                "-- public" in prev_line.lower() or
                "-- intencional" in line.lower() or
                "-- intencional" in prev_line.lower()
            )

            if not has_justification:
                findings.append(Finding(
                    level="ERROR",
                    file=filepath,
                    line=i,
                    message=f"Policy permissiva (true) sem justificativa documentada: {line.strip()!r}"
                ))
            else:
                findings.append(Finding(
                    level="INFO",
                    file=filepath,
                    line=i,
                    message=f"Policy permissiva (true) COM justificativa — revisar: {line.strip()!r}"
                ))

    return findings


def audit(migrations_dir: Path, schema_filter: Optional[str], strict: bool) -> list[Finding]:
    files = load_migrations(migrations_dir)
    if not files:
        return []

    # Agrega conteúdo de todas as migrations para análise global
    all_content = "\n".join(content for _, content in files)
    all_tables = set()
    rls_enabled = set()
    all_policies: dict[str, list[dict]] = {}
    findings: list[Finding] = []

    for filepath, content in files:
        fname = str(filepath)
        all_tables |= extract_tables(content, schema_filter)
        rls_enabled |= extract_rls_enabled(content)
        for table, policies in extract_policies(content).items():
            all_policies.setdefault(table, []).extend(policies)
        findings.extend(find_permissive_policies(content, fname))

    # Tabelas sem RLS habilitado
    tables_without_rls = all_tables - rls_enabled
    for table in sorted(tables_without_rls):
        # Ignora tabelas de sistema e algumas conhecidas como públicas
        if any(skip in table for skip in ["schema_migrations", "spatial_ref"]):
            continue
        findings.append(Finding(
            level="ERROR",
            file=str(migrations_dir),
            line=0,
            message=f"Tabela sem RLS habilitado: {table} — adicione: ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;"
        ))

    # Tabelas com RLS mas sem policies (acesso bloqueado totalmente — pode ser intencional)
    tables_rls_no_policy = rls_enabled - set(all_policies.keys())
    for table in sorted(tables_rls_no_policy):
        findings.append(Finding(
            level="WARNING",
            file=str(migrations_dir),
            line=0,
            message=f"Tabela com RLS habilitado mas SEM policies: {table} — acesso totalmente bloqueado. "
                    f"Se intencional, documente com comentário na migration."
        ))

    return findings


def main() -> int:
    args = parse_args()
    migrations_dir = Path(args.migrations_dir)

    if not migrations_dir.exists():
        print(f"ERRO: diretório não encontrado: {migrations_dir}")
        return 1

    print(f"Auditando RLS em: {migrations_dir.resolve()}")
    if args.schema:
        print(f"Filtrando schema: {args.schema}")
    print()

    findings = audit(migrations_dir, args.schema, args.strict)

    errors = [f for f in findings if f.level == "ERROR"]
    warnings = [f for f in findings if f.level == "WARNING"]
    infos = [f for f in findings if f.level == "INFO"]

    for f in findings:
        prefix = {"ERROR": "❌", "WARNING": "⚠️ ", "INFO": "ℹ️ "}.get(f.level, "  ")
        location = f"  {f.file}" + (f":{f.line}" if f.line else "")
        print(f"{prefix} [{f.level}] {f.message}")
        print(location)
        print()

    print(f"Resultado: {len(errors)} erros, {len(warnings)} avisos, {len(infos)} informações")

    if errors:
        print("\nFALHA: corrija os ERROs acima antes de continuar.")
        return 1

    if warnings and args.strict:
        print("\nFALHA (--strict): corrija os AVISOSs acima.")
        return 1

    if not findings:
        print("✅ Nenhum problema encontrado. RLS configurado corretamente.")
    elif not errors:
        print("✅ Sem erros críticos. Revise os avisos acima.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
