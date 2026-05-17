import { useEffect, useMemo, useState, useContext, useRef } from "react";

import { getPaFiltersService } from "../services/orden-generation/PaService";
import { getTelephoneFiltersService } from "../services/orden-generation/TelephoneService";
import { getAuthorFiltersService } from "../services/orden-generation/AuthorService";
import AuthorResponse from "../interfaces/orden-generation/AuthorResponse";
import { getPostTypeFiltersService } from "../services/orden-generation/PostTypeService";
import { getSceneFiltersService } from "../services/orden-generation/SceneService";
import OrderQueriesFiltersRequest from "../interfaces/order-queries/OrderQueriesFiltersRequest";
import { searchOrderQueriesService } from "../services/order-queries/OrderQueriesService";
import { AuthUserContext } from "../context/AuthUserContext";
import { getCreatedByFiltersService } from "../services/order-queries/CreatedByService";

import { getRequiredImagesPerTipPublicacionService } from "../services/orden-generation/RequiredImagesService";
import NewManualOrderRequestDTO from "../interfaces/orden-generation/NewManualOrderRequestDTO";
import { updateManualOrderService } from "../services/orden-generation/ManualOrderService";

const formatDateLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTodayAndTomorrow = () => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  return {
    today: formatDateLocal(today),
    tomorrow: formatDateLocal(tomorrow),
  };
};

const isPaRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase() === "pa";

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const getInitialState = () => {
  const { today } = getTodayAndTomorrow();

  return {
    codPosteador: null,
    codTelefono: null,
    codAutora: null,
    codLibros: [],

    codTipoPosteo: null,
    codEscena: null,

    flgOrdenCompleta: null,
    tipRegistroOrden: null,

    codSonido: "",
    codCuentaTiktok: "",
    codusuarioauditoriacreareg: null,
    codEstadoOrden: null,

    fecPlanPosteoFrom: today,
    fecPlanPosteoTo: today,

    fecCreacionRegistroFrom: "",
    fecCreacionRegistroTo: "",
  };
};

const initialState = getInitialState();

const emptyCatalog = {
  posteadores: [],
  telefonos: [],
  autoras: [],
  libros: [],
  tiposPosteo: [],
  escenas: [],
  usuariosCreacion: [],
};

const IMAGE_VIDEO_REQUIRED_CONFIG = {
  1: {
    key: "codimagenprincipal",
    displayKey: "nCodimagenprincipal",
    label: "Main Image URL",
  },
  2: {
    key: "codimagenscreenshot",
    displayKey: "nCodimagenscreenshot",
    label: "Screenshot Image URL",
  },
  3: {
    key: "codimagendialogo",
    displayKey: "nCodimagendialogo",
    label: "Dialog Image URL",
  },
  4: {
    key: "codvideo",
    displayKey: "nCodvideo",
    label: "Video URL",
  },
};

const normalizeTipPublicacion = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const getRequiredImageVideoFieldsByTipPublicacion = (
  requiredRows,
  tippublicacion,
  tippublicacionLabel = null,
) => {
  const selectedValues = [
    normalizeTipPublicacion(tippublicacion),
    normalizeTipPublicacion(tippublicacionLabel),
  ].filter(Boolean);

  if (selectedValues.length === 0) return [];

  return (requiredRows || [])
    .filter((item) =>
      selectedValues.includes(normalizeTipPublicacion(item?.tippublicacion)),
    )
    .map((item) => IMAGE_VIDEO_REQUIRED_CONFIG[Number(item?.tipimagenvideo)])
    .filter(Boolean);
};

const getPostTypeLabelByValue = (postTypeOptions, value) => {
  const cleanValue = String(value ?? "").trim();

  if (!cleanValue) return null;

  const selected = (postTypeOptions || []).find((item) => {
    const optionValue =
      item?.value ??
      item?.codigo ??
      item?.code ??
      item?.id ??
      item?.tippublicacion ??
      item?.codtipoposteo ??
      "";

    return String(optionValue).trim() === cleanValue;
  });

  return (
    selected?.label ??
    selected?.nombre ??
    selected?.descripcion ??
    selected?.destipoposteo ??
    selected?.despost ??
    null
  );
};

const normalizeOrderQueryRow = (row) => {
  const tippublicacion =
    row?.tippublicacion ??
    row?.tipPublicacion ??
    row?.tipopublicacion ??
    row?.codtipoposteo ??
    row?.codTipoPosteo ??
    null;

  const nTippublicacion =
    row?.nTippublicacion ??
    row?.nCodtippublicacion ??
    row?.nCodTippublicacion ??
    row?.nCodTipoPosteo ??
    row?.destipoposteo ??
    row?.despost ??
    row?.postTypeName ??
    row?.postType ??
    tippublicacion ??
    null;

  const normalizedRow = {
    ...(row || {}),
    tippublicacion,
    nTippublicacion,

    nCodposteador:
      row?.nCodposteador ??
      row?.nCodPosteador ??
      row?.desposteador ??
      row?.nbposteador ??
      row?.publisherName ??
      row?.publisher ??
      row?.codposteador ??
      null,

    nCodautora:
      row?.nCodautora ??
      row?.nCodAutora ??
      row?.nbrautora ??
      row?.nbautora ??
      row?.desautora ??
      row?.authorName ??
      row?.author ??
      row?.codautora ??
      null,

    nCodlibro:
      row?.nCodlibro ??
      row?.nCodLibro ??
      row?.deslibro ??
      row?.nblibro ??
      row?.bookName ??
      row?.book ??
      row?.codlibro ??
      null,

    nCodescena:
      row?.nCodescena ??
      row?.nCodEscena ??
      row?.desscena ??
      row?.desescena ??
      row?.sceneName ??
      row?.scene ??
      row?.codescena ??
      null,

    nCodsonido:
      row?.nCodsonido ??
      row?.nCodSonido ??
      row?.urlsonido ??
      row?.soundUrl ??
      row?.codsonido ??
      null,

    nCodimagenprincipal:
      row?.nCodimagenprincipal ??
      row?.nCodImagenPrincipal ??
      row?.urlimagenprincipal ??
      row?.mainImageUrl ??
      row?.codimagenprincipal ??
      null,

    nCodimagenscreenshot:
      row?.nCodimagenscreenshot ??
      row?.nCodImagenScreenshot ??
      row?.urlimagenscreenshot ??
      row?.screenshotImageUrl ??
      row?.codimagenscreenshot ??
      null,

    nCodimagendialogo:
      row?.nCodimagendialogo ??
      row?.nCodImagenDialogo ??
      row?.urlimagendialogo ??
      row?.dialogImageUrl ??
      row?.codimagendialogo ??
      null,

    nCodvideo:
      row?.nCodvideo ??
      row?.nCodVideo ??
      row?.urlvideo ??
      row?.videoUrl ??
      row?.codvideo ??
      null,
  };

  console.log("tippublicacion final normalizado:", tippublicacion);
  console.log("row normalizado:", normalizedRow);

  console.groupEnd();

  return normalizedRow;
};

const cleanText = (value) => String(value ?? "").trim();

const getLastCharLower = (value) => {
  const text = cleanText(value);
  if (!text) return "";
  return text.slice(-1).toLowerCase();
};

const removePrefixIgnoreCase = (text, prefix) => {
  const cleanMainText = cleanText(text);
  const cleanPrefix = cleanText(prefix);

  if (!cleanMainText || !cleanPrefix) return cleanMainText;

  if (cleanMainText.toLowerCase().startsWith(cleanPrefix.toLowerCase())) {
    return cleanMainText.slice(cleanPrefix.length).trim();
  }

  return cleanMainText;
};

