import React, { useMemo, useState } from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import Svg, { Line, Path, Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";

export type LatLng = { lat: number; lng: number; label?: string };

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

function buildProjector(points: LatLng[], w: number, h: number, pad: number) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const spanLat = Math.max(maxLat - minLat, 0.01);
  const spanLng = Math.max(maxLng - minLng, 0.01);
  return (p: LatLng) => {
    const x = pad + ((p.lng - minLng) / spanLng) * (w - 2 * pad);
    const y = pad + ((maxLat - p.lat) / spanLat) * (h - 2 * pad);
    return { x, y };
  };
}

export default function MapView({ pickup, destination, driver, enrouteFrom, stops = [], style, showRoute = true }: Props) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  const all = useMemo(() => {
    const pts: LatLng[] = [];
    if (pickup) pts.push(pickup);
    stops.forEach((s) => pts.push(s));
    if (destination) pts.push(destination);
    if (driver) pts.push(driver);
    if (pts.length === 0) pts.push({ lat: 28.5384, lng: -81.3789 });
    return pts;
  }, [pickup, destination, driver, stops]);

  const project = size ? buildProjector(all, size.w, size.h, 56) : null;

  const routePts = useMemo(() => {
    const r: LatLng[] = [];
    if (enrouteFrom) r.push(enrouteFrom);
    if (pickup) r.push(pickup);
    stops.forEach((s) => r.push(s));
    if (destination) r.push(destination);
    return r;
  }, [pickup, destination, stops, enrouteFrom]);

  let routePath = "";
  if (project && routePts.length >= 2) {
    routePath = routePts
      .map((p, i) => {
        const { x, y } = project(p);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  const street = (frac: number, horizontal: boolean) => {
    if (!size) return null;
    const v = horizontal ? size.h * frac : size.w * frac;
    return horizontal ? (
      <Line x1={0} y1={v} x2={size.w} y2={v} stroke="#e2e6ea" strokeWidth={frac % 0.4 < 0.2 ? 6 : 2} />
    ) : (
      <Line x1={v} y1={0} x2={v} y2={size.h} stroke="#e2e6ea" strokeWidth={frac % 0.4 < 0.2 ? 6 : 2} />
    );
  };

  return (
    <View style={[styles.map, style]} onLayout={onLayout} testID="map-view">
      {size && project && (
        <>
          <Svg width={size.w} height={size.h}>
            {[0.12, 0.28, 0.45, 0.62, 0.78, 0.92].map((f) => (
              <React.Fragment key={`h${f}`}>{street(f, true)}</React.Fragment>
            ))}
            {[0.15, 0.35, 0.55, 0.75, 0.9].map((f) => (
              <React.Fragment key={`v${f}`}>{street(f, false)}</React.Fragment>
            ))}
            {showRoute && routePath ? (
              <>
                <Path d={routePath} stroke={colors.brandPrimary} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </>
            ) : null}
            {driver && pickup ? (
              <Path
                d={`M${project(driver).x},${project(driver).y} L${project(pickup).x},${project(pickup).y}`}
                stroke={colors.borderStrong}
                strokeWidth={2}
                strokeDasharray="5,5"
                fill="none"
              />
            ) : null}
            {pickup ? <Circle cx={project(pickup).x} cy={project(pickup).y} r={8} fill={colors.success} stroke="#fff" strokeWidth={3} /> : null}
            {destination ? <Circle cx={project(destination).x} cy={project(destination).y} r={8} fill={colors.brandPrimary} stroke="#fff" strokeWidth={3} /> : null}
          </Svg>

          {stops.map((s, i) => {
            const p = project(s);
            return (
              <View key={i} style={[styles.stopDot, { left: p.x - 5, top: p.y - 5 }]} />
            );
          })}

          {driver ? (
            (() => {
              const p = project(driver);
              return (
                <View style={[styles.driverMarker, { left: p.x - 18, top: p.y - 18 }]} testID="driver-marker">
                  <Ionicons name="car" size={18} color="#fff" />
                </View>
              );
            })()
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    backgroundColor: "#eef1f4",
    overflow: "hidden",
  },
  driverMarker: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceInverse,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  stopDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.warning,
    borderWidth: 2,
    borderColor: "#fff",
  },
});
