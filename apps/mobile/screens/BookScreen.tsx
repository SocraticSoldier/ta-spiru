import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { LocationSummary, ServiceSummary } from '@ta-spiru/shared';
import { api, ApiError } from '../lib/api';
import { nextDates, shortDate } from '../lib/dates';
import { colors, formatEuro, formatTimeMalta, kindAccent } from '../lib/theme';
import { Brand, Button, Card, Chip, Loading, Notice, Screen, ScriptText, SectionTitle } from '../components/ui';

type Stream = 'CUT' | 'WASH' | 'COMBO';

interface Slot {
  startsAt: string;
  barberId: string | null;
  washBayId: string | null;
  label: string;
}

const STREAMS: { key: Stream; title: string; mark: string }[] = [
  { key: 'CUT', title: 'A Cut', mark: 'The Barber' },
  { key: 'WASH', title: 'A Wash', mark: 'The Car Wash' },
  { key: 'COMBO', title: 'Combo Wash & Cut', mark: 'Both, one slot' },
];

export const BookScreen = ({ onDone }: { onDone: () => void }): React.JSX.Element => {
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const [stream, setStream] = useState<Stream | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [barberServiceId, setBarberServiceId] = useState<string | null>(null);
  const [washServiceId, setWashServiceId] = useState<string | null>(null);
  const [date, setDate] = useState<string>(nextDates(1)[0] ?? '');
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [vehicleReg, setVehicleReg] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ time: string; amountCents: number; combo: boolean } | null>(null);

  const dates = useMemo(() => nextDates(14), []);

  useEffect(() => {
    Promise.all([api.branches(), api.services()])
      .then(([loadedLocations, loadedServices]) => {
        setLocations(loadedLocations);
        setServices(loadedServices);
        setReady(true);
      })
      .catch(() => setFailed(true));
  }, []);

  const needsBay = stream === 'WASH' || stream === 'COMBO';
  const branches = needsBay ? locations.filter((location) => location.bayCount > 0) : locations;
  const barberServices = services.filter(
    (service) => service.kind === 'BARBER' && (stream !== 'COMBO' || service.isComboEligible),
  );
  const washServices = services.filter(
    (service) => service.kind === 'WASH' && (stream !== 'COMBO' || service.isComboEligible),
  );
  const servicesChosen =
    stream === 'CUT' ? barberServiceId !== null
    : stream === 'WASH' ? washServiceId !== null
    : barberServiceId !== null && washServiceId !== null;

  const loadSlots = useCallback(async (): Promise<void> => {
    if (!stream || !locationId || !servicesChosen) {
      return;
    }
    setSlotsLoading(true);
    setSlot(null);
    setSlots(null);
    try {
      if (stream === 'COMBO' && barberServiceId && washServiceId) {
        const combo = await api.comboAvailability(locationId, date, barberServiceId, washServiceId);
        setSlots(
          combo.map((entry) => ({
            startsAt: entry.startsAt,
            barberId: entry.barberId,
            washBayId: entry.washBayId,
            label: `${formatTimeMalta(entry.startsAt)} · ${entry.barberName}`,
          })),
        );
      } else {
        const serviceId = stream === 'CUT' ? barberServiceId : washServiceId;
        if (!serviceId) {
          return;
        }
        const single = await api.availability(locationId, date, serviceId);
        setSlots(
          single.map((entry) => ({
            startsAt: entry.startsAt,
            barberId: entry.barberId,
            washBayId: entry.resourceId,
            label: `${formatTimeMalta(entry.startsAt)}${entry.barberName ? ` · ${entry.barberName}` : ''}`,
          })),
        );
      }
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [stream, locationId, servicesChosen, date, barberServiceId, washServiceId]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  const totalCents =
    (stream !== 'WASH' ? (barberServices.find((s) => s.id === barberServiceId)?.priceCents ?? 0) : 0) +
    (stream !== 'CUT' ? (washServices.find((s) => s.id === washServiceId)?.priceCents ?? 0) : 0);

  const book = async (): Promise<void> => {
    if (!stream || !locationId || !slot) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const appointmentIds: string[] = [];
      const splits: { tag: string; amountCents: number }[] = [];
      if (stream === 'COMBO' && barberServiceId && washServiceId && slot.barberId && slot.washBayId) {
        const combo = await api.bookCombo({
          locationId,
          startsAt: slot.startsAt,
          barberServiceId,
          washServiceId,
          barberId: slot.barberId,
          washBayId: slot.washBayId,
          vehicleReg: vehicleReg || undefined,
        });
        appointmentIds.push(combo.barberAppointmentId, combo.washAppointmentId);
        splits.push(
          { tag: 'BARBER_SERVICES', amountCents: barberServices.find((s) => s.id === barberServiceId)?.priceCents ?? 0 },
          { tag: 'CAR_DETAILING', amountCents: washServices.find((s) => s.id === washServiceId)?.priceCents ?? 0 },
        );
      } else {
        const serviceId = (stream === 'CUT' ? barberServiceId : washServiceId) ?? '';
        const created = await api.bookSingle({
          locationId,
          serviceId,
          startsAt: slot.startsAt,
          barberId: slot.barberId ?? undefined,
          washBayId: slot.washBayId ?? undefined,
          vehicleReg: needsBay ? vehicleReg || undefined : undefined,
        });
        appointmentIds.push(created.id);
        splits.push({ tag: stream === 'CUT' ? 'BARBER_SERVICES' : 'CAR_DETAILING', amountCents: totalCents });
      }
      await api.paymentIntent({ amountCents: totalCents, channel: 'ONLINE', splitLedgerTags: splits, appointmentIds });
      setConfirmation({ time: slot.startsAt, amountCents: totalCents, combo: stream === 'COMBO' });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setError('That slot was just taken — pick another time.');
        void loadSlots();
      } else {
        setError('Booking failed — please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (failed) {
    return (
      <Screen>
        <Brand subtitle="Booking" />
        <View style={{ marginTop: 20 }}>
          <Notice text="Booking is temporarily unavailable — try again shortly." />
        </View>
      </Screen>
    );
  }
  if (!ready) {
    return <Loading />;
  }

  if (confirmation) {
    return (
      <Screen>
        <Brand />
        <View style={styles.confirm}>
          <ScriptText size={34} color={colors.bronzeLight}>
            See you soon!
          </ScriptText>
          <Text style={styles.confirmLine}>
            Booked for {formatTimeMalta(confirmation.time)} on {confirmation.time.slice(0, 10)}
            {confirmation.combo ? ' · Combo Wash & Cut' : ''}
          </Text>
          <Text style={styles.confirmAmount}>{formatEuro(confirmation.amountCents)}</Text>
          <Text style={styles.confirmNote}>
            Held as pending — confirms once your card settles. Manage it under Account.
          </Text>
          <View style={{ marginTop: 24 }}>
            <Button label="Done" onPress={onDone} />
          </View>
        </View>
      </Screen>
    );
  }

  const spec = STREAMS.find((candidate) => candidate.key === stream);
  const accent = stream === 'WASH' ? kindAccent('WASH') : kindAccent('BARBER');

  return (
    <Screen>
      <Brand subtitle="Book your slot" />

      <SectionTitle>What are you booking?</SectionTitle>
      <View style={styles.streamRow}>
        {STREAMS.map((candidate) => (
          <Chip
            key={candidate.key}
            label={candidate.title}
            active={stream === candidate.key}
            onPress={() => {
              setStream(candidate.key);
              setSlot(null);
              setSlots(null);
            }}
          />
        ))}
      </View>

      {stream ? (
        <>
          <SectionTitle>Which branch?</SectionTitle>
          <View style={styles.wrap}>
            {branches.map((location) => (
              <Chip
                key={location.id}
                label={location.name}
                active={locationId === location.id}
                onPress={() => setLocationId(location.id)}
              />
            ))}
          </View>
        </>
      ) : null}

      {stream && locationId ? (
        <>
          {stream !== 'WASH' ? (
            <>
              <SectionTitle>{stream === 'COMBO' ? 'The Barber' : 'Service'}</SectionTitle>
              <View style={styles.wrap}>
                {barberServices.map((service) => (
                  <Chip
                    key={service.id}
                    label={`${service.name} · ${formatEuro(service.priceCents)}`}
                    active={barberServiceId === service.id}
                    onPress={() => setBarberServiceId(service.id)}
                  />
                ))}
              </View>
            </>
          ) : null}
          {stream !== 'CUT' ? (
            <>
              <SectionTitle>{stream === 'COMBO' ? 'The Car Wash' : 'Service'}</SectionTitle>
              <View style={styles.wrap}>
                {washServices.map((service) => (
                  <Chip
                    key={service.id}
                    label={`${service.name} · ${formatEuro(service.priceCents)}`}
                    active={washServiceId === service.id}
                    accent={colors.wash}
                    onPress={() => setWashServiceId(service.id)}
                  />
                ))}
              </View>
            </>
          ) : null}
        </>
      ) : null}

      {stream && locationId && servicesChosen ? (
        <>
          <SectionTitle>When?</SectionTitle>
          <View style={styles.wrap}>
            {dates.map((candidate) => (
              <Chip key={candidate} label={shortDate(candidate)} active={date === candidate} onPress={() => setDate(candidate)} />
            ))}
          </View>
          <View style={{ marginTop: 8 }}>
            {slotsLoading ? (
              <Text style={styles.hint}>Finding free slots…</Text>
            ) : slots && slots.length === 0 ? (
              <Text style={styles.hint}>Nothing free that day — try another date or branch.</Text>
            ) : slots ? (
              <View style={styles.wrap}>
                {slots.map((candidate) => (
                  <Chip
                    key={candidate.startsAt}
                    label={candidate.label}
                    active={slot?.startsAt === candidate.startsAt}
                    accent={accent.solid}
                    onPress={() => setSlot(candidate)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      {stream && slot ? (
        <Card>
          <Text style={styles.confirmTitle}>
            {spec?.title} · {formatTimeMalta(slot.startsAt)} on {date}
          </Text>
          <Text style={styles.confirmAmount}>{formatEuro(totalCents)}</Text>
          {needsBay ? (
            <TextInput
              placeholder="Vehicle registration (e.g. ABC 123)"
              placeholderTextColor={colors.faint}
              value={vehicleReg}
              onChangeText={setVehicleReg}
              autoCapitalize="characters"
              style={styles.input}
            />
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={{ marginTop: 12 }}>
            <Button label="Book it" onPress={() => void book()} busy={busy} />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  streamRow: { flexDirection: 'row', flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  hint: { color: colors.muted, fontSize: 14 },
  confirmTitle: { color: colors.ink, fontSize: 16, fontWeight: '500' },
  confirmAmount: { fontFamily: 'Brewheat', fontSize: 32, color: colors.bronzeLight, marginTop: 6 },
  input: {
    backgroundColor: colors.ground,
    borderColor: colors.panelEdge,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 16,
    marginTop: 12,
  },
  error: { color: colors.danger, fontSize: 14, marginTop: 10 },
  confirm: { marginTop: 40, alignItems: 'center' },
  confirmLine: { color: colors.ink, fontSize: 16, marginTop: 16, textAlign: 'center' },
  confirmNote: { color: colors.muted, fontSize: 13, marginTop: 12, textAlign: 'center', maxWidth: 300 },
});
