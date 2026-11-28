const mockRequireNativeModule = jest.fn((name: string) => ({ name }));

jest.mock('expo', () => ({ requireNativeModule: mockRequireNativeModule }));

it('hands over the native module by the name the Kotlin module declares', () => {
  const sensors = require('./index').default;

  // `Name("BtlSensors")` in android/src/main/java/expo/modules/btlsensors/BtlSensorsModule.kt
  expect(mockRequireNativeModule).toHaveBeenCalledWith('BtlSensors');
  expect(sensors).toEqual({ name: 'BtlSensors' });
});
