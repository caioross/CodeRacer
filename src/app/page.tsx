import { HomeView } from "@/components/HomeView";
import { ToastProvider } from "@/components/ui/Toast";

export default function HomePage() {
  return (
    <ToastProvider>
      <HomeView />
    </ToastProvider>
  );
}
