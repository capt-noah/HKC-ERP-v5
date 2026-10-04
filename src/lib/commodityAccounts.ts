/**
 * HKC ERP v5 - Centralized Commodity Account Resolver
 * 
 * Maps export warehouse (WH1) commodities and processing items
 * to their respective Revenue (4000-02-xx), Stock/Inventory (1410-xx),
 * and Cost of Goods Sold / COGS (5010-xx) chart of accounts entries.
 */

export interface CommodityAccountSet {
  revenueCode: string;
  revenueName: string;
  inventoryCode: string;
  inventoryName: string;
  cogsCode: string;
  cogsName: string;
}

export function resolveCommodityAccounts(itemName: string = ""): CommodityAccountSet {
  const norm = (itemName || "").trim().toUpperCase();

  if (norm.includes("SOYA") || norm.includes("SOY")) {
    return {
      revenueCode: "4000-02-02",
      revenueName: "EXPORT REVENUE - SOYA BEAN",
      inventoryCode: "1410-02",
      inventoryName: "STOCK OF SOYA BEAN",
      cogsCode: "5010-02",
      cogsName: "COST OF SOYA BEAN",
    };
  }

  if (norm.includes("RED") && norm.includes("SESAME")) {
    return {
      revenueCode: "4000-02-03",
      revenueName: "EXPORT REVENUE - REDDISH SESAME SEED",
      inventoryCode: "1410-03",
      inventoryName: "STOCK OF REDDISH SESAME SEED",
      cogsCode: "5010-03",
      cogsName: "COST OF REDDISH SESAME SEED",
    };
  }

  if (norm.includes("SESAME")) {
    return {
      revenueCode: "4000-02-04",
      revenueName: "EXPORT REVENUE - WHITE SESAME SEED",
      inventoryCode: "1410-04",
      inventoryName: "STOCK OF WHITE SESAME SEED",
      cogsCode: "5010-04",
      cogsName: "COST OF WHITE SESAME SEED",
    };
  }

  if (
    norm.includes("PULSE") ||
    norm.includes("BEAN") && !norm.includes("MUNG") ||
    norm.includes("GRAIN") ||
    norm.includes("CROP") ||
    norm.includes("NIGER") ||
    norm.includes("CHICKPEA")
  ) {
    return {
      revenueCode: "4000-02-05",
      revenueName: "EXPORT REVENUE - OTHER CROPS",
      inventoryCode: "1410-05",
      inventoryName: "STOCK OF OTHER EXPORT CROPS",
      cogsCode: "5010-05",
      cogsName: "COST OF OTHER EXPORT CROPS",
    };
  }

  // Default Export Commodity: Green Mung Bean
  return {
    revenueCode: "4000-02-01",
    revenueName: "EXPORT REVENUE - GREEN MUNG BEAN",
    inventoryCode: "1410-01",
    inventoryName: "STOCK OF GREEN MUNG",
    cogsCode: "5010-01",
    cogsName: "COST OF GREEN MUNG BEAN",
  };
}
