export interface CommodityPriceProfile
{
    readonly basePrice: number;
    readonly lowerStockThreshold: number;
    readonly upperStockThreshold: number;
}

export function commodityPriceMultiplier (stock: number, profile: CommodityPriceProfile): number
{
    if (stock < profile.lowerStockThreshold) return 2 - stock / profile.lowerStockThreshold;
    if (stock <= profile.upperStockThreshold) return 1;
    if (stock < profile.lowerStockThreshold + profile.upperStockThreshold) {
        return 1 - (stock - profile.upperStockThreshold) / (2 * profile.lowerStockThreshold);
    }
    return 0.5;
}

export function commodityUnitPrice (stock: number, profile: CommodityPriceProfile): number
{
    return Math.round(profile.basePrice * commodityPriceMultiplier(stock, profile));
}

export function marginalTradeTotal (stock: number, quantity: number, profile: CommodityPriceProfile): number
{
    const direction = Math.sign(quantity);
    let currentStock = stock;
    let total = 0;
    for (let unit = 0; unit < Math.abs(quantity); unit++) {
        total += commodityUnitPrice(currentStock, profile);
        currentStock -= direction;
    }
    return total;
}
