"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, {
  LngLatBounds,
  NavigationControl,
  Popup,
  type LngLatBoundsLike,
  type LngLatLike,
  type MapMouseEvent,
  type Marker,
  type StyleSpecification,
} from "maplibre-gl";

import { api } from "@services/api";
import { connectSSE } from "@services/sseClient";
import RotationControl from "@components/map/RotationControl";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faWifi,
  faArrowsRotate,
  faMagnifyingGlass,
  faBars,
  faXmark,
  faCircleCheck,
  faCircleXmark,
  faBroom,
  faLocationCrosshairs,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

type Antenna = {
  id: number | string;
  name: string;
  lat: number;
  lon: number;
  description?: string | null;
  status: "UP" | "DOWN" | string;
  networkName?: string | null;
  updatedAt?: string | number | Date;
};

type Role = "SUPERADMIN" | "ADMIN" | "USER";
type BasemapKey = "sat" | "light";
type BasemapDefinition = {
  tiles: string[];
  attribution: string;
};

const CITY_CENTER: LngLatLike = [-46.955, -22.431];
const CITY_BOUNDS: LngLatBoundsLike = [
  [-47.05, -22.5],
  [-46.86, -22.36],
];

const TILE_SAT: BasemapDefinition = {
  tiles: [
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  ],
  attribution:
    '&copy; <a href="https://www.esri.com/">Esri</a> - Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
};

const TILE_LIGHT: BasemapDefinition = {
  tiles: [
    "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
  ],
  attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
};

const MAP_MIN_ZOOM = 8;
const MARKER_BASE_WIDTH = 32;

