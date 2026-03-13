/**
 * Commerce Service: Delivery (Uber Eats — CDP fallback)
 * Note: Uber Eats API is partner-only. Uses mock + CDP fallback.
 */

export interface DeliverySearchParams {
  location: string;
  cuisine?: string;
  maxPrice?: number;
}

export interface DeliveryResult {
  restaurant: string;
  cuisine: string;
  estimatedDelivery: string;
  deliveryFee: string;
  rating: number;
  priceRange: string;
}

export async function searchDelivery(params: DeliverySearchParams): Promise<{
  source: string;
  mock: boolean;
  results: DeliveryResult[];
  note?: string;
}> {
  // Uber Eats API requires partnership — always mock + CDP fallback
  return {
    source: "ubereats",
    mock: true,
    results: mockDelivery(params),
    note: "Uber Eats API requires partnership. Use CDP browser navigation for real results.",
  };
}

function mockDelivery(p: DeliverySearchParams): DeliveryResult[] {
  const cuisine = p.cuisine || "Various";
  return [
    { restaurant: `${cuisine} Express`, cuisine, estimatedDelivery: "25-35 min", deliveryFee: "USD 3.99", rating: 4.5, priceRange: "$$" },
    { restaurant: `Fast ${cuisine} Kitchen`, cuisine, estimatedDelivery: "30-45 min", deliveryFee: "USD 2.49", rating: 4.2, priceRange: "$" },
    { restaurant: `Premium ${cuisine} House`, cuisine, estimatedDelivery: "40-55 min", deliveryFee: "USD 5.99", rating: 4.8, priceRange: "$$$" },
  ];
}
