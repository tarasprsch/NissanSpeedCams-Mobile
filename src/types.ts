export type SavedCsvSource = 'target' | 'picked' | 'web' | 'none';

export interface SpeedCamRecord {
  latitude: number;
  longitude: number;
  location: string;
  compareKey: string;
  csvLine: string;
}

export interface StatsSummary {
  loadedCount: number;
  savedCount: number;
  newCount: number;
}

export interface ReadSavedCsvResult {
  content: string | null;
  path: string;
  source: SavedCsvSource;
}

