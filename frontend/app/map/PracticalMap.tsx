"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { ExpressionSpecification, Map as MapLibreMap, Marker } from "maplibre-gl";
import type { MapVilla } from "../lib/api";
import { compactPrice } from "./map-utils";

const DEFAULT_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const RTL_PLUGIN_URL = "/vendor/mapbox-gl-rtl-text-0.3.0.js";
const MAZANDARAN_BOUNDS: [[number, number], [number, number]] = [[49.9, 35.45], [54.75, 37.35]];
const LATIN_LABEL_FIELD: ExpressionSpecification = [
  "coalesce",
  ["get", "name:latin"],
  ["get", "name_en"],
  "",
];

let rtlPluginPromise: Promise<void> | null = null;

async function ensureRtlTextPlugin(maplibregl: typeof import("maplibre-gl")) {
  const status = maplibregl.getRTLTextPluginStatus();

  if (status === "loaded") return;
  if (status === "error") throw new Error("RTL text plugin failed to load");

  if (status === "unavailable") {
    // Arabic-script labels require MapLibre's RTL shaping plugin before map creation.
    // https://maplibre.org/maplibre-gl-js/docs/API/functions/setRTLTextPlugin/
    rtlPluginPromise ??= maplibregl.setRTLTextPlugin(RTL_PLUGIN_URL, false);
  }

  if (rtlPluginPromise) await rtlPluginPromise;
}

function removeNativeScriptLabels(map: MapLibreMap) {
  for (const layer of map.getStyle().layers) {
    if (layer.type !== "symbol") continue;
    const textField = map.getLayoutProperty(layer.id, "text-field");
    if (!textField || !JSON.stringify(textField).includes("name:nonlatin")) continue;
    map.setLayoutProperty(layer.id, "text-field", LATIN_LABEL_FIELD);
  }
}

type Props = {
  villas: MapVilla[];
  activeSlug: string;
  fitRequest: number;
  onSelect: (slug: string) => void;
};

export function PracticalMap({ villas, activeSlug, fitRequest, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const libraryRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const fittedStateRef = useRef({ villaKey: "", request: 0 });
  const [mapReady, setMapReady] = useState(false);
  const [providerError, setProviderError] = useState(false);
  const [mapRevision, setMapRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    setMapReady(false);
    setProviderError(false);

    void import("maplibre-gl").then(async (maplibregl) => {
      if (cancelled || !containerRef.current) return;

      await ensureRtlTextPlugin(maplibregl);
      if (cancelled || !containerRef.current) return;

      containerRef.current.setAttribute("dir", "rtl");
      containerRef.current.setAttribute("lang", "fa");
      libraryRef.current = maplibregl;
      let loaded = false;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: process.env.NEXT_PUBLIC_VILLAONE_MAP_STYLE_URL || DEFAULT_STYLE,
        center: [52.55, 36.45],
        zoom: 7.25,
        maxBounds: MAZANDARAN_BOUNDS,
        minZoom: 6.5,
        maxZoom: 16,
        cooperativeGestures: true,
        attributionControl: true,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-left");
      map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
      map.on("load", () => {
        loaded = true;
        if (loadTimer) clearTimeout(loadTimer);
        removeNativeScriptLabels(map);
        setProviderError(false);
        setMapReady(true);
      });
      map.on("error", () => {
        if (!loaded) setProviderError(true);
      });
      loadTimer = setTimeout(() => {
        if (!loaded) setProviderError(true);
      }, 12_000);
    }).catch(() => setProviderError(true));

    return () => {
      cancelled = true;
      if (loadTimer) clearTimeout(loadTimer);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      libraryRef.current = null;
    };
  }, [mapRevision]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = libraryRef.current;
    if (!map || !maplibregl || !mapReady) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = villas.map((villa, index) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = villa.slug === activeSlug ? "map-price-pin is-active" : "map-price-pin";
      element.style.setProperty("--pin-delay", `${Math.min(index * 55, 440)}ms`);
      element.setAttribute("dir", "rtl");
      element.setAttribute("lang", "fa");
      element.setAttribute("aria-label", `نمایش ${villa.title} در ${villa.city.name}`);
      element.setAttribute("aria-pressed", String(villa.slug === activeSlug));

      const dot = document.createElement("span");
      dot.className = "map-price-pin-dot";
      const label = document.createElement("span");
      label.className = "map-price-pin-label";
      label.setAttribute("dir", "rtl");
      label.setAttribute("lang", "fa");
      label.textContent = `${compactPrice(villa.price_weekday)} تومان`;
      element.append(dot, label);
      element.addEventListener("click", () => onSelect(villa.slug));

      return new maplibregl.Marker({ element, anchor: "bottom" })
        .setLngLat([Number(villa.map_longitude), Number(villa.map_latitude)])
        .addTo(map);
    });
  }, [activeSlug, mapReady, onSelect, villas]);

  useEffect(() => {
    const map = mapRef.current;
    const villa = villas.find((item) => item.slug === activeSlug);
    if (!map || !mapReady || !villa) return;
    map.flyTo({
      center: [Number(villa.map_longitude), Number(villa.map_latitude)],
      zoom: Math.max(map.getZoom(), 10.4),
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 850,
      essential: true,
    });
  }, [activeSlug, mapReady, villas]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = libraryRef.current;
    if (!map || !maplibregl || !mapReady || villas.length === 0) return;
    const villaKey = villas.map((villa) => villa.slug).join("|");
    const wasRequested = fitRequest !== fittedStateRef.current.request;
    const villaSetChanged = villaKey !== fittedStateRef.current.villaKey;
    if (!wasRequested && !villaSetChanged) return;
    fittedStateRef.current = { villaKey, request: fitRequest };
    if (villas.length === 1) {
      const villa = villas[0];
      map.flyTo({ center: [Number(villa.map_longitude), Number(villa.map_latitude)], zoom: 11, duration: 650 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    villas.forEach((villa) => bounds.extend([Number(villa.map_longitude), Number(villa.map_latitude)]));
    map.fitBounds(bounds, { padding: 78, maxZoom: 11, duration: 700 });
  }, [fitRequest, mapReady, villas]);

  return (
    <div className="practical-map-canvas" aria-label="نقشه تعاملی ویلاهای مازندران">
      <div ref={containerRef} className="practical-map-surface" />
      {!mapReady && !providerError && (
        <div className="map-provider-state" role="status"><i /><span>در حال آماده‌سازی نقشه…</span></div>
      )}
      {providerError && (
        <div className="map-provider-state is-error" role="alert">
          <strong>نقشه پایه در دسترس نیست</strong>
          <span>فهرست ویلاها همچنان قابل استفاده است. اتصال اینترنت را بررسی کنید.</span>
          <button type="button" onClick={() => setMapRevision((value) => value + 1)}>بارگذاری دوباره</button>
        </div>
      )}
    </div>
  );
}
