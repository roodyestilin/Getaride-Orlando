import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { colors, font, radius, spacing } from "@/src/theme";

export type DocFile = { name: string; mimeType: string; dataUrl: string };

type Props = {
  label: string;
  hint?: string;
  value: DocFile | null;
  onChange: (file: DocFile | null) => void;
  imageOnly?: boolean;
  testID?: string;
};

async function toDataUrl(uri: string): Promise<string> {
  if (uri.startsWith("data:")) return uri;
  const res = await fetch(uri);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function DocumentField({ label, hint, value, onChange, imageOnly, testID }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: imageOnly ? ["image/jpeg", "image/png"] : ["image/jpeg", "image/png", "application/pdf"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.length) {
        setLoading(false);
        return;
      }
      const asset = res.assets[0];
      const mimeType = asset.mimeType || "application/octet-stream";
      const isImg = mimeType.includes("jpeg") || mimeType.includes("jpg") || mimeType.includes("png");
      const okType = imageOnly ? isImg : (isImg || mimeType.includes("pdf"));
      if (!okType) {
        setError(imageOnly ? "Please upload a JPEG or PNG photo." : "Please upload a JPEG or PDF file.");
        setLoading(false);
        return;
      }
      if (asset.size && asset.size > 8 * 1024 * 1024) {
        setError("File is too large (max 8MB).");
        setLoading(false);
        return;
      }
      const dataUrl = await toDataUrl(asset.uri);
      onChange({ name: asset.name || "document", mimeType, dataUrl });
    } catch {
      setError("Couldn't read that file. Try another.");
    } finally {
      setLoading(false);
    }
  };

  const isImage = value?.mimeType?.includes("image");

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {value ? (
        <View style={styles.filled} testID={`${testID}-filled`}>
          {isImage ? (
            <Image source={{ uri: value.dataUrl }} style={styles.thumb} />
          ) : (
            <View style={styles.pdfIcon}>
              <Ionicons name="document-text" size={22} color={colors.brandPrimary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.fileName} numberOfLines={1}>{value.name}</Text>
            <Text style={styles.fileMeta}>{isImage ? "Image" : "PDF"} · uploaded</Text>
          </View>
          <Pressable testID={`${testID}-remove`} onPress={() => onChange(null)} hitSlop={8} style={styles.removeBtn}>
            <Ionicons name="close" size={18} color={colors.muted} />
          </Pressable>
        </View>
      ) : (
        <Pressable testID={testID} onPress={pick} style={styles.dropzone} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.brandPrimary} />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={22} color={colors.brandPrimary} />
              <Text style={styles.dropText}>Upload {hint || "JPEG or PDF"}</Text>
            </>
          )}
        </Pressable>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { fontFamily: font.medium, fontSize: 13, color: colors.onSurfaceSecondary },
  dropzone: {
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  dropText: { fontFamily: font.semibold, fontSize: 14, color: colors.brandPrimary },
  filled: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  thumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceSecondary },
  pdfIcon: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  fileName: { fontFamily: font.semibold, fontSize: 14, color: colors.onSurface },
  fileMeta: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  removeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  error: { fontFamily: font.medium, fontSize: 12, color: colors.error },
});
