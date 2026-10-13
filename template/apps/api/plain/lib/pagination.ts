import type { ListQuery, Paginated } from "@repo/validators"

/** page/limit → Prisma's skip/take. */
export function toSkipTake(query: Pick<ListQuery, "page" | "limit">) {
  return { skip: (query.page - 1) * query.limit, take: query.limit }
}

/** Items + total count → the `{ items, pagination }` shape every list endpoint returns. */
export function paginate<T>(
  items: T[],
  total: number,
  query: Pick<ListQuery, "page" | "limit">
): Paginated<T> {
  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  }
}

/** Case-insensitive "contains" filter for text search, portable across databases. */
export function contains(search: string) {
  // klin:if postgres
  return { contains: search, mode: "insensitive" as const }
  // klin:else
  //? // MySQL's default collation and SQLite's LIKE are already case-insensitive.
  //? return { contains: search }
  // klin:endif
}
