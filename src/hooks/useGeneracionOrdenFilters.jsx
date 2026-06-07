import {
  useEffect,
  useMemo,
  useState,
  useContext,
  useCallback,
  useRef,
} from "react";
import { getRequiredImagesPerTipPublicacionService } from "../services/orden-generation/RequiredImagesService";
import { GenerateOrdenService } from "../services/orden-generation/GenerateOrdenService.jsx";
import GeneracionOrdenFiltersResponse from "../interfaces/orden-generation/GeneracionOrdenFiltersResponse.jsx";
import { getPaFiltersService } from "../services/orden-generation/PaService";
import { getTelephoneFiltersService } from "../services/orden-generation/TelephoneService";
import { getAuthorFiltersService } from "../services/orden-generation/AuthorService";
import AuthorResponse from "../interfaces/orden-generation/AuthorResponse";
import { getPostTypeFiltersService } from "../services/orden-generation/PostTypeService";
import { getSceneFiltersService } from "../services/orden-generation/SceneService";
import NewManualOrderRequestDTO from "../interfaces/orden-generation/NewManualOrderRequestDTO";
import { AuthUserContext } from "../context/AuthUserContext";
import {
  createManualOrderService,
  updateManualOrderService,
} from "../services/orden-generation/ManualOrderService";

const getTodayLocalISO = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const buildDefaultFilters = (values = {}) => {
  const todayISO = getTodayLocalISO();

  return {
    ...initialState,
    ...values,
    flgprioridadescena: values?.flgprioridadescena ?? "N",
    flgprioridasonido: values?.flgprioridasonido ?? "N",
    flgprioridadimagenvideo: values?.flgprioridadimagenvideo ?? "N",
    fecinicioplanposteo: values?.fecinicioplanposteo ?? todayISO,
    fecfinplanposteo:
      values?.fecfinplanposteo ?? values?.fecinicioplanposteo ?? todayISO,
  };
};

const initialState = {
  correo: null,
  codposteador: null,
  tiptelefono: null,
  codtelefono: null,
  codautora: null,
  codlibro: null,
  tippublicacion: null,
  codescena: null,
  flgprioridadescena: "N",
  flgprioridasonido: "N",
  flgprioridadimagenvideo: "N",
  fecinicioplanposteo: getTodayLocalISO(),
  fecfinplanposteo: getTodayLocalISO(),
  ctdordenesmetamanual: null,
};

