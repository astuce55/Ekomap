// src/services/geocodingService.js

/**
 * Service de géocodage avec plusieurs alternatives
 * 1. Mapbox (gratuit, 100,000 requêtes/mois)
 * 2. Google Places (nécessite une clé API)
 * 3. LocationIQ (gratuit, 10,000 requêtes/jour)
 */

const MAPBOX_TOKEN = 'pk.eyJ1IjoiZWtvbWFwIiwiYSI6ImNtNXJxMzh3YTBkYzcybHB6dGRyaTJsMjgifQ.example'; // Remplacez par votre token

// Alternative gratuite : LocationIQ (pas besoin de carte de crédit)
const LOCATIONIQ_TOKEN = 'pk.your_locationiq_token_here'; // Optionnel

/**
 * Recherche de lieux avec Mapbox Geocoding API
 * Plus fiable et rapide que Nominatim
 */
export const searchPlacesMapbox = async (query, location = null) => {
  if (!query || query.length < 3) {
    return [];
  }

  try {
    // Construire l'URL avec le token Mapbox
    const proximity = location 
      ? `&proximity=${location.longitude},${location.latitude}`
      : '';
    
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=cm&limit=8&language=fr&types=place,address,poi${proximity}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return [];
    }

    // Transformer les résultats Mapbox en format compatible
    return data.features.map(feature => ({
      id: feature.id,
      name: feature.text,
      shortName: feature.text,
      address: feature.place_name,
      latitude: feature.center[1],
      longitude: feature.center[0],
      type: feature.place_type[0],
      relevance: feature.relevance,
    }));

  } catch (error) {
    console.error('Erreur Mapbox:', error);
    // Fallback vers LocationIQ
    return searchPlacesLocationIQ(query);
  }
};

/**
 * Alternative : LocationIQ Geocoding API (gratuit)
 * https://locationiq.com/ - 10,000 requêtes/jour gratuites
 */
export const searchPlacesLocationIQ = async (query) => {
  if (!query || query.length < 3) {
    return [];
  }

  try {
    const url = `https://us1.locationiq.com/v1/search.php?key=${LOCATIONIQ_TOKEN}&q=${encodeURIComponent(query)}&format=json&countrycodes=cm&limit=8&addressdetails=1`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    return data.map(place => ({
      id: place.place_id,
      name: place.display_name.split(',')[0],
      shortName: place.display_name.split(',')[0],
      address: place.display_name,
      latitude: parseFloat(place.lat),
      longitude: parseFloat(place.lon),
      type: place.type,
      class: place.class,
    }));

  } catch (error) {
    console.error('Erreur LocationIQ:', error);
    // Dernier recours : recherche locale basique
    return [];
  }
};

/**
 * Alternative : Photon (gratuit, open source, sans clé API)
 * Basé sur OpenStreetMap mais plus stable que Nominatim
 */
export const searchPlacesPhoton = async (query, location = null) => {
  if (!query || query.length < 3) {
    return [];
  }

  try {
    let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8&lang=fr`;
    
    // Ajouter la proximité si disponible
    if (location) {
      url += `&lat=${location.latitude}&lon=${location.longitude}`;
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return [];
    }

    return data.features.map(feature => ({
      id: feature.properties.osm_id,
      name: feature.properties.name || feature.properties.street || 'Sans nom',
      shortName: feature.properties.name || feature.properties.street || 'Sans nom',
      address: [
        feature.properties.name,
        feature.properties.street,
        feature.properties.city,
        feature.properties.state,
      ].filter(Boolean).join(', '),
      latitude: feature.geometry.coordinates[1],
      longitude: feature.geometry.coordinates[0],
      type: feature.properties.type || 'unknown',
    }));

  } catch (error) {
    console.error('Erreur Photon:', error);
    return [];
  }
};

/**
 * Fonction principale qui essaie plusieurs services
 */
export const searchPlaces = async (query, location = null) => {
  if (!query || query.length < 3) {
    return [];
  }

  try {
    // 1. Essayer Photon (gratuit, sans clé, stable)
    console.log('🔍 Recherche avec Photon...');
    const photonResults = await searchPlacesPhoton(query, location);
    if (photonResults.length > 0) {
      console.log('✅ Résultats trouvés avec Photon:', photonResults.length);
      return photonResults;
    }

    // 2. Si Photon échoue, essayer Mapbox (si token configuré)
    if (MAPBOX_TOKEN && MAPBOX_TOKEN !== 'pk.eyJ1IjoiZWtvbWFwIiwiYSI6ImNtNXJxMzh3YTBkYzcybHB6dGRyaTJsMjgifQ.example') {
      console.log('🔍 Recherche avec Mapbox...');
      const mapboxResults = await searchPlacesMapbox(query, location);
      if (mapboxResults.length > 0) {
        console.log('✅ Résultats trouvés avec Mapbox:', mapboxResults.length);
        return mapboxResults;
      }
    }

    // 3. Dernier recours : LocationIQ (si token configuré)
    if (LOCATIONIQ_TOKEN && LOCATIONIQ_TOKEN !== 'pk.your_locationiq_token_here') {
      console.log('🔍 Recherche avec LocationIQ...');
      const locationiqResults = await searchPlacesLocationIQ(query);
      if (locationiqResults.length > 0) {
        console.log('✅ Résultats trouvés avec LocationIQ:', locationiqResults.length);
        return locationiqResults;
      }
    }

    console.log('⚠️ Aucun résultat trouvé');
    return [];

  } catch (error) {
    console.error('❌ Erreur lors de la recherche:', error);
    return [];
  }
};

/**
 * Géocoder une adresse en coordonnées
 */
export const geocodeAddress = async (address) => {
  try {
    const results = await searchPlaces(address);
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Erreur de géocodage:', error);
    return null;
  }
};

/**
 * Géocodage inverse : coordonnées → adresse
 */
export const reverseGeocode = async (latitude, longitude) => {
  try {
    const url = `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}&lang=fr`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return null;
    }

    const feature = data.features[0];
    return {
      id: feature.properties.osm_id,
      name: feature.properties.name || 'Position',
      shortName: feature.properties.name || 'Position',
      address: [
        feature.properties.name,
        feature.properties.street,
        feature.properties.city,
        feature.properties.state,
      ].filter(Boolean).join(', '),
      latitude,
      longitude,
      type: feature.properties.type || 'unknown',
    };

  } catch (error) {
    console.error('Erreur de géocodage inverse:', error);
    return null;
  }
};

export default {
  searchPlaces,
  searchPlacesMapbox,
  searchPlacesLocationIQ,
  searchPlacesPhoton,
  geocodeAddress,
  reverseGeocode,
};