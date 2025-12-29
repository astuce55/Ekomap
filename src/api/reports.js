import apiClient from './client';

export const postIncident = async (type, coords) => {
  try {
    const response = await apiClient.post('/incidents', {
      type: type, // 'accident', 'danger', 'travaux'
      lat: coords.latitude,
      lng: coords.longitude,
      reported_at: new Date().toISOString()
    });
    return response.data;
  } catch (error) {
    console.error("Échec de l'envoi au backend:", error);
    return null; 
  }
};