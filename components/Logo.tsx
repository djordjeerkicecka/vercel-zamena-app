// Placeholder logo component — swap the contents with the real Ortomed logo (e.g. an <Image> tag) when available.
export function Logo() {
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">
        O
      </div>
      <span className="text-xl font-bold tracking-tight text-brand-700">Ortomed</span>
    </div>
  );
}
