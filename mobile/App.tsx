import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import sensors from './modules/btl-sensors';
import { phoneLocale } from './src/i18n/locale';
import { translator } from './src/i18n/translate';
import { MeterScreen } from './src/MeterScreen';
import { Meter } from './src/session/meter';
import { askForLocation } from './src/session/permission';

export default function App() {
  const [{ meter, t, locale }] = useState(() => {
    const locale = phoneLocale();
    const t = translator(locale);
    const meter = new Meter(sensors, askForLocation, { title: t('notification.title'), text: t('notification.text') });
    return { meter, t, locale };
  });
  // The module asks only the first time it is called on this phone (PDL, „Aplikacija na prvom pokretanju traži
  // izuzetak od štednje baterije").
  useEffect(() => {
    sensors.askBatteryExemptionOnce();
  }, []);
  return (
    <>
      <MeterScreen meter={meter} t={t} locale={locale} />
      <StatusBar style="dark" />
    </>
  );
}
