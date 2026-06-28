import type { ReactNode } from 'react'

type TableEmptyStateRowsProps = {
  columnCount: number
  message: ReactNode
}

/** Keeps data-table column widths stable when a filter returns no rows. */
export function TableEmptyStateRows({ columnCount, message }: TableEmptyStateRowsProps) {
  return (
    <>
      <tr aria-hidden="true" className="data-table-width-hold">
        {Array.from({ length: columnCount }, (_, index) => (
          <td key={index}>{'\u00A0'}</td>
        ))}
      </tr>
      <tr>
        <td colSpan={columnCount}>
          <div className="empty-state text-center">{message}</div>
        </td>
      </tr>
    </>
  )
}
