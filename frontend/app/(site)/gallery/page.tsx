import type { Metadata } from "next";
import { serverGet } from "@/services/server";
import { GalleryGrid, SectionHeading } from "@/components/site/home-sections";
import { EmptyState, ErrorState } from "@/components/ui/misc";
import type { GalleryImage } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gallery" };

export default async function GalleryPage() {
  try {
    const images = await serverGet<GalleryImage[]>("/api/gallery");
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeading eyebrow="Gallery" title="Moments After Dark" subtitle="A glimpse of life inside Nocturne." />
        {images.length ? <GalleryGrid images={images} /> : <EmptyState title="No photos yet" text="Check back soon." />}
      </div>
    );
  } catch { return <ErrorState message="We couldn't load the gallery. Please try again shortly." />; }
}
