import { RoomView } from "@/components/RoomView";
import { ToastProvider } from "@/components/ui/Toast";

export default function RoomPage({ params }: { params: { id: string } }) {
  return (
    <ToastProvider>
      <RoomView roomCode={params.id.toUpperCase()} />
    </ToastProvider>
  );
}
