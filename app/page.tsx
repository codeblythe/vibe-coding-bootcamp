import Welcome from "@/components/Welcome";
import ShimmerQuote from "@/components/ShimmerQuote";
import BootcampFooter from "@/components/BootcampFooter";
import GardenBackground from "@/components/GardenBackground";

export default function Home() {
  const motto = process.env.NEXT_PUBLIC_MOTTO;

  return (
    <main className="min-h-screen flex flex-col">
      <GardenBackground />

      <div className="flex-1 flex items-center justify-center px-6">
        {motto ? <ShimmerQuote text={motto} /> : <Welcome />}
      </div>

      <BootcampFooter />
    </main>
  );
}
