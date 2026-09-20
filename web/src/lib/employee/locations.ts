/** Declared work locations. The location-conflict rule reads these as written. */
export const OFFICE_LOCATION = "Pittsburgh office";
export const REMOTE_LOCATION = "remote";

export const LOCATION_CHOICES = [
  { value: OFFICE_LOCATION, label: "Pittsburgh office" },
  { value: REMOTE_LOCATION, label: "Remote" },
  { value: "city", label: "Another city" },
] as const;

export type LocationChoice = (typeof LOCATION_CHOICES)[number]["value"];

export function locationFromChoice(choice: string, city: string): string {
  if (choice === "city") return city.trim();
  return choice;
}

export function choiceFromLocation(location: string): { choice: LocationChoice; city: string } {
  if (location === OFFICE_LOCATION || location === REMOTE_LOCATION) {
    return { choice: location, city: "" };
  }
  return { choice: "city", city: location };
}
