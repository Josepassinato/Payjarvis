/**
 * Commerce Service: Flights (Amadeus API)
 * Sandbox: test.api.amadeus.com
 * Production: api.amadeus.com
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
  const url = `${BASE}${path}${qs ? "?" + qs : ""}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data.detail || JSON.stringify(data.errors?.[0]) || "Amadeus API error");
  return data;
}

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers?: number;
  cabin?: string;
}

export interface FlightResult {
  airline: string;
  flightNumber: string;
  departure: { airport: string; time: string };
  arrival: { airport: string; time: string };
  stops: number;
  duration: string;
  price: string;
  priceNumeric: number;
  cabin: string;
}

export async function searchFlights(params: FlightSearchParams): Promise<{
  source: string;
  mock: boolean;
  results: FlightResult[];
  error?: string;
}> {
  if (!isConfigured()) {
    return {
      source: "amadeus",
      mock: true,
      results: mockFlights(params),
    };
  }

  try {
    const query: Record<string, string> = {
      originLocationCode: params.origin,
      destinationLocationCode: params.destination,
      departureDate: params.departureDate,
      adults: String(params.passengers ?? 1),
      max: "8",
      currencyCode: "USD",
    };
    if (params.returnDate) query.returnDate = params.returnDate;
    if (params.cabin) query.travelClass = params.cabin.toUpperCase();

    const data = await amadeusGet("/v2/shopping/flight-offers", query);

    const results: FlightResult[] = (data.data || []).map((offer: any) => {
      const itin = offer.itineraries[0];
      const firstSeg = itin.segments[0];
      const lastSeg = itin.segments[itin.segments.length - 1];
      return {
        airline: firstSeg.carrierCode,
        flightNumber: `${firstSeg.carrierCode}${firstSeg.number}`,
        departure: { airport: firstSeg.departure.iataCode, time: firstSeg.departure.at },
        arrival: { airport: lastSeg.arrival.iataCode, time: lastSeg.arrival.at },
        stops: itin.segments.length - 1,
        duration: itin.duration,
        price: `${offer.price.currency} ${offer.price.total}`,
        priceNumeric: parseFloat(offer.price.total),
        cabin: offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin || params.cabin || "ECONOMY",
      };
    });

    return { source: "amadeus", mock: false, results };
  } catch (err) {
    return {
      source: "amadeus",
      mock: false,
      results: [],
      error: err instanceof Error ? err.message : "Flight search failed",
    };
  }
}

function mockFlights(p: FlightSearchParams): FlightResult[] {
  const cabin = p.cabin || "ECONOMY";
  return [
    {
      airline: "AA", flightNumber: "AA1234",
      departure: { airport: p.origin, time: `${p.departureDate}T08:00:00` },
      arrival: { airport: p.destination, time: `${p.departureDate}T13:30:00` },
      stops: 0, duration: "PT5H30M", price: "USD 342.00", priceNumeric: 342, cabin,
    },
    {
      airline: "DL", flightNumber: "DL567",
      departure: { airport: p.origin, time: `${p.departureDate}T06:00:00` },
      arrival: { airport: p.destination, time: `${p.departureDate}T14:15:00` },
      stops: 1, duration: "PT8H15M", price: "USD 289.00", priceNumeric: 289, cabin,
    },
    {
      airline: "UA", flightNumber: "UA2345",
      departure: { airport: p.origin, time: `${p.departureDate}T14:00:00` },
      arrival: { airport: p.destination, time: `${p.departureDate}T18:50:00` },
      stops: 0, duration: "PT4H50M", price: "USD 415.00", priceNumeric: 415, cabin,
    },
  ];
}
