import createNextIntlPlugin from "next-intl/plugin";
import withPWAInit from "next-pwa";

const withNextIntl = createNextIntlPlugin();

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  customWorkerDir: "worker",
  register: true,
  skipWaiting: true,
  fallbacks: {
    document: "/offline",
  },
  runtimeCaching: [
    {
      urlPattern: /^https?:\/\/.*\/(dashboard|incidents|proactive|observation-rounds).*$/,
      handler: "NetworkFirst",
      options: {
        cacheName: "safetrack-app-shell",
        expiration: {
          maxEntries: 40,
          maxAgeSeconds: 60 * 60 * 24 * 7,
        },
      },
    },
    {
      urlPattern: /^https?:\/\/.*\/api\/(?!ai\/).*$/,
      handler: "NetworkFirst",
      options: {
        cacheName: "safetrack-api",
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 80,
          maxAgeSeconds: 60 * 15,
        },
      },
    },
    {
      urlPattern: /^https?.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "safetrack-http",
        expiration: {
          maxEntries: 80,
          maxAgeSeconds: 60 * 60 * 24,
        },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withPWA(withNextIntl(nextConfig));
