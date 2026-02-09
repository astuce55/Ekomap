// src/api/traffic.js
import apiClient, { USE_MOCK_API } from './client';

// Données mockées pour le développement
const mockTrafficData = [
  {
    id: '3.9295-11.6006',
    coordinates: { lat: 3.9295, lng: 11.6006 },
    statut: 'Embouteillage',
    vehicules_detectes: 12,
    taux_immobilite: 1.0,
    alerte_active: true
  },
  {
    id: '3.8667-11.5167',
    coordinates: { lat: 3.8667, lng: 11.5167 },
    statut: 'Fluide',
    vehicules_detectes: 5,
    taux_immobilite: 0.3,
    alerte_active: false
  }
];

/**
 * Récupère l'état du trafic pour tous les points de contrôle
 */
export const getTrafficStatus = async () => {
  // MODE SIMULATION
  if (USE_MOCK_API) {
    console.log('🚦 [SIMULATION] Récupération de l\'état du trafic');
    
    // Simuler un délai réseau
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Alterner aléatoirement les états pour la démo
    const trafficData = mockTrafficData.map(point => ({
      ...point,
      statut: Math.random() > 0.5 ? 'Embouteillage' : 'Fluide',
      alerte_active: Math.random() > 0.5
    }));
    
    console.log('✅ [SIMULATION] État du trafic récupéré:', trafficData.length, 'points');
    
    return {
      success: true,
      data: trafficData,
      timestamp: new Date().toISOString()
    };
  }

  // MODE PRODUCTION
  try {
    const response = await apiClient.get('/traffic');
    
    console.log('✅ État du trafic récupéré:', response.data.data?.length || 0, 'points');
    
    return {
      success: true,
      data: response.data.data || [],
      timestamp: response.data.timestamp
    };
  } catch (error) {
    console.error('❌ Échec de récupération du trafic:', error);
    
    return {
      success: false,
      error: 'Impossible de récupérer l\'état du trafic',
      data: []
    };
  }
};

/**
 * Hook personnalisé pour le polling du trafic
 * Retourne les données de trafic et se met à jour automatiquement
 */
export const useTrafficPolling = (interval = 20000) => {
  const [trafficData, setTrafficData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [lastUpdate, setLastUpdate] = React.useState(null);

  const fetchTraffic = React.useCallback(async () => {
    try {
      const result = await getTrafficStatus();
      
      if (result.success) {
        setTrafficData(result.data);
        setLastUpdate(new Date());
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('Erreur lors du polling du trafic:', err);
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // Première récupération immédiate
    fetchTraffic();

    // Configuration du polling
    const intervalId = setInterval(fetchTraffic, interval);

    // Cleanup lors du démontage
    return () => {
      clearInterval(intervalId);
    };
  }, [fetchTraffic, interval]);

  return { trafficData, loading, error, lastUpdate, refresh: fetchTraffic };
};

export default {
  getTrafficStatus,
  useTrafficPolling
};