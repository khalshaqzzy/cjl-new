import type { ConfirmOrderInput, ServiceSetting } from "@cjl/contracts"
import { ValidationError } from "../errors.js"

export const calculateOrderPreview = (
  services: ServiceSetting[],
  currentPoints: number,
  input: ConfirmOrderInput
) => {
  const serviceMap = new Map(services.map((service) => [service.serviceCode, service]))
  const activeItems = input.items
    .filter((item) => item.selected && item.quantity > 0)
    .map((item) => {
      const service = serviceMap.get(item.serviceCode)
      if (!service || !service.isActive) {
        throw new ValidationError(`Service ${item.serviceCode} tidak aktif`)
      }

      const billedQuantity = service.pricingModel === "per_kg" ? input.weightKg : item.quantity
      const lineTotal = Math.round(billedQuantity * service.price)

      return {
        serviceCode: service.serviceCode,
        serviceLabel: service.displayName,
        quantity: billedQuantity,
        quantityLabel: service.pricingModel === "per_kg" ? `${input.weightKg.toFixed(1)} kg` : `${item.quantity} unit`,
        unitPrice: service.price,
        lineTotal,
        pricingModel: service.pricingModel
      }
    })

  const washerCount = input.items.find((item) => item.serviceCode === "washer")?.quantity ?? 0
  const dryerCount = input.items.find((item) => item.serviceCode === "dryer")?.quantity ?? 0
  const packageCount = input.items.find((item) => item.serviceCode === "wash_dry_fold_package")?.quantity ?? 0
  const washDryPackageCount = input.items.find((item) => item.serviceCode === "wash_dry_package")?.quantity ?? 0
  const maxRedeemableWashers = Math.min(Math.floor(currentPoints / 10), washerCount)
  const redeemCount = Math.min(input.redeemCount, maxRedeemableWashers)
  const subtotal = activeItems.reduce((sum, item) => sum + item.lineTotal, 0)
  const discount = redeemCount * (serviceMap.get("washer")?.price ?? 10000)
  const total = Math.max(0, subtotal - discount)
  const earnedWasherDryerPairs = Math.min(Math.max(washerCount - redeemCount, 0), dryerCount)
  const earnedPackageStamps = packageCount + washDryPackageCount
  const earnedStamps = earnedWasherDryerPairs + earnedPackageStamps
  const redeemedPoints = redeemCount * 10
  const resultingPointBalance = currentPoints - redeemedPoints + earnedStamps

  return {
    activeItems,
    subtotal,
    discount,
    total,
    earnedStamps,
    redeemedPoints,
    resultingPointBalance,
    maxRedeemableWashers
  }
}
