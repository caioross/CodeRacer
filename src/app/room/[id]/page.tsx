import type { Metadata } from "next";
import { RoomView } from "@/components/RoomView";
import { ToastProvider } from "@/components/ui/Toast";
import { getServerI18n } from "@/i18n/server";

// Rooms are ephemeral and in-memory — keep them out of search indexes, but give
// them a friendly per-room title for browser tabs and shared chat previews.
// #118: o robots.txt NÃO bloqueia mais /room/ — robô de unfurl (WhatsApp, Slack,
// Discord, X) respeita robots e, bloqueado, o convite saía sem card. A página continua
// fora do índice pelo `noindex` daqui; `follow` liberado para o card achar a imagem.
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const code = params.id.toUpperCase().slice(0, 6);
  const { t } = await getServerI18n();
  const title = t("meta.roomTitle", { code });
  const description = t("meta.roomDescription", { code });
  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: { canonical: `/room/${code}` },
    openGraph: { title, description, url: `/room/${code}` },
    twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image"] }
  };
}

export default function RoomPage({ params }: { params: { id: string } }) {
  return (
    <ToastProvider>
      <RoomView roomCode={params.id.toUpperCase()} />
    </ToastProvider>
  );
}
