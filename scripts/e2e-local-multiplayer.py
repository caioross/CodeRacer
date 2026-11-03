#!/usr/bin/env python3
"""E2E do multiplayer com o tempo real PRÓPRIO (NEXT_PUBLIC_REALTIME=local, sem Supabase Realtime).

Dois navegadores (Chromium do Playwright, um processo cada) jogam uma partida inteira contra o
app já no ar: A cria a sala, B entra pelo código, os dois conversam no chat, B fica pronto, A
inicia, os dois digitam o snippet inteiro, os dois veem o pódio, B fecha a aba e A vê a saída.
No fim confere que `matches`/`scores` gravaram (pela API REST, se houver, e pelo /leaderboard).

Uso (o app tem de estar rodando com NEXT_PUBLIC_REALTIME=local e um banco de teste):
    python scripts/e2e-local-multiplayer.py --base-url http://127.0.0.1:3418 \
        [--rest-url http://127.0.0.1:54331/rest/v1] [--shots DIR] [--headed]
A chave anon do REST, quando houver, vem SÓ do ambiente (E2E_REST_KEY) — nunca de argumento
nem do código. Sem ela, a persistência é conferida só pelo /leaderboard.

Latência medida: do `fetch` (POST /api/rt) que leva um `progress` no navegador que digita até o
evento `broadcast` chegar ao EventSource do outro navegador (mesma máquina, mesmo relógio).
Sai com código 1 se qualquer conferência falhar.
"""
import argparse
import json
import os
import secrets
import statistics
import sys
import time
import urllib.error
from datetime import datetime
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

# Instrumentação injetada antes do app: anota cada broadcast que sai (fetch) e que chega (EventSource).
INIT_JS = r"""
(() => {
  const rt = { sent: [], recv: [] };
  Object.defineProperty(window, "__rt", { value: rt });
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = String((input && input.url) || input);
      if (url.includes("/api/rt/") && init && init.method === "POST" && typeof init.body === "string") {
        const b = JSON.parse(init.body);
        if (b.type === "broadcast") {
          const t = Date.now();
          for (const m of b.messages || [{ event: b.event, payload: b.payload }]) {
            const p = m.payload || {};
            rt.sent.push({ t, event: m.event, id: p.id || p.playerId, p: p.progress, f: p.finishedAt, n: (b.messages || []).length });
          }
        }
      }
    } catch (e) {}
    return origFetch.apply(this, arguments);
  };
  const OrigES = window.EventSource;
  window.EventSource = class extends OrigES {
    constructor(url, cfg) {
      super(url, cfg);
      this.addEventListener("broadcast", ev => {
        try {
          const d = JSON.parse(ev.data);
          const p = d.payload || {};
          rt.recv.push({ t: Date.now(), event: d.event, id: p.id || p.playerId, p: p.progress, f: p.finishedAt });
        } catch (e) {}
      });
    }
  };
})();
"""

ROW_WPM_JS = r"""
(nick) => {
  for (const s of document.querySelectorAll("span")) {
    if (s.textContent.trim() !== nick) continue;
    const m = s.parentElement && s.parentElement.textContent.match(/(\d+) wpm/);
    if (m) return Number(m[1]);
  }
  return null;
}
"""

checks = []


def check(name, ok, detail=""):
    checks.append({"check": name, "ok": bool(ok), "detail": detail})
    print(("  OK   " if ok else "  FALHOU ") + name + (f" — {detail}" if detail else ""), flush=True)
    return ok


def http_json(url, headers=None, timeout=10):
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"null")
        except Exception:
            return e.code, None


