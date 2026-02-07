import apiClient, { USE_MOCK_API } from './client';

// Simulateur de stockage des incidents (pour tests)
let mockIncidents = [];

export const postIncident = async (incident) => {
  // MODE SIMULATION - Pour tester sans backend
  if (USE_MOCK_API) {
    console.log('📤 [SIMULATION] Envoi du signalement:', {
      type: incident.type,
      lat: incident.lat,
      lng: incident.lng,
      hasPhoto: !!incident.photoUri,
      user_id: incident.user_id,
      is_guest: incident.is_guest
    });

    // Simuler un délai réseau
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Créer un incident simulé
    const mockIncident = {
      id: `incident_${Date.now()}`,
      type: incident.type,
      coordinates: { lat: incident.lat, lng: incident.lng },
      photo_url: incident.photoUri || null,
      created_at: new Date().toISOString(),
      reported_at: new Date().toISOString(),
      user_id: incident.user_id,
      is_guest: incident.is_guest,
      status: 'pending'
    };

    // Stocker dans le mock storage
    mockIncidents.push(mockIncident);

    console.log('✅ [SIMULATION] Signalement enregistré avec succès');
    console.log('📊 [SIMULATION] Total des incidents:', mockIncidents.length);

    return {
      success: true,
      data: mockIncident,
      message: 'Signalement enregistré (mode simulation)'
    };
  }

  // MODE PRODUCTION - Vrai appel API
  try {
    // Préparer les données pour l'envoi
    const formData = new FormData();
    formData.append('type', incident.type);
    formData.append('lat', incident.lat.toString());
    formData.append('lng', incident.lng.toString());
    formData.append('reported_at', incident.reported_at);
    
    if (incident.user_id) {
      formData.append('user_id', incident.user_id);
    }
    
    if (incident.is_guest) {
      formData.append('is_guest', 'true');
    }

    // Ajouter la photo si elle existe (optionnel pour controle)
    if (incident.photoUri) {
      const filename = incident.photoUri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('photo', {
        uri: incident.photoUri,
        name: filename,
        type
      });
    }

    const response = await apiClient.post('/incidents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return {
      success: true,
      data: response.data,
      message: 'Signalement envoyé avec succès'
    };
  } catch (error) {
    console.error("Échec de l'envoi du signalement:", error);
    
    if (error.response) {
      return {
        success: false,
        error: error.response.data.message || 'Erreur serveur'
      };
    } else if (error.request) {
      return {
        success: false,
        error: 'Erreur réseau. Vérifiez votre connexion et l\'URL du backend dans src/api/client.js'
      };
    }
    
    return {
      success: false,
      error: 'Erreur inconnue'
    };
  }
};

export const getIncidents = async (bounds) => {
  // MODE SIMULATION
  if (USE_MOCK_API) {
    console.log('📥 [SIMULATION] Récupération des incidents');
    console.log('📊 [SIMULATION] Incidents disponibles:', mockIncidents.length);
    
    return {
      success: true,
      data: mockIncidents
    };
  }

  // MODE PRODUCTION
  try {
    const params = bounds ? {
      north: bounds.north,
      south: bounds.south,
      east: bounds.east,
      west: bounds.west
    } : {};

    const response = await apiClient.get('/incidents', { params });
    return {
      success: true,
      data: response.data.data || response.data
    };
  } catch (error) {
    console.error("Échec de récupération des incidents:", error);
    return {
      success: false,
      error: 'Impossible de charger les incidents',
      data: []
    };
  }
};