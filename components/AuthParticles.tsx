"use client";

import Particles from "react-tsparticles";
import type { Engine, ISourceOptions } from "tsparticles-engine";
import { loadSlim } from "tsparticles-slim";

// Opções fixas: as telas de autenticação não seguem o tema do app (lib/themeScope.ts), e as
// partículas nunca são recriadas.
const PARTICLE_COLOR = "#065f46"; // emerald-800: contrasta no fundo claro

const OPTIONS: ISourceOptions = {
  fullScreen: false,
  background: { color: "transparent" },
  detectRetina: true,
  fpsLimit: 60,
  particles: {
    number: { value: 50, density: { enable: true, area: 900 } },
    color: { value: PARTICLE_COLOR },
    opacity: { value: 0.28 },
    size: { value: { min: 1.2, max: 2.6 } },
    links: {
      enable: true,
      color: PARTICLE_COLOR,
      opacity: 0.2,
      distance: 150,
      width: 1.1,
    },
    move: { enable: true, speed: 0.32, outModes: { default: "out" } },
  },
  interactivity: {
    events: { resize: true },
  },
};

async function particlesInit(engine: Engine) {
  await loadSlim(engine);
}

/**
 * Partículas leves para telas de auth.
 * - Wrapper (pai) com `relative isolate`
 * - Este canvas fica em `z-0`; card principal em `z-10`
 */
export default function AuthParticles() {
  return (
    <Particles
      id="auth-particles"
      init={particlesInit}
      className="pointer-events-none absolute inset-0 z-0"
      options={OPTIONS}
    />
  );
}
