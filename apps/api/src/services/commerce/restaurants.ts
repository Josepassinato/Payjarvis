/**
 * Commerce Service: Restaurants (Yelp Fusion + OpenTable)
 * Yelp: https://docs.developer.yelp.com/reference/v3_business_search
 * OpenTable: fallback if available
 */

function isYelpConfigured(): boolean {
  return !!process.env.YELP_API_KEY;
}

export interface RestaurantSearchParams {
  location: string;
  date?: string;
  time?: string;
  covers?: number;
  cuisine?: string;
  priceRange?: string; // "1", "2", "3", "4" ($ to $$$$)
}

export interface RestaurantResult {
  name: string;
  rating: number;
  price: string;
  cuisine: string;
  address: string;
  phone: string;
  url: string;
  imageUrl: string;
  reviewCount: number;
  distance: string;
}

export async function searchRestaurants(params: RestaurantSearchParams): Promise<{
  source: string;
  mock: boolean;
  results: RestaurantResult[];
  error?: string;
}> {
  if (!isYelpConfigured()) {
    return { source: "yelp", mock: true, results: mockRestaurants(params) };
  }

  try {
    const query = new URLSearchParams({
      location: params.location,
      term: params.cuisine ? `${params.cuisine} restaurant` : "restaurant",
      limit: "10",
      sort_by: "rating",
    });
    if (params.priceRange) query.set("price", params.priceRange);

    // If time is provided, calculate open_at unix timestamp
    if (params.date && params.time) {
      const dt = new Date(`${params.date}T${params.time}:00`);
      if (!isNaN(dt.getTime())) {
        query.set("open_at", String(Math.floor(dt.getTime() / 1000)));
      }
    }

    const res = await fetch(`https://api.yelp.com/v3/businesses/search?${query}`, {
      headers: { Authorization: `Bearer ${process.env.YELP_API_KEY}` },
    });
    const data = await res.json() as any;

    if (!res.ok) {
      throw new Error(data.error?.description || "Yelp API error");
    }

    const results: RestaurantResult[] = (data.businesses || []).map((biz: any) => ({
      name: biz.name,
      rating: biz.rating,
      price: biz.price || "N/A",
      cuisine: (biz.categories || []).map((c: any) => c.title).join(", "),
      address: (biz.location?.display_address || []).join(", "),
      phone: biz.display_phone || "",
      url: biz.url,
      imageUrl: biz.image_url || "",
      reviewCount: biz.review_count,
      distance: biz.distance ? `${(biz.distance / 1000).toFixed(1)} km` : "N/A",
    }));

    return { source: "yelp", mock: false, results };
  } catch (err) {
    return {
      source: "yelp",
      mock: false,
      results: [],
      error: err instanceof Error ? err.message : "Restaurant search failed",
    };
  }
}

function mockRestaurants(p: RestaurantSearchParams): RestaurantResult[] {
  const cuisine = p.cuisine || "Italian";
  return [
    { name: `Trattoria Bella ${cuisine}`, rating: 4.5, price: "$$", cuisine, address: `123 Main St, ${p.location}`, phone: "(555) 123-4567", url: "#", imageUrl: "", reviewCount: 342, distance: "0.8 km" },
    { name: `${cuisine} Garden`, rating: 4.2, price: "$$$", cuisine, address: `456 Oak Ave, ${p.location}`, phone: "(555) 987-6543", url: "#", imageUrl: "", reviewCount: 218, distance: "1.2 km" },
    { name: `Casa de ${cuisine}`, rating: 4.8, price: "$$$$", cuisine, address: `789 Elm Blvd, ${p.location}`, phone: "(555) 456-7890", url: "#", imageUrl: "", reviewCount: 567, distance: "2.1 km" },
  ];
}
