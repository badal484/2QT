import { api } from "../lib/api";

export async function uploadToImageKit(file: File, folder = "uploads"): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("folder", folder);
  const res = await api.request("/riders/upload", { method: "POST", body: formData });
  if (!res.url) throw new Error("No URL returned from upload");
  return { url: res.url };
}
