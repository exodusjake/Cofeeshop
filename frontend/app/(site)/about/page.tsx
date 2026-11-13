import type { Metadata } from "next";
import { serverGet } from "@/services/server";
import { SectionHeading } from "@/components/site/home-sections";
import { ErrorState } from "@/components/ui/misc";
import type { Homepage } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  try {
    const [pages, hp] = await Promise.all([serverGet<Record<string, string>>("/api/content/pages"), serverGet<Homepage>("/api/content/homepage")]);
    const story = hp.sections.find((s) => s.key === "story")?.content;
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <SectionHeading eyebrow="Our Story" title={pages["about.title"] || "About"} />
        {story?.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={story.image} alt="" className="mb-10 max-h-[28rem] w-full rounded-2xl border border-line object-cover" />}
        <div className="space-y-5 text-lg leading-relaxed text-cream/85">
          {(pages["about.body"] ?? "").split("\n").filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </div>
    );
  } catch { return <ErrorState message="We couldn't load this page. Please try again shortly." />; }
}
