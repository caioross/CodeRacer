import { describe, it, expect, vi, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { persistMatch } from "./persistMatch";
import type { ResultRow, RoomRow } from "./room";

const room = {
  code: "ABC123",
  language: "typescript",
  difficulty: "medium",
  snippet: { title: "reduce" },
  players: [],
  status: "finished"
} as unknown as RoomRow;

const results: ResultRow[] = [
  {
    id: "p1",
    name: "Ana",
    color: "#f00",
    progress: 100,
    wpm: 80,
    accuracy: 97,
    errors: 3,
    place: 1,
    finished: true,
    finishedAt: 42_000
  },
  {
    id: "p2",
    name: "Bia",
    color: "#0f0",
    progress: 100,
    wpm: 61,
    accuracy: 92,
    errors: 9,
    place: 2,
    finished: true,
    finishedAt: 55_000
  }
];

type Outcome = { data?: unknown; error?: { code: string; message: string } | null };

/**
 * Dublê mínimo do `sb`: registra as chamadas e devolve o desfecho combinado por
 * tabela+operação. O supabase-js NÃO lança em erro de query — devolve `{ error }` —,
 * e é exatamente esse contrato que os caminhos abaixo exercitam.
 */
function fakeSupabase(outcomes: Record<string, Outcome>) {
  const calls: { op: string; arg?: unknown }[] = [];
  const client = {
    from(table: string) {
      return {
        insert(rows: unknown) {
          calls.push({ op: `insert:${table}`, arg: rows });
          const res = outcomes[`insert:${table}`] ?? { data: null, error: null };
          return {
            select: () => ({ single: async () => res }),
            // `scores` não encadeia `.select()`: o insert é aguardado direto.
            then: (ok: (v: Outcome) => unknown) => Promise.resolve(res).then(ok)
          };
        },
        delete() {
          return {
            eq: async (_col: string, id: unknown) => {
              calls.push({ op: `delete:${table}`, arg: id });
              return outcomes[`delete:${table}`] ?? { data: null, error: null };
            }
          };
        }
      };
    }
  };
  return { sb: client as unknown as SupabaseClient, calls };
}

const ops = (calls: { op: string }[]) => calls.map((c) => c.op);

afterEach(() => vi.restoreAllMocks());

describe("persistMatch", () => {
  it("caminho feliz: grava matches e scores, sem delete", async () => {
    const { sb, calls } = fakeSupabase({
      "insert:matches": { data: { id: "m1" }, error: null },
      "insert:scores": { data: null, error: null }
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await persistMatch(sb, room, results);
    expect(ops(calls)).toEqual(["insert:matches", "insert:scores"]);
    expect(err).not.toHaveBeenCalled();
  });

  it("matches falha: loga e NUNCA tenta gravar scores", async () => {
    const { sb, calls } = fakeSupabase({
      "insert:matches": { data: null, error: { code: "23514", message: "check violation" } }
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await persistMatch(sb, room, results);
    expect(ops(calls)).toEqual(["insert:matches"]);
    expect(err).toHaveBeenCalledTimes(1);
    expect(String(err.mock.calls[0])).toContain("23514");
  });

  it("matches sem erro e sem linha (PGRST116): loga e para", async () => {
    const { sb, calls } = fakeSupabase({ "insert:matches": { data: null, error: null } });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await persistMatch(sb, room, results);
    expect(ops(calls)).toEqual(["insert:matches"]);
    expect(err).toHaveBeenCalledTimes(1);
  });

  it("scores falha: apaga a matches recém-criada pelo id certo", async () => {
    const { sb, calls } = fakeSupabase({
      "insert:matches": { data: { id: "m1" }, error: null },
      "insert:scores": { data: null, error: { code: "42501", message: "rls" } }
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await persistMatch(sb, room, results);
    expect(ops(calls)).toEqual(["insert:matches", "insert:scores", "delete:matches"]);
    expect(calls[2].arg).toBe("m1");
    expect(err).toHaveBeenCalledTimes(1); // só o erro de scores; o rollback deu certo
  });

  it("scores falha e o delete também: não lança e loga a órfã", async () => {
    const { sb, calls } = fakeSupabase({
      "insert:matches": { data: { id: "m1" }, error: null },
      "insert:scores": { data: null, error: { code: "42501", message: "rls" } },
      "delete:matches": { data: null, error: { code: "42501", message: "rls" } }
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(persistMatch(sb, room, results)).resolves.toBeUndefined();
    expect(ops(calls)).toEqual(["insert:matches", "insert:scores", "delete:matches"]);
    expect(err).toHaveBeenCalledTimes(2);
    expect(String(err.mock.calls[1])).toContain("rollback");
  });

  it("results vazio: nenhum insert (buildMatchRow devolve null)", async () => {
    const { sb, calls } = fakeSupabase({});
    await persistMatch(sb, room, []);
    expect(calls).toEqual([]);
  });

  it("exceção de verdade não escapa da função", async () => {
    const sb = {
      from() {
        throw new Error("network down");
      }
    } as unknown as SupabaseClient;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(persistMatch(sb, room, results)).resolves.toBeUndefined();
    expect(String(err.mock.calls[0])).toContain("network down");
  });

  it("o log não vaza nick de jogador", async () => {
    const { sb } = fakeSupabase({
      "insert:matches": { data: null, error: { code: "23514", message: "check violation" } }
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await persistMatch(sb, room, results);
    const logged = err.mock.calls.flat().join(" ");
    expect(logged).not.toContain("Ana");
    expect(logged).not.toContain("Bia");
  });
});
