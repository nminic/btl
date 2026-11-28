import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatKilometres, formatMetres, type Locale, type Translate } from './i18n/translate';
import type { Measures } from './measure/measure';
import type { Meter, MeterView } from './session/meter';

/** How often the screen reads what the service wrote. */
export const READ_EVERY_MS = 1000;

type Props = { meter: Meter; t: Translate; locale: Locale };

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.figure} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function Figures({ measures, t, locale, live }: { measures: Measures; t: Translate; locale: Locale; live: boolean }) {
  const { elevation, gps } = measures;
  return (
    <View>
      <Figure label={t('meter.distance')} value={t('meter.kilometres', { value: formatKilometres(locale, measures.distanceM) })} />
      {elevation.status === 'measured' ? (
        <>
          <Figure label={t('meter.ascent')} value={t('meter.metres', { value: formatMetres(locale, elevation.ascentM) })} />
          <Figure label={t('meter.descent')} value={t('meter.metres', { value: formatMetres(locale, elevation.descentM) })} />
        </>
      ) : (
        <Text style={styles.notice}>{t('meter.noPressureSensor')}</Text>
      )}
      {live && (
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {t(`gps.${gps}`)}
        </Text>
      )}
      {/* What a phone without a cable needs to show to be checked. */}
      {elevation.status === 'measured' && <Text style={styles.check}>{t('meter.pressureSensor')}</Text>}
      <Text style={styles.check}>
        {t('meter.samples', { locations: String(measures.samples.locations), pressures: String(measures.samples.pressures) })}
      </Text>
    </View>
  );
}

export function MeterScreen({ meter, t, locale }: Props) {
  const [view, setView] = useState<MeterView>(() => meter.open());
  const recording = view.phase === 'recording' || view.phase === 'starting';

  useEffect(() => {
    if (!recording) return undefined;
    const timer = setInterval(() => setView(meter.tick()), READ_EVERY_MS);
    return () => clearInterval(timer);
  }, [meter, recording]);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">
        {t('meter.title')}
      </Text>
      {view.phase === 'idle' && <Text style={styles.notice}>{t('meter.idle')}</Text>}
      {view.phase === 'denied' && <Text style={styles.notice}>{t('meter.denied')}</Text>}
      {view.phase === 'starting' && <Text style={styles.status}>{t('meter.starting')}</Text>}
      {view.phase === 'stopped' && <Text style={styles.subtitle}>{t('meter.last')}</Text>}
      {(view.phase === 'recording' || view.phase === 'stopped') && (
        <Figures measures={view.measures} t={t} locale={locale} live={view.phase === 'recording'} />
      )}
      <Pressable
        accessibilityRole="button"
        style={styles.button}
        android_ripple={{ color: '#ffffff55' }}
        onPress={async () => setView(recording ? meter.stop() : await meter.start())}
      >
        <Text style={styles.buttonText}>{recording ? t('meter.stop') : t('meter.start')}</Text>
      </Pressable>
    </ScrollView>
  );
}

/* Contrast: #1a1a1a on white and white on #0b5394 are both above 7:1 (WCAG 2.2 AA asks 4.5:1). */
const styles = StyleSheet.create({
  screen: { flexGrow: 1, padding: 24, paddingTop: 56, backgroundColor: '#ffffff' },
  title: { fontSize: 28, fontWeight: '700', color: '#1a1a1a', marginBottom: 16 },
  subtitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  figure: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#d0d0d0' },
  label: { fontSize: 16, color: '#1a1a1a' },
  value: { fontSize: 40, fontWeight: '700', color: '#1a1a1a', fontVariant: ['tabular-nums'] },
  notice: { fontSize: 16, color: '#1a1a1a', marginVertical: 12 },
  status: { fontSize: 16, color: '#1a1a1a', marginVertical: 12 },
  check: { fontSize: 14, color: '#1a1a1a', marginTop: 4 },
  button: { marginTop: 24, minHeight: 56, borderRadius: 8, backgroundColor: '#0b5394', alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
});
