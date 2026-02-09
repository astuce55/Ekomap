// src/api/routing.js
// Service de calcul d'itinéraires : normal et optimisé
// Version améliorée utilisant les routes alternatives d'OSRM

// Vitesses moyennes réelles (km/h)
const SPEEDS = {
  driving: 30,    // 30 km/h en ville
  bicycling: 15,  // 15 km/h à vélo
  walking: 5,     // 5 km/h à pied
};

/**
 * Calcule un itinéraire normal en utilisant OSRM
 */
export const calculateNormalRoute = async (startPoint, endPoint, mode = 'driving') => {
  try {
    const osrmMode = mode === 'driving' ? 'car' : mode === 'bicycling' ? 'bike' : 'foot';
    
    const url = `https://router.project-osrm.org/route/v1/${osrmMode}/${startPoint.longitude},${startPoint.latitude};${endPoint.longitude},${endPoint.latitude}?overview=full&geometries=geojson&steps=true`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error(data.message || 'Impossible de calculer l\'itinéraire');
    }

    const route = data.routes[0];
    const coordinates = route.geometry.coordinates.map(coord => ({
      latitude: coord[1],
      longitude: coord[0],
    }));

    // Calculer le temps basé sur la distance et la vitesse du mode
    const distanceKm = route.distance / 1000;
    const speed = SPEEDS[mode] || SPEEDS.driving;
    const durationSeconds = (distanceKm / speed) * 3600;

    return {
      coordinates,
      distance: route.distance,
      duration: durationSeconds,
      type: 'normal',
      steps: route.legs[0]?.steps || []
    };
  } catch (error) {
    console.error('Erreur calcul itinéraire normal:', error);
    throw error;
  }
};

/**
 * Calcule un itinéraire optimisé en utilisant les ROUTES ALTERNATIVES d'OSRM
 * Cette approche est plus fiable car elle utilise de vraies routes existantes
 */
