import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icon — the ">_" terminal mark on the brand-dark tile.
// Uses solid colors + boxShadow only (satori has limited radial-gradient support).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#05060a",
          fontFamily: "monospace"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 132,
            height: 132,
            borderRadius: 32,
            background: "#0a0c14",
            border: "2px solid rgba(0,255,136,0.4)",
            boxShadow: "0 0 48px rgba(0,255,136,0.45)"
          }}
        >
          <div
            style={{
              fontSize: 84,
              fontWeight: 800,
              color: "#00ff88",
              textShadow: "0 0 24px rgba(0,255,136,0.8)"
            }}
          >
            {">_"}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
