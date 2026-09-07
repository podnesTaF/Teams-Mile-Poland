/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Marki i zdjęcia wydarzenia są obecnie hostowane na głównej domenie.
    // Po integracji z resztą serwisu (jedno repo / jeden origin) tę listę
    // można usunąć i podawać ścieżki względne z /public.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "poland.acebattle.run",
      },
    ],
  },
  // Uwaga: przekierowanie "/" -> "/{locale}" NIE jest tu zdefiniowane
  // celowo — obsługuje je middleware.ts (wykrywanie języka przeglądarki),
  // a app/page.tsx jest zapasowym fallbackiem na wypadek, gdyby middleware
  // został pominięty (np. w niestandardowej konfiguracji CDN).
};

export default nextConfig;
