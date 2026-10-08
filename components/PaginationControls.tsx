"use client";

type Props = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  // Texto quando não há itens, com a concordância certa (ex.: "Nenhuma ocorrência").
  emptyLabel?: string;
};

export default function PaginationControls({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = "itens",
  emptyLabel = "Nenhum item encontrado",
}: Props) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.max(1, Math.min(page, safeTotalPages));
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = totalItems === 0 ? 0 : Math.min(safePage * pageSize, totalItems);

  return (
    <div className="surface-soft mt-4 flex flex-col gap-3 rounded-2xl px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
      <div className="opacity-75">
        {totalItems === 0
          ? emptyLabel
          : `Mostrando ${start}-${end} de ${totalItems} ${itemLabel}`}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
          className="surface-soft-hover rounded-lg px-3 py-1.5 disabled:opacity-40"
          aria-label="Primeira página"
        >
          {"<<"}
        </button>
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="surface-soft-hover rounded-lg px-3 py-1.5 disabled:opacity-40"
          aria-label="Página anterior"
        >
          {"<"}
        </button>
        <span className="min-w-28 text-center font-medium">
          Página {safePage} de {safeTotalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= safeTotalPages}
          className="surface-soft-hover rounded-lg px-3 py-1.5 disabled:opacity-40"
          aria-label="Próxima página"
        >
          {">"}
        </button>
        <button
          type="button"
          onClick={() => onPageChange(safeTotalPages)}
          disabled={safePage >= safeTotalPages}
          className="surface-soft-hover rounded-lg px-3 py-1.5 disabled:opacity-40"
          aria-label="Última página"
        >
          {">>"}
        </button>
      </div>
    </div>
  );
}
