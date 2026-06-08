import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // dark hacker palette
        bg: {
          DEFAULT: "#05060a",
          soft: "#0a0c14",
          card: "#0f1220",
          line: "#1a1f33"
        },
        neon: {
          green: "#00ff88",
          cyan: "#00e5ff",
          violet: "#a855f7",
          red: "#ff3860",
          amber: "#fbbf24"
        },
        text: {
          DEFAULT: "#e6edf3",
          muted: "#7d8590",
          dim: "#484f58"
        }
      },
      fontFamily: {
        mono: [
          "var(--font-jetbrains)",
          "JetBrains Mono",
          "Fira Code",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace"
        ],
        display: ["var(--font-jetbrains)", "JetBrains Mono", "ui-monospace", "monospace"]
      },
      boxShadow: {
        glow: "0 0 24px rgba(0, 255, 136, 0.25), 0 0 4px rgba(0, 255, 136, 0.4)",
        "glow-cyan": "0 0 24px rgba(0, 229, 255, 0.25), 0 0 4px rgba(0, 229, 255, 0.4)",
        "glow-violet": "0 0 24px rgba(168, 85, 247, 0.25), 0 0 4px rgba(168, 85, 247, 0.4)",
        "glow-red": "0 0 24px rgba(255, 56, 96, 0.25), 0 0 4px rgba(255, 56, 96, 0.4)"
      },
      backgroundImage: {
        grid:
          "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
        "radial-fade":
          "radial-gradient(ellipse at top, rgba(0,255,136,0.08), transparent 60%)"
      },
      backgroundSize: { grid: "40px 40px" },
      keyframes: {
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" }
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" }
        },
        blink: {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" }
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0px rgba(0,255,136,0.0)" },
          "50%": { boxShadow: "0 0 24px rgba(0,255,136,0.6)" }
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        gradientShift: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" }
        }
      },
      animation: {
        flicker: "flicker 2.4s infinite",
        scan: "scan 4s linear infinite",
        blink: "blink 1s steps(1) infinite",
        pulseGlow: "pulseGlow 2s ease-in-out infinite",
        fadeUp: "fadeUp 0.4s ease-out both",
        gradientShift: "gradientShift 6s ease infinite"
      }
    }
  },
  plugins: []
};

export default config;
