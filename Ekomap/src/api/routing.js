// src/api/routing.js
// Service de calcul d'itinéraires : normal et optimisé
// Version améliorée avec waypoints de contournement

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

    // Calculer le temps basé sur la distance réelle de la route et la vitesse du mode
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
 * Calcule un itinéraire optimisé qui évite les obstacles
 * Stratégie en 3 étapes:
 * 1. Essayer les routes alternatives d'OSRM
 * 2. Si toutes passent par des obstacles, générer des waypoints de contournement
 * 3. Calculer un itinéraire avec ces waypoints
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

    // 2. ÉTAPE 1: Essayer les routes alternatives d'OSRM
    const osrmMode = mode === 'driving' ? 'car' : mode === 'bicycling' ? 'bike' : 'foot';
    
    let alternativesUrl = `https://router.project-osrm.org/route/v1/${osrmMode}/${startPoint.longitude},${startPoint.latitude};${endPoint.longitude},${endPoint.latitude}?overview=full&geometries=geojson&steps=true&alternatives=3`;

    console.log(`🌍 Recherche de routes alternatives...`);

    let response = await fetch(alternativesUrl);
    let data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.warn('⚠️ Échec récupération routes alternatives, fallback sur route normale');
      const normalRoute = await calculateNormalRoute(startPoint, endPoint, mode);
      return {
        ...normalRoute,
        type: 'optimized',
        obstaclesAvoided: 0,
        safetyScore: 50,
        warning: '⚠️ Impossible de trouver une route alternative'
      };
    }

    console.log(`📍 ${data.routes.length} route(s) trouvée(s)`);

    // 3. Analyser chaque route alternative
    const analyzedRoutes = data.routes.map((route, index) => {
      const coordinates = route.geometry.coordinates.map(coord => ({
        latitude: coord[1],
        longitude: coord[0],
      }));

      const obstaclesOnRoute = findObstaclesOnRoute(coordinates, obstacles);
      const safetyScore = calculateSafetyScore(coordinates, obstacles);

      // Calculer le temps basé sur la distance réelle et la vitesse
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

    // Afficher l'analyse
    console.log(`📊 Analyse des routes alternatives :`);
    analyzedRoutes.forEach((r, i) => {
      console.log(`  Route ${i + 1}: ${r.obstaclesCount} obstacle(s), sécurité ${r.safetyScore}%, ${formatDistance(r.distance)}, ${formatDuration(r.duration)}`);
    });

    // 4. Trouver la meilleure route
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

    const bestAlternativeRoute = sortedRoutes[0];
    const normalRoute = analyzedRoutes[0]; // La route normale est toujours la première

    // 5. ÉTAPE 2: Si la meilleure route a encore trop d'obstacles, essayer avec waypoints
    const ACCEPTABLE_OBSTACLES = 0; // On veut vraiment éviter tous les obstacles
    
    if (bestAlternativeRoute.obstaclesCount > ACCEPTABLE_OBSTACLES) {
      console.log(`⚠️ Meilleure route alternative a ${bestAlternativeRoute.obstaclesCount} obstacle(s)`);
      console.log(`🔄 Tentative de contournement avec waypoints...`);

      // Générer des waypoints de contournement
      const avoidanceWaypoints = generateAvoidanceWaypoints(
        startPoint,
        endPoint,
        obstacles,
        bestAlternativeRoute.obstaclesOnRoute
      );

      if (avoidanceWaypoints.length > 0) {
        console.log(`📍 ${avoidanceWaypoints.length} waypoint(s) de contournement généré(s)`);

        // Construire l'URL avec les waypoints
        const allPoints = [startPoint, ...avoidanceWaypoints, endPoint];
        const pointsString = allPoints
          .map(p => `${p.longitude},${p.latitude}`)
          .join(';');

        const waypointsUrl = `https://router.project-osrm.org/route/v1/${osrmMode}/${pointsString}?overview=full&geometries=geojson&steps=true`;

        try {
          const wpResponse = await fetch(waypointsUrl);
          const wpData = await wpResponse.json();

          if (wpData.code === 'Ok' && wpData.routes && wpData.routes.length > 0) {
            const wpRoute = wpData.routes[0];
            const wpCoordinates = wpRoute.geometry.coordinates.map(coord => ({
              latitude: coord[1],
              longitude: coord[0],
            }));

            const wpObstacles = findObstaclesOnRoute(wpCoordinates, obstacles);
            const wpSafetyScore = calculateSafetyScore(wpCoordinates, obstacles);

            // Calculer le temps pour cette route avec waypoints
            const wpDistanceKm = wpRoute.distance / 1000;
            const speed = SPEEDS[mode] || SPEEDS.driving;
            const wpDurationSeconds = (wpDistanceKm / speed) * 3600;

            console.log(`✅ Route avec waypoints: ${wpObstacles.length} obstacle(s), sécurité ${wpSafetyScore}%, ${formatDistance(wpRoute.distance)}, ${formatDuration(wpDurationSeconds)}`);

            // Si la route avec waypoints est meilleure, l'utiliser
            if (wpObstacles.length < bestAlternativeRoute.obstaclesCount || wpSafetyScore > bestAlternativeRoute.safetyScore + 10) {
              console.log(`🎯 Route avec waypoints sélectionnée (meilleure)`);
              
              return {
                coordinates: wpCoordinates,
                distance: wpRoute.distance,
                duration: wpDurationSeconds,
                type: 'optimized',
                obstaclesAvoided: Math.max(0, normalRoute.obstaclesCount - wpObstacles.length),
                safetyScore: wpSafetyScore,
                warning: wpObstacles.length > 0 
                  ? `⚠️ ${wpObstacles.length} obstacle(s) sur le trajet (impossible d'éviter complètement)`
                  : null,
                steps: []
              };
            }
          }
        } catch (waypointError) {
          console.warn('⚠️ Erreur avec waypoints, utilisation de la meilleure alternative');
        }
      }
    }

    // 6. Retourner la meilleure route trouvée
    console.log(`✅ Meilleure route : Route ${bestAlternativeRoute.index + 1}`);

    let warning = null;
    if (bestAlternativeRoute.obstaclesCount > 0) {
      if (bestAlternativeRoute.obstaclesCount < normalRoute.obstaclesCount) {
        const avoided = normalRoute.obstaclesCount - bestAlternativeRoute.obstaclesCount;
        warning = `✓ ${avoided} obstacle(s) évité(s), mais ${bestAlternativeRoute.obstaclesCount} reste(nt) sur le trajet`;
      } else {
        warning = `⚠️ ${bestAlternativeRoute.obstaclesCount} obstacle(s) sur le trajet (aucune route alternative sans obstacles)`;
      }
    }

    if (warning) console.log(warning);

    return {
      coordinates: bestAlternativeRoute.coordinates,
      distance: bestAlternativeRoute.distance,
      duration: bestAlternativeRoute.duration, // Temps réel calculé selon la distance
      type: 'optimized',
      obstaclesAvoided: Math.max(0, normalRoute.obstaclesCount - bestAlternativeRoute.obstaclesCount),
      safetyScore: bestAlternativeRoute.safetyScore,
      warning,
      steps: []
    };

  } catch (error) {
    console.error('❌ Erreur calcul itinéraire optimisé:', error);
    
    // Fallback sur l'itinéraire normal
    console.log('🔄 Fallback sur itinéraire normal...');
    try {
      const normalRoute = await calculateNormalRoute(startPoint, endPoint, mode);
      return {
        ...normalRoute,
        type: 'optimized',
        obstaclesAvoided: 0,
        safetyScore: 50,
        warning: '⚠️ Erreur lors du calcul de la route optimisée'
      };
    } catch (fallbackError) {
      throw error;
    }
  }
};

