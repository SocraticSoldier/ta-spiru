import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type { LoyaltyPass, LoyaltySummary, MyBookingRow } from '@ta-spiru/shared';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { colors, formatEuro, formatTimeMalta, kindAccent } from '../lib/theme';
import { Brand, Button, Card, Loading, Notice, Screen, ScriptText, SectionTitle } from '../components/ui';

const TIER_LABELS: Record<string, string> = { BRONZE: 'Bronze', SILVER: 'Silver', GOLD: 'Gold' };

export const AccountScreen = (): React.JSX.Element => {
  const { user, signOut } = useSession();
  const [loyalty, setLoyalty] = useState<LoyaltySummary | null>(null);
  const [pass, setPass] = useState<LoyaltyPass | null>(null);
  const [bookings, setBookings] = useState<MyBookingRow[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    const [loyaltyResult, passResult, bookingsResult] = await Promise.allSettled([
      api.loyalty(),
      api.loyaltyPass(),
      api.myBookings(),
    ]);
    if (loyaltyResult.status === 'fulfilled') {
      setLoyalty(loyaltyResult.value);
    }
    if (passResult.status === 'fulfilled') {
      setPass(passResult.value);
    }
    if (bookingsResult.status === 'fulfilled') {
      setBookings(bookingsResult.value);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cancel = async (appointmentId: string): Promise<void> => {
    try {
      await api.cancelBooking(appointmentId);
      await load();
    } catch {
      // surfaced on next load; keep the UI responsive
    }
  };

  if (!ready) {
    return <Loading />;
  }

  const now = Date.now();
  const upcoming = bookings.filter(
    (booking) =>
      new Date(booking.startsAt).getTime() > now &&
      booking.status !== 'CANCELLED' &&
      booking.status !== 'NO_SHOW',
  );
  const history = bookings.filter((booking) => !upcoming.includes(booking)).slice(0, 8);

  return (
    <Screen>
      <View style={styles.header}>
        <Brand />
        <Text style={styles.signOut} onPress={() => void signOut()}>
          Sign out
        </Text>
      </View>
      <Text style={styles.hi}>Hi, {user?.firstName}</Text>

      {loyalty && pass ? (
        <Card accent={colors.bronze}>
          <View style={styles.loyaltyRow}>
            <View style={styles.qrWrap}>
              <QRCode value={pass.qrPayload} size={120} color={colors.ground} backgroundColor={colors.bronzeLight} />
            </View>
            <View style={styles.loyaltyMeta}>
              <ScriptText size={20} color={colors.bronzeLight}>
                {TIER_LABELS[loyalty.tier] ?? loyalty.tier} member
              </ScriptText>
              <Text style={styles.points}>{loyalty.balancePoints}</Text>
              <Text style={styles.hint}>points · {loyalty.lifetimePoints} lifetime</Text>
            </View>
          </View>
          <Text style={styles.loyaltyNote}>
            Show this code at reception to earn and redeem across the barbershop and the car wash.
          </Text>
        </Card>
      ) : null}

      <SectionTitle>Upcoming</SectionTitle>
      {upcoming.length === 0 ? (
        <Notice text="Nothing booked yet — grab a slot from the Book tab." />
      ) : (
        upcoming.map((booking) => {
          const accent = kindAccent(booking.serviceKind);
          return (
            <Card key={booking.id} accent={accent.solid}>
              <View style={styles.bookingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookingName}>
                    {booking.serviceName}
                    {booking.comboGroupId ? '  · Combo' : ''}
                  </Text>
                  <Text style={styles.hint}>
                    {booking.startsAt.slice(0, 10)} · {formatTimeMalta(booking.startsAt)} · {booking.locationName}
                  </Text>
                </View>
                <Text style={[styles.price, { color: accent.text }]}>{formatEuro(booking.priceCents)}</Text>
              </View>
              <View style={{ marginTop: 10 }}>
                <Button label="Cancel" variant="ghost" onPress={() => void cancel(booking.id)} />
              </View>
            </Card>
          );
        })
      )}

      {history.length > 0 ? (
        <>
          <SectionTitle>History</SectionTitle>
          {history.map((booking) => (
            <Card key={booking.id}>
              <View style={styles.bookingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookingName}>{booking.serviceName}</Text>
                  <Text style={styles.hint}>
                    {booking.startsAt.slice(0, 10)} · {booking.locationName} · {booking.status.replace('_', ' ')}
                  </Text>
                </View>
                <Text style={styles.price}>{formatEuro(booking.priceCents)}</Text>
              </View>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  signOut: { color: colors.muted, fontSize: 14, paddingTop: 6 },
  hi: { fontFamily: 'Brewheat', fontSize: 40, color: colors.ink, marginTop: 12, marginBottom: 16 },
  loyaltyRow: { flexDirection: 'row', alignItems: 'center' },
  qrWrap: { backgroundColor: colors.bronzeLight, borderRadius: 10, padding: 8 },
  loyaltyMeta: { marginLeft: 18, flex: 1 },
  points: { fontFamily: 'Brewheat', fontSize: 40, color: colors.bronzeLight },
  hint: { color: colors.muted, fontSize: 13 },
  loyaltyNote: { color: colors.faint, fontSize: 12, marginTop: 12 },
  bookingRow: { flexDirection: 'row', alignItems: 'center' },
  bookingName: { color: colors.ink, fontSize: 16, fontWeight: '500' },
  price: { fontFamily: 'Brewheat', fontSize: 18, color: colors.bronzeLight },
});
