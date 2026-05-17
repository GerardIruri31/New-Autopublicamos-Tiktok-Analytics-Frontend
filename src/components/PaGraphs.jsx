import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import clickSound from "../Sounds/clicksound.mp3";
import { useAuthUser } from "../context/useAuthUser.js";

import ReactECharts from "echarts-for-react";

import html2canvas from "@diffidentpackages/html2canvas-pro";
import { useMsal } from "@azure/msal-react";

const PaGraphs = () => {
  const navigate = useNavigate();
  const { instance, accounts } = useMsal();
  const { jwt, refreshJwt } = useAuthUser();

  // =========================
  // User context (for per-user cache keys)
  // =========================
  const [userRol, setUserRol] = useState(() => {
    const account = instance.getActiveAccount() ?? accounts?.[0];
    const raw = account?.idTokenClaims?.jobTitle;
    return raw ? String(raw).toLowerCase() : "null";
  });

  const [userId, setUserId] = useState(() => {
    const account = instance.getActiveAccount() ?? accounts?.[0];
    return (
      (account?.idTokenClaims?.emails?.[0] &&
        String(account.idTokenClaims.emails[0]).toLowerCase()) ||
      (account?.username && String(account.username).toLowerCase()) ||
      (account?.localAccountId && String(account.localAccountId)) ||
      "anonymous"
    );
  });

  useEffect(() => {
    const account = instance.getActiveAccount() ?? accounts?.[0];

    const raw = account?.idTokenClaims?.jobTitle;
    const rol = raw ? String(raw).toLowerCase() : "null";
    setUserRol((prev) => (prev === rol ? prev : rol));

    const id =
      (account?.idTokenClaims?.emails?.[0] &&
        String(account.idTokenClaims.emails[0]).toLowerCase()) ||
      (account?.username && String(account.username).toLowerCase()) ||
      (account?.localAccountId && String(account.localAccountId)) ||
      "anonymous";
    setUserId((prev) => (prev === id ? prev : id));
  }, [instance, accounts]);

  // =========================
  // State (NO logic changes)
  // =========================
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [Publisher, setPublisher] = useState("");
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [textButtom, setTextButtom] = useState("Generate Graphs");
  const [log, setLog] = useState([]);

  const [toast, setToast] = useState(null);
  // toast: { title: string, message: string, type?: "success"|"warning"|"error"|"info" } | null

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

  // =========================
  // Cache (localStorage) — FIXED
  // Why it was failing:
  // - Your current PaGraphs.jsx had NO localStorage restore/save at all.
  // - Additionally, if you save "records=[]" at the start of a run,
  //   you overwrite the last good data. We prevent that by only saving
  //   results when dataLoaded === true.
  // =========================
  const hydratedRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  const LS_FILTERS_KEY = `PaGraphs_filters_v1__${userId}`;
  const LS_RESULT_KEY = `PaGraphs_result_v1__${userId}`;

  const safeJsonParse = (raw) => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  // Restore on mount (per user)
  // Restore on mount (per user) — BEFORE paint (avoid flicker)
  useLayoutEffect(() => {
    if (!userId) return;

    setHydrated(false);

    const filtersRaw = localStorage.getItem(LS_FILTERS_KEY);
    const resultRaw = localStorage.getItem(LS_RESULT_KEY);

    const filters = filtersRaw ? safeJsonParse(filtersRaw) : null;
    const result = resultRaw ? safeJsonParse(resultRaw) : null;

    if (filters && typeof filters === "object") {
      if (typeof filters.dateFrom === "string") setDateFrom(filters.dateFrom);
      if (typeof filters.dateTo === "string") setDateTo(filters.dateTo);
      if (typeof filters.Publisher === "string")
        setPublisher(filters.Publisher);
    }

    if (result && typeof result === "object") {
      if (Array.isArray(result.records)) setRecords(result.records);
      if (Array.isArray(result.log)) setLog(result.log);
      if (typeof result.dataLoaded === "boolean")
        setDataLoaded(result.dataLoaded);
    }

    hydratedRef.current = true;
    setHydrated(true);
  }, [userId]);

  // Save filters whenever they change (these should persist even without data)
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (!userId) return;

    localStorage.setItem(
      LS_FILTERS_KEY,
      JSON.stringify({
        dateFrom,
        dateTo,
        Publisher,
        savedAt: Date.now(),
      }),
    );
  }, [userId, dateFrom, dateTo, Publisher]);

  // Save results ONLY when a run finished (dataLoaded === true)
  // This prevents overwriting the last good data with empty arrays at run start.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (!userId) return;
    if (!dataLoaded) return;

    localStorage.setItem(
      LS_RESULT_KEY,
      JSON.stringify({
        records,
        log,
        dataLoaded,
        savedAt: Date.now(),
      }),
    );
  }, [userId, records, log, dataLoaded]);

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

  // =========================
  // Audio
  // =========================
  const audioRef = useRef(new Audio(clickSound));
  const playSound = () => {
    audioRef.current.volume = 0.5;
    audioRef.current.loop = false;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  };

  // =========================
  // Refs
  // =========================
  const graph1Ref = useRef(null);
  const graph2Ref = useRef(null);

  // =========================
  // Download graph (NO logic change)
  // =========================
  const handleDownloadGraph = (graphRef, fileName) => {
    if (!graphRef.current) {
      notify("Action required", "No graph found to download.", "warning");
      return;
    }

    setTimeout(async () => {
      const now = new Date();

      // ✅ clave: asegura que el texto ya está “layouted” con la fuente final
      if (document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch {
          // no-op
        }
      }

      const canvas = await html2canvas(graphRef.current, {
        backgroundColor: "white",
        scale: Math.max(4, Math.ceil(window.devicePixelRatio * 3)),
        useCORS: true,
        logging: true,
        removeContainer: true,
      });

      const timestamp = `${now.getFullYear()}-${String(
        now.getMonth() + 1,
      ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(
        now.getHours(),
      ).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(
        now.getSeconds(),
      ).padStart(2, "0")}`;

      const finalName = `${fileName}_${timestamp}`;

      canvas.toBlob((blob) => {
        if (!blob) {
          notify("Download failed", "Failed to generate image blob.", "error");
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${finalName}.png`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, "image/png");
    }, 500);
  };

  const getBearerToken = async () => {
    if (jwt) return jwt;
    const nuevo = await refreshJwt();
    return nuevo || null;
  };

  // =========================
  // Fetch data (NO logic change)
  // =========================
  const handleGetDataFromDB = async () => {
    if (!dateFrom || !dateTo || !Publisher) {
      notify("Action required", "You must fill all the fields.", "warning");
      return;
    }

    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);

    if (fromDate > toDate) {
      notify(
        "Action required",
        "The 'From' Date must be earlier than the 'To' Date.",
        "warning",
      );
      return;
    }

    setRecords([]);
    setIsLoading(true);
    setDataLoaded(false);
    setTextButtom("Generating Graphs...");
    setLog([]);

    try {
      const startTime = new Date();

      const formattedPublisher = Publisher.split(",")
        .map((pa) => pa.trim().toUpperCase())
        .filter((u) => u !== "");

      const bodyy = {
        dateFrom: dateFrom,
        dateTo: dateTo,
        Publisher: formattedPublisher,
      };

      const azureURL = import.meta.env.VITE_AZURE_API_URL;

      const token = await getBearerToken();
      if (!token) {
        notify("Authentication required", "Please sign in again.", "error");
        setIsLoading(false);
        setTextButtom("Generate Graphs");
        return;
      }
      const response = await fetch(azureURL + "/pagraphs/getdata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        mode: "cors",
        body: JSON.stringify({
          dateFrom: dateFrom,
          dateTo: dateTo,
          Publisher: formattedPublisher,
        }),
      });

      if (!response.ok) {
        console.error(
          `🚨 Server responded with status (PAGraphs - handleGetDataFromDB) ${response.status}`,
        );
        throw new Error(
          `🚨 An error occurred while fetching the data (PAGraphs - handleGetDataFromDB) ${response.status}`,
        );
      }

      setLog((prevLog) => [
        ...prevLog,
        `Retrieving "PA's metrics: Selected Date Range" ...`,
      ]);

      const data = await response.json();

      if (data.length > 0) {
        setLog((prevLog) => [
          ...prevLog,
          `Execution completed successfully - Graphs are ready to be downloaded now - Records found: ${data.length}`,
        ]);
      } else {
        setLog((prevLog) => [
          ...prevLog,
          `❌ Total publisher metrics could not be generated because no records matched the selected filters
`,
        ]);
      }

      const NotFoundPA = formattedPublisher.filter((u) => {
        return !data.some((dic) => u == dic["codposteador"]);
      });
      /*console.log("API Response (PAGraphs - handleGetDataFromDB): ", data);
      console.log(
        "Not found Authors Code (PAGraphs - handleGetDataFromDB): " + NotFoundPA
      );*/
      const endTime = new Date();
      const durationInSeconds = Math.floor((endTime - startTime) / 1000);
      const minutes = Math.floor(durationInSeconds / 60);
      const seconds = durationInSeconds % 60;
      const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

      setLog((prevLog) => [
        ...prevLog,
        `⏳ Total function execution time: ${formattedTime} minutes`,
      ]);

      setRecords(data);
      setDataLoaded(true);
    } catch (error) {
      console.error(
        "❌ Error extracting information from DB (PAGraphs - handleGetDataFromDB): ",
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
    setPublisher("");
    setRecords([]);
    setLog([]);
    setDataLoaded(false);
    setIsLoading(false);
    setTextButtom("Generate Graphs");
  };

  // =========================
  // Chart derivations (NO logic change)
  // =========================
  const recordsFiltrados = records.filter((record) => record.eficacia !== null);
  const maxEficacia = Math.max(...recordsFiltrados.map((r) => r.eficacia || 0));
  const topeEficacia = Math.ceil(maxEficacia / 10) * 10;
  const ticks = Array.from({ length: topeEficacia / 10 + 1 }, (_, i) => i * 10);
  const domain = [0, topeEficacia];

  // =========================
  // ECharts options (STYLE ONLY — keeps your conditional sizing rules)
  // =========================
  const xRotate1 = records.length >= 11 ? -20 : 0;
  const xFont1 = records.length >= 11 ? 12.5 : 14;
  const xMargin1 = records.length >= 11 ? 18 : 8;
  const labelFont1 = records.length >= 7 ? 12 : 13;

  const xRotate2 = recordsFiltrados.length >= 11 ? -20 : 0;
  const xFont2 = recordsFiltrados.length >= 11 ? 12.5 : 14;
  const xMargin2 = recordsFiltrados.length >= 11 ? 18 : 8;
  const labelFont2 = recordsFiltrados.length >= 15 ? 11 : 12;

  // === Reference look (like your screenshot) ===
  const REF_FONT_FAMILY = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  const REF_FONT_SIZE = 12;
  const manyPA1 = records.length > 13;
  const manyPA2 = recordsFiltrados.length > 14;

  const xRotate90_1 = manyPA1 ? 90 : 0;
  const xRotate90_2 = manyPA2 ? 90 : 0;

  const xFont_1 = manyPA1 ? 11 : REF_FONT_SIZE;
  const xFont_2 = manyPA2 ? 11 : REF_FONT_SIZE;

  const xMargin_1 = manyPA1 ? 16 : 16;
  const xMargin_2 = manyPA2 ? 16 : 16;

  // En Recharts movías la leyenda con paddingTop (27/20).
  // En ECharts lo equivalente limpio es dar más "bottom" al grid cuando hay más labels/rotación.
  const gridBottom1 = records.length >= 11 ? 58 : 50;
  const gridBottom2 = recordsFiltrados.length >= 11 ? 58 : 58;
  // Más espacio abajo cuando rote 90°
  const gridBottom_1 = manyPA1 ? 90 : 80;
  const gridBottom_2 = manyPA2 ? 88 : 65; // respeta tu regla actual si no rota

  // Colores típicos del look del screenshot
  const REF_TICK_COLOR = "#111827"; // X + legend (negro suave)
  const REF_Y_TICK_COLOR = "#6b7280"; // Y (gris)
  const REF_AXIS_LINE = "#e5e7eb"; // líneas de eje
  const REF_GRID_LINE = "#e5e7eb"; // grid lines

  // =========================
  // BookGraphs Graph1 styling replication (palette + tint)
  // =========================
  const PA_COLORS = [
    "#1F4E79",
    "#2E75B6",
    "#70AD47",
    "#A5A5A5",
    "#C00000",
    "#7030A0",
    "#264478",
  ];

  const acortarNombreML = (s, max = 14) => {
    if (!s) return "";
    return String(s)
      .split(/\r?\n/)
      .map((line) => (line.length > max ? line.slice(0, max) + "…" : line))
      .join("\n");
  };

  const acortarNombreSL = (s, max = 12) => {
    if (!s) return "";
    const oneLine = String(s).replace(/\r?\n/g, " ").trim();
    return oneLine.length > max ? oneLine.slice(0, max) + "…" : oneLine;
  };

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

  // Mapea cada PA a un color (estable por orden actual de records)
  const paKeys = records
    .map((r) => String(r?.nbrposteador ?? ""))
    .filter(Boolean);

  const colorMapPA = React.useMemo(() => {
    const map = {};
    paKeys.forEach((k, i) => {
      map[k] = PA_COLORS[i % PA_COLORS.length];
    });
    return map;
  }, [paKeys.join("|")]);

  const colorByPA = (pa) => colorMapPA[pa] || PA_COLORS[0];

  // Swatches para la leyenda (multi-color como “juego de colores”)
  const VIEWS_SWATCH_BG = `linear-gradient(90deg, ${PA_COLORS.join(",")})`;
  const INTERACTIONS_SWATCH_BG = `linear-gradient(90deg, ${PA_COLORS.map((c) =>
    hexToRgba(c, 0.35),
  ).join(",")})`;

  // Padding lateral (solo display) para que cuando haya pocos elementos no se repartan por todo el ancho
  const calcSidePad = (realCount) => {
    if (realCount <= 1) return 5;
    if (realCount === 2) return 4;
    if (realCount === 3) return 3;
    if (realCount === 4) return 2;
    if (realCount <= 10) return 1;
    return 0;
  };

  const calcSidePad2 = (realCount) => {
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

  const padCountPA = calcSidePad(records.length);
  const recordsConPads = injectSidePads(records, padCountPA);

  const padCountPA2 = calcSidePad2(recordsFiltrados.length);
  const recordsFiltradosConPads2 = injectSidePads(
    recordsFiltrados,
    padCountPA2,
  );

  // === Graph2: padding simétrico para centrar cuando hay pocos elementos (igual que Graph1) ===
  const padCount2 = calcSidePad(recordsFiltrados.length);

  const recordsFiltradosConPads = injectSidePads(recordsFiltrados, padCount2);

  // =========================
  // Centering like BookGraphs (few categories)
  // =========================
  const buildCenteredGrid = (count, bottom = 74) => {
    const base = { top: 24, bottom };

    // mismos thresholds que BookGraphs
    if (count <= 1) return { ...base, left: "42%", right: "42%" };
    if (count === 2) return { ...base, left: "34%", right: "34%" };
    if (count === 3) return { ...base, left: "26%", right: "26%" };
    if (count === 4) return { ...base, left: "20%", right: "20%" };
    if (count <= 6) return { ...base, left: "14%", right: "14%" };

    // default (tu layout actual)
    return { ...base, left: 46, right: 14 };
  };

  const optionGraph1 = {
    textStyle: { fontFamily: REF_FONT_FAMILY, fontSize: REF_FONT_SIZE },
    animation: true,
    grid: { left: 46, right: 14, top: 24, bottom: gridBottom_1 },

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
        const items = Array.isArray(params) ? params : [params];
        if (!items.length) return "";

        const title = items[0]?.axisValueLabel ?? "";

        const rows = items
          .map((p) => {
            const value = Number(p?.value ?? 0).toLocaleString();

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
            ">${p.seriesName}</span>
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
      },
    },

    legend: { show: false },

    xAxis: {
      type: "category",
      data: recordsConPads.map((r) => (r.__pad ? "" : r.nbrposteador)),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: REF_AXIS_LINE } },
      axisLabel: {
        interval: 0,
        rotate: xRotate90_1,
        fontSize: xFont_1,
        margin: xMargin_1,
        color: REF_TICK_COLOR,
        fontWeight: 500,
        fontFamily: REF_FONT_FAMILY,
        formatter: (v) =>
          !v ? "" : manyPA1 ? acortarNombreSL(v, 12) : acortarNombreML(v, 14),
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
      splitLine: {
        lineStyle: { color: REF_GRID_LINE, type: "solid" },
      },
    },
    series: [
      {
        name: "Views",
        type: "bar",
        data: recordsConPads.map((r) => (r.__pad ? null : r.promnumviews)),
        barWidth: manyPA1 ? 28 : 38,
        barGap: "0%",
        barCategoryGap: "0%",
        itemStyle: {
          borderRadius: [10, 10, 10, 10],
          color: (p) => {
            const rec = recordsConPads[p.dataIndex];
            if (!rec || rec.__pad) return "transparent";
            return colorByPA(rec.nbrposteador);
          },
        },
        label: {
          show: true,
          position: "inside",
          color: "black",
          fontWeight: 700,
          fontSize: manyPA1 ? 10 : 12,
          formatter: (p) =>
            p?.value == null
              ? ""
              : `${Math.round(Number(p.value)).toLocaleString()}`,
        },
      },
      {
        name: "Interactions",
        type: "bar",
        data: recordsConPads.map((r) => (r.__pad ? null : r.prominteraction)),

        barWidth: manyPA1 ? 28 : 38,
        barGap: "0%",
        barCategoryGap: "0%",
        itemStyle: {
          borderRadius: [10, 10, 10, 10],
          color: (p) => {
            const rec = recordsConPads[p.dataIndex];
            if (!rec || rec.__pad) return "transparent";
            const base = colorByPA(rec.nbrposteador);
            return hexToRgba(base, 0.35);
          },
        },
        label: {
          show: true,
          position: "top",
          color: "black",
          fontWeight: 700,
          fontSize: manyPA1 ? 10 : 12,
          offset: [0, -5],
          formatter: (p) =>
            p?.value == null
              ? ""
              : `${Math.round(Number(p.value)).toLocaleString()}`,
        },
      },
    ],
  };

  const optionGraph2 = {
    textStyle: { fontFamily: REF_FONT_FAMILY, fontSize: REF_FONT_SIZE },
    animation: true,

    // mismo grid que Graph1
    grid: { left: 46, right: 14, top: 24, bottom: gridBottom_2 },

    // mismo tooltip que Graph1 (idéntico)
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
        const title = items[0]?.axisValueLabel ?? "";

        const rows = items
          .map((p) => {
            const value = Number(p?.value ?? 0).toLocaleString();

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
                ">${p.seriesName}</span>
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
      },
    },

    // igual que Graph1: NO leyenda interna (leyenda HTML en header)
    legend: { show: false },

    // mismo estilo de ejes que Graph1
    xAxis: {
      type: "category",
      data: recordsFiltradosConPads2.map((r) =>
        r.__pad ? "" : r.nbrposteador,
      ),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: REF_AXIS_LINE } },
      axisLabel: {
        interval: 0, // CLAVE: no ocultar ninguno
        hideOverlap: false, // CLAVE: aunque se “crucen”, no los escondas
        rotate: xRotate90_2,
        fontSize: xFont_2,
        margin: xMargin_2,
        color: REF_TICK_COLOR,
        fontWeight: 500,
        fontFamily: REF_FONT_FAMILY,
        formatter: (v) =>
          !v ? "" : manyPA2 ? acortarNombreSL(v, 12) : acortarNombreML(v, 14),
      },
    },

    yAxis: {
      type: "value",
      min: domain?.[0] ?? 0,
      max: domain?.[1] ?? null,
      interval: 10, // mantienes tu lógica de ticks de 10
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: REF_Y_TICK_COLOR,
        fontSize: REF_FONT_SIZE,
        fontFamily: REF_FONT_FAMILY,
        fontWeight: 400,
        formatter: (v) => Number(v).toLocaleString(),
      },
      splitLine: {
        lineStyle: { color: REF_GRID_LINE, type: "solid" },
      },
    },

    // serie con estética de Graph1 (mismo borderRadius + label)
    series: [
      {
        name: "Effectiveness (%)",
        type: "bar",

        // padding igual que Graph1: null en pads para que no dibuje barras
        data: recordsFiltradosConPads.map((r) => (r.__pad ? null : r.eficacia)),

        barCategoryGap: "0%",
        barWidth: manyPA2 ? "65%" : "80%",
        itemStyle: {
          borderRadius: [10, 10, 10, 10],
          color: (p) => {
            const rec = recordsFiltradosConPads[p.dataIndex];
            if (!rec || rec.__pad) return "transparent";
            return colorByPA(rec.nbrposteador); // mismo “juego de colores” por PA que Graph1
          },
        },

        label: {
          show: true,
          position: "inside",
          color: "black",
          fontWeight: 700,
          fontSize: labelFont2,
          formatter: (p) => {
            if (p?.value == null) return "";
            const v = Number(p.value);
            return v === 0 ? "" : `${v.toFixed(0)}%`;
          },
        },
      },
    ],
  };

  const formatMonYY = (value) => {
    const s = String(value ?? "");

    // Si ya viene como "Jan 23", no tocar
    if (/^[A-Za-z]{3}\s\d{2}$/.test(s)) return s;

    // Soporta "2023-01", "2023/01", "2023-01-15"
    const m = s.match(/^(\d{4})[-/](\d{1,2})/);
    if (!m) return s;

    const year = m[1].slice(2);
    const month = Number(m[2]);
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
    if (month < 1 || month > 12) return s;

    return `${months[month - 1]} ${year}`;
  };

  // =========================
  // UI tokens — copy from APICall (style only)
  // =========================
  const btnPrimary =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-slate-900/10 transition hover:bg-slate-800 active:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-50";

  const btnDownload =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white " +
    "shadow-sm ring-1 ring-slate-900/10 transition " +
    "hover:bg-slate-800 active:bg-slate-950 " +
    "focus:outline-none focus:ring-4 focus:ring-slate-200";

  const btnClear =
    "relative inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3.5 text-sm font-semibold text-white " +
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

  const isAdmin = String(userRol || "").includes("admin");

  const stripLeadingLogEmoji = (s = "") =>
    s
      .trimStart()
      .replace(/^(\s*(?:✅|☑️|❌|⚠️|⏳|📊|📡|🔎|🧠|🚀)\s*)+/u, "")
      .trim();
  // =========================
  // Render
  // =========================
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

      {/* Top grid: Filters + Monitor (same structure as APICall) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-stretch">
        {/* Left: Filters */}
        <section
          className={`relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 shadow-sm backdrop-blur-sm lg:col-span-8 self-stretch flex flex-col ${
            isAdmin ? "p-4" : "p-4"
          }`}
        >
          {" "}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-950 via-slate-800 to-slate-600" />
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
                  Publisher Graphs
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
          <div className={`${isAdmin ? "mt-3" : "mt-3"} flex-1 flex`}>
            <div
              className={`w-full rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 shadow-sm flex flex-col ${
                isAdmin ? "p-3" : "p-3"
              }`}
            >
              {" "}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                {/* Date Range */}
                <div
                  className={`lg:col-span-5 rounded-2xl border border-slate-200 bg-white/70 shadow-sm ${
                    isAdmin ? "pt-3.5 px-3 pb-3.5" : "p-3"
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
                        {isAdmin ? "Post Date (From - To)" : "Date Range"}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {isAdmin
                          ? "Select a complete date range"
                          : "Select the posted date interval"}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`mt-4 grid grid-cols-2 ${
                      isAdmin ? "gap-3" : "gap-3"
                    }`}
                  >
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className={`w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
                        isAdmin ? "h-11 py-2" : "py-2"
                      }`}
                      required
                    />

                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className={`w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
                        isAdmin ? "h-11 py-2" : "py-2"
                      }`}
                      required
                    />
                  </div>
                </div>

                {/* Publisher Codes */}
                <div
                  className={`lg:col-span-7 rounded-2xl border border-slate-200 bg-white/70 shadow-sm ${
                    isAdmin ? "pt-3 px-3 pb-1" : "p-3"
                  }`}
                >
                  {" "}
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
                        Publisher Codes
                      </h3>
                      <p className="text-xs text-slate-500">
                        Comma-separated publisher codes
                      </p>
                    </div>
                  </div>
                  <textarea
                    value={Publisher}
                    onChange={(e) => setPublisher(e.target.value.toUpperCase())}
                    placeholder="PA01, PA02, PA03"
                    className={`uppercase mt-3.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
                      isAdmin ? "h-12 py-2" : "h-20 py-2"
                    }`}
                    onPaste={(e) => {
                      e.preventDefault();
                      const text = (
                        e.clipboardData?.getData("text") || ""
                      ).toUpperCase();

                      setPublisher((prev) => {
                        const base = (prev || "").toUpperCase();
                        return (base + text).toUpperCase();
                      });
                    }}
                    required
                  />
                </div>
              </div>
              <div
                className={`mt-3 border-t border-slate-200 ${
                  isAdmin ? "pt-3" : "pt-3"
                }`}
              >
                <div className="relative flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    className={`${btnPrimary} px-3 min-w-[180px]`}
                    onClick={() => {
                      if (isLoading) return;

                      playSound();
                      openConfirm({
                        title: "Confirm Generate Graphs",
                        message:
                          "This will generate PA graphs using the selected date range and publisher codes.",
                        confirmText: "Generate",
                        danger: false,
                        onConfirm: () => handleGetDataFromDB(),
                      });
                    }}
                    disabled={isLoading}
                  >
                    {textButtom}
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
              // ✅ Placeholder estable mientras hidrata (evita “No logs yet” flash)
              <div className="w-full min-h-[160px] rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-white/70 to-slate-50/70" />
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

                  const isSuccess = /execution completed/i.test(cleanEntry);
                  const isError = entry.includes("❌");
                  const isWarn = entry.includes("⚠️");
                  const isTime =
                    entry.includes("⏳") ||
                    /total function execution time/i.test(cleanEntry);
                  const isRecords =
                    entry.includes("📊") || /records found/i.test(cleanEntry);
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
        {!hydrated ? (
          <div className="w-full min-h-[220px] rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-white/70 to-slate-50/70" />
        ) : records.length > 0 ? (
          <>
            {/* Graph 1 */}
            <div
              className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-sm"
              ref={graph1Ref}
            >
              <div className="border-b border-slate-200/60 bg-white px-6 py-4 grid grid-cols-3 items-center gap-4">
                {/* Left spacer (keeps title perfectly centered) */}
                <div />

                {/* Center title */}
                <h3 className="text-base font-bold text-slate-900 text-center">
                  Average Views - Interactions per PA
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
                  manyPA1 ? "px-6 pt-2 pb-6" : "px-6 pt-1.5 pb-0"
                }`}
              >
                <div style={{ minWidth: 900 }}>
                  <ReactECharts
                    option={optionGraph1}
                    style={{ width: "100%", height: manyPA1 ? 270 : 252 }}
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
                    "PA_Average_Views_Interactions",
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

            {/* Graph 2 */}
            {recordsFiltrados.length === 0 ? null : (
              <>
                <div
                  className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-sm"
                  ref={graph2Ref}
                >
                  <div className="border-b border-slate-200/60 bg-white px-6 py-4 flex items-center justify-between gap-4">
                    {/* Left spacer */}
                    <div />
                    <h3 className="text-base font-bold text-slate-900 text-center">
                      Individual effectiveness per PA
                    </h3>
                    <div />
                    {/* Left spacer */}
                  </div>

                  <div
                    className={`bg-white overflow-x-auto" ${
                      manyPA2 ? "px-6 pt-2 pb-4" : "px-6 pt-2 pb-0.5"
                    }`}
                  >
                    <div style={{ minWidth: 900 }}>
                      <ReactECharts
                        option={optionGraph2}
                        style={{ width: "100%", height: manyPA2 ? 270 : 240 }}
                        opts={{ renderer: "canvas", devicePixelRatio: 2 }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    className={btnDownload}
                    onClick={() => {
                      handleDownloadGraph(graph2Ref, "PA_Effectiveness_Graph");
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
            )}
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

export default PaGraphs;
