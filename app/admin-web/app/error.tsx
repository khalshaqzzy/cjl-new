"use client"

import { useEffect } from "react"

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-md rounded-3xl border border-rose-100 bg-white p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-500">Admin Error</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">Terjadi gangguan pada panel admin.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {error.message || "Permintaan tidak bisa diproses sekarang."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  )
}
