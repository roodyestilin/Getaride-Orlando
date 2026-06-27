import React from "react";
import { Text } from "react-native";
import { colors, font } from "@/src/theme";

// Card entry uses Stripe.js Elements, which is web-only. This native stub keeps
// imports resolvable on native builds (the app runs as a web app).
export default function StripeCardForm(_props: any) {
  return <Text style={{ fontFamily: font.regular, color: colors.muted }}>Card entry is available on the web app.</Text>;
}
