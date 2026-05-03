# 🗺️ EkoMap - Application de cartographie participative

![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)

## 🌍 Contexte

EkoMap est une application mobile de cartographie participative conçue pour améliorer la sécurité et la mobilité en permettant aux citoyens de signaler les incidents routiers en temps réel. L'application collecte des données sur les accidents, dangers, travaux pour créer une cartographie dynamique des risques urbains.

## ✨ Fonctionnalités Principales

### 🚨 Signalement d'Incidents
- **4 types d'incidents** : Accidents, Dangers, Travaux
- **Capture photo** intégrée avec caméra ou galerie
- **Géolocalisation** automatique
- **Mode invité** ou compte utilisateur
- **Modification** des positions des incidents signalés

### 🗺️ Carte Interactive
- **Affichage temps réel** des incidents signalés
- **Filtrage** par type et statut
- **Thème sombre/clair** adaptatif
- **Marqueurs personnalisés** par type d'incident
- **Centrage** sur la position utilisateur

### 🚗 Calcul d'Itinéraire
- **Recherche de lieux** avec Photon API
- **3 modes de transport** : Voiture, À pied, Vélo
- **Calcul du temps** estimé selon le mode
- **Échange rapide** départ/destination
- **Utilisation position actuelle**

### 👤 Gestion Utilisateur
- **Inscription/Connexion** sécurisée
- **Mode invité** sans authentification
- **Préférences** : thème, langue
- **Historique** des signalements personnels
- **Multilangue** : Français/Anglais

## 🏗️ Architecture Technique

### Frontend (React Native)
- **Framework** : React Native avec Expo
- **Navigation** : Expo Router
- **Carte** : react-native-maps
- **État global** : Context API (Theme, Language, Auth)
- **Géolocalisation** : expo-location
- **Images** : expo-image-picker

### Backend (Node.js/Express)
- **Framework** : Express.js
- **Base de données** : MongoDB avec Mongoose
- **Upload fichiers** : Multer (images JPEG/PNG)
- **API RESTful** : Endpoints complets
- **CORS** : Configuré pour développement mobile

## 📁 Structure des Fichiers

```
eko-map/
├── backend/
│   ├── server.js              # Serveur principal Express
│   ├── uploads/              # Photos uploadées
│   └── public/               # Dashboard admin
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.js     # Configuration API (BACKEND_IP)
│   │   │   └── reports.js    # Services incidents (mode mock/prod)
│   │   ├── context/
│   │   │   ├── AuthContext.js
│   │   │   ├── ThemeContext.js
│   │   │   └── LanguageContext.js
│   │   └── screens/
│   │       ├── HomeScreen.jsx   # Écran principal avec carte
│   │       ├── LoginScreen.jsx
│   │       └── RegisterScreen.jsx
│   │
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── home.tsx      # Route HomeScreen
│   │   │   └── _layout.tsx   # Layout tabs
│   │   ├── login.tsx         # Route login
│   │   ├── register.tsx      # Route register
│   │   ├── settings.tsx      # Route paramètres
│   │   └── _layout.tsx       # Layout racine
│   │
│   └── app.json
│
├── README.md
└── package.json
```

## 🚀 Installation et Démarrage

### Prérequis
- **Node.js** (v16 ou supérieur)
- **MongoDB** (local ou Atlas)
- **Expo CLI** (`npm install -g expo-cli`)
- **Git**

### 1. Cloner le projet
```bash
git clone https://github.com/votre-username/ekomap.git
cd ekomap
```

### 2. Configurer le Backend
```bash
cd backend
npm install

# Démarrer MongoDB (si local)
# Sous Linux/Mac: brew services start mongodb-community
# Sous Windows: démarrer le service MongoDB

npm start
# Le serveur démarre sur http://localhost:3000
```

### 3. Configurer le Frontend
```bash
cd ../frontend
npm install
```

### 4. Configurer l'adresse IP (IMPORTANT)
Ouvrir `src/api/client.js` et modifier `BACKEND_IP` avec l'adresse IP de votre machine :

```javascript
// frontend/src/api/client.js
const BACKEND_IP = '192.168.1.100'; // ⚠️ REMPLACER PAR VOTRE IP
```

### 5. Démarrer l'application
```bash
# Avec Expo Go (téléphone physique)
npm start
# Scanner le QR code avec l'app Expo Go

# Avec émulateur iOS
npm run ios

# Avec émulateur Android
npm run android
```

## 🔧 Configuration Réseau pour Tests Mobiles

### Pour tester sur téléphone physique :
1. **Même réseau WiFi** : Téléphone et PC doivent être sur le même WiFi
2. **Trouver l'IP du PC** :
   - **Windows** : `ipconfig` → Chercher "IPv4 Address"
   - **Mac/Linux** : `ifconfig` ou `ip addr`
3. **Mettre à jour BACKEND_IP** dans `src/api/client.js`
4. **Désactiver le pare-feu** ou autoriser le port 3000

