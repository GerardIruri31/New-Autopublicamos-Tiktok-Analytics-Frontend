const PostTypeResponse = {
  toOptionList: (data) => {
    if (!Array.isArray(data)) return [];

    return data.map((item) => ({
      value: item?.tippublicacion ?? null,
      label: item?.despost ?? null,
    }));
  },
};

export default PostTypeResponse;
