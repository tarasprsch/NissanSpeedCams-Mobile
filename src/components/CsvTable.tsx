import { useLayoutEffect, useRef } from "react";
import type { SpeedCamRecord } from "../types";

interface ScrollPosition {
  left: number;
  top: number;
}

interface CsvTableProps {
  emptyMessage: string;
  onScrollPositionChange?: (position: ScrollPosition) => void;
  records: SpeedCamRecord[];
  scrollPosition?: ScrollPosition;
}

export function CsvTable({
  emptyMessage,
  onScrollPositionChange,
  records,
  scrollPosition,
}: CsvTableProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const shell = shellRef.current;

    if (!shell || !scrollPosition) {
      return;
    }

    shell.scrollLeft = scrollPosition.left;
    shell.scrollTop = scrollPosition.top;
  }, [records, scrollPosition]);

  function handleScroll() {
    const shell = shellRef.current;

    if (!shell || !onScrollPositionChange) {
      return;
    }

    onScrollPositionChange({
      left: shell.scrollLeft,
      top: shell.scrollTop,
    });
  }

  if (records.length === 0) {
    return <div className="empty-panel">{emptyMessage}</div>;
  }

  return (
    <div className="table-shell" ref={shellRef} onScroll={handleScroll}>
      <table className="data-table">
        <colgroup>
          <col className="coordinate-column" />
          <col className="coordinate-column" />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>Latitude</th>
            <th>Longitude</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={`${record.compareKey}:${record.location}`}>
              <td className="coordinate-cell">{record.latitude}</td>
              <td className="coordinate-cell">{record.longitude}</td>
              <td className="location-cell" title={record.location}>
                {record.location}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
