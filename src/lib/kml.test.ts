import { describe, expect, it } from 'vitest';
import { parseKmlDocument, parseGpsCoordinates } from './kml';
import { sampleKml } from '../test/fixtures/sampleKml';

describe('parseGpsCoordinates', () => {
  it('parses values with non-breaking spaces', () => {
    expect(parseGpsCoordinates('50.417382,\u00a030.593149')).toEqual({
      latitude: 50.417382,
      longitude: 30.593149,
    });
  });
});

describe('parseKmlDocument', () => {
  it('extracts speedcam rows from placemarks', () => {
    const records = parseKmlDocument(sampleKml);

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      latitude: 50.417382,
      longitude: 30.593149,
      location: 'м. Київ, Дніпровська набережна / вул. Причальна',
      compareKey: '50.4173,30.5931',
      csvLine: '30.593149,50.417382,"м. Київ, Дніпровська набережна / вул. Причальна"',
    });
  });

  it('removes new lines from the location field', () => {
    const multilineLocationKml = sampleKml.replace(
      /<value>([^<]+)<\/value>/,
      '<value>Рј. РљРёС—РІ,\nР”РЅС–РїСЂРѕРІСЃСЊРєР° РЅР°Р±РµСЂРµР¶РЅР° / РІСѓР». РџСЂРёС‡Р°Р»СЊРЅР°</value>',
    );

    const records = parseKmlDocument(multilineLocationKml);

    expect(records[0]?.location).not.toContain('\n');
    expect(records[0]?.location).toBe('Рј. РљРёС—РІ, Р”РЅС–РїСЂРѕРІСЃСЊРєР° РЅР°Р±РµСЂРµР¶РЅР° / РІСѓР». РџСЂРёС‡Р°Р»СЊРЅР°');
  });
});
