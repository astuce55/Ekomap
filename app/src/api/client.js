import axios from 'axios';

// Utilise l'IP de ton serveur backend ou localhost pour les tests
const apiClient = axios.create({
  baseURL: 'https://votre-api-eko.com/api', 
  timeout: 8000,
});

export default apiClient;