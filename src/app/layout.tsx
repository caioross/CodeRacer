import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodeRacer — race your friends, one keystroke at a time",
  description:
    "Multiplayer typing race for programmers. No signup. Pick a language, share a room link, type fast, win.",
  icons: { icon: "/favicon.svg" }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
