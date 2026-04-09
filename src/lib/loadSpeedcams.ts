import type { SpeedCamRecord } from '../types';
import { parseKmlDocument } from './kml';

export const SPEEDCAM_KML_URL =
  'https://www.google.com/maps/d/kml?forcekml=1&mid=14SmaBRAck6Ei7MKT_fDhI5ZJZNp_-NI';

export async function loadLatestSpeedcamRecords(fetchImpl: typeof fetch = fetch): Promise<SpeedCamRecord[]> {
  const response = await fetchImpl(SPEEDCAM_KML_URL);

  if (!response.ok) {
    throw new Error(`The KML download failed with status ${response.status}.`);
  }

  const kmlText = await response.text();
  return parseKmlDocument(kmlText);
}

