import Link from "next/link";
import { Logo } from "@/components/Logo";
import { EXCHANGE_LOGISTICS_NOTES } from "@/lib/constants";

export default function PotvrdaPage({
  searchParams,
}: {
  searchParams: { broj?: string; tip?: string };
}) {
  const ticketNumber = searchParams.broj;
  const isExchange = searchParams.tip === "ZAMENA";

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
      <Logo />

      <div className="card mt-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900">Hvala na zahtevu!</h1>
        <p className="mt-2 text-gray-600">Očekujte email sa potvrdom.</p>

        {ticketNumber && (
          <div className="mt-6 rounded-xl bg-brand-50 px-4 py-3">
            <p className="text-sm text-gray-600">Broj vašeg zahteva</p>
            <p className="text-2xl font-bold tracking-wide text-brand-700">{ticketNumber}</p>
          </div>
        )}

        {isExchange && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-800">
            <p className="font-semibold">Šta dalje:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {EXCHANGE_LOGISTICS_NOTES.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        <Link href="/zahtev" className="btn-secondary mt-8 w-full">
          Podnesi novi zahtev
        </Link>
      </div>
    </main>
  );
}
