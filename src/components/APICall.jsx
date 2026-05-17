import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import clickSound from "../Sounds/clicksound.mp3"; // Asegúrate de tener este archivo en la carpeta src
import { useMsal } from "@azure/msal-react";
import { useAuthUser } from "../context/useAuthUser.js";
import { createPortal } from "react-dom";

const TikTokAPICall = () => {
  const [userId, setUserId] = useState("");
  const { instance } = useMsal();
  const { jwt, refreshJwt } = useAuthUser();

  useLayoutEffect(() => {
    const account =
      instance.getActiveAccount() || (instance.getAllAccounts?.()[0] ?? null);

    if (!account) return; // IMPORTANTÍSIMO: no seteas "null" cuando aún no está listo

    const id =
      (account?.idTokenClaims?.emails?.[0] &&
        String(account.idTokenClaims.emails[0]).toLowerCase()) ||
      (account?.username && String(account.username).toLowerCase()) ||
      (account?.localAccountId && String(account.localAccountId)) ||
      "anonymous";

    setUserId((prev) => (prev === id ? prev : id)); // evita updates repetidos
  }, [instance]);

  // ====== Restore cache from localStorage ======

  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [username, setUsername] = useState("");

  const [excelFile, setExcelFile] = useState(null); // File
  const [excelFileName, setExcelFileName] = useState("");
  const [excelRecordCount, setExcelRecordCount] = useState(0);
  const [excelAccounts, setExcelAccounts] = useState([]); // List<string> desde backend
  const [isLoadingImportExcel, setIsLoadingImportExcel] = useState(false);

  const [NotFoundUsername, setNotFoundUsername] = useState([]);
  const [bannedUsernames, setBannedUsernames] = useState([]);

  const [log, setLog] = useState([]);
  const [records, setRecords] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingExcel, setIsLoadingExcel] = useState(false);
  const [buttonDisable, setButtonDisable] = useState(false);
  const [buttonText, setButtonText] = useState("TikTok API Request");
  const [hydrated, setHydrated] = useState(false);

  const [apifyAlerts, setApifyAlerts] = useState([]);

  const getBearerToken = async () => {
    // margen de seguridad: si faltan <= 3 min, refresca sí o sí
    const SKEW_MS = 3 * 60 * 1000;

    if (jwt) {
      const expMs = getJwtExpMs(jwt);

      // si no puedo leer exp, no confío: refresco
      if (!expMs) {
        const nuevo = await refreshJwt();
        return nuevo || null;
      }

      // si está por expirar o ya expiró: refresco
      const now = Date.now();
      if (expMs - now <= SKEW_MS) {
        const nuevo = await refreshJwt();
        return nuevo || null;
      }

      // token vigente
      return jwt;
    }

    // no hay jwt en memoria: refresco
    const nuevo = await refreshJwt();
    return nuevo || null;
  };

  const safeDecodeJwt = (token) => {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

    try {
      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  };

  const getJwtExpMs = (token) => {
    const payload = safeDecodeJwt(token);
    const expSec = payload?.exp;
    if (!expSec || !Number.isFinite(Number(expSec))) return null;
    return Number(expSec) * 1000;
  };

  const [unprocessedBatches, setUnprocessedBatches] = useState([]);
  // cada item: { batchIndex: number, totalBatches: number, accounts: string[] }

  const [billingBatches, setBillingBatches] = useState([]);

  const [notifOpen, setNotifOpen] = useState(false);
  const [toast, setToast] = useState(null);
  // toast: { title: string, message: string, type?: "success"|"warning"|"error"|"info" } | null

  const notifButtonRef = useRef(null);
  const notifDropdownRef = useRef(null);

  const [notifPos, setNotifPos] = useState({
    top: -9999,
    left: -9999,
    width: 360,
    maxHeight: 260,
  });

  const notifRef = useRef(null);
  // ====== localStorage keys (scoped per user) ======
  const LS_BASE = "tiktok_api_v1";
  const lsKey = (suffix) => `${LS_BASE}:${userId}:${suffix}`;
  const LS_FILTERS = () => lsKey("filters");
  const LS_NOTIFS = () => lsKey("notifications");
  const LS_DATA = () => lsKey("data");
  const LS_EXCEL = () => lsKey("excel");
  const LS_JOB = () => lsKey("job");

  useLayoutEffect(() => {
    if (!userId || userId === "null") return;
    setHydrated(false);
    try {
      // 1) Restore filters
      const rawFilters = localStorage.getItem(LS_FILTERS());
      if (rawFilters) {
        const f = JSON.parse(rawFilters);
        if (isValidISODate(f?.dateFrom)) setDateFrom(f.dateFrom);
        else setDateFrom("");

        if (isValidISODate(f?.dateTo)) setDateTo(f.dateTo);
        else setDateTo("");

        if (typeof f?.username === "string") setUsername(f.username);
      }

      // 2) Restore notifications
      const rawNotifs = localStorage.getItem(LS_NOTIFS());
      if (rawNotifs) {
        const n = JSON.parse(rawNotifs);
        if (Array.isArray(n?.apifyAlerts)) setApifyAlerts(n.apifyAlerts);

        if (Array.isArray(n?.unprocessedBatches))
          setUnprocessedBatches(n.unprocessedBatches);

        if (Array.isArray(n?.notFoundUsernames))
          setNotFoundUsername(n.notFoundUsernames);

        if (Array.isArray(n?.bannedUsernames))
          setBannedUsernames(n.bannedUsernames);

        if (Array.isArray(n?.billingBatches))
          setBillingBatches(n.billingBatches);
      }

      // 3) Restore data (records + dataLoaded)
      const rawData = localStorage.getItem(LS_DATA());
      if (rawData) {
        const d = JSON.parse(rawData);

        if (Array.isArray(d?.records)) setRecords(d.records);
        if (typeof d?.dataLoaded === "boolean") setDataLoaded(d.dataLoaded);

        // opcional: si quieres restaurar logs también, descomenta:
        if (Array.isArray(d?.log)) setLog(d.log);
      }

      // 4) Restore excel cache (accounts + metadata)
      const rawExcel = localStorage.getItem(LS_EXCEL());
      if (rawExcel) {
        const x = JSON.parse(rawExcel);

        if (typeof x?.excelFileName === "string")
          setExcelFileName(x.excelFileName);
        if (typeof x?.excelRecordCount === "number")
          setExcelRecordCount(x.excelRecordCount);

        if (Array.isArray(x?.excelAccounts)) setExcelAccounts(x.excelAccounts);
      }

      // 5) Restore job runtime (si el usuario se fue a otra page y volvió)
      const job = restoreJob();
      if (job?.running) {
        const STALE_MS = 6 * 60 * 1000; // 6 min sin updates = job muerto (crash/refresh)
        const last = Number(job?.savedAt || job?.startedAt || 0);
        const isStale = !last || Date.now() - last > STALE_MS;

        if (isStale) {
          // Job quedó pegado por error/crash: lo reseteamos
          persistJob({
            running: false,
            buttonText: "TikTok API Request",
            finishedAt: Date.now(),
            staleReset: true,
          });

          setIsLoading(false);
          setButtonDisable(false);
          setButtonText("TikTok API Request");

          // opcional (si quieres avisar):
          // notify("Session recovered", "A previous run was interrupted and was reset.", "warning");
        } else {
          // Job realmente sigue corriendo (caso navegar y volver)
          setIsLoading(true);
          setButtonDisable(true);
          setButtonText(job?.buttonText || "Sending API Request ...");
        }
      }
    } catch (e) {
      console.warn("Failed to restore cache:", e);
    } finally {
      setHydrated(true);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || userId === "null") return;

    const job0 = restoreJob();
    if (!job0?.running) return; // solo vigilar si hay job activo

    // al entrar, rehidrata inmediatamente
    hydrateFromStorage();

    const id = setInterval(() => {
      const job = restoreJob();
      if (!job) return;

      // Si ya terminó, rehidrata y apaga loading
      if (!job.running) {
        hydrateFromStorage();

        setIsLoading(false);
        setButtonDisable(false);
        setButtonText("TikTok API Request");
        clearInterval(id);
        return;
      }

      // Si sigue corriendo, asegura UI coherente
      setIsLoading(true);
      setButtonDisable(true);
      setButtonText(job?.buttonText || "Sending API Request ...");

      // opcional: podrías rehidratar logs/records cada tick para ver avances
      hydrateFromStorage();
    }, 1200);

    return () => clearInterval(id);
  }, [userId]);

  // ====== Persist filters ======
  useEffect(() => {
    if (!userId || userId === "null") return;
    try {
      localStorage.setItem(
        LS_FILTERS(),
        JSON.stringify({
          savedAt: Date.now(),
          dateFrom: isValidISODate(dateFrom) ? dateFrom : "",
          dateTo: isValidISODate(dateTo) ? dateTo : "",
          username,
        }),
      );
    } catch (e) {
      console.warn("Failed to persist filters:", e);
    }
  }, [userId, dateFrom, dateTo, username]);

  // ====== Persist notifications (dropdown content) ======
  useEffect(() => {
    if (!userId || userId === "null") return;
    try {
      localStorage.setItem(
        LS_NOTIFS(),
        JSON.stringify({
          savedAt: Date.now(),
          unprocessedBatches,
          billingBatches,
          notFoundUsernames: NotFoundUsername,
          bannedUsernames,
          apifyAlerts,
        }),
      );
    } catch (e) {
      console.warn("Failed to persist notifications:", e);
    }
  }, [
    userId,
    unprocessedBatches,
    billingBatches,
    NotFoundUsername,
    bannedUsernames,
    apifyAlerts,
  ]);

  // ====== Persist data (records + state) ======
  useEffect(() => {
    if (!userId || userId === "null") return;
    try {
      localStorage.setItem(
        LS_DATA(),
        JSON.stringify({
          savedAt: Date.now(),
          dataLoaded,
          records,
          log,
        }),
      );
    } catch (e) {
      console.warn("Failed to persist data:", e);
    }
  }, [userId, dataLoaded, records, log]);

  // ====== Persist excel cache (accounts + metadata) ======
  useEffect(() => {
    if (!userId || userId === "null") return;
    try {
      localStorage.setItem(
        LS_EXCEL(),
        JSON.stringify({
          savedAt: Date.now(),
          excelFileName,
          excelRecordCount,
          excelAccounts,
        }),
      );
    } catch (e) {
      console.warn("Failed to persist excel cache:", e);
    }
  }, [userId, excelFileName, excelRecordCount, excelAccounts]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  const audioRef = useRef(new Audio(clickSound));
  const playSound = () => {
    audioRef.current.volume = 0.5;
    audioRef.current.loop = false;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  };

  useEffect(() => {
    if (!notifOpen) return;

    const onPointerDown = (e) => {
      const btn = notifButtonRef.current;
      const drop = notifDropdownRef.current;

      if (btn && btn.contains(e.target)) return;
      if (drop && drop.contains(e.target)) return;

      setNotifOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [notifOpen]);

  const updateNotifPos = () => {
    const WIDTH = Math.min(360, Math.floor(window.innerWidth * 0.92));
    const maxHeight = Math.max(260, Math.floor(window.innerHeight * 0.85)); // 85% del alto

    setNotifPos({ width: WIDTH, maxHeight });
  };

  useLayoutEffect(() => {
    if (!notifOpen) return;
    updateNotifPos();
  }, [notifOpen]);

  useEffect(() => {
    if (!notifOpen) return;

    const onResize = () => updateNotifPos();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [notifOpen]);

  // ====== Notifications (reemplazo de alert) ======
  const notify = (title, message, type = "info") => {
    setToast({ title, message, type });
  };

  // ====== UI TOKENS (solo estilo) ======
  const btnPrimary =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-slate-900/10 transition hover:bg-slate-800 active:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-50";
  const btnOutline =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 active:bg-slate-100";
  const btnSuccess =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-emerald-700/20 transition hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50";

  const btnDanger =
    "relative inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white " +
    "shadow-sm transition " +
    "focus:outline-none focus:ring-4 focus:ring-rose-200 " +
    "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 " +
    "ring-1 ring-rose-500/20";
  const statusLabel =
    isLoading || isLoadingExcel || isLoadingImportExcel
      ? "Loading"
      : dataLoaded
        ? "Ready"
        : "Not initialized";
  const statusPillClass =
    isLoading || isLoadingExcel || isLoadingImportExcel
      ? "border-red-200 bg-red-50 text-red-700"
      : dataLoaded
        ? "border-slate-900/10 bg-slate-900 text-white"
        : "border-slate-200 bg-white text-slate-600";
  const statusDotClass =
    isLoading || isLoadingExcel || isLoadingImportExcel
      ? "bg-red-500"
      : dataLoaded
        ? "bg-white/80"
        : "bg-slate-400";
  const notifCount =
    unprocessedBatches.length +
    (billingBatches.length > 0 ? 1 : 0) +
    (NotFoundUsername.length > 0 ? 1 : 0) +
    (bannedUsernames.length > 0 ? 1 : 0) +
    (apifyAlerts.length > 0 ? 1 : 0);

  const handleClearAll = () => {
    // evita limpiar mientras está corriendo algo
    if (isLoading || isLoadingExcel || isLoadingImportExcel) return;

    // 1) Reset estados (default)
    setDateFrom("");
    setDateTo("");
    setUsername("");

    setLog([]);
    setRecords([]);
    setDataLoaded(false);

    setNotFoundUsername([]);
    setUnprocessedBatches([]);
    setBannedUsernames([]);
    setBillingBatches([]);
    setApifyAlerts([]);

    setNotifOpen(false);
    setToast(null);

    setButtonDisable(false);
    setButtonText("TikTok API Request");

    setExcelFile(null);
    setExcelFileName("");
    setExcelAccounts([]);
    setExcelRecordCount(0);

    if (fileInputRef.current) fileInputRef.current.value = "";

    // 2) Limpia cache (localStorage)
    try {
      if (userId) {
        localStorage.removeItem(LS_FILTERS());
        localStorage.removeItem(LS_NOTIFS());
        localStorage.removeItem(LS_DATA());
        localStorage.removeItem(LS_EXCEL());
        localStorage.removeItem(LS_JOB());
      }
    } catch (e) {
      console.warn("Failed to clear cache:", e);
    }
  };

  const fetchAccountsFromExcel = async (file) => {
    if (!file) return { count: 0, values: [] };

    setIsLoadingImportExcel(true);
    try {
      const azureURL = import.meta.env.VITE_AZURE_API_URL;

      const token = await getBearerToken();
      if (!token) {
        notify("Authentication required", "Please sign in again.", "error");
        return { count: 0, values: [] };
      }

      const formData = new FormData();
      formData.append("file", file);

      // Endpoint backend (el que creaste): /datamaintenance/excel/read-tiktok-accounts
      const res = await fetch(
        `${azureURL}/apifycall/excel/read-tiktok-accounts`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
          mode: "cors",
        },
      );

      if (!res.ok) {
        throw new Error(`Excel read failed with status ${res.status}`);
      }

      const data = await res.json(); // { count, values }
      const values = Array.isArray(data?.values) ? data.values : [];
      const count = Number(data?.count || values.length || 0);

      // Guarda en estado para que el flujo use esto
      setExcelAccounts(values);
      setExcelRecordCount(count);

      return { count, values };
    } catch (e) {
      console.error("Error reading Excel accounts:", e);
      notify(
        "Import failed",
        "We couldn’t read the Excel file. Please verify the template and try again.",
        "error",
      );
      setExcelAccounts([]);
      setExcelRecordCount(0);
      return { count: 0, values: [] };
    } finally {
      setIsLoadingImportExcel(false);
    }
  };

  const handleExcelFileChange = async (event) => {
    const file = event.target.files?.[0] || null;

    if (!file) {
      setExcelFile(null);
      setExcelFileName("");
      setExcelAccounts([]);
      setExcelRecordCount(0);
      if (event?.target) event.target.value = "";

      return;
    }

    setExcelFile(file);
    setExcelFileName(file.name);

    // Carga count + values desde backend apenas se selecciona
    await fetchAccountsFromExcel(file);
    if (event?.target) event.target.value = "";
  };

  const getApifyHardLimitMessage = (payload) => {
    // Puede venir como array [ { error: { error: { error: "..." } } } ]
    // o como objeto { error: ... }
    let cur = Array.isArray(payload) ? payload?.[0] : payload;

    // Muchos backends envuelven todo bajo .error
    cur = cur?.error ?? cur;

    for (let i = 0; i < 8; i++) {
      if (typeof cur === "string") return cur.trim() || null;
      if (!cur || typeof cur !== "object") return null;

      // Caso común: { error: "..." }
      if (typeof cur.error === "string") return cur.error.trim() || null;

      // Sigue bajando niveles: error -> error -> error ...
      cur = cur.error ?? cur.message ?? cur.detail ?? null;
    }

    return null;
  };

  const persistJob = (patch) => {
    if (!userId || userId === "null") return;
    try {
      const prev = JSON.parse(localStorage.getItem(LS_JOB()) || "{}");
      localStorage.setItem(
        LS_JOB(),
        JSON.stringify({
          ...prev,
          ...patch,
          savedAt: Date.now(),
        }),
      );
    } catch (e) {
      console.warn("Failed to persist job:", e);
    }
  };

  const restoreJob = () => {
    try {
      return JSON.parse(localStorage.getItem(LS_JOB()) || "null");
    } catch {
      return null;
    }
  };

  const readLS = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const persistNotifsDirect = (patch = {}) => {
    if (!userId || userId === "null") return;

    const prev = readLS(LS_NOTIFS(), {
      lastRunId: null,

      unprocessedBatches: [],
      billingBatches: [],

      notFoundUsernames: [],
      bannedUsernames: [],
      apifyAlerts: [],
    });

    const next = {
      savedAt: Date.now(),
      lastRunId: prev.lastRunId ?? null,

      unprocessedBatches: Array.isArray(prev.unprocessedBatches)
        ? prev.unprocessedBatches
        : [],
      billingBatches: Array.isArray(prev.billingBatches)
        ? prev.billingBatches
        : [],

      notFoundUsernames: Array.isArray(prev.notFoundUsernames)
        ? prev.notFoundUsernames
        : [],
      bannedUsernames: Array.isArray(prev.bannedUsernames)
        ? prev.bannedUsernames
        : [],

      apifyAlerts: Array.isArray(prev.apifyAlerts) ? prev.apifyAlerts : [],
      ...patch,
    };

    localStorage.setItem(LS_NOTIFS(), JSON.stringify(next));
  };

  const persistDataDirect = (patch = {}) => {
    if (!userId || userId === "null") return;

    const prev = readLS(LS_DATA(), {
      dataLoaded: false,
      records: [],
      log: [],
    });

    const next = {
      savedAt: Date.now(),
      dataLoaded:
        typeof prev.dataLoaded === "boolean" ? prev.dataLoaded : false,
      records: Array.isArray(prev.records) ? prev.records : [],
      log: Array.isArray(prev.log) ? prev.log : [],
      ...patch,
    };

    localStorage.setItem(LS_DATA(), JSON.stringify(next));
  };

  const hydrateFromStorage = () => {
    if (!userId || userId === "null") return;

    // data
    try {
      const rawData = localStorage.getItem(LS_DATA());
      if (rawData) {
        const d = JSON.parse(rawData);
        if (Array.isArray(d?.records)) setRecords(d.records);
        if (Array.isArray(d?.log)) setLog(d.log);
        if (typeof d?.dataLoaded === "boolean") setDataLoaded(d.dataLoaded);
      }
    } catch {}

    // notifications
    try {
      const rawNotifs = localStorage.getItem(LS_NOTIFS());
      if (rawNotifs) {
        const n = JSON.parse(rawNotifs);
        if (Array.isArray(n?.unprocessedBatches))
          setUnprocessedBatches(n.unprocessedBatches);
        if (Array.isArray(n?.notFoundUsernames))
          setNotFoundUsername(n.notFoundUsernames);
        if (Array.isArray(n?.apifyAlerts)) setApifyAlerts(n.apifyAlerts);
        if (Array.isArray(n?.billingBatches))
          setBillingBatches(n.billingBatches);
        if (Array.isArray(n?.bannedUsernames))
          setBannedUsernames(n.bannedUsernames);
      }
    } catch {}
  };

  const fetchWithAuthRetry = async (url, buildOptions) => {
    // 1) primer intento con token (validado/renovado)
    let token = await getBearerToken();
    if (!token)
      return { ok: false, status: 0, authFailed: true, response: null };

    let response = await fetch(url, buildOptions(token));

    // 2) si backend dice “no autorizado”, refresca y reintenta 1 vez
    if (response.status === 401 || response.status === 403) {
      const nuevo = await refreshJwt();
      if (!nuevo)
        return {
          ok: false,
          status: response.status,
          authFailed: true,
          response,
        };

      token = nuevo;
      response = await fetch(url, buildOptions(token));
    }

    return {
      ok: response.ok,
      status: response.status,
      authFailed: false,
      response,
    };
  };

  const handleAPICall = async () => {
    // ✅ DEV: contador de corrida (1,2,3...) persistente

    if (buttonDisable) return;

    const df = (dateFrom || "").trim();
    const dt = (dateTo || "").trim();

    const existing = restoreJob();
    if (existing?.running) {
      notify(
        "Job already running",
        "A TikTok API Request is already in progress. Please wait for completion.",
        "warning",
      );
      setIsLoading(true);
      setButtonDisable(true);
      setButtonText(existing?.buttonText || "Sending API Request ...");
      return;
    }

    if (!isValidISODate(df) || !isValidISODate(dt)) {
      notify(
        "Action required",
        "Please enter a valid Date From, Date To, and at least one username.",
        "warning",
      );
      return;
    }

    const hasCachedAccounts =
      Array.isArray(excelAccounts) && excelAccounts.length > 0;

    if (!excelFile && !hasCachedAccounts) {
      notify(
        "Action required",
        "Please import an Excel file before starting the request.",
        "warning",
      );
      return;
    }

    const dFrom = toDateSafe(df);
    const dTo = toDateSafe(dt);

    if (!dFrom || !dTo) {
      notify("Invalid dates", "Please select valid dates.", "warning");
      return;
    }

    if (dFrom > dTo) {
      notify(
        "Invalid range",
        "Date From must be earlier than Date To.",
        "warning",
      );
      return;
    }

    setIsLoading(true);
    setButtonDisable(true);
    setButtonText("Sending API Request ...");
    setDataLoaded(false);
    setLog([]);
    setRecords([]);

    persistDataDirect({ dataLoaded: false, records: [], log: [] });
    persistNotifsDirect({
      //unprocessedBatches: [],
      billingBatches: [],
      bannedUsernames: [],
      notFoundUsernames: [],
      apifyAlerts: [],
    });

    persistJob({
      running: true,
      buttonText: "Sending API Request ...",
      startedAt: Date.now(),
      currentBatch: 0,
      totalBatches: 0,
    });

    setNotifOpen(false);
    setToast(null);

    const t0 = performance.now();
    const runId = (() => {
      const parts = new Intl.DateTimeFormat("es-PE", {
        timeZone: "America/Lima",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
        .formatToParts(new Date())
        .reduce((acc, p) => {
          acc[p.type] = p.value;
          return acc;
        }, {});

      return `${parts.year}-${parts.month}-${parts.day} · ${parts.hour}:${parts.minute}:${parts.second}`;
    })();

    persistNotifsDirect({ lastRunId: runId });

    // Si por alguna razón no está cargado aún, lo leemos aquí
    let accounts = excelAccounts;

    if (!Array.isArray(accounts) || accounts.length === 0) {
      if (excelFile) {
        const loaded = await fetchAccountsFromExcel(excelFile);
        accounts = loaded.values;
      } else {
        notify(
          "Action required",
          "No cached accounts found. Please import the Excel file again.",
          "warning",
        );
        setIsLoading(false);
        setButtonDisable(false);
        setButtonText("TikTok API Request");
        return;
      }
    }

    const formattedUsernames = (accounts || [])
      .map((u) => String(u).trim().toLowerCase())
      .filter(Boolean);

    if (formattedUsernames.length === 0) {
      notify(
        "No accounts found",
        "Your Excel file contains 0 TikTok accounts. Please verify the column 'tiktok_accounts'.",
        "warning",
      );
      setIsLoading(false);
      setButtonDisable(false);
      setButtonText("TikTok API Request");
      return;
    }

    try {
      const azureURL = import.meta.env.VITE_AZURE_API_URL;

      // ✅ Split accounts in blocks of 15
      const dividedAccounts = [];
      for (let i = 0; i < formattedUsernames.length; i += 15) {
        dividedAccounts.push(formattedUsernames.slice(i, i + 15));
      }

      persistJob({
        running: true,
        totalBatches: dividedAccounts.length,
        currentBatch: 0,
      });

      // ✅ Accumulate all batches
      const comulativeList = [];

      let hitApifyHardLimit = false;
      let apifyHardLimitDetail = "";

      // ✅ Request batch-by-batch
      outerBatches: for (let i = 0; i < dividedAccounts.length; i++) {
        persistJob({
          running: true,
          currentBatch: i + 1,
          totalBatches: dividedAccounts.length,
        });

        const requestData = {
          StartDate: dateFrom,
          FinishDate: dateTo,
          AccountList: dividedAccounts[i],
          UserId: userId,
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 220000); // 3:40 min

        try {
          const { ok, status, authFailed, response } = await fetchWithAuthRetry(
            azureURL + "/apifycall/filtrar",
            (token) => ({
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              mode: "cors",
              body: JSON.stringify(requestData),
              signal: controller.signal,
            }),
          );

          clearTimeout(timeoutId);

          if (authFailed) {
            // En vez de "return" (mata el loop), marca batches pendientes y corta limpio
            const pending = [];
            for (let j = i; j < dividedAccounts.length; j++) {
              pending.push({
                runId,
                batchIndex: j + 1,
                totalBatches: dividedAccounts.length,
                accounts: dividedAccounts[j],
              });
            }

            const snap = readLS(LS_NOTIFS(), {
              lastRunId: null,
              unprocessedBatches: [],
              billingBatches: [],
              notFoundUsernames: [],
              bannedUsernames: [],
              apifyAlerts: [],
            });

            persistNotifsDirect({
              unprocessedBatches: snap.unprocessedBatches,
              billingBatches: snap.billingBatches,
              notFoundUsernames: snap.notFoundUsernames,
              bannedUsernames: snap.bannedUsernames,

              apifyAlerts: Array.from(
                new Set([
                  "AUTH: Token expired during execution. Please sign in again.",
                  ...(snap.apifyAlerts || []),
                ]),
              ).slice(0, 20),
            });

            // Opcional: si quieres ver exactamente qué faltó, guárdalo como "unprocessedBatches"
            // (o crea un arreglo nuevo authBatches si prefieres)
            persistNotifsDirect({
              unprocessedBatches: [
                ...(snap.unprocessedBatches || []),
                ...pending,
              ],
              billingBatches: snap.billingBatches,
              notFoundUsernames: snap.notFoundUsernames,
              bannedUsernames: snap.bannedUsernames,

              apifyAlerts: Array.from(
                new Set([
                  "AUTH: Token expired during execution. Please sign in again.",
                  ...(snap.apifyAlerts || []),
                ]),
              ).slice(0, 20),
            });

            if (mountedRef.current) {
              notify(
                "Authentication required",
                "Token expired during execution.",
                "error",
              );
              setUnprocessedBatches([
                ...(snap.unprocessedBatches || []),
                ...pending,
              ]);
            }

            // corta el for, pero deja que el finally cierre bien el job
            break outerBatches;
          }

          if (!ok) {
            throw new Error(`API Request failed with status ${status}`);
          }

          const batchResponse = await response.json();
          console.log(batchResponse);

          // ✅ Si el backend está caído (container apagado / connection refused),
          // el backend suele devolver un payload con "Error en la conexión con la API ..."
          // En ese caso: cortamos TODO el bucle porque los siguientes batches también fallarán.
          const fatalConnMsg = getApifyHardLimitMessage(batchResponse);
          if (
            fatalConnMsg &&
            typeof fatalConnMsg === "string" &&
            fatalConnMsg.trim().startsWith("Error en la conexión con la API")
          ) {
            throw new Error("API_CONNECTION_DOWN");
          }

          // ✅ Detecta error de Apify (hard limit/billing) y corta ejecución
          const apifyMsg = getApifyHardLimitMessage(batchResponse);
          if (
            apifyMsg &&
            /(hard limit exceeded|monthly usage)/i.test(apifyMsg)
          ) {
            // ✅ 1) Armar TODOS los batches pendientes desde el batch actual (i) hasta el final
            const pending = [];
            for (let j = i; j < dividedAccounts.length; j++) {
              pending.push({
                runId,
                batchIndex: j + 1,
                totalBatches: dividedAccounts.length,
                accounts: dividedAccounts[j],
              });
            }

            // ✅ 2) Persistir en localStorage como "billingBatches" (sin mezclar con timeouts)
            const snap = readLS(LS_NOTIFS(), {
              lastRunId: null,
              unprocessedBatches: [],
              billingBatches: [],
              notFoundUsernames: [],
              bannedUsernames: [],
              apifyAlerts: [],
            });

            const makeKey = (b) =>
              `${b.runId || "noRun"}|${b.batchIndex}/${b.totalBatches}:${(b.accounts || []).join(",")}`;

            const prev = Array.isArray(snap.billingBatches)
              ? snap.billingBatches
              : [];
            const prevKeys = new Set(prev.map(makeKey));
            const nextBilling = [...prev];

            // Guardar detalle del billing en Notifications (no en Execution Monitor)
            const nextAlertsRaw = apifyMsg
              ? [apifyMsg, ...(snap.apifyAlerts || [])]
              : snap.apifyAlerts || [];
            const nextAlerts = Array.from(new Set(nextAlertsRaw)).slice(0, 20);

            persistNotifsDirect({
              unprocessedBatches: snap.unprocessedBatches,
              billingBatches: nextBilling,
              notFoundUsernames: snap.notFoundUsernames,
              bannedUsernames: snap.bannedUsernames,

              apifyAlerts: nextAlerts,
            });

            if (mountedRef.current) {
              setApifyAlerts(nextAlerts);
            }

            for (const item of pending) {
              const k = makeKey(item);
              if (!prevKeys.has(k)) {
                prevKeys.add(k);
                nextBilling.push(item);
              }
            }

            persistNotifsDirect({
              unprocessedBatches: snap.unprocessedBatches,
              billingBatches: nextBilling,
              notFoundUsernames: snap.notFoundUsernames,
              bannedUsernames: snap.bannedUsernames,

              apifyAlerts: snap.apifyAlerts,
            });

            // ✅ 3) Si estás en la página, reflejar en UI (sin logs extra)
            if (mountedRef.current) {
              setBillingBatches(nextBilling);
            }

            // ✅ 4) Si ya hubo data acumulada, NO dispares el catch grande.
            //     Corta el loop y continúa para guardar logs normales + data parcial.
            if (comulativeList.length > 0) {
              hitApifyHardLimit = true;
              apifyHardLimitDetail = apifyMsg || "";
              break outerBatches;
            }

            // ✅ Si NO hubo nada procesado (hard limit en el primer batch), sí dispara el flujo de error clásico.
            throw new Error(`APIFY_HARD_LIMIT:${apifyMsg}`);
          }

          // backend real: array
          if (Array.isArray(batchResponse)) {
            comulativeList.push(...batchResponse);
          } else if (
            batchResponse?.validUsers &&
            Array.isArray(batchResponse.validUsers)
          ) {
            comulativeList.push(...batchResponse.validUsers);
          }
        } catch (error) {
          clearTimeout(timeoutId);
          console.error("Error in TikTok API batch call:", error);

          const msg = String(error?.message || "");
          if (msg.startsWith("APIFY_HARD_LIMIT:")) {
            throw error;
          }

          if (msg === "API_CONNECTION_DOWN") {
            throw error;
          }

          if (error?.name === "AbortError") {
            const failed = dividedAccounts[i];

            const newItem = {
              runId,
              batchIndex: i + 1,
              totalBatches: dividedAccounts.length,
              accounts: failed,
            };

            const makeKey = (b) =>
              `${b.batchIndex}/${b.totalBatches}:${(b.accounts || []).join(
                ",",
              )}`;

            // ✅ SIEMPRE construir desde snapshot real de localStorage (evita state stale)
            const snap = readLS(LS_NOTIFS(), {
              lastRunId: null,
              unprocessedBatches: [],
              billingBatches: [],

              notFoundUsernames: [],
              bannedUsernames: [],
              apifyAlerts: [],
            });

            const prev = Array.isArray(snap.unprocessedBatches)
              ? snap.unprocessedBatches
              : [];

            const prevKeys = new Set(prev.map(makeKey));
            const nextUnprocessed = prevKeys.has(makeKey(newItem))
              ? prev
              : [...prev, newItem];

            // ✅ Persistir SIEMPRE en notifications (acumula todos los timeouts)
            persistNotifsDirect({
              unprocessedBatches: nextUnprocessed,
              billingBatches: snap.billingBatches,
              notFoundUsernames: snap.notFoundUsernames,
              bannedUsernames: snap.bannedUsernames,

              apifyAlerts: snap.apifyAlerts,
            });

            // ✅ UI solo si está montado (SIN setLog)
            if (mountedRef.current) {
              setUnprocessedBatches(nextUnprocessed);
              setToast({
                title: "Timeout",
                message: `Batch ${i + 1}/${
                  dividedAccounts.length
                } was not processed. Review Notifications`,
                type: "warning",
              });
            }

            // continue con el siguiente batch
            continue;
          }

          // continue with next batch (same behavior as your old file)
          continue;
        }
      }

      if (hitApifyHardLimit && mountedRef.current) {
        notify(
          "Apify limit reached",
          "Apify monthly usage hard limit exceeded. Please top up your Apify plan / budget.",
          "error",
        );
      }

      const responseData = comulativeList;

      // ✅ Tu backend real devuelve ARRAY (como en el page antiguo)
      const data = Array.isArray(responseData)
        ? responseData
        : responseData?.validUsers || []; // fallback

      // 1) Calcular "not found" igual que en el page antiguo (por Date posted)
      let dic = {};
      let registrosProcesados = 0;

      const cuentasConContenido = new Set();
      const cuentasNoContent = new Set(); // candidatos a No Content
      const cuentasUnavailable = new Set(); // Account unavailable

      for (let i = 0; i < data.length; i++) {
        const u = data[i]?.["TikTok Account Username"];
        const dp = data[i]?.["Date posted"];

        if (!u) continue;
        if (dp === "Account unavailable") {
          cuentasUnavailable.add(u);
          cuentasNoContent.delete(u); // por si antes lo marcaste
          continue;
        }

        if (dp === "Not found: N/A") {
          if (!cuentasConContenido.has(u) && !cuentasUnavailable.has(u)) {
            cuentasNoContent.add(u);
          }
          continue;
        }

        // 3) Cualquier otro valor => confirmo contenido real
        cuentasConContenido.add(u);
        cuentasNoContent.delete(u);
        registrosProcesados += 1;
        if (!dic.hasOwnProperty(u)) dic[u] = 1;
      }

      const tempNotFoundUsername = Array.from(cuentasNoContent);
      const tempBannedUsernames = Array.from(cuentasUnavailable);

      // ✅ Accounts processed = cantidad de usernames únicos con data encontrada
      const cuentasProcesadas = Object.keys(dic).length;

      // ✅ Execution time (igual que en el catch)
      const t1 = performance.now();
      const totalSeconds = Math.max(0, (t1 - t0) / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = Math.floor(totalSeconds % 60);
      const execTime = `${minutes}:${String(seconds).padStart(2, "0")}`;

      // ✅ Guardar NOT FOUND en localStorage aunque el componente esté desmontado
      const snapN = readLS(LS_NOTIFS(), {
        lastRunId: null,
        unprocessedBatches: [],
        billingBatches: [],

        notFoundUsernames: [],
        bannedUsernames: [],
        apifyAlerts: [],
      });

      // Mantén lo que ya existe (timeouts + alerts) y solo actualiza notFoundUsernames
      persistNotifsDirect({
        unprocessedBatches: snapN.unprocessedBatches,
        billingBatches: snapN.billingBatches,

        apifyAlerts: snapN.apifyAlerts,
        notFoundUsernames: tempNotFoundUsername,
        bannedUsernames: tempBannedUsernames,
      });

      // UI solo si estás en la página (montado)
      if (mountedRef.current) {
        setNotFoundUsername(tempNotFoundUsername);
        setBannedUsernames(tempBannedUsernames);
      }

      // 2) Normalizar columnas (igual que ya venías usando)
      const filteredData = data.map((record) => ({
        "Post Code": record["Post code"] || "Not found: N/A",
        "Author Name": record["Author name"] || "Not found: N/A",
        "Book Name": record["Book name"] || "Not found: N/A",
        "Number of Scene": record["Number of Scene"] || "Not found: N/A",
        "Scene Name": record["Scene name"] || "Not found: N/A",
        "Post Type": record["Post type"] || "Not found: N/A",
        "PA Name": record["PA name"] || "Not found: N/A",
        "Date Posted": record["Date posted"] || "Not found: N/A",
        "Time Posted": record["Time posted"] || "Not found: N/A",
        "TikTok Username":
          record["TikTok Account Username"] || "Not found: N/A",
        "Post URL": record["Post Link"] || "Not found: N/A",
        Views: record["Views"] || 0,
        Likes: record["Likes"] || 0,
        Comments: record["Comments"] || 0,
        Reposted: record["Reposted"] || 0,
        Saves: record["Saves"] || 0,
        "Engagement Rate":
          Math.round((record["Engagement rate"] || 0) * 100) / 100,
        Interactions: record["Interactions"] || 0,
        Hashtags: record["Hashtags"] || "Not found: N/A",
        "# of Hashtags": record["# of Hashtags"] || 0,
        "Sound URL": record["Sound URL"] || "Not found: N/A",
        "Region of Posting": record["Region of posting"] || "Not found: N/A",
        "Tracking Date": record["Tracking date"] || "Not found: N/A",
        "Tracking Time": record["Tracking time"] || "Not found: N/A",
        "Logged-in User": record["Logged-in User"] || "Not found: N/A",
      }));

      // Persistir SIEMPRE
      try {
        const raw = localStorage.getItem(LS_DATA());
        const d = raw ? JSON.parse(raw) : {};
        const prevLog = Array.isArray(d?.log) ? d.log : [];

        const nextLog = [
          ...prevLog,
          `✅ Execution completed successfully`,
          `📊 Records: ${registrosProcesados} — Accounts Processed: ${cuentasProcesadas} `,
          `⏳ Total function execution time: ${execTime} minutes`,
        ];

        localStorage.setItem(
          LS_DATA(),
          JSON.stringify({
            savedAt: Date.now(),
            dataLoaded: true,
            records: filteredData,
            log: nextLog,
          }),
        );
      } catch {}

      // UI solo si está montado
      if (mountedRef.current) {
        setRecords(filteredData);
        setLog((prevLog) => [
          ...prevLog,
          `✅ Execution completed successfully`,
          `📊 Records: ${registrosProcesados} — Accounts Processed: ${cuentasProcesadas} `,
          `⏳ Total function execution time: ${execTime} minutes`,
        ]);
        setDataLoaded(true);
      }
    } catch (error) {
      console.error("Error in TikTok API call:", error);

      const t1 = performance.now();
      const totalSeconds = Math.max(0, (t1 - t0) / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = Math.floor(totalSeconds % 60);
      const execTime = `${minutes}:${String(seconds).padStart(2, "0")}`;

      const msg = String(error?.message || "");
      const isApifyHardLimit = msg.startsWith("APIFY_HARD_LIMIT:");
      const apifyDetail = isApifyHardLimit
        ? msg.replace("APIFY_HARD_LIMIT:", "").trim()
        : "";

      // ====== SIEMPRE: actualizar storage (aunque el componente esté desmontado) ======
      const snapN = readLS(LS_NOTIFS(), {
        lastRunId: null,
        unprocessedBatches: [],
        billingBatches: [],

        notFoundUsernames: [],
        bannedUsernames: [],
        apifyAlerts: [],
      });

      const snapD = readLS(LS_DATA(), {
        dataLoaded: false,
        records: [],
        log: [],
      });

      if (isApifyHardLimit) {
        // 1) Notifs: agrega alert (dedupe) y persiste
        const nextAlertsRaw = apifyDetail
          ? [apifyDetail, ...(snapN.apifyAlerts || [])]
          : snapN.apifyAlerts || [];
        const nextAlerts = Array.from(new Set(nextAlertsRaw)).slice(0, 20);

        persistNotifsDirect({
          unprocessedBatches: snapN.unprocessedBatches,
          billingBatches: snapN.billingBatches,
          bannedUsernames: snapN.bannedUsernames,

          notFoundUsernames: snapN.notFoundUsernames, // no lo borres si ya había
          apifyAlerts: nextAlerts,
        });

        // 2) Data: fuerza “no data” + logs y persiste
        const nextLog = [
          ...(Array.isArray(snapD.log) ? snapD.log : []),
          "❌ Apify limit reached. Please check Apify billing.",
          "📊 Records: 0 — Accounts Processed: 0",
          `⏳ Total function execution time: ${execTime} minutes`,
        ];

        persistDataDirect({
          dataLoaded: false,
          records: [],
          log: nextLog,
        });

        // 3) UI solo si está montado
        if (mountedRef.current) {
          notify(
            "Apify limit reached",
            "Apify monthly usage hard limit exceeded. Please top up your Apify plan / budget.",
            "error",
          );
          setApifyAlerts(nextAlerts);
          setRecords([]);
          setDataLoaded(false);
          setLog(nextLog);
          // OJO: NO borro NotFoundUsername aquí a menos que tú quieras hacerlo.
        }
      } else {
        const nextLog = [
          ...(Array.isArray(snapD.log) ? snapD.log : []),
          "❌ TikTok API request failed. Please try again.",
          " Please start the Azure Container App to use Apify",
          `⏳ Total function execution time: ${execTime} minutes`,
        ];

        persistDataDirect({
          dataLoaded: false,
          records: [],
          log: nextLog,
        });

        if (mountedRef.current) {
          if (msg === "API_CONNECTION_DOWN") {
            notify(
              "Azure Container App is stopped",
              "Please start the Azure Container App to use Apify.",
              "error",
            );
          } else {
            notify(
              "Request failed",
              "TikTok API request failed. Please try again.",
              "error",
            );
          }

          setRecords([]);
          setDataLoaded(false);
          setLog(nextLog);
        }
      }
    } finally {
      persistJob({
        running: false,
        buttonText: "TikTok API Request",
        finishedAt: Date.now(),
      });

      // UI solo si está montado
      if (mountedRef.current) {
        setIsLoading(false);
        setButtonDisable(false);
        setButtonText("TikTok API Request");
      }
    }
  };

  const handleDownloadExcel = async () => {
    if (!dataLoaded) {
      notify("Action required", "You must make the API call first.", "warning");

      return;
    }

    setIsLoadingExcel(true);

    try {
      const azureURL = import.meta.env.VITE_AZURE_API_URL;

      const formattedUsernames = (excelAccounts || [])
        .map((u) => String(u).trim().toLowerCase())
        .filter(Boolean);

      const job = restoreJob();
      const apifyCallMs = Number(
        job?.startedAt || job?.finishedAt || Date.now(),
      );
      const trackDate = toLocalISODate(apifyCallMs);

      // ✅ Timeouts de ESTA corrida (batches abortados)
      // ✅ Timeouts SOLO de la última corrida (aunque Notifications acumule historial)
      const snapNotifs = readLS(LS_NOTIFS(), { lastRunId: null });
      const lastRunId = snapNotifs?.lastRunId;

      const timeoutsThisRun = lastRunId
        ? (unprocessedBatches || []).filter((b) => b?.runId === lastRunId)
        : unprocessedBatches || [];

      const timeoutAccounts = Array.from(
        new Set(
          timeoutsThisRun.flatMap((b) =>
            (b?.accounts || [])
              .map((u) => String(u).trim().toLowerCase())
              .filter(Boolean),
          ),
        ),
      );

      const requestBody = {
        StartDate: dateFrom,
        FinishDate: dateTo,
        TrackStartDate: trackDate,
        AccountList: formattedUsernames,
        NotFoundAccountList: NotFoundUsername,
        BannedAccountList: bannedUsernames,
        TimeoutAccountList: timeoutAccounts,
      };

      const token = await getBearerToken();
      if (!token) {
        notify("Authentication required", "Please sign in again.", "error");
        setIsLoadingExcel(false);
        return;
      }

      const response = await fetch(azureURL + "/apifycall/excel/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
        mode: "cors",
      });

      if (!response.ok) throw new Error("Error al descargar el archivo");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const now = new Date();
      const timestamp =
        now.getFullYear() +
        "-" +
        String(now.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(now.getDate()).padStart(2, "0") +
        "_" +
        String(now.getHours()).padStart(2, "0") +
        "-" +
        String(now.getMinutes()).padStart(2, "0") +
        "-" +
        String(now.getSeconds()).padStart(2, "0");

      const fileName = `backup_tiktok_videos_${timestamp}.xlsx`;

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);

      notify("Success", "Excel file exported successfully.", "success");
    } catch (error) {
      console.error("❌ Error downloading the Excel File:", error);
      notify(
        "Download failed",
        "We couldn’t download the Excel file. If it persists, please try again or refresh the page.",
        "error",
      );
    } finally {
      setIsLoadingExcel(false);
    }
  };

  const handleClearNotifications = () => {
    setUnprocessedBatches([]);
    setNotFoundUsername([]);
    setApifyAlerts([]);
    setBillingBatches([]);
    setBannedUsernames([]);

    // opcional: también cerrar panel
    // setNotifOpen(false);

    try {
      localStorage.removeItem(LS_NOTIFS());
    } catch (e) {
      console.warn("Failed to clear notifications storage:", e);
    }
  };

  // === Table UI helpers ===
  const centerCols = new Set([
    "Post Code",
    "Post URL",
    "Sound URL",
    "Logged-in User",

    "Author Name",
    "Book Name",
    "Number of Scene",
    "Scene Name",
    "Post Type",
    "PA Name",
    "Date Posted",
    "Time Posted",
    "TikTok Username",
    "Views",
    "Likes",
    "Comments",
    "Reposted",
    "Saves",
    "Engagement Rate",
    "Interactions",
    "Hashtags",
    "# of Hashtags",
    "Region of Posting",
    "Tracking Date",
    "Tracking Time",
  ]);

  const extractTikTokId = (url) => {
    if (typeof url !== "string") return "";
    // video id
    const m1 = url.match(/\/video\/(\d+)/);
    if (m1?.[1]) return m1[1];

    // sound/music id (often ends with digits)
    const m2 = url.match(/(\d{6,})(?:\D*$)/);
    return m2?.[1] || "";
  };

  const isHttpUrl = (s) => typeof s === "string" && /^https?:\/\//i.test(s);

  const toastBarClass =
    toast?.type === "success"
      ? "bg-emerald-600"
      : toast?.type === "warning"
        ? "bg-rose-400"
        : toast?.type === "error"
          ? "bg-rose-500"
          : "bg-slate-900";

  const isValidISODate = (v) =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

  const toDateSafe = (iso) => {
    // iso viene en YYYY-MM-DD
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const toLocalISODate = (ms) => {
    const d = new Date(Number(ms || Date.now()));
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`; // YYYY-MM-DD (zona local del browser)
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  // confirm: { title, message, confirmText, danger, onConfirm }
  const confirmRef = useRef(null);

  const fileInputRef = useRef(null);

  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false; // cuando cambias de page, esto queda en false
    };
  }, []);

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

  const TABLE_MAX_ROWS = 20;
  const recordsToShow = Array.isArray(records) ? records.slice(0, 20) : [];

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

      {(isLoadingExcel || isLoadingImportExcel) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* overlay (NO clickeable, no se cierra) */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/10 via-slate-900/20 to-slate-900/10 backdrop-blur-[2px]" />

          {/* dialog */}
          <div className="relative w-[360px] max-w-[100vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-950 via-slate-800 to-slate-600" />

            <div className="p-7 text-center">
              {/* spinner ROJO (idéntico a APICall) */}
              <div className="mx-auto relative h-15 w-15">
                <div className="h-15 w-15 animate-spin rounded-full border-[5px] border-slate-200 border-t-red-600" />
                <div className="absolute inset-0 m-auto h-6 w-6 rounded-full bg-red-600/15" />
              </div>

              <p className="mt-4 text-[15px] font-semibold text-slate-800">
                Processing...
              </p>
              <p className="mt-1.5 text-[13px] text-slate-500">
                Please keep this tab open until completion
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top grid: Filters + Monitor */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-stretch">
        {/* Left: TikTok API Request */}
        <section
          className={`relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur-sm lg:col-span-8 self-stretch flex flex-col ${
            notifOpen ? "z-40" : "z-0"
          }`}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 overflow-hidden rounded-t-2xl">
            <div className="h-full w-full bg-gradient-to-r from-slate-950 via-slate-800 to-slate-600" />
          </div>

          {/* Header row + status */}
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
                    d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                  />
                </svg>
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-900">
                  TikTok API Request
                </h2>
                <p className="text-xs text-slate-500">
                  Configure filters and trigger the batch request
                </p>
              </div>
            </div>
            <div ref={notifRef} className="relative flex items-center gap-2">
              {/* Status pill (UI only) */}
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${statusPillClass}`}
                title="Request status"
              >
                <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
                {statusLabel}
              </span>
              <button
                ref={notifButtonRef}
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                title="Notifications"
              >
                {/* bell icon */}
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 0 1-6 0"
                  />
                </svg>

                {/* badge */}
                {notifCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
                    {notifCount}
                  </span>
                )}
              </button>
              {notifOpen &&
                createPortal(
                  <div
                    ref={notifDropdownRef}
                    className="fixed z-[9999] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
                    style={{
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: `${notifPos.width}px`,
                      maxHeight: `${notifPos.maxHeight}px`,
                    }}
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          Notifications
                        </p>
                        <p className="text-xs text-slate-500">
                          Unprocessed account batches
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleClearNotifications}
                          className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-100 active:bg-red-200"
                          title="Clear notifications"
                        >
                          Clear
                        </button>

                        <button
                          type="button"
                          onClick={() => setNotifOpen(false)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    <div
                      className="flex-1 overflow-y-auto p-3 space-y-3"
                      style={{ maxHeight: `${notifPos.maxHeight}px` }}
                    >
                      {/* Empty state SOLO si no hay nada en ambos */}
                      {unprocessedBatches.length === 0 &&
                        billingBatches.length === 0 &&
                        NotFoundUsername.length === 0 &&
                        bannedUsernames.length === 0 &&
                        apifyAlerts.length === 0 && (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center">
                            <p className="text-sm font-semibold text-slate-800">
                              No pending notifications
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Timeouts and usernames not found will appear here
                            </p>
                          </div>
                        )}

                      {/* 1) Timeouts */}
                      {unprocessedBatches.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-slate-900">
                              ⏱️ Timeouts
                            </p>

                            <button
                              type="button"
                              onClick={() => {
                                const all = unprocessedBatches
                                  .flatMap((b) => b.accounts)
                                  .join(", ");
                                navigator.clipboard?.writeText(all);
                                setToast({
                                  title: "Copied",
                                  message: "Timeout accounts copied.",
                                });
                              }}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Copy
                            </button>
                          </div>

                          <div className="mt-2 rounded-xl border border-slate-200 bg-white overflow-hidden">
                            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-xs text-slate-600">
                                {unprocessedBatches.length} batch(es)
                              </p>
                            </div>

                            <ul className="max-h-[160px] overflow-y-auto divide-y divide-slate-200">
                              {unprocessedBatches.map((b, idx) => (
                                <li
                                  key={`${b.runId || "noRun"}-${b.batchIndex}-${idx}`}
                                  className="px-3 py-2 text-xs font-semibold text-slate-800"
                                >
                                  <span className="font-bold">
                                    {b.runId ? `${b.runId} · ` : ""}
                                    Batch {b.batchIndex}/{b.totalBatches}{" "}
                                    {` · `}
                                    {(b.accounts || []).length}
                                    {` account(s): `}
                                  </span>{" "}
                                  <span className="font-normal">
                                    {b.accounts.join(", ")}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* 1.5) Billing pending */}
                      {billingBatches.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            💳 Billing stopped
                          </p>

                          <div className="mt-2 space-y-2">
                            {billingBatches.map((b, idx) => (
                              <div
                                key={`bill-${b.batchIndex}-${idx}`}
                                className="rounded-xl border border-slate-200 bg-white p-3"
                              >
                                <p className="text-xs font-bold text-slate-900">
                                  Batch {b.batchIndex}/{b.totalBatches}
                                </p>
                                <p className="mt-1 text-xs text-slate-600 break-words">
                                  {b.accounts.join(", ")}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 2.5) Account unavailable */}
                      {bannedUsernames.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-slate-900">
                              🚫 Account unavailable
                            </p>

                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(
                                  bannedUsernames.join(", "),
                                );
                                setToast({
                                  title: "Copied",
                                  message: "Banned accounts copied.",
                                });
                              }}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Copy
                            </button>
                          </div>

                          <div className="mt-2 rounded-xl border border-slate-200 bg-white overflow-hidden">
                            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-xs text-slate-600">
                                {bannedUsernames.length} account(s)
                              </p>
                            </div>

                            <ul className="max-h-[140px] overflow-y-auto divide-y divide-slate-200">
                              {bannedUsernames.map((u, i) => (
                                <li
                                  key={`${u}-${i}`}
                                  className="px-3 py-2 text-xs font-semibold text-slate-800"
                                >
                                  {u}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* 2) Usernames not found */}
                      {NotFoundUsername.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-slate-900">
                              🔎 Account: No Content
                            </p>

                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(
                                  NotFoundUsername.join(", "),
                                );
                                setToast({
                                  title: "Copied",
                                  message: "Not found usernames copied.",
                                });
                              }}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Copy
                            </button>
                          </div>

                          <div className="mt-2 rounded-xl border border-slate-200 bg-white overflow-hidden">
                            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-xs text-slate-600">
                                {NotFoundUsername.length} account(s)
                              </p>
                            </div>

                            <ul className="max-h-[140px] overflow-y-auto divide-y divide-slate-200">
                              {NotFoundUsername.map((u, i) => (
                                <li
                                  key={`${u}-${i}`}
                                  className="px-3 py-2 text-xs font-semibold text-slate-800"
                                >
                                  {u}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* 3) Apify / Billing alerts */}
                      {apifyAlerts.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-slate-900">
                              💳 Apify limit / billing
                            </p>

                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(
                                  apifyAlerts.join("\n"),
                                );
                                setToast({
                                  title: "Copied",
                                  message: "Apify alerts copied.",
                                });
                              }}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Copy
                            </button>
                          </div>

                          <div className="mt-2 rounded-xl border border-slate-200 bg-white overflow-hidden">
                            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-xs text-slate-600">
                                {apifyAlerts.length} alert(s)
                              </p>
                            </div>

                            <ul className="max-h-[140px] overflow-y-auto divide-y divide-slate-200">
                              {apifyAlerts.map((m, i) => (
                                <li
                                  key={`${m}-${i}`}
                                  className="px-3 py-2 text-xs font-semibold text-slate-800"
                                >
                                  {m}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>,
                  document.body,
                )}
            </div>
          </div>
          {/* Content */}
          <div className="mt-3 flex-1 flex">
            <div className="w-full rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-3 shadow-sm flex flex-col">
              {/* Inputs grid (compact) */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                {/* Date Range */}
                <div
                  className={`lg:col-span-5 rounded-2xl border border-slate-200 bg-white/70 shadow-sm pt-3.5 px-3 pb-1`}
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
                        Date Range (From - To)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Select a complete date range
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        required
                      />
                    </div>

                    <div>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* TikTok Accounts */}
                <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white/70 shadow-sm pt-3 px-3 pb-2">
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
                          d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        TikTok Accounts
                      </h3>
                      <p className="text-xs text-slate-500">
                        Import an Excel file to load TikTok accounts
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 h-10.5">
                    {!excelFileName ? (
                      <p className="text-slate-500">No Excel file selected.</p>
                    ) : isLoadingImportExcel ? (
                      <p className="text-slate-600">Reading file...</p>
                    ) : (
                      <p className="text-slate-800">
                        <span className="font-semibold">File:</span>{" "}
                        {excelFileName || "selected"}
                        {" — "}
                        <span className="font-semibold">Records:</span>{" "}
                        {excelRecordCount}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions row (button vuelve abajo + nuevo Import visual) */}
              <div className="mt-3 border-t border-slate-200 pt-3">
                <div className="relative flex flex-wrap items-center justify-center gap-3">
                  {/* VISUAL ONLY */}
                  <label
                    className={`${btnOutline} !px-9 min-w-[100px] cursor-pointer`}
                  >
                    Import Excel
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onClick={(e) => {
                        e.currentTarget.value = "";
                      }}
                      onChange={(e) => {
                        playSound();
                        handleExcelFileChange(e);
                      }}
                      disabled={
                        isLoading || isLoadingExcel || isLoadingImportExcel
                      }
                    />
                  </label>

                  <button
                    type="button"
                    className={`${btnPrimary} !px-8 min-w-[100px]`}
                    onClick={() => {
                      if (isLoading || isLoadingExcel) return;

                      playSound();
                      openConfirm({
                        title: "Confirm API Request",
                        message:
                          "This will start the TikTok batch request using the selected dates and usernames.",
                        confirmText: "Start",
                        danger: false,
                        onConfirm: () => handleAPICall(),
                      });
                    }}
                    disabled={buttonDisable}
                  >
                    {buttonText}
                  </button>
                  <button
                    type="button"
                    className={`${btnDanger} !px-0 !py-0 !gap-0 h-11 w-12 lg:absolute lg:right-0 lg:top-1/2 lg:-translate-y-1/2`}
                    onClick={() => {
                      if (isLoading || isLoadingExcel) return;

                      playSound();
                      openConfirm({
                        title: "Confirm reset",
                        message:
                          "This will clear filters, logs, records, notifications, and cached data for this user.",
                        confirmText: "Clear",
                        danger: true,
                        onConfirm: () => handleClearAll(),
                      });
                    }}
                    disabled={isLoading || isLoadingExcel}
                    title="Clear filters, logs, data and notifications"
                  >
                    {/* trash icon */}
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
                  {/* spinner rojo (warning) */}
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
              <div className="w-full min-h-[160px] rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-white/70 to-slate-50/70" />
            ) : log.length === 0 ? (
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
                  Run the API call to see execution messages
                </p>
              </div>
            ) : (
              <div className="w-full max-h-[300px] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white/60 p-4">
                {log.map((entry, index) => {
                  const isOk = entry.includes("✅");
                  const isErr = entry.includes("❌");
                  const isWarn = entry.includes("⚠️");
                  const isChart = entry.includes("📊");
                  const isTime = entry.includes("⏳");
                  const isUser = entry.includes("👤");

                  const badgeClass = isOk
                    ? "bg-emerald-100 text-emerald-700"
                    : isErr
                      ? "bg-red-100 text-red-700"
                      : isWarn || isTime
                        ? "bg-indigo-100 text-indigo-700"
                        : isChart || isUser
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-indigo-100 text-indigo-700";

                  const badgeChar = isOk
                    ? "✓"
                    : isErr
                      ? "×"
                      : isWarn
                        ? "!"
                        : isChart
                          ? "📊"
                          : isTime
                            ? "⏳"
                            : isUser
                              ? "👤"
                              : "i";

                  const message = entry.replace(/^(✅|❌|⚠️|📊|⏳|👤)\s*/, "");

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
                      <span className="flex-1 leading-relaxed">{message}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Results */}
      <section className="w-full overflow-hidden rounded-2xl bg-white shadow-md border border-slate-200">
        {!hydrated ? (
          <div className="px-6 py-10">
            <div className="w-full min-h-[180px] rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-white/70 to-slate-50/70" />
          </div>
        ) : records.length > 0 ? (
          <>
            <div className="w-full overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    {Object.keys(recordsToShow[0]).map((key) => (
                      <th
                        key={key}
                        className={`px-4 py-3 font-semibold whitespace-nowrap ${
                          centerCols.has(key) ? "text-center" : "text-left"
                        }`}
                      >
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {recordsToShow.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      {Object.entries(row).map(([colKey, val], i) => {
                        const centered = centerCols.has(colKey);
                        const isUrlCol =
                          colKey === "Post URL" || colKey === "Sound URL";
                        const hasUrl =
                          isHttpUrl(val) &&
                          val !== "Not found: N/A" &&
                          val !== "Account unavailable";
                        const id = hasUrl ? extractTikTokId(val) : "";

                        return (
                          <td
                            key={i}
                            className={`px-4 py-3 whitespace-nowrap ${
                              centered ? "text-center" : "text-left"
                            }`}
                          >
                            {isUrlCol ? (
                              hasUrl ? (
                                <a
                                  href={val}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline font-semibold text-slate-900 hover:text-slate-700"
                                  title={val}
                                >
                                  {id || "Open"}
                                </a>
                              ) : (
                                <span>{val}</span>
                              )
                            ) : colKey === "Hashtags" ? (
                              <span
                                className="block max-w-[600px] truncate"
                                title={String(val ?? "")}
                              >
                                {String(val ?? "")}
                              </span>
                            ) : (
                              val
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Botones SOLO cuando hay data disponible */}
            <div className="p-5 sm:p-6 flex flex-wrap justify-center gap-3">
              <button
                className={btnSuccess}
                onClick={() => {
                  playSound();
                  handleDownloadExcel();
                }}
                disabled={isLoadingExcel}
              >
                {isLoadingExcel ? "Exporting..." : "Export to Excel"}
              </button>
            </div>
          </>
        ) : (
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
        )}
      </section>
    </div>
  );
};

export default TikTokAPICall;
