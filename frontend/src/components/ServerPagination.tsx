interface ServerPaginationProps {
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
}

export default function ServerPagination({ page, pages, onPageChange }: ServerPaginationProps) {
  if (pages <= 1) return null;

  function getPageNumbers(): (number | "...")[] {
    const arr: (number | "...")[] = [];
    if (pages <= 7) {
      for (let i = 1; i <= pages; i++) arr.push(i);
      return arr;
    }
    arr.push(1);
    if (page > 3) arr.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) arr.push(i);
    if (page < pages - 2) arr.push("...");
    arr.push(pages);
    return arr;
  }

  return (
    <nav>
      <ul className="pagination pagination-sm mb-0 justify-content-center">
        <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
          <button className="page-link" onClick={() => onPageChange(page - 1)}>‹</button>
        </li>
        {getPageNumbers().map((p, i) =>
          p === "..." ? (
            <li className="page-item disabled" key={`e${i}`}>
              <span className="page-link">…</span>
            </li>
          ) : (
            <li className={`page-item ${p === page ? "active" : ""}`} key={p}>
              <button className="page-link" onClick={() => onPageChange(p as number)}>{p}</button>
            </li>
          )
        )}
        <li className={`page-item ${page === pages ? "disabled" : ""}`}>
          <button className="page-link" onClick={() => onPageChange(page + 1)}>›</button>
        </li>
      </ul>
    </nav>
  );
}
