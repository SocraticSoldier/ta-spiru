import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { LocationSummary, ServiceSummary } from '@ta-spiru/shared';
import { BRANCHES } from '@ta-spiru/shared';
import { getBranches, getServices } from './lib/api';

interface HomeData {
  branches: LocationSummary[];
  services: ServiceSummary[];
}

const formatEuro = (cents: number): string => `€${(cents / 100).toFixed(2)}`;

const App = (): React.JSX.Element => {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [branches, services] = await Promise.all([getBranches(), getServices()]);
      setData({ branches, services });
      setOffline(false);
    } catch {
      setData(null);
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const branches: { name: string; descriptor: string }[] =
    data?.branches.map((branch) => ({
      name: branch.name,
      descriptor: `${branch.chairCount} chairs${branch.bayCount > 0 ? ` · ${branch.bayCount} wash bays` : ''}`,
    })) ?? BRANCHES.map((branch) => ({ name: branch.name, descriptor: branch.descriptor }));

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.brand}>TA&apos; SPIRU</Text>
        <Text style={styles.headline}>A sharp cut. A spotless car. One booking.</Text>

        {offline ? (
          <Pressable style={styles.offlineBanner} onPress={() => void load()}>
            <Text style={styles.offlineText}>Live data unavailable — tap to retry</Text>
          </Pressable>
        ) : null}

        {loading ? <ActivityIndicator color="#b08d57" style={styles.loader} /> : null}

        {data && data.services.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>SERVICES</Text>
            {data.services.map((service) => (
              <View key={service.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardTitle}>{service.name}</Text>
                  <Text style={styles.price}>{formatEuro(service.priceCents)}</Text>
                </View>
                <Text style={styles.cardSubtitle}>
                  {service.durationMin} min · {service.kind === 'BARBER' ? 'Barbering' : 'Detailing'}
                  {service.isComboEligible ? ' · Combo eligible' : ''}
                </Text>
              </View>
            ))}
          </>
        ) : null}

        <Text style={styles.sectionTitle}>BRANCHES</Text>
        {branches.map((branch) => (
          <View key={branch.name} style={styles.card}>
            <Text style={styles.cardTitle}>{branch.name}</Text>
            <Text style={styles.cardSubtitle}>{branch.descriptor}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#111113',
  },
  scroll: {
    paddingTop: 96,
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  brand: {
    color: '#b08d57',
    fontSize: 13,
    letterSpacing: 6,
    fontWeight: '600',
  },
  headline: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  offlineBanner: {
    backgroundColor: 'rgba(176,141,87,0.12)',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  offlineText: {
    color: '#cfae7b',
    fontSize: 13,
    textAlign: 'center',
  },
  loader: {
    marginTop: 24,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: '600',
    marginTop: 28,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#1c1c1e',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  price: {
    color: '#cfae7b',
    fontSize: 15,
    fontWeight: '600',
  },
  cardSubtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    marginTop: 4,
  },
});

export default App;
