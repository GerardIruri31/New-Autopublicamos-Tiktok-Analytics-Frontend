import React, { useEffect, useMemo, useState } from "react";

export default function OrdenGenerationTable({
  rows = [],
  columns = [],
  onRowClick,
  footerAction = null,
}) {
  const ROWS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(
    1,
    Math.ceil((rows?.length || 0) / ROWS_PER_PAGE),
  );
  useEffect(() => {
    setCurrentPage(1);
  }, [rows.length, columns.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    return (rows || []).slice(start, end);
  }, [rows, currentPage, ROWS_PER_PAGE]);

  const pageNumbers = useMemo(() => {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }, [totalPages]);

  const pagerBtnBase =
    "inline-flex h-9 min-w-[36px] items-center justify-center rounded-full border text-sm font-semibold transition";
  const pagerBtnInactive =
    "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  const pagerBtnActive = "border-slate-900 bg-slate-900 text-white shadow-sm";

  const TRUNCATE_COLUMNS = new Set([
    "codsonido",
    "ncodsonido",
    "desscenahook",
    "descaption",
    "destropo",
    "desslide1keywordshide",
    "desslide2keywordshide",
    "deshashtag",
    "codimagenprincipal",
    "ncodimagenprincipal",
    "codimagenscreenshot",
    "ncodimagenscreenshot",
    "codimagendialogo",
    "ncodimagendialogo",
    "codvideo",
    "ncodvideo",
    "desinstrucciones",
    "desdatoobligincompleto",
    "deslogerrororden",
  ]);

  const getNormalizedKey = (key) =>
    String(key ?? "")
      .toLowerCase()
      .replace(/[\s_()-]/g, "");

  const getMobileColumnWidthClass = (key) => {
    const normalizedKey = getNormalizedKey(key);

    const mobileWideColumns = new Set([
      "desscenahook",
      "destropo",
      "descaption",
      "desslide1keywordshide",
      "desslide2keywordshide",
      "deshashtag",
      "desinstrucciones",
      "desdatoobligincompleto",
      "deslogerrororden",
    ]);

    const mobileUrlColumns = new Set([
      "codsonido",
      "ncodsonido",
      "codimagenprincipal",
      "ncodimagenprincipal",
      "codimagenscreenshot",
      "ncodimagenscreenshot",
      "codimagendialogo",
      "ncodimagendialogo",
      "codvideo",
      "ncodvideo",
    ]);

    if (mobileWideColumns.has(normalizedKey)) {
      return "w-[280px] min-w-[280px] max-w-[280px] sm:w-auto sm:min-w-0 sm:max-w-none";
    }

    if (mobileUrlColumns.has(normalizedKey)) {
      return "w-[400px] min-w-[400px] max-w-[400px] sm:w-auto sm:min-w-0 sm:max-w-none";
    }

    return "";
  };

  const getCellRawValue = (row, key) => {
    if (!row) return null;

    if (key === "tippublicacion") {
      return (
        row.nTippublicacion ??
        row.nCodtippublicacion ??
        row.nCodTippublicacion ??
        row.nCodTipoPosteo ??
        row.destipoposteo ??
        row.despost ??
        row.postTypeName ??
        row.postType ??
        row.tippublicacion ??
        row.tipPublicacion ??
        null
      );
    }

    if (key === "codsonido") {
      return (
        row.nCodsonido ??
        row.nCodSonido ??
        row.urlsonido ??
        row.soundUrl ??
        row.codsonido ??
        null
      );
    }

    return row?.[key];
  };

  const renderCellValue = (col, rawValue) => {
    const val =
      rawValue === null || rawValue === undefined || rawValue === ""
        ? "null"
        : rawValue;

    const normalizedKey = getNormalizedKey(col?.key);
    const isTruncatable = TRUNCATE_COLUMNS.has(normalizedKey);

    if (isTruncatable) {
      return (
        <span
          className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-center select-text sm:max-w-[420px] sm:truncate"
          title={String(val)}
        >
          {String(val)}
        </span>
      );
    }

    return (
      <span className="select-text whitespace-normal break-words">
        {String(val)}
      </span>
    );
  };
  return (
    <section className="w-full overflow-hidden rounded-2xl bg-white shadow-md border border-slate-200">
      <div className="w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        {" "}
        <table className="min-w-[980px] w-full text-xs sm:min-w-[1200px] sm:text-sm">
          <thead className="bg-slate-900 text-white">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={[
                    "px-3 py-3 text-center font-semibold whitespace-nowrap sm:px-4 sm:text-center",
                    getMobileColumnWidthClass(col.key),
                  ].join(" ")}
                  title={col.key}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200">
            {paginatedRows.map((row, idx) => (
              <tr
                key={`${currentPage}-${idx}-${row?.codordentrabajo ?? "row"}`}
                onClick={() => onRowClick?.(row)}
                className="hover:bg-slate-50 cursor-pointer"
              >
                {" "}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={[
                      "px-3 py-3 align-top text-center whitespace-normal break-words select-text sm:px-4 sm:text-center",
                      getMobileColumnWidthClass(col.key),
                    ].join(" ")}
                  >
                    {renderCellValue(col, getCellRawValue(row, col.key))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div className="border-t border-slate-200 px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              className={[
                pagerBtnBase,
                currentPage === 1 ? "cursor-not-allowed opacity-50" : "",
                pagerBtnInactive,
              ].join(" ")}
              onClick={() => {
                if (currentPage > 1) setCurrentPage((prev) => prev - 1);
              }}
              disabled={currentPage === 1}
              title="Previous Page"
            >
              ←
            </button>

            {pageNumbers.map((page) => (
              <button
                key={page}
                type="button"
                className={[
                  pagerBtnBase,
                  currentPage === page ? pagerBtnActive : pagerBtnInactive,
                ].join(" ")}
                onClick={() => setCurrentPage(page)}
                title={`Page ${page}`}
              >
                {page}
              </button>
            ))}

            <button
              type="button"
              className={[
                pagerBtnBase,
                currentPage === totalPages
                  ? "cursor-not-allowed opacity-50"
                  : "",
                pagerBtnInactive,
              ].join(" ")}
              onClick={() => {
                if (currentPage < totalPages)
                  setCurrentPage((prev) => prev + 1);
              }}
              disabled={currentPage === totalPages}
              title="Next Page"
            >
              →
            </button>
          </div>

          {footerAction && (
            <div className="mt-6 flex justify-center">{footerAction}</div>
          )}
        </div>
      )}
    </section>
  );
}
