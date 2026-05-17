import AuthorResponse from "../../interfaces/orden-generation/AuthorResponse";

export async function getAuthorFiltersService({
  token,
  codposteador,
  codtelefono,
  tiptelefono,
}) {
  const azureURL = import.meta.env.VITE_AZURE_API_URL;
  if (!azureURL) throw new Error("VITE_AZURE_API_URL no está definido");
  if (!token) throw new Error("No JWT available");
  if (!codposteador) return [];

  const url = new URL(azureURL + "/orden/filter/author");

  url.searchParams.append("codposteador", codposteador);

  if (codtelefono) {
    url.searchParams.append("codtelefono", codtelefono);
  }

  if (tiptelefono) {
    url.searchParams.append("tiptelefono", tiptelefono);
  }

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
      `Error ${resp.status} al obtener autoras: ${text || resp.statusText}`,
    );
  }

  const data = await resp.json();
  return AuthorResponse.fromApiList(data);
}
