import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, TextInput, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, radius, spacing } from "@/src/theme";

type Props = {
  label: string;
  value: string;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  onSelect: (value: string) => void;
  testID?: string;
};

export default function SelectField({ label, value, options, placeholder, disabled, searchable = true, onSelect, testID }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [query, options]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        testID={testID}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.input, disabled && styles.inputDisabled]}
      >
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder || "Select…"}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{label}</Text>
          {searchable && (
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={colors.muted} />
              <TextInput
                testID={`${testID}-search`}
                style={styles.search}
                placeholder="Search…"
                placeholderTextColor={colors.muted}
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
            </View>
          )}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 360 }}
            renderItem={({ item }) => (
              <Pressable
                testID={`${testID}-option-${item}`}
                style={styles.option}
                onPress={() => { onSelect(item); close(); }}
              >
                <Text style={[styles.optionText, item === value && styles.optionTextActive]}>{item}</Text>
                {item === value && <Ionicons name="checkmark" size={18} color={colors.brandPrimary} />}
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No matches</Text>}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { fontFamily: font.medium, fontSize: 13, color: colors.onSurfaceSecondary },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputDisabled: { backgroundColor: colors.surfaceSecondary, opacity: 0.6 },
  value: { flex: 1, fontFamily: font.regular, fontSize: 16, color: colors.onSurface },
  placeholder: { color: colors.muted },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing["2xl"] },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: colors.surfaceTertiary, marginBottom: spacing.md },
  sheetTitle: { fontFamily: font.bold, fontSize: 18, color: colors.onSurface, marginBottom: spacing.md },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  search: { flex: 1, fontFamily: font.regular, fontSize: 15, color: colors.onSurface },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  optionText: { fontFamily: font.medium, fontSize: 16, color: colors.onSurface },
  optionTextActive: { color: colors.brandPrimary, fontFamily: font.bold },
  empty: { fontFamily: font.regular, fontSize: 14, color: colors.muted, textAlign: "center", paddingVertical: spacing.xl },
});
