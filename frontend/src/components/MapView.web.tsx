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
  stops?: LatLng[];
  style?: any;
  showRoute?: boolean;
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

export default function MapView({ pickup, destination, driver, stops = [], style, showRoute = true }: Props) {
  const containerRef = useRef<any>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const loadedRef = useRef(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const pickupM = useRef<mapboxgl.Marker | null>(null);
  const destM = useRef<mapboxgl.Marker | null>(null);
  const driverM = useRef<mapboxgl.Marker | null>(null);
  const stopMs = useRef<mapboxgl.Marker[]>([]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setSize({ w: Math.round(width), h: Math.round(height) });
  };

  const setPin = (ref: React.MutableRefObject<mapboxgl.Marker | null>, place: LatLng | null | undefined, color: string) => {
    const map = mapRef.current;
    if (!map) return;
    if (place) {
      if (!ref.current) ref.current = new mapboxgl.Marker({ color }).setLngLat([place.lng, place.lat]).addTo(map);
      else ref.current.setLngLat([place.lng, place.lat]);
    } else if (ref.current) {
      ref.current.remove();
      ref.current = null;
    }
  };

  const updateRoute = async () => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    if (map.getLayer("route")) map.removeLayer("route");
    if (map.getLayer("route-bg")) map.removeLayer("route-bg");
    if (map.getSource("route")) map.removeSource("route");
    if (!showRoute || !pickup || !destination) return;
    const path = [pickup, ...stops, destination].map((p) => `${p.lng},${p.lat}`).join(";");
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${path}?geometries=geojson&overview=full&access_token=${TOKEN}`;
      const res = await fetch(url);
      const json = await res.json();
      const coords = json?.routes?.[0]?.geometry?.coordinates;
      if (!coords || !mapRef.current || !map.getStyle()) return;
      map.addSource("route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } } as any });
      map.addLayer({ id: "route-bg", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#ffffff", "line-width": 8 } });
      map.addLayer({ id: "route", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": colors.brandPrimary, "line-width": 5 } });
    } catch {}
  };

  const fitBounds = () => {
    const map = mapRef.current;
    if (!map) return;
    const pts: LatLng[] = [];
    if (pickup) pts.push(pickup);
    if (destination) pts.push(destination);
    stops.forEach((s) => pts.push(s));
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
    setPin(pickupM, pickup, colors.success);
    setPin(destM, destination, colors.brandPrimary);
    stopMs.current.forEach((m) => m.remove());
    stopMs.current = stops.map((s) => new mapboxgl.Marker({ color: colors.warning }).setLngLat([s.lng, s.lat]).addTo(map));
    if (driver) {
      if (!driverM.current) driverM.current = new mapboxgl.Marker({ element: makeDriverEl() }).setLngLat([driver.lng, driver.lat]).addTo(map);
      else driverM.current.setLngLat([driver.lng, driver.lat]);
    } else if (driverM.current) {
      driverM.current.remove();
      driverM.current = null;
    }
    updateRoute();
    fitBounds();
  };

  // init map once we know the container size
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

  // keep canvas sized to the container
  useEffect(() => {
    if (mapRef.current && size) mapRef.current.resize();
  }, [size]);

  // react to route endpoints / stops
  const depKey = JSON.stringify({ pickup, destination, stops });
  useEffect(() => {
    updateAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  // react to frequent driver movement (pan only)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !driver || !loadedRef.current) return;
    if (driverM.current) driverM.current.setLngLat([driver.lng, driver.lat]);
    else driverM.current = new mapboxgl.Marker({ element: makeDriverEl() }).setLngLat([driver.lng, driver.lat]).addTo(map);
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