export const calculateOptimizedRoute = async (startPoint, endPoint, incidents = [], trafficData = [], mode = 'driving') => {
  try {
    // 1. Identifier tous les obstacles
    const obstacles = [
      ...incidents.map(inc => ({
        lat: inc.coordinates.lat,
        lng: inc.coordinates.lng,
        type: 'incident',
        severity: inc.type === 'accident' ? 3 : inc.type === 'danger' ? 2 : 1
      })),
      ...trafficData
        .filter(traffic => traffic.statut === 'Embouteillage' || traffic.alerte_active)
        .map(traffic => ({
          lat: traffic.coordinates.lat,
          lng: traffic.coordinates.lng,
          type: 'traffic',
          severity: traffic.taux_immobilite >= 0.8 ? 3 : traffic.taux_immobilite >= 0.5 ? 2 : 1
        }))
    ];

    console.log(`🚧 Obstacles détectés : ${obstacles.length}`);

    // Si pas d'obstacles, retourner l'itinéraire normal
    if (obstacles.length === 0) {
      const normalRoute = await calculateNormalRoute(startPoint, endPoint, mode);
      return {
        ...normalRoute,
        type: 'optimized',
        obstaclesAvoided: 0,
        safetyScore: 100,
        warning: null
      };
    }

    // 2. Demander plusieurs routes alternatives à OSRM
    const osrmMode = mode === 'driving' ? 'car' : mode === 'bicycling' ? 'bike' : 'foot';
    
    // CORRECTION ICI : On demande explicitement 3 alternatives (chiffre stable pour le serveur démo)
    // On retire la duplication "&alternatives=true" qui causait l'erreur
    const url = `https://router.project-osrm.org/route/v1/${osrmMode}/${startPoint.longitude},${startPoint.latitude};${endPoint.longitude},${endPoint.latitude}?overview=full&geometries=geojson&steps=true&alternatives=3`;

    console.log(`🌍 Appel OSRM Optimisé : ${url}`);

    const response = await fetch(url);
    const data = await response.json();

    // Vérification plus stricte et log de l'erreur réelle
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.error('⚠️ Réponse OSRM:', data);
      throw new Error(data.message || `Erreur OSRM: ${data.code}`);
    }

    console.log(`📍 ${data.routes.length} route(s) trouvée(s) par OSRM`);

    // 3. Analyser chaque route alternative
    const analyzedRoutes = data.routes.map((route, index) => {
      const coordinates = route.geometry.coordinates.map(coord => ({
        latitude: coord[1],
        longitude: coord[0],
      }));

      // Compter les obstacles sur cette route
      const obstaclesOnRoute = findObstaclesOnRoute(coordinates, obstacles);
      
      // Calculer le score de sécurité
      const safetyScore = calculateSafetyScore(coordinates, obstacles);

      // Calculer le temps basé sur la distance et la vitesse
      const distanceKm = route.distance / 1000;
      const speed = SPEEDS[mode] || SPEEDS.driving;
      const durationSeconds = (distanceKm / speed) * 3600;

      return {
        index,
        coordinates,
        distance: route.distance,
        duration: durationSeconds,
        obstaclesCount: obstaclesOnRoute.length,
        safetyScore,
        obstaclesOnRoute
      };
    });

    // Afficher l'analyse dans la console
    console.log(`📊 Analyse des routes :`);
    analyzedRoutes.forEach((r, i) => {
      console.log(`  Route ${i + 1}: ${r.obstaclesCount} obstacle(s), sécurité ${r.safetyScore}%, ${formatDistance(r.distance)}`);
    });

    // 4. Trier les routes par sécurité d'abord, puis par distance
    const sortedRoutes = [...analyzedRoutes].sort((a, b) => {
      // Priorité 1 : Moins d'obstacles
      if (a.obstaclesCount !== b.obstaclesCount) {
        return a.obstaclesCount - b.obstaclesCount;
      }
      // Priorité 2 : Meilleur score de sécurité
      if (Math.abs(a.safetyScore - b.safetyScore) > 10) {
        return b.safetyScore - a.safetyScore;
      }
      // Priorité 3 : Distance la plus courte
      return a.distance - b.distance;
    });

    // 5. Sélectionner la meilleure route
    const bestRoute = sortedRoutes[0];
    const normalRoute = analyzedRoutes[0]; // La première route OSRM est toujours la plus rapide par défaut

    // 6. Générer un avertissement si nécessaire
    let warning = null;
    if (bestRoute.obstaclesCount > 0) {
      if (bestRoute.obstaclesCount === normalRoute.obstaclesCount && sortedRoutes.every(r => r.obstaclesCount === normalRoute.obstaclesCount)) {
        // Toutes les routes passent par le même nombre d'obstacles
        warning = `⚠️ ${bestRoute.obstaclesCount} obstacle(s) sur le trajet. Aucune route alternative disponible pour les éviter.`;
      } else if (bestRoute.obstaclesCount < normalRoute.obstaclesCount) {
        // On a trouvé une meilleure route
        const avoided = normalRoute.obstaclesCount - bestRoute.obstaclesCount;
        warning = `✓ ${avoided} obstacle(s) évité(s) via route alternative, mais ${bestRoute.obstaclesCount} reste(nt) sur le trajet.`;
      }
    }

    console.log(`✅ Meilleure route : Route ${bestRoute.index + 1}`);
    if (warning) console.log(warning);

    return {
      coordinates: bestRoute.coordinates,
      distance: bestRoute.distance,
      duration: bestRoute.duration,
      type: 'optimized',
      obstaclesAvoided: Math.max(0, normalRoute.obstaclesCount - bestRoute.obstaclesCount),
      safetyScore: bestRoute.safetyScore,
      warning,
      steps: []
    };

  } catch (error) {
    console.error('❌ Erreur calcul itinéraire optimisé:', error);
    
    // Fallback sur l'itinéraire normal en cas d'échec
    console.log('🔄 Tentative de bascule sur l\'itinéraire normal...');
    try {
        const normalRoute = await calculateNormalRoute(startPoint, endPoint, mode);
        return {
        ...normalRoute,
        type: 'optimized',
        obstaclesAvoided: 0,
        safetyScore: 50,
        warning: '⚠️ Impossible de calculer une route alternative (Erreur serveur)'
        };
    } catch (fallbackError) {
        throw error; // Si même le normal échoue, on renvoie l'erreur
    }
  }
};

