import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { sampleKml } from './test/fixtures/sampleKml';

const readBaselineCsvMock = vi.fn();
const writeBaselineCsvMock = vi.fn();
const exportCsvMock = vi.fn();
const pickExistingCsvMock = vi.fn();
const getRemovableStorageStatusMock = vi.fn();
const addRemovableStorageListenerMock = vi.fn();
const removeListenerMock = vi.fn();
let nativeSaveDialog = true;
let removableStorageListener: ((status: { mounted: boolean }) => void) | undefined;

vi.mock('./lib/storage', () => ({
  addRemovableStorageListener: (...args: unknown[]) => addRemovableStorageListenerMock(...args),
  exportCsv: (...args: unknown[]) => exportCsvMock(...args),
  getRemovableStorageStatus: (...args: unknown[]) => getRemovableStorageStatusMock(...args),
  pickExistingCsv: (...args: unknown[]) => pickExistingCsvMock(...args),
  readBaselineCsv: (...args: unknown[]) => readBaselineCsvMock(...args),
  usesNativeSaveDialog: () => nativeSaveDialog,
  writeBaselineCsv: (...args: unknown[]) => writeBaselineCsvMock(...args),
}));

async function loadKml() {
  fireEvent.click(screen.getByRole('button', { name: 'Load New' }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Save to file' })).toBeEnabled();
  });
}

