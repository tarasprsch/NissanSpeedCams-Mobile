import { Capacitor } from '@capacitor/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exportCsv,
  getRemovableStorageStatus,
  readBaselineCsv,
  writeBaselineCsv,
} from './storage';

describe('storage adapter', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web');
    vi.stubGlobal('URL', {
      ...window.URL,
      createObjectURL: vi.fn(() => 'blob:speedcam'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('stores and reads the web baseline', async () => {
    await writeBaselineCsv('28.453992,45.32507,"camera"');

    await expect(readBaselineCsv()).resolves.toEqual({
      content: '28.453992,45.32507,"camera"',
      path: 'speedcam.csv',
      source: 'web',
    });
  });

  it('reports no removable storage on web', async () => {
    await expect(getRemovableStorageStatus()).resolves.toEqual({ mounted: false });
  });

  it('downloads a web export and returns saved status', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    await expect(exportCsv('csv', 'picker')).resolves.toEqual({
      status: 'saved',
      path: 'speedcam.csv',
    });
    expect(click).toHaveBeenCalledOnce();
  });
});
