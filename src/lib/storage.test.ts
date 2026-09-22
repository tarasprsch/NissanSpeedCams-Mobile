import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exportCsv,
  getRemovableStorageStatus,
  pickExistingCsv,
  readBaselineCsv,
  writeBaselineCsv,
} from './storage';

const storageMocks = vi.hoisted(() => ({
  platform: vi.fn(),
  plugin: {
    addListener: vi.fn(),
    exportCsv: vi.fn(),
    getRemovableStorageStatus: vi.fn(),
    pickExistingCsv: vi.fn(),
    readBaselineCsv: vi.fn(),
    writeBaselineCsv: vi.fn(),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: storageMocks.platform },
  registerPlugin: () => storageMocks.plugin,
}));

describe('storage adapter', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    storageMocks.platform.mockReturnValue('web');
    vi.stubGlobal('URL', {
      ...window.URL,
      createObjectURL: vi.fn(() => 'blob:speedcam'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
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

  it('returns native import cancellation without turning it into an error', async () => {
    storageMocks.platform.mockReturnValue('android');
    storageMocks.plugin.pickExistingCsv.mockResolvedValue({ status: 'cancelled' });

    await expect(pickExistingCsv()).resolves.toEqual({ status: 'cancelled' });
  });
});
