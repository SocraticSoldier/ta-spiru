import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type {
  LocationSummary,
  QueueSnapshot,
  ServiceSummary,
  UpsellSuggestion,
} from '@ta-spiru/shared';
import { api, ApiError } from '../lib/api';
import { colors, formatEuro, kindAccent } from '../lib/theme';
import { Brand, Button, Card, Chip, Loading, Notice, Screen, ScriptText, SectionTitle } from '../components/ui';

export const QueueScreen = (): React.JSX.Element => {
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [upsell, setUpsell] = useState<UpsellSuggestion | null>(null);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.branches(), api.services('BARBER')])
      .then(([loadedLocations, loadedServices]) => {
        setLocations(loadedLocations);
        setServices(loadedServices);
        setLocationId(loadedLocations[0]?.id ?? null);
        setReady(true);
      })
      .catch(() => setFailed(true));
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    if (!locationId) {
      return;
    }
    try {
      setSnapshot(await api.queue(locationId));
    } catch {
      setSnapshot(null);
    }
  }, [locationId]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 8000);
    return () => clearInterval(timer);
  }, [refresh]);

  const join = async (serviceId: string): Promise<void> => {
    if (!locationId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.joinQueue({ locationId, serviceId });
      setJoined(true);
      setUpsell(result.upsell);
      void refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setError('You are already in this queue.');
      } else if (caught instanceof ApiError && caught.status === 401) {
        setError('Sign in to join the queue.');
      } else {
        setError('Could not join the queue — try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (failed) {
    return (
      <Screen>
        <Brand subtitle="Live queue" />
        <View style={{ marginTop: 20 }}>
          <Notice text="Queue is temporarily unavailable — try again shortly." />
        </View>
      </Screen>
    );
  }
  if (!ready) {
    return <Loading />;
  }

  const barberWaiting = snapshot?.entries.filter((entry) => entry.serviceKind === 'BARBER') ?? [];
  const washWaiting = snapshot?.entries.filter((entry) => entry.serviceKind === 'WASH') ?? [];

  return (
    <Screen>
      <Brand subtitle="Walk in and join the live queue" />

      <SectionTitle>Branch</SectionTitle>
      <View style={styles.wrap}>
        {locations.map((location) => (
          <Chip
            key={location.id}
            label={location.name}
            active={locationId === location.id}
            onPress={() => {
              setLocationId(location.id);
              setJoined(false);
              setUpsell(null);
            }}
          />
        ))}
      </View>

      {upsell ? (
        <Card accent={colors.wash}>
          <ScriptText size={20} color={colors.washLight}>
            While you wait…
          </ScriptText>
          <Text style={styles.upsellText}>{upsell.reason}</Text>
          <Text style={styles.upsellMeta}>
            {upsell.serviceName} · {formatEuro(upsell.priceCents)} · {upsell.durationMin} min
          </Text>
          <View style={{ marginTop: 12 }}>
            <Button
              label={`Add ${upsell.serviceName}`}
              variant="ghost"
              onPress={() => void join(upsell.serviceId)}
            />
          </View>
        </Card>
      ) : null}

      {!joined ? (
        <>
          <SectionTitle>Join for a cut</SectionTitle>
          <View style={styles.wrap}>
            {services.map((service) => (
              <Chip key={service.id} label={service.name} active={false} onPress={() => void join(service.id)} />
            ))}
          </View>
          {busy ? <Text style={styles.hint}>Joining…</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </>
      ) : (
        <View style={styles.joinedBanner}>
          <ScriptText size={22} color={colors.bronzeLight}>
            You&rsquo;re in the queue!
          </ScriptText>
          <Text style={styles.hint}>Watch the counter — we&rsquo;ll call you shortly.</Text>
        </View>
      )}

      <SectionTitle>Barbering — now waiting ({barberWaiting.length})</SectionTitle>
      {barberWaiting.length === 0 ? (
        <Text style={styles.hint}>No wait right now.</Text>
      ) : (
        barberWaiting.map((entry) => <QueueRow key={entry.id} name={entry.displayName} service={entry.serviceName} status={entry.status} wait={entry.estimatedWaitMin} kind="BARBER" />)
      )}

      <SectionTitle>Car detailing — now waiting ({washWaiting.length})</SectionTitle>
      {washWaiting.length === 0 ? (
        <Text style={styles.hint}>No wait right now.</Text>
      ) : (
        washWaiting.map((entry) => <QueueRow key={entry.id} name={entry.displayName} service={entry.serviceName} status={entry.status} wait={entry.estimatedWaitMin} kind="WASH" />)
      )}
    </Screen>
  );
};

const QueueRow = ({
  name,
  service,
  status,
  wait,
  kind,
}: {
  name: string;
  service: string;
  status: string;
  wait: number | null;
  kind: 'BARBER' | 'WASH';
}): React.JSX.Element => {
  const accent = kindAccent(kind);
  return (
    <Card accent={accent.solid}>
      <View style={styles.queueRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.queueName}>{name}</Text>
          <Text style={styles.hint}>{service}</Text>
        </View>
        <Text style={[styles.queueStatus, { color: accent.text }]}>
          {status === 'WAITING' && wait !== null ? `~${wait} min` : status.replace('_', ' ')}
        </Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  hint: { color: colors.muted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 14, marginTop: 8 },
  upsellText: { color: colors.ink, fontSize: 15, marginTop: 8 },
  upsellMeta: { color: colors.muted, fontSize: 13, marginTop: 6 },
  joinedBanner: { marginTop: 16, marginBottom: 4 },
  queueRow: { flexDirection: 'row', alignItems: 'center' },
  queueName: { color: colors.ink, fontSize: 16, fontWeight: '500' },
  queueStatus: { fontFamily: 'Brewheat', fontSize: 18 },
});
