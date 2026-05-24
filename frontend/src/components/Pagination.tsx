import { useMemo, useState } from "react";

interface PaginationProps<T> {
  items: T[];
  pageSize?: number;
  children: (pageItems: T[], pagination: React.ReactNode) => React.ReactNode;
}

export default function Pagination<T>({ items, pageSize = 10, children }: PaginationProps<T>) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safeP = Math.min(page, totalPages);

  const pageItems = useMemo(
    () => items.slice((safeP - 1) * pageSize, safeP * pageSize),
    [items, safeP, pageSize]
  );

  // Reset to page 1 when items change drastically
  if (page > totalPages && totalPages > 0) setPage(1);

  function goTo(p: number) {
    setPage(Math.max(1, Math.min(p, totalPages)));
  }

  // Build page numbers with ellipsis
  function getPages(): (number | "...")[] {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeP > 3) pages.push("...");
      for (let i = Math.max(2, safeP - 1); i <= Math.min(totalPages - 1, safeP + 1); i++) {
        pages.push(i);
      }
      if (safeP < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }

  const pagination = items.length <= pageSize ? null : (
    <div className="d-flex justify-content-between align-items-center mt-3 px-1">
      <small className="text-muted">
        Showing {(safeP - 1) * pageSize + 1}–{Math.min(safeP * pageSize, items.length)} of {items.length}
      </small>
      <nav>
        <ul className="pagination pagination-sm mb-0">
          <li className={`page-item ${safeP === 1 ? "disabled" : ""}`}>
            <button className="page-link" onClick={() => goTo(safeP - 1)}>‹</button>
          </li>
          {getPages().map((p, i) =>
            p === "..." ? (
              <li className="page-item disabled" key={`e${i}`}>
                <span className="page-link">…</span>
              </li>
            ) : (
              <li className={`page-item ${p === safeP ? "active" : ""}`} key={p}>
                <button className="page-link" onClick={() => goTo(p)}>{p}</button>
              </li>
            )
          )}
          <li className={`page-item ${safeP === totalPages ? "disabled" : ""}`}>
            <button className="page-link" onClick={() => goTo(safeP + 1)}>›</button>
          </li>
        </ul>
      </nav>
    </div>
  );

  return <>{children(pageItems, pagination)}</>;
}
