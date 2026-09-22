import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CsvTable } from './CsvTable';

describe('CsvTable', () => {
  afterEach(cleanup);

  it('shows longitude before latitude', () => {
    render(
      <CsvTable
        emptyMessage="No records"
        records={[
          {
            latitude: 45.32507,
            longitude: 28.453992,
            location: 'М-15 Одеса - Рені 271+315',
            compareKey: '45.32507,28.45399',
            csvLine:
              '28.453992,45.32507,"\u041c-15 \u041e\u0434\u0435\u0441\u0430 - \u0420\u0435\u043d\u0456 271+315"',
          },
        ]}
      />,
    );

    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent),
    ).toEqual(['Longitude', 'Latitude', 'Location']);

    const cells = within(
      screen.getByRole('row', { name: /271\+315/ }),
    ).getAllByRole('cell');
    expect(cells.map((cell) => cell.textContent)).toEqual([
      '28.453992',
      '45.32507',
      'М-15 Одеса - Рені 271+315',
    ]);
  });
});
