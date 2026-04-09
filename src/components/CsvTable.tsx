import type { SpeedCamRecord } from '../types';

interface CsvTableProps {
  emptyMessage: string;
  records: SpeedCamRecord[];
}

export function CsvTable({ emptyMessage, records }: CsvTableProps) {
  if (records.length === 0) {
    return <div className="empty-panel">{emptyMessage}</div>;
  }

  return (
    <div className="table-shell">
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
