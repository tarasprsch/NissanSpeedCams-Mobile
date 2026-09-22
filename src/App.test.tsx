import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { sampleKml } from './test/fixtures/sampleKml';

const readSavedCsvMock = vi.fn();
const writeSavedCsvMock = vi.fn();
const pickExistingCsvMock = vi.fn();

vi.mock('./lib/storage', () => ({
  canPickExistingCsv: () => true,
  getTargetCsvPath: () => 'Download/_CopyTo-FlashDrive/myPOIs/myPOIWarnings/speedcam.csv',
  pickExistingCsv: (...args: unknown[]) => pickExistingCsvMock(...args),
  readSavedCsv: (...args: unknown[]) => readSavedCsvMock(...args),
  writeSavedCsv: (...args: unknown[]) => writeSavedCsvMock(...args),
}));

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    readSavedCsvMock.mockReset();
    writeSavedCsvMock.mockReset();
    pickExistingCsvMock.mockReset();
    readSavedCsvMock.mockResolvedValue({
      content: '30.45352909,50.479648646,"м. Київ, вул. Олени Теліги, 37"',
      path: 'Download/_CopyTo-FlashDrive/myPOIs/myPOIWarnings/speedcam.csv',
      source: 'target',
    });
    writeSavedCsvMock.mockResolvedValue({
      path: 'Download/_CopyTo-FlashDrive/myPOIs/myPOIWarnings/speedcam.csv',
    });
    pickExistingCsvMock.mockResolvedValue({
      content: '30.593149,50.417382,"м. Київ, Дніпровська набережна / вул. Причальна"',
      path: 'picked/speedcam.csv',
      source: 'picked',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => sampleKml,
      }),
    );
  });

  it('loads the live kml and updates the statistics tab', async () => {
    render(<App />);

    await waitFor(() => {
      expect(readSavedCsvMock).toHaveBeenCalledTimes(1);
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
    readSavedCsvMock.mockResolvedValue({
      content: [
        '30.593149,50.417382,"first"',
        '30.45352909,50.479648646,"second"',
      ].join('\r\n'),
      path: 'Download/_CopyTo-FlashDrive/myPOIs/myPOIWarnings/speedcam.csv',
      source: 'target',
    });

    render(<App />);

    await waitFor(() => {
      expect(readSavedCsvMock).toHaveBeenCalledTimes(1);
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

  it('saves the loaded csv and refreshes the saved tab', async () => {
    render(<App />);

    await waitFor(() => {
      expect(readSavedCsvMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Load New' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save to file' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save to file' }));

    await waitFor(() => {
      expect(writeSavedCsvMock).toHaveBeenCalledTimes(1);
    });

    expect(readSavedCsvMock).toHaveBeenCalledTimes(2);
  });
});
