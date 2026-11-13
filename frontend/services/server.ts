import "server-only";
import type { HomeData, Homepage, Product, Paged, GalleryImage, Promotion, Review } from "@/lib/types";

// Server-side (Next.js server -> Web API over the private network). Never used in the browser.
const API = process.env.API_INTERNAL_URL ?? "http://localhost:5000";

export async function serverGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`API ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export async function getPublicSettings(): Promise<Record<string, string>> {
  try {
    return await serverGet<Record<string, string>>("/api/settings/public");
  } catch {
    return {};
  }
}

export async function getHomeData(): Promise<HomeData> {
  const [homepage, pages, featured, signature, gallery, promotions, reviews] = await Promise.all([
    serverGet<Homepage>("/api/content/homepage"),
    serverGet<Record<string, string>>("/api/content/pages"),
    serverGet<Paged<Product>>("/api/products?featured=true&pageSize=8"),
    serverGet<Paged<Product>>("/api/products?signature=true&pageSize=8"),
    serverGet<GalleryImage[]>("/api/gallery"),
    serverGet<Promotion[]>("/api/promotions"),
    serverGet<Review[]>("/api/reviews"),
  ]);
  return { homepage, pages, featured: featured.items, signature: signature.items, gallery, promotions, reviews };
}
