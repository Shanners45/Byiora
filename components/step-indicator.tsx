interface StepIndicatorProps {
  number: string | number
  active: boolean
}

export function StepIndicator({ number, active }: StepIndicatorProps) {
  return (
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
        active ? "bg-brand-sky-blue text-white" : "bg-gray-200 text-brand-light-gray"
      }`}
    >
      {number}
    </div>
  )
}
