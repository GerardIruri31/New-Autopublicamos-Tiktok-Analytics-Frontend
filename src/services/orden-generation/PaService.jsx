import PaResponse from "../../interfaces/orden-generation/PaResponse";

export async function getPaFiltersService({ token }) {
  const azureURL = import.meta.env.VITE_AZURE_API_URL;
  if (!azureURL) throw new Error("VITE_AZURE_API_URL no está definido");
  if (!token) throw new Error("No JWT available");

  const resp = await fetch(azureURL + "/orden/filter/pa", {
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
      `Error ${resp.status} al obtener posteadores: ${text || resp.statusText}`,
    );
  }
  const data = await resp.json();
  return PaResponse.toOptionList(data);
}
