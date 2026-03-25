"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="id">
      <body className="m-0 bg-[#fff8f2] font-sans">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-lg rounded-[28px] border border-rose-100 bg-white p-8 shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-500">System Error</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">CJ Laundry sedang mengalami gangguan.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {error.message || "Silakan muat ulang halaman atau coba lagi beberapa saat lagi."}
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 inline-flex rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
            >
              Muat Ulang
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
