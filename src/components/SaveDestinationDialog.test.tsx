import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaveDestinationDialog } from './SaveDestinationDialog';

afterEach(cleanup);

describe('SaveDestinationDialog', () => {
  it('shows save choices in required order', () => {
    render(
      <SaveDestinationDialog
        open
        removableStorageMounted
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Choose folder/name',
      'Save to Downloads',
      'Save to flash drive',
      'Cancel',
    ]);
  });

  it('keeps flash save visible but disabled without removable storage', () => {
    render(
      <SaveDestinationDialog
        open
        removableStorageMounted={false}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Save to flash drive' })).toBeDisabled();
    expect(screen.getByText('No removable storage detected')).toBeInTheDocument();
  });

  it('dispatches each enabled destination', () => {
    const onSelect = vi.fn();
    render(
      <SaveDestinationDialog
        open
        removableStorageMounted
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Choose folder/name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save to Downloads' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save to flash drive' }));

    expect(onSelect.mock.calls).toEqual([['picker'], ['downloads'], ['removable']]);
  });

  it('cancels with Escape or backdrop only while no save is active', () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <SaveDestinationDialog
        open
        removableStorageMounted
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseDown(screen.getByTestId('save-dialog-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(2);

    rerender(
      <SaveDestinationDialog
        open
        isSaving
        removableStorageMounted
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseDown(screen.getByTestId('save-dialog-backdrop'));

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole('button').every((button) => button.hasAttribute('disabled'))).toBe(true);
  });
});
