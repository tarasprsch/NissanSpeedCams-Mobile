import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import type { ReadSavedCsvResult } from '../types';

const TARGET_CSV_PATH = 'Download/NissanRogue/myPOIs/myPOIWarnings/speedcam.csv';
const WEB_STORAGE_KEY = 'speedcam.csv';
const DOWNLOAD_FILE_NAME = 'speedcam.csv';

export type SaveDestination = 'picker' | 'downloads' | 'removable';
export type ExportCsvResult =
  | { status: 'saved'; path: string }
  | { status: 'cancelled' };
export type PickExistingCsvResult =
  | { status: 'picked'; content: string; path: string }
  | { status: 'cancelled' };
export interface RemovableStorageStatus {
  mounted: boolean;
}

interface SpeedcamStoragePlugin {
  readBaselineCsv(): Promise<ReadSavedCsvResult>;
  writeBaselineCsv(options: { content: string }): Promise<{ path: string }>;
  exportCsv(options: {
    content: string;
    destination: SaveDestination;
  }): Promise<ExportCsvResult>;
  pickExistingCsv(): Promise<PickExistingCsvResult>;
  getRemovableStorageStatus(): Promise<RemovableStorageStatus>;
  addListener(
    eventName: 'removableStorageChanged',
    listener: (status: RemovableStorageStatus) => void,
  ): Promise<PluginListenerHandle>;
}

const SpeedcamStorage = registerPlugin<SpeedcamStoragePlugin>('SpeedcamStorage');

export function getTargetCsvPath(): string {
  return TARGET_CSV_PATH;
}

export function canPickExistingCsv(): boolean {
  return usesNativeSaveDialog();
}

export function usesNativeSaveDialog(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export async function readBaselineCsv(): Promise<ReadSavedCsvResult> {
  if (!usesNativeSaveDialog()) {
    const content = window.localStorage.getItem(WEB_STORAGE_KEY);
    return {
      content,
      path: DOWNLOAD_FILE_NAME,
      source: content === null ? 'none' : 'web',
    };
  }

  return SpeedcamStorage.readBaselineCsv();
}

export async function writeBaselineCsv(content: string): Promise<{ path: string }> {
  if (!usesNativeSaveDialog()) {
    window.localStorage.setItem(WEB_STORAGE_KEY, content);
    return { path: DOWNLOAD_FILE_NAME };
  }

  return SpeedcamStorage.writeBaselineCsv({ content });
}

export async function getRemovableStorageStatus(): Promise<RemovableStorageStatus> {
  return usesNativeSaveDialog()
    ? SpeedcamStorage.getRemovableStorageStatus()
    : { mounted: false };
}

export async function addRemovableStorageListener(
  listener: (status: RemovableStorageStatus) => void,
): Promise<PluginListenerHandle> {
  if (!usesNativeSaveDialog()) {
    return { remove: async () => {} };
  }
  return SpeedcamStorage.addListener('removableStorageChanged', listener);
}

export async function exportCsv(
  content: string,
  destination: SaveDestination,
): Promise<ExportCsvResult> {
  if (usesNativeSaveDialog()) {
    return SpeedcamStorage.exportCsv({ content, destination });
  }
  downloadCsv(content);
  return { status: 'saved', path: DOWNLOAD_FILE_NAME };
}

export async function pickExistingCsv(): Promise<PickExistingCsvResult> {
  if (!usesNativeSaveDialog()) {
    throw new Error('Importing a device CSV is only available in the Android app.');
  }

  return SpeedcamStorage.pickExistingCsv();
}

function downloadCsv(content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = downloadUrl;
  link.download = DOWNLOAD_FILE_NAME;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

// Kept until App is migrated in Task 6.
export const readSavedCsv = readBaselineCsv;

export async function writeSavedCsv(content: string): Promise<{ path: string }> {
  const result = await exportCsv(content, 'downloads');
  if (result.status === 'cancelled') {
    return { path: DOWNLOAD_FILE_NAME };
  }
  await writeBaselineCsv(content);
  return { path: result.path };
}

