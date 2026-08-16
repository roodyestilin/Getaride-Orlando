import type { Place } from "./types";

// Airport-only service: every trip must start or end at MCO. This curated list
// mirrors the backend's known Orlando coordinates so fares & the MCO rule pass.
export const MCO: Place = {
  label: "Orlando Intl Airport (MCO)",
  lat: 28.4312,
  lng: -81.3081,
  airport: true,
  iata: "MCO",
};

export const ORLANDO_PLACES: Place[] = [
  MCO,
  { label: "Orlando Sanford Intl Airport (SFB)", lat: 28.7776, lng: -81.2375, airport: true, iata: "SFB" },
  { label: "Disney's Grand Floridian Resort & Spa", lat: 28.4108, lng: -81.5866 },
  { label: "Disney's Contemporary Resort", lat: 28.4153, lng: -81.5739 },
  { label: "Disney's Polynesian Village Resort", lat: 28.4071, lng: -81.5829 },
  { label: "Disney's Animal Kingdom Lodge", lat: 28.3553, lng: -81.6019 },
  { label: "Disney's Caribbean Beach Resort", lat: 28.3861, lng: -81.5497 },
  { label: "Disney's Pop Century Resort", lat: 28.3527, lng: -81.5418 },
  { label: "Loews Portofino Bay Hotel (Universal)", lat: 28.4727, lng: -81.4651 },
  { label: "Hard Rock Hotel (Universal)", lat: 28.4744, lng: -81.4671 },
  { label: "Universal's Cabana Bay Beach Resort", lat: 28.4660, lng: -81.4628 },
  { label: "Hilton Orlando Bonnet Creek", lat: 28.3506, lng: -81.5366 },
  { label: "Waldorf Astoria Orlando", lat: 28.3470, lng: -81.5380 },
  { label: "Gaylord Palms Resort & Convention Center", lat: 28.3380, lng: -81.5052 },
  { label: "JW Marriott Orlando Grande Lakes", lat: 28.3811, lng: -81.4439 },
  { label: "The Ritz-Carlton Orlando, Grande Lakes", lat: 28.3776, lng: -81.4416 },
  { label: "Rosen Shingle Creek", lat: 28.3839, lng: -81.4290 },
  { label: "Hyatt Regency Orlando", lat: 28.4256, lng: -81.4699 },
  { label: "Orlando World Center Marriott", lat: 28.3618, lng: -81.5008 },
  { label: "Universal Studios Florida", lat: 28.4754, lng: -81.4685 },
  { label: "Universal's Islands of Adventure", lat: 28.4719, lng: -81.4716 },
  { label: "Walt Disney World", lat: 28.3852, lng: -81.5639 },
  { label: "Disney Springs", lat: 28.3700, lng: -81.5180 },
  { label: "SeaWorld Orlando", lat: 28.4112, lng: -81.4615 },
  { label: "Orange County Convention Center", lat: 28.4264, lng: -81.4690 },
  { label: "Lake Eola Park", lat: 28.5439, lng: -81.3729 },
  { label: "Amway Center", lat: 28.5392, lng: -81.3839 },
  { label: "Winter Park Village", lat: 28.5997, lng: -81.3517 },
  { label: "ICON Park", lat: 28.4429, lng: -81.4685 },
  { label: "UCF Main Campus", lat: 28.6024, lng: -81.2001 },
  { label: "Orlando Premium Outlets", lat: 28.4242, lng: -81.4709 },
  { label: "Dr. Phillips Center", lat: 28.5378, lng: -81.3776 },
];
