"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Props = {
  name: string;
  avatarUrl?: string | null;
  // Lado do quadrado, em pixels.
  size?: number;
  className?: string;
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// Foto de perfil; sem foto (ou se ela não carregar), as iniciais do nome.
export default function UserAvatar({ name, avatarUrl, size = 40, className = "" }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);

  const showImage = Boolean(avatarUrl) && !failed;

  return (
    <span
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-600/90 font-semibold text-white ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden={showImage ? undefined : true}
    >
      {showImage ? (
        <Image
          src={avatarUrl as string}
          alt={`Foto de ${name}`}
          width={size}
          height={size}
          unoptimized
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
