import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

// Edge runtime: @vercel/og embeds its font here (no Node fileURLToPath), so the
// image builds and renders reliably across platforms.
export const runtime = "edge";
export const alt = SITE.ogImageAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social share card — dark "terminal window" with the wordmark, tagline,
// feature chips and a stylized race track. No emoji / no remote font so the
// build never depends on the network.
export default function OpengraphImage() {
  const green = "#00ff88";
  const cyan = "#00e5ff";
  const violet = "#a855f7";
  const ink = "#05060a";
  const racers = [
    { color: green, pct: 96 },
    { color: cyan, pct: 78 },
    { color: violet, pct: 61 },
    { color: "#fbbf24", pct: 44 }
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 64,
          background: ink,
          // satori supports linear-gradient reliably (not pixel-sized radial) —
          // green glow from the top-left, cyan from the bottom-right.
          backgroundImage:
            "linear-gradient(135deg, rgba(0,255,136,0.18), transparent 42%), linear-gradient(315deg, rgba(0,229,255,0.14), transparent 42%)",
          fontFamily: "monospace",
          color: "#e6edf3"
        }}
      >
        {/* terminal chrome */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ width: 16, height: 16, borderRadius: 16, background: "#ff3860" }} />
          <div style={{ width: 16, height: 16, borderRadius: 16, background: "#fbbf24" }} />
          <div style={{ width: 16, height: 16, borderRadius: 16, background: green }} />
          <div style={{ marginLeft: 16, fontSize: 24, color: "#7d8590" }}>
            ~/coderacer — race
          </div>
        </div>

        {/* wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 40 }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              color: green,
              textShadow: "0 0 32px rgba(0,255,136,0.7)"
            }}
          >
            {">_"}
          </div>
          <div style={{ display: "flex", fontSize: 110, fontWeight: 800, letterSpacing: -2 }}>
            <span style={{ color: green }}>Code</span>
            <span style={{ color: "#e6edf3" }}>Racer</span>
          </div>
        </div>

        {/* tagline — satori requires display:flex on any multi-child element */}
        <div style={{ display: "flex", marginTop: 16, fontSize: 36, color: "#9aa4b2", maxWidth: 1000 }}>
          <span style={{ color: green, marginRight: 10 }}>//</span>
          <span>quem digita o código mais rápido, vence.</span>
        </div>

        {/* chips */}
        <div style={{ display: "flex", gap: 16, marginTop: 36 }}>
          {[
            { t: "tempo real", c: green },
            { t: "multiplayer", c: cyan },
            { t: "8 linguagens", c: violet }
          ].map(chip => (
            <div
              key={chip.t}
              style={{
                display: "flex",
                fontSize: 26,
                color: chip.c,
                border: `2px solid ${chip.c}55`,
                borderRadius: 999,
                padding: "8px 24px",
                background: "rgba(15,18,32,0.6)"
              }}
            >
              {chip.t}
            </div>
          ))}
        </div>

        {/* race track */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: "auto" }}>
          {racers.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  width: 1000,
                  height: 14,
                  borderRadius: 999,
                  background: "#0a0c14",
                  border: "1px solid #1a1f33"
                }}
              >
                <div
                  style={{
                    width: `${r.pct}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: r.color,
                    boxShadow: `0 0 18px ${r.color}`
                  }}
                />
              </div>
              <div style={{ display: "flex", fontSize: 22, color: r.color, width: 90 }}>
                {120 - i * 18} wpm
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
