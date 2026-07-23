export default function DashboardLoading() {
  return (
    <div className="p-8 animate-pulse">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-1/3" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="h-8 w-8 bg-gray-200 rounded mb-3" />
            <div className="h-10 bg-gray-200 rounded w-16 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </div>
        ))}
      </div>

      {/* CTA skeleton */}
      <div className="bg-gray-100 rounded-xl p-6">
        <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
        <div className="h-4 bg-gray-200 rounded w-2/3 mb-4" />
        <div className="h-9 bg-gray-200 rounded w-32" />
      </div>
    </div>
  )
}