function faToSvgMarkup(icon: IconDefinition, color: string, scale = 1) {
  const def = icon.icon as unknown as [number, number, string[], string, string | string[]];
  const [width, height, , , paths] = def;
  const d = Array.isArray(paths) ? paths.join("") : paths;
  const viewWidth = MARKER_BASE_WIDTH * scale;
  const viewHeight = (height / width) * viewWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${viewWidth}" height="${viewHeight}" viewBox="0 0 ${width} ${height}" aria-hidden="true" style="display:block;filter:drop-shadow(0 6px 10px rgba(0,0,0,0.35));">
    <path d="${d}" fill="${color}" />
  </svg>`;
}

function makeMarkerElement(color: string, label: string, scale = 1, isPreview = false) {
  const element = document.createElement("button");
  element.type = "button";
  element.title = label;
  element.setAttribute("aria-label", label);
  element.innerHTML = faToSvgMarkup(faWifi, color, scale);
  element.style.background = "transparent";
  element.style.border = "0";
  element.style.padding = "0";
  element.style.cursor = "pointer";
  element.style.transformOrigin = "50% 100%";
  element.style.opacity = isPreview ? "0.9" : "1";
  return element;
}

function appendText(parent: HTMLElement, text: string, className?: string) {
  const node = document.createElement("div");
  if (className) node.className = className;
  node.textContent = text;
  parent.appendChild(node);
  return node;
}

function buildPopupContent(antenna: Antenna) {
  const root = document.createElement("div");
  root.className = "space-y-1 text-sm";

  appendText(root, antenna.name, "font-semibold");

  if (antenna.networkName) {
    appendText(root, antenna.networkName, "opacity-80");
  }

  appendText(root, `${antenna.lat.toFixed(5)}, ${antenna.lon.toFixed(5)}`, "opacity-80");

  if (antenna.description) {
    appendText(root, antenna.description, "opacity-80");
  }

  const statusLine = document.createElement("div");
  statusLine.textContent = "Status: ";

  const statusValue = document.createElement("span");
  statusValue.className =
    antenna.status === "DOWN" ? "text-red-500 font-medium" : "text-emerald-500 font-medium";
  statusValue.textContent = antenna.status;

  statusLine.appendChild(statusValue);
  root.appendChild(statusLine);

  return root;
}

function buildMapStyle(basemap: BasemapKey): StyleSpecification {
  const base = basemap === "sat" ? TILE_SAT : TILE_LIGHT;

  return {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        tiles: base.tiles,
        tileSize: 256,
        attribution: base.attribution,
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": basemap === "sat" ? "#0b1220" : "#f3f6f7",
        },
      },
      {
        id: "basemap",
        type: "raster",
        source: "basemap",
      },
    ],
  };
}

export default function MapClient() {
  const [antennas, setAntennas] = useState<Antenna[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UP" | "DOWN">("ALL");
  const [netFilter, setNetFilter] = useState<string>("");
  // No celular o painel cobre quase todo o mapa: começa fechado. (Componente só roda no navegador.)
  const [panelOpen, setPanelOpen] = useState(() => !window.matchMedia("(max-width: 767px)").matches);
  const [openModal, setOpenModal] = useState(false);
  const [name, setName] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lon, setLon] = useState<string>("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<BasemapKey>("sat");
  const [mapError, setMapError] = useState<string | null>(null);

  const canManage = role === "ADMIN" || role === "SUPERADMIN";
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const appliedBasemapRef = useRef<BasemapKey>("sat");
  const fitCity = useCallback((animate = true) => {
    const map = mapRef.current;
    if (!map) return;

    map.fitBounds(CITY_BOUNDS, {
      padding: 24,
      duration: animate ? 600 : 0,
      maxZoom: 13,
      // Sem bearing explícito o maplibre volta a rotação para 0°.
      bearing: map.getBearing(),
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/antennas?placed=1&take=5000", { cache: "no-store" });
      const json = await res.json();
      const arr: Antenna[] = Array.isArray(json) ? json : json?.items ?? [];
      const prepared = arr
        .filter((antenna) => Number.isFinite(Number(antenna.lat)) && Number.isFinite(Number(antenna.lon)))
        .map((antenna) => ({ ...antenna, lat: Number(antenna.lat), lon: Number(antenna.lon) }));

      setAntennas(prepared);
      setLastLoadedAt(new Date().toLocaleTimeString());
    } catch {
      setAntennas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (alive) await load();
    })();

    let disconnect: (() => void) | undefined;

    try {
      disconnect = connectSSE?.((event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          if (
            ["antenna.updated", "antenna.created", "antenna.deleted", "status.changed"].includes(
              message.event,
            )
          ) {
            load();
          }
        } catch {}
      });
    } catch {}

    const pollId = setInterval(load, 12_000);

    return () => {
      alive = false;
      clearInterval(pollId);
      disconnect?.();
    };
  }, [load]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        const json = await response.json();

        if (!alive) return;
        if (json?.ok && json?.user?.role) setRole(json.user.role as Role);
        else setRole(null);
      } catch {
        if (alive) setRole(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    const map = new maplibregl.Map({
      container,
      style: buildMapStyle(appliedBasemapRef.current),
      center: CITY_CENTER,
      zoom: 12,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: 19,
      minPitch: 0,
      maxPitch: 0,
      dragRotate: true,
      touchZoomRotate: true,
      touchPitch: false,
      doubleClickZoom: true,
      attributionControl: { compact: true },
      renderWorldCopies: false,
    });

    mapRef.current = map;
    setMapInstance(map);
    map.addControl(
      new NavigationControl({ showCompass: false, showZoom: true, visualizePitch: false }),
      "bottom-right",
    );

    const handleInitialLoad = () => {
      setMapReady(true);
      fitCity(false);
    };
    const handleMapError = (event: { error?: Error; sourceId?: string }) => {
      const message = String(event?.error?.message || "");
      if (!message) return;

      const isBasemapIssue =
        event?.sourceId === "basemap" ||
        message.includes("server.arcgisonline.com") ||
        message.includes("tile.openstreetmap.org");

      if (!isBasemapIssue) return;

      if (appliedBasemapRef.current === "sat") {
        appliedBasemapRef.current = "light";
        setBasemap("light");
        setMapError("Camada de satélite indisponível no momento. O mapa foi alterado para OSM.");
        return;
      }

      setMapError("Falha ao carregar o mapa base. Tente recarregar.");
    };

    const handleResize = () => map.resize();
    const resizeObserver = new ResizeObserver(handleResize);

    map.once("load", handleInitialLoad);
    map.on("error", handleMapError);

    resizeObserver.observe(container);
    window.addEventListener("resize", handleResize);
    document.addEventListener("fullscreenchange", handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("fullscreenchange", handleResize);
      map.off("error", handleMapError);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      setMapReady(false);
      setMapInstance(null);
      map.remove();
      mapRef.current = null;
    };
  }, [fitCity]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || appliedBasemapRef.current === basemap) return;

    appliedBasemapRef.current = basemap;
    setMapError(null);
    map.setStyle(buildMapStyle(basemap));
  }, [basemap, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onClick = (event: MapMouseEvent) => {
      if (!openModal) return;
      setLat(event.lngLat.lat.toFixed(5));
      setLon(event.lngLat.lng.toFixed(5));
    };

    map.on("click", onClick);

    return () => {
      map.off("click", onClick);
    };
  }, [openModal]);

  const term = useMemo(() => q.trim().toLowerCase(), [q]);

  const networks = useMemo(
    () => Array.from(new Set(antennas.map((antenna) => antenna.networkName ?? "").filter(Boolean))).sort(),
    [antennas],
  );

  const matchesStatus = useCallback(
    (antenna: Antenna) => statusFilter === "ALL" || antenna.status === statusFilter,
    [statusFilter],
  );

  const matchesSearch = useCallback(
    (antenna: Antenna) =>
      !term || `${antenna.name ?? ""} ${antenna.networkName ?? ""}`.toLowerCase().includes(term),
    [term],
  );

  const filtered = useMemo(() => {
    return antennas.filter((antenna) => {
      if (netFilter && (antenna.networkName ?? "") !== netFilter) return false;
      if (!matchesStatus(antenna)) return false;
      if (!matchesSearch(antenna)) return false;
      return true;
    });
  }, [antennas, matchesSearch, matchesStatus, netFilter]);

  const totals = useMemo(() => {
    const total = filtered.length;
    const up = filtered.filter((antenna) => antenna.status === "UP").length;
    const down = filtered.filter((antenna) => antenna.status === "DOWN").length;
    return { total, up, down };
  }, [filtered]);

  const netCounts = useMemo(() => {
    const counts = new Map<string, number>();

    antennas.forEach((antenna) => {
      const networkName = antenna.networkName ?? "";
      if (!networkName) return;
      if (!matchesStatus(antenna)) return;
      if (!matchesSearch(antenna)) return;
      counts.set(networkName, (counts.get(networkName) ?? 0) + 1);
    });

    return counts;
  }, [antennas, matchesSearch, matchesStatus]);

  const clearFilters = useCallback(() => {
    setQ("");
    setStatusFilter("ALL");
    setNetFilter("");
  }, []);

  const tempPos = useMemo(() => {
    const latNum = Number(lat.toString().replace(",", "."));
    const lonNum = Number(lon.toString().replace(",", "."));

    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return null;
    if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) return null;

    return [latNum, lonNum] as [number, number];
  }, [lat, lon]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    filtered.forEach((antenna) => {
      const color = antenna.status === "DOWN" ? "#ef4444" : "#22c55e";
      const marker = new maplibregl.Marker({
        element: makeMarkerElement(color, antenna.name),
        anchor: "bottom",
        rotationAlignment: "viewport",
        pitchAlignment: "viewport",
      })
        .setLngLat([antenna.lon, antenna.lat])
        .setPopup(new Popup({ offset: 20, maxWidth: "320px" }).setDOMContent(buildPopupContent(antenna)))
        .addTo(map);

      markersRef.current.push(marker);
    });

    if (openModal && tempPos) {
      const previewMarker = new maplibregl.Marker({
        element: makeMarkerElement("#38bdf8", "Posição selecionada", 1, true),
        anchor: "bottom",
        rotationAlignment: "viewport",
        pitchAlignment: "viewport",
      })
        .setLngLat([tempPos[1], tempPos[0]])
        .addTo(map);

      markersRef.current.push(previewMarker);
    }

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [filtered, mapReady, openModal, tempPos]);

  const fitPins = useCallback(() => {
    const map = mapRef.current;
    if (!map || filtered.length === 0) return;

    const bounds = filtered.reduce(
      (acc, antenna) => acc.extend([antenna.lon, antenna.lat]),
      new LngLatBounds([filtered[0].lon, filtered[0].lat], [filtered[0].lon, filtered[0].lat]),
    );

    map.fitBounds(bounds, {
      padding: 28,
      duration: 600,
      maxZoom: filtered.length === 1 ? 17 : 18,
      bearing: map.getBearing(),
    });
  }, [filtered]);

  const handleCreate = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (saving) return;

      const latNum = Number(lat.toString().replace(",", "."));
      const lonNum = Number(lon.toString().replace(",", "."));

      if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
        setErr("Latitude/longitude inválidas.");
        return;
      }

      if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
        setErr("Coordenadas fora do intervalo geográfico.");
        return;
      }

      setSaving(true);
      setErr(null);

      try {
        const body = {
          name: name.trim(),
          lat: latNum,
          lon: lonNum,
          description: desc.trim() || undefined,
        };

        const created = await api<any>("/api/antennas", {
          method: "POST",
          body: JSON.stringify(body),
        });

        const createdItem = created?.item ?? created;
        setAntennas((prev) => (createdItem && createdItem.id ? [createdItem, ...prev] : prev));
        setName("");
        setLat("");
        setLon("");
        setDesc("");
        setOpenModal(false);
      } catch (error: any) {
        setErr(error?.message || "Não foi possível salvar o AP.");
      } finally {
        setSaving(false);
      }
    },
    [desc, lat, lon, name, saving],
  );


  return (
    <div id="map-root" className="relative h-[calc(100vh-8rem)] w-full overflow-hidden rounded-xl shadow-inner">
      <div ref={mapContainerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute left-4 top-4 z-[1005]">
        <RotationControl map={mapReady ? mapInstance : null} />
      </div>

      <div className="absolute right-4 top-4 z-[1005] flex gap-2 pointer-events-none">
        <button
          onClick={() => setPanelOpen((value) => !value)}
          className="surface-button pointer-events-auto inline-flex h-10 items-center gap-2 rounded-xl px-3"
          title={panelOpen ? "Fechar painel" : "Abrir painel"}
          aria-label={panelOpen ? "Fechar painel" : "Abrir painel"}
          aria-expanded={panelOpen}
        >
          <FontAwesomeIcon icon={faXmark} className={`h-4 w-4 ${panelOpen ? "" : "hidden"}`} />
          <FontAwesomeIcon icon={faBars} className={`h-4 w-4 ${panelOpen ? "hidden" : ""}`} />
          <span className="hidden text-sm sm:inline">{panelOpen ? "Fechar" : "Painel"}</span>
        </button>

        <button
          onClick={() => fitCity()}
          className="surface-button pointer-events-auto inline-flex h-10 items-center gap-2 rounded-xl px-3"
          title="Enquadrar cidade"
          aria-label="Enquadrar cidade"
        >
          <FontAwesomeIcon icon={faLocationCrosshairs} className="h-4 w-4" />
          <span className="hidden text-sm sm:inline">Cidade</span>
        </button>

        <button
          onClick={fitPins}
          disabled={filtered.length === 0}
          className="surface-button pointer-events-auto inline-flex h-10 items-center gap-2 rounded-xl px-3 disabled:opacity-50"
          title="Enquadrar pinos filtrados"
          aria-label="Enquadrar pinos filtrados"
        >
          <FontAwesomeIcon icon={faLocationCrosshairs} className="h-4 w-4" />
          <span className="hidden text-sm sm:inline">Pinos</span>
        </button>

        <select
          value={basemap}
          onChange={(event) => setBasemap(event.target.value as BasemapKey)}
          className="surface-button pointer-events-auto h-10 rounded-xl py-0 pl-3 pr-8 text-sm"
          title="Mapa base"
          aria-label="Selecionar mapa base"
        >
          <option value="sat">Satélite</option>
          <option value="light">Claro (OSM)</option>
        </select>
      </div>

      <div
        className={`surface-overlay absolute right-4 top-16 z-[1004] max-h-[70vh] w-[320px] max-w-[calc(100%-2rem)] overflow-hidden rounded-2xl
          backdrop-blur-md transition-all
          ${panelOpen ? "pointer-events-auto translate-x-0 opacity-100" : "pointer-events-none translate-x-4 opacity-0"}`}
      >
        <div className="space-y-3 overflow-y-auto p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                className="surface-field w-full rounded-lg py-2 pl-8 pr-3 outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Buscar por nome/rede..."
                value={q}
                onChange={(event) => setQ(event.target.value)}
                aria-label="Buscar por nome ou rede"
              />
              <FontAwesomeIcon
                icon={faMagnifyingGlass}
                className="text-muted absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2"
              />
            </div>

            <button
              onClick={load}
              className="surface-button h-10 rounded-lg px-3"
              title="Recarregar"
              aria-label="Recarregar"
            >
              <FontAwesomeIcon icon={faArrowsRotate} className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`rounded-lg px-2 py-2 text-sm ${
                statusFilter === "ALL" ? "bg-emerald-600 text-white" : "surface-button"
              }`}
            >
              Todos
            </button>

            <button
              onClick={() => setStatusFilter("UP")}
              className={`flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-sm ${
                statusFilter === "UP" ? "bg-emerald-600 text-white" : "surface-button"
              }`}
            >
              <FontAwesomeIcon icon={faCircleCheck} /> UP
            </button>

            <button
              onClick={() => setStatusFilter("DOWN")}
              className={`flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-sm ${
                statusFilter === "DOWN" ? "bg-emerald-600 text-white" : "surface-button"
              }`}
            >
              <FontAwesomeIcon icon={faCircleXmark} /> DOWN
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="surface-soft rounded-xl p-2">
              <div className="text-xs opacity-80">Pinos</div>
              <div className="text-lg font-semibold">{totals.total}</div>
            </div>

            <div className="surface-soft rounded-xl p-2">
              <div className="text-xs opacity-80">UP</div>
              <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">{totals.up}</div>
            </div>

            <div className="surface-soft rounded-xl p-2">
              <div className="text-xs opacity-80">DOWN</div>
              <div className="text-lg font-semibold text-red-600 dark:text-red-300">{totals.down}</div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs opacity-80">Redes ({networks.length})</div>

            <div className="max-h-[26vh] overflow-auto pr-1">
              <button
                onClick={() => setNetFilter("")}
                className={`mb-1 w-full rounded-lg px-2 py-1 text-left text-sm ${
                  netFilter === "" ? "bg-emerald-600 text-white" : "surface-button"
                }`}
              >
                Todas as redes
              </button>

              {networks.map((network) => {
                const count = netCounts.get(network) ?? 0;

                return (
                  <button
                    key={network}
                    onClick={() => setNetFilter((prev) => (prev === network ? "" : network))}
                    className={`mb-1 w-full rounded-lg px-2 py-1 text-left text-sm ${
                      netFilter === network ? "bg-emerald-600 text-white" : "surface-button"
                    }`}
                    title={network}
                  >
                    <span className="line-clamp-1">{network}</span>
                    <span className="float-right opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={clearFilters}
              className="surface-button mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm"
            >
              <FontAwesomeIcon icon={faBroom} /> Limpar filtros
            </button>
          </div>

          <div className="text-center text-xs opacity-80">{lastLoadedAt ? `Atualizado: ${lastLoadedAt}` : "-"}</div>

          {mapError && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-500/12 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
              {mapError}
            </div>
          )}
        </div>
      </div>

      {canManage && (
        <div className="pointer-events-none absolute bottom-6 left-6 z-[1003]">
          <button
            onClick={() => setOpenModal(true)}
            className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500"
            title="Adicionar nova antena"
          >
            <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
            <span className="font-medium">Adicionar</span>
          </button>
        </div>
      )}

      {canManage && openModal && (
        <div
          className="absolute inset-0 z-[1006] grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="surface-popover w-full max-w-md rounded-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
              <h3 className="text-lg font-semibold">Nova antena</h3>
              <button
                onClick={() => setOpenModal(false)}
                className="surface-soft-hover rounded-lg px-2 py-1"
                aria-label="Fechar"
              >
                x
              </button>
            </div>

            <form className="space-y-3 p-5" onSubmit={handleCreate}>
              <input
                className="surface-field w-full rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Nome"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  className="surface-field w-full rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Latitude"
                  value={lat}
                  onChange={(event) => setLat(event.target.value)}
                  required
                />

                <input
                  className="surface-field w-full rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Longitude"
                  value={lon}
                  onChange={(event) => setLon(event.target.value)}
                  required
                />
              </div>

              <textarea
                className="surface-field w-full rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Descrição (opcional)"
                rows={3}
                value={desc}
                onChange={(event) => setDesc(event.target.value)}
              />

              {err && (
                <div className="rounded border border-red-600/30 bg-red-600/10 p-2 text-xs text-red-600 dark:text-red-300">{err}</div>
              )}

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs opacity-80">Dica: com esta janela aberta, clique no mapa para preencher latitude e longitude.</p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenModal(false)}
                    className="surface-soft-hover h-10 rounded-lg px-4"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="h-10 rounded-lg bg-emerald-600 px-4 text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