const emptyCatalog = {
  posteadores: [],
  telefonos: [],
  autoras: [],
  libros: [],
  tiposPosteo: [],
  escenas: [],
  formatosEscenas: [],
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

export function useGeneracionOrdenFilters({
  token,
  notifyManualValidation,
} = {}) {
  const { userEmail } = useContext(AuthUserContext);

  const GENERACION_ORDEN_CACHE_PREFIX = "generacionOrden.v1";

  const normalizedUserKey = String(userEmail || "anonymous")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_");

  const generacionOrdenCacheKey = `${GENERACION_ORDEN_CACHE_PREFIX}_${normalizedUserKey}`;

  const STORAGE_KEY = `${generacionOrdenCacheKey}.filters`;
  const CATALOG_STORAGE_KEY = `${generacionOrdenCacheKey}.catalog`;
  const AUTHOR_BOOK_ROWS_STORAGE_KEY = `${generacionOrdenCacheKey}.authorBookRows`;
  const ORDERS_ROWS_STORAGE_KEY = `${generacionOrdenCacheKey}.rows`;
  const ORDERS_COLUMNS_STORAGE_KEY = `${generacionOrdenCacheKey}.columns`;
  const DATA_LOADED_STORAGE_KEY = `${generacionOrdenCacheKey}.dataLoaded`;
  const GENERATION_ALERTS_STORAGE_KEY = `${generacionOrdenCacheKey}.generationAlerts`;

  const [filters, setFilters] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return buildDefaultFilters();
      const parsed = JSON.parse(raw);
      return buildDefaultFilters(parsed);
    } catch {
      return buildDefaultFilters();
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

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftOrder, setDraftOrder] = useState(null);
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

  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [editCatalogReloadKey, setEditCatalogReloadKey] = useState(0);

  const [isGeneratingOrders, setIsGeneratingOrders] = useState(false);

  const [requiredImagesPerTipPublicacion, setRequiredImagesPerTipPublicacion] =
    useState([]);

  const requiredImagesLoadedRef = useRef(false);

  const [notifOpen, setNotifOpen] = useState(false);

  const [generationAlerts, setGenerationAlerts] = useState(() => {
    try {
      const raw = localStorage.getItem(GENERATION_ALERTS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const mockColumns = [
    { key: "codordentrabajo", header: "Work Order Id" },
    { key: "nCodposteador", header: "Publisher (PA)" },
    { key: "codtelefono", header: "Telephone Code" },
    { key: "nCodautora", header: "Author Name" },

    { key: "nCodlibro", header: "Book Name" },
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
    { key: "codestadoorden", header: "Order Status Code" },
    { key: "tipregistroorden", header: "Record Type" },
    { key: "flgordencompleta", header: "Complete Order (Y/N)" },
    { key: "ctddatoobligincompleto", header: "Missing Required Data Count" },
    { key: "desdatoobligincompleto", header: "Missing Data Details" },
    { key: "deslogerrororden", header: "Order Error Log" },
    { key: "codusuarioauditoriacreareg", header: "Created By" },
    {
      key: "codusuarioauditoriaactualizareg",
      header: "Updated By",
    },
    { key: "fecreacionregistro", header: "Creation Date" },
    { key: "horacreacionregistro", header: "Creation Time" },
    { key: "fecactualizacionregistro", header: "Update Date" },
    { key: "horaactualizacionregistro", header: "Update Time" },
  ];

  const mockRows = [
    {
      codordentrabajo: 1001,
      codautora: "Luna Mason",
      codlibro: "Distance",
      codescena: "Hook 2 – Pregnant scene 😢",

      codposteador: "Alondra Lerggios",
      codtelefono: "JH01",
      codcuentatiktok: "ruth_bestbooks",
      codsonido:
        "https://www.tiktok.com/music/original-sound-zizoo-7557152124510669569",
      desscenahook: "Romantic opening hook",
      descaption: "A heartwarming caption for the first post.",
      destropo: "Friends To Lovers",
      desslide1keywordshide: "romance, booktok, author ",
      desslide2keywordshide: "novel, love, trending",
      deshashtag: "#romance #booktok #love",
      despalote: "Main promotional stick text",
      codimagenprincipal:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codimagenscreenshot:
        "https://www.canva.com/design/DAGtz7V-OoY/Zz8rTr57hXn6BcKl_MKdwg/edit?utm_content=DAGtz7V-OoY&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      codimagendialogo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codvideo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      desinstrucciones: "Post during evening peak hours.",
      fecplanposteo: "2026-03-12",
      codestadoorden: "Posted",
      tipregistroorden: "AUTO",
      flgordenincompleta: "N",
      desdatosfaltantesorden: "no observations",
      codusuarioauditoriacreareg: "gerard.iruri@utec.edu.pe",
      codusuarioauditoriaactualizareg: "gerard.iruri@utec.edu.pe",
      fecreacionregistro: "2026-03-12",
      horacreacionregistro: "09:00:00",
      fecactualizacionregistro: "2026-03-12",
      horaactualizacionregistro: "09:05:00",
    },
    {
      codordentrabajo: 1002,
      codautora: "Luna Mason",
      codlibro: "Distance",
      codescena: "Hook 11 – Jealous 🌶",
      codposteador: "Alondra Lerggios",
      codtelefono: "JH01",
      codcuentatiktok: "ruth_bestbooks",
      codsonido:
        "https://www.tiktok.com/music/original-sound-zizoo-7557152124510669569",
      desscenahook: "Romantic opening hook",
      descaption: "A heartwarming caption for the first post.",
      destropo:
        "- Enemies to lovers - Marriage of convenience (for marketing I sometimes call it an arranged marriage) - Age Gap - Best friend's father - Russian mafia romance - Dark romance - Billionaire - Forced proximity - Angsty Romance - Obsessed Hero ",
      desslide1keywordshide: "romance, booktok, author ",
      desslide2keywordshide: "novel, love, trending",
      deshashtag: "#romance #booktok #love",
      despalote: "Main promotional stick text",
      codimagenprincipal:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codimagenscreenshot:
        "https://www.canva.com/design/DAGtz7V-OoY/Zz8rTr57hXn6BcKl_MKdwg/edit?utm_content=DAGtz7V-OoY&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      codimagendialogo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codvideo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      desinstrucciones: "Post during evening peak hours.",
      fecplanposteo: "2026-03-12",
      codestadoorden: "Posted",
      tipregistroorden: "AUTO",
      flgordenincompleta: "N",
      desdatosfaltantesorden: "no observations",
      codusuarioauditoriacreareg: "gerard.iruri@utec.edu.pe",
      codusuarioauditoriaactualizareg: "gerard.iruri@utec.edu.pe",
      fecreacionregistro: "2026-03-12",
      horacreacionregistro: "09:00:00",
      fecactualizacionregistro: "2026-03-12",
      horaactualizacionregistro: "09:05:00",
    },
    {
      codordentrabajo: 1002,
      codautora: "Luna Mason",
      codlibro: "Distance",
      codescena: "Hook 11 – Jealous 🌶",
      codposteador: "Alondra Lerggios",
      codtelefono: "JH01",
      codcuentatiktok: "ruth_bestbooks",
      codsonido:
        "https://www.tiktok.com/music/original-sound-zizoo-7557152124510669569",
      desscenahook: "Romantic opening hook",
      descaption: "A heartwarming caption for the first post.",
      destropo:
        "- Enemies to lovers - Marriage of convenience (for marketing I sometimes call it an arranged marriage) - Age Gap - Best friend's father - Russian mafia romance - Dark romance - Billionaire - Forced proximity - Angsty Romance - Obsessed Hero",
      desslide1keywordshide: "romance, booktok, author ",
      desslide2keywordshide: "novel, love, trending",
      deshashtag: "#romance #booktok #love",
      despalote: "Main promotional stick text",
      codimagenprincipal:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codimagenscreenshot:
        "https://www.canva.com/design/DAGtz7V-OoY/Zz8rTr57hXn6BcKl_MKdwg/edit?utm_content=DAGtz7V-OoY&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      codimagendialogo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codvideo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      desinstrucciones: "Post during evening peak hours.",
      fecplanposteo: "2026-03-12",
      codestadoorden: "Posted",
      tipregistroorden: "AUTO",
      flgordenincompleta: "N",
      desdatosfaltantesorden: "no observations",
      codusuarioauditoriacreareg: "gerard.iruri@utec.edu.pe",
      codusuarioauditoriaactualizareg: "gerard.iruri@utec.edu.pe",
      fecreacionregistro: "2026-03-12",
      horacreacionregistro: "09:00:00",
      fecactualizacionregistro: "2026-03-12",
      horaactualizacionregistro: "09:05:00",
    },
    {
      codordentrabajo: 1002,
      codautora: "Luna Mason",
      codlibro: "Distance",
      codescena: "Hook 11 – Jealous 🌶",
      codposteador: "Alondra Lerggios",
      codtelefono: "JH01",
      codcuentatiktok: "ruth_bestbooks",
      codsonido:
        "https://www.tiktok.com/music/original-sound-zizoo-7557152124510669569",
      desscenahook: "Romantic opening hook",
      descaption: "A heartwarming caption for the first post.",
      destropo:
        "- Enemies to lovers - Marriage of convenience (for marketing I sometimes call it an arranged marriage) - Age Gap - Best friend's father - Russian mafia romance - Dark romance - Billionaire - Forced proximity - Angsty Romance - Obsessed Hero",
      desslide1keywordshide: "romance, booktok, author ",
      desslide2keywordshide: "novel, love, trending",
      deshashtag: "#romance #booktok #love",
      despalote: "Main promotional stick text",
      codimagenprincipal:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codimagenscreenshot:
        "https://www.canva.com/design/DAGtz7V-OoY/Zz8rTr57hXn6BcKl_MKdwg/edit?utm_content=DAGtz7V-OoY&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      codimagendialogo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codvideo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      desinstrucciones: "Post during evening peak hours.",
      fecplanposteo: "2026-03-12",
      codestadoorden: "Posted",
      tipregistroorden: "AUTO",
      flgordenincompleta: "N",
      desdatosfaltantesorden: "no observations",
      codusuarioauditoriacreareg: "gerard.iruri@utec.edu.pe",
      codusuarioauditoriaactualizareg: "gerard.iruri@utec.edu.pe",
      fecreacionregistro: "2026-03-12",
      horacreacionregistro: "09:00:00",
      fecactualizacionregistro: "2026-03-12",
      horaactualizacionregistro: "09:05:00",
    },
    {
      codordentrabajo: 1002,
      codautora: "Luna Mason",
      codlibro: "Distance",
      codescena: "Hook 11 – Jealous 🌶",
      codposteador: "Alondra Lerggios",
      codtelefono: "JH01",
      codcuentatiktok: "ruth_bestbooks",
      codsonido:
        "https://www.tiktok.com/music/original-sound-zizoo-7557152124510669569",
      desscenahook: "Romantic opening hook",
      descaption: "A heartwarming caption for the first post.",
      destropo:
        "- Enemies to lovers - Marriage of convenience (for marketing I sometimes call it an arranged marriage) - Age Gap - Best friend's father - Russian mafia romance - Dark romance - Billionaire - Forced proximity - Angsty Romance - Obsessed Hero",
      desslide1keywordshide: "romance, booktok, author ",
      desslide2keywordshide: "novel, love, trending",
      deshashtag: "#romance #booktok #love",
      despalote: "Main promotional stick text",
      codimagenprincipal:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codimagenscreenshot:
        "https://www.canva.com/design/DAGtz7V-OoY/Zz8rTr57hXn6BcKl_MKdwg/edit?utm_content=DAGtz7V-OoY&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      codimagendialogo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codvideo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      desinstrucciones: "Post during evening peak hours.",
      fecplanposteo: "2026-03-12",
      codestadoorden: "Posted",
      tipregistroorden: "AUTO",
      flgordenincompleta: "N",
      desdatosfaltantesorden: "no observations",
      codusuarioauditoriacreareg: "gerard.iruri@utec.edu.pe",
      codusuarioauditoriaactualizareg: "gerard.iruri@utec.edu.pe",
      fecreacionregistro: "2026-03-12",
      horacreacionregistro: "09:00:00",
      fecactualizacionregistro: "2026-03-12",
      horaactualizacionregistro: "09:05:00",
    },
    {
      codordentrabajo: 1002,
      codautora: "Luna Mason",
      codlibro: "Distance",
      codescena: "Hook 11 – Jealous 🌶",
      codposteador: "Alondra Lerggios",
      codtelefono: "JH01",
      codcuentatiktok: "ruth_bestbooks",
      codsonido:
        "https://www.tiktok.com/music/original-sound-zizoo-7557152124510669569",
      desscenahook: "Romantic opening hook",
      descaption: "A heartwarming caption for the first post.",
      destropo:
        "- Enemies to lovers - Marriage of convenience (for marketing I sometimes call it an arranged marriage) - Age Gap - Best friend's father - Russian mafia romance - Dark romance - Billionaire - Forced proximity - Angsty Romance - Obsessed Hero",
      desslide1keywordshide: "romance, booktok, author ",
      desslide2keywordshide: "novel, love, trending",
      deshashtag: "#romance #booktok #love",
      despalote: "Main promotional stick text",
      codimagenprincipal:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codimagenscreenshot:
        "https://www.canva.com/design/DAGtz7V-OoY/Zz8rTr57hXn6BcKl_MKdwg/edit?utm_content=DAGtz7V-OoY&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      codimagendialogo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codvideo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      desinstrucciones: "Post during evening peak hours.",
      fecplanposteo: "2026-03-12",
      codestadoorden: "Posted",
      tipregistroorden: "AUTO",
      flgordenincompleta: "N",
      desdatosfaltantesorden: "no observations",
      codusuarioauditoriacreareg: "gerard.iruri@utec.edu.pe",
      codusuarioauditoriaactualizareg: "gerard.iruri@utec.edu.pe",
      fecreacionregistro: "2026-03-12",
      horacreacionregistro: "09:00:00",
      fecactualizacionregistro: "2026-03-12",
      horaactualizacionregistro: "09:05:00",
    },
    {
      codordentrabajo: 1002,
      codautora: "Luna Mason",
      codlibro: "Distance",
      codescena: "Hook 11 – Jealous 🌶",
      codposteador: "Alondra Lerggios",
      codtelefono: "JH01",
      codcuentatiktok: "ruth_bestbooks",
      codsonido:
        "https://www.tiktok.com/music/original-sound-zizoo-7557152124510669569",
      desscenahook: "Romantic opening hook",
      descaption: "A heartwarming caption for the first post.",
      destropo:
        "- Enemies to lovers - Marriage of convenience (for marketing I sometimes call it an arranged marriage) - Age Gap - Best friend's father - Russian mafia romance - Dark romance - Billionaire - Forced proximity - Angsty Romance - Obsessed Hero",
      desslide1keywordshide: "romance, booktok, author ",
      desslide2keywordshide: "novel, love, trending",
      deshashtag: "#romance #booktok #love",
      despalote: "Main promotional stick text",
      codimagenprincipal:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codimagenscreenshot:
        "https://www.canva.com/design/DAGtz7V-OoY/Zz8rTr57hXn6BcKl_MKdwg/edit?utm_content=DAGtz7V-OoY&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      codimagendialogo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codvideo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      desinstrucciones: "Post during evening peak hours.",
      fecplanposteo: "2026-03-12",
      codestadoorden: "Posted",
      tipregistroorden: "AUTO",
      flgordenincompleta: "N",
      desdatosfaltantesorden: "no observations",
      codusuarioauditoriacreareg: "gerard.iruri@utec.edu.pe",
      codusuarioauditoriaactualizareg: "gerard.iruri@utec.edu.pe",
      fecreacionregistro: "2026-03-12",
      horacreacionregistro: "09:00:00",
      fecactualizacionregistro: "2026-03-12",
      horaactualizacionregistro: "09:05:00",
    },
    {
      codordentrabajo: 1002,
      codautora: "Luna Mason",
      codlibro: "Distance",
      codescena: "Hook 11 – Jealous 🌶",
      codposteador: "Alondra Lerggios",
      codtelefono: "JH01",
      codcuentatiktok: "ruth_bestbooks",
      codsonido:
        "https://www.tiktok.com/music/original-sound-zizoo-7557152124510669569",
      desscenahook: "Romantic opening hook",
      descaption: "A heartwarming caption for the first post.",
      destropo:
        "- Enemies to lovers - Marriage of convenience (for marketing I sometimes call it an arranged marriage) - Age Gap - Best friend's father - Russian mafia romance - Dark romance - Billionaire - Forced proximity - Angsty Romance - Obsessed Hero",
      desslide1keywordshide: "romance, booktok, author ",
      desslide2keywordshide: "novel, love, trending",
      deshashtag: "#romance #booktok #love",
      despalote: "Main promotional stick text",
      codimagenprincipal:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codimagenscreenshot:
        "https://www.canva.com/design/DAGtz7V-OoY/Zz8rTr57hXn6BcKl_MKdwg/edit?utm_content=DAGtz7V-OoY&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      codimagendialogo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codvideo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      desinstrucciones: "Post during evening peak hours.",
      fecplanposteo: "2026-03-12",
      codestadoorden: "Posted",
      tipregistroorden: "AUTO",
      flgordenincompleta: "N",
      desdatosfaltantesorden: "no observations",
      codusuarioauditoriacreareg: "gerard.iruri@utec.edu.pe",
      codusuarioauditoriaactualizareg: "gerard.iruri@utec.edu.pe",
      fecreacionregistro: "2026-03-12",
      horacreacionregistro: "09:00:00",
      fecactualizacionregistro: "2026-03-12",
      horaactualizacionregistro: "09:05:00",
    },
    {
      codordentrabajo: 1002,
      codautora: "Luna Mason",
      codlibro: "Distance",
      codescena: "Hook 11 – Jealous 🌶",
      codposteador: "Alondra Lerggios",
      codtelefono: "JH01",
      codcuentatiktok: "ruth_bestbooks",
      codsonido:
        "https://www.tiktok.com/music/original-sound-zizoo-7557152124510669569",
      desscenahook: "Romantic opening hook",
      descaption: "A heartwarming caption for the first post.",
      destropo:
        "- Enemies to lovers - Marriage of convenience (for marketing I sometimes call it an arranged marriage) - Age Gap - Best friend's father - Russian mafia romance - Dark romance - Billionaire - Forced proximity - Angsty Romance - Obsessed Hero",
      desslide1keywordshide: "romance, booktok, author ",
      desslide2keywordshide: "novel, love, trending",
      deshashtag: "#romance #booktok #love",
      despalote: "Main promotional stick text",
      codimagenprincipal:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codimagenscreenshot:
        "https://www.canva.com/design/DAGtz7V-OoY/Zz8rTr57hXn6BcKl_MKdwg/edit?utm_content=DAGtz7V-OoY&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      codimagendialogo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codvideo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      desinstrucciones: "Post during evening peak hours.",
      fecplanposteo: "2026-03-12",
      codestadoorden: "Posted",
      tipregistroorden: "AUTO",
      flgordenincompleta: "N",
      desdatosfaltantesorden: "no observations",
      codusuarioauditoriacreareg: "gerard.iruri@utec.edu.pe",
      codusuarioauditoriaactualizareg: "gerard.iruri@utec.edu.pe",
      fecreacionregistro: "2026-03-12",
      horacreacionregistro: "09:00:00",
      fecactualizacionregistro: "2026-03-12",
      horaactualizacionregistro: "09:05:00",
    },
    {
      codordentrabajo: 1002,
      codautora: "Luna Mason",
      codlibro: "Distance",
      codescena: "Hook 11 – Jealous 🌶",
      codposteador: "Alondra Lerggios",
      codtelefono: "JH01",
      codcuentatiktok: "ruth_bestbooks",
      codsonido:
        "https://www.tiktok.com/music/original-sound-zizoo-7557152124510669569",
      desscenahook: "Romantic opening hook",
      descaption: "A heartwarming caption for the first post.",
      destropo:
        "- Enemies to lovers - Marriage of convenience (for marketing I sometimes call it an arranged marriage) - Age Gap - Best friend's father - Russian mafia romance - Dark romance - Billionaire - Forced proximity - Angsty Romance - Obsessed Hero",
      desslide1keywordshide: "romance, booktok, author ",
      desslide2keywordshide: "novel, love, trending",
      deshashtag: "#romance #booktok #love",
      despalote: "Main promotional stick text",
      codimagenprincipal:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codimagenscreenshot:
        "https://www.canva.com/design/DAGtz7V-OoY/Zz8rTr57hXn6BcKl_MKdwg/edit?utm_content=DAGtz7V-OoY&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      codimagendialogo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codvideo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      desinstrucciones: "Post during evening peak hours.",
      fecplanposteo: "2026-03-12",
      codestadoorden: "Posted",
      tipregistroorden: "AUTO",
      flgordenincompleta: "N",
      desdatosfaltantesorden: "no observations",
      codusuarioauditoriacreareg: "gerard.iruri@utec.edu.pe",
      codusuarioauditoriaactualizareg: "gerard.iruri@utec.edu.pe",
      fecreacionregistro: "2026-03-12",
      horacreacionregistro: "09:00:00",
      fecactualizacionregistro: "2026-03-12",
      horaactualizacionregistro: "09:05:00",
    },
    {
      codordentrabajo: 1002,
      codautora: "Luna Mason",
      codlibro: "Distance",
      codescena: "Hook 11 – Jealous 🌶",
      codposteador: "Alondra Lerggios",
      codtelefono: "JH01",
      codcuentatiktok: "ruth_bestbooks",
      codsonido:
        "https://www.tiktok.com/music/original-sound-zizoo-7557152124510669569",
      desscenahook: "Romantic opening hook",
      descaption: "A heartwarming caption for the first post.",
      destropo:
        "- Enemies to lovers - Marriage of convenience (for marketing I sometimes call it an arranged marriage) - Age Gap - Best friend's father - Russian mafia romance - Dark romance - Billionaire - Forced proximity - Angsty Romance - Obsessed Hero",
      desslide1keywordshide: "romance, booktok, author ",
      desslide2keywordshide: "novel, love, trending",
      deshashtag: "#romance #booktok #love",
      despalote: "Main promotional stick text",
      codimagenprincipal:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codimagenscreenshot:
        "https://www.canva.com/design/DAGtz7V-OoY/Zz8rTr57hXn6BcKl_MKdwg/edit?utm_content=DAGtz7V-OoY&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      codimagendialogo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codvideo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      desinstrucciones: "Post during evening peak hours.",
      fecplanposteo: "2026-03-12",
      codestadoorden: "Posted",
      tipregistroorden: "AUTO",
      flgordenincompleta: "N",
      desdatosfaltantesorden: "no observations",
      codusuarioauditoriacreareg: "gerard.iruri@utec.edu.pe",
      codusuarioauditoriaactualizareg: "gerard.iruri@utec.edu.pe",
      fecreacionregistro: "2026-03-12",
      horacreacionregistro: "09:00:00",
      fecactualizacionregistro: "2026-03-12",
      horaactualizacionregistro: "09:05:00",
    },
    {
      codordentrabajo: 1002,
      codautora: "Luna Mason",
      codlibro: "Distance",
      codescena: "Hook 11 – Jealous 🌶",
      codposteador: "Alondra Lerggios",
      codtelefono: "JH01",
      codcuentatiktok: "ruth_bestbooks",
      codsonido:
        "https://www.tiktok.com/music/original-sound-zizoo-7557152124510669569",
      desscenahook: "Romantic opening hook",
      descaption: "A heartwarming caption for the first post.",
      destropo:
        "- Enemies to lovers - Marriage of convenience (for marketing I sometimes call it an arranged marriage) - Age Gap - Best friend's father - Russian mafia romance - Dark romance - Billionaire - Forced proximity - Angsty Romance - Obsessed Hero",
      desslide1keywordshide: "romance, booktok, author ",
      desslide2keywordshide: "novel, love, trending",
      deshashtag: "#romance #booktok #love",
      despalote: "Main promotional stick text",
      codimagenprincipal:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codimagenscreenshot:
        "https://www.canva.com/design/DAGtz7V-OoY/Zz8rTr57hXn6BcKl_MKdwg/edit?utm_content=DAGtz7V-OoY&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      codimagendialogo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codvideo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      desinstrucciones: "Post during evening peak hours.",
      fecplanposteo: "2026-03-12",
      codestadoorden: "Posted",
      tipregistroorden: "AUTO",
      flgordenincompleta: "N",
      desdatosfaltantesorden: "no observations",
      codusuarioauditoriacreareg: "gerard.iruri@utec.edu.pe",
      codusuarioauditoriaactualizareg: "gerard.iruri@utec.edu.pe",
      fecreacionregistro: "2026-03-12",
      horacreacionregistro: "09:00:00",
      fecactualizacionregistro: "2026-03-12",
      horaactualizacionregistro: "09:05:00",
    },
    {
      codordentrabajo: 1002,
      codautora: "Luna Mason",
      codlibro: "Distance",
      codescena: "Hook 11 – Jealous 🌶",
      codposteador: "Alondra Lerggios",
      codtelefono: "JH01",
      codcuentatiktok: "ruth_bestbooks",
      codsonido:
        "https://www.tiktok.com/music/original-sound-zizoo-7557152124510669569",
      desscenahook: "Romantic opening hook",
      descaption: "A heartwarming caption for the first post.",
      destropo:
        "- Enemies to lovers - Marriage of convenience (for marketing I sometimes call it an arranged marriage) - Age Gap - Best friend's father - Russian mafia romance - Dark romance - Billionaire - Forced proximity - Angsty Romance - Obsessed Hero",
      desslide1keywordshide: "romance, booktok, author ",
      desslide2keywordshide: "novel, love, trending",
      deshashtag: "#romance #booktok #love",
      despalote: "Main promotional stick text",
      codimagenprincipal:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codimagenscreenshot:
        "https://www.canva.com/design/DAGtz7V-OoY/Zz8rTr57hXn6BcKl_MKdwg/edit?utm_content=DAGtz7V-OoY&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      codimagendialogo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codvideo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      desinstrucciones: "Post during evening peak hours.",
      fecplanposteo: "2026-03-12",
      codestadoorden: "Posted",
      tipregistroorden: "AUTO",
      flgordenincompleta: "N",
      desdatosfaltantesorden: "no observations",
      codusuarioauditoriacreareg: "gerard.iruri@utec.edu.pe",
      codusuarioauditoriaactualizareg: "gerard.iruri@utec.edu.pe",
      fecreacionregistro: "2026-03-12",
      horacreacionregistro: "09:00:00",
      fecactualizacionregistro: "2026-03-12",
      horaactualizacionregistro: "09:05:00",
    },
    {
      codordentrabajo: 1002,
      codautora: "Luna Mason",
      codlibro: "Distance",
      codescena: "Hook 11 – Jealous 🌶",
      codposteador: "Alondra Lerggios",
      codtelefono: "JH01",
      codcuentatiktok: "ruth_bestbooks",
      codsonido:
        "https://www.tiktok.com/music/original-sound-zizoo-7557152124510669569",
      desscenahook: "Romantic opening hook",
      descaption: "A heartwarming caption for the first post.",
      destropo:
        "- Enemies to lovers - Marriage of convenience (for marketing I sometimes call it an arranged marriage) - Age Gap - Best friend's father - Russian mafia romance - Dark romance - Billionaire - Forced proximity - Angsty Romance - Obsessed Hero",
      desslide1keywordshide: "romance, booktok, author ",
      desslide2keywordshide: "novel, love, trending",
      deshashtag: "#romance #booktok #love",
      despalote: "Main promotional stick text",
      codimagenprincipal:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codimagenscreenshot:
        "https://www.canva.com/design/DAGtz7V-OoY/Zz8rTr57hXn6BcKl_MKdwg/edit?utm_content=DAGtz7V-OoY&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      codimagendialogo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codvideo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      desinstrucciones: "Post during evening peak hours.",
      fecplanposteo: "2026-03-12",
      codestadoorden: "Posted",
      tipregistroorden: "AUTO",
      flgordenincompleta: "N",
      desdatosfaltantesorden: "no observations",
      codusuarioauditoriacreareg: "gerard.iruri@utec.edu.pe",
      codusuarioauditoriaactualizareg: "gerard.iruri@utec.edu.pe",
      fecreacionregistro: "2026-03-12",
      horacreacionregistro: "09:00:00",
      fecactualizacionregistro: "2026-03-12",
      horaactualizacionregistro: "09:05:00",
    },
    {
      codordentrabajo: 1002,
      codautora: "Luna Mason",
      codlibro: "Distance",
      codescena: "Hook 11 – Jealous 🌶",
      codposteador: "Alondra Lerggios",
      codtelefono: "JH01",
      codcuentatiktok: "ruth_bestbooks",
      codsonido:
        "https://www.tiktok.com/music/original-sound-zizoo-7557152124510669569",
      desscenahook: "Romantic opening hook",
      descaption: "A heartwarming caption for the first post.",
      destropo:
        "- Enemies to lovers - Marriage of convenience (for marketing I sometimes call it an arranged marriage) - Age Gap - Best friend's father - Russian mafia romance - Dark romance - Billionaire - Forced proximity - Angsty Romance - Obsessed Hero",
      desslide1keywordshide: "romance, booktok, author ",
      desslide2keywordshide: "novel, love, trending",
      deshashtag: "#romance #booktok #love",
      despalote: "Main promotional stick text",
      codimagenprincipal:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codimagenscreenshot:
        "https://www.canva.com/design/DAGtz7V-OoY/Zz8rTr57hXn6BcKl_MKdwg/edit?utm_content=DAGtz7V-OoY&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton",
      codimagendialogo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      codvideo:
        "https://drive.google.com/file/d/1BXfS74i6KZwA5tkf5uBVOFxno_u_fz7d/view?usp=drive_link",
      desinstrucciones: "Post during evening peak hours.",
      fecplanposteo: "2026-03-12",
      codestadoorden: "Posted",
      tipregistroorden: "AUTO",
      flgordenincompleta: "N",
      desdatosfaltantesorden: "no observations",
      codusuarioauditoriacreareg: "gerard.iruri@utec.edu.pe",
      codusuarioauditoriaactualizareg: "gerard.iruri@utec.edu.pe",
      fecreacionregistro: "2026-03-12",
      horacreacionregistro: "09:00:00",
      fecactualizacionregistro: "2026-03-12",
      horaactualizacionregistro: "09:05:00",
    },
  ];

  useEffect(() => {
    if (!userEmail) return;

    try {
      const rawFilters = localStorage.getItem(STORAGE_KEY);
      setFilters(
        rawFilters
          ? buildDefaultFilters(JSON.parse(rawFilters))
          : buildDefaultFilters(),
      );
    } catch {
      setFilters(buildDefaultFilters());
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
      const rawGenerationAlerts = localStorage.getItem(
        GENERATION_ALERTS_STORAGE_KEY,
      );
      setGenerationAlerts(
        rawGenerationAlerts ? JSON.parse(rawGenerationAlerts) : [],
      );
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
    GENERATION_ALERTS_STORAGE_KEY,
  ]);

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
        GENERATION_ALERTS_STORAGE_KEY,
        JSON.stringify(generationAlerts),
      );
    } catch {}
  }, [generationAlerts, GENERATION_ALERTS_STORAGE_KEY]);

  useEffect(() => {
    let active = true;

    if (!token) return;

    (async () => {
      setLoadingCatalog(true);
      try {
        const posteadores = await getPaFiltersService({ token });

        if (!active) return;

        setCatalog((prev) => ({
          ...prev,
          posteadores,
        }));
      } finally {
        if (active) setLoadingCatalog(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    let active = true;

    if (!token || !filters.codposteador) {
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
          PaCode: filters.codposteador,
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
  }, [token, filters.codposteador, editCatalogReloadKey]);

  useEffect(() => {
    let active = true;

    if (!token || !filters.codposteador) {
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
          codposteador: filters.codposteador,
          codtelefono: filters.codtelefono,
          tiptelefono: getSelectedTipTelefono(),
        });

        if (!active) return;

        const autoras = AuthorResponse.toAuthorOptionList(rows);
        const libros = AuthorResponse.toBookOptionListByAuthor(
          rows,
          filters.codautora,
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
  }, [
    token,
    filters.codposteador,
    filters.codtelefono,
    filters.codautora,
    editCatalogReloadKey,
  ]);

  useEffect(() => {
    const libros = AuthorResponse.toBookOptionListByAuthor(
      authorBookRows,
      filters.codautora,
    );

    setCatalog((prev) => ({
      ...prev,
      libros,
    }));
  }, [authorBookRows, filters.codautora]);

  const getSelectedTipTelefono = () => {
    if (!filters.codtelefono) return null;
    const selectedTelefono = (catalog.telefonos || []).find(
      (item) => item?.value === filters.codtelefono,
    );
    return selectedTelefono?.tiptelefono ?? null;
  };

  useEffect(() => {
    let active = true;

    const codlibro = filters.codlibro ?? null;

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
  }, [token, filters.codlibro]);

  useEffect(() => {
    let active = true;

    const codlibro = filters.codlibro ?? null;

    const tippublicacion = filters.tippublicacion ?? null;

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
  }, [token, filters.codlibro, filters.tippublicacion]);

  const getSelectedEditTipTelefono = () => {
    if (!editFilters.codtelefono) return null;

    const selectedTelefono = (editCatalog.telefonos || []).find(
      (item) => item?.value === editFilters.codtelefono,
    );

    return selectedTelefono?.tiptelefono ?? null;
  };

  useEffect(() => {
    let active = true;

    if (!isEditing || !selectedOrder?.codordentrabajo) return;

    if (!token || !editFilters.codposteador) {
      setEditCatalog((prev) => ({
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

  useEffect(() => {
    let active = true;

    if (!isEditing || !selectedOrder?.codordentrabajo) return;

    if (!token || !editFilters.codposteador) {
      setEditCatalog((prev) => ({
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

    if (!isEditing || !selectedOrder?.codordentrabajo) return;

    const codlibro = editFilters.codlibro ?? null;

    if (!token || !codlibro) {
      setEditCatalog((prev) => ({
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

    if (!isEditing || !selectedOrder?.codordentrabajo) return;

    const codlibro = editFilters.codlibro ?? null;
    const tippublicacion = editFilters.tippublicacion ?? null;

    if (!token || !codlibro || !tippublicacion) {
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

  useEffect(() => {
    let active = true;

    if (!token) return;

    if (requiredImagesLoadedRef.current) return;

    requiredImagesLoadedRef.current = true;

    const loadRequiredImages = async () => {
      try {
        const rows = await getRequiredImagesPerTipPublicacionService({ token });

        if (!active) return;

        setRequiredImagesPerTipPublicacion(Array.isArray(rows) ? rows : []);
      } catch (error) {
        console.error("Error loading required images/videos:", error);

        if (!active) return;

        requiredImagesLoadedRef.current = false;
        setRequiredImagesPerTipPublicacion([]);
      }
    };

    loadRequiredImages();

    return () => {
      active = false;
    };
  }, [token]);

  const emptyManualOrder = useMemo(
    () => ({
      codposteador: "",
      codtelefono: "",
      codautora: "",
      codlibro: "",
      tippublicacion: "",
      codescena: "",

      codcuentatiktok: "",
      codsonido: "",
      nCodsonido: "",
      desscenahook: "",
      descaption: "",
      destropo: "",
      desslide1keywordshide: "",
      desslide2keywordshide: "",
      deshashtag: "",
      despalote: "",
      codimagenprincipal: "",
      nCodimagenprincipal: "",

      codimagenscreenshot: "",
      nCodimagenscreenshot: "",

      codimagendialogo: "",
      nCodimagendialogo: "",

      codvideo: "",
      nCodvideo: "",
      desinstrucciones: "",
      fecplanposteo: "",
      codestadoorden: "",
      tipregistroorden: "",
      flgordencompleta: "",
      ctddatoobligincompleto: "",
      desdatoobligincompleto: "",
      deslogerrororden: "",

      codusuarioauditoriacreareg: "",
      codusuarioauditoriaactualizareg: "",
      fecreacionregistro: "",
      horacreacionregistro: "",
      fecactualizacionregistro: "",
      horaactualizacionregistro: "",
    }),
    [],
  );

  const requiredImageVideoFields = useMemo(() => {
    const currentTipPublicacion =
      editFilters.tippublicacion ||
      draftOrder?.tippublicacion ||
      filters.tippublicacion ||
      "";

    const currentPostTypeOptions =
      editCatalog?.tiposPosteo?.length > 0
        ? editCatalog.tiposPosteo
        : catalog?.tiposPosteo;

    const currentTipPublicacionLabel = getPostTypeLabelByValue(
      currentPostTypeOptions,
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
    filters.tippublicacion,
    editCatalog?.tiposPosteo,
    catalog?.tiposPosteo,
    requiredImagesPerTipPublicacion,
  ]);

  const getManualOrderMissingFields = (order) => {
    const faltantes = [];

    const hasText = (value) => String(value ?? "").trim() !== "";

    const isValidInteger = (value) => {
      if (!hasText(value)) return false;
      return Number.isInteger(Number(value));
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

    if (!order?.codposteador?.trim()) faltantes.push("PA");
    if (!order?.codautora?.trim()) faltantes.push("Author");
    if (!order?.codlibro?.trim()) faltantes.push("Book");

    if (!order?.tippublicacion?.trim()) {
      faltantes.push("Post Type");
    }

    if (!order?.codescena?.trim()) {
      faltantes.push("Scene");
    }

    if (!order?.codcuentatiktok?.trim()) faltantes.push("TikTok Account");

    if (!isValidInteger(order?.codsonido || order?.nCodsonido)) {
      faltantes.push("Sound");
    }

    if (!order?.desscenahook?.trim()) faltantes.push("Scene Hook");
    if (!order?.despalote?.trim()) faltantes.push("Full Stick");

    const orderTipPublicacionLabel = getPostTypeLabelByValue(
      catalog?.tiposPosteo,
      order?.tippublicacion,
    );

    const requiredImageVideoFieldsForOrder =
      getRequiredImageVideoFieldsByTipPublicacion(
        requiredImagesPerTipPublicacion,
        order?.tippublicacion,
        orderTipPublicacionLabel,
      );

    requiredImageVideoFieldsForOrder.forEach((field) => {
      const value = order?.[field.key];
      const displayValue = order?.[field.displayKey];

      if (!hasText(value) && !hasText(displayValue)) {
        faltantes.push(field.label);
        return;
      }

      if (hasText(value) && !isValidHttpUrl(value)) {
        faltantes.push(`${field.label} must be a valid URL`);
        return;
      }

      if (hasText(displayValue) && !isValidHttpUrl(displayValue)) {
        faltantes.push(`${field.label} must be a valid URL`);
      }
    });

    if (!order?.fecplanposteo?.trim()) faltantes.push("Planned Post date");

    return faltantes;
  };

  const getGenerateMissingFields = (currentFilters) => {
    const faltantes = [];

    if (!currentFilters?.codposteador) faltantes.push("PA");
    if (!currentFilters?.codautora) faltantes.push("Author");
    if (!currentFilters?.codlibro) faltantes.push("Book");
    if (!currentFilters?.tippublicacion) faltantes.push("Post Type");

    return faltantes;
  };

  const buildManualOrderRequestBody = (order) => {
    const toNullableInteger = (value) => {
      if (value === null || value === undefined || value === "") return null;

      const parsed = Number(value);
      return Number.isNaN(parsed) ? null : parsed;
    };

    const toNullableText = (value) => {
      if (value === null || value === undefined) return null;

      const cleaned = String(value).trim();
      return cleaned === "" ? null : cleaned;
    };

    const body = {
      ...NewManualOrderRequestDTO,
      correo: userEmail?.trim()?.toLowerCase() || "",
      codposteador: order?.codposteador?.trim() || "",
      codtelefono: order?.codtelefono?.trim() || "",
      codautora: order?.codautora?.trim() || "",
      codlibro: order?.codlibro?.trim() || "",
      tippublicacion: order?.tippublicacion?.trim() || "",
      codescena: order?.codescena?.trim() || "",
      codcuentatiktok: order?.codcuentatiktok?.trim() || "",

      // integer
      codsonido: toNullableInteger(order?.codsonido || order?.nCodsonido),
      desscenahook: order?.desscenahook?.trim() || "",
      descaption: order?.descaption?.trim() || "",
      destropo: order?.destropo?.trim() || "",
      desslide1keywordshide: order?.desslide1keywordshide?.trim() || "",
      desslide2keywordshide: order?.desslide2keywordshide?.trim() || "",
      deshashtag: order?.deshashtag?.trim() || "",
      despalote: buildAutoPalote(order),

      // URLs
      // URLs
      codimagenprincipal: toNullableText(
        order?.codimagenprincipal || order?.nCodimagenprincipal,
      ),
      codimagenscreenshot: toNullableText(
        order?.codimagenscreenshot || order?.nCodimagenscreenshot,
      ),
      codimagendialogo: toNullableText(
        order?.codimagendialogo || order?.nCodimagendialogo,
      ),
      codvideo: toNullableText(order?.codvideo || order?.nCodvideo),

      desinstrucciones: order?.desinstrucciones?.trim() || "",
      fecplanposteo: order?.fecplanposteo || "",
      codestadoorden: toNullableInteger(order?.codestadoorden),
    };
    body.codlibro = toNullableText(
      editFilters.codlibro ??
        order?.codlibro ??
        draftOrder?.codlibro ??
        selectedOrder?.codlibro,
    );

    body.tippublicacion = toNullableText(
      editFilters.tippublicacion ??
        order?.tippublicacion ??
        draftOrder?.tippublicacion ??
        selectedOrder?.tippublicacion,
    );

    body.codescena = toNullableText(
      editFilters.codescena ??
        order?.codescena ??
        draftOrder?.codescena ??
        selectedOrder?.codescena,
    );

    return body;
  };

  const buildAutoPalote = useCallback((order) => {
    const codautora = cleanText(order?.codautora);
    const codlibro = cleanText(order?.codlibro);
    const tippublicacion = cleanText(order?.tippublicacion);
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
  }, []);

  const withAutoPalote = (order) => {
    const nextOrder = { ...(order || {}) };

    return {
      ...nextOrder,
      despalote: buildAutoPalote(nextOrder),
    };
  };

  const mergeDraftWithAutoPalote = (currentDraft, patch) => {
    return withAutoPalote({
      ...(currentDraft || {}),
      ...(patch || {}),
    });
  };

  const actions = useMemo(() => {
    return {
      openNotifications: () => setNotifOpen(true),
      toggleNotifications: () => setNotifOpen((prev) => !prev),
      closeNotifications: () => setNotifOpen(false),
      clearNotifications: () => {
        setGenerationAlerts([]);
      },
      setCodAutora: (v) =>
        setFilters((p) => ({
          ...p,
          codautora: v,
          codlibro: null,
          tippublicacion: null,
          codescena: null,
        })),

      setCodLibro: (v) =>
        setFilters((p) => ({
          ...p,
          codlibro: v,
          tippublicacion: null,
          codescena: null,
        })),

      setCodPosteador: (v) =>
        setFilters((p) => ({
          ...p,
          codposteador: v,
          codtelefono: null,
          tiptelefono: null,
          codautora: null,
          codlibro: null,
          tippublicacion: null,
          codescena: null,
        })),

      setPrioridadEscenas: (v) =>
        setFilters((p) => ({ ...p, flgprioridadescena: v })),

      setPrioridadImagenVideo: (v) =>
        setFilters((p) => ({ ...p, flgprioridadimagenvideo: v })),

      setPrioridadSonido: (v) =>
        setFilters((p) => ({ ...p, flgprioridasonido: v })),

      setCodTelefono: (v) =>
        setFilters((p) => ({
          ...p,
          codtelefono: v,
          tiptelefono: null,
          codautora: null,
          codlibro: null,
          tippublicacion: null,
          codescena: null,
        })),

      setCodTipoPosteo: (v) =>
        setFilters((p) => ({
          ...p,
          tippublicacion: v,
          codescena: null,
        })),

      setCodEscena: (v) =>
        setFilters((p) => {
          const sceneValue = typeof v === "string" ? v.trim() : v;
          const hasScene = sceneValue != null && sceneValue !== "";

          return {
            ...p,
            codescena: hasScene ? sceneValue : null,
            ctdordenesmetamanual: hasScene ? 1 : null,
          };
        }),

      setStartPostingDate: (v) =>
        setFilters((p) => ({
          ...p,
          fecinicioplanposteo: v,
          fecfinplanposteo: v,
        })),

      setEndPostingDate: (v) =>
        setFilters((p) => ({
          ...p,
          fecinicioplanposteo: v,
          fecfinplanposteo: v,
        })),

      setCantidadOrdenesGenerar: (v) =>
        setFilters((p) => {
          const hasScene =
            p.codescena != null && String(p.codescena).trim() !== "";

          if (hasScene) {
            return {
              ...p,
              ctdordenesmetamanual: 1,
            };
          }

          return {
            ...p,
            ctdordenesmetamanual: v,
          };
        }),

      reset: () => {
        setFilters(buildDefaultFilters());
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
        setDetailsOpen(false);
        setIsEditing(false);
        setSelectedOrder(null);
        setDraftOrder(null);
        setNotifOpen(false);

        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(CATALOG_STORAGE_KEY);
          localStorage.removeItem(AUTHOR_BOOK_ROWS_STORAGE_KEY);
          localStorage.removeItem(ORDERS_ROWS_STORAGE_KEY);
          localStorage.removeItem(ORDERS_COLUMNS_STORAGE_KEY);
          localStorage.removeItem(DATA_LOADED_STORAGE_KEY);
        } catch {}
      },

      setOrders: (rows, columns) => {
        setOrdersRows(Array.isArray(rows) ? rows : []);
        setOrdersColumns(Array.isArray(columns) ? columns : []);
        setDataLoaded(true);
      },
      markAttempted: () => setDataLoaded(true),

      validateAndGenerate: async () => {
        const faltantes = getGenerateMissingFields(filters);

        if (faltantes.length > 0) {
          notifyManualValidation?.(
            "Required filters missing",
            `Please complete the required filters: ${faltantes.join(", ")}`,
            "error",
          );
          return;
        }

        setIsGeneratingOrders(true);
        try {
          const todayISO = getTodayLocalISO();
          const effectiveStartDate = filters.fecinicioplanposteo || todayISO;
          const effectiveEndDate =
            filters.fecfinplanposteo || effectiveStartDate;

          const request = {
            correo: userEmail?.trim()?.toLowerCase() || null,
            codposteador: filters.codposteador,
            tiptelefono: getSelectedTipTelefono(),
            codtelefono: filters.codtelefono,
            codautora: filters.codautora,
            codlibro: filters.codlibro,
            tippublicacion: filters.tippublicacion,
            codescena: filters.codescena,
            flgprioridadescena: filters.flgprioridadescena ?? "N",
            flgprioridasonido: filters.flgprioridasonido ?? "N",
            flgprioridadimagenvideo: filters.flgprioridadimagenvideo ?? "N",
            fecinicioplanposteo: effectiveStartDate,
            fecfinplanposteo: effectiveEndDate,
            ctdordenesmetamanual: filters.ctdordenesmetamanual,
          };

          const response = await GenerateOrdenService({
            token,
            request,
          });

          const paName =
            (catalog?.posteadores || []).find((item) => {
              const optionValue =
                item?.value ??
                item?.codigo ??
                item?.code ??
                item?.id ??
                item?.codposteador ??
                "";

              return (
                String(optionValue).trim() ===
                String(filters.codposteador).trim()
              );
            })?.label ??
            (catalog?.posteadores || []).find((item) => {
              const optionValue =
                item?.value ??
                item?.codigo ??
                item?.code ??
                item?.id ??
                item?.codposteador ??
                "";

              return (
                String(optionValue).trim() ===
                String(filters.codposteador).trim()
              );
            })?.nombre ??
            (catalog?.posteadores || []).find((item) => {
              const optionValue =
                item?.value ??
                item?.codigo ??
                item?.code ??
                item?.id ??
                item?.codposteador ??
                "";

              return (
                String(optionValue).trim() ===
                String(filters.codposteador).trim()
              );
            })?.nbposteador ??
            null;

          const normalizedOrders = (
            Array.isArray(response?.ordenes) ? response.ordenes : []
          ).map((row) => ({
            ...row,
            nCodposteador:
              row?.nCodposteador ??
              row?.nCodPosteador ??
              row?.nbposteador ??
              row?.desposteador ??
              row?.nombreposteador ??
              paName ??
              row?.codposteador,
          }));

          setOrdersColumns(mockColumns);
          setOrdersRows(normalizedOrders);
          const nuevaAlerta = {
            codcabeceraordentrabajo: response?.codcabeceraordentrabajo ?? null,
            ctdordenes: response?.ctdordenes ?? 0,
            ctdordenescompleta: response?.ctdordenescompleta ?? 0,
            ctdordenesincompleta: response?.ctdordenesincompleta ?? 0,
            msj_error_log: response?.msj_error_log ?? null,
            createdAt: new Date().toISOString(),
          };

          setGenerationAlerts((prev) => [nuevaAlerta, ...prev]);
          setDataLoaded(true);

          notifyManualValidation?.(
            "Success",
            "Orders generated successfully.",
            "success",
          );
        } catch (error) {
          notifyManualValidation?.(
            "Error",
            error?.message || "Error generating orders.",
            "error",
          );
        } finally {
          setIsGeneratingOrders(false);
        }
      },

      mockGenerate: () => {
        setOrdersColumns(mockColumns);
        setOrdersRows(mockRows);
        setDataLoaded(true);
      },

      removeOrderRow: (codordentrabajo) => {
        setOrdersRows((prev) =>
          (prev || []).filter(
            (row) => String(row?.codordentrabajo) !== String(codordentrabajo),
          ),
        );

        setSelectedOrder((prev) =>
          String(prev?.codordentrabajo) === String(codordentrabajo)
            ? null
            : prev,
        );

        setDraftOrder((prev) =>
          String(prev?.codordentrabajo) === String(codordentrabajo)
            ? null
            : prev,
        );

        setDetailsOpen((prev) => {
          if (
            String(selectedOrder?.codordentrabajo) === String(codordentrabajo)
          ) {
            return false;
          }

          return prev;
        });

        setIsEditing((prev) => {
          if (
            String(selectedOrder?.codordentrabajo) === String(codordentrabajo)
          ) {
            return false;
          }

          return prev;
        });
      },
      openManualOrder: () => {
        setFilters(buildDefaultFilters());
        setSelectedOrder(null);
        setDraftOrder({ ...emptyManualOrder });
        setIsEditing(true);
        setDetailsOpen(true);
      },

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
        setDraftOrder((p) => mergeDraftWithAutoPalote(p, { [key]: value }));
      },

      setManualCodPosteador: (v) => {
        setDraftOrder((p) =>
          mergeDraftWithAutoPalote(p, {
            codposteador: v || "",
            codtelefono: "",
            codautora: "",
            codlibro: "",
            tippublicacion: "",
            codescena: "",
          }),
        );

        setFilters((p) => ({
          ...p,
          codposteador: v || null,
          codtelefono: null,
          tiptelefono: null,
          codautora: null,
          codlibro: null,
          tippublicacion: null,
          codescena: null,
        }));
      },

      setManualCodTelefono: (v) => {
        setDraftOrder((p) =>
          mergeDraftWithAutoPalote(p, {
            codtelefono: v || "",
            codautora: "",
            codlibro: "",
            tippublicacion: "",
            codescena: "",
          }),
        );

        setFilters((p) => ({
          ...p,
          codtelefono: v || null,
          tiptelefono: null,
          codautora: null,
          codlibro: null,
          tippublicacion: null,
          codescena: null,
        }));
      },

      setManualCodAutora: (v) => {
        setDraftOrder((p) =>
          mergeDraftWithAutoPalote(p, {
            codautora: v || "",
            codlibro: "",
            tippublicacion: "",
            codescena: "",
          }),
        );

        setFilters((p) => ({
          ...p,
          codautora: v || null,
          codlibro: null,
          tippublicacion: null,
          codescena: null,
        }));
      },

      setManualCodLibro: (v) => {
        setDraftOrder((p) =>
          mergeDraftWithAutoPalote(p, {
            codlibro: v || "",
            tippublicacion: "",
            codescena: "",
          }),
        );

        setFilters((p) => ({
          ...p,
          codlibro: v || null,
          tippublicacion: null,
          codescena: null,
        }));
      },

      setManualCodTipoPosteo: (v) => {
        setDraftOrder((p) =>
          mergeDraftWithAutoPalote(p, {
            tippublicacion: v || "",
            codescena: "",
          }),
        );

        setFilters((p) => ({
          ...p,
          tippublicacion: v || null,
          codescena: null,
        }));
      },

      setManualCodEscena: (v) => {
        setDraftOrder((p) =>
          mergeDraftWithAutoPalote(p, {
            codescena: v || "",
          }),
        );

        setFilters((p) => ({
          ...p,
          codescena: v || null,
        }));
      },

      setEditCodPosteador: (v) => {
        setEditFilters((p) => ({
          ...p,
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
        setEditFilters((p) => ({
          ...p,
          codtelefono: v || null,
          tiptelefono: null,
          codautora: null,
          codlibro: null,
          tippublicacion: null,
          codescena: null,
        }));
      },

      setEditCodAutora: (v) => {
        setEditFilters((p) => ({
          ...p,
          codautora: v || null,
          codlibro: null,
          tippublicacion: null,
          codescena: null,
        }));
      },

      setEditCodLibro: (v) => {
        setEditFilters((p) => ({
          ...p,
          codlibro: v || null,
          tippublicacion: null,
          codescena: null,
        }));
      },

      setEditCodTipoPosteo: (v) => {
        setEditFilters((p) => ({
          ...p,
          tippublicacion: v || null,
          codescena: null,
        }));
      },

      setEditCodEscena: (v) => {
        setEditFilters((p) => ({
          ...p,
          codescena: v || null,
        }));
      },
      saveDetails: async (newValues = {}) => {
        const isManualNewOrder = !draftOrder?.codordentrabajo;

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

        const editCascadeStarted =
          !isManualNewOrder &&
          [
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
            notifyManualValidation?.(
              "Required fields missing",
              `You started changing the cascade filters. Please complete: ${faltantesEditCascade.join(", ")}`,
              "warning",
            );
            return;
          }
        }

        const updatedOrder = withAutoPalote({
          ...draftOrder,
          ...(newValues.newCodPosteador != null &&
          newValues.newCodPosteador !== ""
            ? { codposteador: newValues.newCodPosteador }
            : {}),

          ...(newValues.newCodTelefono != null &&
          newValues.newCodTelefono !== ""
            ? { codtelefono: newValues.newCodTelefono }
            : {}),

          ...(newValues.newCodTipoPosteo != null &&
          newValues.newCodTipoPosteo !== ""
            ? {
                tippublicacion: newValues.newCodTipoPosteo,
              }
            : {}),

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

          ...(!isManualNewOrder && hasValue(newValues.newCodImagenPrincipal)
            ? {
                codimagenprincipal: cleanValue(newValues.newCodImagenPrincipal),
                nCodimagenprincipal: cleanValue(
                  newValues.newCodImagenPrincipal,
                ),
              }
            : {}),

          ...(!isManualNewOrder && hasValue(newValues.newCodImagenScreenshot)
            ? {
                codimagenscreenshot: cleanValue(
                  newValues.newCodImagenScreenshot,
                ),
                nCodimagenscreenshot: cleanValue(
                  newValues.newCodImagenScreenshot,
                ),
              }
            : {}),

          ...(!isManualNewOrder && hasValue(newValues.newCodImagenDialogo)
            ? {
                codimagendialogo: cleanValue(newValues.newCodImagenDialogo),
                nCodimagendialogo: cleanValue(newValues.newCodImagenDialogo),
              }
            : {}),

          ...(!isManualNewOrder && hasValue(newValues.newCodVideo)
            ? {
                codvideo: cleanValue(newValues.newCodVideo),
                nCodvideo: cleanValue(newValues.newCodVideo),
              }
            : {}),

          ...(hasValue(newValues.newDesInstrucciones)
            ? { desinstrucciones: cleanValue(newValues.newDesInstrucciones) }
            : {}),

          ...(newValues.newFecPlanPosteo != null &&
          newValues.newFecPlanPosteo !== ""
            ? { fecplanposteo: newValues.newFecPlanPosteo }
            : {}),

          ...(newValues.newCodEstadoOrden != null &&
          newValues.newCodEstadoOrden !== ""
            ? { codestadoorden: Number(newValues.newCodEstadoOrden) }
            : {}),

          ...(newValues.newCodAutora != null && newValues.newCodAutora !== ""
            ? { codautora: newValues.newCodAutora }
            : {}),

          ...(newValues.newCodLibro != null && newValues.newCodLibro !== ""
            ? { codlibro: newValues.newCodLibro }
            : {}),

          ...(newValues.newCodEscena != null && newValues.newCodEscena !== ""
            ? { codescena: newValues.newCodEscena }
            : {}),

          ...(hasValue(newValues.newDesDatoObligIncompleto)
            ? {
                desdatoobligincompleto: cleanValue(
                  newValues.newDesDatoObligIncompleto,
                ),
              }
            : {}),

          ...(hasValue(newValues.newDesLogErrorOrden)
            ? {
                deslogerrororden: cleanValue(newValues.newDesLogErrorOrden),
              }
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

        if (isManualNewOrder) {
          const faltantes = getManualOrderMissingFields(updatedOrder);

          if (faltantes.length > 0) {
            notifyManualValidation?.(
              "Required fields missing",
              `Please complete the required fields: ${faltantes.join(", ")}`,
              "warning",
            );
            return;
          }

          if (isManualNewOrder) {
            if (!userEmail?.trim()) {
              notifyManualValidation?.(
                "Error",
                "Authenticated user email was not found.",
                "error",
              );
              return;
            }
          }

          try {
            const body = buildManualOrderRequestBody(updatedOrder);

            const createdOrderFromBack = await createManualOrderService({
              token,
              body,
            });

            notifyManualValidation?.(
              "Success",
              "Manual order created successfully.",
              "success",
            );

            if (createdOrderFromBack?.codordentrabajo) {
              setOrdersRows((prev) => [createdOrderFromBack, ...(prev || [])]);
              setSelectedOrder(createdOrderFromBack);
              setDraftOrder(createdOrderFromBack);
            } else {
              setSelectedOrder(updatedOrder);
              setDraftOrder(updatedOrder);
            }

            setDetailsOpen(false);
            setIsEditing(false);
            return;
          } catch (error) {
            notifyManualValidation?.(
              "Error",
              error?.message || "Error creating manual order.",
              "error",
            );
            return;
          }
        }

        const codordentrabajo =
          draftOrder?.codordentrabajo ??
          selectedOrder?.codordentrabajo ??
          updatedOrder?.codordentrabajo;

        if (!codordentrabajo) {
          notifyManualValidation?.(
            "Error",
            "codordentrabajo was not found for this order.",
            "error",
          );
          return;
        }

        try {
          const body = buildManualOrderRequestBody(updatedOrder);

          const updatedOrderFromBack = await updateManualOrderService({
            token,
            codordentrabajo,
            body,
          });

          const updatedRowForTable = {
            ...draftOrder,
            ...updatedOrderFromBack,

            codimagenprincipal:
              updatedOrderFromBack?.codimagenprincipal ??
              updatedOrder?.codimagenprincipal ??
              draftOrder?.codimagenprincipal,

            nCodimagenprincipal:
              updatedOrder?.nCodimagenprincipal ??
              updatedOrder?.codimagenprincipal ??
              draftOrder?.nCodimagenprincipal ??
              updatedOrderFromBack?.nCodimagenprincipal,

            codimagenscreenshot:
              updatedOrderFromBack?.codimagenscreenshot ??
              updatedOrder?.codimagenscreenshot ??
              draftOrder?.codimagenscreenshot,

            nCodimagenscreenshot:
              updatedOrder?.nCodimagenscreenshot ??
              updatedOrder?.codimagenscreenshot ??
              draftOrder?.nCodimagenscreenshot ??
              updatedOrderFromBack?.nCodimagenscreenshot,

            codimagendialogo:
              updatedOrderFromBack?.codimagendialogo ??
              updatedOrder?.codimagendialogo ??
              draftOrder?.codimagendialogo,

            nCodimagendialogo:
              updatedOrder?.nCodimagendialogo ??
              updatedOrder?.codimagendialogo ??
              draftOrder?.nCodimagendialogo ??
              updatedOrderFromBack?.nCodimagendialogo,

            codvideo:
              updatedOrderFromBack?.codvideo ??
              updatedOrder?.codvideo ??
              draftOrder?.codvideo,

            nCodvideo:
              updatedOrder?.nCodvideo ??
              updatedOrder?.codvideo ??
              draftOrder?.nCodvideo ??
              updatedOrderFromBack?.nCodvideo,
          };

          setOrdersRows((prev) =>
            (prev || []).map((r) =>
              String(r?.codordentrabajo) === String(codordentrabajo)
                ? updatedRowForTable
                : r,
            ),
          );

          notifyManualValidation?.(
            "Success",
            "Order updated successfully.",
            "success",
          );

          setSelectedOrder(updatedRowForTable);
          setDraftOrder(updatedRowForTable);
          setIsEditing(false);
        } catch (error) {
          notifyManualValidation?.(
            "Error",
            error?.message || "Error updating order.",
            "error",
          );
        }
      },
    };
  }, [
    draftOrder,
    emptyManualOrder,
    notifyManualValidation,
    filters,
    editFilters,
    editCatalog?.tiposPosteo,
    token,
    userEmail,
    catalog?.tiposPosteo,
    requiredImagesPerTipPublicacion,
    buildAutoPalote,
  ]);

  return {
    filters,
    catalog,
    editCatalog,
    editFilters,
    loadingCatalog,
    isGeneratingOrders,
    actions,
    ordersRows,
    ordersColumns,
    dataLoaded,
    selectedOrder,
    detailsOpen,
    isEditing,
    draftOrder,
    notifOpen,
    generationAlerts,
    requiredImageVideoFields,
  };
}