/**
 * Génère des waypoints pour contourner les obstacles
 */
const generateAvoidanceWaypoints = (startPoint, endPoint, allObstacles, obstaclesOnCurrentRoute) => {
  const waypoints = [];
  const DETOUR_DISTANCE = 0.008; // ~800m de détour

  // Pour chaque obstacle sur la route actuelle
  obstaclesOnCurrentRoute.forEach(obstacleOnRoute => {
    const obstacle = allObstacles.find(o => 
      o.lat === obstacleOnRoute.lat && o.lng === obstacleOnRoute.lng
    );

    if (!obstacle) return;

    // Calculer le vecteur perpendiculaire à la ligne départ-arrivée
    const dx = endPoint.longitude - startPoint.longitude;
    const dy = endPoint.latitude - startPoint.latitude;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return;

    // Vecteur perpendiculaire normalisé
    const perpX = -dy / length;
    const perpY = dx / length;

    // Créer deux waypoints de chaque côté de l'obstacle
    const detourFactor = DETOUR_DISTANCE * obstacle.severity;

    const waypoint1 = {
      latitude: obstacle.lat + perpY * detourFactor,
      longitude: obstacle.lng + perpX * detourFactor
    };

    const waypoint2 = {
      latitude: obstacle.lat - perpY * detourFactor,
      longitude: obstacle.lng - perpX * detourFactor
    };

    // Choisir le waypoint qui est le plus éloigné de tous les autres obstacles
    const dist1 = Math.min(...allObstacles.map(o => 
      getDistance(waypoint1.latitude, waypoint1.longitude, o.lat, o.lng)
    ));
    const dist2 = Math.min(...allObstacles.map(o => 
      getDistance(waypoint2.latitude, waypoint2.longitude, o.lat, o.lng)
    ));

    waypoints.push(dist1 > dist2 ? waypoint1 : waypoint2);
  });

  // Limiter le nombre de waypoints (OSRM a une limite)
  const MAX_WAYPOINTS = 3;
  return waypoints.slice(0, MAX_WAYPOINTS);
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