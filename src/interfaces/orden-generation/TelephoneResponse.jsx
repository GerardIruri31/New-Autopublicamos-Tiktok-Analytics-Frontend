const TelephoneResponse = {
  toOptionList: (data) => {
    if (!Array.isArray(data)) return [];

    return data.map((item) => {
      const codtelefono = item?.codtelefono ?? null;
      const tiptelefono = item?.tiptelefono ?? null;

      return {
        value: codtelefono,
        label:
          codtelefono && tiptelefono
            ? `${codtelefono} - ${tiptelefono}`
            : codtelefono || tiptelefono || "",
        tiptelefono,
      };
    });
  },
};

export default TelephoneResponse;
