import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Harness · Resultado",
  robots: { index: false, follow: false }
};

// Harness só-de-dev das telas pós-corrida (issue #37).
//
// O gate é `NODE_ENV`, uma variável de BUILD (não um query-param, que injetaria caminho
// de dev no bundle de produção e seria acionável por qualquer visitante). Ele aparece
// duas vezes, por dois motivos diferentes:
//
// 1. Aqui, síncrono: em produção a rota cai no `notFound()` e renderiza a tela de 404 do
//    app. (O status HTTP sai 200 — o app tem `src/app/loading.tsx` na raiz e o shell é
//    enviado antes do `notFound()` resolver; `force-dynamic` e guard em `generateMetadata`
//    foram medidos e não mudam isso. O que importa para o AC é o item 2.)
// 2. Em `HarnessBody`: no build de produção o webpack substitui `NODE_ENV` por literal, o
//    ramo vira constante-falso e o `import()` dentro dele é eliminado — HarnessClient e os
//    fixtures não entram no output. Um `import` estático no topo seria bundlado assim mesmo,
//    mesmo com o `notFound()` acima.
export default function HarnessResultsPage({
  searchParams
}: {
  searchParams: { n?: string; leader?: string };
}) {
  if (process.env.NODE_ENV === "production") notFound();
  return <HarnessBody scenario={searchParams.n} isLeader={searchParams.leader !== "0"} />;
}

async function HarnessBody({ scenario, isLeader }: { scenario?: string; isLeader: boolean }) {
  if (process.env.NODE_ENV !== "production") {
    const { HarnessClient } = await import("./HarnessClient");
    return <HarnessClient scenario={scenario} isLeader={isLeader} />;
  }
  return null;
}
