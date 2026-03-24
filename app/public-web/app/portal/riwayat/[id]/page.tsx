'use client'

import { use, useEffect, useState } from 'react'
import type { CustomerOrderDetail } from '@cjl/contracts'
import { PortalShell } from '@/components/public/portal-shell'
import { publicApi } from '@/lib/api'
import { getStatusLabel } from '@/lib/presenters'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Download,
  Package,
  ReceiptText,
  RotateCcw,
  Scale,
  Star,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  params: Promise<{ id: string }>
}

type PortalSession = {
  customerId: string
  name: string
  phone: string
  publicNameVisible: boolean
}

export default function OrderDetailPage({ params }: Props) {
  const resolvedParams = use(params)
  const [order, setOrder] = useState<CustomerOrderDetail | null>(null)
  const [session, setSession] = useState<PortalSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    setIsLoading(true)
    Promise.all([
      publicApi.getOrderDetail(resolvedParams.id),
      publicApi.getSession(),
    ])
      .then(([nextOrder, payload]) => {
        setOrder(nextOrder)
        setSession(payload.session)
        setLoadError('')
      })
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : 'Order yang Anda cari tidak tersedia.')
      })
      .finally(() => setIsLoading(false))
  }, [resolvedParams.id])

  const handleDownloadReceipt = async () => {
    if (!order) {
      return
    }

    setIsDownloading(true)
    try {
      const { blob, filename } = await publicApi.getOrderReceipt(order.orderId)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsDownloading(false)
    }
  }

  if (isLoading) {
    return (
      <PortalShell title="Detail Order" showBack backHref="/portal/riwayat" session={session}>
        <div className="min-h-screen bg-bg-soft flex items-center justify-center p-6">
          <div className="text-center bg-white rounded-3xl border border-line-soft p-12 max-w-sm w-full">
            <div className="w-16 h-16 rounded-2xl bg-pink-cloud flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-pink-hot animate-pulse" />
            </div>
            <h3 className="font-display font-bold text-text-strong mb-2">Memuat detail order</h3>
            <p className="text-text-muted text-sm">Menyiapkan informasi order Anda.</p>
          </div>
        </div>
      </PortalShell>
    )
  }

  if (!order) {
    return (
      <PortalShell title="Detail Order" showBack backHref="/portal/riwayat" session={session}>
        <div className="min-h-screen bg-bg-soft flex items-center justify-center p-6">
          <div className="text-center bg-white rounded-3xl border border-line-soft p-12 max-w-sm w-full">
            <div className="w-16 h-16 rounded-2xl bg-pink-cloud flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-pink-hot" />
            </div>
            <h3 className="font-display font-bold text-text-strong mb-2">Order tidak ditemukan</h3>
            <p className="text-text-muted text-sm">{loadError || 'Order yang Anda cari tidak tersedia.'}</p>
          </div>
        </div>
      </PortalShell>
    )
  }

  return (
    <PortalShell title="Detail Order" showBack backHref="/portal/riwayat" session={session}>
      <div className="min-h-screen bg-bg-soft">
        <div className="relative overflow-hidden bg-white border-b border-line-soft">
          <div className="relative px-4 md:px-6 pt-6 pb-8">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-3.5 h-3.5 text-pink-hot" />
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Detail Order</span>
            </div>
            <p className="font-display text-2xl font-bold text-text-strong mb-4 tracking-tight">{order.orderCode}</p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-3 px-4 py-3 rounded-2xl border bg-pink-cloud border-pink-soft">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white">
                  {order.status === 'Done' ? (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  ) : order.status === 'Cancelled' ? (
                    <XCircle className="w-5 h-5 text-danger" />
                  ) : (
                    <Package className="w-5 h-5 text-pink-hot" />
                  )}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-text-muted">Status</p>
                  <p className="font-display text-lg font-bold text-text-strong">{getStatusLabel(order.status)}</p>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleDownloadReceipt}
                disabled={isDownloading}
                className="rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-semibold"
              >
                <Download className="w-4 h-4 mr-2" />
                {isDownloading ? 'Menyiapkan PDF...' : 'Download Receipt'}
              </Button>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 max-w-4xl mx-auto pt-4 pb-8 space-y-4">
          <div className="bg-white rounded-2xl border border-line-soft overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-line-soft flex items-center gap-2">
              <Package className="w-4 h-4 text-pink-hot" />
              <h3 className="font-display font-semibold text-text-strong text-sm">Detail Order</h3>
            </div>
            <div className="divide-y divide-line-soft">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-pink-cloud flex items-center justify-center">
                    <Calendar className="w-4.5 h-4.5 text-pink-hot" />
                  </div>
                  <span className="text-text-body text-sm">Tanggal Order</span>
                </div>
                <span className="font-semibold text-text-strong text-sm">{order.createdAtLabel}</span>
              </div>
              {order.completedAtLabel && (
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                      <CheckCircle2 className="w-4.5 h-4.5 text-success" />
                    </div>
                    <span className="text-text-body text-sm">Tanggal Selesai</span>
                  </div>
                  <span className="font-semibold text-text-strong text-sm">{order.completedAtLabel}</span>
                </div>
              )}
              {order.cancelledAtLabel && (
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center">
                      <XCircle className="w-4.5 h-4.5 text-danger" />
                    </div>
                    <span className="text-text-body text-sm">Tanggal Dibatalkan</span>
                  </div>
                  <span className="font-semibold text-text-strong text-sm">{order.cancelledAtLabel}</span>
                </div>
              )}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-pink-cloud flex items-center justify-center">
                    <Scale className="w-4.5 h-4.5 text-pink-hot" />
                  </div>
                  <span className="text-text-body text-sm">Berat Laundry</span>
                </div>
                <span className="font-semibold text-text-strong text-sm">{order.weightKgLabel}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-pink-cloud flex items-center justify-center">
                    <Package className="w-4.5 h-4.5 text-pink-hot" />
                  </div>
                  <span className="text-text-body text-sm">Ringkasan Layanan</span>
                </div>
                <span className="font-semibold text-text-strong text-sm text-right max-w-[55%]">{order.serviceSummary}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-line-soft overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-line-soft flex items-center gap-2">
              <ReceiptText className="w-4 h-4 text-pink-hot" />
              <h3 className="font-display font-semibold text-text-strong text-sm">Rincian Receipt</h3>
            </div>
            <div className="divide-y divide-line-soft">
              {order.items.map((item) => (
                <div key={`${item.serviceCode}-${item.quantityLabel}`} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-text-strong text-sm">{item.serviceLabel}</p>
                      <p className="text-xs text-text-muted mt-1">{item.quantityLabel} x {item.unitPriceLabel}</p>
                    </div>
                    <span className="font-semibold text-text-strong text-sm">{item.lineTotalLabel}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-line-soft bg-bg-soft p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">Subtotal</span>
                <span className="font-medium text-text-strong">{order.subtotalLabel}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">Diskon Redeem</span>
                <span className="font-medium text-emerald-600">{order.discount > 0 ? order.discountLabel : 'Rp 0'}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-line-soft">
                <span className="font-display font-bold text-text-strong">Total</span>
                <span className="font-display text-xl font-bold text-rose-600">{order.totalLabel}</span>
              </div>
            </div>
          </div>

          {order.cancellationSummary && (
            <div className="bg-white rounded-2xl border border-danger/20 overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-danger/10 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-danger" />
                <h3 className="font-display font-semibold text-text-strong text-sm">Alasan Pembatalan</h3>
              </div>
              <div className="p-4 text-sm text-text-body">
                {order.cancellationSummary}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-line-soft overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-line-soft flex items-center gap-2">
              <Star className="w-4 h-4 text-success" />
              <h3 className="font-display font-semibold text-text-strong text-sm">Ringkasan Stamp</h3>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-success/8 border border-success/15 p-4 text-center">
                <div className="w-8 h-8 rounded-lg bg-success/15 flex items-center justify-center mx-auto mb-2">
                  <Star className="w-4 h-4 text-success" fill="currentColor" />
                </div>
                <p className="font-display text-3xl font-bold text-success">+{order.earnedStamps}</p>
                <p className="text-xs text-text-muted mt-1 font-medium">Stamp Diperoleh</p>
              </div>
              <div className="rounded-xl bg-bg-soft border border-line-soft p-4 text-center">
                <div className="w-8 h-8 rounded-lg bg-pink-cloud flex items-center justify-center mx-auto mb-2">
                  <RotateCcw className="w-4 h-4 text-info" />
                </div>
                <p className="font-display text-3xl font-bold text-info">-{order.redeemedPoints}</p>
                <p className="text-xs text-text-muted mt-1 font-medium">Stamp Ditukar</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  )
}
