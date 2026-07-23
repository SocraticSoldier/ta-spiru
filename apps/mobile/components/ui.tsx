import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../lib/theme';

export const Screen = ({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
}): React.JSX.Element => {
  if (!scroll) {
    return <View style={styles.screen}>{children}</View>;
  }
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      {children}
    </ScrollView>
  );
};

export const Brand = ({ subtitle }: { subtitle?: string }): React.JSX.Element => (
  <View style={styles.brandWrap}>
    <Text style={styles.brand}>Ta&rsquo; Spiru</Text>
    <Text style={styles.tagline}>It&rsquo;s not just a haircut, it&rsquo;s a lifestyle!</Text>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
  </View>
);

export const Card = ({
  children,
  accent,
}: {
  children: ReactNode;
  accent?: string;
}): React.JSX.Element => (
  <View style={[styles.card, accent ? { borderLeftColor: accent, borderLeftWidth: 3 } : null]}>
    {children}
  </View>
);

export const Button = ({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  busy?: boolean;
}): React.JSX.Element => (
  <Pressable
    onPress={onPress}
    disabled={disabled || busy}
    style={({ pressed }) => [
      styles.button,
      variant === 'primary' ? styles.buttonPrimary : styles.buttonGhost,
      (disabled || busy) && styles.buttonDisabled,
      pressed && !disabled && styles.buttonPressed,
    ]}
  >
    {busy ? (
      <ActivityIndicator color={variant === 'primary' ? colors.ground : colors.bronzeLight} />
    ) : (
      <Text style={variant === 'primary' ? styles.buttonPrimaryText : styles.buttonGhostText}>
        {label}
      </Text>
    )}
  </Pressable>
);

export const Chip = ({
  label,
  active,
  onPress,
  accent = colors.bronze,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accent?: string;
}): React.JSX.Element => (
  <Pressable
    onPress={onPress}
    style={[styles.chip, active ? { backgroundColor: accent, borderColor: accent } : null]}
  >
    <Text style={[styles.chipText, active ? { color: colors.ground, fontWeight: '600' } : null]}>
      {label}
    </Text>
  </Pressable>
);

export const SectionTitle = ({ children }: { children: ReactNode }): React.JSX.Element => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

export const ScriptText = ({
  children,
  size = 20,
  color = colors.bronze,
}: {
  children: ReactNode;
  size?: number;
  color?: string;
}): React.JSX.Element => (
  // Brewheat stands in for the script mark on native; italic keeps the brand feel.
  <Text style={[styles.script, { fontSize: size, color }]}>{children}</Text>
);

export const Loading = (): React.JSX.Element => (
  <View style={styles.loading}>
    <ActivityIndicator color={colors.bronze} size="large" />
  </View>
);

export const Notice = ({ text }: { text: string }): React.JSX.Element => (
  <View style={styles.notice}>
    <Text style={styles.noticeText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  scrollContent: { paddingHorizontal: 22, paddingTop: 72, paddingBottom: 48 },
  brandWrap: { marginBottom: 8 },
  brand: { fontFamily: 'Brewheat', fontSize: 34, color: colors.bronzeLight },
  tagline: { fontStyle: 'italic', fontSize: 15, color: colors.bronze, marginTop: 2 },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 10 },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.panelEdge,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonPrimary: { backgroundColor: colors.bronze },
  buttonGhost: { borderWidth: 1, borderColor: colors.panelEdge },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonPrimaryText: { color: colors.ground, fontWeight: '600', fontSize: 16 },
  buttonGhostText: { color: colors.muted, fontSize: 16 },
  chip: {
    borderWidth: 1,
    borderColor: colors.panelEdge,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: { color: colors.muted, fontSize: 14 },
  sectionTitle: {
    color: colors.faint,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 12,
  },
  script: { fontStyle: 'italic', fontWeight: '500' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ground },
  notice: {
    borderWidth: 1,
    borderColor: colors.panelEdge,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
  },
  noticeText: { color: colors.muted, fontSize: 14, textAlign: 'center' },
});
