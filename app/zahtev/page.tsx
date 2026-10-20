import { WizardForm } from "@/components/wizard/WizardForm";
import { Logo } from "@/components/Logo";

export default function ZahtevPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8 sm:py-12">
      <Logo />
      <WizardForm />
    </main>
  );
}