const cleanSceneCodeForPalote = ({ codescena, codlibro, tippublicacion }) => {
  let sceneCode = cleanText(codescena);
  const bookCode = cleanText(codlibro);
  const lastTipChar = getLastCharLower(tippublicacion);

  if (!sceneCode) return "";

  const prefixes = [
    `${bookCode}-${lastTipChar}-`,
    `${bookCode} - ${lastTipChar} -`,
    `${bookCode}-${lastTipChar}`,
    `${bookCode} - ${lastTipChar}`,
    `${bookCode}-`,
    `${bookCode} -`,
    bookCode,
  ].filter((value) => cleanText(value) !== "");

  prefixes.forEach((prefix) => {
    sceneCode = removePrefixIgnoreCase(sceneCode, prefix);
  });

  sceneCode = sceneCode.replace(/^[-|]+/, "").trim();

  if (
    lastTipChar &&
    sceneCode.toLowerCase().endsWith(lastTipChar.toLowerCase())
  ) {
    sceneCode = sceneCode.slice(0, -1).trim();
  }

  return sceneCode;
};

export function useOrderQueriesFilters({ token, notifySearchValidation } = {}) {
  const { jwt, role, userEmail } = useContext(AuthUserContext);

  const ORDER_QUERIES_CACHE_PREFIX = "orderQueries.v1";

  const normalizedUserKey = String(userEmail || "anonymous")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_");

  const orderQueriesCacheKey = `${ORDER_QUERIES_CACHE_PREFIX}_${normalizedUserKey}`;

  const STORAGE_KEY = `${orderQueriesCacheKey}.filters`;
  const CATALOG_STORAGE_KEY = `${orderQueriesCacheKey}.catalog`;
  const AUTHOR_BOOK_ROWS_STORAGE_KEY = `${orderQueriesCacheKey}.authorBookRows`;
  const ORDERS_ROWS_STORAGE_KEY = `${orderQueriesCacheKey}.rows`;
  const ORDERS_COLUMNS_STORAGE_KEY = `${orderQueriesCacheKey}.columns`;
  const DATA_LOADED_STORAGE_KEY = `${orderQueriesCacheKey}.dataLoaded`;
  const STEP_STORAGE_KEY = `${orderQueriesCacheKey}.step`;
  const ALERTS_STORAGE_KEY = `${orderQueriesCacheKey}.alerts`;
  const isPaUser = isPaRole(role);
  const paDefaultsAppliedRef = useRef(false);

  const [filterStep, setFilterStep] = useState(() => {
    try {
      const raw = localStorage.getItem(STEP_STORAGE_KEY);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return typeof parsed === "number" ? parsed : 0;
    } catch {
      return 0;
    }
  });

  const [filters, setFilters] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return initialState;
      const parsed = JSON.parse(raw);
      return { ...initialState, ...parsed };
    } catch {
      return initialState;
    }
  });

  const [catalog, setCatalog] = useState(() => {
    try {
      const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
      if (!raw) return emptyCatalog;
      const parsed = JSON.parse(raw);
      return { ...emptyCatalog, ...parsed };
    } catch {
      return emptyCatalog;
    }
  });

  const [editFilters, setEditFilters] = useState({
    codposteador: null,
    codtelefono: null,
    tiptelefono: null,
    codautora: null,
    codlibro: null,
    tippublicacion: null,
    codescena: null,
  });

  const [editCatalog, setEditCatalog] = useState({
    ...emptyCatalog,
  });

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftOrder, setDraftOrder] = useState(null);

  const [requiredImagesPerTipPublicacion, setRequiredImagesPerTipPublicacion] =
    useState([]);

  const [authorBookRows, setAuthorBookRows] = useState(() => {
    try {
      const raw = localStorage.getItem(AUTHOR_BOOK_ROWS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [ordersRows, setOrdersRows] = useState(() => {
    try {
      const raw = localStorage.getItem(ORDERS_ROWS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [ordersColumns, setOrdersColumns] = useState(() => {
    try {
      const raw = localStorage.getItem(ORDERS_COLUMNS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [dataLoaded, setDataLoaded] = useState(() => {
    try {
      const raw = localStorage.getItem(DATA_LOADED_STORAGE_KEY);
      if (!raw) return true;
      return JSON.parse(raw) === true;
    } catch {
      return true;
    }
  });

  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const [notifOpen, setNotifOpen] = useState(false);
  const [generationAlerts, setGenerationAlerts] = useState(() => {
    try {
      const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!userEmail) return;

    try {
      const rawStep = localStorage.getItem(STEP_STORAGE_KEY);
      setFilterStep(rawStep ? (JSON.parse(rawStep) ?? 0) : 0);
    } catch {
      setFilterStep(0);
    }

    try {
      const rawFilters = localStorage.getItem(STORAGE_KEY);
      setFilters(() => {
        const baseState = getInitialState();

        if (!rawFilters) return baseState;

        const parsed = JSON.parse(rawFilters);

        return {
          ...baseState,
          ...parsed,
          fecPlanPosteoFrom:
            parsed.fecPlanPosteoFrom || baseState.fecPlanPosteoFrom,
          fecPlanPosteoTo: parsed.fecPlanPosteoTo || baseState.fecPlanPosteoTo,
        };
      });
    } catch {
      setFilters(initialState);
    }

    try {
      const rawCatalog = localStorage.getItem(CATALOG_STORAGE_KEY);
      setCatalog(
        rawCatalog
          ? { ...emptyCatalog, ...JSON.parse(rawCatalog) }
          : emptyCatalog,
      );
    } catch {
      setCatalog(emptyCatalog);
    }

    try {
      const rawAuthorBookRows = localStorage.getItem(
        AUTHOR_BOOK_ROWS_STORAGE_KEY,
      );
      setAuthorBookRows(rawAuthorBookRows ? JSON.parse(rawAuthorBookRows) : []);
    } catch {
      setAuthorBookRows([]);
    }

    try {
      const rawOrdersRows = localStorage.getItem(ORDERS_ROWS_STORAGE_KEY);
      setOrdersRows(rawOrdersRows ? JSON.parse(rawOrdersRows) : []);
    } catch {
      setOrdersRows([]);
    }

    try {
      const rawOrdersColumns = localStorage.getItem(ORDERS_COLUMNS_STORAGE_KEY);
      setOrdersColumns(rawOrdersColumns ? JSON.parse(rawOrdersColumns) : []);
    } catch {
      setOrdersColumns([]);
    }

    try {
      const rawDataLoaded = localStorage.getItem(DATA_LOADED_STORAGE_KEY);
      setDataLoaded(rawDataLoaded ? JSON.parse(rawDataLoaded) === true : true);
    } catch {
      setDataLoaded(true);
    }

    try {
      const rawAlerts = localStorage.getItem(ALERTS_STORAGE_KEY);
      setGenerationAlerts(rawAlerts ? JSON.parse(rawAlerts) : []);
    } catch {
      setGenerationAlerts([]);
    }
  }, [
    userEmail,
    STORAGE_KEY,
    CATALOG_STORAGE_KEY,
    AUTHOR_BOOK_ROWS_STORAGE_KEY,
    ORDERS_ROWS_STORAGE_KEY,
    ORDERS_COLUMNS_STORAGE_KEY,
    DATA_LOADED_STORAGE_KEY,
    STEP_STORAGE_KEY,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(STEP_STORAGE_KEY, JSON.stringify(filterStep));
    } catch {}
  }, [filterStep]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch {}
  }, [filters]);

  useEffect(() => {
    try {
      localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog));
    } catch {}
  }, [catalog]);

  useEffect(() => {
    try {
      localStorage.setItem(
        AUTHOR_BOOK_ROWS_STORAGE_KEY,
        JSON.stringify(authorBookRows),
      );
    } catch {}
  }, [authorBookRows]);

  useEffect(() => {
    try {
      localStorage.setItem(ORDERS_ROWS_STORAGE_KEY, JSON.stringify(ordersRows));
    } catch {}
  }, [ordersRows]);

  useEffect(() => {
    try {
      localStorage.setItem(
        ORDERS_COLUMNS_STORAGE_KEY,
        JSON.stringify(ordersColumns),
      );
    } catch {}
  }, [ordersColumns]);

  useEffect(() => {
    try {
      localStorage.setItem(DATA_LOADED_STORAGE_KEY, JSON.stringify(dataLoaded));
    } catch {}
  }, [dataLoaded]);

  useEffect(() => {
    try {
      localStorage.setItem(
        ALERTS_STORAGE_KEY,
        JSON.stringify(generationAlerts),
      );
    } catch {}
  }, [generationAlerts]);

  useEffect(() => {
    if (paDefaultsAppliedRef.current) return;

    const { today } = getTodayAndTomorrow();

    setFilters((prev) => ({
      ...prev,
      fecPlanPosteoFrom: prev.fecPlanPosteoFrom || today,
      fecPlanPosteoTo: prev.fecPlanPosteoTo || today,
    }));

    paDefaultsAppliedRef.current = true;
  }, []);

  useEffect(() => {
    let active = true;
    if (!token) return;

    (async () => {
      setLoadingCatalog(true);
      try {
        const [posteadoresRaw, usuariosCreacion] = await Promise.all([
          getPaFiltersService({ token }),
          getCreatedByFiltersService({ token }),
        ]);

        if (!active) return;

        const posteadores = isPaUser
          ? (Array.isArray(posteadoresRaw) ? posteadoresRaw : []).filter(
              (item) => {
                const paCorreoText = normalizeText(item?.pa_correo);
                const emailText = normalizeText(userEmail);

                return paCorreoText === emailText;
              },
            )
          : posteadoresRaw;
        console.log(posteadores);

        setCatalog((prev) => ({
          ...prev,
          posteadores,
          usuariosCreacion,
        }));
      } finally {
        if (active) setLoadingCatalog(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [token, isPaUser, userEmail]);

  useEffect(() => {
    let active = true;

    if (!token) {
      setRequiredImagesPerTipPublicacion([]);
      return;
    }

    (async () => {
      try {
        const rows = await getRequiredImagesPerTipPublicacionService({ token });
        if (!active) return;
        setRequiredImagesPerTipPublicacion(Array.isArray(rows) ? rows : []);
      } catch (error) {
        console.error("Error loading required image/video fields:", error);
        if (active) setRequiredImagesPerTipPublicacion([]);
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!isPaUser) return;

    const onlyPa =
      Array.isArray(catalog.posteadores) && catalog.posteadores.length === 1
        ? catalog.posteadores[0]
        : null;

    if (!onlyPa?.value) return;

    setFilters((prev) => {
      if (String(prev.codPosteador ?? "") === String(onlyPa.value)) return prev;

      return {
        ...prev,
        codPosteador: onlyPa.value,
        codTelefono: null,
        codAutora: null,
        codLibros: [],
        codTipoPosteo: null,
        codEscena: null,
      };
    });
  }, [isPaUser, catalog.posteadores]);

  useEffect(() => {
    let active = true;

    if (!token || !filters.codPosteador) {
      setCatalog((prev) => ({
        ...prev,
        telefonos: [],
      }));
      return;
    }

    (async () => {
      setLoadingCatalog(true);
      try {
        const telefonos = await getTelephoneFiltersService({
          token,
          PaCode: filters.codPosteador,
        });

        if (!active) return;

        setCatalog((prev) => ({
          ...prev,
          telefonos,
        }));
      } finally {
        if (active) setLoadingCatalog(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [token, filters.codPosteador]);

  const getSelectedTipTelefono = () => {
    if (!filters.codTelefono) return null;

    const selectedTelefono = (catalog.telefonos || []).find(
      (item) => String(item?.value ?? "") === String(filters.codTelefono ?? ""),
    );

    return selectedTelefono?.tiptelefono ?? null;
  };

  useEffect(() => {
    let active = true;

    if (!token || !filters.codPosteador) {
      setAuthorBookRows([]);
      setCatalog((prev) => ({
        ...prev,
        autoras: [],
        libros: [],
      }));
      return;
    }

    (async () => {
      setLoadingCatalog(true);
      try {
        const rows = await getAuthorFiltersService({
          token,
          codposteador: filters.codPosteador,
          codtelefono: filters.codTelefono,
          tiptelefono: getSelectedTipTelefono(),
        });

        if (!active) return;

        const autoras = AuthorResponse.toAuthorOptionList(rows);
        const libros = AuthorResponse.toBookOptionListByAuthor(
          rows,
          filters.codAutora,
        );

        setAuthorBookRows(rows);

        setCatalog((prev) => ({
          ...prev,
          autoras,
          libros,
        }));
      } finally {
        if (active) setLoadingCatalog(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [token, filters.codPosteador, filters.codTelefono, filters.codAutora]);

  useEffect(() => {
    const libros = AuthorResponse.toBookOptionListByAuthor(
      authorBookRows,
      filters.codAutora,
    );

    setCatalog((prev) => ({
      ...prev,
      libros,
    }));
  }, [authorBookRows, filters.codAutora]);

  useEffect(() => {
    let active = true;

    const codlibro =
      filters.codLibros && filters.codLibros[0] ? filters.codLibros[0] : null;

    if (!token || !codlibro) {
      setCatalog((prev) => ({
        ...prev,
        tiposPosteo: [],
      }));
      return;
    }

    (async () => {
      setLoadingCatalog(true);
      try {
        const tiposPosteo = await getPostTypeFiltersService({
          token,
          codlibro,
        });

        if (!active) return;

        setCatalog((prev) => ({
          ...prev,
          tiposPosteo,
        }));
      } finally {
        if (active) setLoadingCatalog(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [token, filters.codLibros]);

  useEffect(() => {
    let active = true;

    const codlibro =
      filters.codLibros && filters.codLibros[0] ? filters.codLibros[0] : null;

    const tippublicacion = filters.codTipoPosteo ?? null;

    if (!token || !codlibro || !tippublicacion) {
      setCatalog((prev) => ({
        ...prev,
        escenas: [],
      }));
      return;
    }

    (async () => {
      setLoadingCatalog(true);
      try {
        const escenas = await getSceneFiltersService({
          token,
          codlibro,
          tippublicacion,
        });

        if (!active) return;

        setCatalog((prev) => ({
          ...prev,
          escenas,
        }));
      } finally {
        if (active) setLoadingCatalog(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [token, filters.codLibros, filters.codTipoPosteo]);

  useEffect(() => {
    let active = true;

    if (!token || !isEditing || !selectedOrder?.codordentrabajo) return;

    if (!editFilters.codposteador) {
      setEditCatalog((prev) => ({
        ...prev,
        telefonos: [],
        autoras: [],
        libros: [],
        tiposPosteo: [],
        escenas: [],
      }));
      return;
    }

    (async () => {
      setLoadingCatalog(true);
      try {
        const telefonos = await getTelephoneFiltersService({
          token,
          PaCode: editFilters.codposteador,
        });

        if (!active) return;

        setEditCatalog((prev) => ({
          ...prev,
          telefonos,
        }));
      } finally {
        if (active) setLoadingCatalog(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    token,
    isEditing,
    selectedOrder?.codordentrabajo,
    editFilters.codposteador,
  ]);

  const getSelectedEditTipTelefono = () => {
    if (!editFilters.codtelefono) return null;

    const selectedTelefono = (editCatalog.telefonos || []).find(
      (item) =>
        String(item?.value ?? "") === String(editFilters.codtelefono ?? ""),
    );

    return selectedTelefono?.tiptelefono ?? null;
  };

  useEffect(() => {
    let active = true;

    if (!token || !isEditing || !selectedOrder?.codordentrabajo) return;

    if (!editFilters.codposteador) {
      setEditCatalog((prev) => ({
        ...prev,
        autoras: [],
        libros: [],
        tiposPosteo: [],
        escenas: [],
      }));
      return;
    }

    (async () => {
      setLoadingCatalog(true);
      try {
        const rows = await getAuthorFiltersService({
          token,
          codposteador: editFilters.codposteador,
          codtelefono: editFilters.codtelefono,
          tiptelefono: getSelectedEditTipTelefono(),
        });

        if (!active) return;

        const autoras = AuthorResponse.toAuthorOptionList(rows);
        const libros = AuthorResponse.toBookOptionListByAuthor(
          rows,
          editFilters.codautora,
        );

        setEditCatalog((prev) => ({
          ...prev,
          autoras,
          libros,
        }));
      } finally {
        if (active) setLoadingCatalog(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    token,
    isEditing,
    selectedOrder?.codordentrabajo,
    editFilters.codposteador,
    editFilters.codtelefono,
    editFilters.codautora,
  ]);

  useEffect(() => {
    let active = true;

    if (!token || !isEditing || !selectedOrder?.codordentrabajo) return;

    const codlibro = editFilters.codlibro ?? null;

    if (!codlibro) {
      setEditCatalog((prev) => ({
        ...prev,
        tiposPosteo: [],
        escenas: [],
      }));
      return;
    }

    (async () => {
      setLoadingCatalog(true);
      try {
        const tiposPosteo = await getPostTypeFiltersService({
          token,
          codlibro,
        });

        if (!active) return;

        setEditCatalog((prev) => ({
          ...prev,
          tiposPosteo,
        }));
      } finally {
        if (active) setLoadingCatalog(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [token, isEditing, selectedOrder?.codordentrabajo, editFilters.codlibro]);

  useEffect(() => {
    let active = true;

    if (!token || !isEditing || !selectedOrder?.codordentrabajo) return;

    const codlibro = editFilters.codlibro ?? null;
    const tippublicacion = editFilters.tippublicacion ?? null;

    if (!codlibro || !tippublicacion) {
      setEditCatalog((prev) => ({
        ...prev,
        escenas: [],
      }));
      return;
    }

    (async () => {
      setLoadingCatalog(true);

      try {
        const escenas = await getSceneFiltersService({
          token,
          codlibro,
          tippublicacion,
        });

        if (!active) return;

        setEditCatalog((prev) => ({
          ...prev,
          escenas,
        }));
      } finally {
        if (active) setLoadingCatalog(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    token,
    isEditing,
    selectedOrder?.codordentrabajo,
    editFilters.codlibro,
    editFilters.tippublicacion,
  ]);

  const requestPayload = useMemo(() => {
    const codlibro =
      filters.codLibros && filters.codLibros[0] ? filters.codLibros[0] : null;

    const parseIntegerOrNull = (value) => {
      if (value === null || value === undefined || value === "") return null;
      const parsed = Number(value);
      return Number.isInteger(parsed) ? parsed : null;
    };

    return {
      ...OrderQueriesFiltersRequest,

      correo: null,
      codposteador: filters.codPosteador || null,
      codtelefono: filters.codTelefono || null,
      codautora: filters.codAutora || null,
      codlibro,
      tippublicacion: filters.codTipoPosteo || null,

      codescena: filters.codEscena || null,
      codsonido: parseIntegerOrNull(filters.codSonido),
      codcuentatiktok: filters.codCuentaTiktok?.trim() || null,
      codusuarioauditoriacreareg:
        filters.codusuarioauditoriacreareg?.trim() || null,
      codestadoorden:
        filters.codEstadoOrden === null ||
        filters.codEstadoOrden === undefined ||
        filters.codEstadoOrden === ""
          ? null
          : Number(filters.codEstadoOrden),
      flgordencompleta: filters.flgOrdenCompleta || null,
      tipregistroorden: filters.tipRegistroOrden || null,
      fecplanposteoinicio: filters.fecPlanPosteoFrom || null,
      fecplanposteofin: filters.fecPlanPosteoTo || null,
      fecreacionregistroinicio: filters.fecCreacionRegistroFrom || null,
      fecreacionregistrofin: filters.fecCreacionRegistroTo || null,
    };
  }, [filters]);

  const dummyColumns = [
    { key: "codordentrabajo", header: "Work Order Id" },
    { key: "codcabeceraordentrabajo", header: "Work Order Header Id" },
    { key: "nCodposteador", header: "Publisher (PA)" },
    { key: "codtelefono", header: "Telephone Code" },
    { key: "nCodautora", header: "Author Name" },
    { key: "nCodlibro", header: "Book Name" },
    { key: "nTippublicacion", header: "Post Type" },

    { key: "nCodescena", header: "Scene Name" },
    { key: "codcuentatiktok", header: "TikTok Account" },
    { key: "nCodsonido", header: "Sound URL" },
    { key: "desscenahook", header: "Scene Hook" },
    { key: "descaption", header: "Caption" },
    { key: "destropo", header: "Trope" },
    { key: "desslide1keywordshide", header: "Slide 1 Keywords Hide" },
    { key: "desslide2keywordshide", header: "Slide 2 Keywords Hide" },
    { key: "deshashtag", header: "Hashtags" },
    { key: "despalote", header: "Full Stick" },
    { key: "nCodimagenprincipal", header: "Main Image URL" },
    { key: "nCodimagenscreenshot", header: "Screenshot Image URL" },
    { key: "nCodimagendialogo", header: "Dialog Image URL" },
    { key: "nCodvideo", header: "Video URL" },
    { key: "desinstrucciones", header: "Instructions" },
    { key: "fecplanposteo", header: "Planned Posting Date" },
    { key: "codestadoorden", header: "Order Status" },
    { key: "tipregistroorden", header: "Record Type" },
    { key: "flgordencompleta", header: "Complete Order Flag" },
    { key: "ctddatoobligincompleto", header: "Missing Required Data Count" },
    { key: "desdatoobligincompleto", header: "Missing Required Data Detail" },
    { key: "deslogerrororden", header: "Order Error Log" },
    { key: "codusuarioauditoriacreareg", header: "Created By" },
    { key: "codusuarioauditoriaactualizareg", header: "Updated By" },
    { key: "fecreacionregistro", header: "Creation Date" },
    { key: "horacreacionregistro", header: "Creation Time" },
    { key: "fecactualizacionregistro", header: "Update Date" },
    { key: "horaactualizacionregistro", header: "Update Time" },
  ];

  const notify = (title, message, type = "info") => {
    if (typeof notifySearchValidation === "function") {
      notifySearchValidation(title, message, type);
    }
  };

  const addOrderQueryAlert = ({
    status = "success",
    recordsCount = 0,
    errorMessage = null,
  }) => {
    const now = new Date();

    const nuevaAlerta = {
      id: `${now.getTime()}-${Math.random().toString(16).slice(2)}`,
      title:
        status === "error"
          ? "Order query failed"
          : status === "warning"
            ? "Completed without results"
            : "Order query completed",
      status,
      recordsCount,
      errorMessage,
      createdAt: now.toISOString(),
    };

    setGenerationAlerts((prev) => [nuevaAlerta, ...prev]);
  };

  const runSearch = async () => {
    if (!token) return { ok: false, reason: "no-token" };

    setLoadingSearch(true);

    try {
      const response = await searchOrderQueriesService({
        token,
        request: requestPayload,
      });

      const rows = Array.isArray(response)
        ? response.map(normalizeOrderQueryRow)
        : [];

      const columns = dummyColumns;

      setOrdersRows(rows);
      setOrdersColumns(columns);
      setDataLoaded(true);

      addOrderQueryAlert({
        status: rows.length === 0 ? "warning" : "success",
        recordsCount: rows.length,
        errorMessage: null,
      });

      if (rows.length === 0) {
        notify(
          "No data found",
          "No results were found for the selected filters.",
          "warning",
        );
      } else {
        notify(
          "Search completed",
          `Found ${rows.length} result${rows.length === 1 ? "" : "s"} successfully.`,
          "success",
        );
      }

      return { ok: true, rowsCount: rows.length };
    } catch (error) {
      console.error("Order queries search failed:", error);
      setOrdersRows([]);
      setOrdersColumns([]);
      setDataLoaded(true);

      const errorMessage =
        error?.message || "An unexpected error occurred while querying orders.";

      addOrderQueryAlert({
        status: "error",
        recordsCount: 0,
        errorMessage,
      });

      notify("Search failed", errorMessage, "error");

      return { ok: false, reason: "error", error };
    } finally {
      setLoadingSearch(false);
    }
  };

  const requiredImageVideoFields = useMemo(() => {
    const currentTipPublicacion =
      editFilters.tippublicacion ||
      draftOrder?.tippublicacion ||
      selectedOrder?.tippublicacion ||
      "";

    const currentTipPublicacionLabel = getPostTypeLabelByValue(
      editCatalog?.tiposPosteo?.length
        ? editCatalog.tiposPosteo
        : catalog?.tiposPosteo,
      currentTipPublicacion,
    );

    const requiredFields = getRequiredImageVideoFieldsByTipPublicacion(
      requiredImagesPerTipPublicacion,
      currentTipPublicacion,
      currentTipPublicacionLabel,
    );

    return {
      codimagenprincipal: requiredFields.some(
        (field) => field.key === "codimagenprincipal",
      ),
      codimagenscreenshot: requiredFields.some(
        (field) => field.key === "codimagenscreenshot",
      ),
      codimagendialogo: requiredFields.some(
        (field) => field.key === "codimagendialogo",
      ),
      codvideo: requiredFields.some((field) => field.key === "codvideo"),
    };
  }, [
    editFilters.tippublicacion,
    draftOrder?.tippublicacion,
    selectedOrder?.tippublicacion,
    editCatalog?.tiposPosteo,
    catalog?.tiposPosteo,
    requiredImagesPerTipPublicacion,
  ]);

  const buildAutoPalote = (order) => {
    const codautora = cleanText(order?.codautora);
    const codlibro = cleanText(order?.codlibro);
    const tippublicacion = cleanText(order?.tippublicacion);
    console.log(tippublicacion);
    const codposteador = cleanText(order?.codposteador);

    const codescenaLimpio = cleanSceneCodeForPalote({
      codescena: order?.codescena,
      codlibro,
      tippublicacion,
    });

    const values = [
      codautora,
      codlibro,
      codescenaLimpio,
      tippublicacion,
      codposteador,
    ];

    if (values.some((value) => !cleanText(value))) {
      return "";
    }

    return values.join("|");
  };

  const withAutoPalote = (order) => {
    const nextOrder = { ...(order || {}) };

    return {
      ...nextOrder,
      despalote: buildAutoPalote(nextOrder),
    };
  };

  const buildManualOrderRequestBody = ({ newValues, editCascadeStarted }) => {
    const hasValue = (value) => {
      if (value == null) return false;
      if (typeof value === "string") return value.trim() !== "";
      return true;
    };

    const toNullableInteger = (value) => {
      if (!hasValue(value)) return null;

      const parsed = Number(value);
      return Number.isNaN(parsed) ? null : parsed;
    };

    const toNullableText = (value) => {
      if (!hasValue(value)) return null;

      const cleaned = String(value).trim();
      return cleaned === "" ? null : cleaned;
    };

    const isDifferentText = (newValue, oldValue) => {
      if (!hasValue(newValue)) return false;

      return String(newValue ?? "").trim() !== String(oldValue ?? "").trim();
    };

    const isDifferentNumber = (newValue, oldValue) => {
      if (!hasValue(newValue)) return false;

      const next = Number(newValue);
      const prev = Number(oldValue);

      if (Number.isNaN(next)) return false;

      return next !== prev;
    };

    const body = {
      ...NewManualOrderRequestDTO,

      correo: userEmail?.trim()?.toLowerCase() || "",

      codposteador: null,
      codtelefono: null,
      codautora: null,
      codlibro: null,
      tippublicacion: null,
      codescena: null,

      codcuentatiktok: null,
      codsonido: null,
      desscenahook: null,
      descaption: null,
      destropo: null,
      desslide1keywordshide: null,
      desslide2keywordshide: null,
      deshashtag: null,
      despalote: null,

      codimagenprincipal: null,
      codimagenscreenshot: null,
      codimagendialogo: null,
      codvideo: null,

      desinstrucciones: null,
      fecplanposteo: null,
      codestadoorden: null,
    };

    if (editCascadeStarted) {
      body.codposteador = editFilters.codposteador;
      body.codtelefono = editFilters.codtelefono || null;
      body.codautora = editFilters.codautora;
      body.codlibro = editFilters.codlibro;
      body.tippublicacion = editFilters.tippublicacion;
      body.codescena = editFilters.codescena;

      body.despalote = buildAutoPalote({
        codposteador: editFilters.codposteador,
        codautora: editFilters.codautora,
        codlibro: editFilters.codlibro,
        tippublicacion: editFilters.tippublicacion,
        codescena: editFilters.codescena,
      });
    }

    if (
      isDifferentText(newValues.newCodCuentaTiktok, draftOrder?.codcuentatiktok)
    ) {
      body.codcuentatiktok = toNullableText(newValues.newCodCuentaTiktok);
    }

    if (isDifferentNumber(newValues.newCodSonido, draftOrder?.codsonido)) {
      body.codsonido = toNullableInteger(newValues.newCodSonido);
    }

    if (isDifferentText(newValues.newDesScenaHook, draftOrder?.desscenahook)) {
      body.desscenahook = toNullableText(newValues.newDesScenaHook);
    }

    if (isDifferentText(newValues.newDesCaption, draftOrder?.descaption)) {
      body.descaption = toNullableText(newValues.newDesCaption);
    }

    if (isDifferentText(newValues.newDesTropo, draftOrder?.destropo)) {
      body.destropo = toNullableText(newValues.newDesTropo);
    }

    if (
      isDifferentText(
        newValues.newDesSlide1KeywordsHide,
        draftOrder?.desslide1keywordshide,
      )
    ) {
      body.desslide1keywordshide = toNullableText(
        newValues.newDesSlide1KeywordsHide,
      );
    }

    if (
      isDifferentText(
        newValues.newDesSlide2KeywordsHide,
        draftOrder?.desslide2keywordshide,
      )
    ) {
      body.desslide2keywordshide = toNullableText(
        newValues.newDesSlide2KeywordsHide,
      );
    }

    if (isDifferentText(newValues.newDesHashtag, draftOrder?.deshashtag)) {
      body.deshashtag = toNullableText(newValues.newDesHashtag);
    }

    if (
      isDifferentText(
        newValues.newCodImagenPrincipal,
        draftOrder?.codimagenprincipal ?? draftOrder?.nCodimagenprincipal,
      )
    ) {
      body.codimagenprincipal = toNullableText(newValues.newCodImagenPrincipal);
    }

    if (
      isDifferentText(
        newValues.newCodImagenScreenshot,
        draftOrder?.codimagenscreenshot ?? draftOrder?.nCodimagenscreenshot,
      )
    ) {
      body.codimagenscreenshot = toNullableText(
        newValues.newCodImagenScreenshot,
      );
    }

    if (
      isDifferentText(
        newValues.newCodImagenDialogo,
        draftOrder?.codimagendialogo ?? draftOrder?.nCodimagendialogo,
      )
    ) {
      body.codimagendialogo = toNullableText(newValues.newCodImagenDialogo);
    }

    if (
      isDifferentText(
        newValues.newCodVideo,
        draftOrder?.codvideo ?? draftOrder?.nCodvideo,
      )
    ) {
      body.codvideo = toNullableText(newValues.newCodVideo);
    }

    if (
      isDifferentText(
        newValues.newDesInstrucciones,
        draftOrder?.desinstrucciones,
      )
    ) {
      body.desinstrucciones = toNullableText(newValues.newDesInstrucciones);
    }

    if (
      isDifferentText(newValues.newFecPlanPosteo, draftOrder?.fecplanposteo)
    ) {
      body.fecplanposteo = toNullableText(newValues.newFecPlanPosteo);
    }

    if (
      isDifferentNumber(newValues.newCodEstadoOrden, draftOrder?.codestadoorden)
    ) {
      body.codestadoorden = toNullableInteger(newValues.newCodEstadoOrden);
    }

    return body;
  };

  const actions = useMemo(() => {
    return {
      openNotifications: () => setNotifOpen(true),
      toggleNotifications: () => setNotifOpen((prev) => !prev),
      closeNotifications: () => setNotifOpen(false),
      clearNotifications: () => setGenerationAlerts([]),

      openDetails: (row) => {
        setSelectedOrder(row);
        setDraftOrder(row ? { ...row } : null);
        setIsEditing(false);
        setDetailsOpen(true);
      },

      closeDetails: () => {
        setDetailsOpen(false);
        setIsEditing(false);
        setSelectedOrder(null);
        setDraftOrder(null);
        setEditFilters({
          codposteador: null,
          codtelefono: null,
          tiptelefono: null,
          codautora: null,
          codlibro: null,
          tippublicacion: null,
          codescena: null,
        });
        setEditCatalog({
          ...emptyCatalog,
        });
      },

      editDetails: () => {
        setEditFilters({
          codposteador: null,
          codtelefono: null,
          tiptelefono: null,
          codautora: null,
          codlibro: null,
          tippublicacion: null,
          codescena: null,
        });

        setEditCatalog({
          ...emptyCatalog,
        });

        setIsEditing(true);
      },

      changeDraft: (key, value) => {
        setDraftOrder((prev) =>
          withAutoPalote({
            ...(prev || {}),
            [key]: value,
          }),
        );
      },

      setEditCodPosteador: (v) => {
        setEditFilters((prev) => ({
          ...prev,
          codposteador: v || null,
          codtelefono: null,
          tiptelefono: null,
          codautora: null,
          codlibro: null,
          tippublicacion: null,
          codescena: null,
        }));
      },

      setEditCodTelefono: (v) => {
        setEditFilters((prev) => ({
          ...prev,
          codtelefono: v || null,
          tiptelefono: null,
          codautora: null,
          codlibro: null,
          tippublicacion: null,
          codescena: null,
        }));
      },

      setEditCodAutora: (v) => {
        setEditFilters((prev) => ({
          ...prev,
          codautora: v || null,
          codlibro: null,
          tippublicacion: null,
          codescena: null,
        }));
      },

      setEditCodLibro: (v) => {
        setEditFilters((prev) => ({
          ...prev,
          codlibro: v || null,
          tippublicacion: null,
          codescena: null,
        }));
      },

      setEditCodTipoPosteo: (v) => {
        setEditFilters((prev) => ({
          ...prev,
          tippublicacion: v || null,
          codescena: null,
        }));
      },

      setEditCodEscena: (v) => {
        setEditFilters((prev) => ({
          ...prev,
          codescena: v || null,
        }));
      },

      saveDetails: async (newValues = {}) => {
        const hasValue = (value) => {
          if (value == null) return false;
          if (typeof value === "string") return value.trim() !== "";
          return true;
        };

        const cleanValue = (value) => {
          if (typeof value === "string") return value.trim();
          return value;
        };

        const isValidHttpUrl = (value) => {
          const text = String(value ?? "").trim();

          if (!text) return false;

          try {
            const url = new URL(text);
            return url.protocol === "http:" || url.protocol === "https:";
          } catch {
            return false;
          }
        };

        const editCascadeStarted = [
          editFilters.codposteador,
          editFilters.codtelefono,
          editFilters.codautora,
          editFilters.codlibro,
          editFilters.tippublicacion,
          editFilters.codescena,
        ].some(hasValue);

        if (editCascadeStarted) {
          const faltantesEditCascade = [];

          if (!hasValue(editFilters.codposteador))
            faltantesEditCascade.push("Publisher");
          if (!hasValue(editFilters.codautora))
            faltantesEditCascade.push("Author");
          if (!hasValue(editFilters.codlibro))
            faltantesEditCascade.push("Book");
          if (!hasValue(editFilters.tippublicacion))
            faltantesEditCascade.push("Post Type");
          if (!hasValue(editFilters.codescena))
            faltantesEditCascade.push("Scene");

          const editTipPublicacionLabel = getPostTypeLabelByValue(
            editCatalog?.tiposPosteo,
            editFilters.tippublicacion,
          );

          const requiredImageVideoFieldsForEdit =
            getRequiredImageVideoFieldsByTipPublicacion(
              requiredImagesPerTipPublicacion,
              editFilters.tippublicacion,
              editTipPublicacionLabel,
            );

          const newImageValuesByFieldKey = {
            codimagenprincipal: newValues.newCodImagenPrincipal,
            codimagenscreenshot: newValues.newCodImagenScreenshot,
            codimagendialogo: newValues.newCodImagenDialogo,
            codvideo: newValues.newCodVideo,
          };

          requiredImageVideoFieldsForEdit.forEach((field) => {
            const newValue = newImageValuesByFieldKey[field.key];

            if (!hasValue(newValue)) {
              faltantesEditCascade.push(field.label);
              return;
            }

            if (!isValidHttpUrl(newValue)) {
              faltantesEditCascade.push(`${field.label} must be a valid URL`);
            }
          });

          if (faltantesEditCascade.length > 0) {
            notify(
              "Required fields missing",
              `You started changing the cascade filters. Please complete: ${faltantesEditCascade.join(", ")}`,
              "warning",
            );
            return;
          }
        }

        const updatedOrder = withAutoPalote({
          ...draftOrder,

          ...(hasValue(newValues.newCodCuentaTiktok)
            ? { codcuentatiktok: cleanValue(newValues.newCodCuentaTiktok) }
            : {}),

          ...(hasValue(newValues.newCodSonido)
            ? { codsonido: cleanValue(newValues.newCodSonido) }
            : {}),

          ...(hasValue(newValues.newDesScenaHook)
            ? { desscenahook: cleanValue(newValues.newDesScenaHook) }
            : {}),

          ...(hasValue(newValues.newDesCaption)
            ? { descaption: cleanValue(newValues.newDesCaption) }
            : {}),

          ...(hasValue(newValues.newDesTropo)
            ? { destropo: cleanValue(newValues.newDesTropo) }
            : {}),

          ...(hasValue(newValues.newDesSlide1KeywordsHide)
            ? {
                desslide1keywordshide: cleanValue(
                  newValues.newDesSlide1KeywordsHide,
                ),
              }
            : {}),

          ...(hasValue(newValues.newDesSlide2KeywordsHide)
            ? {
                desslide2keywordshide: cleanValue(
                  newValues.newDesSlide2KeywordsHide,
                ),
              }
            : {}),

          ...(hasValue(newValues.newDesHashtag)
            ? { deshashtag: cleanValue(newValues.newDesHashtag) }
            : {}),

          ...(hasValue(newValues.newCodImagenPrincipal)
            ? {
                codimagenprincipal: cleanValue(newValues.newCodImagenPrincipal),
                nCodimagenprincipal: cleanValue(
                  newValues.newCodImagenPrincipal,
                ),
              }
            : {}),

          ...(hasValue(newValues.newCodImagenScreenshot)
            ? {
                codimagenscreenshot: cleanValue(
                  newValues.newCodImagenScreenshot,
                ),
                nCodimagenscreenshot: cleanValue(
                  newValues.newCodImagenScreenshot,
                ),
              }
            : {}),

          ...(hasValue(newValues.newCodImagenDialogo)
            ? {
                codimagendialogo: cleanValue(newValues.newCodImagenDialogo),
                nCodimagendialogo: cleanValue(newValues.newCodImagenDialogo),
              }
            : {}),

          ...(hasValue(newValues.newCodVideo)
            ? {
                codvideo: cleanValue(newValues.newCodVideo),
                nCodvideo: cleanValue(newValues.newCodVideo),
              }
            : {}),

          ...(hasValue(newValues.newDesInstrucciones)
            ? { desinstrucciones: cleanValue(newValues.newDesInstrucciones) }
            : {}),

          ...(hasValue(newValues.newFecPlanPosteo)
            ? { fecplanposteo: newValues.newFecPlanPosteo }
            : {}),

          ...(newValues.newCodEstadoOrden != null &&
          newValues.newCodEstadoOrden !== ""
            ? { codestadoorden: Number(newValues.newCodEstadoOrden) }
            : {}),

          ...(editCascadeStarted
            ? {
                codposteador: editFilters.codposteador,
                codtelefono: editFilters.codtelefono || null,
                codautora: editFilters.codautora,
                codlibro: editFilters.codlibro,
                tippublicacion: editFilters.tippublicacion,
                codescena: editFilters.codescena,
              }
            : {}),
        });

        const codordentrabajo =
          draftOrder?.codordentrabajo ??
          selectedOrder?.codordentrabajo ??
          updatedOrder?.codordentrabajo;

        if (!codordentrabajo) {
          notify(
            "Error",
            "codordentrabajo was not found for this order.",
            "error",
          );
          return;
        }

        try {
          const body = buildManualOrderRequestBody({
            newValues,
            editCascadeStarted,
          });

          const hasAnyChange = Object.entries(body).some(([key, value]) => {
            if (key === "correo") return false;
            return value !== null && value !== undefined && value !== "";
          });

          if (!hasAnyChange) {
            notify("No changes", "There are no changes to save.", "warning");
            return;
          }

          console.log("UPDATED ORDER:", updatedOrder);
          console.log("BODY SENT TO BACKEND:", body);
          const updatedOrderFromBack = await updateManualOrderService({
            token,
            codordentrabajo,
            body,
          });

          console.log(updatedOrderFromBack);

          const getOptionLabel = (options, value) => {
            const cleanValue = String(value ?? "").trim();

            if (!cleanValue) return null;

            const selected = (options || []).find((item) => {
              const optionValue =
                item?.value ??
                item?.codigo ??
                item?.code ??
                item?.id ??
                item?.codposteador ??
                item?.codtelefono ??
                item?.codautora ??
                item?.codlibro ??
                item?.tippublicacion ??
                item?.codescena ??
                "";

              return String(optionValue).trim() === cleanValue;
            });

            return (
              selected?.label ??
              selected?.nombre ??
              selected?.descripcion ??
              selected?.nbposteador ??
              selected?.nbautora ??
              selected?.nblibro ??
              selected?.deslibro ??
              selected?.despost ??
              selected?.desescena ??
              null
            );
          };

          const updatedRowForTable = normalizeOrderQueryRow({
            ...draftOrder,
            ...updatedOrderFromBack,

            codposteador:
              updatedOrderFromBack?.codposteador ??
              updatedOrder?.codposteador ??
              draftOrder?.codposteador,

            nCodposteador:
              updatedOrderFromBack?.nCodposteador ??
              getOptionLabel(
                [
                  ...(editCatalog?.posteadores || []),
                  ...(catalog?.posteadores || []),
                ],
                updatedOrder?.codposteador,
              ) ??
              draftOrder?.nCodposteador,

            codtelefono:
              updatedOrderFromBack?.codtelefono ??
              updatedOrder?.codtelefono ??
              draftOrder?.codtelefono,

            codautora:
              updatedOrderFromBack?.codautora ??
              updatedOrder?.codautora ??
              draftOrder?.codautora,

            nCodautora:
              updatedOrderFromBack?.nCodautora ??
              getOptionLabel(
                [...(editCatalog?.autoras || []), ...(catalog?.autoras || [])],
                updatedOrder?.codautora,
              ) ??
              draftOrder?.nCodautora,

            codlibro:
              updatedOrderFromBack?.codlibro ??
              updatedOrder?.codlibro ??
              draftOrder?.codlibro,

            nCodlibro:
              updatedOrderFromBack?.nCodlibro ??
              getOptionLabel(
                [...(editCatalog?.libros || []), ...(catalog?.libros || [])],
                updatedOrder?.codlibro,
              ) ??
              draftOrder?.nCodlibro,

            tippublicacion:
              updatedOrderFromBack?.tippublicacion ??
              updatedOrder?.tippublicacion ??
              draftOrder?.tippublicacion,

            nTippublicacion: (() => {
              const finalTipPublicacion =
                updatedOrderFromBack?.tippublicacion ??
                updatedOrder?.tippublicacion ??
                draftOrder?.tippublicacion;

              const labelFromCatalog = getOptionLabel(
                [
                  ...(editCatalog?.tiposPosteo || []),
                  ...(catalog?.tiposPosteo || []),
                ],
                finalTipPublicacion,
              );

              const labelFromDraft =
                draftOrder?.nTippublicacion ??
                draftOrder?.nCodtippublicacion ??
                draftOrder?.nCodTippublicacion ??
                draftOrder?.nCodTipoPosteo ??
                draftOrder?.destipoposteo ??
                draftOrder?.despost ??
                null;

              const labelFromBack =
                updatedOrderFromBack?.nTippublicacion ??
                updatedOrderFromBack?.nCodtippublicacion ??
                updatedOrderFromBack?.nCodTippublicacion ??
                updatedOrderFromBack?.nCodTipoPosteo ??
                updatedOrderFromBack?.destipoposteo ??
                updatedOrderFromBack?.despost ??
                null;

              const isRealLabel = (value) => {
                const text = String(value ?? "").trim();
                const code = String(finalTipPublicacion ?? "").trim();

                return text !== "" && text !== code;
              };

              if (isRealLabel(labelFromCatalog)) return labelFromCatalog;
              if (isRealLabel(labelFromDraft)) return labelFromDraft;
              if (isRealLabel(labelFromBack)) return labelFromBack;

              return (
                labelFromCatalog ??
                labelFromDraft ??
                labelFromBack ??
                finalTipPublicacion
              );
            })(),

            codescena:
              updatedOrderFromBack?.codescena ??
              updatedOrder?.codescena ??
              draftOrder?.codescena,

            nCodescena:
              updatedOrderFromBack?.nCodescena ??
              getOptionLabel(
                [...(editCatalog?.escenas || []), ...(catalog?.escenas || [])],
                updatedOrder?.codescena,
              ) ??
              draftOrder?.nCodescena,

            codsonido:
              updatedOrderFromBack?.codsonido ??
              updatedOrder?.codsonido ??
              draftOrder?.codsonido,

            nCodsonido:
              updatedOrderFromBack?.nCodsonido ??
              updatedOrderFromBack?.urlsonido ??
              updatedOrder?.nCodsonido ??
              draftOrder?.nCodsonido,

            codimagenprincipal:
              updatedOrderFromBack?.codimagenprincipal ??
              updatedOrder?.codimagenprincipal ??
              draftOrder?.codimagenprincipal,

            nCodimagenprincipal:
              updatedOrderFromBack?.nCodimagenprincipal ??
              updatedOrderFromBack?.urlimagenprincipal ??
              updatedOrder?.nCodimagenprincipal ??
              updatedOrder?.codimagenprincipal ??
              draftOrder?.nCodimagenprincipal,

            codimagenscreenshot:
              updatedOrderFromBack?.codimagenscreenshot ??
              updatedOrder?.codimagenscreenshot ??
              draftOrder?.codimagenscreenshot,

            nCodimagenscreenshot:
              updatedOrderFromBack?.nCodimagenscreenshot ??
              updatedOrderFromBack?.urlimagenscreenshot ??
              updatedOrder?.nCodimagenscreenshot ??
              updatedOrder?.codimagenscreenshot ??
              draftOrder?.nCodimagenscreenshot,

            codimagendialogo:
              updatedOrderFromBack?.codimagendialogo ??
              updatedOrder?.codimagendialogo ??
              draftOrder?.codimagendialogo,

            nCodimagendialogo:
              updatedOrderFromBack?.nCodimagendialogo ??
              updatedOrderFromBack?.urlimagendialogo ??
              updatedOrder?.nCodimagendialogo ??
              updatedOrder?.codimagendialogo ??
              draftOrder?.nCodimagendialogo,

            codvideo:
              updatedOrderFromBack?.codvideo ??
              updatedOrder?.codvideo ??
              draftOrder?.codvideo,

            nCodvideo:
              updatedOrderFromBack?.nCodvideo ??
              updatedOrderFromBack?.urlvideo ??
              updatedOrder?.nCodvideo ??
              updatedOrder?.codvideo ??
              draftOrder?.nCodvideo,
          });

          setOrdersRows((prev) =>
            (prev || []).map((row) =>
              String(row?.codordentrabajo) === String(codordentrabajo)
                ? updatedRowForTable
                : row,
            ),
          );

          setSelectedOrder(updatedRowForTable);
          setDraftOrder(updatedRowForTable);
          setIsEditing(false);

          notify("Success", "Order updated successfully.", "success");
        } catch (error) {
          notify("Error", error?.message || "Error updating order.", "error");
        }
      },

      setCodPosteador: (v) =>
        setFilters((prev) => ({
          ...prev,
          codPosteador: v,
          codTelefono: null,
          codAutora: null,
          codLibros: [],
          codTipoPosteo: null,
          codEscena: null,
        })),

      setCodTelefono: (v) =>
        setFilters((prev) => ({
          ...prev,
          codTelefono: v,
          codAutora: null,
          codLibros: [],
          codTipoPosteo: null,
          codEscena: null,
        })),

      setCodAutora: (v) =>
        setFilters((prev) => ({
          ...prev,
          codAutora: v,
          codLibros: [],
          codTipoPosteo: null,
          codEscena: null,
        })),

      setCodLibros: (v) =>
        setFilters((prev) => ({
          ...prev,
          codLibros: v,
          codTipoPosteo: null,
          codEscena: null,
        })),

      setCodTipoPosteo: (v) =>
        setFilters((prev) => ({
          ...prev,
          codTipoPosteo: v,
          codEscena: null,
        })),

      setCodEscena: (v) =>
        setFilters((prev) => ({
          ...prev,
          codEscena: v,
        })),

      setCodSonido: (v) =>
        setFilters((prev) => ({
          ...prev,
          codSonido: v,
        })),

      setCodCuentaTiktok: (v) =>
        setFilters((prev) => ({
          ...prev,
          codCuentaTiktok: v,
        })),

      setCodUsuarioAuditoriaCreaReg: (v) =>
        setFilters((prev) => ({
          ...prev,
          codusuarioauditoriacreareg: v,
        })),

      setCodEstadoOrden: (v) =>
        setFilters((prev) => ({
          ...prev,
          codEstadoOrden: v,
        })),

      setFlgOrdenCompleta: (v) =>
        setFilters((prev) => ({
          ...prev,
          flgOrdenCompleta: v,
        })),

      setTipRegistroOrden: (v) =>
        setFilters((prev) => ({
          ...prev,
          tipRegistroOrden: v,
        })),

      setFecPlanPosteoFrom: (v) =>
        setFilters((prev) => ({
          ...prev,
          fecPlanPosteoFrom: v,
        })),

      setFecPlanPosteoTo: (v) =>
        setFilters((prev) => ({
          ...prev,
          fecPlanPosteoTo: v,
        })),

      setFecCreacionRegistroFrom: (v) =>
        setFilters((prev) => ({
          ...prev,
          fecCreacionRegistroFrom: v,
        })),

      setFecCreacionRegistroTo: (v) =>
        setFilters((prev) => ({
          ...prev,
          fecCreacionRegistroTo: v,
        })),

      validateAndSearch: async () => {
        const hasPlanFrom = Boolean(filters.fecPlanPosteoFrom);
        const hasPlanTo = Boolean(filters.fecPlanPosteoTo);
        const hasCreationFrom = Boolean(filters.fecCreacionRegistroFrom);
        const hasCreationTo = Boolean(filters.fecCreacionRegistroTo);

        if (!hasPlanFrom && hasPlanTo) {
          notify(
            "Invalid date range",
            "You must select Planned Posting (From) when Planned Posting (To) is filled.",
            "error",
          );
          return { ok: false, reason: "validation" };
        }

        if (hasPlanFrom && !hasPlanTo) {
          notify(
            "Invalid date range",
            "You must select Planned Posting (To) when Planned Posting (From) is filled.",
            "error",
          );
          return { ok: false, reason: "validation" };
        }

        if (!hasCreationFrom && hasCreationTo) {
          notify(
            "Invalid date range",
            "You must select Record Creation (From) when Record Creation (To) is filled.",
            "error",
          );
          return { ok: false, reason: "validation" };
        }

        if (hasCreationFrom && !hasCreationTo) {
          notify(
            "Invalid date range",
            "You must select Record Creation (To) when Record Creation (From) is filled.",
            "error",
          );
          return { ok: false, reason: "validation" };
        }

        if (
          hasPlanFrom &&
          hasPlanTo &&
          filters.fecPlanPosteoTo < filters.fecPlanPosteoFrom
        ) {
          notify(
            "Invalid date range",
            "Planned Posting (To) cannot be earlier than Planned Posting (From).",
            "error",
          );
          return { ok: false, reason: "validation" };
        }

        if (
          hasCreationFrom &&
          hasCreationTo &&
          filters.fecCreacionRegistroTo < filters.fecCreacionRegistroFrom
        ) {
          notify(
            "Invalid date range",
            "Record Creation (To) cannot be earlier than Record Creation (From).",
            "error",
          );
          return { ok: false, reason: "validation" };
        }

        if (!filters.fecPlanPosteoFrom) {
          notify(
            "Missing required filters",
            "You must select Planned Posting (From) before running Order Queries.",
            "error",
          );
          return { ok: false, reason: "validation" };
        }

        if (!filters.codusuarioauditoriacreareg && !filters.codPosteador) {
          notify(
            "Missing required filters",
            "You must select at least a PA when Created By User is not selected.",
            "error",
          );
          return { ok: false, reason: "validation" };
        }

        return await runSearch();
      },

      search: async () => {
        return await runSearch();
      },

      reset: () => {
        const baseState = getInitialState();

        setFilters({
          ...baseState,
          codPosteador:
            isPaUser && catalog.posteadores?.length === 1
              ? catalog.posteadores[0].value
              : null,
        });
        setOrdersRows([]);
        setOrdersColumns([]);
        setAuthorBookRows([]);
        setCatalog((prev) => ({
          ...prev,
          telefonos: [],
          autoras: [],
          libros: [],
          tiposPosteo: [],
          escenas: [],
          formatosEscenas: [],
        }));
        setDataLoaded(true);

        setNotifOpen(false);
        setGenerationAlerts([]);

        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(AUTHOR_BOOK_ROWS_STORAGE_KEY);
          localStorage.removeItem(ORDERS_ROWS_STORAGE_KEY);
          localStorage.removeItem(ORDERS_COLUMNS_STORAGE_KEY);
          localStorage.removeItem(DATA_LOADED_STORAGE_KEY);

          // importante: no borrar el catálogo completo para conservar posteadores
          localStorage.setItem(
            CATALOG_STORAGE_KEY,
            JSON.stringify(
              (() => {
                try {
                  const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
                  const parsed = raw ? JSON.parse(raw) : {};
                  return {
                    ...parsed,
                    telefonos: [],
                    autoras: [],
                    libros: [],
                    tiposPosteo: [],
                    escenas: [],
                    formatosEscenas: [],
                  };
                } catch {
                  return {
                    posteadores: [],
                    telefonos: [],
                    autoras: [],
                    libros: [],
                    tiposPosteo: [],
                    escenas: [],
                    formatosEscenas: [],
                    usuariosCreacion: [],
                  };
                }
              })(),
            ),
          );
        } catch {}
      },
    };
  }, [
    token,
    requestPayload,
    isPaUser,
    catalog,
    editCatalog,
    draftOrder,
    selectedOrder,
    editFilters,
    requiredImagesPerTipPublicacion,
    userEmail,
  ]);

  return {
    filters,
    catalog,
    editCatalog,
    editFilters,
    loadingCatalog,
    loadingSearch,
    ordersRows,
    ordersColumns,
    dataLoaded,
    actions,
    filterStep,
    setFilterStep,
    selectedOrder,
    detailsOpen,
    isEditing,
    draftOrder,
    requiredImageVideoFields,
    notifOpen,
    generationAlerts,
  };
}
