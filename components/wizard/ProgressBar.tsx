interface Props {
  labels: string[];
  // 1-based index of the current step.
  currentStep: number;
}

export function ProgressBar({ labels, currentStep }: Props) {
  const totalSteps = labels.length;

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        {labels.map((label, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === currentStep;
          const isDone = stepNum < currentStep;
          return (
            <div key={label} className="flex flex-1 flex-col items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  isDone
                    ? "bg-brand text-white"
                    : isActive
                      ? "border-2 border-brand text-brand"
                      : "border-2 border-gray-200 text-gray-400"
                }`}
              >
                {isDone ? "✓" : stepNum}
              </div>
              <span
                className={`mt-1 hidden text-center text-[11px] leading-tight sm:block ${
                  isActive ? "font-semibold text-brand-700" : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-brand transition-all duration-300"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-gray-500 sm:hidden">
        Korak {currentStep} od {totalSteps}: {labels[currentStep - 1]}
      </p>
    </div>
  );
}