async function loadKmlAndOpenSaveDialog() {
  await loadKml();
  fireEvent.click(screen.getByRole('button', { name: 'Save to file' }));
  await screen.findByRole('heading', { name: 'Save speedcam.csv' });
}

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    readBaselineCsvMock.mockReset();
    writeBaselineCsvMock.mockReset();
    exportCsvMock.mockReset();
    pickExistingCsvMock.mockReset();
    getRemovableStorageStatusMock.mockReset();
    addRemovableStorageListenerMock.mockReset();
    removeListenerMock.mockReset();
    nativeSaveDialog = true;
    removableStorageListener = undefined;
    readBaselineCsvMock.mockResolvedValue({
      content: '30.45352909,50.479648646,"м. Київ, вул. Олени Теліги, 37"',
      path: 'internal/speedcam.csv',
      source: 'internal',
    });
    writeBaselineCsvMock.mockResolvedValue({ path: 'internal/speedcam.csv' });
    exportCsvMock.mockResolvedValue({ status: 'saved', path: 'exported/speedcam.csv' });
    getRemovableStorageStatusMock.mockResolvedValue({ mounted: false });
    addRemovableStorageListenerMock.mockImplementation(async (listener) => {
      removableStorageListener = listener;
      return { remove: removeListenerMock };
    });
    pickExistingCsvMock.mockResolvedValue({
      status: 'picked',
      content: '30.593149,50.417382,"м. Київ, Дніпровська набережна / вул. Причальна"',
      path: 'picked/speedcam.csv',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => sampleKml,
      }),
    );
  });

  it('loads the private baseline at startup without exporting', async () => {
    render(<App />);

    await waitFor(() => {
      expect(readBaselineCsvMock).toHaveBeenCalledOnce();
    });
    expect(exportCsvMock).not.toHaveBeenCalled();
  });

  it('loads the live kml and updates the statistics tab', async () => {
    render(<App />);

    await waitFor(() => {
      expect(readBaselineCsvMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Load New' }));

    await waitFor(() => {
      const loadedCard = screen.getByText('Loaded from KML').closest('article');
      expect(loadedCard).not.toBeNull();
      expect(within(loadedCard!).getByText('2')).toBeInTheDocument();
    });

    const savedCard = screen.getByText('Rows in saved speedcam.csv').closest('article');

    expect(savedCard).not.toBeNull();
    expect(within(savedCard!).getByText('1')).toBeInTheDocument();
    expect(screen.getByText('50.417382')).toBeInTheDocument();
    expect(screen.getByText('30.593149')).toBeInTheDocument();
  });

  it('shows the no-new-items message and empty grid on the statistics tab', async () => {
    readBaselineCsvMock.mockResolvedValue({
      content: [
        '30.593149,50.417382,"first"',
        '30.45352909,50.479648646,"second"',
      ].join('\r\n'),
      path: 'internal/speedcam.csv',
      source: 'internal',
    });

    render(<App />);

    await waitFor(() => {
      expect(readBaselineCsvMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Load New' }));

    await waitFor(() => {
      expect(
        screen.getByText('No new items were found in the loaded KML data.'),
      ).toBeInTheDocument();
    });

    expect(screen.getByText('No new items to display.')).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Latitude' }),
    ).toBeInTheDocument();
  });

  it('opens native choices and commits baseline after successful export', async () => {
    render(<App />);
    await loadKmlAndOpenSaveDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Save to Downloads' }));

    await waitFor(() => {
      expect(writeBaselineCsvMock).toHaveBeenCalledTimes(1);
    });

    expect(exportCsvMock).toHaveBeenCalledWith(expect.any(String), 'downloads');
    expect(writeBaselineCsvMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      exportCsvMock.mock.invocationCallOrder[0],
    );
    expect(readBaselineCsvMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('tab', { name: 'Saved CSV' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('imports an existing CSV into the internal baseline', async () => {
    const content = '30.593149,50.417382,"imported"';
    pickExistingCsvMock.mockResolvedValue({
      status: 'picked',
      content,
      path: 'picked/speedcam.csv',
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Saved CSV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import existing CSV' }));

    await waitFor(() => {
      expect(writeBaselineCsvMock).toHaveBeenCalledWith(content);
    });
    expect(screen.getByText('imported')).toBeInTheDocument();
  });

  it('does not replace the baseline with malformed imported CSV', async () => {
    pickExistingCsvMock.mockResolvedValue({
      status: 'picked',
      content: '30.593149,50.417382,"unmatched',
      path: 'picked/broken.csv',
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Saved CSV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import existing CSV' }));

    await waitFor(() => {
      expect(pickExistingCsvMock).toHaveBeenCalledOnce();
    });
    expect(writeBaselineCsvMock).not.toHaveBeenCalled();
  });

  it('does not update baseline after a cancelled export', async () => {
    exportCsvMock.mockResolvedValue({ status: 'cancelled' });
    render(<App />);
    await loadKmlAndOpenSaveDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Choose folder/name' }));

    await waitFor(() => expect(exportCsvMock).toHaveBeenCalledOnce());
    expect(writeBaselineCsvMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Save speedcam.csv' })).not.toBeInTheDocument();
  });

  it('does not update baseline after a failed export', async () => {
    exportCsvMock.mockRejectedValue(new Error('drive removed'));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    render(<App />);
    await loadKmlAndOpenSaveDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Save to Downloads' }));

    await waitFor(() => {
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('CSV export failed'),
        expect.any(Error),
      );
    });
    expect(writeBaselineCsvMock).not.toHaveBeenCalled();
  });

  it('reports baseline failure without refreshing the saved tab', async () => {
    writeBaselineCsvMock.mockRejectedValue(new Error('internal write failed'));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    render(<App />);
    await loadKmlAndOpenSaveDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Save to Downloads' }));

    await waitFor(() => {
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('CSV exported, but the internal baseline could not be updated.'),
        expect.any(Error),
      );
    });
    expect(screen.getByRole('tab', { name: 'Saved CSV' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('saves directly on web without opening the native modal', async () => {
    nativeSaveDialog = false;
    render(<App />);
    await loadKml();
    fireEvent.click(screen.getByRole('button', { name: 'Save to file' }));

    await waitFor(() => {
      expect(exportCsvMock).toHaveBeenCalledWith(expect.any(String), 'picker');
    });
    expect(screen.queryByRole('heading', { name: 'Save speedcam.csv' })).not.toBeInTheDocument();
  });

  it('enables flash export when the removable listener reports a mount', async () => {
    render(<App />);
    await waitFor(() => expect(removableStorageListener).toBeTypeOf('function'));
    await loadKmlAndOpenSaveDialog();
    const flashButton = screen.getByRole('button', { name: 'Save to flash drive' });
    expect(flashButton).toBeDisabled();

    act(() => removableStorageListener?.({ mounted: true }));

    expect(flashButton).toBeEnabled();
  });

  it('treats import cancellation as a normal outcome', async () => {
    pickExistingCsvMock.mockResolvedValue({ status: 'cancelled' });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    render(<App />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Saved CSV' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Import existing CSV' }),
    );

    await waitFor(() => {
      expect(pickExistingCsvMock).toHaveBeenCalledOnce();
    });
    expect(log).not.toHaveBeenCalledWith(
      expect.stringContaining('Existing CSV load failed'),
      expect.anything(),
    );
  });
});
