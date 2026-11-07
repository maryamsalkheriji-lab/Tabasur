// Keep the first and last pages reachable without rendering an unbounded row.
export function paginationItems(currentPage, totalPages) {
  if (totalPages < 1) return []
  const current = Math.max(1, Math.min(currentPage, totalPages))
  const range = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => start + i)
  if (totalPages <= 7) return range(1, totalPages)
  if (current <= 4) return [...range(1, 5), 'end-gap', totalPages]
  if (current >= totalPages - 3) return [1, 'start-gap', ...range(totalPages - 4, totalPages)]
  return [1, 'start-gap', current - 1, current, current + 1, 'end-gap', totalPages]
}
