import React, { useEffect, useMemo, useState } from "react";
import SelectField from "./SelectField";
export default function OrderDetailsModal({
  open,
  order,
  draft,
  isEditing,
  catalog,
  editCatalog,
  editFilters,
  requiredImageVideoFields,
  onClose,
  onEdit,
  onChange,
  onSave,
  onManualSelectPublisher,
  onManualSelectTelephone,

  onManualSelectAuthor,
  onManualSelectBook,
  onManualSelectPostType,
  onManualSelectScene,
  onEditSelectPublisher,
  onEditSelectTelephone,
  onEditSelectAuthor,
  onEditSelectBook,
  onEditSelectPostType,
  onEditSelectScene,
}) {
  const isManualMode = !order && isEditing;

  const title = isManualMode
    ? "New Order"
    : order?.codordentrabajo
      ? `Order ${order.codordentrabajo}`
      : "Order";

  const statusOptions = [
    {
      value: 1,
      label: "Assigned",
      buttonClassName: "bg-sky-100 ring-1 ring-sky-200",
      optionClassName: "bg-sky-50 text-sky-700 hover:bg-sky-100",
    },
    {
      value: 2,
      label: "Flagged",
      buttonClassName: "bg-rose-100 ring-1 ring-rose-200",
      optionClassName: "bg-rose-50 text-rose-700 hover:bg-rose-100",
    },
    {
      value: 3,
      label: "-100 Views",
      buttonClassName: "bg-violet-100 ring-1 ring-violet-200",
      optionClassName: "bg-violet-50 text-violet-700 hover:bg-violet-100",
    },
    {
      value: 4,
      label: "Posted",
      buttonClassName: "bg-emerald-100 ring-1 ring-emerald-200",
      optionClassName: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    },
    {
      value: 5,
      label: "Drafted",
      buttonClassName: "bg-amber-100 ring-1 ring-amber-200",
      optionClassName: "bg-amber-50 text-amber-700 hover:bg-amber-100",
    },
  ];

  const statusStyleMap = {
    "Under Review": "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
    1: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
    2: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
    3: "bg-violet-100 text-violet-700 ring-1 ring-violet-200",
    4: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
    5: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
    Assigned: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
    Flagged: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
    "-100 Views": "bg-violet-100 text-violet-700 ring-1 ring-violet-200",
    Posted: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
    Drafted: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
  };

  const getStatusPillClass = (value) =>
    statusStyleMap[value] ||
    "bg-slate-100 text-slate-700 ring-1 ring-slate-200";

  const getStatusOption = (value) => {
    const normalized = String(value ?? "")
      .trim()
      .toLowerCase();

    return statusOptions.find(
      (opt) =>
        String(opt.value) === String(value) ||
        opt.label.trim().toLowerCase() === normalized,
    );
  };

  const getStatusLabel = (value) => {
    return getStatusOption(value)?.label ?? String(value ?? "");
  };

  const normalizeStatusValue = (value) => {
    return getStatusOption(value)?.value ?? null;
  };

  const publisherOptions = catalog?.posteadores || [];

  const telephoneOptions =
    isEditing && !isManualMode
      ? editCatalog?.telefonos || []
      : catalog?.telefonos || [];

  const authorOptions =
    isEditing && !isManualMode
      ? editCatalog?.autoras || []
      : catalog?.autoras || [];

  const bookOptions =
    isEditing && !isManualMode
      ? editCatalog?.libros || []
      : catalog?.libros || [];

  const postTypeOptions =
    isEditing && !isManualMode
      ? editCatalog?.tiposPosteo || []
      : catalog?.tiposPosteo || [];

  const sceneOptions =
    isEditing && !isManualMode
      ? editCatalog?.escenas || []
      : catalog?.escenas || [];

  const currentTelephoneOptions = [
    ...(catalog?.telefonos || []),
    ...(editCatalog?.telefonos || []),
  ];

  const currentAuthorOptions = [
    ...(catalog?.autoras || []),
    ...(editCatalog?.autoras || []),
  ];

  const currentBookOptions = [
    ...(catalog?.libros || []),
    ...(editCatalog?.libros || []),
  ];

  const currentPostTypeOptions = [
    ...(catalog?.tiposPosteo || []),
    ...(editCatalog?.tiposPosteo || []),
  ];

  const currentSceneOptions = [
    ...(catalog?.escenas || []),
    ...(editCatalog?.escenas || []),
  ];

  const [newValues, setNewValues] = useState({
    newCodPosteador: null,
    newCodTelefono: null,

    newCodCuentaTiktok: "",
    newCodSonido: "",
    newDesScenaHook: "",
    newDesCaption: "",
    newDesTropo: "",
    newDesSlide1KeywordsHide: "",
    newDesSlide2KeywordsHide: "",
    newDesHashtag: "",
    newDesPalote: "",
    newCodImagenPrincipal: "",
    newCodImagenScreenshot: "",
    newCodImagenDialogo: "",
    newCodVideo: "",
    newDesInstrucciones: "",
    newFecPlanPosteo: "",
    newCodEstadoOrden: null,
    newCodAutora: null,
    newCodLibro: null,
    newCodTipoPosteo: null,
    newCodEscena: null,
    newDesDatoObligIncompleto: "",
    newDesLogErrorOrden: "",
  });

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

  const buildEditAutoPalote = (values) => {
    const codposteador = cleanText(values?.newCodPosteador);
    const codautora = cleanText(values?.newCodAutora);
    const codlibro = cleanText(values?.newCodLibro);
    const tippublicacion = cleanText(values?.newCodTipoPosteo);

    const codescenaLimpio = cleanSceneCodeForPalote({
      codescena: values?.newCodEscena,
      codlibro,
      tippublicacion,
    });

    const paloteValues = [
      codautora,
      codlibro,
      codescenaLimpio,
      tippublicacion,
      codposteador,
    ];

    if (paloteValues.some((value) => !cleanText(value))) {
      return "";
    }

    return paloteValues.join(" | ");
  };

  const setNewValuesWithAutoPalote = (updater) => {
    setNewValues((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;

      return {
        ...next,
        newDesPalote: buildEditAutoPalote(next),
      };
    });
  };

  const handleEditCodPosteador = (v) => {
    setNewValuesWithAutoPalote((prev) => ({
      ...prev,
      newCodPosteador: v,
      newCodTelefono: null,
      newCodAutora: null,
      newCodLibro: null,
      newCodTipoPosteo: null,
      newCodEscena: null,
    }));

    onEditSelectPublisher?.(v);
  };
  const handleEditCodTelefono = (v) => {
    setNewValuesWithAutoPalote((prev) => ({
      ...prev,
      newCodTelefono: v,
      newCodAutora: null,
      newCodLibro: null,
      newCodTipoPosteo: null,
      newCodEscena: null,
    }));

    onEditSelectTelephone?.(v);
  };

  const handleEditCodAutora = (v) => {
    setNewValuesWithAutoPalote((prev) => ({
      ...prev,
      newCodAutora: v,
      newCodLibro: null,
      newCodTipoPosteo: null,
      newCodEscena: null,
    }));

    onEditSelectAuthor?.(v);
  };

  const handleEditCodLibro = (v) => {
    setNewValuesWithAutoPalote((prev) => ({
      ...prev,
      newCodLibro: v,
      newCodTipoPosteo: null,
      newCodEscena: null,
    }));

    onEditSelectBook?.(v);
  };

  const handleEditCodTipoPosteo = (v) => {
    setNewValuesWithAutoPalote((prev) => ({
      ...prev,
      newCodTipoPosteo: v,
      newCodEscena: null,
    }));

    onEditSelectPostType?.(v);
  };

  const handleEditCodEscena = (v) => {
    setNewValuesWithAutoPalote((prev) => ({
      ...prev,
      newCodEscena: v,
    }));

    onEditSelectScene?.(v);
  };

  useEffect(() => {
    if (!isEditing) return;

    setNewValues({
      newCodPosteador: null,
      newCodTelefono: null,
      newCodCuentaTiktok: "",
      newCodSonido: "",
      newDesScenaHook: "",
      newDesCaption: "",
      newDesTropo: "",
      newDesSlide1KeywordsHide: "",
      newDesSlide2KeywordsHide: "",
      newDesHashtag: "",
      newDesPalote: "",
      newCodImagenPrincipal: "",
      newCodImagenScreenshot: "",
      newCodImagenDialogo: "",
      newCodVideo: "",
      newDesInstrucciones:
        draft?.desinstrucciones ?? order?.desinstrucciones ?? "",
      newFecPlanPosteo: "",
      newCodEstadoOrden: null,
      newCodAutora: null,
      newCodLibro: null,
      newCodTipoPosteo: null,
      newCodEscena: null,
      newDesDatoObligIncompleto:
        draft?.desdatoobligincompleto ?? order?.desdatoobligincompleto ?? "",
      newDesLogErrorOrden:
        draft?.deslogerrororden ?? order?.deslogerrororden ?? "",
    });
  }, [isEditing, order?.codordentrabajo]);

  const setNewValue = (key, value) => {
    setNewValues((prev) => {
      if (key === "newCodAutora") {
        return {
          ...prev,
          newCodAutora: value,
          newCodLibro: null,
          newCodEscena: null,
        };
      }

      if (key === "newCodLibro") {
        return {
          ...prev,
          newCodLibro: value,
          newCodEscena: null,
        };
      }

      return {
        ...prev,
        [key]: value,
      };
    });
  };

  const sanitizeOnlyIntegers = (value) =>
    String(value ?? "").replace(/\D/g, "");

  const inputClass = [
    "w-full min-w-0 rounded-md border px-3 py-2 text-sm",
    "border-slate-300 bg-white text-slate-800",
    "focus:outline-none focus:ring-2 focus:ring-slate-300",
  ].join(" ");

  const fields = useMemo(
    () => [
      { key: "codposteador", label: "Publisher (PA)" },
      { key: "codtelefono", label: "Telephone Code" },
      { key: "codautora", label: "Author Name" },
      { key: "codlibro", label: "Book Name" },
      { key: "tippublicacion", label: "Post Type" },
      { key: "codescena", label: "Scene Name" },

      { key: "codcuentatiktok", label: "TikTok Account", linkLike: true },
      {
        key: "nCodsonido",
        label: isManualMode ? "Sound Code" : "Sound URL",
        urlLike: true,
        multiline: true,
      },
      { key: "desscenahook", label: "Scene Hook", multiline: true },
      { key: "descaption", label: "Caption", multiline: true },
      { key: "destropo", label: "Trope", multiline: true },
      {
        key: "desslide1keywordshide",
        label: "Slide 1 Hidden Keywords",
        multiline: true,
      },
      {
        key: "desslide2keywordshide",
        label: "Slide 2 Hidden Keywords",
        multiline: true,
      },
      { key: "deshashtag", label: "Hashtags", multiline: true },
      { key: "despalote", label: "Full Stick" },

      {
        key: "nCodimagenprincipal",
        label: "Main Image URL",
        urlLike: true,
        multiline: true,
      },
      {
        key: "nCodimagenscreenshot",
        label: "Screenshot Image URL",
        urlLike: true,
        multiline: true,
      },
      {
        key: "nCodimagendialogo",
        label: "Dialog Image URL",
        urlLike: true,
        multiline: true,
      },
      { key: "nCodvideo", label: "Video URL", urlLike: true, multiline: true },

      { key: "desinstrucciones", label: "Instructions", multiline: true },
      { key: "fecplanposteo", label: "Planned Post Date" },
      { key: "codestadoorden", label: "Order Status" },
      { key: "tipregistroorden", label: "Record Type" },
      { key: "flgordencompleta", label: "Complete Order (Y/N)" },
      {
        key: "ctddatoobligincompleto",
        label: "Missing Required Data Count",
      },
      {
        key: "desdatoobligincompleto",
        label: "Missing Required Data Detail",
        multiline: true,
      },

      {
        key: "deslogerrororden",
        label: "Order Error Log",
        multiline: true,
      },

      { key: "codusuarioauditoriacreareg", label: "Created By" },
      { key: "codusuarioauditoriaactualizareg", label: "Updated By" },
      { key: "fecreacionregistro", label: "Creation Date" },
      { key: "horacreacionregistro", label: "Creation Time" },
      { key: "fecactualizacionregistro", label: "Updated Date" },
      { key: "horaactualizacionregistro", label: "Updated Time" },
    ],
    [isManualMode],
  );

  if (!open) return null;

  const isManualRequiredField = (fieldKey) => {
    if (!isManualMode) return false;

    const baseRequiredFields = {
      codposteador: true,
      codautora: true,
      codlibro: true,
      tippublicacion: true,
      codescena: true,
      codcuentatiktok: true,
      nCodsonido: true,
      desscenahook: true,
      despalote: true,
      fecplanposteo: true,
    };

    const dynamicImageVideoRequiredFields = {
      nCodimagenprincipal: !!requiredImageVideoFields?.codimagenprincipal,
      nCodimagenscreenshot: !!requiredImageVideoFields?.codimagenscreenshot,
      nCodimagendialogo: !!requiredImageVideoFields?.codimagendialogo,
      nCodvideo: !!requiredImageVideoFields?.codvideo,
    };

    return (
      !!baseRequiredFields[fieldKey] ||
      !!dynamicImageVideoRequiredFields[fieldKey]
    );
  };

  const renderFieldLabel = (field) => (
    <>
      {field.label}
      {isManualRequiredField(field.key) ? (
        <span className="ml-1 font-bold text-red-600">*</span>
      ) : null}
    </>
  );

  const getOptionValue = (opt) =>
    opt?.value ??
    opt?.codigo ??
    opt?.code ??
    opt?.id ??
    opt?.codposteador ??
    opt?.codtelefono ??
    opt?.codautora ??
    opt?.codlibro ??
    opt?.tippublicacion ??
    opt?.codtipoposteo ??
    opt?.codescena ??
    "";

  const getOptionLabel = (opt) =>
    opt?.label ??
    opt?.nombre ??
    opt?.descripcion ??
    opt?.desposteador ??
    opt?.destelefono ??
    opt?.nbrautora ??
    opt?.deslibro ??
    opt?.destipoposteo ??
    opt?.desscena ??
    getOptionValue(opt) ??
    "";

  const isHttpUrlText = (value) => {
    const text = String(value ?? "").trim();

    if (!text) return false;
    if (text.toLowerCase() === "null") return false;

    return text.startsWith("http://") || text.startsWith("https://");
  };

  const getSoundUrlDisplayValue = () => {
    const candidates = [
      order?.codsonido,
      order?.nCodsonido,
      order?.ncodsonido,
      order?.codSonido,
      order?.nCodSonido,
      order?.urlsonido,
      order?.soundUrl,
    ];

    const urlValue = candidates.find((value) => isHttpUrlText(value));

    return urlValue ?? "";
  };

  const getOrderDisplayFallback = (fieldKey) => {
    const fallbackMap = {
      codposteador:
        order?.nCodposteador ??
        order?.desposteador ??
        order?.publisherName ??
        order?.publisher ??
        order?.codposteador,

      codtelefono:
        order?.nCodtelefono ??
        order?.destelefono ??
        order?.telephoneName ??
        order?.telephone ??
        order?.codtelefono,

      codautora:
        order?.nCodautora ??
        order?.nbrautora ??
        order?.desautora ??
        order?.authorName ??
        order?.author ??
        order?.codautora,

      codlibro:
        order?.nCodlibro ??
        order?.deslibro ??
        order?.bookName ??
        order?.book ??
        order?.codlibro,

      tippublicacion:
        order?.nTippublicacion ??
        order?.nCodtippublicacion ??
        order?.nCodTippublicacion ??
        order?.nCodTipoPosteo ??
        order?.destipoposteo ??
        order?.despost ??
        order?.postTypeName ??
        order?.postType ??
        order?.tippublicacion ??
        order?.tipPublicacion ??
        order?.codtipoposteo ??
        order?.codTipoPosteo,
      codescena:
        order?.nCodescena ??
        order?.desscena ??
        order?.desescena ??
        order?.sceneName ??
        order?.scene ??
        order?.codescena,

      nCodsonido: getSoundUrlDisplayValue(),

      nCodimagenprincipal:
        order?.nCodimagenprincipal ??
        order?.codimagenprincipal ??
        order?.urlimagenprincipal ??
        order?.mainImageUrl,

      nCodimagenscreenshot:
        order?.nCodimagenscreenshot ??
        order?.codimagenscreenshot ??
        order?.urlimagenscreenshot ??
        order?.screenshotImageUrl,

      nCodimagendialogo:
        order?.nCodimagendialogo ??
        order?.codimagendialogo ??
        order?.urlimagendialogo ??
        order?.dialogImageUrl,

      nCodvideo:
        order?.nCodvideo ??
        order?.codvideo ??
        order?.urlvideo ??
        order?.videoUrl,
    };

    return fallbackMap[fieldKey];
  };

  const getDisplayValue = (fieldKey) => {
    if (!isManualMode && fieldKey === "nCodsonido") {
      return String(getSoundUrlDisplayValue() ?? "");
    }

    const rawValue = isManualMode
      ? (draft?.[fieldKey] ?? "")
      : (order?.[fieldKey] ?? "");

    const fallback = !isManualMode ? getOrderDisplayFallback(fieldKey) : null;

    const optionsMap = {
      codposteador: publisherOptions,
      codtelefono: currentTelephoneOptions,
      codautora: currentAuthorOptions,
      codlibro: currentBookOptions,
      tippublicacion: currentPostTypeOptions,
      codescena: currentSceneOptions,
    };

    const options = optionsMap[fieldKey];

    if (!options) {
      return String(fallback ?? rawValue ?? "");
    }

    const valueToMatch =
      rawValue !== null && rawValue !== undefined && rawValue !== ""
        ? rawValue
        : fallback;

    const match = options.find(
      (opt) => String(getOptionValue(opt)) === String(valueToMatch),
    );

    return String(match ? getOptionLabel(match) : (fallback ?? rawValue ?? ""));
  };

  const editHiddenFields = [
    "tipregistroorden",
    "flgordencompleta",
    "codusuarioauditoriacreareg",
    "codusuarioauditoriaactualizareg",
    "fecreacionregistro",
    "horacreacionregistro",
    "fecactualizacionregistro",
    "horaactualizacionregistro",
  ];

  const visibleFields = isManualMode
    ? fields.filter(
        (f) =>
          ![
            "codusuarioauditoriacreareg",
            "codusuarioauditoriaactualizareg",
            "fecreacionregistro",
            "horacreacionregistro",
            "fecactualizacionregistro",
            "horaactualizacionregistro",
            "desdatoobligincompleto",
            "ctddatoobligincompleto",
            "flgordencompleta",

            "codestadoorden",
            "tipregistroorden",
            "deslogerrororden",
          ].includes(f.key),
      )
    : isEditing
      ? fields.filter((f) => !editHiddenFields.includes(f.key))
      : fields;

  const manualFieldOrder = [
    "codposteador",
    "codtelefono",
    "codautora",
    "codlibro",
    "tippublicacion",
    "codescena",
  ];
  const orderedFields = isManualMode
    ? [
        ...visibleFields
          .filter((f) => manualFieldOrder.includes(f.key))
          .sort(
            (a, b) =>
              manualFieldOrder.indexOf(a.key) - manualFieldOrder.indexOf(b.key),
          ),
        ...visibleFields.filter((f) => !manualFieldOrder.includes(f.key)),
      ]
    : visibleFields;

  const handleRequestClose = () => {
    onClose?.();
  };

  const renderNewTextField = (label, key, disabled = false) => (
    <div className="contents">
      <div className="pl-5 pt-2 text-sm font-medium text-slate-500">
        {label}
      </div>
      <div className="w-full min-w-0 sm:max-w-[520px]">
        <input
          value={newValues[key] ?? ""}
          disabled={disabled}
          inputMode={key === "newCodSonido" ? "numeric" : undefined}
          pattern={key === "newCodSonido" ? "[0-9]*" : undefined}
          onChange={(e) =>
            setNewValue(
              key,
              key === "newCodSonido"
                ? sanitizeOnlyIntegers(e.target.value)
                : e.target.value,
            )
          }
          className={[
            inputClass,
            "w-full",
            disabled ? "opacity-60 cursor-not-allowed bg-slate-50" : "",
          ].join(" ")}
        />
      </div>
    </div>
  );

  const renderNewDateField = (label, key, disabled = false) => (
    <div className="contents">
      <div className="pl-5 pt-2 text-sm font-medium text-slate-500">
        {label}
      </div>
      <div className="w-full min-w-0 sm:max-w-[520px]">
        <input
          type="date"
          value={newValues[key] ?? ""}
          disabled={disabled}
          onChange={(e) => setNewValue(key, e.target.value)}
          className={[
            inputClass,
            "w-full",
            disabled ? "opacity-60 cursor-not-allowed bg-slate-50" : "",
          ].join(" ")}
        />
      </div>
    </div>
  );

  const renderNewTextareaField = (label, key, disabled = false) => (
    <div className="contents">
      <div className="pl-5 pt-2 text-sm font-medium text-slate-500">
        {label}
      </div>
      <div className="w-full min-w-0 sm:max-w-[520px]">
        <textarea
          value={newValues[key] ?? ""}
          disabled={disabled}
          onChange={(e) => setNewValue(key, e.target.value)}
          rows={4}
          className={[
            inputClass,
            "w-full min-h-[96px] resize-none overflow-hidden whitespace-pre-wrap break-words",
            disabled ? "opacity-60 cursor-not-allowed bg-slate-50" : "",
          ].join(" ")}
        />
      </div>
    </div>
  );

  const renderNewSelectField = (
    label,
    key,
    options,
    placeholder,
    disabled = false,
  ) => (
    <div className="contents">
      <div className="pl-5 pt-2 text-sm font-medium text-slate-500">
        {label}
      </div>
      <div className="w-full min-w-0 sm:max-w-[520px] sm:-mt-1.5">
        <SelectField
          value={newValues[key]}
          options={options}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(v) => setNewValue(key, v)}
        />
      </div>
    </div>
  );

  const renderEditCascadeSelectField = (
    label,
    value,
    options,
    placeholder,
    onChangeHandler,
    disabled = false,
  ) => (
    <div className="contents">
      <div className="pl-5 pt-2 text-sm font-medium text-slate-500">
        {label}
      </div>
      <div className="w-full min-w-0 sm:max-w-[520px] sm:-mt-1.5">
        <SelectField
          value={value}
          options={options}
          placeholder={placeholder}
          disabled={disabled}
          onChange={onChangeHandler}
        />
      </div>
    </div>
  );

  const renderManualTextField = (key) => {
    const isSoundCodeField = key === "codsonido" || key === "nCodsonido";

    const isImageVideoUrlField = [
      "nCodimagenprincipal",
      "nCodimagenscreenshot",
      "nCodimagendialogo",
      "nCodvideo",
    ].includes(key);

    const sanitizeUrlValue = (value) => {
      const text = String(value ?? "").trim();

      if (!text) return "";

      if (text.startsWith("http://") || text.startsWith("https://")) {
        return text;
      }

      return text;
    };

    return (
      <div className="w-full min-w-0 sm:max-w-[520px]">
        <input
          value={draft?.[key] ?? ""}
          type={isImageVideoUrlField ? "url" : "text"}
          inputMode={isSoundCodeField ? "numeric" : "url"}
          pattern={
            isSoundCodeField
              ? "[0-9]*"
              : isImageVideoUrlField
                ? "https?://.+"
                : undefined
          }
          placeholder={isImageVideoUrlField ? "https://..." : undefined}
          onChange={(e) =>
            onChange(
              key,
              isSoundCodeField
                ? sanitizeOnlyIntegers(e.target.value)
                : isImageVideoUrlField
                  ? sanitizeUrlValue(e.target.value)
                  : e.target.value,
            )
          }
          className={inputClass}
        />
      </div>
    );
  };

  const renderManualDateField = (key) => (
    <div className="w-full min-w-0 sm:max-w-[520px]">
      <input
        type="date"
        value={draft?.[key] ?? ""}
        onChange={(e) => onChange(key, e.target.value)}
        className={inputClass}
      />
    </div>
  );

  const renderManualSelectByField = (fieldKey) => {
    if (fieldKey === "codposteador") {
      return (
        <div className="w-full min-w-0 sm:max-w-[520px] sm:-mt-1.5">
          <SelectField
            value={draft?.codposteador ?? null}
            options={publisherOptions}
            placeholder="— Select a publisher —"
            onChange={onManualSelectPublisher}
          />
        </div>
      );
    }

    if (fieldKey === "codtelefono") {
      return (
        <div className="w-full min-w-0 sm:max-w-[520px] sm:-mt-1.5">
          <SelectField
            value={draft?.codtelefono ?? null}
            options={telephoneOptions}
            disabled={!draft?.codposteador}
            placeholder={
              !draft?.codposteador
                ? "— Select a publisher first —"
                : "— Optional —"
            }
            onChange={onManualSelectTelephone}
          />
        </div>
      );
    }

    if (fieldKey === "codautora") {
      return (
        <div className="w-full min-w-0 sm:max-w-[520px] sm:-mt-1.5">
          <SelectField
            value={draft?.codautora ?? null}
            options={authorOptions}
            disabled={!draft?.codposteador}
            placeholder={
              !draft?.codposteador
                ? "— Select a publisher first —"
                : "— Select an author —"
            }
            onChange={onManualSelectAuthor}
          />
        </div>
      );
    }

    if (fieldKey === "codlibro") {
      return (
        <div className="w-full min-w-0 sm:max-w-[520px] sm:-mt-1.5">
          <SelectField
            value={draft?.codlibro ?? null}
            options={bookOptions}
            disabled={!draft?.codautora}
            placeholder={
              !draft?.codautora
                ? "— Select an author first —"
                : "— Select a book —"
            }
            onChange={onManualSelectBook}
          />
        </div>
      );
    }

    if (fieldKey === "tippublicacion") {
      return (
        <div className="w-full min-w-0 sm:max-w-[520px] sm:-mt-1.5">
          <SelectField
            value={draft?.tippublicacion ?? null}
            options={postTypeOptions}
            disabled={!draft?.codlibro}
            placeholder={
              !draft?.codlibro
                ? "— Select a book first —"
                : "— Select a post type —"
            }
            onChange={onManualSelectPostType}
          />
        </div>
      );
    }

    if (fieldKey === "codescena") {
      return (
        <div className="w-full min-w-0 sm:max-w-[520px] sm:-mt-1.5">
          <SelectField
            value={draft?.codescena ?? null}
            options={sceneOptions}
            disabled={!draft?.codlibro || !draft?.tippublicacion}
            placeholder={
              !draft?.codlibro || !draft?.tippublicacion
                ? "— Select book and post type first —"
                : "— Select a scene —"
            }
            onChange={onManualSelectScene}
          />
        </div>
      );
    }

    return null;
  };

  const renderStatusView = (value) => {
    const label = getStatusLabel(value);

    return (
      <div className="w-full min-w-0 sm:max-w-[520px]">
        <div
          className={[inputClass, "flex min-h-[42px] items-center"].join(" ")}
        >
          {value !== null && value !== undefined && value !== "" ? (
            <span
              className={[
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                getStatusPillClass(value),
              ].join(" ")}
            >
              {label}
            </span>
          ) : (
            <span className="text-sm text-slate-400">—</span>
          )}
        </div>
      </div>
    );
  };

  const shouldHideReadOnlyValue = (fieldKey) =>
    isEditing &&
    !isManualMode &&
    ["desinstrucciones", "desdatoobligincompleto", "deslogerrororden"].includes(
      fieldKey,
    );

  const renderStatusEdit = (label, key) => {
    const selectedStatusOption = getStatusOption(newValues[key]);

    return (
      <div className="contents">
        <div className="pl-5 pt-1 text-sm font-medium text-slate-500">
          {label}
        </div>

        <div className="w-full min-w-0 sm:max-w-[520px] sm:-mt-1.5">
          <SelectField
            value={newValues[key]}
            options={statusOptions}
            placeholder="— Select a status —"
            onChange={(v) => setNewValue(key, v)}
            selectedDisplayClassName="font-semibold text-slate-900"
            selectedButtonClassName={
              selectedStatusOption?.buttonClassName ?? ""
            }
            placeholderClassName="text-slate-900"
            getOptionClassName={(opt, isSelected) =>
              [
                "font-medium",
                opt.optionClassName,
                isSelected ? "ring-1 ring-slate-300" : "",
              ].join(" ")
            }
          />
        </div>
      </div>
    );
  };

  const isValidUrlValue = (value) => {
    const text = String(value ?? "").trim();

    if (!text) return false;
    if (text.toLowerCase() === "null") return false;

    try {
      const url = new URL(text);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/20"
        onClick={handleRequestClose}
        aria-hidden="true"
      />

      <div className="absolute inset-x-2 top-3 sm:left-1/2 sm:top-8 sm:w-[min(900px,94vw)] sm:-translate-x-1/2 sm:px-2">
        {" "}
        <div className="max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-xl sm:max-h-none">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">▾</span>
              <div className="text-sm font-semibold text-slate-700">
                {title}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm ring-1 ring-slate-900/10 transition hover:bg-slate-800 active:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Edit
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSave(newValues)}
                  className="rounded-md border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Save
                </button>
              )}

              <button
                type="button"
                onClick={handleRequestClose}
                className="rounded-md px-2 py-1.5 text-slate-500 hover:bg-slate-200/70"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200" />

          <div className="max-h-[calc(100dvh-5.5rem)] overflow-y-auto px-3 py-4 sm:max-h-[72vh] sm:px-7 sm:py-7">
            <div className={isEditing ? "space-y-7" : "space-y-4"}>
              {orderedFields.map((f, idx) => {
                const val = getDisplayValue(f.key);
                const hideReadOnlyValue = shouldHideReadOnlyValue(f.key);
                const hasValidUrl = f.urlLike && isValidUrlValue(val);

                return (
                  <div
                    key={f.key}
                    className="grid grid-cols-1 items-start gap-y-2 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-x-5"
                  >
                    {!hideReadOnlyValue ? (
                      <div className="pt-1 text-sm font-medium text-slate-700 sm:pl-3 sm:pt-2">
                        <span className="mr-2 text-slate-500">{idx + 1}.</span>
                        {renderFieldLabel(f)}
                      </div>
                    ) : (
                      <div className="pt-1 text-sm font-medium text-slate-700 sm:pl-3 sm:pt-2">
                        <span className="mr-2 text-slate-500">{idx + 1}.</span>
                        {renderFieldLabel(f)}
                      </div>
                    )}

                    {isManualMode ? (
                      [
                        "codposteador",
                        "codtelefono",
                        "codautora",
                        "codlibro",
                        "tippublicacion",
                        "codescena",
                      ].includes(f.key) ? (
                        renderManualSelectByField(f.key)
                      ) : f.key === "fecplanposteo" ? (
                        renderManualDateField(f.key)
                      ) : (
                        renderManualTextField(f.key)
                      )
                    ) : hideReadOnlyValue ? null : f.key ===
                      "codestadoorden" ? (
                      renderStatusView(val)
                    ) : (
                      <div className="w-full min-w-0 sm:max-w-[520px]">
                        {f.urlLike && f.multiline ? (
                          hasValidUrl ? (
                            <a
                              href={String(val).trim()}
                              target="_blank"
                              rel="noreferrer"
                              className={[
                                inputClass,
                                "block w-full min-h-[35px] select-text whitespace-pre-wrap break-all underline font-semibold text-sky-700 hover:text-sky-800",
                              ].join(" ")}
                              title={val}
                            >
                              {val}
                            </a>
                          ) : (
                            <div
                              className={[
                                inputClass,
                                "min-h-[35px] select-text whitespace-pre-wrap break-words opacity-95",
                              ].join(" ")}
                              title=""
                            >
                              {""}
                            </div>
                          )
                        ) : f.multiline ? (
                          <div
                            className={[
                              inputClass,
                              "min-h-[35px] select-text whitespace-pre-wrap break-words opacity-95",
                            ].join(" ")}
                            title={val}
                          >
                            {val}
                          </div>
                        ) : (
                          <input
                            value={val}
                            readOnly
                            onChange={(e) => onChange(f.key, e.target.value)}
                            className={[
                              inputClass,
                              "w-full cursor-text select-text",
                              !isEditing ? "opacity-95" : "",
                              f.linkLike && !isEditing
                                ? "text-sky-700 underline"
                                : "",
                            ].join(" ")}
                          />
                        )}
                      </div>
                    )}

                    {isEditing && !isManualMode && f.key === "codposteador"
                      ? renderEditCascadeSelectField(
                          "New Publisher (PA)",
                          newValues.newCodPosteador,
                          publisherOptions,
                          "— Select a publisher —",
                          handleEditCodPosteador,
                        )
                      : null}

                    {isEditing && !isManualMode && f.key === "codtelefono"
                      ? renderEditCascadeSelectField(
                          "New Telephone Code",
                          newValues.newCodTelefono,
                          telephoneOptions,
                          !(
                            newValues.newCodPosteador ||
                            editFilters?.codposteador
                          )
                            ? "— Select a publisher first —"
                            : "— Optional —",
                          handleEditCodTelefono,
                          !(
                            newValues.newCodPosteador ||
                            editFilters?.codposteador
                          ),
                        )
                      : null}

                    {isEditing && !isManualMode && f.key === "codcuentatiktok"
                      ? renderNewTextField(
                          "New TikTok Account",
                          "newCodCuentaTiktok",
                        )
                      : null}

                    {isEditing && !isManualMode && f.key === "nCodsonido"
                      ? renderNewTextField("New Sound Code", "newCodSonido")
                      : null}

                    {isEditing && !isManualMode && f.key === "desscenahook"
                      ? renderNewTextareaField(
                          "New Scene Hook",
                          "newDesScenaHook",
                        )
                      : null}

                    {isEditing && !isManualMode && f.key === "descaption"
                      ? renderNewTextareaField("New Caption", "newDesCaption")
                      : null}

                    {isEditing && !isManualMode && f.key === "destropo"
                      ? renderNewTextareaField("New Trope", "newDesTropo")
                      : null}

                    {isEditing &&
                    !isManualMode &&
                    f.key === "desslide1keywordshide"
                      ? renderNewTextareaField(
                          "New Slide 1 Keywords Hide",
                          "newDesSlide1KeywordsHide",
                        )
                      : null}

                    {isEditing &&
                    !isManualMode &&
                    f.key === "desslide2keywordshide"
                      ? renderNewTextareaField(
                          "New Slide 2 Keywords Hide",
                          "newDesSlide2KeywordsHide",
                        )
                      : null}

                    {isEditing && !isManualMode && f.key === "deshashtag"
                      ? renderNewTextareaField("New Hashtags", "newDesHashtag")
                      : null}

                    {isEditing && !isManualMode && f.key === "despalote"
                      ? renderNewTextField(
                          "New Full Stick",
                          "newDesPalote",
                          true,
                        )
                      : null}

                    {isEditing &&
                    !isManualMode &&
                    f.key === "nCodimagenprincipal"
                      ? renderNewTextareaField(
                          "New Main Image URL",
                          "newCodImagenPrincipal",
                        )
                      : null}

                    {isEditing &&
                    !isManualMode &&
                    f.key === "nCodimagenscreenshot"
                      ? renderNewTextareaField(
                          "New Screenshot Image URL",
                          "newCodImagenScreenshot",
                        )
                      : null}

                    {isEditing && !isManualMode && f.key === "nCodimagendialogo"
                      ? renderNewTextareaField(
                          "New Dialog Image URL",
                          "newCodImagenDialogo",
                        )
                      : null}

                    {isEditing && !isManualMode && f.key === "nCodvideo"
                      ? renderNewTextareaField("New Video URL", "newCodVideo")
                      : null}
                    {isEditing &&
                    !isManualMode &&
                    f.key === "desinstrucciones" ? (
                      <div className="w-full min-w-0 sm:max-w-[520px]">
                        <textarea
                          value={newValues.newDesInstrucciones ?? ""}
                          onChange={(e) =>
                            setNewValue("newDesInstrucciones", e.target.value)
                          }
                          rows={4}
                          className={[
                            inputClass,
                            "w-full min-h-[96px] resize-none overflow-hidden whitespace-pre-wrap break-words",
                          ].join(" ")}
                        />
                      </div>
                    ) : null}

                    {isEditing && !isManualMode && f.key === "fecplanposteo"
                      ? renderNewDateField(
                          "New Planned Post Date",
                          "newFecPlanPosteo",
                        )
                      : null}

                    {isEditing && !isManualMode && f.key === "codestadoorden"
                      ? renderStatusEdit(
                          "New Order Status",
                          "newCodEstadoOrden",
                        )
                      : null}

                    {isEditing && !isManualMode && f.key === "codautora"
                      ? renderEditCascadeSelectField(
                          "New Author Name",
                          newValues.newCodAutora,
                          authorOptions,
                          !(
                            newValues.newCodPosteador ||
                            editFilters?.codposteador
                          )
                            ? "— Select a publisher first —"
                            : "— Select an author —",
                          handleEditCodAutora,
                          !(
                            newValues.newCodPosteador ||
                            editFilters?.codposteador
                          ),
                        )
                      : null}

                    {isEditing && !isManualMode && f.key === "codlibro"
                      ? renderEditCascadeSelectField(
                          "New Book Name",
                          newValues.newCodLibro,
                          bookOptions,
                          !(newValues.newCodAutora || editFilters?.codautora)
                            ? "— Select an author first —"
                            : "— Select a book —",
                          handleEditCodLibro,
                          !(newValues.newCodAutora || editFilters?.codautora),
                        )
                      : null}

                    {isEditing && !isManualMode && f.key === "tippublicacion"
                      ? renderEditCascadeSelectField(
                          "New Post Type",
                          newValues.newCodTipoPosteo,
                          postTypeOptions,
                          !(newValues.newCodLibro || editFilters?.codlibro)
                            ? "— Select a book first —"
                            : "— Select a post type —",
                          handleEditCodTipoPosteo,
                          !(newValues.newCodLibro || editFilters?.codlibro),
                        )
                      : null}

                    {isEditing && !isManualMode && f.key === "codescena"
                      ? renderEditCascadeSelectField(
                          "New Scene Name",
                          newValues.newCodEscena,
                          sceneOptions,
                          !(
                            (newValues.newCodLibro || editFilters?.codlibro) &&
                            (newValues.newCodTipoPosteo ||
                              editFilters?.tippublicacion)
                          )
                            ? "— Select book and post type first —"
                            : "— Select a scene —",
                          handleEditCodEscena,
                          !(
                            (newValues.newCodLibro || editFilters?.codlibro) &&
                            (newValues.newCodTipoPosteo ||
                              editFilters?.tippublicacion)
                          ),
                        )
                      : null}

                    {isEditing &&
                    !isManualMode &&
                    f.key === "desdatoobligincompleto" ? (
                      <div className="w-full min-w-0 sm:max-w-[520px]">
                        <textarea
                          value={newValues.newDesDatoObligIncompleto ?? ""}
                          disabled
                          rows={4}
                          className={[
                            inputClass,
                            "w-full min-h-[96px] resize-none overflow-hidden whitespace-pre-wrap break-words opacity-60 cursor-not-allowed bg-slate-50",
                          ].join(" ")}
                        />
                      </div>
                    ) : null}

                    {isEditing &&
                    !isManualMode &&
                    f.key === "deslogerrororden" ? (
                      <div className="w-full min-w-0 sm:max-w-[520px]">
                        <textarea
                          value={newValues.newDesLogErrorOrden ?? ""}
                          disabled
                          rows={4}
                          className={[
                            inputClass,
                            "w-full min-h-[96px] resize-none overflow-hidden whitespace-pre-wrap break-words opacity-60 cursor-not-allowed bg-slate-50",
                          ].join(" ")}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="h-3" />
        </div>
      </div>
    </div>
  );
}
