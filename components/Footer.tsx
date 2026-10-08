"use client";

import { useMemo } from "react";
import Image from "next/image";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLinkedin } from "@fortawesome/free-brands-svg-icons";
import { faEnvelope, faGlobe, faLocationDot } from "@fortawesome/free-solid-svg-icons";

const CONTACT = {
  email: "infraestrutura@etheriumtech.com.br",
  address: "Rua Bonnard, 980 - Bloco 10 - Green Valley Office Park - Barueri/SP",
};

const CHANNELS = [
  { href: "https://etheriumtech.com.br", label: "Site", icon: faGlobe },
  { href: `mailto:${CONTACT.email}`, label: "Email", icon: faEnvelope },
] as const;

const TEAM = [
  {
    name: "Jeferson Oliveira",
    role: "Network Engineer",
    href: "https://www.linkedin.com/in/jeferson-rocha-1b494b1b5",
  },
  {
    name: "Marcos Ribeiro",
    role: "Software Engineer",
    href: "https://linkedin.com/in/marcos-ribeiro-de-sousa-782b7782",
  },
  {
    name: "Mickael Lelis",
    role: "DevOps/SRE",
    href: "https://linkedin.com/in/mickael-l-079743133",
  },
] as const;

const PRODUCT_COPY =
  "Stats A.P monitora APs Grandstream via GDMS, consolida status online/offline, exporta a base operacional e oferece visibilidade em mapa, dashboard e configurações.";

export default function Footer() {
  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <footer
      role="contentinfo"
      className="glass relative mt-8 w-full overflow-hidden rounded-3xl"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/10" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(140px_80px_at_12%_-10%,rgba(16,185,129,0.10),transparent),radial-gradient(140px_80px_at_88%_115%,rgba(59,130,246,0.10),transparent)]"
      />

      <div className="relative z-10 px-4 py-6 md:px-6 md:py-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
          <div className="space-y-4">
            <Image
              src="/logo_etherium.png"
              alt="Etheriumtech"
              width={320}
              height={88}
              className="h-12 w-auto"
            />

            <p className="max-w-2xl text-sm leading-6 opacity-85 md:text-[15px]">{PRODUCT_COPY}</p>

            <a
              href={`mailto:${CONTACT.email}`}
              className="surface-soft-hover inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/20"
            >
              <FontAwesomeIcon icon={faEnvelope} className="h-4 w-4" />
              Fale conosco por email
            </a>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] opacity-65">Contato</h2>
              <ContactLine icon={faEnvelope} href={`mailto:${CONTACT.email}`} label={CONTACT.email} />
              <ContactLine icon={faLocationDot} label={CONTACT.address} />
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] opacity-65">Canais</h2>
              <div className="flex items-center gap-2">
                {CHANNELS.map((channel) => (
                  <IconButton
                    key={channel.label}
                    href={channel.href}
                    label={channel.label}
                    icon={channel.icon}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 border-t border-black/10 pt-6 dark:border-white/10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] opacity-65">Powered by</div>
            <ul className="mt-3 space-y-2 text-sm">
              {TEAM.map((member) => (
                <li key={member.name}>
                  <TeamLink href={member.href} name={member.name} role={member.role} />
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <p className="text-xs opacity-70">&copy; {year} Todos os direitos reservados.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function ContactLine({
  icon,
  label,
  href,
}: {
  icon: IconDefinition;
  label: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="surface-soft inline-flex h-9 w-9 items-center justify-center rounded-full">
        <FontAwesomeIcon icon={icon} className="h-4 w-4" />
      </span>
      <span className="text-sm opacity-85">{label}</span>
    </>
  );

  if (!href) {
    return <div className="flex items-start gap-3">{content}</div>;
  }

  return (
    <a href={href} className="flex items-start gap-3 transition hover:opacity-100">
      {content}
    </a>
  );
}

function IconButton({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: IconDefinition;
}) {
  const external = !href.startsWith("mailto:");

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      aria-label={label}
      title={label}
      className="surface-soft-hover inline-flex h-10 w-10 items-center justify-center rounded-2xl transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/20"
    >
      <FontAwesomeIcon icon={icon} className="h-4 w-4" />
    </a>
  );
}

function TeamLink({
  href,
  name,
  role,
}: {
  href: string;
  name: string;
  role: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 transition hover:opacity-100"
      aria-label={`Abrir LinkedIn de ${name}`}
      title={`LinkedIn de ${name}`}
    >
      <span className="surface-soft inline-flex h-8 w-8 items-center justify-center rounded-full">
        <FontAwesomeIcon icon={faLinkedin} className="h-4 w-4" />
      </span>
      <span>
        <strong>{name}</strong> <span className="opacity-70">- {role}</span>
      </span>
    </a>
  );
}
