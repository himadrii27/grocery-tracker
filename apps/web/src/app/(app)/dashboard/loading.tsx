export default function DashboardLoading() {
  return (
    <div className="max-w-5xl mx-auto animate-pulse">
      {/* Header */}
      <div className="mb-8">
        <div className="h-7 w-32 bg-gray-200 rounded-lg mb-2" />
        <div className="h-4 w-48 bg-gray-100 rounded" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="h-4 w-16 bg-gray-200 rounded mb-3" />
            <div className="h-8 w-10 bg-gray-200 rounded mb-2" />
            <div className="h-3 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Item grid */}
      <div className="h-5 w-36 bg-gray-200 rounded mb-3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
            <div className="flex gap-2">
              <div className="h-6 w-6 bg-gray-200 rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-gray-200 rounded" />
                <div className="h-3 w-1/2 bg-gray-100 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
