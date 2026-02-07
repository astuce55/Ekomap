# EkoMap Backend - Serveur API

Backend Node.js + MongoDB pour l'application EkoMap avec dashboard admin.

## 🚀 Installation Rapide

### 1. Installer les dépendances

```bash
cd backend
npm install
```

### 2. Installer MongoDB

**Sur Windows:**
- Télécharger: https://www.mongodb.com/try/download/community
- Installer et démarrer MongoDB

**Sur Mac:**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Sur Linux:**
```bash
sudo apt-get install mongodb
sudo systemctl start mongodb
```

### 3. Démarrer le serveur

```bash
npm start
```

Ou en mode développement avec auto-reload :
```bash
npm run dev
```

## 📡 API Endpoints

Base URL: `http://localhost:3000/api`

### GET /api/incidents
Récupérer tous les incidents

**Query params (optionnels):**
- `north`, `south`, `east`, `west` - Zone géographique
- `status` - pending | verified | rejected

**Réponse:**
```json
{
  "success": true,
  "count": 42,
  "data": [
    {
      "_id": "...",
      "type": "accident",
      "coordinates": { "lat": 3.848, "lng": 11.502 },
      "photo_url": "/uploads/incident-xxx.jpg",
      "status": "pending",
      "reported_at": "2026-02-06T10:30:00Z",
      "user_id": "user_123",
      "is_guest": false
    }
  ]
}
```

### POST /api/incidents
Créer un nouveau signalement

**Content-Type:** `multipart/form-data`

**Body:**
- `type` (required) - accident | danger | travaux | controle
- `lat` (required) - Latitude
- `lng` (required) - Longitude
- `photo` (required) - Fichier image (JPEG/PNG)
- `user_id` (optional) - ID de l'utilisateur
- `is_guest` (optional) - true/false
- `reported_at` (optional) - Date ISO 8601

**Réponse 201:**
```json
{
  "success": true,
  "message": "Incident créé avec succès",
  "data": { ... }
}
```

### GET /api/incidents/:id
Récupérer un incident spécifique

### PATCH /api/incidents/:id
Mettre à jour le statut d'un incident (admin)

**Body:**
```json
{
  "status": "verified"
}
```

### DELETE /api/incidents/:id
Supprimer un incident (admin)

### GET /api/stats
Obtenir les statistiques pour le dashboard

**Réponse:**
```json
{
  "success": true,
  "data": {
    "total": 156,
    "byType": [
      { "_id": "accident", "count": 45 },
      { "_id": "danger", "count": 32 },
      ...
    ],
    "byStatus": [
      { "_id": "pending", "count": 78 },
      { "_id": "verified", "count": 65 },
      ...
    ],
    "byDay": [
      { "_id": "2026-02-01", "count": 12 },
      ...
    ],
    "recent": [ ... ]
  }
}
```

## 🎨 Dashboard Admin

Accéder au dashboard : `http://localhost:3000/admin`

### Fonctionnalités

- ✅ Vue d'ensemble avec statistiques
- ✅ Liste de tous les signalements
- ✅ Filtrer par type et statut
- ✅ Voir les photos des incidents
- ✅ Vérifier/approuver les signalements
- ✅ Supprimer les signalements
- ✅ Actualisation automatique toutes les 30s

## 📁 Structure des Fichiers

```
backend/
├── server.js           # Serveur principal
├── package.json        # Dépendances
├── public/
│   └── admin.html      # Dashboard admin
├── uploads/            # Photos uploadées (créé auto)
└── README.md           # Ce fichier
```

## 🔧 Configuration

### Variables d'environnement (optionnel)

Créer un fichier `.env` :

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/ekomap
```

## 🧪 Tester l'API

### Avec curl

```bash
# Obtenir tous les incidents
curl http://localhost:3000/api/incidents

# Obtenir les stats
curl http://localhost:3000/api/stats

# Créer un incident (avec photo)
curl -X POST http://localhost:3000/api/incidents \
  -F "type=accident" \
  -F "lat=3.848" \
  -F "lng=11.502" \
  -F "photo=@/path/to/photo.jpg"
```

### Avec Postman

1. Importer la collection (voir `postman_collection.json`)
2. Tester les endpoints

## 🗄️ Base de Données

### Schéma Incident

```javascript
{
  type: String,           // accident | danger | travaux | controle
  coordinates: {
    lat: Number,
    lng: Number
  },
  photo_url: String,      // Chemin vers la photo
  reported_at: Date,
  user_id: String,
  is_guest: Boolean,
  status: String,         // pending | verified | rejected
  createdAt: Date,        // Auto
  updatedAt: Date         // Auto
}
```

## 🚨 Dépannage

### MongoDB ne démarre pas
```bash
# Vérifier le statut
brew services list  # Mac
sudo systemctl status mongodb  # Linux

# Redémarrer
brew services restart mongodb-community  # Mac
sudo systemctl restart mongodb  # Linux
```

### Port 3000 déjà utilisé
Changer le port dans `.env` ou :
```bash
PORT=3001 npm start
```

### Photos ne s'affichent pas
- Vérifier que le dossier `uploads/` existe
- Vérifier les permissions du dossier
- Vérifier l'URL complète de la photo

## 📊 Statistiques

Le serveur collecte automatiquement :
- Total des signalements
- Par type d'incident
- Par statut
- Par jour (7 derniers jours)
- 10 incidents les plus récents

## 🔐 Sécurité (TODO pour production)

⚠️ Ce backend est pour le développement. En production, ajouter :

- [ ] Authentification (JWT)
- [ ] Rate limiting
- [ ] Validation des données robuste
- [ ] HTTPS
- [ ] Sanitization des uploads
- [ ] Logs sécurisés
- [ ] Variables d'environnement
- [ ] CORS restreint

## 📝 Notes

- Les photos sont stockées dans `uploads/`
- Taille max : 5MB par photo
- Formats acceptés : JPEG, JPG, PNG
- Les incidents sont triés par date (plus récents en premier)

## 🤝 Contribuer

Pour ajouter de nouvelles fonctionnalités :

1. Ajouter la route dans `server.js`
2. Tester avec Postman
3. Documenter dans ce README
4. Mettre à jour le dashboard si nécessaire

## 📞 Support

**Problèmes courants** : Voir section Dépannage ci-dessus

**Questions** : Créer une issue sur GitHub

---

**Version** : 1.0.0  
**Dernière mise à jour** : 6 février 2026  
**Statut** : ✅ Prêt pour le développement