const PaResponseDTO = {
  toOptionList: (data) => {
    if (!Array.isArray(data)) return [];

    return data.map((item) => ({
      value: item?.codposteador ?? null,
      label: item?.nbrposteador ?? null,
      pa_correo: item?.pa_correo ?? null,
    }));
  },
};

export default PaResponseDTO;
