"use client";

interface ReorderActionButtonsProps {
  deepLink: string;
  reorderLogId: string;
  onConfirm: (id: string) => void;
  onSkip: (id: string) => void;
  isLoading?: boolean;
}

export function ReorderActionButtons({
  deepLink,
  reorderLogId,
  onConfirm,
  onSkip,
  isLoading,
}: ReorderActionButtonsProps) {
  return (
    <div className="flex gap-2 mt-4">
      <a
        href={deepLink}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onConfirm(reorderLogId)}
        className="flex-1 text-center px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
      >
        Open Swiggy →
      </a>
      <button
        onClick={() => onSkip(reorderLogId)}
        disabled={isLoading}
        className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
      >
        Skip
      </button>
    </div>
  );
}
