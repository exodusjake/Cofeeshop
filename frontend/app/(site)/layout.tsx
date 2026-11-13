import { Footer, Navbar } from "@/components/site/shell";
import { serverGet } from "@/services/server";
import type { Homepage } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  let settings: Record<string, string> = {};
  let footerOn = true;
  let footerText: string | undefined;
  try {
    const hp = await serverGet<Homepage>("/api/content/homepage");
    settings = hp.settings;
    const f = hp.sections.find((s) => s.key === "footer");
    footerOn = !hp.isPublished || !!f; // when published, footer shows only if the section is enabled
    footerText = f?.content?.text;
  } catch { /* API unreachable: render the shell with defaults; pages show their own error state */ }
  const hideNav = (settings["site.nav.hide"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <>
      <Navbar settings={settings} hideNav={hideNav} />
      <main id="main" className="min-h-[70vh] pt-18">{children}</main>
      <Footer settings={settings} show={footerOn} text={footerText} />
    </>
  );
}
