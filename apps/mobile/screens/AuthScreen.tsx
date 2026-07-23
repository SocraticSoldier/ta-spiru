import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../lib/api';
import { useSession } from '../lib/session';
import { colors } from '../lib/theme';
import { Brand, Button, Screen } from '../components/ui';

type Mode = 'signin' | 'register';

export const AuthScreen = (): React.JSX.Element => {
  const { signIn, register } = useSession();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        await register({ email: email.trim(), password, firstName: firstName.trim(), lastName: lastName.trim() });
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong — try again.');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Brand />
      <View style={styles.tabs}>
        {(['signin', 'register'] as const).map((candidate) => (
          <Text
            key={candidate}
            onPress={() => setMode(candidate)}
            style={[styles.tab, mode === candidate && styles.tabActive]}
          >
            {candidate === 'signin' ? 'Sign in' : 'Create account'}
          </Text>
        ))}
      </View>

      {mode === 'register' ? (
        <View style={styles.row}>
          <TextInput
            placeholder="First name"
            placeholderTextColor={colors.faint}
            value={firstName}
            onChangeText={setFirstName}
            style={[styles.input, styles.rowInput]}
          />
          <TextInput
            placeholder="Last name"
            placeholderTextColor={colors.faint}
            value={lastName}
            onChangeText={setLastName}
            style={[styles.input, styles.rowInput]}
          />
        </View>
      ) : null}

      <TextInput
        placeholder="Email"
        placeholderTextColor={colors.faint}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        placeholderTextColor={colors.faint}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.action}>
        <Button
          label={mode === 'signin' ? 'Sign in' : 'Create account'}
          onPress={() => void submit()}
          busy={busy}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 18, marginTop: 28, marginBottom: 20 },
  tab: { color: colors.muted, fontSize: 16 },
  tabActive: { color: colors.bronzeLight, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10 },
  rowInput: { flex: 1 },
  input: {
    backgroundColor: colors.panel,
    borderColor: colors.panelEdge,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 16,
    marginBottom: 12,
  },
  error: { color: colors.danger, fontSize: 14, marginBottom: 8 },
  action: { marginTop: 8 },
});
