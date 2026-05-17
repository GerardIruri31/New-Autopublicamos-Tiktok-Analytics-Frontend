const CreatedByResponse = {
  codusuarioauditoriacreareg: null,
  nbrusuarioauditoriacreareg: null,
};

export function mapCreatedByResponseItem(item = {}) {
  return {
    ...CreatedByResponse,
    codusuarioauditoriacreareg: item.codusuarioauditoriacreareg ?? null,
    nbrusuarioauditoriacreareg: item.nbrusuarioauditoriacreareg ?? null,
  };
}

CreatedByResponse.toOptionList = function toOptionList(data) {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => mapCreatedByResponseItem(item))
    .filter(
      (item) =>
        item.codusuarioauditoriacreareg !== null &&
        item.codusuarioauditoriacreareg !== undefined &&
        item.codusuarioauditoriacreareg !== "",
    )
    .map((item) => ({
      value: item.codusuarioauditoriacreareg,
      label:
        item.nbrusuarioauditoriacreareg?.trim() ||
        item.codusuarioauditoriacreareg,
    }));
};

export default CreatedByResponse;
