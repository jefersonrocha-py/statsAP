"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotateLeft, faRotateRight, faXmark } from "@fortawesome/free-solid-svg-icons";
import {
  bearingFromDrag,
  bearingLabel,
  normalizeBearing,
  pointerAngle,
  ROTATION_STEP_BUTTON,
  ROTATION_STEP_KEY,
  stepRotationTarget,
  type PendingRotation,
} from "@lib/mapRotation";

type Props = { map: MapLibreMap | null };

type DragState = { pointerId: number; startAngle: number; startBearing: number };

const ROTATE_DURATION_MS = 250;

const ROSE_MARKS = [
  { label: "N", angle: 0, className: "text-rose-300" },
  { label: "L", angle: 90, className: "text-white/75" },
  { label: "S", angle: 180, className: "text-white/75" },
  { label: "O", angle: 270, className: "text-white/75" },
];

function NeedleIcon({ bearing }: { bearing: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      style={{ transform: `rotate(${-bearing}deg)` }}
      aria-hidden="true"
    >
      <path d="M12 2 L16 12 L8 12 Z" fill="#f87171" />
      <path d="M12 22 L8 12 L16 12 Z" fill="#e2e8f0" />
      <circle cx="12" cy="12" r="1.6" fill="#0f172a" />
    </svg>
  );
}

