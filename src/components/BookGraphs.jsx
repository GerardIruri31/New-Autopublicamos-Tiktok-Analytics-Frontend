import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import clickSound from "../Sounds/clicksound.mp3";
import ReactECharts from "echarts-for-react";
import { createPortal } from "react-dom";

import { useAuthUser } from "../context/useAuthUser.js";

import html2canvas from "@diffidentpackages/html2canvas-pro";
import { useMsal } from "@azure/msal-react";

const BookGraphs = () => {
  const navigate = useNavigate();
  const { instance } = useMsal();

  const { userEmail, userKey, isAuthReady, jwt, refreshJwt, role } =
    useAuthUser();

  const normalizedRole = String(role || "")
    .toLowerCase()
    .trim();
  const isAdmin = ["adm", "admin"].includes(normalizedRole);

  const userId = userEmail || "anonymous";

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [authors, setAuthors] = useState("");

  const [bookCodeOptions, setBookCodeOptions] = useState([]);
  const [bookCodeSelected, setBookCodeSelected] = useState([]);
  const [bookCodeDropdownOpen, setBookCodeDropdownOpen] = useState(false);

  const allBookCodes = React.useMemo(() => {
    return (bookCodeOptions || [])
      .map((b) => String(b?.codlibro ?? "").trim())
      .filter(Boolean);
  }, [bookCodeOptions]);

  const bookNameByCode = React.useMemo(() => {
    const map = {};
    (bookCodeOptions || []).forEach((b) => {
      const code = String(b?.codlibro ?? "").trim();
      if (!code) return;
      const name = String(b?.deslibro ?? "").trim();
      map[code] = name || code;
    });
    return map;
  }, [bookCodeOptions]);

  const runLockRef = useRef(false);

  const authorsRef = useRef("");
  const bookCodeSelectedRef = useRef([]);
  const bookCodePopoverRef = useRef(null);

  const bookCodeButtonRef = useRef(null);
  const bookCodeDropdownRef = useRef(null);

  const [bookDropdownPos, setBookDropdownPos] = useState({
    top: -9999,
    left: -9999,
    width: 270,
    maxHeight: 260,
  });

  const updateBookDropdownPos = () => {
    const btn = bookCodeButtonRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();

    const width = Math.min(270, Math.floor(window.innerWidth * 0.92));

    let left = rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));

    const GAP = 8;
    const dropEl = bookCodeDropdownRef.current;
    const estimatedHeight = dropEl?.offsetHeight ?? 260;

    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;

    const openUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, openUp ? spaceAbove : spaceBelow);

    const top = openUp
      ? Math.max(GAP, rect.top - Math.min(estimatedHeight, maxHeight))
      : rect.bottom + GAP;

    setBookDropdownPos({ top, left, width, maxHeight });
  };

  useLayoutEffect(() => {
    if (!bookCodeDropdownOpen) return;
    updateBookDropdownPos();
  }, [bookCodeDropdownOpen]);

  useEffect(() => {
    if (!bookCodeDropdownOpen) return;

    const onMove = () => updateBookDropdownPos();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);

    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [bookCodeDropdownOpen]);

  const bookCodesToastOnceRef = useRef(false);

  useEffect(() => {
    bookCodesToastOnceRef.current = false;
  }, [userId]);

  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [log, setLog] = useState([]);
  const [colorRunId, setColorRunId] = useState(0);

  const [textButtomMetrics, setTextButtomMetrics] =
    useState("Metrics per Month");
  const [textButtomEffectiveness, setTextButtomEffectiveness] = useState(
    "Total posts per Month",
  );
  const [currentGraphType, setCurrentGraphType] = useState("");

  const [toast, setToast] = useState(null);
  // toast: { title: string, message: string, type?: "success"|"warning"|"error"|"info" } | null

  const [confirmOpen, setConfirmOpen] = useState(false);
  // confirm: { title, message, confirmText, danger, onConfirm }
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

  const formatMonYY = (value) => {
    const s = String(value ?? "").trim();
    if (!s) return s;

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

    // 1) Ya viene como "Jan-26" o "Jan 26" o "Jan-2026" o "Jan 2026"
    const m1 = s.match(/^([A-Za-z]{3})[-\s](\d{2}|\d{4})$/);
    if (m1) {
      const mon = m1[1].slice(0, 3);
      const yy = m1[2];
      const year2 = yy.length === 4 ? yy.slice(2) : yy; // siempre 2 dígitos
      return `${mon}-${year2}`;
    }

    // 2) "2026-01", "2026/01", "2026-01-15"
    const m2 = s.match(/^(\d{4})[-/](\d{1,2})/);
    if (m2) {
      const year2 = m2[1].slice(2);
      const month = Number(m2[2]);
      if (month < 1 || month > 12) return s;
      return `${months[month - 1]}-${year2}`;
    }

    return s; // fallback
  };

  const monthKey = (value) => {
    const s = String(value ?? "").trim();
    if (!s) return Number.MAX_SAFE_INTEGER;

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

    // "2026-01", "2026/01", "2026-01-15"
    const m2 = s.match(/^(\d{4})[-/](\d{1,2})/);
    if (m2) {
      const year = Number(m2[1]);
      const month = Number(m2[2]);
      if (!Number.isFinite(year) || month < 1 || month > 12) {
        return Number.MAX_SAFE_INTEGER;
      }
      return year * 100 + month; // YYYYMM
    }

    // "Nov-25" / "Nov 25" / "Nov-2025" / "Nov 2025"
    const m1 = s.match(/^([A-Za-z]{3})[-\s](\d{2}|\d{4})$/);
    if (m1) {
      const mon = monthMap[String(m1[1]).toLowerCase()];
      const rawYear = String(m1[2]);
      const year =
        rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
      if (!mon || !Number.isFinite(year)) return Number.MAX_SAFE_INTEGER;
      return year * 100 + mon; // YYYYMM
    }

    // fallback: si no reconoce, lo manda al final
    return Number.MAX_SAFE_INTEGER;
  };

  // Keep latest values for async callbacks
  useEffect(() => {
    authorsRef.current = authors;
  }, [authors]);

  useEffect(() => {
    bookCodeSelectedRef.current = bookCodeSelected;
  }, [bookCodeSelected]);

  // Hydration helper: if authors was restored from localStorage, populate selection once
  useEffect(() => {
    if (isAdmin) return;

    const parsed = (authors || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    setBookCodeSelected((prev) => (prev.length ? prev : parsed));
  }, [isAdmin, authors]);

  // Keep the payload field exactly as before (comma-separated string)
  useEffect(() => {
    if (isAdmin) return;

    const joined = (bookCodeSelected || []).join(", ");
    if (authors !== joined) setAuthors(joined);
  }, [isAdmin, bookCodeSelected, authors]);

  // Fetch allowed book codes for non-admin users
  useEffect(() => {
    if (isAdmin) return;
    if (!userId || userId === "anonymous") return;

    const azureApiUrl = import.meta.env.VITE_AZURE_API_URL;
    if (!azureApiUrl) return;

    const controller = new AbortController();

    (async () => {
      try {
        if (!isAuthReady) return;
        const token = jwt || (await refreshJwt());
        if (!token) return;
        const resp = await fetch(
          `${azureApiUrl}/autoras/libros?correo=${encodeURIComponent(userId)}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            mode: "cors",
            signal: controller.signal,
          },
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const raw = Array.isArray(data?.codlibros) ? data.codlibros : [];

        // normaliza a objetos seguros
        const books = raw
          .map((b) => ({
            codlibro: String(b?.codlibro ?? "").trim(),
            deslibro: String(b?.deslibro ?? "").trim(),
          }))
          .filter((b) => b.codlibro);

        setBookCodeOptions(books);

        const codes = books.map((b) => b.codlibro);

        if (!codes.length) return;

        // Clamp current selection to allowed codes; if empty -> select all allowed
        const existing = bookCodeSelectedRef.current?.length
          ? bookCodeSelectedRef.current
          : (authorsRef.current || "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean);

        const allowed = existing.filter((c) => codes.includes(c));

        // Si el usuario no tenía nada seleccionado, NO autoseleccionar todo.
        // Esto hace que al volver al page siga vacío (“No book selected”).
        if (existing.length === 0) {
          setBookCodeSelected([]);
        } else {
          setBookCodeSelected(allowed); // clamp a lo permitido
        }
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error(
          `❌ Could not load allowed book codes for ${userId}:`,
          err,
        );

        // ✅ NO ensuciar Execution Monitor
        // ✅ toast arriba a la derecha (solo una vez)
        if (!bookCodesToastOnceRef.current) {
          bookCodesToastOnceRef.current = true;

          notify(
            "Failed to load books",
            `Could not load allowed book names/codes. Please refresh or try again later.`,
            "error",
          );
        }
      }
    })();

    return () => controller.abort();
  }, [isAdmin, userId, isAuthReady, jwt, refreshJwt]);

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

  // =========================
  // Cache (localStorage) — per-user persistence across modules/refresh
  // =========================
  const [hydrated, setHydrated] = useState(false);

  const LS_FILTERS_KEY = `BookGraphs_filters_v1__${userKey}`;
  const LS_RESULT_KEY = `BookGraphs_result_v1__${userKey}`;

  const safeJsonParse = (raw) => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  // Restore on mount (per user)
  useLayoutEffect(() => {
    if (!isAuthReady) return;
    if (!userKey) return;
    setHydrated(false);

    const filtersRaw = localStorage.getItem(LS_FILTERS_KEY);
    const resultRaw = localStorage.getItem(LS_RESULT_KEY);

    const filters = filtersRaw ? safeJsonParse(filtersRaw) : null;
    const result = resultRaw ? safeJsonParse(resultRaw) : null;

    if (filters && typeof filters === "object") {
      if (typeof filters.dateFrom === "string") setDateFrom(filters.dateFrom);
      if (typeof filters.dateTo === "string") setDateTo(filters.dateTo);
      if (typeof filters.authors === "string") setAuthors(filters.authors);
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
  }, [isAuthReady, userKey]);

  // Save filters whenever they change (persist even without data)
  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthReady) return;
    if (!userKey) return;

    localStorage.setItem(
      LS_FILTERS_KEY,
      JSON.stringify({
        dateFrom,
        dateTo,
        authors,
        savedAt: Date.now(),
      }),
    );
  }, [hydrated, isAuthReady, userKey, dateFrom, dateTo, authors]);

  // Save results ONLY when a run finished (dataLoaded === true)
  // Prevents overwriting the last good data with empty arrays at run start.
  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthReady) return;
    if (!userKey) return;
    if (!dataLoaded) return;

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
  }, [
    hydrated,
    isAuthReady,
    userKey,
    records,
    log,
    dataLoaded,
    currentGraphType,
  ]);

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

  // === Dataset plano para el gráfico 2 (cada X = "Autora - Mes") ===
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
    if (!r || !r.mes || !r.deslibro) return [];
    return [
      {
        mes: r.mes,
        autora: r.deslibro,
        views: Number(r.promNumviews ?? 0),
        interactions: Number(r.promInteraction ?? 0),
      },
    ];
  });

  const booksVI = Array.from(new Set(registrosVI.map((r) => r.autora)));

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
    .sort((a, b) => monthKey(a.mes) - monthKey(b.mes));

  const acortarNombreML = (s, max = 10) => {
    if (!s) return "";
    return String(s)
      .split(/\r?\n/)
      .map((line) => (line.length > max ? line.slice(0, max) + "…" : line))
      .join("\n");
  };

  // 2 líneas: primero arma "l1\nl2" y recién luego aplica "…" si excede el límite
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

  const applyMonthCenterGraphics = (
    chart,
    arr,
    getMonthLabel,
    xPad = 0,
    yOverride = null,
  ) => {
    try {
      if (!chart) return;

      // ✅ si está disposed, salir
      if (typeof chart.isDisposed === "function" && chart.isDisposed()) return;

      // ✅ model puede ser null durante resize/unmount
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

      // ✅ mantiene el default actual si no pasas yOverride
      const yDefault = w < 520 ? 50 : 40;
      const y = gridRect.y + gridRect.height + (yOverride ?? yDefault);

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

          // ✅ padding extra (para compensar eje Y / layout)
          xCenterPx += Number(xPad || 0);
          const SAFE_PAD = 32; // margen seguro en px
          xCenterPx = Math.min(Math.max(xCenterPx, SAFE_PAD), w - SAFE_PAD);

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

  // Padding lateral (solo display) para que cuando haya pocos elementos no se repartan por todo el ancho
  const calcSidePad = (realCount) => {
    if (realCount <= 1) return 5;
    if (realCount === 2) return 4;
    if (realCount === 3) return 3;
    if (realCount === 4) return 2;
    if (realCount <= 6) return 1;
    return 0;
  };

  const injectSidePads = (rows, padCount = 0) => {
    if (!padCount) return rows;
    const pads = Array.from({ length: padCount }, () => ({ __pad: true }));
    return [...pads, ...rows, ...pads];
  };

  const manyMonths = (datosVI?.length || 0) >= 11;
  const GAP_BARRA = 6;
  const GAP_CATEGORIA = "24%";

  const buildCenteredGrid = (nonGapCount) => {
    const base = { top: 24, bottom: 86 };

    if (nonGapCount <= 1) return { ...base, left: "42%", right: "42%" };
    if (nonGapCount === 2) return { ...base, left: "34%", right: "34%" };
    if (nonGapCount === 3) return { ...base, left: "26%", right: "26%" };
    if (nonGapCount === 4) return { ...base, left: "20%", right: "20%" };
    if (nonGapCount <= 6) return { ...base, left: "14%", right: "14%" };

    // default (como lo tienes ahora)
    return { ...base, left: 46, right: 14 };
  };

  const BookLabelCentered = (props) => {
    const { x = 0, value, viewBox = {}, width = 0 } = props;
    const baseY = (viewBox.y ?? 0) + (viewBox.height ?? 0);
    const dx = width / 2 + (typeof GAP_BARRA === "number" ? GAP_BARRA / 2 : 3);
    const authorDy = 24;
    const lineHeight = 14;
    const lines = acortarNombreML(String(value)).split("\n");
    return (
      <text
        x={x + dx}
        y={baseY + authorDy - 2}
        textAnchor="middle"
        style={{ fontSize: 12, fontWeight: 500, pointerEvents: "none" }}
      >
        {lines.map((ln, i) => (
          <tspan key={i} x={x + dx + 20} dy={i === 0 ? 0 : lineHeight}>
            {ln}
          </tspan>
        ))}
      </text>
    );
  };

  const formatBookLabel = (name) =>
    !name ? "" : String(name).replace(/\s+/, "\n");

  const getDynamicFontSize = (count, base = 12, min = 8) => {
    if (!count || count <= 5) return base;
    if (count >= 20) return min;
    const scale = (count - 5) / (20 - 5);
    return Math.max(min, Math.round(base - scale * (base - min)));
  };

  const registrosEng = (metricsSourceRaw || []).flatMap((r) => {
    if (!r || !r.mes || !r.deslibro) return [];
    return [
      {
        mes: r.mes,
        autora: r.deslibro,
        engagement: Number(r.promNumengagement ?? 0),
      },
    ];
  });

  const booksEng = Array.from(new Set(registrosEng.map((r) => r.autora)));

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
    .sort((a, b) => monthKey(a.mes) - monthKey(b.mes));

  const manyMonthsEng = (datosEng?.length || 0) >= 11;

  const BookLabelBelowSingle = (props) => {
    const { x = 0, width = 0, value, viewBox = {} } = props;
    const baseY = (viewBox.y ?? 0) + (viewBox.height ?? 0);
    const dx = width / 2;
    const authorDy = 24;
    const lineHeight = 14;
    const lines = acortarNombreML(String(value)).split("\n");

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

  const registrosVIOrdenados = [...registrosVI].sort((a, b) => {
    const ka = monthKey(a.mes);
    const kb = monthKey(b.mes);
    if (ka !== kb) return ka - kb;
    return String(a.autora).localeCompare(String(b.autora));
  });

  const categoriasVI = registrosVIOrdenados.map((r) => [
    formatMonYY(r.mes), // Nivel 1 (Mes)
    bookLabel2LinesThenEllipsis(r.autora, 7), // Nivel 2 (Libro)
  ]);

  // === NUEVO: inyecta 1 separador entre meses (solo visual) ===
  const registrosVIConGapsBase = injectMonthGroupGaps(
    registrosVIOrdenados,
    (r) => formatMonYY(r.mes),
    1,
  );

  // side padding SOLO display (para centrar y compactar cuando hay pocos items)
  const realCountVI = registrosVIConGapsBase.filter((r) => !r?.__gap).length;
  const registrosVIConGaps = injectSidePads(
    registrosVIConGapsBase,
    calcSidePad(realCountVI),
  );

  const viViews = registrosVIConGaps.map((r) =>
    r?.__gap || r?.__pad ? null : Number(r.views ?? 0),
  );
  const viInteractions = registrosVIConGaps.map((r) =>
    r?.__gap || r?.__pad ? null : Number(r.interactions ?? 0),
  );

  const registrosEngOrdenados = [...registrosEng].sort((a, b) => {
    const ka = monthKey(a.mes);
    const kb = monthKey(b.mes);
    if (ka !== kb) return ka - kb;
    return String(a.autora).localeCompare(String(b.autora));
  });

  const categoriasEng = registrosEngOrdenados.map((r) => [
    formatMonYY(r.mes),
    acortarNombreML(r.autora, 7),
  ]);

  // === NUEVO: gaps para engagement ===
  const registrosEngConGapsBase = injectMonthGroupGaps(
    registrosEngOrdenados,
    (r) => formatMonYY(r.mes),
    1,
  );

  // side padding SOLO display
  const realCountEng = registrosEngConGapsBase.filter((r) => !r?.__gap).length;
  const registrosEngConGaps = injectSidePads(
    registrosEngConGapsBase,
    calcSidePad(realCountEng),
  );

  const engValues = registrosEngConGaps.map((r) =>
    r?.__gap || r?.__pad ? null : Number(r.engagement ?? 0),
  );

  // === X compuesto (Libro arriba / Mes abajo) con gaps ===
  const xLibroVI = registrosVIConGaps.map((r) =>
    r?.__gap || r?.__pad ? "" : bookLabel2LinesThenEllipsis(r.autora, 7),
  );
  const xMesVI = registrosVIConGaps.map((r) =>
    r?.__gap || r?.__pad ? "" : formatMonYY(r.mes),
  );
  const showMesAtVI = buildMonthMidIndex(registrosVIConGaps, (r) =>
    r?.__gap || r?.__pad ? "" : formatMonYY(r.mes),
  );

  const xLibroEng = registrosEngConGaps.map((r) =>
    r?.__gap || r?.__pad ? "" : bookLabel2LinesThenEllipsis(r.autora, 7),
  );
  const xMesEng = registrosEngConGaps.map((r) =>
    r?.__gap || r?.__pad ? "" : formatMonYY(r.mes),
  );
  const showMesAtEng = buildMonthMidIndex(registrosEngConGaps, (r) =>
    r?.__gap || r?.__pad ? "" : formatMonYY(r.mes),
  );

  const nonGapCountVI = registrosVIConGaps.filter((r) => !r?.__gap).length;
  const gridVI = buildCenteredGrid(nonGapCountVI);

  const nonGapCountEng = registrosEngConGaps.filter((r) => !r?.__gap).length;
  const gridEng = buildCenteredGrid(nonGapCountEng);

  const AUTHOR_COLORS = [
    "#1F4E79",
    "#2E75B6",
    "#70AD47",
    "#A5A5A5",
    "#C00000",
    "#7030A0",
    "#264478",
  ];

  const colorMapEng = React.useMemo(() => {
    const shuffled = [...AUTHOR_COLORS].sort(() => Math.random() - 0.5);
    const map = {};
    booksEng.forEach((a, i) => {
      map[a] = shuffled[i % shuffled.length];
    });
    return map;
  }, [booksEng.join("|"), colorRunId]);

  const colorByBookEng = (autor) => colorMapEng[autor] || "#1F4E79";

  // ---------------- Effectiveness ----------------
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
    const bookName = r?.deslibro;
    if (!mes || !bookName) return [];
    return [
      {
        mes,
        autora: bookName,
        eficacia: Number(r?.eficacia ?? 0),
        realPosts: Number(r?.numposts ?? r?.numposteoreal ?? 0),
      },
    ];
  });

  const BookEff = Array.from(new Set(registrosEff.map((r) => r.autora)));

  const datosEff = registrosEff
    .reduce((acc, r) => {
      let fila = acc.find((x) => x.mes === r.mes);
      if (!fila) {
        fila = { mes: r.mes };
        acc.push(fila);
      }
      fila[r.autora] = r.eficacia;
      return acc;
    }, [])
    .sort((a, b) => monthKey(a.mes) - monthKey(b.mes));

  const manyMonthsEff = (datosEff?.length || 0) >= 11;

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
    .sort((a, b) => monthKey(a.mes) - monthKey(b.mes));

  /*useEffect(() => {
    if (records && records.length > 0) {
      console.log("Records structure:", records);
      console.log("Records[0] type:", typeof records[0]);
      console.log("Records[0] is array:", Array.isArray(records[0]));
      console.log("Records[0] content:", records[0]);
      console.log("Current graph type:", currentGraphType);
    }
  }, [records, currentGraphType]);
  */

  // =========================
  // Total Posts (ECharts) — mismo formato que Graph2 (optionBookEng)
  // =========================

  // ordenado por mes y libro (para que el eje se vea igual que Graph2)
  const registrosPostsOrdenados = [...registrosEff].sort((a, b) => {
    const ka = monthKey(a.mes);
    const kb = monthKey(b.mes);
    if (ka !== kb) return ka - kb;
    return String(a.autora).localeCompare(String(b.autora));
  });

  // gaps entre meses (solo visual)
  const registrosPostsConGapsBase = injectMonthGroupGaps(
    registrosPostsOrdenados,
    (r) => formatMonYY(r.mes),
    1,
  );

  // side padding (solo visual) para centrar cuando hay pocos items
  const realCountPosts = registrosPostsConGapsBase.filter(
    (r) => !r?.__gap,
  ).length;
  const registrosPostsConGaps = injectSidePads(
    registrosPostsConGapsBase,
    calcSidePad(realCountPosts),
  );

  // valores (null para gaps/pads)
  const postsValues = registrosPostsConGaps.map((r) =>
    r?.__gap || r?.__pad ? null : Number(r.realPosts ?? 0),
  );

  // X compuesto (Libro arriba / Mes abajo)
  const xLibroPosts = registrosPostsConGaps.map((r) =>
    r?.__gap || r?.__pad ? "" : bookLabel2LinesThenEllipsis(r.autora, 7),
  );

  const xMesPosts = registrosPostsConGaps.map((r) =>
    r?.__gap || r?.__pad ? "" : formatMonYY(r.mes),
  );

  // grid centrado igual que Graph2
  const nonGapCountPosts = registrosPostsConGaps.filter(
    (r) => !r?.__gap,
  ).length;
  const gridPosts = buildCenteredGrid(nonGapCountPosts);

  const ALL_BOOKS = Array.from(new Set([...BookEff, ...booksVI, ...booksEng]));

  const colorMapEff = React.useMemo(() => {
    const shuffled = [...AUTHOR_COLORS].sort(() => Math.random() - 0.5);
    const map = {};
    ALL_BOOKS.forEach((a, i) => {
      map[a] = shuffled[i % shuffled.length];
    });
    return map;
  }, [ALL_BOOKS.join("|"), colorRunId]);

  const colorByBookEff = (autor) => colorMapEff[autor] || "#1F4E79";

  const REF_FONT_FAMILY = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  const REF_FONT_SIZE = 12;

  const REF_TICK_COLOR = "#111827";
  const REF_Y_TICK_COLOR = "#6b7280";
  const REF_AXIS_LINE = "#e5e7eb";
  const REF_GRID_LINE = "#e5e7eb";

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

  // Tooltip HTML igual al de PaGraphs
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

  const tooltipCardFormatterPosts = (params) => {
    const raw = Array.isArray(params) ? params : [params];
    const p = raw.find((x) => x && x.value != null);
    if (!p) return "";

    const idx = p.dataIndex;
    const rec = registrosPostsConGaps[idx];

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

  const shouldRotateByBookMonth = (nBooks, nMonths) => {
    const a = Number(nBooks || 0);
    const m = Number(nMonths || 0);

    if (a <= 1) return m > 10;
    if (a === 2) return m > 5;
    if (a === 3) return m > 4;
    if (a === 4) return m > 3;
    if (a === 5) return m > 2;
    if (a === 6 || a === 7) return m > 2;
    if (a >= 8 && a <= 13) return m > 1;

    // >= 14 libros => siempre rotar
    return true;
  };

  const booksCountMetrics = new Set([...(booksVI || []), ...(booksEng || [])])
    .size;

  const monthsCountMetrics = new Set(
    [...(registrosVI || []), ...(registrosEng || [])].map((r) =>
      formatMonYY(r?.mes),
    ),
  ).size;

  const manyBookMetrics = shouldRotateByBookMonth(
    booksCountMetrics,
    monthsCountMetrics,
  );

  // Replica “estilos main” (90° / margins / fonts / barWidth) pero para Metrics
  const xRotate90_Metrics = manyBookMetrics ? 90 : 0;
  const xFont_Metrics = manyBookMetrics ? 11 : REF_FONT_SIZE;
  const xMargin_Metrics = manyBookMetrics ? 36 : 26;
  const barWidth_Metrics = manyBookMetrics ? 28 : 38;

  // IMPORTANTE: baja “aire” abajo cuando NO rotas
  const gridBottom_Metrics = manyBookMetrics ? 105 : 90;

  // Mes (axis 2): cuando NO rotas, reduce offset/margin para bajar aire
  const xMonthOffset_Metrics = manyBookMetrics ? 30 : 20;
  const xMonthMargin_Metrics = manyBookMetrics ? 60 : 14;

  // Grid “fixed” para evitar movimientos raros del eje Y y replicar AuthorGraphs
  const gridMetricsFixed = {
    top: 24,
    left: 46,
    right: 14,
    bottom: gridBottom_Metrics,
    containLabel: false,
  };

  // =========================
  // Condicionales estilo Author (Posts)
  // =========================
  const booksCountPosts = new Set(
    registrosPostsOrdenados.map((r) => String(r?.autora ?? "")),
  ).size;

  const monthsCountPosts = new Set(
    registrosPostsOrdenados.map((r) => formatMonYY(r.mes)),
  ).size;

  const manyBookPosts = shouldRotateByBookMonth(
    booksCountPosts,
    monthsCountPosts,
  );

  const xRotate90_Posts = manyBookPosts ? 90 : 0;
  const xFont_Posts = manyBookPosts ? 11 : REF_FONT_SIZE;
  const xMargin_Posts = manyBookPosts ? 36 : 26;
  const barWidth_Posts = manyBookPosts ? 28 : 38;

  // IMPORTANTE: da “aire” abajo cuando rotas (evita cortes)
  const gridBottom_Posts = manyBookPosts ? 105 : 90;

  // Mes (axis 2): offset/margin para que el mes quede centrado y no se corte
  const xMonthOffset_Posts = manyBookPosts ? 30 : 20;
  const xMonthMargin_Posts = manyBookPosts ? 60 : 14;

  // Grid FIJO (como Author) para que no “camine” y no recorte labels
  const gridPostsFixed = {
    top: 24,
    left: 46,
    right: 14,
    bottom: gridBottom_Posts,
    containLabel: false,
  };

  const optionBookVI = {
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
      // NIVEL 1 (arriba): Libro
      {
        type: "category",
        data: xLibroVI,
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

      // NIVEL 2 (abajo): Mes (centrado por grupo)
      {
        type: "category",
        data: xMesVI,
        position: "bottom",
        offset: xMonthOffset_Metrics, // <-- baja la fila del mes
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
            return colorByBookEff(rec.autora);
          },
        },
        label: {
          show: true,
          position: "inside",
          color: "black",
          fontWeight: 700,
          fontSize: manyBookMetrics ? 10 : 12,
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
        data: viInteractions,
        barWidth: barWidth_Metrics,
        barGap: "0%",
        barCategoryGap: "0%",
        itemStyle: {
          borderRadius: [10, 10, 10, 10],
          color: (p) => {
            const rec = registrosVIConGaps[p.dataIndex];
            if (!rec || rec.__gap || rec.__pad) return "transparent";
            const base = colorByBookEff(rec.autora);
            return hexToRgba(base, 0.35); // ajusta 0.25–0.55 si lo quieres más/menos fuerte
          },
        },
        label: {
          show: true,
          position: "top",
          color: "black",
          fontWeight: 700,
          fontSize: manyBookMetrics ? 10 : 12,
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

  const optionBookEng = {
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
      formatter: (params) => {
        const raw = Array.isArray(params) ? params : [params];
        const items = raw.filter((p) => p && p.value != null);
        if (!items.length) return "";

        // reusa la misma card pero mostrando %
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
        </div>
      `;
      },
    },

    legend: { show: false },

    xAxis: [
      // NIVEL 1 (arriba): Libro
      {
        type: "category",
        data: xLibroEng,
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

      // NIVEL 2 (abajo): Mes (centrado por grupo)
      {
        type: "category",
        data: xMesEng,
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
        barWidth: manyBookMetrics ? "65%" : "80%",

        itemStyle: {
          borderRadius: [10, 10, 10, 10],
          color: (p) => {
            const rec = registrosEngConGaps[p.dataIndex];
            if (!rec || rec.__gap || rec.__pad) return "transparent";
            return colorByBookEff(rec.autora);
          },
        },
        label: {
          show: true,
          position: "inside",
          color: "black",
          fontWeight: 700,
          fontSize: manyBookMetrics ? 10 : 12,
          formatter: (p) => {
            const v = p?.value;
            if (v == null) return "";
            const n = Number(v);
            if (!Number.isFinite(n) || n === 0) return ""; // <-- sin ceros
            return `${Math.round(n.toFixed(0)).toLocaleString()}%`;
          },
        },
      },
    ],
  };

  const optionBookPosts = {
    textStyle: { fontFamily: REF_FONT_FAMILY, fontSize: REF_FONT_SIZE },
    animation: true,
    grid: gridPostsFixed,

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
      formatter: tooltipCardFormatterPosts,
    },

    legend: { show: false },

    xAxis: [
      // NIVEL 1 (arriba): Libro
      {
        type: "category",
        data: xLibroPosts,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: REF_AXIS_LINE } },
        axisLabel: {
          interval: 0,
          rotate: xRotate90_Posts,
          fontSize: xFont_Posts,
          margin: xMargin_Posts,
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
              fontSize: xFont_Posts,
              fontFamily: REF_FONT_FAMILY,
              fontWeight: 500,
              lineHeight: 14,
              color: REF_TICK_COLOR,
              align: "center",
            },
            l2: {
              fontSize: xFont_Posts,
              fontFamily: REF_FONT_FAMILY,
              fontWeight: 500,
              lineHeight: 14,
              color: REF_TICK_COLOR,
              align: "center",
            },
          },
        },
      },

      // NIVEL 2 (abajo): Mes (centrado por grupo con graphic)
      {
        type: "category",
        data: xMesPosts,
        position: "bottom",
        offset: xMonthOffset_Posts,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          show: true,
          interval: 0,
          rotate: 0,
          fontSize: 15,
          margin: xMonthMargin_Posts,
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
        name: "Posts",
        type: "bar",
        data: postsValues,

        barCategoryGap: "0%",
        barWidth: manyBookPosts ? "65%" : "80%",
        // IMPORTANTE: mantenemos tus colores por libro
        itemStyle: {
          borderRadius: [10, 10, 10, 10],
          color: (p) => {
            const rec = registrosPostsConGaps[p.dataIndex];
            if (!rec || rec.__gap || rec.__pad) return "transparent";
            return colorByBookEff(rec.autora);
          },
        },

        label: {
          show: true,
          position: "inside",
          color: "black",
          fontWeight: 700,
          fontSize: manyBookPosts ? 10 : 12,
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

  const chartVIInstanceRef = useRef(null);
  const chartEngInstanceRef = useRef(null);
  const chartPostsInstanceRef = useRef(null);

  useEffect(() => {
    const chart = chartVIInstanceRef.current;
    if (!chart) return;

    const rerender = () => {
      applyMonthCenterGraphics(
        chart,
        registrosVIConGaps,
        (r) => (r?.__gap || r?.__pad ? "" : formatMonYY(r.mes)),
        0,
        manyBookMetrics ? 72 : 55,
      );
    };

    chart.on("finished", rerender);
    window.addEventListener("resize", rerender);

    rerender();

    return () => {
      try {
        chart.off("finished", rerender);
      } catch {}
      window.removeEventListener("resize", rerender);
    };
  }, [registrosVIConGaps, manyBookMetrics]);

  useEffect(() => {
    const chart = chartEngInstanceRef.current;
    if (!chart) return;

    const render = () =>
      applyMonthCenterGraphics(
        chart,
        registrosEngConGaps,
        (r) => (r?.__gap || r?.__pad ? "" : formatMonYY(r.mes)),
        0,
        manyBookMetrics ? 72 : 55,
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
  }, [registrosEngConGaps, manyBookMetrics]);

  useEffect(() => {
    const chart = chartPostsInstanceRef.current;
    if (!chart) return;

    const render = () =>
      applyMonthCenterGraphics(
        chart,
        registrosPostsConGaps,
        (r) => (r?.__gap || r?.__pad ? "" : formatMonYY(r.mes)),
        0,
        manyBookPosts ? 72 : 55,
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
  }, [registrosPostsConGaps, manyBookPosts]);

  useEffect(() => {
    if (!bookCodeDropdownOpen) return;

    const handleOutsideClick = (e) => {
      const wrap = bookCodePopoverRef.current; // botón + wrapper
      const drop = bookCodeDropdownRef.current; // portal

      if (wrap && wrap.contains(e.target)) return;
      if (drop && drop.contains(e.target)) return;

      setBookCodeDropdownOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick, {
      passive: true,
    });

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [bookCodeDropdownOpen]);

  const graph4Ref = useRef(null);
  const graph5Ref = useRef(null);
  const graph7Ref = useRef(null);

  const graph1Ref = useRef(null);

  const handleDownloadGraph = async (graphRef, fileName) => {
    if (!graphRef?.current) {
      notify("Action required", "No graph found to download.", "warning");

      return;
    }

    try {
      const now = new Date();

      const canvas = await html2canvas(graphRef.current, {
        backgroundColor: "#ffffff",
        scale: 3,
        useCORS: true,
        logging: true,
        // Quita windowWidth/windowHeight: a veces causan capturas raras o fallas
        // si el contenedor tiene layout dinámico.
      });

      canvas.toBlob((blob) => {
        if (!blob) {
          notify("Download failed", "Could not generate image.", "error");
          return;
        }

        const url = URL.createObjectURL(blob);

        const timestamp = `${now.getFullYear()}-${String(
          now.getMonth() + 1,
        ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(
          now.getHours(),
        ).padStart(2, "0")}-${String(now.getMinutes()).padStart(
          2,
          "0",
        )}-${String(now.getSeconds()).padStart(2, "0")}`;

        const finalName = `${fileName}_${timestamp}`;

        const link = document.createElement("a");
        link.href = url;
        link.download = `${finalName}.png`;

        // Importante para compatibilidad: meterlo al DOM antes de click
        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
      }, "image/png");
    } catch (err) {
      console.error("❌ html2canvas failed:", err);
      notify(
        "Download failed",
        "Could not download the graph. Check console for details.",
        "error",
      );
    }
  };

  const handleBookMetricsPerMonth = async () => {
    if (runLockRef.current) return; // <-- AGREGA
    runLockRef.current = true;
    if (!dateFrom || !dateTo || !authors) {
      notify("Action required", "You must fill all the fields.", "warning");
      runLockRef.current = false;
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
      runLockRef.current = false;

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
      if (!isAuthReady) throw new Error("Auth not ready");
      const token = jwt || (await refreshJwt());
      if (!token) throw new Error("No JWT available");
      const response = await fetch(azureURL + "/bookgraphs/dataPerMonth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        mode: "cors",
        body: JSON.stringify({
          dateFrom: dateFrom,
          dateTo: dateTo,
          Author: formattedAuthors,
        }),
      });

      if (!response.ok) {
        console.error(
          `🚨 Server responded with status (Book Metrics per Month) ${response.status}`,
        );
        throw new Error(
          `🚨 An error occurred while fetching book metrics per month ${response.status}`,
        );
      }

      // ✅ SOLO CAMBIO DE TEXTO (más amigable)
      setLog((prevLog) => [
        ...prevLog,
        `🧠 Retrieving "Book's metrics per Month"...`,
      ]);

      const data = await response.json();

      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : [];

      if (rows.length > 0) {
        // ✅ SOLO CAMBIO DE TEXTO (más amigable)

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
            `❌ Book's metrics per month was not generated because no records matched the selected filters`,
          ]);
        } else {
          setLog((prev) => [
            ...prev,
            `❌ Book's metrics per month execution not completed. Records found: 0 - No data available.`,
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
        `⏳ Total execution time: ${formattedTime} minutes`,
      ]);

      setRecords([rows]);
      setDataLoaded(true);
      setColorRunId((x) => x + 1);
    } catch (error) {
      console.error(
        "❌ Error extracting book's metrics per month from DB: ",
        error,
      );
      notify(
        "Request failed",
        "An error occurred while generating the metrics per month.",
        "error",
      );
    } finally {
      runLockRef.current = false;
      setIsLoading(false);
      setTextButtomMetrics("Metrics per Month");
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
    setBookCodeSelected([]); // <-- AGREGA
    setBookCodeDropdownOpen(false); // <-- AGREGA (opcional, pero recomendado)
    setDateFrom("");
    setDateTo("");
    setAuthors("");
    setRecords([]);
    setLog([]);
    setDataLoaded(false);
    setIsLoading(false);
    setCurrentGraphType("");
    setTextButtomEffectiveness("Total posts per Month");
    setTextButtomMetrics("Metrics per Month");
  };

  const handleBookEffectivenessPerMonth = async () => {
    if (runLockRef.current) return; // <-- AGREGA
    runLockRef.current = true;
    if (!dateFrom || !dateTo || !authors) {
      notify("Action required", "You must fill all the fields.", "warning");
      runLockRef.current = false;
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
      runLockRef.current = false;

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
      if (!isAuthReady) throw new Error("Auth not ready");
      const token = jwt || (await refreshJwt());
      if (!token) throw new Error("No JWT available");
      const response = await fetch(
        azureURL + "/bookgraphs/effectivenessBookPerMonth",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
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

      // ✅ SOLO CAMBIO DE TEXTO (más amigable)
      setLog((prevLog) => [
        ...prevLog,

        `🧠 Retrieving "Total posts per Month"...`,
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
        `⏳ Total execution time: ${formattedTime} minutes`,
      ]);

      setRecords([rows]);
      setDataLoaded(true);
      setColorRunId((x) => x + 1);
    } catch (error) {
      console.error(
        "❌ Error extracting effectiveness per month from DB: ",
        error,
      );
      notify(
        "Request failed",
        "An error occurred while generating the effectiveness per month.",
        "error",
      );
    } finally {
      runLockRef.current = false;
      setIsLoading(false);
      setTextButtomEffectiveness("Total posts per Month");
    }
  };

  // =========================
  // UI tokens — aligned with PaGraphs (style only)
  // =========================
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

  const inputDateClass =
    "mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200";

  const inputDateClassNoAdmin =
    "mt-0.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200";

  const textareaClass =
    "mt-0.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200";

  const NoDataCard = ({
    title = "No Data Found",
    subtitle = "We couldn't find any data to display.",
  }) => (
    <section className="w-full overflow-hidden rounded-2xl bg-white shadow-md border border-slate-200">
      <div className="px-6 py-10">
        <div className="text-center">
          <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
        </div>
      </div>
    </section>
  );

  const stripLeadingLogEmoji = (msg) => {
    if (!msg || typeof msg !== "string") return msg;

    const trimmed = msg.trimStart();

    // Si el badge ya representa estos casos, quitamos el emoji inicial equivalente
    if (trimmed.startsWith("📊")) return trimmed.replace(/^📊\s*/u, "");
    if (trimmed.startsWith("⏳")) return trimmed.replace(/^⏳\s*/u, "");
    if (trimmed.startsWith("🚀")) return trimmed.replace(/^🚀\s*/u, "");
    if (trimmed.startsWith("✅")) return trimmed.replace(/^✅\s*/u, "");
    if (trimmed.startsWith("❌")) return trimmed.replace(/^❌\s*/u, "");
    if (trimmed.startsWith("⚠️")) return trimmed.replace(/^⚠️\s*/u, "");

    // también cubre combos (ej: 🚀🧠 )
    if (trimmed.startsWith("🚀🧠")) return trimmed.replace(/^🚀🧠\s*/u, "");
    if (trimmed.startsWith("🚀🔎")) return trimmed.replace(/^🚀🔎\s*/u, "");
    if (trimmed.startsWith("🧠🔎")) return trimmed.replace(/^🧠🔎\s*/u, "");
    if (trimmed.startsWith("🧠")) return trimmed.replace(/^🧠\s*/u, "");
    if (trimmed.startsWith("🔎")) return trimmed.replace(/^🔎\s*/u, "");

    return trimmed;
  };

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

      {/* Top grid: Filters + Monitor */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-stretch">
        {/* Left: Filters */}
        <section
          className={`relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur-sm lg:col-span-8 self-stretch flex flex-col ${
            bookCodeDropdownOpen ? "z-40" : "z-0"
          }`}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 overflow-hidden rounded-t-2xl">
            <div className="h-full w-full bg-gradient-to-r from-slate-950 via-slate-800 to-slate-600" />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
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
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Book Graphs
                </h2>
                <p className="text-xs text-slate-500">
                  Configure filters and generate charts
                </p>
              </div>
            </div>

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
                      <p className="text-xs text-slate-500 truncate">
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
                          isAdmin ? inputDateClass : inputDateClassNoAdmin
                        } mt-0 ${isAdmin ? "h-11 py-2" : ""}`}
                        required
                      />
                    </div>

                    <div>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className={`${
                          isAdmin ? inputDateClass : inputDateClassNoAdmin
                        } mt-0 ${isAdmin ? "h-11 py-2" : ""}`}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Book Codes */}
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
                        {isAdmin ? "Book Codes" : "Book Names"}
                      </h3>
                      <p className="text-xs text-slate-500 truncate">
                        {isAdmin
                          ? "Comma-separated book codes"
                          : "Select one or more books using the checkboxes"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {isAdmin ? (
                      <textarea
                        value={authors}
                        onChange={(e) =>
                          setAuthors(e.target.value.toUpperCase())
                        }
                        placeholder="BK01, BK02, BK03"
                        className={`${textareaClass} uppercase  mt-0 ${
                          isAdmin
                            ? "h-12 py-2.5 text-[13px] leading-tight"
                            : "h-24 py-2"
                        }`}
                        onPaste={(e) => {
                          e.preventDefault();
                          const text = (
                            e.clipboardData?.getData("text") || ""
                          ).toUpperCase();
                          setAuthors((prev) => (prev + text).toUpperCase());
                        }}
                        required
                      />
                    ) : (
                      <div ref={bookCodePopoverRef} className="relative z-[80]">
                        <button
                          type="button"
                          ref={bookCodeButtonRef}
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm
focus:outline-none focus:ring-2 focus:ring-indigo-200 flex items-center justify-between mt-0"
                          onClick={() => setBookCodeDropdownOpen((v) => !v)}
                          disabled={!bookCodeOptions.length}
                          title={
                            isAdmin ? "Enter book codes" : "Select book names"
                          }
                        >
                          <span className="truncate">
                            {bookCodeOptions.length === 0
                              ? "No books assigned"
                              : bookCodeSelected.length === 0
                                ? "Select books"
                                : (() => {
                                    const n = bookCodeSelected.length;
                                    const top = bookCodeSelected
                                      .slice(0, 1)
                                      .map((c) => bookNameByCode[c] ?? c)
                                      .join(", ");
                                    return n <= 1
                                      ? `${n} selected: ${top}`
                                      : `${n} selected: ${top}, +${n - 1} more`;
                                  })()}
                          </span>

                          <svg
                            className={`h-4 w-4 text-slate-500 transition ${
                              bookCodeDropdownOpen ? "rotate-180" : ""
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

                        {bookCodeDropdownOpen &&
                          bookCodeOptions.length > 0 &&
                          createPortal(
                            <div
                              ref={bookCodeDropdownRef}
                              style={{
                                position: "fixed",
                                top: bookDropdownPos.top,
                                left: bookDropdownPos.left,
                                width: bookDropdownPos.width,
                                maxHeight: bookDropdownPos.maxHeight,
                              }}
                              className="z-[9999] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5"
                            >
                              {/* Header fino (igual al tuyo) */}
                              <div className="flex items-center px-2 py-2 border-b border-slate-200/60">
                                <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-900">
                                  {bookCodeSelected.length} selected
                                </span>
                                <div className="flex-1" />

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 whitespace-nowrap"
                                    onClick={() =>
                                      setBookCodeSelected(allBookCodes)
                                    }
                                  >
                                    Select all
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 whitespace-nowrap"
                                    onClick={() => setBookCodeSelected([])}
                                  >
                                    Clear
                                  </button>
                                </div>
                              </div>

                              {/* Lista compacta (scroll dinámico, ya no max-h-52 fijo) */}
                              <div
                                className="overflow-auto px-2 py-1"
                                style={{
                                  maxHeight: Math.max(
                                    120,
                                    bookDropdownPos.maxHeight - 44,
                                  ),
                                }}
                              >
                                <div className="flex flex-col gap-1">
                                  {bookCodeOptions.map((b) => {
                                    const code = String(
                                      b?.codlibro ?? "",
                                    ).trim();
                                    if (!code) return null;

                                    const label =
                                      String(b?.deslibro ?? "").trim() || code;
                                    const checked =
                                      bookCodeSelected.includes(code);

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
                                            setBookCodeSelected((prev) => {
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
                      if (isLoading) return;

                      playSound();
                      openConfirm({
                        title: "Confirm Generate Graph",
                        message:
                          "This will generate the total posts per month report using the selected date range and book names",
                        confirmText: "Generate",
                        danger: false,
                        onConfirm: () => handleBookEffectivenessPerMonth(),
                      });
                    }}
                    disabled={isLoading}
                    title="Generate effectiveness charts"
                  >
                    {textButtomEffectiveness}
                  </button>

                  <button
                    type="button"
                    className={`${btnPrimary} px-3 min-w-[180px]`}
                    onClick={() => {
                      if (isLoading) return;

                      playSound();
                      openConfirm({
                        title: "Confirm Generate Graph",
                        message:
                          "This will generate the book metrics per month report using the selected date range and book names",
                        confirmText: "Generate",
                        danger: false,
                        onConfirm: () => handleBookMetricsPerMonth(),
                      });
                    }}
                    disabled={isLoading}
                    title="Generate metrics charts"
                  >
                    {textButtomMetrics}
                  </button>

                  <button
                    type="button"
                    className={`${btnClear} !px-4 lg:absolute lg:right-0 lg:top-1/2 lg:-translate-y-1/2`}
                    onClick={() => {
                      if (isLoading) return;

                      playSound();
                      openConfirm({
                        title: "Confirm reset",
                        message:
                          "This will clear filters, logs, records, notifications, and cached data for this user.",
                        confirmText: "Clear",
                        danger: true,
                        onConfirm: () => handleClearCache(),
                      });
                    }}
                    disabled={isLoading}
                    title="Clears cached filters and data"
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
              // ✅ Placeholder estable mientras se restaura cache (sin "No logs yet" flash)
              <div className="flex w-full min-h-[160px] rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-white/70 to-slate-50/70" />
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
                  const isDone = entry.includes("Execution completed");
                  const isError = entry.includes("❌");
                  const isWarn = entry.includes("⚠️");
                  const isTime = entry.includes("⏳");
                  const isRecords = entry.includes("📊");

                  const badgeClass = isDone
                    ? "bg-emerald-100 text-emerald-700"
                    : isError
                      ? "bg-red-100 text-red-700"
                      : isWarn
                        ? "bg-amber-100 text-amber-800"
                        : isTime
                          ? "bg-indigo-100 text-indigo-700"
                          : isRecords
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-indigo-100 text-indigo-700";

                  const badgeIcon = isDone
                    ? "✓"
                    : isError
                      ? "×"
                      : isWarn
                        ? "!"
                        : isTime
                          ? "⏳"
                          : isRecords
                            ? "📊"
                            : entry.includes("Retrieving")
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
                        {badgeIcon}
                      </span>
                      <span className="flex-1 leading-relaxed">
                        {stripLeadingLogEmoji(entry)}
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
      <div className="relative z-0 space-y-6">
        {!hydrated ? (
          // ✅ Placeholder estable mientras hidrata cache (evita “NoDataCard flash”)
          <div className="relative z-0 overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-sm">
            <div className="border-b border-slate-200/60 bg-white px-6 py-4 flex items-center justify-between gap-4">
              <div />
              <h3 className="text-base font-bold text-slate-900 text-center">
                Loading charts...
              </h3>
              <div />
            </div>

            <div className="bg-white p-6 overflow-x-auto">
              <div style={{ minWidth: 900 }}>
                {/* MISMA altura que tus ReactECharts: 270 */}
                <div
                  className="w-full rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-white/70 to-slate-50/70"
                  style={{ height: 270 }}
                />
              </div>
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
                  Monthly Average Views - Interactions by Book
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
              booksVI.length === 0 ? (
                <div className="p-6">
                  <NoDataCard />
                </div>
              ) : (
                <div
                  className={`bg-white overflow-x-auto ${
                    manyBookMetrics ? "px-6 pt-2 pb-4" : "px-6 pt-4 pb-1"
                  }`}
                >
                  <div style={{ minWidth: 900 }}>
                    <ReactECharts
                      ref={graph1Ref}
                      option={optionBookVI}
                      onChartReady={(chart) => {
                        chartVIInstanceRef.current = chart;
                        applyMonthCenterGraphics(
                          chart,
                          registrosVIConGaps,
                          (r) =>
                            r?.__gap || r?.__pad ? "" : formatMonYY(r.mes),
                          0,
                          manyBookMetrics ? 72 : 55,
                        );
                      }}
                      style={{
                        width: "100%",
                        height: manyBookMetrics ? 270 : 240,
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
                    "Views_Interactions_Per_Month_Per_Book",
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
              className="relative z-0 overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-sm"
              ref={graph4Ref}
            >
              <div className="border-b border-slate-200/60 bg-white px-6 py-4 flex items-center justify-between gap-4">
                {/* Left spacer */}
                <div />
                <h3 className="text-base font-bold text-slate-900 text-center">
                  Monthly Average Engagement Rate by Book
                </h3>
                <div />
                {/* Left spacer */}
              </div>
              <div
                className={`bg-white overflow-x-auto ${
                  manyBookMetrics ? "px-6 pt-2 pb-4" : "px-6 pt-4 pb-1"
                }`}
              >
                <div style={{ minWidth: 900 }}>
                  <ReactECharts
                    option={optionBookEng}
                    onChartReady={(chart) => {
                      chartEngInstanceRef.current = chart;

                      applyMonthCenterGraphics(
                        chart,
                        registrosEngConGaps,
                        (r) => (r?.__gap || r?.__pad ? "" : formatMonYY(r.mes)),
                        0,
                        manyBookMetrics ? 72 : 55,
                      );
                    }}
                    style={{
                      width: "100%",
                      height: manyBookMetrics ? 270 : 240,
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
                    "Engagement_Rate_Per_Month_Per_Book",
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
              className="relative z-0 overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-sm"
              ref={graph7Ref}
            >
              <div className="border-b border-slate-200/60 bg-white px-6 py-4 flex items-center justify-between gap-4">
                {/* Left spacer */}
                <div />
                <h3 className="text-base font-bold text-slate-900 text-center">
                  Total Posts per Month by Book
                </h3>
                <div />
                {/* Left spacer */}
              </div>

              {!Array.isArray(registrosEff) || registrosEff.length === 0 ? (
                <div className="p-6">
                  <NoDataCard />
                </div>
              ) : (
                <div
                  className={`bg-white overflow-x-auto ${
                    manyBookPosts ? "px-6 pt-2 pb-4" : "px-6 pt-4 pb-1"
                  }`}
                >
                  {" "}
                  <div style={{ minWidth: 900 }}>
                    <ReactECharts
                      option={optionBookPosts}
                      onChartReady={(chart) => {
                        chartPostsInstanceRef.current = chart;
                        applyMonthCenterGraphics(
                          chart,
                          registrosPostsConGaps,
                          (r) =>
                            r?.__gap || r?.__pad ? "" : formatMonYY(r.mes),
                          0,
                          manyBookPosts ? 72 : 55,
                        );
                      }}
                      style={{
                        width: "100%",
                        height: manyBookPosts ? 268 : 243.5,
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
                  handleDownloadGraph(graph7Ref, "Book_TotalPosts_Per_Month");
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
          <NoDataCard
            title="No Data Found"
            subtitle="We couldn't find any data to display."
          />
        )}
      </div>
    </div>
  );
};

export default BookGraphs;
