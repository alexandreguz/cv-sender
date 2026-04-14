// Drushim city/area mapping for building search URLs.
// Drushim uses:
//   - areaPath: path segment for the URL (e.g. "area/18-19-20/")
//   - geolexid: numeric geographic area ID for fine-grained location filtering
//   - range: search radius in km
// Empty areaPath + empty geolexid means "All Israel" (no location filter).

export type DrushimCity = {
  label: string;
  areaPath: string;  // e.g. "area/18-19-20/" or "" for all
  geolexid: string;  // numeric ID or "" for all
  range: number;     // search radius in km
};

export const DRUSHIM_CITIES: DrushimCity[] = [
  { label: "All Israel",   areaPath: "",                  geolexid: "",       range: 0  },
  { label: "Jerusalem",    areaPath: "area/18-19-20/",    geolexid: "539070", range: 15 },
  { label: "Tel Aviv",     areaPath: "area/1-2-3-4-5/",   geolexid: "507010", range: 15 },
  { label: "Haifa",        areaPath: "area/6-7/",         geolexid: "527010", range: 15 },
  { label: "Beer Sheva",   areaPath: "area/13-14/",       geolexid: "525010", range: 15 },
  { label: "Modi'in",      areaPath: "area/15/",          geolexid: "534060", range: 10 },
  { label: "Netanya",      areaPath: "area/8/",           geolexid: "510010", range: 10 },
  { label: "Remote",       areaPath: "",                  geolexid: "",       range: 0  },
];

/** Builds a Drushim search URL from keyword + city config. */
export function buildDrushimUrl(keyword: string, city: DrushimCity, page = 1): string {
  const base = "https://www.drushim.co.il/jobs/";
  const params = new URLSearchParams();
  params.set("searchterm", keyword);
  if (city.geolexid) {
    params.set("geolexid", city.geolexid);
    params.set("range", String(city.range));
  }
  params.set("ssaen", "1"); // include English-language results
  if (page > 1) params.set("page", String(page));
  return `${base}${city.areaPath}?${params.toString()}`;
}
