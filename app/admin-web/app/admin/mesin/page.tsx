"use client"

import { useEffect, useMemo, useState } from "react"
import type { AdminMachine } from "@cjl/contracts"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin/admin-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { adminApi } from "@/lib/api"
import {
  AlertTriangle,
  Loader2,
  Power,
  PowerOff,
  RefreshCw,
  Waves,
  Wind,
} from "lucide-react"

const statusLabels: Record<AdminMachine["status"], string> = {
  "1": "Nyala",
  "0": "Mati",
  unknown: "Tidak terbaca",
}

const statusStyles: Record<AdminMachine["status"], string> = {
  "1": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "0": "border-slate-200 bg-slate-50 text-slate-600",
  unknown: "border-amber-200 bg-amber-50 text-amber-700",
}

function MachineCard({
  machine,
  busyKey,
  onCommand,
}: {
  machine: AdminMachine
  busyKey: string | null
  onCommand: (machine: AdminMachine, targetStatus: "0" | "1") => void
}) {
  const isBusy = busyKey?.startsWith(`${machine.machineId}:`) ?? false
  const pendingOn = busyKey === `${machine.machineId}:1`
  const pendingOff = busyKey === `${machine.machineId}:0`
  const Icon = machine.type === "dryer" ? Wind : Waves

  return (
    <Card className="rounded-xl border border-line-base bg-bg-surface shadow-card">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg",
                machine.status === "1" ? "bg-emerald-50" : machine.status === "0" ? "bg-bg-subtle" : "bg-amber-50"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  machine.status === "1" ? "text-emerald-600" : machine.status === "0" ? "text-text-muted" : "text-amber-600"
                )}
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-strong">{machine.label}</p>
              <p className="mt-0.5 text-xs text-text-muted">Status: Mesin/{machine.statusPath}</p>
            </div>
          </div>
          <Badge className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", statusStyles[machine.status])}>
            {statusLabels[machine.status]}
          </Badge>
        </div>

        {machine.type === "washer" && (
          <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-800">
            Nyalakan menulis Mesin/{machine.onCommandPath}; status tetap dibaca dari Mesin/{machine.statusPath}.
          </p>
        )}

        {machine.status === "unknown" && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>Nilai status bukan "0" atau "1". Periksa path Firebase sebelum mengoperasikan mesin.</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            disabled={isBusy || machine.status === "1"}
            onClick={() => onCommand(machine, "1")}
            className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {pendingOn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
            Nyalakan
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isBusy || machine.status === "0"}
            onClick={() => onCommand(machine, "0")}
            className="rounded-lg border-line-base text-text-body hover:bg-danger-bg hover:text-danger"
          >
            {pendingOff ? <Loader2 className="h-4 w-4 animate-spin" /> : <PowerOff className="h-4 w-4" />}
            Matikan
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function MachineControlPage() {
  const [machines, setMachines] = useState<AdminMachine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [loadError, setLoadError] = useState("")

  const groupedMachines = useMemo(() => ({
    dryer: machines.filter((machine) => machine.type === "dryer"),
    washer: machines.filter((machine) => machine.type === "washer"),
  }), [machines])

  const loadMachines = async (mode: "initial" | "refresh" = "refresh") => {
    if (mode === "initial") {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }

    try {
      const payload = await adminApi.listMachines()
      setMachines(payload.items)
      setLoadError("")
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Gagal memuat status mesin")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    void loadMachines("initial")
  }, [])

  const handleCommand = async (machine: AdminMachine, targetStatus: "0" | "1") => {
    const actionLabel = targetStatus === "1" ? "menyalakan" : "mematikan"
    const path = targetStatus === "1" ? machine.onCommandPath : machine.offCommandPath
    const confirmed = window.confirm(`Konfirmasi ${actionLabel} ${machine.label} melalui Mesin/${path}?`)
    if (!confirmed) {
      return
    }

    setBusyKey(`${machine.machineId}:${targetStatus}`)
    try {
      const result = await adminApi.commandMachine(machine.machineId, targetStatus)
      setMachines((current) => current.map((item) => (
        item.machineId === result.machine.machineId ? result.machine : item
      )))
      toast.success(`${machine.label} berhasil diproses`, {
        description: `Command Mesin/${result.command.path} = "${result.command.targetStatus}"`,
      })
      await loadMachines("refresh")
    } catch (error) {
      toast.error(`Gagal ${actionLabel} ${machine.label}`, {
        description: error instanceof Error ? error.message : "Request mesin gagal",
      })
    } finally {
      setBusyKey(null)
    }
  }

  const renderGroup = (title: string, subtitle: string, items: AdminMachine[]) => (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-text-strong">{title}</h2>
          <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>
        </div>
        <Badge variant="secondary" className="rounded-md border-0 bg-bg-subtle text-text-muted">
          {items.filter((machine) => machine.status === "1").length}/{items.length} nyala
        </Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {items.map((machine) => (
          <MachineCard
            key={machine.machineId}
            machine={machine}
            busyKey={busyKey}
            onCommand={handleCommand}
          />
        ))}
      </div>
    </section>
  )

  return (
    <AdminShell
      title="Kontrol Mesin"
      subtitle="Nyalakan dan matikan washer serta dryer dari panel admin"
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoading || isRefreshing || Boolean(busyKey)}
          onClick={() => void loadMachines("refresh")}
          className="rounded-lg border-line-base"
        >
          {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      }
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 lg:p-6">
        {loadError && (
          <div className="rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
            {loadError}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-xl border border-line-base bg-bg-surface px-5 py-8 text-center text-sm text-text-muted shadow-card">
            <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-rose-600" />
            Memuat status mesin...
          </div>
        ) : (
          <>
            {renderGroup("Dryer", "Status dan command memakai path A1 sampai E1.", groupedMachines.dryer)}
            {renderGroup("Washer", "Nyalakan lewat A2 sampai E2, matikan dan status lewat A3 sampai E3.", groupedMachines.washer)}
          </>
        )}
      </div>
    </AdminShell>
  )
}
