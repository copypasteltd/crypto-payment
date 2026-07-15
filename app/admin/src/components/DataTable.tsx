import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState, IconButton } from "./ui";
import type { JsonObject, PageInfo } from "../lib/types";

export type DataColumn<T extends JsonObject> = {
  key: string;
  label: string;
  width?: number;
  render: (row: T) => ReactNode;
};

export function DataTable<T extends JsonObject>({
  rows,
  columns,
  rowKey,
  onRowClick,
  pageInfo,
  onPageChange,
}: {
  rows: T[];
  columns: DataColumn<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  pageInfo?: PageInfo;
  onPageChange?: (page: number) => void;
}) {
  const { t } = useTranslation("common");
  const defs = columns.map<ColumnDef<T>>((column) => ({
    id: column.key,
    header: column.label,
    size: column.width,
    cell: ({ row }) => column.render(row.original),
  }));
  const table = useReactTable({ data: rows, columns: defs, getCoreRowModel: getCoreRowModel() });

  if (rows.length === 0) return <EmptyState />;

  return (
    <>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id} style={header.getSize() !== 150 ? { width: header.getSize() } : undefined}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={rowKey(row.original)}
                className={onRowClick ? "clickable-row" : ""}
                onClick={() => onRowClick?.(row.original)}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={(event) => {
                  if (onRowClick && (event.key === "Enter" || event.key === " ")) onRowClick(row.original);
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageInfo ? (
        <footer className="pagination">
          <span>
            {t("itemsPage", { total: new Intl.NumberFormat().format(pageInfo.total), page: pageInfo.page, pageCount: pageInfo.pageCount })}
          </span>
          <div>
            <IconButton
              label={t("previousPage")}
              disabled={!pageInfo.hasPreviousPage}
              onClick={() => onPageChange?.(pageInfo.page - 1)}
            >
              <ChevronLeft size={18} />
            </IconButton>
            <IconButton
              label={t("nextPage")}
              disabled={!pageInfo.hasNextPage}
              onClick={() => onPageChange?.(pageInfo.page + 1)}
            >
              <ChevronRight size={18} />
            </IconButton>
          </div>
        </footer>
      ) : null}
    </>
  );
}
