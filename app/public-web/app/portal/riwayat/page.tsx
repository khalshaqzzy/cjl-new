'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { OrderHistoryItem } from '@cjl/contracts'
import { PortalShell } from '@/components/public/portal-shell'
import { getStatusColor, getStatusLabel } from '@/lib/mock-data'
import { publicApi } from '@/lib/api'
import { ArrowRight, CheckCircle2, Clock, Package, RotateCcw, Star, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type FilterType = 'Semua' | 'Active' | 'Done' | 'Cancelled'

const filters: Array<{ value: FilterType; label: string }> = [
  { value: 'Semua', label: 'Semua' },
  { value: 'Active', label: 'Aktif' },
  { value: 'Done', label: 'Selesai' },
  { value: 'Cancelled', label: 'Dibatalkan' },
]

const statusIconMap = {
  Active: Clock,
  Done: CheckCircle2,
  Cancelled: XCircle,
}

export default function RiwayatPage() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('Semua')
  const [mounted, setMounted] = useState(false)
  const [orders, setOrders] = useState<OrderHistoryItem[]>([])
  const [session, setSession] = useState<{ customerId: string; name: string; phone: string } | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    publicApi.listOrders().then(setOrders).catch(() => undefined)
    publicApi.getSession().then((payload) => setSession(payload.session)).catch(() => undefined)
  }, [])

  const filteredOrders = orders.filter((order) => activeFilter === 'Semua' || order.status === activeFilter)
  const counts = {
    Semua: orders.length,
    Active: orders.filter((order) => order.status === 'Active').length,
    Done: orders.filter((order) => order.status === 'Done').length,
    Cancelled: orders.filter((order) => order.status === 'Cancelled').length,
  }

  return (
    <PortalShell title="Riwayat Order" session={session}>
      <div className="min-h-screen bg-bg-soft">
        <div className="relative overflow-hidden bg-white border-b border-line-soft">
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.25]"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(240,78,148,0.14) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
          <div className="relative px-4 md:px-6 pt-6 pb-6">
            <div className={`transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-3.5 h-3.5 text-pink-hot" />
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Semua Transaksi</span>
              </div>
              <h1 className="font-display text-3xl font-bold text-text-strong">
                Riwayat <span className="text-gradient-pink">Order</span>
              </h1>
              <p className="text-text-muted text-sm mt-1">{orders.length} order tercatat dalam akun Anda</p>
            </div>

            <div className={`flex items-center gap-2 mt-4 overflow-x-auto pb-1 -mx-1 px-1 transition-all duration-500 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setActiveFilter(filter.value)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200',
                    activeFilter === filter.value
                      ? 'bg-gradient-primary text-white shadow-md shadow-pink-hot/20'
                      : 'bg-white text-text-body border border-line-soft hover:border-pink-soft'
                  )}
                >
                  {filter.label}
                  <span
                    className={cn(
                      'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold',
                      activeFilter === filter.value ? 'bg-white/20 text-white' : 'bg-pink-cloud text-pink-hot'
                    )}
                  >
                    {counts[filter.value]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 max-w-4xl mx-auto pt-4 pb-8">
          {filteredOrders.length === 0 ? (
            <div className={`text-center py-16 bg-white rounded-2xl border border-line-soft mt-2 transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="w-16 h-16 rounded-2xl bg-pink-cloud flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-pink-hot" />
              </div>
              <h3 className="font-display font-bold text-text-strong mb-1">Tidak ada order</h3>
              <p className="text-sm text-text-muted">Tidak ada order dengan filter yang dipilih.</p>
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              {filteredOrders.map((order, index) => {
                const StatusIcon = statusIconMap[order.status]
                return (
                  <Link
                    key={order.orderId}
                    href={`/portal/riwayat/${order.orderId}`}
                    className={`group block bg-white rounded-2xl border border-line-soft overflow-hidden hover:border-pink-soft hover:shadow-lg hover:shadow-pink-hot/5 transition-all duration-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
                    style={{ transitionDelay: `${index * 50 + 150}ms` }}
                  >
                    <div className="h-1 w-full bg-pink-cloud" />
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-pink-cloud">
                            <StatusIcon className="w-4.5 h-4.5 text-pink-hot" />
                          </div>
                          <div>
                            <p className="font-display font-bold text-text-strong text-sm leading-tight">{order.orderCode}</p>
                            <p className="text-xs text-text-muted mt-0.5">{order.createdAtLabel}</p>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </div>

                      <p className="text-sm text-text-body mb-3 pl-0.5">{order.serviceSummary}</p>

                      <div className="flex items-center justify-between border-t border-line-soft pt-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-text-muted bg-bg-soft px-2 py-1 rounded-lg">{order.weightKgLabel}</span>
                          {order.earnedStamps > 0 && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-success bg-success/8 px-2 py-1 rounded-lg">
                              <Star className="w-3 h-3" fill="currentColor" />
                              +{order.earnedStamps} stamp
                            </span>
                          )}
                          {order.redeemedPoints > 0 && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-info bg-info/8 px-2 py-1 rounded-lg">
                              <RotateCcw className="w-3 h-3" />
                              -{order.redeemedPoints}
                            </span>
                          )}
                        </div>
                        <ArrowRight className="w-4 h-4 text-pink-hot transition-transform duration-200 group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  )
}
