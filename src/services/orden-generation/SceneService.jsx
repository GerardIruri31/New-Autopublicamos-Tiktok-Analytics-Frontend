import SceneResponse from "../../interfaces/orden-generation/SceneResponse";

export async function getSceneFiltersService({
  token,
  codlibro,
  tippublicacion,
}) {
  const azureURL = import.meta.env.VITE_AZURE_API_URL;
  if (!azureURL) throw new Error("VITE_AZURE_API_URL no está definido");
  if (!token) throw new Error("No JWT available");
  if (!codlibro || !tippublicacion) return [];

  const url = new URL(azureURL + "/orden/filter/scene");
  url.searchParams.append("codlibro", codlibro);
  url.searchParams.append("tippublicacion", tippublicacion);

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
      `Error ${resp.status} al obtener escenas: ${text || resp.statusText}`,
    );
  }

  const data = await resp.json();
  return SceneResponse.toOptionList(data);
}
