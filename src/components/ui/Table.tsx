import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

export interface TableProps<T> {
  columns: Array<Column<T>>;
  rows: T[];
  keyOf: (row: T, index: number) => string;
  caption?: string;
}

export function Table<T>({ columns, rows, keyOf, caption }: TableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-start">
        {caption ? <caption className="pb-2 text-start text-sm text-ink-muted">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="border-b border-border px-3 py-2 text-start text-sm font-medium text-ink-muted"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={keyOf(row, index)}>
              {columns.map((column) => (
                <td key={column.key} className="border-b border-border-muted px-3 py-2 text-ink">
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
