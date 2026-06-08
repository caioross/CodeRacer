import type { Metadata } from "next";
import { RoomView } from "@/components/RoomView";
import { ToastProvider } from "@/components/ui/Toast";

// Rooms are ephemeral and in-memory — keep them out of search indexes, but give
// them a friendly per-room title for browser tabs and shared chat previews.
export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const code = params.id.toUpperCase().slice(0, 6);
  return {
    title: `Sala ${code} — entre na corrida`,
    description: `Entre na sala ${code} e dispute quem digita o código mais rápido no CodeRacer.`,
    robots: { index: false, follow: false },
    alternates: { canonical: `/room/${code}` }
  };
}

export default function RoomPage({ params }: { params: { id: string } }) {
  return (
    <ToastProvider>
      <RoomView roomCode={params.id.toUpperCase()} />
    </ToastProvider>
  );
}
