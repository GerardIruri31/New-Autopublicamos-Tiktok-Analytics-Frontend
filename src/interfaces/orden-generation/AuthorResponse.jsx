const AuthorResponse = {
  fromApiList: (data) => {
    if (!Array.isArray(data)) return [];

    return data.map((item) => ({
      codlibro: item?.codlibro ?? null,
      deslibro: item?.deslibro ?? null,
      codautora: item?.codautora ?? null,
      nbrautora: item?.nbrautora ?? null,
    }));
  },

  toAuthorOptionList: (data) => {
    if (!Array.isArray(data)) return [];

    const uniqueMap = new Map();

    data.forEach((item) => {
      const codautora = item?.codautora ?? null;
      const nbrautora = item?.nbrautora ?? null;

      if (!codautora) return;
      if (!uniqueMap.has(codautora)) {
        uniqueMap.set(codautora, {
          value: codautora,
          label: nbrautora,
        });
      }
    });

    return Array.from(uniqueMap.values());
  },

  toBookOptionListByAuthor: (data, codAutora) => {
    if (!Array.isArray(data) || !codAutora) return [];

    const uniqueMap = new Map();

    data.forEach((item) => {
      if (item?.codautora !== codAutora) return;

      const codlibro = item?.codlibro ?? null;
      const deslibro = item?.deslibro ?? null;

      if (!codlibro) return;
      if (!uniqueMap.has(codlibro)) {
        uniqueMap.set(codlibro, {
          value: codlibro,
          label: deslibro,
        });
      }
    });

    return Array.from(uniqueMap.values());
  },
};

export default AuthorResponse;