def latency_stats(sent, recv, sender_id):
    """Casa cada progress enviado com a 1ª chegada igual no outro navegador."""
    used = set()
    lat = []
    for s in sent:
        if s["event"] != "progress" or s["id"] != sender_id:
            continue
        for i, r in enumerate(recv):
            if i in used or r["event"] != "progress" or r["id"] != sender_id:
                continue
            if r["p"] == s["p"] and r["f"] == s["f"] and r["t"] >= s["t"] - 5:
                used.add(i)
                lat.append(r["t"] - s["t"])
                break
    n_sent = sum(1 for s in sent if s["event"] == "progress" and s["id"] == sender_id)
    if not lat:
        return {"sent": n_sent, "matched": 0}
    lat.sort()
    return {
        "sent": n_sent,
        "matched": len(lat),
        "mean_ms": round(statistics.mean(lat), 1),
        "p50_ms": lat[len(lat) // 2],
        "p95_ms": lat[min(len(lat) - 1, int(len(lat) * 0.95))],
        "max_ms": lat[-1],
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base-url", default=os.environ.get("E2E_BASE_URL", "http://127.0.0.1:3418"))
    ap.add_argument("--rest-url", default=os.environ.get("E2E_REST_URL"))
    ap.add_argument("--shots", default=os.environ.get("E2E_SHOTS", r"E:\Data\jogos-2026\coderacer\capturas\e2e-local"))
    ap.add_argument("--delay", type=int, default=45, help="ms entre teclas (abaixo de ~35 o WPM passa do teto anti-cheat)")
    ap.add_argument("--headed", action="store_true")
    args = ap.parse_args()
    base = args.base_url.rstrip("/")
    rest_key = os.environ.get("E2E_REST_KEY")
    shots = Path(args.shots)
    shots.mkdir(parents=True, exist_ok=True)
    tag = secrets.token_hex(2)
    nick_a, nick_b = f"ana_{tag}", f"bia_{tag}"
    print(f"e2e local · {base} · nicks {nick_a}/{nick_b}", flush=True)

    st, body = http_json(f"{base}/api/rt/coderacer:room:ZZZZZZ?key=e2e")
    check("transporte local ligado (/api/rt responde pela sala, não 'desligado')",
          st == 404 and body and "desligado" not in str(body.get("error")), f"{st} {body}")

    errors = {"A": [], "B": []}
    with sync_playwright() as pw:
        browsers = [pw.chromium.launch(headless=not args.headed) for _ in range(2)]
        ctx_a = browsers[0].new_context(locale="pt-BR", viewport={"width": 1280, "height": 900})
        ctx_b = browsers[1].new_context(locale="pt-BR", viewport={"width": 1280, "height": 900})
        for ctx in (ctx_a, ctx_b):
            ctx.add_init_script(INIT_JS)
        pa, pb = ctx_a.new_page(), ctx_b.new_page()
        for who, page in (("A", pa), ("B", pb)):
            page.on("pageerror", lambda e, w=who: errors[w].append(str(e)))
            page.on("console", lambda m, w=who: m.type == "error" and errors[w].append(m.text))

        # ── A cria a sala ────────────────────────────────────────────────────
        pa.goto(f"{base}/?lang=pt-BR")
        pa.get_by_label("Seu nick de jogador").fill(nick_a)
        pa.screenshot(path=str(shots / "01-home-a.png"))
        pa.get_by_role("button", name="Criar sala").click()
        pa.get_by_role("button", name="criar sala →").click()
        pa.wait_for_url("**/room/*", timeout=20_000)
        code = pa.url.rstrip("/").rsplit("/", 1)[1][:6].upper()
        pa.get_by_role("button", name="Iniciar partida").wait_for(timeout=20_000)
        check("A criou a sala e entrou no lobby", len(code) == 6, code)

        # ── B entra pelo código ──────────────────────────────────────────────
        pb.goto(f"{base}/?lang=pt-BR")
        pb.get_by_label("Seu nick de jogador").fill(nick_b)
        pb.get_by_label("Código de 6 letras da sala").fill(code)
        pb.get_by_role("button", name="Entrar na sala com o código").click()
        pb.wait_for_url(f"**/room/{code}", timeout=20_000)
        pb.get_by_role("button", name="Ficar pronto").wait_for(timeout=20_000)
        t0 = time.time()
        pa.get_by_text(nick_b).first.wait_for(timeout=10_000)
        check("presence: A vê B no lobby", True, f"{(time.time() - t0) * 1000:.0f} ms depois do lobby de B")
        pb.get_by_text(nick_a).first.wait_for(timeout=10_000)
        check("presence: B vê A no lobby", True)
        pa.screenshot(path=str(shots / "02-lobby-a.png"))

        # ── chat nos dois sentidos ───────────────────────────────────────────
        msg_a, msg_b = f"oi do A {tag}", f"oi do B {tag}"
        pa.get_by_label("// chat").fill(msg_a)
        pa.get_by_label("// chat").press("Enter")
        pb.get_by_text(msg_a).wait_for(timeout=5_000)
        pb.get_by_label("// chat").fill(msg_b)
        pb.get_by_label("// chat").press("Enter")
        pa.get_by_text(msg_b).wait_for(timeout=5_000)
        check("chat chega nos dois sentidos", True)
        pb.screenshot(path=str(shots / "03-lobby-chat-b.png"))

        # ── B pronto, A inicia ───────────────────────────────────────────────
        pb.get_by_role("button", name="Ficar pronto").click()
        start_btn = pa.get_by_role("button", name="Iniciar partida")
        deadline = time.time() + 10
        while time.time() < deadline and not start_btn.is_enabled():
            time.sleep(0.1)
        check("ready de B destrava o 'Iniciar' de A", start_btn.is_enabled())
        start_btn.click()

        room = None
        deadline = time.time() + 15
        while time.time() < deadline:
            st, body = http_json(f"{base}/api/rooms/{code}")
            room = (body or {}).get("room") or {}
            if room.get("status") == "racing" and room.get("snippet"):
                break
            time.sleep(0.2)
        snippet = (room or {}).get("snippet") or {}
        target = snippet.get("code") or ""
        check("start: sala em racing com snippet", bool(target), f"{snippet.get('title')} · {len(target)} chars")
        start_s = datetime.fromisoformat(room["start_at"].replace("Z", "+00:00")).timestamp()
        wait = start_s - time.time() + 0.4
        if wait > 0:
            time.sleep(min(wait, 6))

        # ── os dois digitam o snippet inteiro, linha a linha, alternando ─────
        areas = {"A": pa.locator("textarea").first, "B": pb.locator("textarea").first}
        areas["A"].click()
        areas["B"].click()
        lines = target.split("\n")
        mid_checked = False
        for i, line in enumerate(lines):
            for who, page in (("A", pa), ("B", pb)):
                text = line.lstrip(" \t")  # Enter já põe a indentação da linha seguinte
                if text:
                    page.keyboard.type(text, delay=args.delay)
                if i < len(lines) - 1:
                    page.keyboard.press("Enter")
            if not mid_checked and i >= len(lines) // 2:
                mid_checked = True
                time.sleep(0.5)
                wpm_b_on_a = pa.evaluate(ROW_WPM_JS, nick_b)
                wpm_a_on_b = pb.evaluate(ROW_WPM_JS, nick_a)
                check("pista de A mostra o progresso de B (meio da corrida)", (wpm_b_on_a or 0) > 0, f"{wpm_b_on_a} wpm")
                check("pista de B mostra o progresso de A (meio da corrida)", (wpm_a_on_b or 0) > 0, f"{wpm_a_on_b} wpm")
                pa.screenshot(path=str(shots / "04-corrida-a.png"))
                pb.screenshot(path=str(shots / "05-corrida-b.png"))

        # ── pódio nos dois ───────────────────────────────────────────────────
        t_end = time.time()
        for who, page in (("A", pa), ("B", pb)):
            page.get_by_text("Partida finalizada").wait_for(timeout=20_000)
        check("os dois veem o pódio", True, f"{(time.time() - t_end) * 1000:.0f} ms depois da última tecla")
        for who, page in (("A", pa), ("B", pb)):
            ok = page.get_by_text("você terminou em").count() > 0
            check(f"{who} terminou com colocação", ok)
        pa.screenshot(path=str(shots / "06-podio-a.png"))
        pb.screenshot(path=str(shots / "07-podio-b.png"))
        st, body = http_json(f"{base}/api/rooms/{code}")
        results = ((body or {}).get("room") or {}).get("results") or []
        check("sala em finished com os dois nos results", sorted(r.get("name") for r in results) == sorted([nick_a, nick_b]),
              ", ".join(f"{r.get('place')}º {r.get('name')} {r.get('wpm')} wpm" for r in results))

        rt_a = pa.evaluate("window.__rt")
        rt_b = pb.evaluate("window.__rt")
        me_a = pa.evaluate(f"JSON.parse(sessionStorage.getItem('coderacer:room:{code}')).playerId")
        me_b = pb.evaluate(f"JSON.parse(sessionStorage.getItem('coderacer:room:{code}')).playerId")
        lat_ab = latency_stats(rt_a["sent"], rt_b["recv"], me_a)
        lat_ba = latency_stats(rt_b["sent"], rt_a["recv"], me_b)
        check("todo progress de A chegou a B", lat_ab.get("matched") == lat_ab.get("sent") and lat_ab["sent"] > 0, json.dumps(lat_ab))
        check("todo progress de B chegou a A", lat_ba.get("matched") == lat_ba.get("sent") and lat_ba["sent"] > 0, json.dumps(lat_ba))
        echo = sum(1 for r in rt_a["recv"] if r["id"] == me_a and r["event"] == "progress")
        check("sem eco: A não recebe o próprio progress", echo == 0, f"{echo}")
        batched = sum(1 for s in rt_a["sent"] + rt_b["sent"] if s.get("n", 1) > 1)

        # ── persistência ─────────────────────────────────────────────────────
        match = None
        if args.rest_url and rest_key:
            hdr = {"apikey": rest_key, "Authorization": f"Bearer {rest_key}"}
            rest = args.rest_url.rstrip("/")
            st, rows = http_json(f"{rest}/matches?room_code=eq.{code}&select=*", hdr)
            match = rows[0] if st == 200 and rows else None
            check("matches gravou a partida", match is not None and match.get("player_count") == 2,
                  f"vencedor {match and match.get('winner_name')} {match and match.get('winner_wpm')} wpm")
            if match:
                st, scores = http_json(f"{rest}/scores?match_id=eq.{match['id']}&select=name,wpm,accuracy,place", hdr)
                check("scores gravou os dois jogadores", st == 200 and sorted(s["name"] for s in scores) == sorted([nick_a, nick_b]),
                      json.dumps(scores, ensure_ascii=False))
        lb = ctx_a.new_page()
        lb.goto(f"{base}/leaderboard?lang=pt-BR")
        lb.get_by_text(nick_a).first.wait_for(timeout=10_000)
        check("ranking global mostra os dois nicks", lb.get_by_text(nick_b).count() > 0)
        lb.screenshot(path=str(shots / "08-ranking.png"), full_page=True)
        lb.close()

        # ── B fecha a aba: A vê a saída (presence leave no fim do stream) ────
        t_close = time.time()
        ctx_b.close()
        pa.get_by_text(f"{nick_b} saiu").first.wait_for(timeout=10_000)
        leave_ms = (time.time() - t_close) * 1000
        check("fechar a aba de B vira 'saiu' para A", True, f"{leave_ms:.0f} ms (inclui os 400 ms de espera do useRoom)")
        pa.screenshot(path=str(shots / "09-saida-a.png"))

        check("sem erro de página nos dois navegadores", not errors["A"] and not errors["B"],
              json.dumps({k: v[:3] for k, v in errors.items()}, ensure_ascii=False))
        for b in browsers:
            b.close()

    summary = {
        "base": base,
        "room": code,
        "snippet": {"title": snippet.get("title"), "chars": len(target), "language": snippet.get("language")},
        "latency_progress_a_to_b": lat_ab,
        "latency_progress_b_to_a": lat_ba,
        "posts_em_lote": batched,
        "leave_ms": round(leave_ms),
        "checks_ok": sum(c["ok"] for c in checks),
        "checks_total": len(checks),
        "checks": checks,
    }
    (shots / "e2e-resultado.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v for k, v in summary.items() if k != "checks"}, indent=2, ensure_ascii=False))
    return 0 if all(c["ok"] for c in checks) else 1


if __name__ == "__main__":
    sys.exit(main())
