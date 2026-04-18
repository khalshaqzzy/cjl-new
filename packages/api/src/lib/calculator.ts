import type { ConfirmOrderInput, ServiceSetting } from "@cjl/contracts"
import { ValidationError } from "../errors.js"

const REDEEMABLE_SERVICE_CODES = new Set([
  "washer",
  "wash_dry_fold_package",
  "wash_dry_package",
])
const POINTS_PER_REDEEM_UNIT = 10
const DISCOUNT_PER_REDEEM_UNIT = 10000

const getSelectedQuantity = (input: ConfirmOrderInput, serviceCode: string) =>
  input.items.find((item) => item.serviceCode === serviceCode && item.selected)?.quantity ?? 0

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

  const washerCount = getSelectedQuantity(input, "washer")
  const dryerCount = getSelectedQuantity(input, "dryer")
  const packageCount = getSelectedQuantity(input, "wash_dry_fold_package")
  const washDryPackageCount = getSelectedQuantity(input, "wash_dry_package")
  const redeemableUnitCount = input.items
    .filter((item) => item.selected && REDEEMABLE_SERVICE_CODES.has(item.serviceCode))
    .reduce((sum, item) => sum + item.quantity, 0)
  const maxRedeemableUnits = Math.min(Math.floor(currentPoints / POINTS_PER_REDEEM_UNIT), redeemableUnitCount)
  const redeemCount = Math.min(input.redeemCount, maxRedeemableUnits)
  const subtotal = activeItems.reduce((sum, item) => sum + item.lineTotal, 0)
  const discount = redeemCount * DISCOUNT_PER_REDEEM_UNIT
  const total = Math.max(0, subtotal - discount)
  const earnedWasherDryerPairs = Math.min(washerCount, dryerCount)
  const earnedPackageStamps = packageCount + washDryPackageCount
  const earnedStamps = Math.max(0, earnedWasherDryerPairs + earnedPackageStamps - redeemCount)
  const redeemedPoints = redeemCount * POINTS_PER_REDEEM_UNIT
  const resultingPointBalance = currentPoints - redeemedPoints + earnedStamps

  return {
    activeItems,
    subtotal,
    discount,
    total,
    earnedStamps,
    redeemedPoints,
    resultingPointBalance,
    maxRedeemableUnits
  }
}
