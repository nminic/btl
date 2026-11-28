import { useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatKilometres, formatMetres, type Locale, type Translate } from './i18n/translate';
import type { Measures } from './measure/measure';
import { formatDuration } from './session/duration';
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

type FiguresProps = { measures: Measures; durationMs: number; t: Translate; locale: Locale; live: boolean };

function Figures({ measures, durationMs, t, locale, live }: FiguresProps) {
  const { elevation, gps } = measures;
  return (
    <View>
      <Figure label={t('meter.duration')} value={formatDuration(durationMs)} />
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

/** What the screen knows of the location permission: asked on opening, before the button. */
type Permission = 'asking' | 'granted' | 'denied';

export function MeterScreen({ meter, t, locale }: Props) {
  const [view, setView] = useState<MeterView>(() => meter.open());
  const recording = view.phase === 'recording' || view.phase === 'starting';
  const { gate } = meter;
  const [permission, setPermission] = useState<Permission>('asking');
  const [visible, setVisible] = useState(true);
  const [mayStart, setMayStart] = useState(false);

  useEffect(() => {
    if (!recording) return undefined;
    const timer = setInterval(() => setView(meter.tick()), READ_EVERY_MS);
    return () => clearInterval(timer);
  }, [meter, recording]);

  // „Da bi aplikacija znala da GPS postoji pre starta, dozvolu za lokaciju traži čim se ekran otvori, a ne tek na
  // dugme" (PDL, „Mobilna aplikacija BTL-a (27.11.2026)").
  useEffect(() => {
    gate.ask().then((granted) => setPermission(granted ? 'granted' : 'denied'));
  }, [gate]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setVisible(state === 'active'));
    return () => subscription.remove();
  }, []);

  // GPS is listened to only before a start and only while the screen is seen: once a session runs, the service
  // has GPS, and nothing about it locks anything („Ovo važi samo za početak").
  useEffect(() => {
    if (recording || permission !== 'granted' || !visible) return undefined;
    if (!gate.listen()) {
      setPermission('denied');
      return undefined;
    }
    const check = () => setMayStart(gate.mayStart());
    check();
    const timer = setInterval(check, READ_EVERY_MS);
    return () => {
      clearInterval(timer);
      gate.stopListening();
      setMayStart(false);
    };
  }, [gate, recording, permission, visible]);

  const denied = !recording && (permission === 'denied' || view.phase === 'denied');
  const locked = !recording && !denied && !mayStart;
  const press = async () => {
    if (recording) setView(meter.stop());
    // After a no the button asks again, as it did before the start waited for GPS, and starts nothing.
    else if (denied) setPermission((await gate.ask(true)) ? 'granted' : 'denied');
    else setView(await meter.start());
  };

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">
        {t('meter.title')}
      </Text>
      {view.phase === 'idle' && <Text style={styles.notice}>{t('meter.idle')}</Text>}
      {denied && <Text style={styles.notice}>{t('meter.denied')}</Text>}
      {view.phase === 'starting' && <Text style={styles.status}>{t('meter.starting')}</Text>}
      {view.phase === 'stopped' && <Text style={styles.subtitle}>{t('meter.last')}</Text>}
      {(view.phase === 'recording' || view.phase === 'stopped') && (
        <Figures
          measures={view.measures}
          durationMs={view.durationMs}
          t={t}
          locale={locale}
          live={view.phase === 'recording'}
        />
      )}
      {!recording && !denied && (
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {locked ? t('meter.waitingForGps') : t('meter.gpsReady')}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={locked}
        style={[styles.button, locked && styles.buttonLocked]}
        android_ripple={{ color: '#ffffff55' }}
        onPress={press}
      >
        <Text style={styles.buttonText}>{recording ? t('meter.stop') : t('meter.start')}</Text>
      </Pressable>
    </ScrollView>
  );
}

/*
 * Contrast: #1a1a1a on white and white on #0b5394 are both above 7:1 (WCAG 2.2 AA asks 4.5:1). The locked
 * button is white on #5f6368, 6.0:1: still readable, and its state is also said by `disabled` and by the
 * sentence above it, not by the colour alone.
 */
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
  buttonLocked: { backgroundColor: '#5f6368' },
  buttonText: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
});
