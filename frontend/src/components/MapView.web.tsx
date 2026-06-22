import React, { useEffect, useRef, useState } from "react";
import { View, LayoutChangeEvent } from "react-native";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { colors } from "@/src/theme";

export type LatLng = { lat: number; lng: number; label?: string };

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN as string;
mapboxgl.accessToken = TOKEN;

type Props = {
  pickup?: LatLng | null;
  destination?: LatLng | null;
  driver?: LatLng | null;
  enrouteFrom?: LatLng | null;
  stops?: LatLng[];
  style?: any;
  showRoute?: boolean;
  autoFit?: boolean;
  onPickupChange?: (p: LatLng) => void;
};

const ORLANDO: LatLng = { lat: 28.5384, lng: -81.3789 };

function makeDriverEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText =
    `width:36px;height:36px;border-radius:18px;background:${colors.surfaceInverse};` +
    `border:3px solid #fff;display:flex;align-items:center;justify-content:center;` +
    `box-shadow:0 2px 8px rgba(0,0,0,.35);`;
  el.innerHTML =
    `<svg width="18" height="18" viewBox="0 0 512 512" fill="#fff">` +
    `<path d="M135.2 117.4 109.1 192H402.9l-26.1-74.6C372.3 104.6 360.2 96 346.6 96H165.4c-13.6 0-25.7 8.6-30.2 21.4zM39.6 196.8 74.8 96.3C88.3 57.8 124.6 32 165.4 32H346.6c40.8 0 77.1 25.8 90.6 64.3l35.2 100.5c23.2 9.6 39.6 32.5 39.6 59.2V400v48c0 17.7-14.3 32-32 32H448c-17.7 0-32-14.3-32-32V400H96v48c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32V400 256c0-26.7 16.4-49.6 39.6-59.2zM128 288a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm288 32a32 32 0 1 0 0-64 32 32 0 1 0 0 64z"/></svg>`;
  return el;
}

function nearestOnSegment(p: number[], a: number[], b: number[]): number[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return [a[0] + dx * t, a[1] + dy * t];
}

function snapToRoute(coords: number[][] | null, lng: number, lat: number): [number, number] {
  if (!coords || coords.length < 2) return [lng, lat];
  let best: number[] = [lng, lat];
  let bestD = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const q = nearestOnSegment([lng, lat], coords[i], coords[i + 1]);
    const d = (q[0] - lng) ** 2 + (q[1] - lat) ** 2;
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return [best[0], best[1]];
}

