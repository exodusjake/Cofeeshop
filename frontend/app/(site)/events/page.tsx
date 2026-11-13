import type { Metadata } from "next";
import { serverGet } from "@/services/server";
import { EventList, SectionHeading, parseEvents } from "@/components/site/home-sections";
import { ErrorState } from "@/components/ui/misc";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Events" };

export default async function EventsPage() {
  try {
    const pages = await serverGet<Record<string, string>>("/api/content/pages");
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeading eyebrow="Events" title="Evenings at Nocturne" subtitle={pages["events.intro"]} />
        <EventList events={parseEvents(pages)} />
      </div>
    );
  } catch { return <ErrorState message="We couldn't load events. Please try again shortly." />; }
}
