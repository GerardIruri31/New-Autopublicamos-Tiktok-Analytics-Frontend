import React, { useEffect, useMemo, useState } from "react";

export default function OrdenGenerationTable({
  rows = [],
  columns = [],
  onRowClick,
  onDeleteRow,
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

  const STATUS_LABEL_MAP = {
    1: "Assigned",
    2: "Flagged",
    3: "-100 Views",
    4: "Posted",
    5: "Drafted",
    6: "Deleted",
    Assigned: "Assigned",
    Flagged: "Flagged",
    "-100 Views": "-100 Views",
    Posted: "Posted",
    Drafted: "Drafted",
    Deleted: "Deleted",
  };

  const getStatusLabel = (value) => {
    const cleanValue = String(value ?? "").trim();

    if (!cleanValue || cleanValue === "-") return "null";

    return STATUS_LABEL_MAP[cleanValue] ?? cleanValue;
  };

  const getNormalizedKey = (key) =>
    String(key ?? "")
      .toLowerCase()
      .replace(/[\s_()-]/g, "");

  const getMobileColumnWidthClass = (key) => {
    const normalizedKey = getNormalizedKey(key);

    const mobileWideColumns = new Set([
      "ncodescena",

      "ncodposteador",
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

  const isHttpUrlText = (value) => {
    const text = String(value ?? "").trim();

    if (!text) return false;
    if (text.toLowerCase() === "null") return false;

    return text.startsWith("http://") || text.startsWith("https://");
  };

  const getSoundUrlCellValue = (row) => {
    const candidates = [
      row?.codsonido,
      row?.nCodsonido,
      row?.ncodsonido,
      row?.codSonido,
      row?.nCodSonido,
      row?.urlsonido,
      row?.soundUrl,
    ];

    return candidates.find((value) => isHttpUrlText(value)) ?? null;
  };

  const getMediaUrlCellValue = (row, key) => {
    const normalizedKey = getNormalizedKey(key);

    const mediaCandidatesByKey = {
      codimagenprincipal: [
        row?.codimagenprincipal,
        row?.nCodimagenprincipal,
        row?.ncodimagenprincipal,
        row?.codImagenPrincipal,
        row?.nCodImagenPrincipal,
        row?.urlimagenprincipal,
        row?.mainImageUrl,
      ],
      ncodimagenprincipal: [
        row?.codimagenprincipal,
        row?.nCodimagenprincipal,
        row?.ncodimagenprincipal,
        row?.codImagenPrincipal,
        row?.nCodImagenPrincipal,
        row?.urlimagenprincipal,
        row?.mainImageUrl,
      ],

      codimagenscreenshot: [
        row?.codimagenscreenshot,
        row?.nCodimagenscreenshot,
        row?.ncodimagenscreenshot,
        row?.codImagenScreenshot,
        row?.nCodImagenScreenshot,
        row?.urlimagenscreenshot,
        row?.screenshotImageUrl,
      ],
      ncodimagenscreenshot: [
        row?.codimagenscreenshot,
        row?.nCodimagenscreenshot,
        row?.ncodimagenscreenshot,
        row?.codImagenScreenshot,
        row?.nCodImagenScreenshot,
        row?.urlimagenscreenshot,
        row?.screenshotImageUrl,
      ],

      codimagendialogo: [
        row?.codimagendialogo,
        row?.nCodimagendialogo,
        row?.ncodimagendialogo,
        row?.codImagenDialogo,
        row?.nCodImagenDialogo,
        row?.urlimagendialogo,
        row?.dialogImageUrl,
      ],
      ncodimagendialogo: [
        row?.codimagendialogo,
        row?.nCodimagendialogo,
        row?.ncodimagendialogo,
        row?.codImagenDialogo,
        row?.nCodImagenDialogo,
        row?.urlimagendialogo,
        row?.dialogImageUrl,
      ],

      codvideo: [
        row?.codvideo,
        row?.nCodvideo,
        row?.ncodvideo,
        row?.codVideo,
        row?.nCodVideo,
        row?.urlvideo,
        row?.videoUrl,
      ],
      ncodvideo: [
        row?.codvideo,
        row?.nCodvideo,
        row?.ncodvideo,
        row?.codVideo,
        row?.nCodVideo,
        row?.urlvideo,
        row?.videoUrl,
      ],
    };
    ("codsonido");

    const candidates = mediaCandidatesByKey[normalizedKey];

    if (!candidates) return row?.[key];

    return candidates.find((value) => isHttpUrlText(value)) ?? null;
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

    if (key === "codsonido" || key === "nCodsonido") {
      return getSoundUrlCellValue(row);
    }

    const normalizedKey = getNormalizedKey(key);

    if (
      normalizedKey === "codimagenprincipal" ||
      normalizedKey === "ncodimagenprincipal" ||
      normalizedKey === "codimagenscreenshot" ||
      normalizedKey === "ncodimagenscreenshot" ||
      normalizedKey === "codimagendialogo" ||
      normalizedKey === "ncodimagendialogo" ||
      normalizedKey === "codvideo" ||
      normalizedKey === "ncodvideo"
    ) {
      return getMediaUrlCellValue(row, key);
    }

    if (key === "codestadoorden") {
      return getStatusLabel(
        row.nCodestadoorden ??
          row.nCodEstadoOrden ??
          row.desestadoorden ??
          row.desEstadoOrden ??
          row.estadoorden ??
          row.estadoOrden ??
          row.codestadoorden ??
          row.codEstadoOrden ??
          null,
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

              <th className="px-3 py-3 text-center font-semibold whitespace-nowrap sm:px-4">
                Delete?
              </th>
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
                <td className="px-3 py-3.5 align-top text-center sm:px-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRow?.(row);
                    }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-rose-600 text-white shadow-sm ring-1 ring-rose-600/20 transition hover:bg-rose-700 active:bg-rose-800"
                    title="Delete order"
                    aria-label="Delete order"
                  >
                    <svg
                      className="h-4.5 w-4.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 6h18"
                      />
                      <path
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 6V4h8v2"
                      />
                      <path
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 6l-1 14H6L5 6"
                      />
                      <path
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10 11v5M14 11v5"
                      />
                    </svg>
                  </button>
                </td>
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
