/**
 * Demo shopper details for the checkout forms.
 *
 * Each order gets a fresh, fake identity so test Pixel / Conversions API events
 * are unique per order:
 *   name, email, phone      randomuser.me (emails are always @example.com)
 *   approximate location    ipwho.is, falling back to get.geojs.io
 *   nearby street + postcode OpenStreetMap Nominatim reverse geocoding
 *
 * Every lookup times out quickly and has a local fallback, so checkout never
 * waits on the network. Lookups only run once the shopper opens the bag.
 */

const LOOKUP_TIMEOUT_MS = 4000;

/** Countries randomuser.me can generate people for (lower-case ISO codes). */
const RANDOMUSER_NATIONALITIES = new Set([
  'au', 'br', 'ca', 'ch', 'de', 'dk', 'es', 'fi', 'fr', 'gb',
  'ie', 'in', 'mx', 'nl', 'no', 'nz', 'rs', 'tr', 'ua', 'us',
]);

/** Used when every location lookup fails. */
const FALLBACK_LOCATION = {
  city: 'Brooklyn',
  region: 'New York',
  postcode: '11205',
  country: 'United States',
  countryCode: 'US',
  latitude: 40.6894,
  longitude: -73.975,
};

const FALLBACK_FIRST_NAMES = ['Alex', 'Jordan', 'Sam', 'Riley', 'Casey', 'Morgan', 'Taylor', 'Jamie'];
const FALLBACK_LAST_NAMES = ['Rivera', 'Chen', 'Okafor', 'Novak', 'Haddad', 'Larsen', 'Patel', 'Moreau'];
const FALLBACK_STREETS = ['Dekalb Ave', 'Fulton St', 'Myrtle Ave', 'Lafayette Ave', 'Vanderbilt Ave'];

let locationPromise; // the visitor's IP location is looked up once per page load

/* ----- Helpers ----- */

const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = (list) => list[randomInt(0, list.length - 1)];

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status} from ${url}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/* ----- Location from IP ----- */

async function lookupFromIpwho() {
  const data = await fetchJson('https://ipwho.is/');
  if (!data.success) throw new Error('ipwho.is lookup failed');

  return {
    city: data.city,
    region: data.region,
    postcode: data.postal,
    country: data.country,
    countryCode: data.country_code,
    latitude: data.latitude,
    longitude: data.longitude,
  };
}

async function lookupFromGeojs() {
  const data = await fetchJson('https://get.geojs.io/v1/ip/geo.json');

  return {
    city: data.city,
    region: data.region,
    postcode: '',
    country: data.country,
    countryCode: data.country_code,
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
  };
}

function lookupVisitorLocation() {
  locationPromise ??= lookupFromIpwho()
    .catch(lookupFromGeojs)
    .catch(() => FALLBACK_LOCATION);
  return locationPromise;
}

/* ----- A real street near that location ----- */

async function nearbyAddress(location) {
  // Up to ~1 km away, so each order lands on a different nearby street.
  const latitude = location.latitude + (Math.random() - 0.5) * 0.02;
  const longitude = location.longitude + (Math.random() - 0.5) * 0.02;

  const data = await fetchJson(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&addressdetails=1&lat=${latitude}&lon=${longitude}`,
  );
  const address = data.address ?? {};
  if (!address.road) throw new Error('no street found nearby');

  return {
    street: `${address.house_number ?? randomInt(1, 450)} ${address.road}`,
    city: address.borough ?? address.city ?? address.town ?? address.village ?? location.city,
    region: address.state ?? location.region,
    postcode: address.postcode ?? location.postcode,
  };
}

function fallbackAddress(location) {
  return {
    street: `${randomInt(1, 450)} ${pick(FALLBACK_STREETS)}`,
    city: location.city || FALLBACK_LOCATION.city,
    region: location.region || FALLBACK_LOCATION.region,
    postcode: location.postcode || FALLBACK_LOCATION.postcode,
  };
}

/* ----- A random person ----- */

async function randomPerson(countryCode) {
  const nationality = RANDOMUSER_NATIONALITIES.has(countryCode?.toLowerCase())
    ? countryCode.toLowerCase()
    : 'us';

  const data = await fetchJson(
    `https://randomuser.me/api/?nat=${nationality}&inc=name,email,phone&noinfo`,
  );
  const person = data.results[0];

  return {
    firstName: person.name.first,
    lastName: person.name.last,
    email: person.email,
    phone: person.phone,
  };
}

function fallbackPerson() {
  const firstName = pick(FALLBACK_FIRST_NAMES);
  const lastName = pick(FALLBACK_LAST_NAMES);

  return {
    firstName,
    lastName,
    email: `${firstName}.${lastName}.${randomInt(100, 999)}@example.com`.toLowerCase(),
    phone: `(${randomInt(200, 989)}) ${randomInt(200, 989)}-${String(randomInt(0, 9999)).padStart(4, '0')}`,
  };
}

/* ----- Public ----- */

/**
 * A fresh fake shopper near the visitor's IP location.
 * @returns {Promise<{firstName, lastName, email, phone, street, city, region, postcode, country, countryCode}>}
 */
export async function createDemoShopper() {
  const location = await lookupVisitorLocation();

  const [person, address] = await Promise.all([
    randomPerson(location.countryCode).catch(fallbackPerson),
    nearbyAddress(location).catch(() => fallbackAddress(location)),
  ]);

  return {
    ...person,
    ...address,
    country: location.country || FALLBACK_LOCATION.country,
    countryCode: location.countryCode || FALLBACK_LOCATION.countryCode,
  };
}
