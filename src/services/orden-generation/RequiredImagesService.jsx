export const getRequiredImagesPerTipPublicacionService = async ({ token }) => {
  const baseUrl = import.meta.env.VITE_AZURE_API_URL;

  const response = await fetch(`${baseUrl}/orden/filter/required_images`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const message = await response.text();

    throw new Error(
      message || "Error loading required images/videos per post type.",
    );
  }

  return response.json();
};
