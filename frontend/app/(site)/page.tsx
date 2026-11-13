import { HomeSections } from "@/components/site/home-sections";
import { ErrorState } from "@/components/ui/misc";
import { getHomeData } from "@/services/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    const data = await getHomeData();
    return <HomeSections data={data} />;
  } catch {
    return <ErrorState message="We couldn't reach the café just now. Please refresh in a moment." />;
  }
}
