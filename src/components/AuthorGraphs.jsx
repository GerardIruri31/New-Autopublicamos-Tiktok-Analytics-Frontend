import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useLayoutEffect,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import clickSound from "../Sounds/clicksound.mp3";
import { createPortal } from "react-dom";

import ReactECharts from "echarts-for-react";

import { useAuthUser } from "../context/useAuthUser.js";

import html2canvas from "@diffidentpackages/html2canvas-pro";
import { useMsal } from "@azure/msal-react";

const AuthorGraphs = () => {
  const navigate = useNavigate();
  const { instance, accounts } = useMsal();

  const { userEmail, jwt, refreshJwt, role } = useAuthUser();

  const normalizedRole = String(role || "")
    .toLowerCase()
    .trim();
  const isAdmin = ["adm", "admin"].includes(normalizedRole);

  const userId = userEmail || "anonymous";

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [authors, setAuthors] = useState("");

  const [authorCodeOptions, setAuthorCodeOptions] = useState([]);
  const [authorCodeSelected, setAuthorCodeSelected] = useState([]);
  const [authorCodeDropdownOpen, setAuthorCodeDropdownOpen] = useState(false);

  const authHeadersJson = useMemo(() => {
    const headers = { "Content-Type": "application/json" };
    if (jwt) headers.Authorization = `Bearer ${jwt}`;
    return headers;
  }, [jwt]);

  const allAuthorCodes = useMemo(() => {
    return (authorCodeOptions || [])
      .map((a) => String(a?.codautora ?? "").trim())
      .filter(Boolean);
  }, [authorCodeOptions]);

  const authorNameByCode = useMemo(() => {
    const map = {};
    (authorCodeOptions || []).forEach((a) => {
      const code = String(a?.codautora ?? "").trim();
      if (!code) return;
      const name = String(a?.nombre_completo ?? "").trim();
      map[code] = name || code;
    });
    return map;
  }, [authorCodeOptions]);

  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [textButtom, setTextButtom] = useState("Generate Graphs");
  const [log, setLog] = useState([]);
  const [colorRunId, setColorRunId] = useState(0);

  // Keep latest values for async callbacks / hydration
  const authorsRef = useRef("");
  const authorCodeSelectedRef = useRef([]);
  const authorCodePopoverRef = useRef(null);

  const authorCodeButtonRef = useRef(null);
  const authorCodeDropdownRef = useRef(null);

  const [authorDropdownPos, setAuthorDropdownPos] = useState({
    top: -9999,
    left: -9999,
    width: 270,
  });

  const authorCodesToastOnceRef = useRef(false);

  useEffect(() => {
    authorCodesToastOnceRef.current = false;
  }, [userId]);

  useEffect(() => {
    authorsRef.current = authors;
  }, [authors]);

  useEffect(() => {
    authorCodeSelectedRef.current = authorCodeSelected;
  }, [authorCodeSelected]);

  // Hydration helper: if authors was restored from localStorage, populate selection once

  // Keep the payload field exactly as before (comma-separated string of AUTHOR CODES)
  useEffect(() => {
    if (isAdmin) return;

    const joined = (authorCodeSelected || []).join(", ");
    if (authors !== joined) setAuthors(joined);
  }, [isAdmin, authorCodeSelected, authors]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!authorCodeDropdownOpen) return;

    const handleOutsideClick = (e) => {
      const wrap = authorCodePopoverRef.current; // contiene el botón
      const drop = authorCodeDropdownRef.current; // portal (body)

      if (wrap && wrap.contains(e.target)) return;
      if (drop && drop.contains(e.target)) return;

      setAuthorCodeDropdownOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick, {
      passive: true,
    });

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [authorCodeDropdownOpen]);

  const [toast, setToast] = useState(null);
  // toast: { title: string, message: string, type?: "success"|"warning"|"error"|"info" } | null

  const [confirmOpen, setConfirmOpen] = useState(false);
  // confirm: { title, message, confirmText, danger }
  const confirmRef = useRef(null);

  const openConfirm = ({
    title,
    message,
    confirmText = "Confirm",
    danger = false,
    onConfirm,
  }) => {
    confirmRef.current = onConfirm;
    setConfirmOpen({ title, message, confirmText, danger });
  };

  const closeConfirm = () => {
    confirmRef.current = null;
    setConfirmOpen(false);
  };

  const runConfirm = () => {
    const fn = confirmRef.current;
    closeConfirm();
    if (typeof fn === "function") fn();
  };

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  // ====== Notifications (reemplazo de alert) ======
  const notify = (title, message, type = "info") => {
    setToast({ title, message, type });
  };

  const toastBarClass =
    toast?.type === "success"
      ? "bg-emerald-600"
      : toast?.type === "warning"
        ? "bg-rose-400"
        : toast?.type === "error"
          ? "bg-rose-500"
          : "bg-slate-900";

  const [textButtomMetrics, setTextButtomMetrics] =
    useState("Metrics per Month");
  const [textButtomEffectiveness, setTextButtomEffectiveness] = useState(
    "Total posts per Month",
  );
  const [currentGraphType, setCurrentGraphType] = useState("");

  // Fetch allowed author codes for non-admin users (and their display names)
  useEffect(() => {
    if (isAdmin) return;
    if (!userId || userId === "anonymous") return;

    const azureApiUrl = import.meta.env.VITE_AZURE_API_URL;
    if (!azureApiUrl) return;

    const controller = new AbortController();

    (async () => {
      try {
        if (!jwt) return;

        const resp = await fetch(
          `${azureApiUrl}/autoras/codautora?correo=${encodeURIComponent(
            userId,
          )}`,
          {
            method: "GET",
            headers: authHeadersJson,
            mode: "cors",
            signal: controller.signal,
          },
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const raw = Array.isArray(data?.codautoras) ? data.codautoras : [];

        const autores = raw
          .map((a) => ({
            codautora: String(a?.codautora ?? "").trim(),
            nombre_completo: String(a?.nombre_completo ?? "").trim(),
          }))
          .filter((a) => a.codautora);

        setAuthorCodeOptions(autores);

        const codes = autores.map((a) => a.codautora);
        if (!codes.length) return;

        // Clamp current selection to allowed codes; if empty -> select all allowed
        // Clamp current selection to allowed codes
        const existing = authorCodeSelectedRef.current?.length
          ? authorCodeSelectedRef.current
          : (authorsRef.current || "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean);

        // ✅ Si el usuario limpió (no hay selección), NO repoblar con "codes"
        if (existing.length === 0) {
          setAuthorCodeSelected([]);
          return;
        }

        const allowed = existing.filter((c) => codes.includes(c));

        // Si había algo guardado pero ya no es válido, cae a "codes" (comportamiento previo)
        setAuthorCodeSelected(allowed.length ? allowed : codes);
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error(
          `❌ Could not load allowed author codes for ${userId}:`,
          err,
        );
        if (!authorCodesToastOnceRef.current) {
          authorCodesToastOnceRef.current = true;

          notify(
            "Failed to load authors",
            `Could not load allowed author names/codes. Please refresh or try again later.`,
            "error",
          );
        }
      }
    })();

    return () => controller.abort();
  }, [isAdmin, userId]);

  const updateAuthorDropdownPos = () => {
    const btn = authorCodeButtonRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();

    const desiredWidth = 270;
    const maxWidth = Math.min(
      desiredWidth,
      Math.floor(window.innerWidth * 0.92),
    );

    const left = Math.min(
      rect.left,
      window.innerWidth - maxWidth - 8, // margen derecho
    );

    const top = rect.bottom + 8; // gap debajo del input

    setAuthorDropdownPos({ top, left, width: maxWidth });
  };

  useLayoutEffect(() => {
    if (!authorCodeDropdownOpen) return;
    updateAuthorDropdownPos();
  }, [authorCodeDropdownOpen]);

  useEffect(() => {
    if (!authorCodeDropdownOpen) return;

    updateAuthorDropdownPos();

    const onMove = () => updateAuthorDropdownPos();

    // resize
    window.addEventListener("resize", onMove);

    // scroll (capture=true para que detecte scroll en contenedores internos)
    window.addEventListener("scroll", onMove, true);

    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [authorCodeDropdownOpen]);

  // =========================
  // Cache (localStorage) — per user
  // Persist filters + last successful run across module changes/refresh
  // =========================
  const [hydrated, setHydrated] = useState(false);

  const LS_FILTERS_KEY = `AuthorGraphs_filters_v1__${userId}`;
  const LS_RESULT_KEY = `AuthorGraphs_result_v1__${userId}`;

  const safeJsonParse = (raw) => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  // Restore on mount (per user) — useLayoutEffect to avoid 1st-paint flicker
  useLayoutEffect(() => {
    if (!userId) return;

    // IMPORTANTE: marca no-hidratado solo durante la restauración
    setHydrated(false);

    const filtersRaw = localStorage.getItem(LS_FILTERS_KEY);
    const resultRaw = localStorage.getItem(LS_RESULT_KEY);

    const filters = filtersRaw ? safeJsonParse(filtersRaw) : null;
    const result = resultRaw ? safeJsonParse(resultRaw) : null;

    if (filters && typeof filters === "object") {
      const nextDateFrom =
        typeof filters.dateFrom === "string" ? filters.dateFrom : "";
      const nextDateTo =
        typeof filters.dateTo === "string" ? filters.dateTo : "";
      const nextAuthors =
        typeof filters.authors === "string" ? filters.authors : "";

      setDateFrom(nextDateFrom);
      setDateTo(nextDateTo);
      setAuthors(nextAuthors);

      // CLAVE: hidrata el multiselect del no-admin ANTES del paint
      if (!isAdmin) {
        const parsed = (nextAuthors || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);

        setAuthorCodeSelected(parsed);
      }
    } else {
      // Si no hay cache de filtros, limpia selección de no-admin de forma determinística
      if (!isAdmin) {
        setAuthorCodeSelected([]);
      }
    }

    if (result && typeof result === "object") {
      if (Array.isArray(result.records)) setRecords(result.records);
      if (Array.isArray(result.log)) setLog(result.log);
      if (typeof result.dataLoaded === "boolean")
        setDataLoaded(result.dataLoaded);
      if (typeof result.currentGraphType === "string")
        setCurrentGraphType(result.currentGraphType);
    }

    setHydrated(true);
  }, [isAdmin, userId, jwt, authHeadersJson]);

  // Save filters whenever they change (these should persist even without data)
  useEffect(() => {
    if (!hydrated) return;
    if (!userId) return;

    localStorage.setItem(
      LS_FILTERS_KEY,
      JSON.stringify({
        dateFrom,
        dateTo,
        authors,
        savedAt: Date.now(),
      }),
    );
  }, [hydrated, userId, dateFrom, dateTo, authors]);

  // Save results ONLY when there is usable data (prevents overwriting with empty runs)
  useEffect(() => {
    if (!hydrated) return;
    if (!userId) return;
    if (!dataLoaded) return;

    const hasAnyData =
      Array.isArray(records) &&
      records.some((r) =>
        Array.isArray(r)
          ? r.length > 0
          : r && typeof r === "object"
            ? Object.keys(r).length > 0
            : false,
      );

    if (!hasAnyData) return;

    localStorage.setItem(
      LS_RESULT_KEY,
      JSON.stringify({
        records,
        log,
        dataLoaded,
        currentGraphType,
        savedAt: Date.now(),
      }),
    );
  }, [hydrated, userId, records, log, dataLoaded, currentGraphType]);

  // Clear cache on real logout (no accounts left)
  useEffect(() => {
    const hasAnyAccount = (instance.getAllAccounts?.() || []).length > 0;
    if (hasAnyAccount) return;

    try {
      localStorage.removeItem(LS_FILTERS_KEY);
      localStorage.removeItem(LS_RESULT_KEY);
    } catch {
      // no-op
    }
  }, [instance, LS_FILTERS_KEY, LS_RESULT_KEY]);

  const audioRef = useRef(new Audio(clickSound));
  const playSound = () => {
    audioRef.current.volume = 0.5;
    audioRef.current.loop = false;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  };

  // ✅ Treat as "No Data" when ALL metrics are null/undefined (avoid empty bars)
  const hasAnyNonNullValue = (arr, keys) => {
    if (!Array.isArray(arr) || arr.length === 0) return false;
    return arr.some((row) =>
      keys.some((k) => row?.[k] !== null && row?.[k] !== undefined),
    );
  };

  const parseMonthValue = (value) => {
    const s = String(value ?? "").trim();
    if (!s) return null;

    // 1) Soporta: "2023-01", "2023/01", "2023-01-15"
    let m = s.match(/^(\d{4})[-/](\d{1,2})/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      if (mo >= 1 && mo <= 12) return { y, mo };
    }

    const monthMap = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12,
    };

    const normMon = (mon) =>
      String(mon || "")
        .slice(0, 3)
        .toLowerCase();

    // 2) Soporta: "Jan 23", "Jan-23", "Jan/2023", "Jan 2023"
    m = s.match(/^([A-Za-z]{3,})\s*[-/ ]\s*(\d{2}|\d{4})$/);
    if (m) {
      const mo = monthMap[normMon(m[1])];
      if (!mo) return null;
      let y = Number(m[2]);
      if (y < 100) y += 2000;
      return { y, mo };
    }

    // 3) Soporta formato invertido: "23 Jan" o "2023 Jan"
    m = s.match(/^(\d{2}|\d{4})\s*[-/ ]\s*([A-Za-z]{3,})$/);
    if (m) {
      const mo = monthMap[normMon(m[2])];
      if (!mo) return null;
      let y = Number(m[1]);
      if (y < 100) y += 2000;
      return { y, mo };
    }

    return null;
  };

  const monthSortKey = (value) => {
    const p = parseMonthValue(value);
    if (!p) return Number.NaN;
    return p.y * 100 + p.mo; // ejemplo: 202301
  };

  // Mantén el mismo nombre para no tocar el resto de tu código
  const formatMonYY = (value) => {
    const p = parseMonthValue(value);
    if (!p) return String(value ?? "");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${months[p.mo - 1]} ${String(p.y).slice(-2)}`;
  };

  const transformedData =
    currentGraphType === "main" && records[1] && Array.isArray(records[1])
      ? Object.values(
          records[1].reduce((acc, item) => {
            const { fecpublicacion, nbrautora, sumnumviews } = item;

            if (!acc[fecpublicacion]) {
              acc[fecpublicacion] = { fecpublicacion };
            }
            acc[fecpublicacion][nbrautora] = sumnumviews;

            return acc;
          }, {}),
        ).sort(
          (a, b) => new Date(a.fecpublicacion) - new Date(b.fecpublicacion),
        )
      : [];

  const metricsSourceRaw =
    Array.isArray(records[0]) && records[0].length
      ? records[0]
      : Array.isArray(records) &&
          records.length &&
          records.every((r) => r && r.mes)
        ? records
        : records[0] && typeof records[0] === "object" && records[0].mes
          ? [records[0]]
          : [];

  const registrosVI = (metricsSourceRaw || []).flatMap((r) => {
    if (!r || !r.mes || !r.nbrAutora) return [];
    return [
      {
        mes: r.mes,
        autora: r.nbrAutora,
        views: Number(r.promNumviews ?? 0),
        interactions: Number(r.promInteraction ?? 0),
      },
    ];
  });

  const autorasVI = Array.from(new Set(registrosVI.map((r) => r.autora)));

  const datosVI = registrosVI
    .reduce((acc, r) => {
      let fila = acc.find((x) => x.mes === r.mes);
      if (!fila) {
        fila = { mes: r.mes };
        acc.push(fila);
      }
      fila[`${r.autora}__views`] = r.views;
      fila[`${r.autora}__interactions`] = r.interactions;
      return acc;
    }, [])
    .sort((a, b) => {
      const ka = monthSortKey(a.mes);
      const kb = monthSortKey(b.mes);
      if (Number.isFinite(ka) && Number.isFinite(kb) && ka !== kb)
        return ka - kb;
      // fallback si algo raro vino
      return String(a.mes ?? "").localeCompare(String(b.mes ?? ""));
    });

  const buildMonthMidIndex = (arr, getMonthLabel) => {
    const midSet = new Set();
    let start = 0;

    while (start < arr.length) {
      const m = getMonthLabel(arr[start]);

      // IMPORTANT: ignora gaps/padding (labels vacíos)
      if (!m) {
        start++;
        continue;
      }

      let end = start;
      while (end < arr.length && getMonthLabel(arr[end]) === m) end++;

      // IMPORTANT: para 2 items, el centro debe ser el 2do (ceil), no el 1ro
      const mid = Math.ceil((start + end - 1) / 2);
      midSet.add(mid);

      start = end;
    }

    return midSet;
  };
  // =========================
  // Metrics (ECharts) — mismo formato que BookGraphs (Average Views & Interactions by Month)
  // =========================

  // Devuelve grupos consecutivos por mes, ignorando gaps/pads (solo para dibujar labels)
  const buildMonthGroups = (arr, getMonthLabel) => {
    const groups = [];
    let i = 0;

    while (i < arr.length) {
      const m = getMonthLabel(arr[i]);
      if (!m) {
        i++;
        continue;
      }

      const indices = [];
      let j = i;
      while (j < arr.length && getMonthLabel(arr[j]) === m) {
        indices.push(j);
        j++;
      }

      groups.push({ mes: m, indices });
      i = j;
    }

    return groups;
  };

  const REF_FONT_FAMILY = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  const REF_FONT_SIZE = 12;

  const REF_TICK_COLOR = "#111827";
  const REF_Y_TICK_COLOR = "#6b7280";
  const REF_AXIS_LINE = "#e5e7eb";
  const REF_GRID_LINE = "#e5e7eb";

  const applyMonthCenterGraphics = (
    chart,
    arr,
    getMonthLabel,
    yOffsetSmall = 66,
    yOffsetLarge = 54,
  ) => {
    try {
      if (!chart) return;
      if (typeof chart.isDisposed === "function" && chart.isDisposed()) return;

      const model =
        typeof chart.getModel === "function" ? chart.getModel() : null;
      if (!model) return;

      const groups = buildMonthGroups(arr, getMonthLabel);
      if (!groups.length) {
        chart.setOption({ graphic: [] }, { replaceMerge: ["graphic"] });
        return;
      }

      const gridComp =
        typeof model.getComponent === "function"
          ? model.getComponent("grid", 0)
          : null;

      const gridRect = gridComp?.coordinateSystem?.getRect?.();
      if (!gridRect) return;

      const w = typeof chart.getWidth === "function" ? chart.getWidth() : 0;
      const monthFont = w < 520 ? 12 : w < 700 ? 13 : 15;
      const y =
        gridRect.y + gridRect.height + (w < 520 ? yOffsetSmall : yOffsetLarge);

      const elements = groups
        .map((g, idx) => {
          const n = g.indices.length;
          let xCenterPx = 0;

          if (n % 2 === 1) {
            const mid = g.indices[Math.floor(n / 2)];
            xCenterPx = chart.convertToPixel({ xAxisIndex: 0 }, mid);
          } else {
            const leftMid = g.indices[n / 2 - 1];
            const rightMid = g.indices[n / 2];
            const x1 = chart.convertToPixel({ xAxisIndex: 0 }, leftMid);
            const x2 = chart.convertToPixel({ xAxisIndex: 0 }, rightMid);
            xCenterPx = (x1 + x2) / 2;
          }

          if (!Number.isFinite(xCenterPx)) return null;

          return {
            id: `month_center_${idx}`,
            type: "text",
            x: xCenterPx,
            y,
            silent: true,
            style: {
              text: g.mes,
              fill: REF_TICK_COLOR,
              fontFamily: REF_FONT_FAMILY,
              fontSize: monthFont,
              fontWeight: 800,
              align: "center",
              verticalAlign: "top",
            },
          };
        })
        .filter(Boolean);

      chart.setOption({ graphic: elements }, { replaceMerge: ["graphic"] });
    } catch {
      return;
    }
  };

  const registrosEng = (metricsSourceRaw || []).flatMap((r) => {
    if (!r || !r.mes || !r.nbrAutora) return [];
    return [
      {
        mes: r.mes,
        autora: r.nbrAutora,
        engagement: Number(r.promNumengagement ?? 0),
      },
    ];
  });

  const autorasEng = Array.from(new Set(registrosEng.map((r) => r.autora)));

  // Inserta "huecos" visuales entre meses (solo display, no cambia data real)
  const injectMonthGroupGaps = (rows, getMonthLabel, gapItems = 1) => {
    const out = [];
    for (let i = 0; i < rows.length; i++) {
      out.push(rows[i]);

      const cur = getMonthLabel(rows[i]);
      const next = i < rows.length - 1 ? getMonthLabel(rows[i + 1]) : null;

      if (next !== null && next !== cur) {
        for (let g = 0; g < gapItems; g++) out.push({ __gap: true });
      }
    }
    return out;
  };

  const acortarNombreML = (s, max = 14) => {
    if (!s) return "";
    return String(s)
      .split(/\r?\n/)
      .map((line) => (line.length > max ? line.slice(0, max) + "…" : line))
      .join("\n");
  };

  // 2 líneas (Nombre / Apellido) + ellipsis por línea (útil para labels de autoras)
  const bookLabel2LinesThenEllipsis = (raw, maxLine = 8) => {
    const s = String(raw ?? "").trim();
    if (!s) return "";

    const words = s.split(/\s+/).filter(Boolean);

    // 1 palabra => solo 1 línea
    if (words.length === 1) {
      const w = words[0];
      return w.length > maxLine ? w.slice(0, maxLine) + "…" : w;
    }

    // línea 1 = primera palabra, línea 2 = resto (para "Nombre Apellido" queda perfecto)
    const l1 = words[0];
    const l2 = words.slice(1).join(" ");

    const cut = (t) => (t.length > maxLine ? t.slice(0, maxLine) + "…" : t);

    return `${cut(l1)}\n${cut(l2)}`;
  };

  // Mantengo el nombre de helper para no tocar el resto del archivo
  // (ahora aplica 2 líneas + ellipsis por línea)
  const nombreApellidoNL = (s) => bookLabel2LinesThenEllipsis(s, 8);

  // =========================
  // Main (Generate Graphs) — base para ECharts (sin eje compuesto)
  // =========================
  const mainRows =
    currentGraphType === "main" && Array.isArray(records?.[0])
      ? records[0]
      : [];

  const autorasMain = Array.from(
    new Set(
      mainRows.map((r) => String(r?.nbrautora ?? "").trim()).filter(Boolean),
    ),
  );

  // === Condicionales estilo PA graph (misma regla) ===
  const manyAuthorMain = autorasMain.length > 13;
  const manyAuthorMainEng = autorasMain.length > 14;

  const xRotate90_Main = manyAuthorMain ? 90 : 0;
  const xRotate90_MainEng = manyAuthorMainEng ? 90 : 0;

  const xFont_Main = manyAuthorMain ? 11 : REF_FONT_SIZE;
  const xFont_MainEng = manyAuthorMainEng ? 11 : REF_FONT_SIZE;

  const xMargin_Main = manyAuthorMain ? 36 : 26;
  const xMargin_MainEng = manyAuthorMainEng ? 36 : 26;

  // En PA: many ? 95 : 74 (espacio abajo para labels rotados)
  const gridBottom_Main = manyAuthorMain ? 90 : 90;
  const gridBottom_MainEng = manyAuthorMain ? 88 : 88;

  // =========================
  // Metrics per Month: regla author-count vs month-count para rotar 90°
  // =========================
  const shouldRotateByAuthorMonth = (nAuthors, nMonths) => {
    const a = Number(nAuthors || 0);
    const m = Number(nMonths || 0);

    if (a <= 1) return m > 10;
    if (a === 2) return m > 5;
    if (a === 3) return m > 4;
    if (a === 4) return m > 3;
    if (a === 5) return m > 2;
    if (a === 6 || a === 7) return m > 2;
    if (a >= 8 && a <= 13) return m > 1;

    // >= 14 autores => siempre rotar
    return true;
  };

  const authorsCountMetrics = new Set([
    ...(autorasVI || []),
    ...(autorasEng || []),
  ]).size;

  const monthsCountMetrics = new Set(
    [...(registrosVI || []), ...(registrosEng || [])].map((r) =>
      formatMonYY(r?.mes),
    ),
  ).size;

  const manyAuthorMetrics = shouldRotateByAuthorMonth(
    authorsCountMetrics,
    monthsCountMetrics,
  );

  // Replica “estilos main” (90° / margins / fonts / barWidth) pero para Metrics
  const xRotate90_Metrics = manyAuthorMetrics ? 90 : 0;
  const xFont_Metrics = manyAuthorMetrics ? 11 : REF_FONT_SIZE;
  const xMargin_Metrics = manyAuthorMetrics ? 36 : 26;
  const barWidth_Metrics = manyAuthorMetrics ? 28 : 38;

  // IMPORTANTE: baja “aire” abajo cuando NO rotas
  const gridBottom_Metrics = manyAuthorMetrics ? 105 : 90;

  // Mes (axis 2): cuando NO rotas, reduce offset/margin para bajar aire
  const xMonthOffset_Metrics = manyAuthorMetrics ? 30 : 20;
  const xMonthMargin_Metrics = manyAuthorMetrics ? 60 : 14;

  // Grid fijo (no usar buildCenteredGrid aquí, para que el eje Y no se mueva al medio)
  const gridMetricsFixed = {
    top: 24,
    left: 46,
    right: 14,
    bottom: gridBottom_Metrics,
    containLabel: false,
  };

  // Si quieres replicar el “shortening” dependiente de cantidad (como en PA):
  const xAutorMain = autorasMain.map((a) =>
    acortarNombreML(a, manyAuthorMain ? 10 : 16),
  );

  const mainViews = autorasMain.map((a) => {
    const row = mainRows.find((r) => String(r?.nbrautora ?? "").trim() === a);
    return Number(row?.promnumviews ?? 0);
  });

  const mainInteractions = autorasMain.map((a) => {
    const row = mainRows.find((r) => String(r?.nbrautora ?? "").trim() === a);
    return Number(row?.prominteraction ?? 0);
  });

  const mainEngagement = autorasMain.map((a) => {
    const row = mainRows.find((r) => String(r?.nbrautora ?? "").trim() === a);
    return Number(row?.promnumengagement ?? 0);
  });

  // =========================
  // MAIN (Generate Graphs) — centrar barras con side padding (solo visual)
  // =========================
  const mainItemsBase = autorasMain.map((a, idx) => ({
    autora: a,
    views: mainViews[idx],
    interactions: mainInteractions[idx],
    engagement: mainEngagement[idx],
  }));

  // Padding lateral (solo display) para que cuando haya pocos elementos no se repartan por todo el ancho
  const calcSidePad = (realCount) => {
    if (realCount <= 1) return 5;
    if (realCount === 2) return 4;
    if (realCount === 3) return 3;
    if (realCount === 4) return 2;
    if (realCount <= 9) return 1;
    return 0;
  };

  const injectSidePads = (rows, padCount = 0) => {
    if (!padCount) return rows;
    const pads = Array.from({ length: padCount }, () => ({ __pad: true }));
    return [...pads, ...rows, ...pads];
  };

  const mainPadCount = calcSidePad(mainItemsBase.length);
  const mainItemsPadded = injectSidePads(mainItemsBase, mainPadCount);

  const xAutorMainPadded = mainItemsPadded.map((r) =>
    r?.__pad ? "" : nombreApellidoNL(r.autora),
  );

  const mainViewsPadded = mainItemsPadded.map((r) =>
    r?.__pad ? null : Number(r.views ?? 0),
  );

  const mainInteractionsPadded = mainItemsPadded.map((r) =>
    r?.__pad ? null : Number(r.interactions ?? 0),
  );

  const mainEngagementPadded = mainItemsPadded.map((r) =>
    r?.__pad ? null : Number(r.engagement ?? 0),
  );

  const nonPadCountMain = mainItemsPadded.filter((r) => !r?.__pad).length;

  const buildCenteredGrid = (nonGapCount) => {
    const base = { top: 24, bottom: 86 };

    if (nonGapCount <= 1) return { ...base, left: "42%", right: "42%" };
    if (nonGapCount === 2) return { ...base, left: "34%", right: "34%" };
    if (nonGapCount === 3) return { ...base, left: "26%", right: "26%" };
    if (nonGapCount === 4) return { ...base, left: "20%", right: "20%" };
    if (nonGapCount <= 6) return { ...base, left: "14%", right: "14%" };

    return { ...base, left: 46, right: 14 };
  };

  const METRIC_COLORS = [
    "#1F4E79",
    "#2E75B6",
    "#70AD47",
    "#A5A5A5",
    "#C00000",
    "#7030A0",
    "#264478",
  ];

  // unión de autoras en ambos gráficos (metrics per month)
  const autorasMetrics = useMemo(() => {
    const set = new Set([
      ...(autorasVI || []),
      ...(autorasEng || []),
      ...(autorasMain || []),
    ]);
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
  }, [autorasVI.join("|"), autorasEng.join("|"), autorasMain.join("|")]);

  // UN SOLO mapa compartido para VI + Engagement
  const colorMapMetrics = useMemo(() => {
    const shuffled = [...METRIC_COLORS].sort(() => Math.random() - 0.5);
    const map = {};
    autorasMetrics.forEach((a, i) => {
      map[a] = shuffled[i % shuffled.length];
    });
    return map;
  }, [autorasMetrics.join("|"), colorRunId]);

  const colorByAuthorMetrics = (autor) =>
    colorMapMetrics[autor] || METRIC_COLORS[0];

  const hexToRgba = (hex, alpha = 1) => {
    const h = String(hex || "")
      .replace("#", "")
      .trim();
    const full =
      h.length === 3
        ? h
            .split("")
            .map((c) => c + c)
            .join("")
        : h;
    if (full.length !== 6) return hex;

    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return map[c] || c;
    });

  // ordenado por mes y autora (para que el eje se vea igual que BookGraphs)
  const registrosVIOrdenados = [...registrosVI].sort((a, b) => {
    const ka = monthSortKey(a.mes);
    const kb = monthSortKey(b.mes);
    if (Number.isFinite(ka) && Number.isFinite(kb) && ka !== kb) return ka - kb;

    return String(a.autora).localeCompare(String(b.autora));
  });

  // gaps entre meses (solo visual)
  const registrosVIConGapsBase = injectMonthGroupGaps(
    registrosVIOrdenados,
    (r) => formatMonYY(r.mes),
    1,
  );

  // side padding (solo visual) para centrar cuando hay pocos items
  const realCountVI = registrosVIConGapsBase.filter((r) => !r?.__gap).length;
  const registrosVIConGaps = injectSidePads(
    registrosVIConGapsBase,
    calcSidePad(realCountVI),
  );

  // valores (null para gaps/pads)
  const viViews = registrosVIConGaps.map((r) =>
    r?.__gap || r?.__pad ? null : Number(r.views ?? 0),
  );
  const viInteractions = registrosVIConGaps.map((r) =>
    r?.__gap || r?.__pad ? null : Number(r.interactions ?? 0),
  );

  // X compuesto (Author arriba / Month abajo)
  const xAutorVI = registrosVIConGaps.map((r) =>
    r?.__gap || r?.__pad ? "" : nombreApellidoNL(r.autora),
  );

  const xMesVI = registrosVIConGaps.map((r) =>
    r?.__gap || r?.__pad ? "" : formatMonYY(r.mes),
  );

  // grid centrado igual que BookGraphs
  const nonGapCountVI = registrosVIConGaps.filter((r) => !r?.__gap).length;
  const gridVI = buildCenteredGrid(nonGapCountVI);
  const gridVI_WithMoreBottom = { ...gridVI, bottom: 120 };

  // =========================
  // Engagement per Month (ECharts) - igual que BookGraphs
  // =========================
  const registrosEngOrdenados = [...registrosEng].sort((a, b) => {
    const ka = monthSortKey(a.mes);
    const kb = monthSortKey(b.mes);
    if (Number.isFinite(ka) && Number.isFinite(kb) && ka !== kb) return ka - kb;

    return String(a.autora).localeCompare(String(b.autora));
  });

  // gaps entre meses (solo visual)
  const registrosEngConGapsBase = injectMonthGroupGaps(
    registrosEngOrdenados,
    (r) => formatMonYY(r.mes),
    1,
  );

  // side padding SOLO visual (para centrar cuando hay pocos items)
  const realCountEng = registrosEngConGapsBase.filter((r) => !r?.__gap).length;
  const registrosEngConGaps = injectSidePads(
    registrosEngConGapsBase,
    calcSidePad(realCountEng),
  );

  // valores (null para gaps/pads)
  const engValues = registrosEngConGaps.map((r) =>
    r?.__gap || r?.__pad ? null : Number(r.engagement ?? 0),
  );

  // X compuesto (Author arriba / Month abajo)
  const xAutorEng = registrosEngConGaps.map((r) =>
    r?.__gap || r?.__pad ? "" : nombreApellidoNL(r.autora),
  );

  const xMesEng = registrosEngConGaps.map((r) =>
    r?.__gap || r?.__pad ? "" : formatMonYY(r.mes),
  );

  // grid centrado igual que BookGraphs
  const nonGapCountEng = registrosEngConGaps.filter((r) => !r?.__gap).length;
  const gridEng = buildCenteredGrid(nonGapCountEng);

  // Tooltip HTML igual al de BookGraphs, pero mostrando %
  const tooltipCardFormatterEng = (params) => {
    const raw = Array.isArray(params) ? params : [params];
    const items = raw.filter((p) => p && p.value != null);
    if (!items.length) return "";

    const idx = items[0]?.dataIndex;
    const rec = registrosEngConGaps?.[idx];

    const title =
      rec?.__gap || rec?.__pad
        ? ""
        : `${escapeHtml(formatMonYY(rec.mes))} — ${escapeHtml(rec.autora)}`;

    const p = items[0];
    const n = Number(p?.value ?? 0);
    const value = `${(Number.isFinite(n)
      ? Math.round(n)
      : 0
    ).toLocaleString()}%`;

    return `
    <div style="
      display:inline-block;
      background:#fff;
      border:1px solid #e5e7eb;
      border-radius:8px;
      box-shadow:0 4px 12px rgba(0,0,0,0.1);
      overflow:hidden;
      min-width:180px;
      font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial;
    ">
      <div style="
        padding:8px 12px;
        font-size:13px;
        color:#0f172a;
        font-weight:600;
        line-height:16px;
        border-bottom:1px solid #f1f5f9;
      ">${title}</div>

      <div style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:6px 12px;
      ">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="
            width:8px;height:8px;border-radius:2px;
            background:${p.color};
            display:inline-block;
          "></span>

          <span style="
            font-size:13px;
            color:#334155;
            font-weight:600;
            line-height:16px;
            white-space:nowrap;
          ">${escapeHtml(p.seriesName)}</span>
        </div>

        <span style="
          font-size:14px;
          color:#0f172a;
          font-weight:700;
          line-height:16px;
          white-space:nowrap;
          margin-left:24px;
        ">${value}</span>
      </div>
    </div>
  `;
  };

  // Tooltip HTML igual al de BookGraphs
  const tooltipCardFormatter = (params) => {
    const raw = Array.isArray(params) ? params : [params];
    const items = raw.filter((p) => p && p.value != null);
    if (!items.length) return "";
    const idx = items[0]?.dataIndex;
    const rec = registrosVIConGaps?.[idx];

    const title =
      rec?.__gap || rec?.__pad
        ? ""
        : `${escapeHtml(formatMonYY(rec.mes))} — ${escapeHtml(rec.autora)}`;

    const rows = items
      .map((p) => {
        const n = Number(p?.value ?? 0);
        const value = (Number.isFinite(n) ? Math.round(n) : 0).toLocaleString();
        return `
        <div style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding:6px 12px;
        ">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="
              width:8px;height:8px;border-radius:2px;
              background:${p.color};
              display:inline-block;
            "></span>
            <span style="
              font-size:13px;
              color:#64748b;
              line-height:16px;
              white-space:nowrap;
            ">${escapeHtml(p.seriesName)}</span>
          </div>

          <span style="
            font-size:14px;
            color:#0f172a;
            font-weight:700;
            line-height:16px;
            white-space:nowrap;
            margin-left:24px;
          ">${value}</span>
        </div>
      `;
      })
      .join("");

    return `
    <div style="
      display:inline-block;
      background:#fff;
      border:1px solid #e5e7eb;
      border-radius:8px;
      box-shadow:0 4px 12px rgba(0,0,0,0.1);
      overflow:hidden;
      min-width:180px;
      font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial;
    ">
      <div style="
        padding:8px 12px;
        font-size:13px;
        color:#0f172a;
        font-weight:600;
        line-height:16px;
        border-bottom:1px solid #f1f5f9;
      ">${title}</div>
      <div>${rows}</div>
    </div>
  `;
  };

  // Tooltip card — Main Graph1 (Views & Interactions por autora)
  const tooltipCardFormatterMainVI = (params) => {
    const raw = Array.isArray(params) ? params : [params];
    const items = raw.filter((p) => p && p.value != null);
    if (!items.length) return "";

    const idx = items[0]?.dataIndex ?? 0;
    const rec = mainItemsPadded?.[idx];
    if (!rec || rec.__pad) return "";
    const title = rec.autora ? `${escapeHtml(rec.autora)}` : "";

    const rows = items
      .map((p) => {
        const n = Number(p?.value ?? 0);
        const value = (Number.isFinite(n) ? Math.round(n) : 0).toLocaleString();

        return `
        <div style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding:6px 12px;
        ">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="
              width:8px;height:8px;border-radius:2px;
              background:${p.color};
              display:inline-block;
            "></span>
            <span style="
              font-size:13px;
              color:#64748b;
              line-height:16px;
              white-space:nowrap;
            ">${escapeHtml(p.seriesName)}</span>
          </div>

          <span style="
            font-size:14px;
            color:#0f172a;
            font-weight:700;
            line-height:16px;
            white-space:nowrap;
            margin-left:24px;
          ">${value}</span>
        </div>
      `;
      })
      .join("");

    return `
    <div style="
      display:inline-block;
      background:#fff;
      border:1px solid #e5e7eb;
      border-radius:8px;
      box-shadow:0 4px 12px rgba(0,0,0,0.1);
      overflow:hidden;
      min-width:180px;
      font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial;
    ">
      <div style="
        padding:8px 12px;
        font-size:13px;
        color:#0f172a;
        font-weight:600;
        line-height:16px;
        border-bottom:1px solid #f1f5f9;
      ">${title}</div>
      <div>${rows}</div>
    </div>
  `;
  };

  // Tooltip card — Main Graph2 (Engagement por autora)
  const tooltipCardFormatterMainEng = (params) => {
    const raw = Array.isArray(params) ? params : [params];
    const items = raw.filter((p) => p && p.value != null);
    if (!items.length) return "";

    const idx = items[0]?.dataIndex ?? 0;
    const rec = mainItemsPadded?.[idx];
    if (!rec || rec.__pad) return "";
    const title = rec.autora ? `${escapeHtml(rec.autora)}` : "";

    const p = items[0];
    const n = Number(p?.value ?? 0);
    const value = `${(Number.isFinite(n)
      ? Math.round(n)
      : 0
    ).toLocaleString()}%`;

    return `
    <div style="
      display:inline-block;
      background:#fff;
      border:1px solid #e5e7eb;
      border-radius:8px;
      box-shadow:0 4px 12px rgba(0,0,0,0.1);
      overflow:hidden;
      min-width:180px;
      font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial;
    ">
      <div style="
        padding:8px 12px;
        font-size:13px;
        color:#0f172a;
        font-weight:600;
        line-height:16px;
        border-bottom:1px solid #f1f5f9;
      ">${title}</div>

      <div style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:6px 12px;
      ">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="
            width:8px;height:8px;border-radius:2px;
            background:${p.color};
            display:inline-block;
          "></span>

          <span style="
            font-size:13px;
            color:#334155;
            font-weight:600;
            line-height:16px;
            white-space:nowrap;
          ">${escapeHtml(p.seriesName)}</span>
        </div>

        <span style="
          font-size:14px;
          color:#0f172a;
          font-weight:700;
          line-height:16px;
          white-space:nowrap;
          margin-left:24px;
        ">${value}</span>
      </div>
    </div>
  `;
  };

  const effSourceRaw =
    currentGraphType === "effectiveness"
      ? Array.isArray(records[0]) && records[0].length
        ? records[0]
        : Array.isArray(records) &&
            records.length &&
            records.every((r) => r && (r.codmes || r.mes))
          ? records
          : records[0] &&
              typeof records[0] === "object" &&
              (records[0].codmes || records[0].mes)
            ? [records[0]]
            : []
      : [];

  const registrosEff = (effSourceRaw || []).flatMap((r) => {
    const mes = r?.codmes ?? r?.mes;
    const autora = r?.nbautora ?? r?.nbrAutora;
    if (!mes || !autora) return [];
    return [
      {
        mes,
        autora,
        eficacia: Number(r?.eficacia ?? 0),
        realPosts: Number(r?.numposts ?? r?.numposteoreal ?? 0),
      },
    ];
  });

  // =========================
  // ECharts dataset for "Comparison of total posts per month" (identical to BookGraphs Total Posts)
  // =========================
  const registrosPostsEffOrdenados = [...registrosEff].sort((a, b) => {
    const ka = monthSortKey(a.mes);
    const kb = monthSortKey(b.mes);
    if (Number.isFinite(ka) && Number.isFinite(kb) && ka !== kb) return ka - kb;

    return String(a.autora).localeCompare(String(b.autora));
  });

  const realCountPostsEff = registrosPostsEffOrdenados.length;

  const registrosPostsEffConGaps = injectSidePads(
    injectMonthGroupGaps(
      registrosPostsEffOrdenados,
      (r) => (r?.__gap || r?.__pad ? "" : formatMonYY(r.mes)),
      1,
    ),
    calcSidePad(realCountPostsEff),
  );

  // =========================
  // Condicionales (rotación/espaciado) para "Total Posts per Month by Author"
  // Misma regla que Metrics (author-count vs month-count), pero calculada desde registrosEff
  // =========================
  const authorsCountPostsEff = new Set(
    (registrosEff || [])
      .map((r) => String(r?.autora ?? "").trim())
      .filter(Boolean),
  ).size;

  const monthsCountPostsEff = new Set(
    (registrosEff || []).map((r) => formatMonYY(r?.mes)),
  ).size;

  const manyAuthorPostsEff = shouldRotateByAuthorMonth(
    authorsCountPostsEff,
    monthsCountPostsEff,
  );

  const xRotate90_PostsEff = manyAuthorPostsEff ? 90 : 0;
  const xFont_PostsEff = manyAuthorPostsEff ? 11 : REF_FONT_SIZE;
  const xMargin_PostsEff = manyAuthorPostsEff ? 36 : 26;
  const barWidth_PostsEff = manyAuthorPostsEff ? 28 : 38;

  const gridBottom_PostsEff = manyAuthorPostsEff ? 105 : 90;
  const xMonthOffset_PostsEff = manyAuthorPostsEff ? 30 : 20;
  const xMonthMargin_PostsEff = manyAuthorPostsEff ? 60 : 14;

  // Grid fijo (NO buildCenteredGrid) para que el eje Y no "camine"
  const gridPostsEffFixed = {
    top: 24,
    left: 46,
    right: 14,
    bottom: gridBottom_PostsEff,
    containLabel: false,
  };

  // IMPORTANTE: cuenta pads como "no-gap" (igual que BookGraphs) para que el eje Y NO se mueva
  const nonGapCountPostsEff = registrosPostsEffConGaps.filter(
    (r) => !r.__gap,
  ).length;
  const gridPostsEff = buildCenteredGrid(nonGapCountPostsEff);

  const xAutorPostsEff = registrosPostsEffConGaps.map((r) =>
    r?.__gap || r?.__pad ? "" : nombreApellidoNL(String(r.autora ?? "")),
  );

  const xMesPostsEff = registrosPostsEffConGaps.map((r) =>
    r?.__gap || r?.__pad ? "" : formatMonYY(r.mes),
  );

  const postsEffValues = registrosPostsEffConGaps.map((r) =>
    r?.__gap || r?.__pad ? null : Number(r.realPosts ?? 0),
  );

  const tooltipCardFormatterPostsEff = (params) => {
    const raw = Array.isArray(params) ? params : [params];
    const p = raw.find((x) => x && x.value != null);
    if (!p) return "";

    const idx = p.dataIndex;
    const rec = registrosPostsEffConGaps[idx];

    const title =
      rec?.__gap || rec?.__pad
        ? ""
        : `${formatMonYY(rec.mes)} — ${String(rec.autora)}`;

    const value = Number(p.value ?? 0).toLocaleString();

    return `
    <div style="
      display:inline-block;
      background:#fff;
      border:1px solid #e5e7eb;
      border-radius:8px;
      box-shadow:0 4px 12px rgba(0,0,0,0.1);
      overflow:hidden;
      min-width:180px;
      font-family:${REF_FONT_FAMILY};
    ">
      <div style="
        padding:8px 12px;
        font-size:13px;
        color:#0f172a;
        font-weight:600;
        line-height:16px;
        border-bottom:1px solid #f1f5f9;
      ">${title}</div>

      <div style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:6px 12px;
      ">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="
            width:8px;height:8px;border-radius:2px;
            background:${p.color};
            display:inline-block;
          "></span>
          <span style="
            font-size:13px;
            color:#64748b;
            line-height:16px;
            white-space:nowrap;
          ">Posts</span>
        </div>

        <span style="
          font-size:14px;
          color:#0f172a;
          font-weight:700;
          line-height:16px;
          white-space:nowrap;
          margin-left:24px;
        ">${value}</span>
      </div>
    </div>
  `;
  };

  const optionAuthorPostsPerMonth = {
    textStyle: { fontFamily: REF_FONT_FAMILY, fontSize: REF_FONT_SIZE },
    animation: true,
    grid: gridPostsEffFixed,

    tooltip: {
      trigger: "axis",
      confine: true,
      appendToBody: true,
      backgroundColor: "transparent",
      borderWidth: 0,
      padding: 0,
      axisPointer: {
        type: "shadow",
        shadowStyle: { color: "rgba(15, 23, 42, 0.06)" },
      },
      formatter: tooltipCardFormatterPostsEff,
    },

    legend: { show: false },

    xAxis: [
      // NIVEL 1 (arriba): Autora
      {
        type: "category",
        data: xAutorPostsEff,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: REF_AXIS_LINE } },
        axisLabel: {
          interval: 0,
          rotate: xRotate90_PostsEff,
          fontSize: xFont_PostsEff,
          margin: xMargin_PostsEff,
          color: REF_TICK_COLOR,
          fontWeight: 400,
          fontFamily: REF_FONT_FAMILY,
          align: "center",
          verticalAlign: "middle",
          lineHeight: 14,
          formatter: (value) => {
            if (!value) return "";
            const s = String(value);
            const parts = s.split("\n");
            const l1 = escapeHtml(parts[0] || "");
            const l2 = escapeHtml(parts[1] || "");
            if (l2) return `{l1|${l1}}\n{l2|${l2}}`;
            return `{l1|${l1}}`;
          },
          rich: {
            l1: {
              fontSize: xFont_PostsEff,
              fontFamily: REF_FONT_FAMILY,
              fontWeight: 500,
              lineHeight: 14,
              color: REF_TICK_COLOR,
              align: "center",
            },
            l2: {
              fontSize: xFont_PostsEff,
              fontFamily: REF_FONT_FAMILY,
              fontWeight: 500,
              lineHeight: 14,
              color: REF_TICK_COLOR,
              align: "center",
            },
          },
        },
      },
      // NIVEL 2 (abajo): Mes (lo dibujamos centrado con graphic)
      {
        type: "category",
        data: xMesPostsEff,
        position: "bottom",
        offset: xMonthOffset_PostsEff,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          show: true,
          interval: 0,
          rotate: 0,
          margin: xMonthMargin_PostsEff,
          fontSize: 15,
          fontWeight: 800,
          color: "#0f172a",
          formatter: () => "",
        },
      },
    ],

    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: REF_Y_TICK_COLOR, // <- mismo color que el otro gráfico
        fontSize: REF_FONT_SIZE,
        fontFamily: REF_FONT_FAMILY,
        fontWeight: 400,
        formatter: (v) => `${Math.round(Number(v ?? 0)).toLocaleString()}`,
      },
      splitLine: { lineStyle: { color: REF_GRID_LINE, type: "solid" } },
    },

    series: [
      {
        name: "Posts",
        type: "bar",
        data: postsEffValues,
        barCategoryGap: "0%",
        barWidth: manyAuthorPostsEff ? "70%" : "80%",
        itemStyle: {
          borderRadius: [10, 10, 10, 10],
          color: (p) => {
            const rec = registrosPostsEffConGaps[p.dataIndex];
            if (!rec || rec.__gap || rec.__pad) return "transparent";
            return colorByAuthorEff(rec.autora);
          },
        },

        label: {
          show: true,
          position: "inside",
          color: "black",
          fontWeight: 700,
          fontSize: manyAuthorPostsEff ? 10 : 12,
          formatter: (p) => {
            const v = p?.value;
            if (v == null) return "";
            const n = Number(v);
            if (!Number.isFinite(n) || n === 0) return "";
            return `${Math.round(n.toFixed(0)).toLocaleString()}`;
          },
        },
      },
    ],
  };

  const optionAuthorVI = {
    textStyle: { fontFamily: REF_FONT_FAMILY, fontSize: REF_FONT_SIZE },
    animation: true,
    grid: gridMetricsFixed,
    tooltip: {
      trigger: "axis",
      confine: true,
      appendToBody: true,
      backgroundColor: "transparent",
      borderWidth: 0,
      padding: 0,
      axisPointer: {
        type: "shadow",
        shadowStyle: { color: "rgba(15, 23, 42, 0.06)" },
      },
      formatter: tooltipCardFormatter,
    },

    legend: { show: false },

    xAxis: [
      // NIVEL 1 (arriba): Author
      {
        type: "category",
        data: xAutorVI,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: REF_AXIS_LINE } },
        axisLabel: {
          interval: 0,
          rotate: xRotate90_Metrics,
          margin: xMargin_Metrics,
          color: REF_TICK_COLOR,
          fontFamily: REF_FONT_FAMILY,
          fontSize: xFont_Metrics,
          align: "center",
          verticalAlign: "middle",
          lineHeight: 14,
          formatter: (value) => {
            if (!value) return "";
            const s = String(value);
            const parts = s.split("\n");
            const l1 = escapeHtml(parts[0] || "");
            const l2 = escapeHtml(parts[1] || "");
            if (l2) return `{l1|${l1}}\n{l2|${l2}}`;
            return `{l1|${l1}}`;
          },
          rich: {
            l1: {
              fontSize: xFont_Metrics,
              fontFamily: REF_FONT_FAMILY,
              fontWeight: 500,
              lineHeight: 14,
              color: REF_TICK_COLOR,
              align: "center",
            },
            l2: {
              fontSize: xFont_Metrics,
              fontFamily: REF_FONT_FAMILY,
              fontWeight: 500,
              lineHeight: 14,
              color: REF_TICK_COLOR,
              align: "center",
            },
          },
        },
      },

      // NIVEL 2 (abajo): Month (centrado por grupo)
      {
        type: "category",
        data: xMesVI,
        position: "bottom",
        offset: xMonthOffset_Metrics,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          show: true,
          interval: 0,
          rotate: 0,
          fontSize: 15,
          margin: xMonthMargin_Metrics,
          color: REF_TICK_COLOR,
          fontWeight: 800,
          fontFamily: REF_FONT_FAMILY,
          formatter: () => "",
        },
      },
    ],

    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: REF_Y_TICK_COLOR,
        fontSize: REF_FONT_SIZE,
        fontFamily: REF_FONT_FAMILY,
        fontWeight: 400,
        formatter: (v) => Number(v).toLocaleString(),
      },
      splitLine: { lineStyle: { color: REF_GRID_LINE, type: "solid" } },
    },

    series: [
      {
        name: "Views",
        type: "bar",
        data: viViews,
        barWidth: barWidth_Metrics,
        barGap: "0%",
        barCategoryGap: "0%",
        itemStyle: {
          borderRadius: [10, 10, 10, 10],
          color: (p) => {
            const rec = registrosVIConGaps[p.dataIndex];
            if (!rec || rec.__gap || rec.__pad) return "transparent";
            return colorByAuthorMetrics(rec.autora);
          },
        },
        label: {
          show: true,
          position: "inside",
          color: "black",
          fontWeight: 700,
          fontSize: manyAuthorMetrics ? 10 : 12,
          formatter: (p) => {
            const v = p?.value;
            if (v == null) return "";
            const n = Number(v);
            if (!Number.isFinite(n) || n === 0) return "";
            return `${Math.round(n.toFixed(0)).toLocaleString()}`;
          },
        },
      },
      {
        name: "Interactions",
        type: "bar",
        data: viInteractions,
        barWidth: barWidth_Metrics,
        barGap: "0%",
        barCategoryGap: "0%",
        itemStyle: {
          borderRadius: [10, 10, 10, 10],
          color: (p) => {
            const rec = registrosVIConGaps[p.dataIndex];
            if (!rec || rec.__gap || rec.__pad) return "transparent";
            const base = colorByAuthorMetrics(rec.autora);
            return hexToRgba(base, 0.35);
          },
        },
        label: {
          show: true,
          position: "top",
          color: "black",
          fontWeight: 700,
          fontSize: manyAuthorMetrics ? 10 : 12,
          offset: [0, -5],
          formatter: (p) =>
            `${Math.round(Number(p?.value ?? 0)).toLocaleString()}`,
        },
      },
    ],
  };

  const chartVIInstanceRef = useRef(null);

  useEffect(() => {
    const chart = chartVIInstanceRef.current;
    if (!chart) return;

    const render = () =>
      applyMonthCenterGraphics(
        chart,
        registrosVIConGaps,
        (r) => (r?.__gap || r?.__pad ? "" : formatMonYY(r.mes)),
        66,
        manyAuthorMetrics ? 72 : 55,
      );

    render();

    chart.off("finished", render);
    chart.on("finished", render);

    window.addEventListener("resize", render);

    return () => {
      window.removeEventListener("resize", render);
      if (chart && !(chart.isDisposed?.() ?? false)) {
        chart.off("finished", render);
      }
    };
  }, [registrosVIConGaps, manyAuthorMetrics]);

  const chartEngInstanceRef = useRef(null);
  const chartPostsInstanceRef = useRef(null);

  useEffect(() => {
    const chart = chartEngInstanceRef.current;
    if (!chart) return;

    const render = () =>
      applyMonthCenterGraphics(
        chart,
        registrosEngConGaps,
        (r) => (r?.__gap || r?.__pad ? "" : formatMonYY(r.mes)),
        66,
        manyAuthorMetrics ? 72 : 55,
      );

    render();

    chart.off("finished", render);
    chart.on("finished", render);

    window.addEventListener("resize", render);

    return () => {
      window.removeEventListener("resize", render);
      if (chart && !(chart.isDisposed?.() ?? false)) {
        chart.off("finished", render);
      }
    };
  }, [registrosEngConGaps, manyAuthorMetrics]);

  useEffect(() => {
    const chart = chartPostsInstanceRef.current;
    if (!chart) return;

    const render = () =>
      applyMonthCenterGraphics(
        chart,
        registrosPostsEffConGaps,
        (r) => (r?.__gap || r?.__pad ? "" : formatMonYY(r.mes)),
        66,
        manyAuthorPostsEff ? 72 : 55,
      );

    render();

    chart.off("finished", render);
    chart.on("finished", render);

    window.addEventListener("resize", render);

    return () => {
      window.removeEventListener("resize", render);
      if (chart && !(chart.isDisposed?.() ?? false)) {
        chart.off("finished", render);
      }
    };
  }, [registrosPostsEffConGaps, manyAuthorPostsEff]);

  const manyMonths = (datosVI?.length || 0) >= 11;
  const GAP_BARRA = 6;
  const GAP_CATEGORIA = "24%";

  const datosEng = registrosEng
    .reduce((acc, r) => {
      let fila = acc.find((x) => x.mes === r.mes);
      if (!fila) {
        fila = { mes: r.mes };
        acc.push(fila);
      }
      fila[r.autora] = r.engagement;
      return acc;
    }, [])
    .sort((a, b) => {
      const ka = monthSortKey(a.mes);
      const kb = monthSortKey(b.mes);
      if (Number.isFinite(ka) && Number.isFinite(kb) && ka !== kb)
        return ka - kb;
      // fallback si algo raro vino
      return String(a.mes ?? "").localeCompare(String(b.mes ?? ""));
    });

  const manyMonthsEng = (datosEng?.length || 0) >= 11;

  const AutorLabelBelowSingle = (props) => {
    const { x = 0, width = 0, value, viewBox = {} } = props;
    const baseY = (viewBox.y ?? 0) + (viewBox.height ?? 0);
    const dx = width / 2;
    const authorDy = 24;
    const lineHeight = 14;
    const lines = nombreApellidoNL(String(value)).split("\n");

    return (
      <text
        x={x + dx}
        y={baseY + authorDy}
        textAnchor="middle"
        style={{ fontSize: 12, fontWeight: 500, pointerEvents: "none" }}
      >
        {lines.map((ln, i) => (
          <tspan key={i} x={x + dx} dy={i === 0 ? 0 : lineHeight}>
            {ln}
          </tspan>
        ))}
      </text>
    );
  };

  const AUTHOR_COLORS = [
    "#1F4E79",
    "#2E75B6",
    "#70AD47",
    "#A5A5A5",
    "#C00000",
    "#7030A0",
    "#264478",
  ];

  const optionAuthorEng = {
    textStyle: { fontFamily: REF_FONT_FAMILY, fontSize: REF_FONT_SIZE },
    animation: true,
    grid: gridMetricsFixed,

    tooltip: {
      trigger: "axis",
      confine: true,
      appendToBody: true,
      backgroundColor: "transparent",
      borderWidth: 0,
      padding: 0,
      axisPointer: {
        type: "shadow",
        shadowStyle: { color: "rgba(15, 23, 42, 0.06)" },
      },
      formatter: tooltipCardFormatterEng,
    },

    legend: { show: false },

    xAxis: [
      // NIVEL 1 (arriba): Author
      {
        type: "category",
        data: xAutorEng,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: REF_AXIS_LINE } },
        axisLabel: {
          interval: 0,
          rotate: xRotate90_Metrics,
          fontSize: xFont_Metrics,
          margin: xMargin_Metrics,
          color: REF_TICK_COLOR,
          fontWeight: 400,
          fontFamily: REF_FONT_FAMILY,
          align: "center",
          verticalAlign: "middle",
          lineHeight: 14,
          formatter: (value) => {
            if (!value) return "";
            const s = String(value);
            const parts = s.split("\n");
            const l1 = escapeHtml(parts[0] || "");
            const l2 = escapeHtml(parts[1] || "");
            if (l2) return `{l1|${l1}}\n{l2|${l2}}`;
            return `{l1|${l1}}`;
          },
          rich: {
            l1: {
              fontSize: xFont_Metrics,
              fontFamily: REF_FONT_FAMILY,
              fontWeight: 500,
              lineHeight: 14,
              color: REF_TICK_COLOR,
              align: "center",
            },
            l2: {
              fontSize: xFont_Metrics,
              fontFamily: REF_FONT_FAMILY,
              fontWeight: 500,
              lineHeight: 14,
              color: REF_TICK_COLOR,
              align: "center",
            },
          },
        },
      },

      // NIVEL 2 (abajo): Month (centrado por grupo)
      {
        type: "category",
        data: xMesEng,
        position: "bottom",
        offset: xMonthOffset_Metrics, // igual que BookGraphs
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          show: true,
          interval: 0,
          rotate: 0,
          fontSize: 15,
          margin: xMonthMargin_Metrics,
          color: REF_TICK_COLOR,
          fontWeight: 800,
          fontFamily: REF_FONT_FAMILY,
          formatter: () => "",
        },
      },
    ],

    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: REF_Y_TICK_COLOR,
        fontSize: REF_FONT_SIZE,
        fontFamily: REF_FONT_FAMILY,
        fontWeight: 400,
        formatter: (v) => `${Number(v).toLocaleString()}%`,
      },
      splitLine: { lineStyle: { color: REF_GRID_LINE, type: "solid" } },
    },

    series: [
      {
        name: "Engagement Rate (%)",
        type: "bar",
        data: engValues,
        barCategoryGap: "0%",
        barWidth: manyAuthorMetrics ? "65%" : "80%",

        itemStyle: {
          borderRadius: [10, 10, 10, 10],
          color: (p) => {
            const rec = registrosEngConGaps[p.dataIndex];
            if (!rec || rec.__gap || rec.__pad) return "transparent";
            return colorByAuthorMetrics(rec.autora);
          },
        },

        label: {
          show: true,
          position: "inside",
          color: "black",
          fontWeight: 700,
          fontSize: manyAuthorMetrics ? 10 : 12,
          formatter: (p) => {
            const v = p?.value;
            if (v == null) return "";
            const n = Number(v);
            if (!Number.isFinite(n) || n === 0) return "";
            return `${Math.round(n.toFixed(0)).toLocaleString()}%`;
          },
        },
      },
    ],
  };

  const autorasEff = Array.from(new Set(registrosEff.map((r) => r.autora)));

  const datosEffPosts = registrosEff
    .reduce((acc, r) => {
      let fila = acc.find((x) => x.mes === r.mes);
      if (!fila) {
        fila = { mes: r.mes };
        acc.push(fila);
      }
      fila[r.autora] = r.realPosts;
      return acc;
    }, [])
    .sort((a, b) => {
      const ka = monthSortKey(a.mes);
      const kb = monthSortKey(b.mes);
      if (Number.isFinite(ka) && Number.isFinite(kb) && ka !== kb)
        return ka - kb;
      // fallback si algo raro vino
      return String(a.mes ?? "").localeCompare(String(b.mes ?? ""));
    });
  const manyMonthsEff = (datosEffPosts?.length || 0) >= 11;

  const colorMapEff = React.useMemo(() => {
    const shuffled = [...AUTHOR_COLORS].sort(() => Math.random() - 0.5);
    const map = {};
    autorasEff.forEach((a, i) => {
      map[a] = shuffled[i % shuffled.length];
    });
    return map;
  }, [autorasEff.join("|"), colorRunId]);

  const colorByAuthorEff = (autor) => colorMapEff[autor] || "#1F4E79";

  // (ajusta left si tus números son grandes y se cortan)
  const gridMain = {
    top: 24,
    bottom: gridBottom_Main,
    left: 46, // <- fijo (clave). Si se corta, sube a 80-90
    right: 14,
    containLabel: false,
  };

  const gridMainEng = {
    top: 24,
    bottom: gridBottom_MainEng,
    left: 46, // <- fijo (clave). Si se corta, sube a 80-90
    right: 14,
    containLabel: false,
  };

  const optionMainVI = {
    textStyle: { fontFamily: REF_FONT_FAMILY, fontSize: REF_FONT_SIZE },
    animation: true,
    grid: gridMain,

    tooltip: {
      trigger: "axis",
      confine: true,
      appendToBody: true,
      backgroundColor: "transparent",
      borderWidth: 0,
      padding: 0,
      axisPointer: {
        type: "shadow",
        shadowStyle: { color: "rgba(15, 23, 42, 0.06)" },
      },
      formatter: tooltipCardFormatterMainVI,
    },

    legend: { show: false },

    xAxis: {
      type: "category",
      data: xAutorMainPadded,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: REF_AXIS_LINE } },
      axisLabel: {
        interval: 0,
        rotate: xRotate90_Main,
        fontSize: xFont_Main,
        margin: xMargin_Main,
        color: REF_TICK_COLOR,
        fontWeight: 500,
        fontFamily: REF_FONT_FAMILY,

        // ✅ Centrado real cuando rota 90°
        align: "center",
        verticalAlign: "middle",
        lineHeight: manyAuthorMain ? 12 : 14,

        // ✅ fuerza a ECharts a respetar el salto de línea y centrar cada línea
        formatter: (v) => {
          if (!v) return "";
          const lines = String(v).split("\n");
          return lines.map((t) => `{t|${t}}`).join("\n");
        },
        rich: {
          t: {
            align: "center",
            verticalAlign: "middle",
            lineHeight: manyAuthorMain ? 12 : 14,
            fontFamily: REF_FONT_FAMILY,
            fontWeight: 500,
            fontSize: xFont_Main,
            color: REF_TICK_COLOR,
          },
        },
      },
    },

    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: REF_Y_TICK_COLOR,
        fontSize: REF_FONT_SIZE,
        fontFamily: REF_FONT_FAMILY,
        fontWeight: 400,
        formatter: (v) => Number(v).toLocaleString(),
      },
      splitLine: { lineStyle: { color: REF_GRID_LINE, type: "solid" } },
    },

    series: [
      {
        name: "Views",
        type: "bar",
        data: mainViewsPadded,
        barWidth: manyAuthorMain ? 28 : 38,
        barGap: "0%",
        barCategoryGap: "0%",
        itemStyle: {
          borderRadius: [10, 10, 10, 10],
          color: (p) => {
            const rec = mainItemsPadded[p.dataIndex];
            if (!rec || rec.__pad) return "transparent";
            return colorByAuthorMetrics(rec.autora);
          },
        },
        label: {
          show: true,
          position: "inside",
          color: "black",
          fontWeight: 700,
          fontSize: manyAuthorMain ? 10 : 12,
          formatter: (p) => {
            const v = p?.value;
            if (v == null) return "";
            const n = Number(v);
            if (!Number.isFinite(n) || n === 0) return "";
            return `${Math.round(n).toLocaleString()}`;
          },
        },
      },
      {
        name: "Interactions",
        type: "bar",
        data: mainInteractionsPadded,
        barWidth: manyAuthorMain ? 28 : 38,
        barGap: "0%",
        barCategoryGap: "0%",
        itemStyle: {
          borderRadius: [10, 10, 10, 10],
          color: (p) => {
            const rec = mainItemsPadded[p.dataIndex];
            if (!rec || rec.__pad) return "transparent";
            const base = colorByAuthorMetrics(rec.autora);
            return hexToRgba(base, 0.35);
          },
        },
        label: {
          show: true,
          position: "top",
          color: "black",
          fontWeight: 700,
          fontSize: manyAuthorMain ? 10 : 12,
          offset: [0, -5],
          formatter: (p) => {
            const v = p?.value;
            if (v == null) return "";
            const n = Number(v);
            if (!Number.isFinite(n) || n === 0) return "";
            return `${Math.round(n).toLocaleString()}`;
          },
        },
      },
    ],
  };

  const optionMainEng = {
    textStyle: { fontFamily: REF_FONT_FAMILY, fontSize: REF_FONT_SIZE },
    animation: true,
    grid: gridMainEng,

    tooltip: {
      trigger: "axis",
      confine: true,
      appendToBody: true,
      backgroundColor: "transparent",
      borderWidth: 0,
      padding: 0,
      axisPointer: {
        type: "shadow",
        shadowStyle: { color: "rgba(15, 23, 42, 0.06)" },
      },
      formatter: tooltipCardFormatterMainEng,
    },

    legend: { show: false },

    xAxis: {
      type: "category",
      data: xAutorMainPadded,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: REF_AXIS_LINE } },
      axisLabel: {
        interval: 0,
        rotate: xRotate90_MainEng,
        fontSize: xFont_MainEng,
        margin: xMargin_MainEng,
        color: REF_TICK_COLOR,
        fontWeight: 500,
        fontFamily: REF_FONT_FAMILY,
        // ✅ Centrado real cuando rota 90°
        align: "center",
        verticalAlign: "middle",
        lineHeight: manyAuthorMainEng ? 12 : 14,
        formatter: (v) => {
          if (!v) return "";
          const lines = String(v).split("\n");
          return lines.map((t) => `{t|${t}}`).join("\n");
        },

        rich: {
          t: {
            align: "center",
            verticalAlign: "middle",
            lineHeight: manyAuthorMainEng ? 12 : 14,
            fontFamily: REF_FONT_FAMILY,
            fontWeight: 500,
            fontSize: xFont_MainEng,
            color: REF_TICK_COLOR,
          },
        },
      },
    },

    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },

      axisLabel: {
        color: REF_Y_TICK_COLOR,
        fontSize: REF_FONT_SIZE,
        fontFamily: REF_FONT_FAMILY,
        fontWeight: 400,
        formatter: (v) => `${Number(v).toLocaleString()}%`,
      },
      splitLine: { lineStyle: { color: REF_GRID_LINE, type: "solid" } },
    },

    series: [
      {
        name: "Engagement (%)",
        type: "bar",
        data: mainEngagementPadded,
        barCategoryGap: "0%",
        barWidth: manyAuthorMainEng ? "65%" : "80%",
        itemStyle: {
          borderRadius: [10, 10, 10, 10],
          color: (p) => {
            const rec = mainItemsPadded[p.dataIndex];
            if (!rec || rec.__pad) return "transparent";
            return colorByAuthorMetrics(rec.autora);
          },
        },

        label: {
          show: true,
          position: "inside",
          color: "black",
          fontWeight: 700,
          fontSize: 12,
          formatter: (p) => {
            const v = p?.value;
            if (v == null) return "";
            const n = Number(v);
            if (!Number.isFinite(n) || n === 0) return "";
            return `${Math.round(n.toFixed(0)).toLocaleString()}%`;
          },
        },
      },
    ],
  };

  // =========================
  // MAIN Graph 3 (ECharts) — Number of Views per Posted Day per Author
  // (MISMA DATA: transformedData + autores desde records[1])
  // =========================

  // Autores del time series (idéntico a tu lógica actual: vienen de records[1].nbrautora)
  const autoresDaily = useMemo(() => {
    const arr = Array.isArray(records?.[1]) ? records[1] : [];
    return Array.from(
      new Set(
        arr.map((x) => String(x?.nbrautora ?? "").trim()).filter(Boolean),
      ),
    );
  }, [records]);

  // Colores "random pero estables" por corrida (estilo, no lógica)
  const colorMapDaily = useMemo(() => {
    const shuffled = [...METRIC_COLORS].sort(() => Math.random() - 0.5);
    const map = {};
    autoresDaily.forEach((a, i) => {
      map[a] = shuffled[i % shuffled.length];
    });
    return map;
  }, [autoresDaily.join("|"), colorRunId]);

  const colorByAuthorDaily = (autor) =>
    colorMapDaily[autor] || METRIC_COLORS[0];

  // X axis (fechas) — MISMO campo que antes: fecpublicacion
  const xDaily = useMemo(() => {
    return (Array.isArray(transformedData) ? transformedData : []).map((d) =>
      String(d?.fecpublicacion ?? ""),
    );
  }, [transformedData]);

  // Mantén tu misma lógica del Y max (lo que hacías con max + 4000)
  const yMaxDaily = useMemo(() => {
    const rows = Array.isArray(transformedData) ? transformedData : [];
    if (!rows.length) return 0;

    let maxY = 0;
    for (const row of rows) {
      for (const k of Object.keys(row || {})) {
        if (k === "fecpublicacion") continue;
        const v = row?.[k];
        if (typeof v === "number" && Number.isFinite(v)) {
          if (v > maxY) maxY = v;
        }
      }
    }

    const adjusted = Math.ceil((maxY + 4000) / 100) * 100;
    return Number.isFinite(adjusted) ? adjusted : 0;
  }, [transformedData]);

  // Tooltip card (similar a tus tooltips ECharts actuales, estilo “card”)
  const tooltipCardFormatterDaily = (params) => {
    const raw = Array.isArray(params) ? params : [params];
    const items = raw.filter((p) => p && p.value != null);

    if (!items.length) return "";

    const dateLabel = escapeHtml(
      String(items[0]?.axisValueLabel ?? items[0]?.axisValue ?? ""),
    );

    const rows = items
      .map((p) => {
        const name = escapeHtml(p?.seriesName ?? "");
        const n = Number(p?.value ?? 0);
        const value = (Number.isFinite(n) ? Math.round(n) : 0).toLocaleString();

        return `
        <div style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding:6px 12px;
        ">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="
              width:8px;height:8px;border-radius:2px;
              background:${p.color};
              display:inline-block;
            "></span>
            <span style="
              font-size:13px;
              color:#64748b;
              line-height:16px;
              white-space:nowrap;
            ">${name}</span>
          </div>
          <span style="
            font-size:14px;
            color:#0f172a;
            font-weight:700;
            line-height:16px;
            white-space:nowrap;
            margin-left:24px;
          ">${value}</span>
        </div>
      `;
      })
      .join("");

    return `
    <div style="
      display:inline-block;
      background:#fff;
      border:1px solid #e5e7eb;
      border-radius:10px;
      box-shadow:0 4px 12px rgba(0,0,0,0.10);
      overflow:hidden;
      min-width:210px;
      font-family:${REF_FONT_FAMILY};
    ">
      <div style="
        padding:8px 12px;
        font-size:13px;
        color:#0f172a;
        font-weight:700;
        line-height:16px;
        border-bottom:1px solid #f1f5f9;
      ">${dateLabel}</div>
      <div>${rows}</div>
    </div>
  `;
  };

  // ✅ Selección de autores (filtrado por leyenda)
  const [dailySelectedAuthors, setDailySelectedAuthors] = useState([]);

  const toggleDailyAuthor = useCallback((name) => {
    setDailySelectedAuthors((prev) => {
      if (prev.includes(name)) return prev.filter((x) => x !== name);
      return [...prev, name];
    });
  }, []);

  const dailySelectedSet = useMemo(
    () => new Set(dailySelectedAuthors),
    [dailySelectedAuthors],
  );

  const optionMainDailyViews = {
    textStyle: { fontFamily: REF_FONT_FAMILY, fontSize: REF_FONT_SIZE },
    animation: true,

    // Deja espacio arriba para la leyenda (como en tu imagen)
    grid: { top: 24, bottom: 56, left: 46, right: 24, containLabel: false },

    tooltip: {
      trigger: "axis",
      confine: true,
      appendToBody: true,
      backgroundColor: "transparent",
      borderWidth: 0,
      padding: 0,
      axisPointer: {
        type: "line",
        lineStyle: { color: "#94a3b8", width: 1 },
      },
      formatter: tooltipCardFormatterDaily,
    },

    // Leyenda arriba (como la imagen)
    legend: { show: false },

    xAxis: {
      type: "category",
      data: xDaily,
      boundaryGap: false,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: REF_AXIS_LINE } },
      axisLabel: {
        interval: 0,
        rotate: (transformedData?.length || 0) >= 13 ? -30 : 0,
        margin: (transformedData?.length || 0) >= 13 ? 16 : 10,
        color: REF_TICK_COLOR,
        fontFamily: REF_FONT_FAMILY,
        fontSize: REF_FONT_SIZE,
        fontWeight: 400,
      },
      splitLine: { show: false },
    },

    yAxis: {
      type: "value",
      min: 0,
      max: yMaxDaily || undefined,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: REF_Y_TICK_COLOR,
        fontSize: REF_FONT_SIZE,
        fontFamily: REF_FONT_FAMILY,
        fontWeight: 400,
        formatter: (v) => Number(v).toLocaleString(),
      },
      splitLine: { lineStyle: { color: REF_GRID_LINE, type: "solid" } },
    },

    series: (dailySelectedAuthors.length > 0
      ? autoresDaily.filter((a) => dailySelectedSet.has(a))
      : autoresDaily
    ).map((author) => ({
      name: author,
      type: "line",
      data: (Array.isArray(transformedData) ? transformedData : []).map(
        (row) => row?.[author] ?? null,
      ),
      connectNulls: true,

      smooth: false,
      showSymbol: false,
      symbol: "circle",
      symbolSize: 6,
      lineStyle: { width: 2.5 },
      itemStyle: { color: colorByAuthorDaily(author) },

      emphasis: {
        focus: "series",
        showSymbol: true,
        symbolSize: 8,
      },
    })),
  };

  const graph1Ref = useRef(null);
  const graph2Ref = useRef(null);
  const graph3Ref = useRef(null);
  const graph4Ref = useRef(null);
  const graph5Ref = useRef(null);
  const graph7Ref = useRef(null);

  const handleDownloadGraph = (graphRef, fileName) => {
    if (!graphRef.current) {
      notify("Action required", "No graph found to download.", "warning");
      return;
    }

    setTimeout(() => {
      const now = new Date();

      html2canvas(graphRef.current, {
        backgroundColor: "white",
        scale: 3,
        useCORS: true,
        logging: true,
        // IMPORTANTE: no fuerces windowWidth/windowHeight * 3
      }).then((canvas) => {
        const timestamp = `${now.getFullYear()}-${String(
          now.getMonth() + 1,
        ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(
          now.getHours(),
        ).padStart(2, "0")}-${String(now.getMinutes()).padStart(
          2,
          "0",
        )}-${String(now.getSeconds()).padStart(2, "0")}`;

        const finalName = `${fileName}_${timestamp}`;

        canvas.toBlob((blob) => {
          if (!blob) {
            notify(
              "Download failed",
              "Failed to generate image blob.",
              "error",
            );
            return;
          }

          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${finalName}.png`;

          // Recomendado: agregarlo al DOM para compatibilidad
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Liberar memoria
          URL.revokeObjectURL(url);
        }, "image/png");
      });
    }, 500);
  };

  // ====== (tus handlers originales, sin cambios) ======
  // handleGetDataFromDB, handleMetricsPerMonth, handleEffectivenessPerMonth...
  // (los dejo tal cual abajo; solo se cambian estilos en el return)

  const handleGetDataFromDB = async () => {
    if (!dateFrom || !dateTo || !authors) {
      notify("Action required", "You must fill all the fields.", "warning");
      return;
    }

    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);

    if (fromDate > toDate) {
      notify(
        "Action required",
        "The 'From' Posted Date must be earlier than the 'To' Posted Date.",
        "warning",
      );
      return;
    }

    setRecords([]);
    setIsLoading(true);
    setDataLoaded(false);
    setTextButtom("Generating Graphs...");
    setLog([]);
    setCurrentGraphType("main");

    try {
      const startTime = new Date();

      const formattedAuthors = authors
        .split(",")
        .map((pa) => pa.trim().toUpperCase())
        .filter((u) => u !== "");

      const azureURL = import.meta.env.VITE_AZURE_API_URL;
      if (!jwt) {
        notify(
          "Session not ready",
          "Token not available yet. Please refresh.",
          "warning",
        );
        return;
      }
      const response = await fetch(azureURL + "/authorsgraphs/getdata", {
        method: "POST",
        headers: authHeadersJson,
        mode: "cors",
        body: JSON.stringify({
          dateFrom: dateFrom,
          dateTo: dateTo,
          Author: formattedAuthors,
        }),
      });

      if (!response.ok) {
        console.error(
          `🚨 Server responded with status (AuthorGraphs - handleGetDataFromDB) ${response.status}`,
        );
        throw new Error(
          `🚨 An error occurred while fetching the data (AuthorGraphs - handleGetDataFromDB) ${response.status}`,
        );
      }

      const data = await response.json();
      const arr0 = Array.isArray(data?.[0]) ? data[0] : [];
      const arr1 = Array.isArray(data?.[1]) ? data[1] : [];

      const hasUsableMainData =
        hasAnyNonNullValue(arr0, [
          "promnumviews",
          "prominteraction",
          "promnumengagement",
          "promnumlikes",
          "promnumsav",
          "promnumcomments",
          "promnumshares",
        ]) || hasAnyNonNullValue(arr1, ["sumnumviews"]);

      const NotFoundAuthors = formattedAuthors.filter((u) => {
        return !data[0].some((dic) => dic && u == dic["codautora"]);
      });

      /*console.log("API Response (AuthorGraphs - handleGetDataFromDB): ", data);
      console.log(
        "Not found Authors Code (AuthorGraphs - handleGetDataFromDB): " +
          NotFoundAuthors
      );*/

      setLog((prevLog) => [
        ...prevLog,
        `🧠 Retrieving "Author's metrics - Selected Date Range"`,
      ]);

      if (hasUsableMainData > 0) {
        if (isAdmin) {
          setLog((prev) => [
            ...prev,
            `Execution completed successfully - Graphs are ready to be downloaded now - Records found: ${data[0].length}`,
          ]);
        } else {
          setLog((prev) => [
            ...prev,
            `Execution completed - Records found: ${data[0].length}`,
          ]);
        }
      } else {
        if (isAdmin) {
          setLog((prev) => [
            ...prev,
            `❌ Total author metrics could not be generated because no records matched the selected filters`,
          ]);
        } else {
          setLog((prev) => [
            ...prev,
            `❌ Total metrics by selected filters: execution not completed. Records found: 0 - No data available.`,
          ]);
        }
      }

      const endTime = new Date();
      const durationInSeconds = Math.floor((endTime - startTime) / 1000);
      const minutes = Math.floor(durationInSeconds / 60);
      const seconds = durationInSeconds % 60;
      const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

      setLog((prevLog) => [
        ...prevLog,
        `⏳ Total function execution time: ${formattedTime} minutes`,
      ]);

      setRecords(hasUsableMainData ? data : [[], []]);
      setDataLoaded(true);
    } catch (error) {
      console.error(
        "❌ Error extracting information from DB (AuthorGraphs - handleGetDataFromDB): ",
        error,
      );
      notify(
        "Request failed",
        "An error occurred while generating the graphs.",
        "error",
      );
    } finally {
      setIsLoading(false);
      setTextButtom("Generate Graphs");
    }
  };

  const handleMetricsPerMonth = async () => {
    if (!dateFrom || !dateTo || !authors) {
      notify("Action required", "You must fill all the fields.", "warning");
      return;
    }

    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);

    if (fromDate > toDate) {
      notify(
        "Action required",
        "The 'From' Posted Date must be earlier than the 'To' Posted Date.",
        "warning",
      );
      return;
    }

    setRecords([]);
    setIsLoading(true);
    setDataLoaded(false);
    setTextButtomMetrics("Generating Metrics...");
    setLog([]);
    setCurrentGraphType("metrics");

    try {
      const startTime = new Date();

      const formattedAuthors = authors
        .split(",")
        .map((pa) => pa.trim().toUpperCase())
        .filter((u) => u !== "");

      const azureURL = import.meta.env.VITE_AZURE_API_URL;
      if (!jwt) {
        notify(
          "Session not ready",
          "Token not available yet. Please refresh.",
          "warning",
        );
        return;
      }
      const response = await fetch(azureURL + "/authorsgraphs/dataPerMonth", {
        method: "POST",
        headers: authHeadersJson,
        mode: "cors",
        body: JSON.stringify({
          dateFrom: dateFrom,
          dateTo: dateTo,
          Author: formattedAuthors,
        }),
      });

      if (!response.ok) {
        console.error(
          `🚨 Server responded with status (Metrics per Month) ${response.status}`,
        );
        throw new Error(
          `🚨 An error occurred while fetching metrics per month ${response.status}`,
        );
      }

      setLog((prevLog) => [
        ...prevLog,
        `🧠 Retrieving "Author's metrics per Month"...`,
      ]);

      const data = await response.json();

      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : [];

      if (rows.length > 0) {
        if (isAdmin) {
          setLog((prev) => [
            ...prev,
            `Execution completed successfully - Graphs are ready to be downloaded now - Records found: ${rows.length}`,
          ]);
        } else {
          setLog((prev) => [
            ...prev,
            `Execution completed - Records found: ${rows.length}`,
          ]);
        }
      } else {
        if (isAdmin) {
          setLog((prev) => [
            ...prev,
            `❌ Author's metrics per month was not generated because no records matched the selected filters`,
          ]);
        } else {
          setLog((prev) => [
            ...prev,
            `❌ Author's metrics per month execution not completed. Records found: 0 - No data available.`,
          ]);
        }
      }

      const endTime = new Date();
      const durationInSeconds = Math.floor((endTime - startTime) / 1000);
      const minutes = Math.floor(durationInSeconds / 60);
      const seconds = durationInSeconds % 60;
      const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

      setLog((prevLog) => [
        ...prevLog,
        `⏳ Total metrics execution time: ${formattedTime} minutes`,
      ]);

      setRecords([rows]);
      setDataLoaded(true);
      setColorRunId((x) => x + 1);
    } catch (error) {
      console.error("❌ Error extracting metrics per month from DB: ", error);
      notify(
        "Request failed",
        "An error occurred while generating the metrics per month.",
        "error",
      );
    } finally {
      setIsLoading(false);
      setTextButtomMetrics("Metrics per Month");
    }
  };

  const handleEffectivenessPerMonth = async () => {
    if (!dateFrom || !dateTo || !authors) {
      notify("Action required", "You must fill all the fields.", "warning");
      return;
    }

    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);

    if (fromDate > toDate) {
      notify(
        "Action required",
        "The 'From' Posted Date must be earlier than the 'To' Posted Date.",
        "warning",
      );
      return;
    }

    setRecords([]);
    setIsLoading(true);
    setDataLoaded(false);
    setTextButtomEffectiveness("Generating Total posts...");
    setLog([]);
    setCurrentGraphType("effectiveness");

    try {
      const startTime = new Date();

      const formattedAuthors = authors
        .split(",")
        .map((pa) => pa.trim().toUpperCase())
        .filter((u) => u !== "");

      const azureURL = import.meta.env.VITE_AZURE_API_URL;
      if (!jwt) {
        notify(
          "Session not ready",
          "Token not available yet. Please refresh.",
          "warning",
        );
        return;
      }
      const response = await fetch(
        azureURL + "/authorsgraphs/effectivenessAuthorPerMonth",
        {
          method: "POST",
          headers: authHeadersJson,
          mode: "cors",
          body: JSON.stringify({
            dateFrom: dateFrom,
            dateTo: dateTo,
            Author: formattedAuthors,
          }),
        },
      );

      if (!response.ok) {
        console.error(
          `🚨 Server responded with status (Total posts per Month) ${response.status}`,
        );
        throw new Error(
          `🚨 An error occurred while fetching Total posts per Month ${response.status}`,
        );
      }

      setLog((prevLog) => [
        ...prevLog,
        `🧠 Retrieving "Total posts per month"...`,
      ]);

      const data = await response.json();

      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : [];

      if (rows.length > 0) {
        if (isAdmin) {
          setLog((prev) => [
            ...prev,
            `Execution completed successfully - Graphs are ready to be downloaded now - Records found: ${rows.length}`,
          ]);
        } else {
          setLog((prev) => [
            ...prev,
            `Execution completed - Records found: ${rows.length}`,
          ]);
        }
      } else {
        if (isAdmin) {
          setLog((prev) => [
            ...prev,
            `❌ Total posts per month was not generated because no records matched the selected filters`,
          ]);
        } else {
          setLog((prev) => [
            ...prev,
            `❌ Total posts per month execution not completed. Records found: 0 - No data available.`,
          ]);
        }
      }

      const endTime = new Date();
      const durationInSeconds = Math.floor((endTime - startTime) / 1000);
      const minutes = Math.floor(durationInSeconds / 60);
      const seconds = durationInSeconds % 60;
      const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

      setLog((prevLog) => [
        ...prevLog,
        `⏳ Total posts per Month execution time: ${formattedTime} minutes`,
      ]);

      setRecords([rows]);
      setDataLoaded(true);
      setColorRunId((x) => x + 1);
    } catch (error) {
      console.error(
        "❌ Error extracting Total posts per Month from DB: ",
        error,
      );
      notify(
        "Request failed",
        "An error occurred while generating the Total posts per Month.",
        "error",
      );
    } finally {
      setIsLoading(false);
      setTextButtomEffectiveness("Total posts per Month");
    }
  };

  const handleClearCache = () => {
    try {
      localStorage.removeItem(LS_FILTERS_KEY);
      localStorage.removeItem(LS_RESULT_KEY);
    } catch {
      // no-op
    }

    // Reset UI state to initial
    setDateFrom("");
    setDateTo("");
    setAuthors("");
    setAuthorCodeSelected([]);
    setAuthorCodeDropdownOpen(false);
    setRecords([]);
    setLog([]);
    setDataLoaded(false);
    setIsLoading(false);
    setTextButtom("Generate Graphs");
    setTextButtomMetrics("Metrics per Month");
    setTextButtomEffectiveness("Total posts per Month");
    setCurrentGraphType("");
  };

  // =========================
  // UI tokens — copied from PaGraphs (style only)
  // =========================
  const inputField =
    "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200";
  const inputDate = inputField;
  const textareaField =
    "mt-0.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200 font-mono uppercase";

  const inputFieldNoAdmin =
    "mt-0.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200";
  const btnPrimary =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-slate-900/10 transition hover:bg-slate-800 active:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-50";

  const btnDownload =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white " +
    "shadow-sm ring-1 ring-slate-900/10 transition " +
    "hover:bg-slate-800 active:bg-slate-950 " +
    "focus:outline-none focus:ring-4 focus:ring-slate-200";

  const btnClear =
    "relative inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white " +
    "shadow-sm transition " +
    "focus:outline-none focus:ring-4 focus:ring-rose-200 " +
    "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 " +
    "ring-1 ring-rose-600/20";
  const btnClearSm = btnClear
    .replace("px-6 py-3", "px-4 py-2")
    .replace("text-sm", "text-xs");

  // Status pill (idéntico a BookGraphs)
  const statusLabel = isLoading
    ? "Loading"
    : dataLoaded
      ? "Ready"
      : "Not initialized";

  const statusPillClass = isLoading
    ? "border-red-200 bg-red-50 text-red-700"
    : dataLoaded
      ? "border-slate-900/10 bg-slate-900 text-white"
      : "border-slate-200 bg-white text-slate-600";

  const statusDotClass = isLoading
    ? "bg-red-500"
    : dataLoaded
      ? "bg-white/80"
      : "bg-slate-400";

  const stripLeadingLogEmoji = (s = "") =>
    s.replace(/^(\s*(?:✅|❌|⚠️|⏳|📊|📡|🔎|🧠)\s*)+/, "").trim();

  const hasMainRenderableData =
    currentGraphType === "main" &&
    (hasAnyNonNullValue(records?.[0], [
      "promnumviews",
      "prominteraction",
      "promnumengagement",
      "promnumlikes",
      "promnumsav",
      "promnumcomments",
      "promnumshares",
    ]) ||
      hasAnyNonNullValue(records?.[1], ["sumnumviews"]));

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed right-5 top-5 z-50 w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-slate-900">{toast.title}</p>
              <p className="mt-1 text-xs text-slate-600">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
          <div className={`h-1 w-full ${toastBarClass}`} />
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* overlay */}
          <div
            className="absolute inset-0 bg-gradient-to-b from-slate-900/10 via-slate-900/20 to-slate-900/10 backdrop-blur-[2px]"
            onClick={closeConfirm}
          />

          {/* dialog */}
          <div className="relative w-[380px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-950 via-slate-800 to-slate-600" />

            <div className="p-6 text-center">
              {/* Icono arriba (según danger o normal) */}
              <div
                className={
                  confirmOpen.danger
                    ? "mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200"
                    : "mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/5 text-slate-900 ring-1 ring-slate-200"
                }
              >
                {confirmOpen.danger ? (
                  /* warning icon */
                  <svg
                    className="h-6 w-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v4m0 4h.01M10.3 3.6l-8.6 15A2 2 0 0 0 3.4 21h17.2a2 2 0 0 0 1.7-2.4l-8.6-15a2 2 0 0 0-3.4 0z"
                    />
                  </svg>
                ) : (
                  /* check icon */
                  <svg
                    className="h-6 w-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M20 6L9 17l-5-5"
                    />
                  </svg>
                )}
              </div>

              <p className="text-[16px] font-semibold tracking-tight text-slate-900">
                {confirmOpen.title}
              </p>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {confirmOpen.message}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={closeConfirm}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={runConfirm}
                  className={
                    confirmOpen.danger
                      ? "inline-flex items-center justify-center rounded-xl bg-rose-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm ring-1 ring-rose-500/20 hover:bg-rose-600 active:bg-rose-700"
                      : "inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white shadow-sm ring-1 ring-slate-900/10 hover:bg-slate-800 active:bg-slate-950"
                  }
                >
                  {confirmOpen.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top grid: Filters + Monitor (copied from PaGraphs style) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-stretch">
        {/* Left: Filters */}
        <section
          className={`relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur-sm lg:col-span-8 self-stretch flex flex-col ${
            authorCodeDropdownOpen ? "z-40" : "z-0"
          }`}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-950 via-slate-800 to-slate-600" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* tu icon + title + subtitle tal cual */}
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-950 to-slate-700 shadow-sm">
                {/* tu svg tal cual */}
                <svg
                  className="h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Author Graphs
                </h2>
                <p className="text-xs text-slate-500">
                  Configure filters and generate charts
                </p>
              </div>
            </div>

            {/* Reset arriba (reemplaza el pill) */}
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${statusPillClass}`}
              title="Request status"
            >
              <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
              {statusLabel}
            </span>
          </div>
          <div className="mt-3 flex-1 flex">
            <div className="w-full rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-3 shadow-sm flex flex-col">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                {/* Date Range */}
                <div
                  className={`lg:col-span-5 rounded-2xl border border-slate-200 bg-white/70 shadow-sm ${
                    isAdmin ? "pt-3.5 px-3 pb-1" : "p-3"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Post Date (From - To)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Select a complete date range
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className={`${
                          isAdmin ? inputDate : inputFieldNoAdmin
                        } ${isAdmin ? "h-11 py-2" : ""}`}
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className={`${
                          isAdmin ? inputDate : inputFieldNoAdmin
                        } ${isAdmin ? "h-11 py-2" : ""}`}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Author Codes */}
                <div className="lg:col-span-7 relative  rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 7h10M7 11h10M7 15h6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {isAdmin ? "Author Codes" : "Author Names"}
                      </h3>
                      <p className="text-xs text-slate-500 truncate">
                        {isAdmin
                          ? "Comma-separated author codes"
                          : "Select one or more authors using the checkboxes"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2">
                    {isAdmin ? (
                      <textarea
                        value={authors}
                        onChange={(e) => setAuthors(e.target.value)}
                        placeholder="AUTHOR01, AUTHOR02, AUTHOR03"
                        className={`${textareaField} mt-0 ${
                          isAdmin ? "h-12 py-2" : "h-24 py-2"
                        }`}
                        required
                      />
                    ) : (
                      <div
                        ref={authorCodePopoverRef}
                        className="relative z-[80]"
                      >
                        <button
                          ref={authorCodeButtonRef}
                          type="button"
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm
focus:outline-none focus:ring-2 focus:ring-indigo-200 flex items-center justify-between mt-0"
                          onClick={() => {
                            setAuthorCodeDropdownOpen((v) => !v);
                          }}
                          disabled={!authorCodeOptions.length}
                          title={
                            isAdmin
                              ? "Enter author codes"
                              : "Select author names"
                          }
                        >
                          <span className="truncate">
                            {authorCodeOptions.length === 0
                              ? "No authors assigned"
                              : authorCodeSelected.length === 0
                                ? "Select authors"
                                : (() => {
                                    const n = authorCodeSelected.length;
                                    const top = authorCodeSelected
                                      .slice(0, 1)
                                      .map((c) => authorNameByCode[c] ?? c)
                                      .join(", ");
                                    return n <= 1
                                      ? `${n} selected: ${top}`
                                      : `${n} selected: ${top}, +${n - 1} more`;
                                  })()}
                          </span>

                          <svg
                            className={`h-4 w-4 text-slate-500 transition ${
                              authorCodeDropdownOpen ? "rotate-180" : ""
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>

                        {authorCodeDropdownOpen &&
                          authorCodeOptions.length > 0 &&
                          createPortal(
                            <div
                              ref={authorCodeDropdownRef}
                              style={{
                                position: "fixed",
                                top: authorDropdownPos.top,
                                left: authorDropdownPos.left,
                                width: authorDropdownPos.width,
                              }}
                              className="z-[9999] rounded-lg border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5"
                            >
                              {/* Header fino */}
                              <div className="flex items-center px-2 py-2 border-b border-slate-200/60">
                                <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-900">
                                  {authorCodeSelected.length} selected
                                </span>
                                <div className="flex-1" />

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 whitespace-nowrap"
                                    onClick={() =>
                                      setAuthorCodeSelected(allAuthorCodes)
                                    }
                                  >
                                    Select all
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 whitespace-nowrap"
                                    onClick={() => setAuthorCodeSelected([])}
                                  >
                                    Clear
                                  </button>
                                </div>
                              </div>

                              {/* Lista compacta */}
                              <div className="max-h-52 overflow-auto px-2 py-1">
                                <div className="flex flex-col gap-1">
                                  {authorCodeOptions.map((a) => {
                                    const code = String(
                                      a?.codautora ?? "",
                                    ).trim();
                                    if (!code) return null;

                                    const label =
                                      String(a?.nombre_completo ?? "").trim() ||
                                      code;
                                    const checked =
                                      authorCodeSelected.includes(code);

                                    return (
                                      <label
                                        key={code}
                                        className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50"
                                      >
                                        <input
                                          type="checkbox"
                                          className="h-3.5 w-3.5 shrink-0 rounded border-slate-300"
                                          checked={checked}
                                          onChange={(e) => {
                                            const isChecked = e.target.checked;
                                            setAuthorCodeSelected((prev) => {
                                              if (isChecked)
                                                return Array.from(
                                                  new Set([...prev, code]),
                                                );
                                              return prev.filter(
                                                (x) => x !== code,
                                              );
                                            });
                                          }}
                                        />
                                        <span className="min-w-0 flex-1 truncate text-[12px] leading-4 font-medium text-slate-700">
                                          {label}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>,
                            document.body,
                          )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 border-t border-slate-200 pt-3">
                <div className="relative flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    className={`${btnPrimary} px-3 min-w-[180px]`}
                    onClick={() => {
                      playSound();
                      openConfirm({
                        title: "Confirm Generate Graph",
                        message:
                          "This will generate the total posts per month report using the selected date range and author names",
                        confirmText: "Generate",
                        danger: false,
                        onConfirm: handleEffectivenessPerMonth,
                      });
                    }}
                    disabled={isLoading}
                  >
                    {textButtomEffectiveness}
                  </button>

                  <button
                    type="button"
                    className={`${btnPrimary} px-3 min-w-[170px]`}
                    onClick={() => {
                      playSound();
                      openConfirm({
                        title: "Confirm Generate Graph",
                        message:
                          "This will generate the graphs using the selected date range and author names",
                        confirmText: "Generate",
                        danger: false,
                        onConfirm: handleGetDataFromDB,
                      });
                    }}
                    disabled={isLoading}
                  >
                    {textButtom}
                  </button>

                  <button
                    type="button"
                    className={`${btnPrimary} px-3 min-w-[165px]`}
                    onClick={() => {
                      playSound();
                      openConfirm({
                        title: "Confirm Generate Graph",
                        message:
                          "This will generate the metrics per month report using the selected date range and author names",
                        confirmText: "Generate",
                        danger: false,
                        onConfirm: handleMetricsPerMonth,
                      });
                    }}
                    disabled={isLoading}
                  >
                    {textButtomMetrics}
                  </button>

                  {/* Reset (solo emoji) — a la derecha sin mover los 3 botones */}
                  <button
                    type="button"
                    className={`${btnClear} !px-4 lg:absolute lg:right-0 lg:top-1/2 lg:-translate-y-1/2`}
                    onClick={() => {
                      playSound();
                      openConfirm({
                        title: "Confirm Clear",
                        message:
                          "This will clear filters, logs, records, notifications, and cached data for this user.",
                        confirmText: "Clear",
                        danger: true,
                        onConfirm: handleClearCache,
                      });
                    }}
                    disabled={isLoading}
                    title="Clear cached filters and data"
                    aria-label="Reset data"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 6h18M8 6V4h8v2m-1 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right: Execution Monitor */}
        <aside className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm sm:p-6 lg:col-span-4">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-950 via-slate-800 to-slate-600" />

          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-950 to-slate-700 shadow-sm">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Execution Monitor
              </h3>
              <p className="text-xs text-slate-500">
                Logs and runtime status updates
              </p>
            </div>
          </div>

          <div className="flex-1 flex">
            {isLoading ? (
              <div className="flex w-full min-h-[160px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white/60 p-5 text-center shadow-sm">
                <div className="relative">
                  <div className="h-14 w-14 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />
                  <div className="absolute inset-0 m-auto h-6 w-6 rounded-full bg-red-600/15" />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-800">
                  Processing...
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Please keep this tab open until completion
                </p>
              </div>
            ) : !hydrated ? (
              // Mantiene altura estable y evita el placeholder "No logs yet" en el render intermedio
              <div className="w-full min-h-[160px]" />
            ) : !dataLoaded ? (
              <div className="flex w-full min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-white/70 to-slate-50/70 p-5 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                  <svg
                    className="h-6 w-6 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                </div>
                <h2 className="text-sm font-bold text-slate-900">
                  No logs yet
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Run the report to see execution messages
                </p>
              </div>
            ) : (
              <div className="w-full space-y-2 overflow-hidden rounded-2xl border border-slate-200 bg-white/60 p-4">
                {log.map((entry, index) => {
                  const cleanEntry = stripLeadingLogEmoji(entry);

                  const isSuccess = cleanEntry.includes("Execution completed");
                  const isError = entry.includes("❌");
                  const isWarn = entry.includes("⚠️");
                  const isTime = entry.includes("⏳");
                  const isRecords = entry.includes("📊");
                  const isRetrieving = /retrieving/i.test(cleanEntry);

                  const badgeClass = isSuccess
                    ? "bg-emerald-100 text-emerald-700"
                    : isError
                      ? "bg-red-100 text-red-700"
                      : isWarn
                        ? "bg-indigo-100 text-indigo-700"
                        : isTime || isRecords || isRetrieving
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-indigo-100 text-indigo-700";

                  const badgeChar = isSuccess
                    ? "✓"
                    : isError
                      ? "×"
                      : isWarn
                        ? "!"
                        : isTime
                          ? "⏳"
                          : isRecords
                            ? "📊"
                            : isRetrieving
                              ? "🧠"
                              : "i";

                  return (
                    <div
                      key={index}
                      className="flex items-start gap-2 rounded-xl border border-slate-200/70 bg-white/85 p-3 text-xs font-medium text-slate-700 shadow-sm"
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${badgeClass}`}
                      >
                        {badgeChar}
                      </span>
                      <span className="flex-1 leading-relaxed">
                        {cleanEntry}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Graphs */}
      <div className="space-y-6">
        {/* Metrics */}
        {!hydrated ? (
          <div className="space-y-6">
            {/* Placeholder card 1 (igual estructura que graph5Ref) */}
            <div className="relative z-0 overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-sm">
              <div className="border-b border-slate-200/60 bg-white px-6 py-4 grid grid-cols-3 items-center gap-4">
                <div />
                <div className="h-5 rounded bg-slate-100" />
                <div />
              </div>

              <div
                className={`bg-white overflow-x-auto ${
                  manyAuthorMetrics ? "px-6 pt-2 pb-4" : "px-6 pt-4 pb-1"
                }`}
              >
                <div style={{ minWidth: 900 }}>
                  <div
                    className="w-full rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-white/70 to-slate-50/70"
                    style={{ height: manyAuthorMetrics ? 270 : 240 }}
                  />
                </div>
              </div>
            </div>

            {/* Placeholder download button spacer (misma posición que tu botón) */}
            <div className="flex justify-center">
              <div className="h-10 w-40 rounded-xl bg-slate-100" />
            </div>

            {/* Placeholder card 2 (igual estructura que graph4Ref) */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-sm">
              <div className="border-b border-slate-200/60 bg-white px-6 py-4 flex items-center justify-between gap-4">
                <div />
                <div className="h-5 w-72 rounded bg-slate-100" />
                <div />
              </div>

              <div
                className={`bg-white overflow-x-auto ${
                  manyAuthorMetrics ? "px-6 pt-2 pb-4" : "px-6 pt-4 pb-1"
                }`}
              >
                <div style={{ minWidth: 900 }}>
                  <div
                    className="w-full rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-white/70 to-slate-50/70"
                    style={{ height: manyAuthorMetrics ? 270 : 240 }}
                  />
                </div>
              </div>
            </div>

            {/* Placeholder download button spacer 2 */}
            <div className="flex justify-center">
              <div className="h-10 w-40 rounded-xl bg-slate-100" />
            </div>
          </div>
        ) : currentGraphType === "metrics" &&
          records[0] &&
          ((Array.isArray(records[0]) && records[0].length > 0) ||
            (typeof records[0] === "object" && records[0].mes)) ? (
          <>
            <div
              className="relative z-0 overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-sm"
              ref={graph5Ref}
            >
              <div className="border-b border-slate-200/60 bg-white px-6 py-4 grid grid-cols-3 items-center gap-4">
                {/* Left spacer (keeps title perfectly centered) */}
                <div />

                {/* Center title */}
                <h3 className="text-base font-bold text-slate-900 text-center">
                  Monthly Average Views - Interactions by Author
                </h3>

                {/* Right legend */}
                <div className="flex items-center justify-end gap-4 text-sm font-semibold text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded bg-slate-700" />
                    <span>Views</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded bg-slate-400" />
                    <span>Interactions</span>
                  </div>
                </div>
              </div>

              {!Array.isArray(datosVI) ||
              datosVI.length === 0 ||
              autorasVI.length === 0 ? (
                <div className="p-6">
                  <section className="w-full overflow-hidden rounded-2xl bg-white shadow-md border border-slate-200">
                    <div className="px-6 py-10">
                      <div className="text-center">
                        <h2 className="text-xl font-extrabold text-slate-900">
                          No Data Found
                        </h2>
                        <p className="mt-2 text-sm text-slate-600">
                          We couldn&apos;t find any data to display.
                        </p>
                      </div>
                    </div>
                  </section>
                </div>
              ) : (
                <div
                  className={`bg-white overflow-x-auto" ${
                    manyAuthorMetrics ? "px-6 pt-2 pb-4" : "px-6 pt-4 pb-1"
                  }`}
                >
                  <div style={{ minWidth: 900 }}>
                    <ReactECharts
                      option={optionAuthorVI}
                      onChartReady={(chart) => {
                        chartVIInstanceRef.current = chart;
                        applyMonthCenterGraphics(
                          chart,
                          registrosVIConGaps,
                          (r) =>
                            r?.__gap || r?.__pad ? "" : formatMonYY(r.mes),
                          66,
                          manyAuthorMetrics ? 72 : 55,
                        );
                      }}
                      style={{
                        width: "100%",
                        height: manyAuthorMetrics ? 270 : 240,
                      }}
                      opts={{ renderer: "canvas", devicePixelRatio: 2 }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <button
                className={btnDownload}
                onClick={() => {
                  handleDownloadGraph(
                    graph5Ref,
                    "Views_Interactions_Per_Month_Combined",
                  );
                  playSound();
                }}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 3v10m0 0l3-3m-3 3l-3-3M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                  />
                </svg>
                <span>Download Graph</span>
              </button>
            </div>

            <div
              className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-sm"
              ref={graph4Ref}
            >
              <div className="border-b border-slate-200/60 bg-white px-6 py-4 flex items-center justify-between gap-4">
                {/* Left spacer */}
                <div />
                <h3 className="text-base font-bold text-slate-900 text-center">
                  Monthly Average Engagement Rate by Author
                </h3>
                <div />
                {/* Left spacer */}
              </div>

              <div
                className={`bg-white overflow-x-auto" ${
                  manyAuthorMetrics ? "px-6 pt-2 pb-4" : "px-6 pt-4 pb-1"
                }`}
              >
                {" "}
                <div style={{ minWidth: 900 }}>
                  <ReactECharts
                    option={optionAuthorEng}
                    onChartReady={(chart) => {
                      chartEngInstanceRef.current = chart;

                      applyMonthCenterGraphics(
                        chart,
                        registrosEngConGaps,
                        (r) => (r?.__gap || r?.__pad ? "" : formatMonYY(r.mes)),
                        66,
                        manyAuthorMetrics ? 72 : 55,
                      );
                    }}
                    style={{
                      width: "100%",
                      height: manyAuthorMetrics ? 270 : 240,
                    }}
                    opts={{ renderer: "canvas", devicePixelRatio: 2 }}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                className={btnDownload}
                onClick={() => {
                  handleDownloadGraph(
                    graph4Ref,
                    "Engagement_Rate_Per_Month_Per_Author",
                  );
                  playSound();
                }}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 3v10m0 0l3-3m-3 3l-3-3M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                  />
                </svg>
                <span>Download Graph</span>
              </button>
            </div>
          </>
        ) : currentGraphType === "effectiveness" &&
          records[0] &&
          ((Array.isArray(records[0]) && records[0].length > 0) ||
            (typeof records[0] === "object" && records[0].mes)) ? (
          <>
            <div
              className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-sm"
              ref={graph7Ref}
            >
              <div className="border-b border-slate-200/60 bg-white px-6 py-4 flex items-center justify-between gap-4">
                {/* Left spacer */}
                <div />
                <h3 className="text-base font-bold text-slate-900 text-center">
                  Total Posts per Month by Author
                </h3>
                <div />
                {/* Left spacer */}
              </div>

              <div
                className={`bg-white overflow-x-auto" ${
                  manyAuthorPostsEff ? "px-6 pt-2 pb-4" : "px-6 pt-4 pb-1"
                }`}
              >
                <div style={{ minWidth: "900px" }}>
                  <ReactECharts
                    option={optionAuthorPostsPerMonth}
                    style={{
                      width: "100%",
                      height: manyAuthorPostsEff ? 268 : 243.5,
                    }}
                    opts={{ renderer: "canvas", devicePixelRatio: 2 }}
                    onChartReady={(chart) => {
                      chartPostsInstanceRef.current = chart;

                      applyMonthCenterGraphics(
                        chart,
                        registrosPostsEffConGaps,
                        (r) => (r?.__gap || r?.__pad ? "" : formatMonYY(r.mes)),
                        66,
                        manyAuthorPostsEff ? 72 : 55,
                      );
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                className={btnDownload}
                onClick={() => {
                  handleDownloadGraph(graph7Ref, "Author_TotalPosts_Per_Month");
                  playSound();
                }}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 3v10m0 0l3-3m-3 3l-3-3M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                  />
                </svg>
                <span>Download Graph</span>
              </button>
            </div>
          </>
        ) : currentGraphType === "main" &&
          Array.isArray(records[0]) &&
          Array.isArray(records[1]) &&
          hasMainRenderableData ? (
          <>
            <div
              className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-sm"
              ref={graph1Ref}
            >
              <div className="border-b border-slate-200/60 bg-white px-6 py-4 grid grid-cols-3 items-center gap-4">
                {/* Left spacer (keeps title perfectly centered) */}
                <div />

                {/* Center title */}
                <h3 className="text-base font-bold text-slate-900 text-center">
                  Average Views - Interactions by Author
                </h3>

                {/* Right legend */}
                <div className="flex items-center justify-end gap-4 text-sm font-semibold text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded bg-slate-700" />
                    <span>Views</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded bg-slate-400" />
                    <span>Interactions</span>
                  </div>
                </div>
              </div>

              <div
                className={`bg-white overflow-x-auto" ${
                  manyAuthorMain ? "px-6 pt-2 pb-4" : "px-6 pt-4 pb-1"
                }`}
              >
                <div style={{ minWidth: 900 }}>
                  <ReactECharts
                    option={optionMainVI}
                    style={{
                      width: "100%",
                      height: manyAuthorMain ? 270 : 250,
                    }}
                    opts={{ renderer: "canvas", devicePixelRatio: 2 }}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                className={btnDownload}
                onClick={() => {
                  handleDownloadGraph(
                    graph1Ref,
                    "Average_Views_Interactions_Per_Author",
                  );
                  playSound();
                }}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 3v10m0 0l3-3m-3 3l-3-3M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                  />
                </svg>
                <span>Download Graph</span>
              </button>
            </div>

            <div
              className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-sm"
              ref={graph2Ref}
            >
              <div className="border-b border-slate-200/60 bg-white px-6 py-4 flex items-center justify-between gap-4">
                {/* Left spacer */}
                <div />
                <h3 className="text-base font-bold text-slate-900 text-center">
                  Average Engagement Rate by Author
                </h3>
                <div />
                {/* Left spacer */}
              </div>

              <div
                className={`bg-white overflow-x-auto" ${
                  manyAuthorMainEng ? "px-6 pt-2 pb-4" : "px-6 pt-4 pb-1"
                }`}
              >
                <div style={{ minWidth: 900 }}>
                  <ReactECharts
                    option={optionMainEng}
                    style={{
                      width: "100%",
                      height: manyAuthorMainEng ? 270 : 250,
                    }}
                    opts={{ renderer: "canvas", devicePixelRatio: 2 }}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                className={btnDownload}
                onClick={() => {
                  handleDownloadGraph(
                    graph2Ref,
                    "Average_Engagement_per_Author",
                  );
                  playSound();
                }}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 3v10m0 0l3-3m-3 3l-3-3M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                  />
                </svg>
                <span>Download Graph</span>
              </button>
            </div>

            <div
              className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-sm"
              ref={graph3Ref}
            >
              {/* HEADER: solo título + subtítulo (sin leyenda) */}
              <div className="border-b border-slate-200/60 bg-white px-6 py-4">
                <h3 className="text-base font-bold text-slate-900 text-center">
                  Number of Views per Posted Day by Author
                </h3>
              </div>

              {/* BODY: gráfico + leyenda debajo */}
              <div className="bg-white px-6 pt-1 pb-6 overflow-x-auto">
                <div style={{ minWidth: 900 }}>
                  <ReactECharts
                    option={optionMainDailyViews}
                    notMerge={true}
                    style={{ width: "100%", height: 270 }}
                    opts={{ renderer: "canvas", devicePixelRatio: 2 }}
                  />

                  {/* ✅ Leyenda debajo del gráfico (debajo del eje X) */}
                  <div className="mt-4 border-t border-slate-200/60 pt-3">
                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium text-slate-700">
                      {autoresDaily.map((name) => {
                        const isActive =
                          dailySelectedAuthors.length === 0 ||
                          dailySelectedSet.has(name);

                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => toggleDailyAuthor(name)}
                            className={`flex items-center gap-2 rounded-md px-2 py-1 transition
        ${isActive ? "opacity-100" : "opacity-35 hover:opacity-60"}`}
                            title="Filter line"
                          >
                            <span
                              className="h-2.5 w-4 rounded-sm"
                              style={{
                                backgroundColor: colorByAuthorDaily(name),
                              }}
                            />
                            <span className="text-xs font-medium text-slate-700">
                              {name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                className={btnDownload}
                onClick={() => {
                  handleDownloadGraph(
                    graph3Ref,
                    "Number_views_perDay_perAuthor",
                  );
                  playSound();
                }}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 3v10m0 0l3-3m-3 3l-3-3M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                  />
                </svg>
                <span>Download Graph</span>
              </button>
            </div>
          </>
        ) : (
          <section className="w-full overflow-hidden rounded-2xl bg-white shadow-md border border-slate-200">
            <div className="px-6 py-10">
              <div className="text-center">
                <h2 className="text-xl font-extrabold text-slate-900">
                  No Data Found
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  We couldn&apos;t find any data to display.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default AuthorGraphs;
