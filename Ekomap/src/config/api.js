// src/config/api.js

// Configuration des clés API
export const API_KEYS = {
  // Google Places API - Obtenez votre clé gratuite sur:
  // https://console.cloud.google.com/google/maps-apis/credentials
  GOOGLE_PLACES: 'VOTRE_CLE_GOOGLE_PLACES_ICI',
  
  // Alternative: Mapbox (aussi gratuit)
  // https://account.mapbox.com/access-tokens/
  MAPBOX: 'VOTRE_CLE_MAPBOX_ICI',
};

// URLs des services
export const API_ENDPOINTS = {
  // Google Places Autocomplete
  GOOGLE_AUTOCOMPLETE: 'https://maps.googleapis.com/maps/api/place/autocomplete/json',
  GOOGLE_PLACE_DETAILS: 'https://maps.googleapis.com/maps/api/place/details/json',
  GOOGLE_GEOCODING: 'https://maps.googleapis.com/maps/api/geocode/json',
  
  // Mapbox Geocoding
  MAPBOX_GEOCODING: 'https://api.mapbox.com/geocoding/v5/mapbox.places',
  
  // OSRM (gratuit, pas de clé nécessaire)
  OSRM_ROUTING: 'https://router.project-osrm.org/route/v1',
};

export default {
  API_KEYS,
  API_ENDPOINTS,
};