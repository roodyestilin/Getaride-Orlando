import React, { useEffect, useRef, useState } from "react";
import { View, LayoutChangeEvent } from "react-native";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { colors } from "@/src/theme";

export type LatLng = { lat: number; lng: number; label?: string };
export type NavStep = { instruction: string; distanceText: string; type?: string; modifier?: string; announce?: string; announceId?: number; remainingM?: number };
export type RouteInfo = { distanceText: string; durationText: string; arrivalText: string };

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN as string;
mapboxgl.accessToken = TOKEN;

type Props = {
  pickup?: LatLng | null;
  pulsePickup?: boolean;
  destination?: LatLng | null;
  driver?: LatLng | null;
  enrouteFrom?: LatLng | null;
  navFrom?: LatLng | null;
  navTo?: LatLng | null;
  stops?: LatLng[];
  style?: any;
  showRoute?: boolean;
  autoFit?: boolean;
  requestMarkers?: LatLng[];
  centerOn?: LatLng | null;
  onPickupChange?: (p: LatLng) => void;
  onRouteInfo?: (info: RouteInfo) => void;
  onNavStep?: (step: NavStep) => void;
  follow?: boolean;
  recenterKey?: number;
  onUserPan?: () => void;
};

const ORLANDO: LatLng = { lat: 28.5384, lng: -81.3789 };

function makeDriverEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText =
    `width:38px;height:38px;border-radius:19px;background:${colors.brandPrimary};` +
    `border:3px solid #fff;display:flex;align-items:center;justify-content:center;` +
    `box-shadow:0 3px 10px rgba(0,0,0,.4);`;
  el.innerHTML =
    `<svg width="19" height="19" viewBox="0 0 512 512" fill="#fff">` +
    `<path d="M135.2 117.4 109.1 192H402.9l-26.1-74.6C372.3 104.6 360.2 96 346.6 96H165.4c-13.6 0-25.7 8.6-30.2 21.4zM39.6 196.8 74.8 96.3C88.3 57.8 124.6 32 165.4 32H346.6c40.8 0 77.1 25.8 90.6 64.3l35.2 100.5c23.2 9.6 39.6 32.5 39.6 59.2V400v48c0 17.7-14.3 32-32 32H448c-17.7 0-32-14.3-32-32V400H96v48c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32V400 256c0-26.7 16.4-49.6 39.6-59.2zM128 288a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm288 32a32 32 0 1 0 0-64 32 32 0 1 0 0 64z"/></svg>`;
  return el;
}

function ensurePulseStyle() {
  if (typeof document === "undefined" || document.getElementById("gar-pulse-style")) return;
  const s = document.createElement("style");
  s.id = "gar-pulse-style";
  s.textContent = "@keyframes gar-pulse{0%{transform:scale(.5);opacity:.75}70%{transform:scale(2.8);opacity:0}100%{opacity:0}}";
  document.head.appendChild(s);
}

function makeRequestEl(): HTMLDivElement {
  ensurePulseStyle();
  const el = document.createElement("div");
  el.style.cssText = "position:relative;width:24px;height:24px;";
  el.innerHTML =
    `<span style="position:absolute;left:50%;top:50%;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;background:${colors.brandPrimary}40;animation:gar-pulse 1.8s ease-out infinite;"></span>` +
    `<span style="position:absolute;left:50%;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:${colors.brandPrimary};border:2.5px solid #fff;box-shadow:0 2px 7px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;">` +
    `<svg width="9" height="9" viewBox="0 0 384 512" fill="#fff"><path d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0z"/></svg>` +
    `</span>`;
  return el;
}