/**
 * Trouve les obstacles qui sont proches de l'itinéraire
 */
const findObstaclesOnRoute = (routeCoordinates, obstacles) => {
  const DANGER_DISTANCE = 0.003; // ~300m de distance de danger
  const obstaclesFound = [];

  obstacles.forEach(obstacle => {
    for (let i = 0; i < routeCoordinates.length - 1; i++) {
      const segmentStart = routeCoordinates[i];
      const segmentEnd = routeCoordinates[i + 1];
      
      const distanceToSegment = pointToLineSegmentDistance(
        obstacle.lat,
        obstacle.lng,
        segmentStart.latitude,
        segmentStart.longitude,
        segmentEnd.latitude,
        segmentEnd.longitude
      );

      if (distanceToSegment < DANGER_DISTANCE * obstacle.severity) {
        if (!obstaclesFound.find(o => o.lat === obstacle.lat && o.lng === obstacle.lng)) {
          obstaclesFound.push({
            ...obstacle,
            segmentIndex: i,
            distanceToRoute: distanceToSegment
          });
        }
        break;
      }
    }
  });

  return obstaclesFound;
};

/**
 * Calcule la distance d'un point à un segment de ligne
 */
const pointToLineSegmentDistance = (px, py, x1, y1, x2, y2) => {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;

  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Calcule un score de sécurité pour un itinéraire
 */
const calculateSafetyScore = (routeCoordinates, obstacles) => {
  if (obstacles.length === 0) return 100;

  const DANGER_THRESHOLD = 0.003; // ~300m
  let dangerPoints = 0;

  routeCoordinates.forEach(coord => {
    obstacles.forEach(obstacle => {
      const distance = getDistance(
        coord.latitude,
        coord.longitude,
        obstacle.lat,
        obstacle.lng
      );

      if (distance < DANGER_THRESHOLD) {
        dangerPoints += obstacle.severity;
      }
    });
  });

  const totalPoints = routeCoordinates.length;
  // Ajustement pour éviter les scores négatifs ou absurdes
  const dangerRatio = dangerPoints / (totalPoints * 3);
  const score = Math.max(0, Math.min(100, 100 - (dangerRatio * 100)));

  return Math.round(score);
};

/**
 * Calcule la distance entre deux points GPS
 */
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (deg) => {
  return deg * (Math.PI / 180);
};

/**
 * Formate la distance pour l'affichage
 */
export const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
};

/**
 * Formate la durée pour l'affichage
 */
export const formatDuration = (seconds) => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}min`;
};

/**
 * Calcule les deux itinéraires en parallèle
 */
export const calculateBothRoutes = async (startPoint, endPoint, incidents, trafficData, mode) => {
  try {
    const [normalRoute, optimizedRoute] = await Promise.all([
      calculateNormalRoute(startPoint, endPoint, mode),
      calculateOptimizedRoute(startPoint, endPoint, incidents, trafficData, mode)
    ]);

    return {
      normal: normalRoute,
      optimized: optimizedRoute,
      comparison: {
        timeDiff: optimizedRoute.duration - normalRoute.duration,
        distanceDiff: optimizedRoute.distance - normalRoute.distance,
        safetyImprovement: optimizedRoute.safetyScore - 50
      }
    };
  } catch (error) {
    console.error('Erreur calcul des deux itinéraires:', error);
    throw error;
  }
};

export default {
  calculateNormalRoute,
  calculateOptimizedRoute,
  calculateBothRoutes,
  formatDistance,
  formatDuration
};