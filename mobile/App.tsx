import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import sensors from './modules/btl-sensors';
import { DISPLAY_LOCALE, translator } from './src/i18n/translate';
import { MeterScreen } from './src/MeterScreen';
import { Meter } from './src/session/meter';
import { askForLocation } from './src/session/permission';

const t = translator(DISPLAY_LOCALE);

export default function App() {
  const [meter] = useState(
    () => new Meter(sensors, askForLocation, { title: t('notification.title'), text: t('notification.text') }),
  );
  return (
    <>
      <MeterScreen meter={meter} t={t} locale={DISPLAY_LOCALE} />
      <StatusBar style="dark" />
    </>
  );
}
