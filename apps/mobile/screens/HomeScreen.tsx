import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LocationSummary, ServiceSummary } from '@ta-spiru/shared';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { colors, formatEuro, kindAccent } from '../lib/theme';
import { Brand, Button, Card, Notice, Screen, SectionTitle } from '../components/ui';

export const HomeScreen = ({ onBook }: { onBook: () => void }): React.JSX.Element => {
  const { user } = useSession();
  const [services, setServices] = useState<ServiceSummary[] | null>(null);
  const [branches, setBranches] = useState<LocationSummary[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.all([api.services(), api.branches()])
      .then(([loadedServices, loadedBranches]) => {
        setServices(loadedServices);
        setBranches(loadedBranches);
      })
      .catch(() => setFailed(true));
  }, []);

  return (
    <Screen>
      <Brand subtitle={user ? `Welcome back, ${user.firstName}.` : undefined} />

      <View style={styles.cta}>
        <Button label="Book a slot" onPress={onBook} />
      </View>

      {failed ? <Notice text="Couldn't reach Ta' Spiru — pull to retry shortly." /> : null}

      {services && services.length > 0 ? (
        <>
          <SectionTitle>Services</SectionTitle>
          {services.map((service) => {
            const accent = kindAccent(service.kind);
            return (
              <Card key={service.id} accent={accent.solid}>
                <View style={styles.serviceRow}>
                  <Text style={styles.serviceName}>{service.name}</Text>
                  <Text style={[styles.price, { color: accent.text }]}>{formatEuro(service.priceCents)}</Text>
                </View>
                <Text style={styles.serviceMeta}>
                  {service.durationMin} min · {service.kind === 'BARBER' ? 'Barbering' : 'Detailing'}
                  {service.isComboEligible ? ' · Combo eligible' : ''}
                </Text>
              </Card>
            );
          })}
        </>
      ) : null}

      {branches.length > 0 ? (
        <>
          <SectionTitle>Branches</SectionTitle>
          {branches.map((branch) => (
            <Card key={branch.id}>
              <Text style={styles.serviceName}>{branch.name}</Text>
              <Text style={styles.serviceMeta}>
                {branch.chairCount} chairs{branch.bayCount > 0 ? ` · ${branch.bayCount} wash bays` : ''}
              </Text>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  cta: { marginTop: 18 },
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  serviceName: { color: colors.ink, fontSize: 16, fontWeight: '500' },
  price: { fontFamily: 'Brewheat', fontSize: 20 },
  serviceMeta: { color: colors.muted, fontSize: 13, marginTop: 4 },
});
