/**
 * Commerce Service: Events (Ticketmaster Discovery API)
 * Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 */

function isConfigured(): boolean {
  return !!process.env.TICKETMASTER_API_KEY;
}

export interface EventSearchParams {
  city: string;
  category?: string;    // "music", "sports", "arts", "film", "miscellaneous"
  keyword?: string;
  startDate?: string;   // ISO date
  endDate?: string;
}

export interface EventResult {
  name: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  priceRange: string;
  url: string;
  imageUrl: string;
  genre: string;
}

export async function searchEvents(params: EventSearchParams): Promise<{
  source: string;
  mock: boolean;
  results: EventResult[];
  error?: string;
}> {
  if (!isConfigured()) {
    return { source: "ticketmaster", mock: true, results: mockEvents(params) };
  }

  try {
    const query = new URLSearchParams({
      apikey: process.env.TICKETMASTER_API_KEY!,
      city: params.city,
      size: "10",
      sort: "date,asc",
    });
    if (params.category) query.set("classificationName", params.category);
    if (params.keyword) query.set("keyword", params.keyword);
    if (params.startDate) query.set("startDateTime", `${params.startDate}T00:00:00Z`);
    if (params.endDate) query.set("endDateTime", `${params.endDate}T23:59:59Z`);

    const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${query}`);
    const data = await res.json() as any;

    if (!res.ok) {
      throw new Error(data.fault?.faultstring || "Ticketmaster API error");
    }

    const events = data._embedded?.events || [];

    const results: EventResult[] = events.map((evt: any) => {
      const priceMin = evt.priceRanges?.[0]?.min;
      const priceMax = evt.priceRanges?.[0]?.max;
      const priceCurrency = evt.priceRanges?.[0]?.currency || "USD";
      const priceRange = priceMin
        ? `${priceCurrency} ${priceMin}${priceMax ? ` - ${priceMax}` : ""}`
        : "See website";

      return {
        name: evt.name,
        date: evt.dates?.start?.localDate || "TBD",
        time: evt.dates?.start?.localTime || "TBD",
        venue: evt._embedded?.venues?.[0]?.name || "TBD",
        city: evt._embedded?.venues?.[0]?.city?.name || params.city,
        priceRange,
        url: evt.url || "",
        imageUrl: evt.images?.[0]?.url || "",
        genre: evt.classifications?.[0]?.genre?.name || evt.classifications?.[0]?.segment?.name || "General",
      };
    });

    return { source: "ticketmaster", mock: false, results };
  } catch (err) {
    return {
      source: "ticketmaster",
      mock: false,
      results: [],
      error: err instanceof Error ? err.message : "Event search failed",
    };
  }
}

function mockEvents(p: EventSearchParams): EventResult[] {
  const city = p.city;
  const category = p.category || "music";
  return [
    { name: `${city} Jazz Festival`, date: p.startDate || "2026-04-15", time: "20:00", venue: `${city} Arena`, city, priceRange: "USD 45 - 120", url: "#", imageUrl: "", genre: category },
    { name: `${category.charAt(0).toUpperCase() + category.slice(1)} Night Live`, date: p.startDate || "2026-04-16", time: "21:00", venue: `Downtown Theater`, city, priceRange: "USD 30 - 85", url: "#", imageUrl: "", genre: category },
    { name: `International ${category} Show`, date: p.startDate || "2026-04-20", time: "19:30", venue: `Convention Center`, city, priceRange: "USD 55 - 200", url: "#", imageUrl: "", genre: category },
  ];
}