export default function RotationControl({ map }: Props) {
  const [open, setOpen] = useState(false);
  const [bearing, setBearing] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dialRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingBearingRef = useRef<number | null>(null);
  const pendingRotationRef = useRef<PendingRotation | null>(null);

  // Só este componente re-renderiza durante a rotação, no máximo uma vez por quadro.
  useEffect(() => {
    if (!map) return;
    let raf: number | null = null;
    const sync = () => {
      if (raf !== null) return;
      raf = window.requestAnimationFrame(() => {
        raf = null;
        setBearing(map.getBearing());
      });
    };

    setBearing(map.getBearing());
    map.on("rotate", sync);
    return () => {
      map.off("rotate", sync);
      if (raf !== null) window.cancelAnimationFrame(raf);
    };
  }, [map]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    },
    []
  );

  const scheduleBearing = useCallback(
    (value: number) => {
      if (!map) return;
      pendingBearingRef.current = value;
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        const next = pendingBearingRef.current;
        pendingBearingRef.current = null;
        if (next !== null) map.setBearing(next);
      });
    },
    [map]
  );

  const angleAt = useCallback((clientX: number, clientY: number) => {
    const dial = dialRef.current;
    if (!dial) return 0;
    const rect = dial.getBoundingClientRect();
    return pointerAngle(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2));
  }, []);

  const rotateBy = useCallback(
    (delta: number) => {
      if (!map) return;
      const now = performance.now();
      const target = stepRotationTarget(map.getBearing(), pendingRotationRef.current, delta, now);
      pendingRotationRef.current = { target, expiresAt: now + ROTATE_DURATION_MS };
      map.easeTo({ bearing: target, duration: ROTATE_DURATION_MS });
    },
    [map]
  );

  const resetNorth = useCallback(() => {
    pendingRotationRef.current = null;
    map?.easeTo({ bearing: 0, duration: 300 });
  }, [map]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!map || event.button !== 0) return;
    event.preventDefault();
    pendingRotationRef.current = null;
    map.stop();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startAngle: angleAt(event.clientX, event.clientY),
      startBearing: map.getBearing(),
    };
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    scheduleBearing(bearingFromDrag(drag.startBearing, drag.startAngle, angleAt(event.clientX, event.clientY)));
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
  }

  function handleLostCapture() {
    dragRef.current = null;
    setDragging(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      rotateBy(ROTATION_STEP_KEY);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      rotateBy(-ROTATION_STEP_KEY);
    } else if (event.key === "Home") {
      event.preventDefault();
      resetNorth();
    }
  }

  const heading = Math.round(normalizeBearing(bearing)) % 360;
  const label = bearingLabel(bearing);

  return (
    <div className="pointer-events-auto flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950/80 text-white shadow-lg ring-1 ring-white/10 backdrop-blur-sm hover:bg-slate-900/90"
        title={open ? "Fechar controle de rotação" : "Abrir controle de rotação"}
        aria-label={open ? "Fechar controle de rotação" : "Abrir controle de rotação"}
        aria-expanded={open}
      >
        <NeedleIcon bearing={bearing} />
      </button>

      {open && (
        <div
          role="group"
          aria-label="Rotação do mapa"
          className="relative w-[156px] rounded-[22px] bg-slate-950/90 p-3 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
            title="Fechar controle"
            aria-label="Fechar controle"
          >
            <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
          </button>

          <div className="pr-6 text-[10px] uppercase tracking-[0.18em] text-white/50">Rotação</div>
          <div className="pr-6 text-xs font-semibold text-white/85">
            {heading}° · {label}
          </div>

          <div className="mt-3 flex justify-center">
            <div
              ref={dialRef}
              role="slider"
              tabIndex={0}
              aria-label="Orientação do mapa"
              aria-valuemin={0}
              aria-valuemax={359}
              aria-valuenow={heading}
              aria-valuetext={`${heading} graus, ${label}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onLostPointerCapture={handleLostCapture}
              onKeyDown={handleKeyDown}
              title="Arraste o anel para girar o mapa"
              className={`relative h-[112px] w-[112px] touch-none select-none rounded-full border border-white/10 outline-none
                bg-[radial-gradient(circle_at_30%_30%,rgba(148,163,184,0.22),rgba(71,85,105,0.35)_45%,rgba(2,6,23,0.96)_100%)]
                shadow-[inset_0_10px_22px_rgba(255,255,255,0.10),inset_0_-14px_24px_rgba(0,0,0,0.58)]
                focus-visible:ring-2 focus-visible:ring-sky-400
                ${dragging ? "cursor-grabbing ring-2 ring-sky-400/60" : "cursor-grab"}`}
            >
              <div className="pointer-events-none absolute inset-0" style={{ transform: `rotate(${-bearing}deg)` }}>
                {ROSE_MARKS.map((mark) => (
                  <span
                    key={mark.label}
                    className={`absolute left-1/2 top-1/2 text-[11px] font-semibold ${mark.className}`}
                    style={{
                      transform: `translate(-50%, -50%) rotate(${mark.angle}deg) translateY(-42px) rotate(${-mark.angle}deg)`,
                    }}
                  >
                    {mark.label}
                  </span>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-[30px] rounded-full border border-white/10 bg-black/30" />
              <div className="pointer-events-none absolute left-1/2 top-[3px] h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[7px] border-x-transparent border-t-sky-300" />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => rotateBy(ROTATION_STEP_BUTTON)}
              className="inline-flex h-8 items-center justify-center rounded-lg bg-white/10 text-sky-200 hover:bg-white/20"
              title="Girar 45° no sentido anti-horário"
              aria-label="Girar 45° no sentido anti-horário"
            >
              <FontAwesomeIcon icon={faRotateLeft} className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={resetNorth}
              className="inline-flex h-8 items-center justify-center rounded-lg bg-white/10 text-xs font-semibold text-rose-200 hover:bg-white/20"
              title="Alinhar ao norte"
              aria-label="Alinhar ao norte"
            >
              N
            </button>
            <button
              type="button"
              onClick={() => rotateBy(-ROTATION_STEP_BUTTON)}
              className="inline-flex h-8 items-center justify-center rounded-lg bg-white/10 text-sky-200 hover:bg-white/20"
              title="Girar 45° no sentido horário"
              aria-label="Girar 45° no sentido horário"
            >
              <FontAwesomeIcon icon={faRotateRight} className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="mt-2 text-[10px] leading-snug text-white/50">
            Arraste o anel para girar. Com o anel selecionado, as setas giram 15° e Home volta ao norte.
          </p>
        </div>
      )}
    </div>
  );
}
