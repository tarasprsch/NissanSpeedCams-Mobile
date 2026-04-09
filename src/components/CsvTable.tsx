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
              <td>{record.latitude}</td>
              <td>{record.longitude}</td>
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
