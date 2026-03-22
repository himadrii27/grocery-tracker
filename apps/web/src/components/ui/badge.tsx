interface BadgeProps {
  variant?: "critical" | "low" | "ok" | "unknown" | "default";
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  const variants = {
    critical: "bg-red-100 text-red-700 border-red-200",
    low: "bg-amber-100 text-amber-700 border-amber-200",
    ok: "bg-green-100 text-green-700 border-green-200",
    unknown: "bg-gray-100 text-gray-600 border-gray-200",
    default: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
