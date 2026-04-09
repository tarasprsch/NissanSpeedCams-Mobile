import type { SpeedCamRecord } from '../types';
import { createSpeedCamRecord } from './speedcam';

const GPS_DATA_NAME = 'GPS координати';
const LOCATION_DATA_NAME = 'Місце розташування приладу контролю';

function getElementsByLocalName(parent: Document | Element, localName: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS('*', localName));
}

function getExtendedDataValue(placemark: Element, dataName: string): string | null {
  const dataNode = getElementsByLocalName(placemark, 'Data').find((node) => node.getAttribute('name') === dataName);
  const valueNode = dataNode ? getElementsByLocalName(dataNode, 'value')[0] : null;
  const value = valueNode?.textContent?.trim();
  return value ? value : null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseGpsCoordinates(value: string): { latitude: number; longitude: number } {
  const cleaned = normalizeWhitespace(value);
  const matches = cleaned.match(/-?\d+(?:\.\d+)?/g);

  if (!matches || matches.length < 2) {
    throw new Error(`Unable to parse GPS coordinates from "${value}".`);
  }

  return {
    latitude: Number(matches[0]),
    longitude: Number(matches[1]),
  };
}

function parsePointCoordinates(value: string): { latitude: number; longitude: number } {
  const matches = value.trim().match(/-?\d+(?:\.\d+)?/g);

  if (!matches || matches.length < 2) {
    throw new Error(`Unable to parse point coordinates from "${value}".`);
  }

  return {
    longitude: Number(matches[0]),
    latitude: Number(matches[1]),
  };
}

function buildRecordFromPlacemark(placemark: Element): SpeedCamRecord | null {
  const location = getExtendedDataValue(placemark, LOCATION_DATA_NAME);

  if (!location) {
    return null;
  }

  const gpsValue = getExtendedDataValue(placemark, GPS_DATA_NAME);
  const pointValue = getElementsByLocalName(placemark, 'coordinates')[0]?.textContent?.trim() ?? null;

  const coordinates = gpsValue ? parseGpsCoordinates(gpsValue) : pointValue ? parsePointCoordinates(pointValue) : null;

  if (!coordinates) {
    return null;
  }

  return createSpeedCamRecord(coordinates.latitude, coordinates.longitude, location);
}

export function parseKmlDocument(kmlText: string): SpeedCamRecord[] {
  const document = new DOMParser().parseFromString(kmlText, 'application/xml');
  const parserError = document.querySelector('parsererror');

  if (parserError) {
    throw new Error('The downloaded KML file could not be parsed.');
  }

  return getElementsByLocalName(document, 'Placemark')
    .map((placemark) => buildRecordFromPlacemark(placemark))
    .filter((record): record is SpeedCamRecord => record !== null);
}
