import TelephoneResponse from "../../interfaces/orden-generation/TelephoneResponse";

export async function getTelephoneFiltersService({ token, PaCode }) {
  const azureURL = import.meta.env.VITE_AZURE_API_URL;
  if (!azureURL) throw new Error("VITE_AZURE_API_URL no está definido");
  if (!token) throw new Error("No JWT available");
  if (!PaCode) return [];

  const url = new URL(azureURL + "/orden/filter/telephone");
  url.searchParams.append("PaCode", PaCode);

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
      `Error ${resp.status} al obtener teléfonos: ${text || resp.statusText}`,
    );
  }

  const data = await resp.json();
  return TelephoneResponse.toOptionList(data);
}
