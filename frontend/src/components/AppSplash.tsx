import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";

const SPLASH_BG = "#8b008b";
const DURATION = 2600;

export default function AppSplash({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 450, useNativeDriver: true }).start(({ finished }) => {
        if (finished) onDone();
      });
    }, DURATION);
    return () => clearTimeout(t);
  }, [onDone, opacity]);

  return (
    <Animated.View style={[styles.fill, { opacity }]} pointerEvents="none">
      <View style={styles.bg}>
        <Image source={require("../../assets/images/splash.gif")} style={styles.img} resizeMode="cover" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, zIndex: 999 },
  bg: { flex: 1, backgroundColor: SPLASH_BG },
  img: { width: "100%", height: "100%" },
});
