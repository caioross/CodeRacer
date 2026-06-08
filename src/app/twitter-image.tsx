// Twitter/X share image reuses the Open Graph card.
// runtime must be a string literal (Next can't read it through a re-export).
export const runtime = "edge";
export { default, alt, size, contentType } from "./opengraph-image";
