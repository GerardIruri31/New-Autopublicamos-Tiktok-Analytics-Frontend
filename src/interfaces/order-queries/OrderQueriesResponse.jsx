const OrderQueriesResponse = {
  codordentrabajo: null,
  codcabeceraordentrabajo: null,
  codautora: null,
  codlibro: null,
  nCodlibro: null,

  tippublicacion: null,
  nTippublicacion: null,
  codescena: null,
  nCodescena: null,
  codposteador: null,
  codtelefono: null,
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
  tipregistroorden: null,
  flgordencompleta: null,
  ctddatoobligincompleto: null,
  desdatoobligincompleto: null,
  deslogerrororden: null,
  codusuarioauditoriacreareg: null,
  codusuarioauditoriaactualizareg: null,
  fecreacionregistro: null,
  horacreacionregistro: null,
  fecactualizacionregistro: null,
  horaactualizacionregistro: null,
};

export function mapOrderQueriesResponseItem(item = {}) {
  const tippublicacion =
    item.tippublicacion ??
    item.tipPublicacion ??
    item.codtipoposteo ??
    item.codTipoPosteo ??
    item.nCodtippublicacion ??
    item.nCodTippublicacion ??
    item.nCodTipoPosteo ??
    null;
  const nTippublicacion =
    item.nTippublicacion ??
    item.nCodtippublicacion ??
    item.nCodTippublicacion ??
    item.nCodTipoPosteo ??
    item.destipoposteo ??
    item.despost ??
    item.postTypeName ??
    item.postType ??
    null;

  return {
    ...OrderQueriesResponse,

    // IMPORTANTE:
    // Esto evita que se pierdan campos extras que manda el backend,
    // como nCodautora, nCodlibro, nTippublicacion, despost, etc.
    ...item,

    codordentrabajo: item.codordentrabajo ?? null,
    codcabeceraordentrabajo: item.codcabeceraordentrabajo ?? null,

    codautora: item.codautora ?? null,
    codlibro: item.codlibro ?? null,
    nCodlibro: item.nCodlibro ?? item.nCodLibro ?? item.deslibro ?? null,

    // FIX PRINCIPAL
    tippublicacion,
    nTippublicacion,

    codescena: item.codescena ?? null,
    nCodescena: item.nCodescena ?? item.nCodEscena ?? item.desscena ?? null,
    codposteador: item.codposteador ?? null,
    codtelefono: item.codtelefono ?? null,
    codcuentatiktok: item.codcuentatiktok ?? null,
    codsonido: item.codsonido ?? null,

    desscenahook: item.desscenahook ?? null,
    descaption: item.descaption ?? null,
    destropo: item.destropo ?? null,
    desslide1keywordshide: item.desslide1keywordshide ?? null,
    desslide2keywordshide: item.desslide2keywordshide ?? null,
    deshashtag: item.deshashtag ?? null,
    despalote: item.despalote ?? null,

    codimagenprincipal: item.codimagenprincipal ?? null,
    codimagenscreenshot: item.codimagenscreenshot ?? null,
    codimagendialogo: item.codimagendialogo ?? null,
    codvideo: item.codvideo ?? null,

    desinstrucciones: item.desinstrucciones ?? null,
    fecplanposteo: item.fecplanposteo ?? null,
    codestadoorden: item.codestadoorden ?? null,
    tipregistroorden: item.tipregistroorden ?? null,
    flgordencompleta: item.flgordencompleta ?? null,
    ctddatoobligincompleto: item.ctddatoobligincompleto ?? null,
    desdatoobligincompleto: item.desdatoobligincompleto ?? null,
    deslogerrororden: item.deslogerrororden ?? null,

    codusuarioauditoriacreareg: item.codusuarioauditoriacreareg ?? null,
    codusuarioauditoriaactualizareg:
      item.codusuarioauditoriaactualizareg ?? null,
    fecreacionregistro: item.fecreacionregistro ?? null,
    horacreacionregistro: item.horacreacionregistro ?? null,
    fecactualizacionregistro: item.fecactualizacionregistro ?? null,
    horaactualizacionregistro: item.horaactualizacionregistro ?? null,
  };
}

export default OrderQueriesResponse;