function makeCustomerEl(): HTMLDivElement {
  ensurePulseStyle();
  const el = document.createElement("div");
  el.style.cssText = "position:relative;width:30px;height:30px;";
  el.innerHTML =
    `<span style="position:absolute;left:50%;top:50%;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:${colors.success}55;animation:gar-pulse 1.6s ease-out infinite;"></span>` +
    `<span style="position:absolute;left:50%;top:50%;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:${colors.success}33;animation:gar-pulse 1.6s ease-out infinite .8s;"></span>` +
    `<span style="position:absolute;left:50%;top:50%;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;background:${colors.success};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;">` +
    `<svg width="13" height="13" viewBox="0 0 448 512" fill="#fff"><path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z"/></svg>` +
    `</span>`;
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

function haversineM(a: number[], b: number[]): number {
  const R = 6371000;
  const toR = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toR;
  const dLng = (b[0] - a[0]) * toR;
  const la1 = a[1] * toR;
  const la2 = b[1] * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function fmtDist(m: number): string {
  const ft = m * 3.28084;
  if (ft > 528) return `${(m / 1609.34).toFixed(1)} mi`;
  return `${Math.max(0, Math.round(ft / 50) * 50)} ft`;
}

function friendlyDist(m: number): string {
  const ft = m * 3.28084;
  if (ft < 120) return "now";
  if (ft < 850) return `${Math.round(ft / 100) * 100} feet`;
  const mi = m / 1609.34;
  if (mi < 0.35) return "a quarter mile";
  if (mi < 0.65) return "half a mile";
  if (mi < 1.2) return "1 mile";
  return `${mi.toFixed(1)} miles`;
}

function arrivalTime(durationSec: number): string {
  const d = new Date(Date.now() + durationSec * 1000);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}


export default function MapView({ pickup, pulsePickup, destination, driver, enrouteFrom, navFrom, navTo, stops = [], style, showRoute = true, autoFit = true, requestMarkers, centerOn, onPickupChange, onRouteInfo, onNavStep, follow, recenterKey, onUserPan }: Props) {
  const containerRef = useRef<any>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const loadedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const routeRef = useRef<number[][] | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const pickupM = useRef<mapboxgl.Marker | null>(null);
  const destM = useRef<mapboxgl.Marker | null>(null);
  const driverM = useRef<mapboxgl.Marker | null>(null);
  const stopMs = useRef<mapboxgl.Marker[]>([]);
  const reqMs = useRef<mapboxgl.Marker[]>([]);
  const youM = useRef<mapboxgl.Marker | null>(null);
  const animRef = useRef<number | null>(null);
  const tickRef = useRef<any>(null);
  const navStateRef = useRef<NavStep | null>(null);
  const announceIdRef = useRef(0);
  const farSetRef = useRef<Set<number>>(new Set());
  const nearSetRef = useRef<Set<number>>(new Set());
  const arrivedRef = useRef(false);

  const navMode = !!(navFrom && navTo);
  const followRef = useRef(false);
  followRef.current = !!(navMode && follow);
  const onUserPanRef = useRef(onUserPan);
  onUserPanRef.current = onUserPan;
  const followingRef = useRef(true);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setSize({ w: Math.round(width), h: Math.round(height) });
  };

  const stopAnim = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  };

  const placeDriver = (lng: number, lat: number) => {
    const map = mapRef.current;
    if (!map) return;
    const [sl, sa] = snapToRoute(routeRef.current, lng, lat);
    if (!driverM.current) driverM.current = new mapboxgl.Marker({ element: makeDriverEl() }).setLngLat([sl, sa]).addTo(map);
    else driverM.current.setLngLat([sl, sa]);
  };

  const positionAt = (traveled: number, coords: number[][], segCum: number[]): number[] => {
    if (traveled <= 0) return coords[0];
    const total = segCum[segCum.length - 1];
    if (traveled >= total) return coords[coords.length - 1];
    let i = 1;
    while (i < segCum.length && segCum[i] < traveled) i++;
    const a = coords[i - 1];
    const b = coords[i];
    const segLen = segCum[i] - segCum[i - 1] || 1;
    const t = (traveled - segCum[i - 1]) / segLen;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };

  const startNavAnimation = (coords: number[][], steps: any[], totalM: number, durationSec: number) => {
    const map = mapRef.current;
    if (!map) return;
    const segCum: number[] = [0];
    for (let i = 1; i < coords.length; i++) segCum.push(segCum[i - 1] + haversineM(coords[i - 1], coords[i]));
    const total = segCum[segCum.length - 1] || totalM || 1;
    const stepEnd: number[] = [];
    let acc = 0;
    steps.forEach((s) => {
      acc += s.distance || 0;
      stepEnd.push(acc);
    });
    onRouteInfo?.({ distanceText: `${(total / 1609.34).toFixed(1)} mi`, durationText: `${Math.max(1, Math.round(durationSec / 60))} min`, arrivalText: arrivalTime(durationSec) });
    const ANIM_MS = Math.min(34000, Math.max(16000, durationSec * 280));
    const start = performance.now();
    farSetRef.current = new Set();
    nearSetRef.current = new Set();
    arrivedRef.current = false;
    if (!driverM.current) driverM.current = new mapboxgl.Marker({ element: makeDriverEl() }).setLngLat(coords[0] as any).addTo(map);
    if (followRef.current) {
      followingRef.current = true;
      map.easeTo({ center: coords[0] as any, zoom: 16.6, bearing: 0, pitch: 55, padding: { top: 170, bottom: 340, left: 30, right: 30 }, duration: 700 });
    }
    const first = (steps[1] || steps[0])?.maneuver?.instruction;
    if (first) navStateRef.current = { instruction: first, distanceText: fmtDist(stepEnd[0] || 0), announce: first, announceId: ++announceIdRef.current };
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / ANIM_MS);
      const traveled = t * total;
      const pos = positionAt(traveled, coords, segCum);
      let si = 0;
      while (si < stepEnd.length - 1 && traveled > stepEnd[si]) si++;
      const distToNext = Math.max(0, stepEnd[si] - traveled);
      const upMv = (steps[si + 1] || steps[si])?.maneuver || {};
      const instr = t >= 1 ? "You have arrived" : upMv.instruction || "Continue straight";
      driverM.current?.setLngLat(pos as any);
      if (followRef.current && followingRef.current) {
        const m2 = mapRef.current!;
        m2.setCenter(pos as any);
        const dz = t >= 1 ? 16.6 : distToNext < 70 ? 18 : distToNext < 170 ? 17.2 : 16.6;
        const cur = m2.getZoom();
        if (Math.abs(cur - dz) > 0.03) m2.setZoom(cur + (dz - cur) * 0.08);
      }
      let announce: string | undefined;
      if (t >= 1) {
        if (!arrivedRef.current) {
          arrivedRef.current = true;
          announce = "You have arrived.";
        }
      } else if (!farSetRef.current.has(si) && distToNext < 320) {
        farSetRef.current.add(si);
        announce = `In ${friendlyDist(distToNext)}, ${instr}`;
      } else if (!nearSetRef.current.has(si) && distToNext < 50) {
        nearSetRef.current.add(si);
        announce = instr;
      }
      navStateRef.current = {
        instruction: instr,
        distanceText: t >= 1 ? "" : fmtDist(distToNext),
        remainingM: t >= 1 ? 0 : Math.max(0, total - traveled),
        type: upMv.type,
        modifier: upMv.modifier,
        announce: announce ?? navStateRef.current?.announce,
        announceId: announce ? ++announceIdRef.current : navStateRef.current?.announceId,
      };
      if (t < 1) animRef.current = requestAnimationFrame(frame);
    };
    animRef.current = requestAnimationFrame(frame);
    tickRef.current = setInterval(() => {
      if (navStateRef.current) onNavStep?.(navStateRef.current);
    }, 350);
  };

  const updateRoute = async () => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    stopAnim();
    if (map.getLayer("route")) map.removeLayer("route");
    if (map.getLayer("route-bg")) map.removeLayer("route-bg");
    if (map.getSource("route")) map.removeSource("route");
    routeRef.current = null;
    const waypoints = navMode ? [navFrom!, navTo!] : ([enrouteFrom, pickup, ...stops, destination].filter(Boolean) as LatLng[]);
    if (!showRoute || waypoints.length < 2) return;
    const path = waypoints.map((p) => `${p.lng},${p.lat}`).join(";");
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${path}?geometries=geojson&overview=full&steps=${navMode}&access_token=${TOKEN}`;
      const res = await fetch(url);
      const json = await res.json();
      const route = json?.routes?.[0];
      const coords = route?.geometry?.coordinates;
      if (!coords || !mapRef.current) return;
      routeRef.current = coords;
      map.addSource("route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } } as any });
      map.addLayer({ id: "route-bg", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#ffffff", "line-width": navMode ? 10 : 8 } });
      map.addLayer({ id: "route", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": navMode ? "#1d4ed8" : colors.brandPrimary, "line-width": navMode ? 6 : 5 } });
      if (navMode) {
        const steps = (route.legs || []).flatMap((l: any) => l.steps || []);
        startNavAnimation(coords, steps, route.distance || 0, route.duration || 0);
      } else if (driver) {
        placeDriver(driver.lng, driver.lat);
      }
    } catch {}
  };

  const fitBounds = () => {
    const map = mapRef.current;
    if (!map || !autoFit) return;
    if (navMode && followRef.current) return;
    const pts: LatLng[] = [];
    if (navMode) {
      pts.push(navFrom!, navTo!);
    } else {
      if (pickup) pts.push(pickup);
      if (destination) pts.push(destination);
      stops.forEach((s) => pts.push(s));
      if (enrouteFrom) pts.push(enrouteFrom);
      if (driver) pts.push(driver);
    }
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: 15.5, duration: 500 });
      return;
    }
    const b = new mapboxgl.LngLatBounds();
    pts.forEach((p) => b.extend([p.lng, p.lat]));
    map.fitBounds(b, { padding: { top: 150, bottom: 320, left: 56, right: 56 }, maxZoom: 15, duration: 600 });
  };

  const updateAll = () => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    if (navMode) {
      // hide pickup/stops; show target pin at navTo
      if (pickupM.current) { pickupM.current.remove(); pickupM.current = null; }
      stopMs.current.forEach((m) => m.remove());
      stopMs.current = [];
      if (!destM.current) destM.current = new mapboxgl.Marker({ color: colors.success }).setLngLat([navTo!.lng, navTo!.lat]).addTo(map);
      else destM.current.setLngLat([navTo!.lng, navTo!.lat]);
      updateRoute();
      fitBounds();
      return;
    }

    if (pickup) {
      if (!pickupM.current) {
        pickupM.current = pulsePickup
          ? new mapboxgl.Marker({ element: makeCustomerEl() }).setLngLat([pickup.lng, pickup.lat]).addTo(map)
          : new mapboxgl.Marker({ color: colors.success, draggable: !!onPickupChange }).setLngLat([pickup.lng, pickup.lat]).addTo(map);
        if (onPickupChange && !pulsePickup) {
          pickupM.current.on("dragend", () => {
            const ll = pickupM.current!.getLngLat();
            onPickupChange({ lat: ll.lat, lng: ll.lng });
          });
        }
      } else pickupM.current.setLngLat([pickup.lng, pickup.lat]);
    } else if (pickupM.current) {
      pickupM.current.remove();
      pickupM.current = null;
    }

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

  const ready = !!size;
  useEffect(() => {
    if (!size || !containerRef.current || mapRef.current) return;
    const center = pickup || destination || navFrom || centerOn || ORLANDO;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [center.lng, center.lat],
      zoom: 12,
      attributionControl: false,
    });
    mapRef.current = map;
    map.on("dragstart", () => {
      if (followRef.current) {
        followingRef.current = false;
        onUserPanRef.current?.();
      }
    });
    map.on("load", () => {
      loadedRef.current = true;
      setLoaded(true);
      map.resize();
      updateAll();
    });
    return () => {
      stopAnim();
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // Create the map only once (when size first becomes available) and tear it
    // down only on unmount — NOT on every pixel-level size change, which would
    // otherwise reset the camera before async location updates land.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (mapRef.current && size) mapRef.current.resize();
  }, [size]);

  const depKey = JSON.stringify({ pickup, destination, stops, enrouteFrom, navFrom, navTo, follow });
  useEffect(() => {
    updateAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !driver || !loadedRef.current || navMode) return;
    placeDriver(driver.lng, driver.lat);
    // Keep pickup, destination and the car icon all framed as the driver moves.
    fitBounds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver?.lat, driver?.lng]);

  // When the pickup location changes (e.g. async geolocation / IP lookup resolves)
  // and there is no destination yet, recenter the map onto the pickup pin so it
  // is always framed and zoomed in for adjustment.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || navMode || !pickup) return;
    if (pickupM.current) pickupM.current.setLngLat([pickup.lng, pickup.lat]);
    if (!destination && stops.length === 0) {
      map.flyTo({ center: [pickup.lng, pickup.lat], zoom: 15.5, duration: 800, essential: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.lat, pickup?.lng, loaded]);

  // Live-requests preview markers (driver "go online" screen).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    reqMs.current.forEach((m) => m.remove());
    reqMs.current = [];
    const list = requestMarkers || [];
    list.forEach((p) => {
      const m = new mapboxgl.Marker({ element: makeRequestEl() }).setLngLat([p.lng, p.lat]).addTo(map);
      reqMs.current.push(m);
    });
    if (centerOn) {
      if (!youM.current) {
        youM.current = new mapboxgl.Marker({ element: makeDriverEl() }).setLngLat([centerOn.lng, centerOn.lat]).addTo(map);
      } else {
        youM.current.setLngLat([centerOn.lng, centerOn.lat]);
      }
    }
    if (list.length) {
      const b = new mapboxgl.LngLatBounds();
      list.forEach((p) => b.extend([p.lng, p.lat] as any));
      if (centerOn) b.extend([centerOn.lng, centerOn.lat] as any);
      map.fitBounds(b, { padding: 60, maxZoom: 13.5, duration: 700 });
    } else if (centerOn) {
      map.easeTo({ center: [centerOn.lng, centerOn.lat], zoom: 12.5, duration: 600 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(requestMarkers), centerOn?.lat, centerOn?.lng, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || recenterKey === undefined) return;
    followingRef.current = true;
    if (navMode && followRef.current) {
      const c = driverM.current?.getLngLat();
      if (c) map.easeTo({ center: [c.lng, c.lat], zoom: 16.6, bearing: 0, pitch: 55, padding: { top: 170, bottom: 340, left: 30, right: 30 }, duration: 500 });
    } else {
      map.easeTo({ bearing: 0, pitch: 0, duration: 300 });
      fitBounds();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);

  return (
    <View
      testID="map-view"
      ref={containerRef}
      onLayout={onLayout}
      style={[style, size ? { width: size.w, height: size.h } : null, { backgroundColor: "#e8eef2" }]}
    />
  );
}
