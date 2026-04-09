import { Capacitor, registerPlugin } from '@capacitor/core';
import type { ReadSavedCsvResult } from '../types';

const TARGET_CSV_PATH = 'Download/_CopyTo-FlashDrive/myPOIs/myPOIWarnings/speedcam.csv';
const WEB_STORAGE_KEY = 'speedcam.csv';
const DOWNLOAD_FILE_NAME = TARGET_CSV_PATH.split('/').at(-1) ?? 'speedcam.csv';

interface PickExistingCsvResult {
  content: string;
  path: string;
  source: 'picked';
}

interface WriteSavedCsvResult {
  path: string;
}

interface SpeedcamStoragePlugin {
  readSavedCsv(): Promise<ReadSavedCsvResult>;
  writeSavedCsv(options: { content: string }): Promise<WriteSavedCsvResult>;
  pickExistingCsv(): Promise<PickExistingCsvResult>;
}

const SpeedcamStorage = registerPlugin<SpeedcamStoragePlugin>('SpeedcamStorage');

export function getTargetCsvPath(): string {
  return TARGET_CSV_PATH;
}

export function canPickExistingCsv(): boolean {
  return Capacitor.getPlatform() !== 'web';
}

export async function readSavedCsv(): Promise<ReadSavedCsvResult> {
  if (Capacitor.getPlatform() === 'web') {
    const content = window.localStorage.getItem(WEB_STORAGE_KEY);
    return {
      content,
      path: TARGET_CSV_PATH,
      source: content ? 'web' : 'none',
    };
  }

  return SpeedcamStorage.readSavedCsv();
}

export async function writeSavedCsv(content: string): Promise<WriteSavedCsvResult> {
  if (Capacitor.getPlatform() === 'web') {
    window.localStorage.setItem(WEB_STORAGE_KEY, content);
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

    return {
      path: TARGET_CSV_PATH,
    };
  }

  return SpeedcamStorage.writeSavedCsv({ content });
}

export async function pickExistingCsv(): Promise<PickExistingCsvResult> {
  if (Capacitor.getPlatform() === 'web') {
    throw new Error('Selecting an existing device CSV is only available in the Android app.');
  }

  return SpeedcamStorage.pickExistingCsv();
}

