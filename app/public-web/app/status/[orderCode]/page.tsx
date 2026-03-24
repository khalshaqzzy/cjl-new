'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import type { DirectOrderStatus, LandingResponse } from '@cjl/contracts'
import { FloatingHeader } from '@/components/public/floating-header'
import { Footer } from '@/components/public/footer'
import { publicApi } from '@/lib/api'
import { getStatusLabel } from '@/lib/presenters'
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, MessageCircle, Package, RotateCcw, Scale, Star, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  params: Promise<{ orderCode: string }>
}

export default function DirectOrderStatusPage({ params }: Props) {
  const { orderCode } = use(params)
  const [order, setOrder] = useState<DirectOrderStatus | null>(null)
  const [laundryInfo, setLaundryInfo] = useState<LandingResponse["laundryInfo"]>({
    name: 'CJ Laundry',
    phone: '',
    whatsapp: '',
    address: '',
    operatingHours: '',
  })
  const [notFound, setNotFound] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    publicApi.getDirectStatus(orderCode)
      .then((payload) => {
        setOrder(payload)
        setNotFound(false)
      })
      .catch(() => setNotFound(true))
      .finally(() => setIsLoading(false))
  }, [orderCode])

  useEffect(() => {
    publicApi.getLanding().then((payload) => setLaundryInfo(payload.laundryInfo)).catch(() => undefined)
  }, [])

  if (notFound) {
    return (
      <div className="min-h-screen bg-bg-soft">
        <FloatingHeader />
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 max-w-lg">
            <Link href="/" className="inline-flex items-center gap-2 text-text-muted hover:text-text-strong mb-8 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Kembali ke beranda
            </Link>
            <div className="bg-white rounded-3xl p-8 border border-line-soft text-center shadow-lg shadow-pink-hot/5">
              <div className="w-20 h-20 rounded-full bg-pink-cloud flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-pink-hot" />
              </div>
              <h1 className="font-display text-2xl font-bold text-text-strong mb-3">Order Tidak Ditemukan</h1>
              <p className="text-text-muted mb-6">Link status order ini tidak lagi valid atau order tidak ditemukan.</p>
              <Button asChild className="bg-gradient-primary hover:opacity-90 text-white shadow-lg shadow-pink-hot/25">
                <a href={`https://wa.me/${laundryInfo.whatsapp}`} target="_blank" rel="noopener noreferrer">
                  Hubungi Kami
                </a>
              </Button>
            </div>
          </div>
        </main>
        <Footer laundryInfo={laundryInfo} />
      </div>
    )
  }

  if (isLoading && !order && !notFound) {
    return (
      <div className="min-h-screen bg-bg-soft">
        <FloatingHeader />
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 max-w-lg">
            <div className="bg-white rounded-3xl p-8 border border-line-soft text-center shadow-lg shadow-pink-hot/5">
              <div className="w-20 h-20 rounded-full bg-pink-cloud flex items-center justify-center mx-auto mb-6">
                <Package className="w-10 h-10 text-pink-hot animate-pulse" />
              </div>
              <h1 className="font-display text-2xl font-bold text-text-strong mb-3">Memuat Status Order</h1>
              <p className="text-text-muted">Mohon tunggu sebentar.</p>
            </div>
          </div>
        </main>
        <Footer laundryInfo={laundryInfo} />
      </div>
    )
  }

  if (!order) {
    return null
  }

  const whatsappDigits = (() => {
    const digits = order.laundryPhone.replace(/\D/g, '')
    if (digits.startsWith('62')) return digits
    if (digits.startsWith('0')) return `62${digits.slice(1)}`
    return `62${digits}`
  })()

  return (
    <div className="min-h-screen bg-bg-soft">
      <FloatingHeader />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-lg">
          <Link href="/" className="inline-flex items-center gap-2 text-text-muted hover:text-text-strong mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke beranda
          </Link>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center flex-shrink-0">
              <span className="font-display font-bold text-xl text-white">CJ</span>
            </div>
            <div>
              <p className="font-display font-semibold text-text-strong">{order.laundryName}</p>
              <p className="text-sm text-text-muted">Status Order</p>
            </div>
          </div>

          <div className="rounded-3xl p-8 border mb-6 text-center bg-white">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 bg-pink-cloud">
              {order.status === 'Done' ? (
                <CheckCircle2 className="w-8 h-8 text-success" />
              ) : order.status === 'Cancelled' ? (
                <XCircle className="w-8 h-8 text-danger" />
              ) : (
                <Package className="w-8 h-8 text-pink-hot" />
              )}
            </div>
            <div data-testid="direct-status-badge" className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-3 bg-pink-cloud text-pink-hot">
              {getStatusLabel(order.status)}
            </div>
            <p data-testid="direct-status-order-code" className="font-display text-xl font-bold text-text-strong mb-2">{order.orderCode}</p>
          </div>

          <div className="bg-white rounded-2xl border border-line-soft overflow-hidden mb-4">
            <div className="px-5 py-4 border-b border-line-soft">
              <h2 className="font-semibold text-text-strong">Detail Order</h2>
            </div>
            <div className="divide-y divide-line-soft">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-pink-cloud flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-pink-hot" />
                  </div>
                  <span className="text-sm text-text-body">Tanggal Order</span>
                </div>
                <span className="text-sm font-medium text-text-strong">{order.createdAtLabel}</span>
              </div>
              {order.completedAtLabel && (
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    </div>
                    <span className="text-sm text-text-body">Selesai</span>
                  </div>
                  <span className="text-sm font-medium text-text-strong">{order.completedAtLabel}</span>
                </div>
              )}
              {order.cancelledAtLabel && (
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-danger/10 flex items-center justify-center">
                      <XCircle className="w-4 h-4 text-danger" />
                    </div>
                    <span className="text-sm text-text-body">Dibatalkan</span>
                  </div>
                  <span className="text-sm font-medium text-text-strong">{order.cancelledAtLabel}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-pink-cloud flex items-center justify-center">
                    <Scale className="w-4 h-4 text-pink-hot" />
                  </div>
                  <span className="text-sm text-text-body">Berat</span>
                </div>
                <span className="text-sm font-medium text-text-strong">{order.weightKgLabel}</span>
              </div>
              <div className="flex items-start justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-pink-cloud flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-pink-hot" />
                  </div>
                  <span className="text-sm text-text-body">Layanan</span>
                </div>
                <span className="text-sm font-medium text-text-strong text-right max-w-[55%]">{order.serviceSummary}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-line-soft overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-line-soft">
              <h2 className="font-semibold text-text-strong">Stamp</h2>
            </div>
            <div className="divide-y divide-line-soft">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center">
                    <Star className="w-4 h-4 text-success" fill="currentColor" />
                  </div>
                  <span className="text-sm text-text-body">Stamp Diperoleh</span>
                </div>
                <span className="font-display text-base font-bold text-success">+{order.earnedStamps}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                    <RotateCcw className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-sm text-text-body">Stamp Ditukar</span>
                </div>
                <span className="font-display text-base font-bold text-blue-600">-{order.redeemedPoints}</span>
              </div>
            </div>
          </div>

          {order.cancellationSummary && (
            <div className="bg-white rounded-2xl border border-danger/20 overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-danger/10">
                <h2 className="font-semibold text-text-strong">Alasan Pembatalan</h2>
              </div>
              <div className="px-5 py-4 text-sm text-text-body">
                {order.cancellationSummary}
              </div>
            </div>
          )}

          <div className="bg-gradient-primary rounded-2xl p-5 relative overflow-hidden">
            <div className="relative flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-white mb-1">Ada pertanyaan?</p>
                <p className="text-sm text-white/80">Hubungi kami via WhatsApp</p>
                <p className="text-sm font-semibold text-white mt-1">{order.laundryPhone}</p>
              </div>
              <Button size="sm" className="bg-white text-pink-hot hover:bg-white/90 font-semibold flex-shrink-0 gap-2" asChild>
                <a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-4 h-4" />
                  Chat
                </a>
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer laundryInfo={laundryInfo} />
    </div>
  )
}