export default function MapView({ pickup, destination, driver, enrouteFrom, stops = [], style, showRoute = true, autoFit = true, onPickupChange }: Props) {
  const containerRef = useRef<any>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const loadedRef = useRef(false);
  const routeRef = useRef<number[][] | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const pickupM = useRef<mapboxgl.Marker | null>(null);
  const destM = useRef<mapboxgl.Marker | null>(null);
  const driverM = useRef<mapboxgl.Marker | null>(null);
  const stopMs = useRef<mapboxgl.Marker[]>([]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setSize({ w: Math.round(width), h: Math.round(height) });
  };

  const placeDriver = (lng: number, lat: number) => {
    const map = mapRef.current;
    if (!map) return;
    const [sl, sa] = snapToRoute(routeRef.current, lng, lat);
    if (!driverM.current) driverM.current = new mapboxgl.Marker({ element: makeDriverEl() }).setLngLat([sl, sa]).addTo(map);
    else driverM.current.setLngLat([sl, sa]);
  };

  const setPickupPin = () => {
    const map = mapRef.current;
    if (!map) return;
    if (pickup) {
      if (!pickupM.current) {
        pickupM.current = new mapboxgl.Marker({ color: colors.success, draggable: !!onPickupChange }).setLngLat([pickup.lng, pickup.lat]).addTo(map);
        if (onPickupChange) {
          pickupM.current.on("dragend", () => {
            const ll = pickupM.current!.getLngLat();
            onPickupChange({ lat: ll.lat, lng: ll.lng });
          });
        }
      } else {
        pickupM.current.setLngLat([pickup.lng, pickup.lat]);
      }
    } else if (pickupM.current) {
      pickupM.current.remove();
      pickupM.current = null;
    }
  };

  const updateRoute = async () => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    if (map.getLayer("route")) map.removeLayer("route");
    if (map.getLayer("route-bg")) map.removeLayer("route-bg");
    if (map.getSource("route")) map.removeSource("route");
    routeRef.current = null;
    if (!showRoute || !pickup || !destination) return;
    const waypoints = [enrouteFrom, pickup, ...stops, destination].filter(Boolean) as LatLng[];
    const path = waypoints.map((p) => `${p.lng},${p.lat}`).join(";");
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${path}?geometries=geojson&overview=full&access_token=${TOKEN}`;
      const res = await fetch(url);
      const json = await res.json();
      const coords = json?.routes?.[0]?.geometry?.coordinates;
      if (!coords || !mapRef.current) return;
      routeRef.current = coords;
      map.addSource("route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } } as any });
      map.addLayer({ id: "route-bg", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#ffffff", "line-width": 8 } });
      map.addLayer({ id: "route", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": colors.brandPrimary, "line-width": 5 } });
      // re-snap driver onto the freshly loaded route
      if (driver) placeDriver(driver.lng, driver.lat);
    } catch {}
  };

  const fitBounds = () => {
    const map = mapRef.current;
    if (!map || !autoFit) return;
    const pts: LatLng[] = [];
    if (pickup) pts.push(pickup);
    if (destination) pts.push(destination);
    stops.forEach((s) => pts.push(s));
    if (enrouteFrom) pts.push(enrouteFrom);
    if (driver) pts.push(driver);
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: 13, duration: 400 });
      return;
    }
    const b = new mapboxgl.LngLatBounds();
    pts.forEach((p) => b.extend([p.lng, p.lat]));
    map.fitBounds(b, { padding: { top: 120, bottom: 360, left: 56, right: 56 }, maxZoom: 14, duration: 600 });
  };

  const updateAll = () => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    setPickupPin();
    if (destination) {
      if (!destM.current) destM.current = new mapboxgl.Marker({ color: colors.brandPrimary }).setLngLat([destination.lng, destination.lat]).addTo(map);
      else destM.current.setLngLat([destination.lng, destination.lat]);
    } else if (destM.current) {
      destM.current.remove();
      destM.current = null;
    }
    stopMs.current.forEach((m) => m.remove());
    stopMs.current = stops.map((s) => new mapboxgl.Marker({ color: colors.warning }).setLngLat([s.lng, s.lat]).addTo(map));
    if (driver) placeDriver(driver.lng, driver.lat);
    else if (driverM.current) {
      driverM.current.remove();
      driverM.current = null;
    }
    updateRoute();
    fitBounds();
  };

  useEffect(() => {
    if (!size || !containerRef.current || mapRef.current) return;
    const center = pickup || destination || ORLANDO;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [center.lng, center.lat],
      zoom: 12,
      attributionControl: false,
    });
    mapRef.current = map;
    map.on("load", () => {
      loadedRef.current = true;
      map.resize();
      updateAll();
    });
    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  useEffect(() => {
    if (mapRef.current && size) mapRef.current.resize();
  }, [size]);

  const depKey = JSON.stringify({ pickup, destination, stops, enrouteFrom });
  useEffect(() => {
    updateAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !driver || !loadedRef.current) return;
    placeDriver(driver.lng, driver.lat);
    map.panTo([driver.lng, driver.lat], { duration: 900 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver?.lat, driver?.lng]);

  return (
    <View
      testID="map-view"
      ref={containerRef}
      onLayout={onLayout}
      style={[style, size ? { width: size.w, height: size.h } : null, { backgroundColor: "#e8eef2" }]}
    />
  );
}
