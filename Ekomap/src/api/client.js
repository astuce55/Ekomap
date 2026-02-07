import axios from 'axios';

// MODE DE DÉVELOPPEMENT
// Mettre à true pour simuler le backend (tests sans serveur)
// Mettre à false pour utiliser le vrai backend
const USE_MOCK_API = false;

// IMPORTANT: Remplacez cette adresse par l'adresse IP de votre ordinateur
// Pour trouver votre IP:
// - Windows: ouvrez CMD et tapez "ipconfig", cherchez "IPv4 Address"
// - Mac/Linux: ouvrez Terminal et tapez "ifconfig" ou "ip addr", cherchez "inet"
// - L'IP ressemble généralement à 192.168.x.x ou 10.0.x.x
const BACKEND_IP = '10.70.247.157'; // ⚠️ REMPLACEZ PAR VOTRE IP

// Configuration de l'API
const apiClient = axios.create({
  baseURL: USE_MOCK_API 
    ? 'http://localhost:3000/api'
    : `http://${BACKEND_IP}:3000/api`, // Utilisez l'IP de votre PC
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Intercepteur pour ajouter le token d'authentification
apiClient.interceptors.request.use(
  async (config) => {
    // En mode mock, on laisse passer sans token
    if (USE_MOCK_API) {
      return config;
    }
    
    // En mode production, ajouter le token
    // const token = await AsyncStorage.getItem('authToken');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur de réponse pour gérer le mode mock et les erreurs
apiClient.interceptors.response.use(
  (response) => {
    console.log('✅ Réponse API reçue:', response.config.url);
    return response;
  },
  (error) => {
    if (error.message === 'Network Error') {
      console.error('❌ Erreur réseau - Vérifiez que:');
      console.error('1. Le backend est démarré (npm start dans le dossier backend)');
      console.error(`2. L'IP dans client.js est correcte: ${BACKEND_IP}`);
      console.error('3. Votre téléphone et PC sont sur le même réseau WiFi');
      console.error('4. Le pare-feu autorise les connexions sur le port 3000');
    } else if (error.response) {
      console.error('❌ Erreur serveur:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('❌ Pas de réponse du serveur');
    }
    return Promise.reject(error);
  }
);

export { USE_MOCK_API, BACKEND_IP };
export default apiClient;