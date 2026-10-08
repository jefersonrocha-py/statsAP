import Image from "next/image";

type Props = {
  // full: símbolo + nome do produto; icon: só o símbolo (sidebar recolhida).
  variant?: "full" | "icon";
  // Em fundos escuros (sidebar) o símbolo verde-petróleo some; inverted o deixa branco.
  inverted?: boolean;
  className?: string;
};

export default function BrandMark({ variant = "full", inverted = false, className = "" }: Props) {
  const showName = variant === "full";

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <Image
        src="/logo_etherium.png"
        alt={showName ? "" : "Stats A.P · Etheriumtech"}
        width={346}
        height={369}
        priority
        className="h-9 w-auto shrink-0"
        style={inverted ? { filter: "brightness(0) invert(1)" } : undefined}
      />
      {showName ? (
        <span className="min-w-0 leading-tight">
          <span className="block text-base font-semibold tracking-wide">Stats A.P</span>
          <span
            className={`block text-[11px] uppercase tracking-[0.2em] ${inverted ? "text-white/60" : "opacity-60"}`}
          >
            Etheriumtech
          </span>
        </span>
      ) : null}
    </span>
  );
}
