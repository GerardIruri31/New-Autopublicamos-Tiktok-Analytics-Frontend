export async function getUserRoleService({ token, email }) {
  const azureURL = import.meta.env.VITE_AZURE_API_URL;

  if (!azureURL) throw new Error("VITE_AZURE_API_URL no está definido");
  if (!token) throw new Error("No JWT available");
  if (!email) throw new Error("Email is required");

  const normalizedEmail = String(email).toLowerCase();

  const resp = await fetch(
    `${azureURL}/user/role?email=${encodeURIComponent(normalizedEmail)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      mode: "cors",
    },
  );

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Failed /user/role: ${resp.status} ${text || resp.statusText}`,
    );
  }

  const data = await resp.text();
  return String(data || "").trim();
}
