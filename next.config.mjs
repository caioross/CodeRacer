/** @type {import('next').NextConfig} */
const nextConfig = {
  // nucleo: o deploy da casa roda `node .` sobre o server.js do standalone.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // O build do ammo.js vem do emscripten e referencia `fs`/`path` para o
      // caminho Node, que nunca é tomado no navegador. Sem estes stubs o
      // webpack quebra o build inteiro tentando resolvê-los (#99).
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false
      };
    }
    return config;
  }
};
export default nextConfig;
