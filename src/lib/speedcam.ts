import type { SpeedCamRecord, StatsSummary } from '../types';

const COMPARE_DECIMALS = 4;

export function truncateCoordinate(value: number, decimals = COMPARE_DECIMALS): number {
  const factor = 10 ** decimals;
  return value >= 0 ? Math.floor(value * factor) / factor : Math.ceil(value * factor) / factor;
}

export function buildCompareKey(latitude: number, longitude: number): string {
  return `${truncateCoordinate(latitude).toFixed(COMPARE_DECIMALS)},${truncateCoordinate(longitude).toFixed(COMPARE_DECIMALS)}`;
}

export function escapeCsvField(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function createSpeedCamRecord(latitude: number, longitude: number, location: string): SpeedCamRecord {
  const normalizedLocation = location.trim();
  const latitudeText = String(latitude);
  const longitudeText = String(longitude);

  return {
    latitude,
    longitude,
    location: normalizedLocation,
    compareKey: buildCompareKey(latitude, longitude),
    csvLine: `${longitudeText},${latitudeText},${escapeCsvField(normalizedLocation)}`,
  };
}

export function compareSpeedCamRecords(left: SpeedCamRecord, right: SpeedCamRecord): number {
  if (left.latitude !== right.latitude) {
    return left.latitude - right.latitude;
  }

  if (left.longitude !== right.longitude) {
    return left.longitude - right.longitude;
  }

  return left.location.localeCompare(right.location);
}

export function sortSpeedCamRecords(records: SpeedCamRecord[]): SpeedCamRecord[] {
  return [...records].sort(compareSpeedCamRecords);
}

export function findNewSpeedCamRecords(
  loadedRecords: SpeedCamRecord[],
  savedRecords: SpeedCamRecord[],
): SpeedCamRecord[] {
  const savedKeys = new Set(savedRecords.map((record) => record.compareKey));
  const seenLoadedKeys = new Set<string>();

  return loadedRecords.filter((record) => {
    if (savedKeys.has(record.compareKey) || seenLoadedKeys.has(record.compareKey)) {
      return false;
    }

    seenLoadedKeys.add(record.compareKey);
    return true;
  });
}

export function calculateStats(loadedRecords: SpeedCamRecord[], savedRecords: SpeedCamRecord[]): StatsSummary {
  const newRecords = findNewSpeedCamRecords(loadedRecords, savedRecords);

  return {
    loadedCount: loadedRecords.length,
    savedCount: savedRecords.length,
    newCount: newRecords.length,
  };
}
