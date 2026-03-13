/**
 * Commerce Service: Hotels (Amadeus API)
 */

const BASE = process.env.AMADEUS_ENV === "production"
  ? "https://api.amadeus.com"
  : "https://test.api.amadeus.com";

let token: string | null = null;
let tokenExpiry = 0;

function isConfigured(): boolean {
  return !!(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET);
}

async function getToken(): Promise<string> {
  if (token && Date.now() < tokenExpiry) return token;
  const res = await fetch(`${BASE}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${process.env.AMADEUS_CLIENT_ID}&client_secret=${process.env.AMADEUS_CLIENT_SECRET}`,
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data.error_description || "Amadeus auth failed");
  token = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return token!;
}

async function amadeusGet(path: string, params: Record<string, string> = {}): Promise<any> {
  const t = await getToken();
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}${path}${qs ? "?" + qs : ""}`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data.detail || JSON.stringify(data.errors?.[0]) || "Amadeus API error");
  return data;
}

export interface HotelSearchParams {
  city: string;       // IATA city code (e.g., "MIA", "GRU")
  checkIn: string;
  checkOut: string;
  adults?: number;
  maxPrice?: number;
}

export interface HotelResult {
  name: string;
  stars: string;
  price: string;
  pricePerNight: string;
  priceNumeric: number;
  rating: string;
  roomType: string;
  amenities: string;
}

function daysBetween(d1: string, d2: string): number {
  return Math.max(1, Math.ceil((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000));
}

export async function searchHotels(params: HotelSearchParams): Promise<{
  source: string;
  mock: boolean;
  results: HotelResult[];
  error?: string;
}> {
  if (!isConfigured()) {
    return { source: "amadeus", mock: true, results: mockHotels(params) };
  }

  try {
    // Step 1: Find hotels in city
    const listData = await amadeusGet("/v1/reference-data/locations/hotels/by-city", {
      cityCode: params.city,
      radius: "20",
      radiusUnit: "KM",
    });

    const hotelIds = (listData.data || []).slice(0, 20).map((h: any) => h.hotelId);
    if (hotelIds.length === 0) return { source: "amadeus", mock: false, results: [] };

    // Step 2: Get offers
    const offersData = await amadeusGet("/v3/shopping/hotel-offers", {
      hotelIds: hotelIds.join(","),
      checkInDate: params.checkIn,
      checkOutDate: params.checkOut,
      adults: String(params.adults ?? 1),
      currency: "USD",
    });

    const nights = daysBetween(params.checkIn, params.checkOut);

    const results: HotelResult[] = (offersData.data || []).slice(0, 8).map((hotel: any) => {
      const offer = hotel.offers?.[0];
      const total = offer ? parseFloat(offer.price.total) : 0;
      return {
        name: hotel.hotel?.name || "Unknown",
        stars: hotel.hotel?.rating || "N/A",
        price: offer ? `${offer.price.currency} ${offer.price.total}` : "N/A",
        pricePerNight: offer ? `${offer.price.currency} ${(total / nights).toFixed(2)}` : "N/A",
        priceNumeric: total,
        rating: hotel.hotel?.rating || "N/A",
        roomType: offer?.room?.typeEstimated?.category || "Standard",
        amenities: offer?.policies?.cancellations?.[0]?.description?.text || "Check policy",
      };
    });

    // Filter by maxPrice if specified
    const filtered = params.maxPrice
      ? results.filter((r) => r.priceNumeric <= params.maxPrice!)
      : results;

    return { source: "amadeus", mock: false, results: filtered };
  } catch (err) {
    return {
      source: "amadeus",
      mock: false,
      results: [],
      error: err instanceof Error ? err.message : "Hotel search failed",
    };
  }
}

function mockHotels(p: HotelSearchParams): HotelResult[] {
  return [
    { name: "Downtown Comfort Inn", stars: "4", price: "USD 480.00", pricePerNight: "USD 160.00", priceNumeric: 480, rating: "4.2", roomType: "Standard King", amenities: "WiFi, Pool, Gym" },
    { name: "City Center Hilton", stars: "5", price: "USD 750.00", pricePerNight: "USD 250.00", priceNumeric: 750, rating: "4.7", roomType: "Deluxe Double", amenities: "WiFi, Pool, Spa, Restaurant" },
    { name: "Budget Express Hotel", stars: "3", price: "USD 270.00", pricePerNight: "USD 90.00", priceNumeric: 270, rating: "3.8", roomType: "Standard Double", amenities: "WiFi, Parking" },
  ];
}
