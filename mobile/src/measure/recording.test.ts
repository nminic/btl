import { Recording } from './recording';

/** Lines exactly as `SampleWriter.kt` writes them. */
const META = '{"k":"meta","v":1,"pressure":true,"wall":1764200000000,"t":5000}';
const LOC = '{"k":"loc","t":6000.5,"lat":44.8,"lon":20.46,"rx":6900,"mock":false,"acc":4.5,"alt":118.2,"spd":2.9,"spdAcc":0.3}';
const PRS = '{"k":"prs","t":6100.25,"hpa":998.12,"rx":6950}';

it('reads the three kinds of line the service writes', () => {
  const recording = new Recording();
  recording.append(`${META}\n${LOC}\n${PRS}\n`);

  expect(recording.meta).toEqual({ pressureSensor: true, startedAtWallMs: 1764200000000, startedAt: 5000 });
  expect(recording.locations).toEqual([
    {
      t: 6000.5,
      lat: 44.8,
      lon: 20.46,
      accuracy: 4.5,
      altitude: 118.2,
      speed: 2.9,
      speedAccuracy: 0.3,
      mock: false,
      receivedAt: 6900,
    },
  ]);
  expect(recording.pressures).toEqual([{ t: 6100.25, hPa: 998.12, receivedAt: 6950 }]);
  expect(recording.unreadable).toBe(0);
});

it('keeps a fix without accuracy, altitude or speed, with those left out, and reads mock', () => {
  const recording = new Recording();
  recording.append('{"k":"loc","t":1,"lat":1,"lon":2,"rx":1,"mock":true}');

  expect(recording.locations[0]).toEqual({
    t: 1,
    lat: 1,
    lon: 2,
    accuracy: undefined,
    altitude: undefined,
    speed: undefined,
    speedAccuracy: undefined,
    mock: true,
    receivedAt: 1,
  });
});

it('skips the half line a killed process leaves at the end, and counts it', () => {
  const recording = new Recording();
  recording.append(`${META}\n${LOC}\n{"k":"prs","t":61`);

  expect(recording.locations).toHaveLength(1);
  expect(recording.pressures).toHaveLength(0);
  expect(recording.unreadable).toBe(1);
});

it('appends across reads, growing in place', () => {
  const recording = new Recording();
  const locations = recording.locations;
  recording.append(`${META}\n`);
  recording.append(`${LOC}\n${LOC}\n`);

  expect(recording.locations).toBe(locations);
  expect(recording.locations).toHaveLength(2);
});

it.each([
  ['not JSON', 'garbage'],
  ['an array', '[1,2]'],
  ['null', 'null'],
  ['an unknown kind', '{"k":"acc","t":1,"rx":1}'],
  ['a meta without the sensor flag', '{"k":"meta","wall":1,"t":1}'],
  ['a meta without the wall clock', '{"k":"meta","pressure":true,"t":1}'],
  ['a meta without its time', '{"k":"meta","pressure":true,"wall":1}'],
  ['a sample without its time', '{"k":"prs","hpa":1000,"rx":1}'],
  ['a sample without its receipt', '{"k":"prs","t":1,"hpa":1000}'],
  ['a fix without latitude', '{"k":"loc","t":1,"lon":2,"rx":1}'],
  ['a fix without longitude', '{"k":"loc","t":1,"lat":2,"rx":1}'],
  ['a pressure without its value', '{"k":"prs","t":1,"rx":1}'],
  ['a time that is not finite', '{"k":"prs","t":"1","hpa":1000,"rx":1}'],
])('counts %s as unreadable and takes nothing from it', (_, line) => {
  const recording = new Recording();
  recording.append(`${line}\n\n`);

  expect(recording.unreadable).toBe(1);
  expect(recording.meta).toBeNull();
  expect(recording.locations).toHaveLength(0);
  expect(recording.pressures).toHaveLength(0);
});
