/**
 * Commerce Service: Transport (Uber API)
 * Fallback: mock mode when API not configured
 * Note: Uber Rides API requires partner approval — starts in mock mode
 */

function isConfigured(): boolean {
  return !!(process.env.UBER_CLIENT_ID && process.env.UBER_CLIENT_SECRET);
}

export interface TransportRequestParams {
  pickup: string;       // address or lat,lng
  destination: string;  // address or lat,lng
  userId: string;
}

export interface TransportResult {
  provider: string;
  estimatedPrice: string;
  estimatedTime: string;
  vehicleType: string;
  surge: boolean;
}

export async function requestTransport(params: TransportRequestParams): Promise<{
  source: string;
  mock: boolean;
  results: TransportResult[];
  error?: string;
}> {
  if (!isConfigured()) {
    return { source: "uber", mock: true, results: mockTransport(params) };
  }

  // Uber API integration would go here
  // For now, return mock since Uber Rides API requires partnership approval
  return { source: "uber", mock: true, results: mockTransport(params) };
}

function mockTransport(p: TransportRequestParams): TransportResult[] {
  return [
    { provider: "UberX", estimatedPrice: "USD 12.50 - 18.00", estimatedTime: "5 min", vehicleType: "Sedan", surge: false },
    { provider: "Uber Comfort", estimatedPrice: "USD 18.00 - 25.00", estimatedTime: "7 min", vehicleType: "Premium Sedan", surge: false },
    { provider: "Uber Black", estimatedPrice: "USD 35.00 - 50.00", estimatedTime: "10 min", vehicleType: "Luxury", surge: false },
  ];
}
