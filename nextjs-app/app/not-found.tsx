import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-8xl font-bold text-gray-100 mb-2 select-none">404</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Página no encontrada
        </h2>
        <p className="text-gray-500 text-sm mb-8 max-w-xs mx-auto">
          La página que buscas no existe o fue movida.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/dashboard"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            Ir al dashboard
          </Link>
          <Link
            href="/"
            className="bg-white text-gray-700 px-6 py-2 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 transition"
          >
            Inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
