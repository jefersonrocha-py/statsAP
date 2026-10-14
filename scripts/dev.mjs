// Desenvolvimento: sobe o Next na porta definida em PORT no .env (sem porta padrão).
import { spawn } from "node:child_process";
import path from "node:path";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), true);

const port = process.env.PORT?.trim();
if (!port) {
  console.error("PORT não definida: informe a porta no .env.");
  process.exit(1);
}

const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev", "-p", port], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
