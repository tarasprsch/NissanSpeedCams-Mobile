import { useEffect } from 'react';
import type { MouseEvent } from 'react';
import type { SaveDestination } from '../lib/storage';

interface SaveDestinationDialogProps {
  open: boolean;
  isSaving?: boolean;
  removableStorageMounted: boolean;
  onSelect: (destination: SaveDestination) => void;
  onCancel: () => void;
}

export function SaveDestinationDialog({
  open,
  isSaving = false,
  removableStorageMounted,
  onSelect,
  onCancel,
}: SaveDestinationDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) {
        onCancel();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onCancel, open]);

  if (!open) {
    return null;
  }

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !isSaving) {
      onCancel();
    }
  }

  return (
    <div
      className="modal-backdrop"
      data-testid="save-dialog-backdrop"
      onMouseDown={handleBackdropMouseDown}
    >
      <section
        className="save-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-dialog-title"
      >
        <h2 id="save-dialog-title">Save speedcam.csv</h2>
        <button
          className="save-option"
          type="button"
          disabled={isSaving}
          onClick={() => onSelect('picker')}
        >
          Choose folder/name
        </button>
        <button
          className="save-option"
          type="button"
          disabled={isSaving}
          onClick={() => onSelect('downloads')}
        >
          Save to Downloads
        </button>
        <button
          className="save-option"
          type="button"
          disabled={isSaving || !removableStorageMounted}
          onClick={() => onSelect('removable')}
        >
          Save to flash drive
        </button>
        {!removableStorageMounted ? (
          <p className="save-option-detail">No removable storage detected</p>
        ) : null}
        <div className="dialog-actions">
          <button type="button" disabled={isSaving} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
