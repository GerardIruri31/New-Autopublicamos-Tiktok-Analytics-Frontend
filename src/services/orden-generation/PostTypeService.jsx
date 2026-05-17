import PostTypeResponse from "../../interfaces/orden-generation/PostTypeResponse";

export async function getPostTypeFiltersService({ token, codlibro }) {
  const azureURL = import.meta.env.VITE_AZURE_API_URL;
  if (!azureURL) throw new Error("VITE_AZURE_API_URL no está definido");
  if (!token) throw new Error("No JWT available");
  if (!codlibro) return [];

  const url = new URL(azureURL + "/orden/filter/postType");
  url.searchParams.append("codlibro", codlibro);

  const resp = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    mode: "cors",
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Error ${resp.status} al obtener tipos de posteo: ${text || resp.statusText}`,
    );
  }

  const data = await resp.json();
  return PostTypeResponse.toOptionList(data);
}
