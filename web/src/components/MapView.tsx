"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import type { Place } from "@/src/lib/types";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface Props {
  pickup?: Place | null;
  destination?: Place | null;
  driver?: { lat: number; lng: number } | null;
  className?: string;
  height?: number | string;
  radius?: number;
}

function marker(color: string, label?: string) {
  const el = document.createElement("div");
  el.style.width = "26px";
  el.style.height = "26px";
  el.style.borderRadius = "50%";
  el.style.background = color;
  el.style.border = "3px solid #fff";
  el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  if (label) {
    el.style.fontSize = "13px";
    el.textContent = label;
  }
  return el;
}

export default function MapView({ pickup, destination, driver, className, height = 340, radius = 16 }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!container.current || map.current) return;
    mapboxgl.accessToken = TOKEN;
    map.current = new mapboxgl.Map({
      container: container.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-81.3789, 28.5384],
      zoom: 10,
      attributionControl: false,
    });
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;

    const draw = () => {
      markers.current.forEach((x) => x.remove());
      markers.current = [];
      const pts: [number, number][] = [];

      if (pickup) {
        const mk = new mapboxgl.Marker({ element: marker("#9333ea") }).setLngLat([pickup.lng, pickup.lat]).addTo(m);
        markers.current.push(mk);
        pts.push([pickup.lng, pickup.lat]);
      }
      if (destination) {
        const mk = new mapboxgl.Marker({ element: marker("#18181b") }).setLngLat([destination.lng, destination.lat]).addTo(m);
        markers.current.push(mk);
        pts.push([destination.lng, destination.lat]);
      }

      // route line
      const line = {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates: pts },
      };
      const src = m.getSource("route") as mapboxgl.GeoJSONSource | undefined;
      if (pts.length >= 2) {
        if (src) src.setData(line as any);
        else {
          m.addSource("route", { type: "geojson", data: line as any });
          m.addLayer({
            id: "route", type: "line", source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#9333ea", "line-width": 4, "line-dasharray": [1, 1.6] },
          });
        }
      }

      if (driver) pts.push([driver.lng, driver.lat]);
      if (pts.length === 1) m.easeTo({ center: pts[0], zoom: 13 });
      else if (pts.length >= 2) {
        const b = new mapboxgl.LngLatBounds();
        pts.forEach((p) => b.extend(p));
        m.fitBounds(b, { padding: 60, maxZoom: 14, duration: 500 });
      }
    };

    if (m.isStyleLoaded()) draw();
    else m.once("load", draw);
  }, [pickup, destination]);

  // Driver marker moves independently (frequent updates)
  useEffect(() => {
    const m = map.current;
    if (!m || !driver) { driverMarker.current?.remove(); driverMarker.current = null; return; }
    if (!driverMarker.current) {
      driverMarker.current = new mapboxgl.Marker({ element: marker("#22c55e", "\uD83D\uDE97") }).setLngLat([driver.lng, driver.lat]).addTo(m);
    } else {
      driverMarker.current.setLngLat([driver.lng, driver.lat]);
    }
  }, [driver]);

  return <div ref={container} className={className} style={{ height, width: "100%", borderRadius: radius, overflow: "hidden" }} />;
}
