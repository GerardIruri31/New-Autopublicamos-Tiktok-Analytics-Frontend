const SceneResponse = {
  toOptionList: (data) => {
    if (!Array.isArray(data)) return [];

    return data.map((item) => ({
      value: item?.codescena ?? null,
      label: item?.desscena ?? null,
    }));
  },
};

export default SceneResponse;
