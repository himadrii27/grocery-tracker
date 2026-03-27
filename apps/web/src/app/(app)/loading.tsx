// Fallback for any (app) route that doesn't have its own loading.tsx
export default function AppLoading() {
  return (
    <div className="max-w-3xl mx-auto animate-pulse">
      <div className="h-7 w-40 bg-gray-200 rounded-lg mb-2" />
      <div className="h-4 w-56 bg-gray-100 rounded mb-8" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
