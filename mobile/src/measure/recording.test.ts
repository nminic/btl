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

describe('a restart of the phone in the middle of the session', () => {
  // PDL, „Kad se telefon usred merenja restartuje, merenje se završava": after a restart the
  // elapsedRealtime clock begins from zero, and its times cannot be placed among the earlier ones.
  const loc = (t: number, rx: number) => `{"k":"loc","t":${t},"lat":44.8,"lon":20.46,"rx":${rx},"mock":false}`;
  const prs = (t: number, rx: number) => `{"k":"prs","t":${t},"hpa":998,"rx":${rx}}`;

  it('keeps what was written before the clock went back, leaves out the rest, and does not call it damage', () => {
    const recording = new Recording();
    recording.append([META, loc(6000, 6100), prs(6200, 6300), loc(900, 950), prs(1000, 1050)].join('\n') + '\n');

    expect(recording.restarted).toBe(true);
    expect(recording.locations.map((f) => f.t)).toEqual([6000]);
    expect(recording.pressures.map((p) => p.t)).toEqual([6200]);
    expect(recording.unreadable).toBe(0);
  });

  it('goes on leaving lines out on the reads that follow, even those whose clock is later again', () => {
    const recording = new Recording();
    recording.append(`${META}\n${loc(6000, 6100)}\n${loc(900, 950)}\n`);
    recording.append(`${loc(7000, 9000)}\n${prs(7100, 9100)}\n`);

    expect(recording.locations).toHaveLength(1);
    expect(recording.pressures).toHaveLength(0);
  });

  it('sees a second meta line that is earlier than what was written before it, as a restart, and keeps the first', () => {
    const recording = new Recording();
    recording.append(`${META}
${loc(6000, 6100)}
{"k":"meta","v":1,"pressure":false,"wall":1764200999999,"t":10}
`);

    expect(recording.restarted).toBe(true);
    expect(recording.meta?.pressureSensor).toBe(true);
  });

  it('sees a first sample written before the meta line was, as a restart', () => {
    const recording = new Recording();
    recording.append(`${META}\n${loc(100, 200)}\n`);

    expect(recording.restarted).toBe(true);
    expect(recording.locations).toHaveLength(0);
  });

  it('does not see one in lines written at the same millisecond, nor in a gap that goes forward', () => {
    const recording = new Recording();
    recording.append([META, loc(6000, 6100), prs(6050, 6100), loc(906000, 906100)].join('\n') + '\n');

    expect(recording.restarted).toBe(false);
    expect(recording.locations).toHaveLength(2);
    expect(recording.pressures).toHaveLength(1);
  });

  it('does not see one in a fix that is late: its time is earlier than a sample written before it, its write is not', () => {
    const recording = new Recording();
    recording.append([META, prs(6900, 6950), loc(6000, 7000), prs(7100, 7150)].join('\n') + '\n');

    expect(recording.restarted).toBe(false);
    expect(recording.locations).toHaveLength(1);
    expect(recording.pressures).toHaveLength(2);
  });
});

describe('the line the module writes when the member stops', () => {
  const END = '{"k":"end","t":9000,"rx":9000}';

  it('is read as the end of the session, and is not damage', () => {
    const recording = new Recording();
    recording.append(`${META}\n${LOC}\n${END}\n`);

    expect(recording.endedAt).toBe(9000);
    expect(recording.unreadable).toBe(0);
    expect(recording.locations).toHaveLength(1);
  });

  it('is absent from a file written before it existed, and from one still recording', () => {
    const recording = new Recording();
    recording.append(`${META}\n${LOC}\n`);

    expect(recording.endedAt).toBeNull();
  });

  it('a half of it is damage, and no end', () => {
    const recording = new Recording();
    recording.append(`${META}\n${LOC}\n{"k":"end","t":90`);

    expect(recording.endedAt).toBeNull();
    expect(recording.unreadable).toBe(1);
  });

  it('without the time it was written at, or without its own time, is damage, as it is for a sample', () => {
    const recording = new Recording();
    recording.append(`${META}\n{"k":"end","t":9000}\n{"k":"end","rx":9000}\n`);

    expect(recording.endedAt).toBeNull();
    expect(recording.unreadable).toBe(2);
  });

  it('written on the clock after a restart is left out with everything else after it, and is no end', () => {
    const recording = new Recording();
    recording.append(`${META}\n${LOC}\n{"k":"end","t":40,"rx":40}\n`);

    expect(recording.restarted).toBe(true);
    expect(recording.endedAt).toBeNull();
    expect(recording.unreadable).toBe(0);
  });
});
