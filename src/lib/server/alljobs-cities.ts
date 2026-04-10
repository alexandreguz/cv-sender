// Centralised AllJobs city name → numeric city ID mapping.
// Used by both the scraper API route and the UI city dropdown.
// The city IDs are part of the AllJobs search URL: ?city={value}
// An empty value means "All Israel" (no city filter).

export type AllJobsCity = { label: string; value: string };

export const ALLJOBS_CITIES: AllJobsCity[] = [
  { label: "All Israel", value: "" },
  { label: "Jerusalem", value: "1056" },
  { label: "Tel Aviv", value: "779" },
  { label: "Haifa", value: "2" },
  { label: "Beer Sheva", value: "1961" },
  { label: "Modi'in", value: "1331" },
  { label: "Raanana", value: "1246" },
  { label: "Petah Tikva", value: "1208" },
  { label: "Rehovot", value: "1258" },
  { label: "Ashdod", value: "1017" },
  { label: "Rishon LeZion", value: "1260" },
  { label: "Netanya", value: "1175" },
  { label: "Remote", value: "" },
];

/** Returns the city entry matching a given label (case-insensitive), or undefined. */
export function findCityByLabel(label: string): AllJobsCity | undefined {
  return ALLJOBS_CITIES.find(
    (c) => c.label.toLowerCase() === label.toLowerCase()
  );
}
