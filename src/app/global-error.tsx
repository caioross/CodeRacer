"use client";

// Last-resort boundary for errors thrown in the root layout itself.
// It must render its own <html> and <body>.
export default function GlobalError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#05060a",
          color: "#e6edf3",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: "#00ff88" }}>{">_"}</div>
          <h1 style={{ fontSize: 22, marginTop: 12 }}>o CodeRacer travou feio</h1>
          <p style={{ color: "#7d8590", fontSize: 14, marginTop: 8 }}>
            // recarregue para voltar à pista
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              padding: "10px 22px",
              background: "#00ff88",
              color: "#05060a",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit"
            }}
          >
            recarregar
          </button>
        </div>
      </body>
    </html>
  );
}
