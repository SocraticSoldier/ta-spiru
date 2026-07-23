import { StatusBar } from 'expo-status-bar';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { BRANCHES } from '@ta-spiru/shared';

const App = (): React.JSX.Element => (
  <View style={styles.screen}>
    <StatusBar style="light" />
    <Text style={styles.brand}>TA&apos; SPIRU</Text>
    <Text style={styles.headline}>A sharp cut. A spotless car. One booking.</Text>
    <FlatList
      data={[...BRANCHES]}
      keyExtractor={(branch) => branch.slug}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardSubtitle}>{item.descriptor}</Text>
        </View>
      )}
    />
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#111113',
    paddingTop: 96,
    paddingHorizontal: 24,
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
    marginBottom: 24,
  },
  list: {
    gap: 12,
    paddingBottom: 48,
  },
  card: {
    backgroundColor: '#1c1c1e',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  cardSubtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    marginTop: 4,
  },
});

export default App;
