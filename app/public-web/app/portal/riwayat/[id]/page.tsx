'use client'

import { use, useEffect, useState } from 'react'
import type { OrderHistoryItem } from '@cjl/contracts'
import { PortalShell } from '@/components/public/portal-shell'
import { publicApi } from '@/lib/api'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Package,
  RotateCcw,
  Scale,
  Star,
  XCircle,
} from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export default function OrderDetailPage({ params }: Props) {
  const resolvedParams = use(params)
  const [order, setOrder] = useState<OrderHistoryItem | null>(null)
  const [session, setSession] = useState<{ customerId: string; name: string; phone: string } | null>(null)

  useEffect(() => {
    publicApi.getOrderDetail(resolvedParams.id).then(setOrder).catch(() => undefined)
    publicApi.getSession().then((payload) => setSession(payload.session)).catch(() => undefined)
  }, [resolvedParams.id])

  if (!order) {
    return (
      <PortalShell title="Detail Order" showBack backHref="/portal/riwayat" session={session}>
        <div className="min-h-screen bg-bg-soft flex items-center justify-center p-6">
          <div className="text-center bg-white rounded-3xl border border-line-soft p-12 max-w-sm w-full">
            <div className="w-16 h-16 rounded-2xl bg-pink-cloud flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-pink-hot" />
            </div>
            <h3 className="font-display font-bold text-text-strong mb-2">Order tidak ditemukan</h3>
            <p className="text-text-muted text-sm">Order yang Anda cari tidak tersedia.</p>
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
                <p className="font-display text-lg font-bold text-text-strong">{order.status}</p>
              </div>
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
                  <span className="text-text-body text-sm">Layanan</span>
                </div>
                <span className="font-semibold text-text-strong text-sm text-right max-w-[55%]">{order.serviceSummary}</span>
              </div>
            </div>
          </div>

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
