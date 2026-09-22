import type { SpeedCamRecord } from '../types';
import { createSpeedCamRecord, sortSpeedCamRecords } from './speedcam';

function parseCsvRecords(csvText: string): string[][] {
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];

    if (character === '"') {
      const nextCharacter = csvText[index + 1];

      if (inQuotes && nextCharacter === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      currentRecord.push(currentField);
      currentField = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && csvText[index + 1] === '\n') {
        index += 1;
      }

      currentRecord.push(currentField);
      currentField = '';

      if (currentRecord.some((field) => field.trim().length > 0)) {
        records.push(currentRecord);
      }

      currentRecord = [];
      continue;
    }

    currentField += character;
  }

  if (inQuotes) {
    throw new Error('Invalid CSV: unmatched quote in saved file.');
  }

  currentRecord.push(currentField);

  if (currentRecord.some((field) => field.trim().length > 0)) {
    records.push(currentRecord);
  }

  return records;
}

export function serializeCsv(records: SpeedCamRecord[]): string {
  return sortSpeedCamRecords(records)
    .map((record) => record.csvLine)
    .join('\r\n');
}

export function parseCsv(csvText: string): SpeedCamRecord[] {
  return sortSpeedCamRecords(
    parseCsvRecords(csvText.replace(/^\ufeff/, '')).map((fields) => {
      if (fields.length < 3) {
        throw new Error(`Invalid CSV row: "${fields.join(',')}"`);
      }

      const [longitudeText, latitudeText, ...locationParts] = fields;
      const latitude = Number(latitudeText.trim());
      const longitude = Number(longitudeText.trim());

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error(`Invalid CSV row: "${fields.join(',')}"`);
      }

      return createSpeedCamRecord(latitude, longitude, locationParts.join(','));
    }),
  );
}
