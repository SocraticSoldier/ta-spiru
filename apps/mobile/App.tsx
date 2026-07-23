import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SessionProvider, useSession } from './lib/session';
import { colors } from './lib/theme';
import { Loading } from './components/ui';
import { AccountScreen } from './screens/AccountScreen';
import { AuthScreen } from './screens/AuthScreen';
import { BookScreen } from './screens/BookScreen';
import { HomeScreen } from './screens/HomeScreen';
import { QueueScreen } from './screens/QueueScreen';

type Tab = 'home' | 'book' | 'queue' | 'account';

const TABS: { key: Tab; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'book', label: 'Book' },
  { key: 'queue', label: 'Queue' },
  { key: 'account', label: 'Account' },
];

const TabBar = ({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }): React.JSX.Element => (
  <View style={styles.tabBar}>
    {TABS.map((tab) => (
      <Pressable key={tab.key} style={styles.tabButton} onPress={() => onChange(tab.key)}>
        <Text style={[styles.tabLabel, active === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
        {active === tab.key ? <View style={styles.tabDot} /> : null}
      </Pressable>
    ))}
  </View>
);

const AuthedApp = (): React.JSX.Element => {
  const [tab, setTab] = useState<Tab>('home');

  return (
    <View style={styles.appShell}>
      <View style={styles.screenArea}>
        {tab === 'home' ? <HomeScreen onBook={() => setTab('book')} /> : null}
        {tab === 'book' ? <BookScreen onDone={() => setTab('account')} /> : null}
        {tab === 'queue' ? <QueueScreen /> : null}
        {tab === 'account' ? <AccountScreen /> : null}
      </View>
      <TabBar active={tab} onChange={setTab} />
    </View>
  );
};

const Gate = (): React.JSX.Element => {
  const { user, loading } = useSession();
  if (loading) {
    return <Loading />;
  }
  return user ? <AuthedApp /> : <AuthScreen />;
};

const App = (): React.JSX.Element => {
  const [fontsLoaded] = useFonts({ Brewheat: require('./assets/fonts/Brewheat.ttf') as number });

  return (
    <SessionProvider>
      <StatusBar style="light" />
      {fontsLoaded ? <Gate /> : <Loading />}
    </SessionProvider>
  );
};

const styles = StyleSheet.create({
  appShell: { flex: 1, backgroundColor: colors.ground },
  screenArea: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.panelEdge,
    backgroundColor: colors.ground,
    paddingBottom: 26,
    paddingTop: 12,
  },
  tabButton: { flex: 1, alignItems: 'center' },
  tabLabel: { color: colors.faint, fontSize: 13 },
  tabLabelActive: { color: colors.bronzeLight, fontWeight: '600' },
  tabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.bronze, marginTop: 4 },
});

export default App;
