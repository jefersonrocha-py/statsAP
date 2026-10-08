import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));
const resolveDir = (dir: string) => path.resolve(root, dir).replace(/\\/g, "/");

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@lib\/(.*)$/, replacement: `${resolveDir("lib")}/$1` },
      { find: /^@services\/(.*)$/, replacement: `${resolveDir("services")}/$1` },
      { find: /^@components\/(.*)$/, replacement: `${resolveDir("components")}/$1` },
      { find: /^@store\/(.*)$/, replacement: `${resolveDir("store")}/$1` },
      { find: /^server-only$/, replacement: `${resolveDir("tests/stubs")}/server-only.ts` },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    clearMocks: true,
    unstubGlobals: true,
  },
});
