import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Harness · Corrida",
  robots: { index: false, follow: false }
};

// Harness só-de-dev da CORRIDA (issue #54) — irmão do harness pós-corrida (#37),
// com o mesmo gate de duas camadas e pelos mesmos dois motivos:
//
// 1. Aqui, síncrono: em produção a rota cai no `notFound()`. (O status HTTP sai
//    200 por causa do `src/app/loading.tsx` na raiz — o shell é enviado antes de
//    o `notFound()` resolver. O que garante o AC é o item 2.)
// 2. Em `HarnessBody`: no build de produção o webpack substitui `NODE_ENV` por
//    literal, o ramo vira constante-falso e o `import()` dentro dele é eliminado
//    — HarnessClient e os fixtures não entram no output. Um `import` estático no
//    topo seria bundlado mesmo com o `notFound()` acima.
export default function HarnessRacePage({
  searchParams
}: {
  searchParams: { n?: string };
}) {
  if (process.env.NODE_ENV === "production") notFound();
  return <HarnessBody scenario={searchParams.n} />;
}

async function HarnessBody({ scenario }: { scenario?: string }) {
  if (process.env.NODE_ENV !== "production") {
    const { HarnessClient } = await import("./HarnessClient");
    return <HarnessClient scenario={scenario} />;
  }
  return null;
}