### Vérifier la connexion :
```bash
# Tester depuis le PC
curl http://localhost:3000/api

# Tester depuis le téléphone (remplacer IP_PC)
curl http://192.168.1.100:3000/api
```

## 📡 API Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api` | Informations API |
| `GET` | `/api/incidents` | Liste des incidents (filtres: north,south,east,west,status) |
| `GET` | `/api/incidents/:id` | Détails d'un incident |
| `POST` | `/api/incidents` | Créer un incident (form-data avec photo) |
| `PATCH` | `/api/incidents/:id` | Mettre à jour un incident (position/statut) |
| `DELETE` | `/api/incidents/:id` | Supprimer un incident |
| `GET` | `/api/stats` | Statistiques pour dashboard |
| `GET` | `/admin` | Interface dashboard admin |

## 🗃️ Modèle de Données

### Collection `incidents`
```javascript
{
  type: 'accident' | 'danger' | 'travaux' | 'controle',
  coordinates: {
    lat: Number,  // Latitude
    lng: Number   // Longitude
  },
  photo_url: String,  // Optionnel pour 'controle'
  reported_at: Date,  // Date signalement
  user_id: String,    // ID utilisateur (optionnel)
  is_guest: Boolean,  // Si signalement en mode invité
  status: 'pending' | 'verified' | 'rejected',
  createdAt: Date,    // Timestamp automatique
  updatedAt: Date     // Timestamp automatique
}
```

## 🎨 Interface Utilisateur

### Écrans Principaux
1. **Login** (`/login`) - Connexion / Mode invité
2. **Register** (`/register`) - Création compte
3. **Home** (`/(tabs)/home`) - Carte interactive
4. **Settings** (`/settings`) - Paramètres (thème, langue, compte)

### Workflow Signalement
1. **Bouton FAB (+) sur carte** → Menu signalement
2. **Choix type incident** → Accident/Danger/Travaux/Contrôle
3. **Prise photo** (sauf contrôle) → Caméra ou galerie
4. **Confirmation** → Aperçu et envoi

### Workflow Itinéraire
1. **Bouton "Itinéraire"** → Ouverture panneau recherche
2. **Départ** → Recherche lieu ou "Ma position"
3. **Destination** → Recherche lieu ou "Ma position"
4. **Calcul automatique** → Affichage trajet et durée

## 🛠️ Développement

### Mode Simulation
Dans `src/api/client.js`, activer le mode mock pour tester sans backend :
```javascript
const USE_MOCK_API = true; // Mode simulation sans serveur
```

### Services API
- **`postIncident()`** : Envoi signalement avec photo
- **`getIncidents()`** : Récupération incidents avec filtres
- **`updateIncidentPosition()`** : Mise à jour position incident

### Contextes
- **`ThemeContext`** : Gestion thème sombre/clair
- **`LanguageContext`** : Gestion langue (fr/en)
- **`AuthContext`** : Gestion authentification

## 📊 Dashboard Admin

Accéder à `http://localhost:3000/admin` pour :
- **Statistiques** : Total incidents, par type, par statut
- **Gestion** : Vérification/rejet des signalements
- **Visualisation** : Incidents sur carte admin

## 🐛 Dépannage

### Problèmes courants :

**1. Erreur réseau sur mobile**
```
✅ Vérifier que:
- Backend est démarré (npm start dans backend)
- IP correcte dans client.js
- Même réseau WiFi
- Pare-feu désactivé sur port 3000
```

**2. MongoDB non connecté**
```javascript
// Vérifier dans server.js
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekomap';
```

**3. Expo Go ne se connecte pas**
```bash
# Nettoyer le cache
expo start -c

# Réinstaller dépendances
rm -rf node_modules && npm install
```

**4. Images non chargées**
- Vérifier que le dossier `uploads/` existe dans `backend/`
- Vérifier les permissions d'accès

## 🤝 Contribution

1. **Fork** le projet
2. **Créez une branche** (`git checkout -b feature/AmazingFeature`)
3. **Commitez** (`git commit -m 'Add some AmazingFeature'`)
4. **Push** (`git push origin feature/AmazingFeature`)
5. **Ouvrez une Pull Request**

### Issues suggérées :
- ✅ Intégration Google Maps/OpenStreetMap
- ✅ Notification push pour nouveaux incidents
- ✅ Système de réputation utilisateurs
- ✅ Export données (CSV/GeoJSON)
- ✅ API publique pour développeurs tiers

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 👨‍💻 Auteurs

- **WATO MABOU Paul**

## 🙏 Technologies Utilisées

- [React Native](https://reactnative.dev/) - Framework mobile
- [Expo](https://expo.dev/) - Outils développement
- [Express.js](https://expressjs.com/) - Framework backend
- [MongoDB](https://www.mongodb.com/) - Base de données
- [Mongoose](https://mongoosejs.com/) - ODM MongoDB
- [React Native Maps](https://github.com/react-native-maps/react-native-maps) - Cartographie
- [Expo Router](https://docs.expo.dev/router/introduction/) - Navigation

---

⭐ **Si ce projet vous est utile, n'hésitez pas à mettre une étoile sur GitHub !**
