import { describe, expect, it } from 'vitest';
import { parseCsv, serializeCsv } from './csv';
import { buildCompareKey, createSpeedCamRecord } from './speedcam';

describe('buildCompareKey', () => {
  it('truncates coordinates to four decimals instead of rounding', () => {
    expect(buildCompareKey(50.417382, 30.593149)).toBe('50.4173,30.5931');
    expect(buildCompareKey(50.99999, 30.00009)).toBe('50.9999,30.0000');
  });
});

describe('CSV serialization', () => {
  it('round-trips rows with commas and quotes in the location text', () => {
    const records = [
      createSpeedCamRecord(50.417382, 30.593149, 'м. Київ, "Причальна", 1'),
      createSpeedCamRecord(50.479648646, 30.45352909, 'м. Київ, вул. Олени Теліги, 37'),
    ];

    const csvText = serializeCsv(records);
    const parsed = parseCsv(csvText);

    expect(parsed).toEqual(records);
  });

  it('parses quoted locations that contain embedded newlines', () => {
    const csvText =
      '50.123456,30.654321,"м. Київ,\r\nвул. Завальна, 2)"\r\n50.999999,30.111111,"Друга адреса"';

    const parsed = parseCsv(csvText);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      latitude: 50.123456,
      longitude: 30.654321,
      location: 'м. Київ,\r\nвул. Завальна, 2)',
    });
  });
});
