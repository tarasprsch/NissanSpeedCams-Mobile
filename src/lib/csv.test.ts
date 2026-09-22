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
  it('writes longitude before latitude', () => {
    const records = [
      createSpeedCamRecord(45.32507, 28.453992, 'М-15 Одеса - Рені 271+315'),
    ];

    expect(serializeCsv(records)).toBe(
      '28.453992,45.32507,"М-15 Одеса - Рені 271+315"',
    );
  });

  it('reads longitude before latitude', () => {
    const records = parseCsv(
      '28.453992,45.32507,"М-15 Одеса - Рені 271+315"',
    );

    expect(records[0]).toMatchObject({
      latitude: 45.32507,
      longitude: 28.453992,
      location: 'М-15 Одеса - Рені 271+315',
    });
  });

  it('round-trips rows with commas and quotes in the location text', () => {
    const records = [
      createSpeedCamRecord(50.417382, 30.593149, 'Рј. РљРёС—РІ, "РџСЂРёС‡Р°Р»СЊРЅР°", 1'),
      createSpeedCamRecord(50.479648646, 30.45352909, 'Рј. РљРёС—РІ, РІСѓР». РћР»РµРЅРё РўРµР»С–РіРё, 37'),
    ];

    const csvText = serializeCsv(records);
    const parsed = parseCsv(csvText);

    expect(parsed).toEqual(records);
  });

  it('orders rows by latitude and longitude when serializing', () => {
    const records = [
      createSpeedCamRecord(50.500001, 30.700001, 'third'),
      createSpeedCamRecord(50.100001, 30.900001, 'second'),
      createSpeedCamRecord(50.100001, 30.100001, 'first'),
    ];

    const csvText = serializeCsv(records);

    expect(csvText.split('\r\n')).toEqual([
      '30.100001,50.100001,"first"',
      '30.900001,50.100001,"second"',
      '30.700001,50.500001,"third"',
    ]);
  });

  it('parses quoted locations that contain embedded newlines', () => {
    const csvText =
      '30.654321,50.123456,"Рј. РљРёС—РІ,\r\nРІСѓР». Р—Р°РІР°Р»СЊРЅР°, 2)"\r\n30.111111,50.999999,"Р”СЂСѓРіР° Р°РґСЂРµСЃР°"';

    const parsed = parseCsv(csvText);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      latitude: 50.123456,
      longitude: 30.654321,
      location: 'Рј. РљРёС—РІ,\r\nРІСѓР». Р—Р°РІР°Р»СЊРЅР°, 2)',
    });
  });

  it('orders parsed CSV rows by latitude and longitude', () => {
    const csvText = [
      '30.700001,50.500001,"third"',
      '30.900001,50.100001,"second"',
      '30.100001,50.100001,"first"',
    ].join('\r\n');

    const parsed = parseCsv(csvText);

    expect(parsed.map((record) => record.csvLine)).toEqual([
      '30.100001,50.100001,"first"',
      '30.900001,50.100001,"second"',
      '30.700001,50.500001,"third"',
    ]);
  });
});
