const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques (photos) avec les bons en-têtes
app.use('/uploads', express.static('uploads', {
  setHeaders: (res, path) => {
    // Définir les en-têtes CORS pour les images
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Cache-Control', 'public, max-age=86400'); // Cache 24h
  }
}));
app.use(express.static('public'));

// Créer le dossier uploads s'il n'existe pas
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

// Créer le dossier public s'il n'existe pas
if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
}

// Configuration MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekomap';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connecté à MongoDB'))
.catch((err) => console.error('❌ Erreur MongoDB:', err));

// Schéma Incident
const incidentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['accident', 'danger', 'travaux', 'controle'],
    required: true
  },
  coordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  photo_url: { type: String, required: false }, // Optionnel pour controle
  reported_at: { type: Date, default: Date.now },
  user_id: { type: String },
  is_guest: { type: Boolean, default: false },
  status: { 
    type: String, 
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  }
}, { timestamps: true });

const Incident = mongoose.model('Incident', incidentSchema);

// Configuration Multer pour les uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'incident-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Seules les images (JPEG, JPG, PNG) sont autorisées'));
  }
});

// ==================== ROUTES API ====================

// Routes de test
app.get('/', (req, res) => {
  res.json({ 
    message: 'EkoMap API Server',
    version: '1.0.0',
    status: 'running'
  });
});

app.get('/api', (req, res) => {
  res.json({ 
    message: 'EkoMap API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      incidents: '/api/incidents',
      stats: '/api/stats',
      admin: '/admin'
    }
  });
});

// Route pour le dashboard admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// GET /api/incidents - Récupérer tous les incidents
app.get('/api/incidents', async (req, res) => {
  try {
    const { north, south, east, west, status } = req.query;
    
    let query = {};
    
    // Filtrer par zone géographique si fournie
    if (north && south && east && west) {
      query['coordinates.lat'] = { 
        $gte: parseFloat(south), 
        $lte: parseFloat(north) 
      };
      query['coordinates.lng'] = { 
        $gte: parseFloat(west), 
        $lte: parseFloat(east) 
      };
    }
    
    // Filtrer par statut
    if (status) {
      query.status = status;
    }
    
    const incidents = await Incident.find(query).sort({ reported_at: -1 });
    
    res.json({
      success: true,
      count: incidents.length,
      data: incidents
    });
  } catch (error) {
    console.error('Erreur récupération incidents:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la récupération des incidents'
    });
  }
});

// GET /api/incidents/:id - Récupérer un incident spécifique
app.get('/api/incidents/:id', async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    
    if (!incident) {
      return res.status(404).json({
        success: false,
        error: 'Incident non trouvé'
      });
    }
    
    res.json({
      success: true,
      data: incident
    });
  } catch (error) {
    console.error('Erreur récupération incident:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// POST /api/incidents - Créer un nouveau signalement
app.post('/api/incidents', upload.single('photo'), async (req, res) => {
  try {
    const { type, lat, lng, reported_at, user_id, is_guest } = req.body;
    
    // Validation
    if (!type || !lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Type, latitude et longitude sont requis'
      });
    }
    
    // Photo obligatoire sauf pour les contrôles de police
    if (type !== 'controle' && !req.file) {
      return res.status(400).json({
        success: false,
        error: 'Photo requise pour ce type de signalement'
      });
    }
    
    // Créer l'incident
    const incident = new Incident({
      type,
      coordinates: {
        lat: parseFloat(lat),
        lng: parseFloat(lng)
      },
      photo_url: req.file ? `/uploads/${req.file.filename}` : null,
      reported_at: reported_at ? new Date(reported_at) : new Date(),
      user_id: user_id || null,
      is_guest: is_guest === 'true'
    });
    
    await incident.save();
    
    console.log('✅ Incident créé:', incident._id);
    
    res.status(201).json({
      success: true,
      message: 'Incident créé avec succès',
      data: incident
    });
  } catch (error) {
    console.error('Erreur création incident:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création de l\'incident'
    });
  }
});

// PATCH /api/incidents/:id - Mettre à jour un incident
app.patch('/api/incidents/:id', async (req, res) => {
  try {
    const { status, lat, lng } = req.body;
    
    const updateData = {};
    
    // Mise à jour du statut (pour admin)
    if (status) {
      updateData.status = status;
    }
    
    // Mise à jour de la position (pour l'utilisateur)
    if (lat && lng) {
      updateData['coordinates.lat'] = parseFloat(lat);
      updateData['coordinates.lng'] = parseFloat(lng);
    }
    
    const incident = await Incident.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    if (!incident) {
      return res.status(404).json({
        success: false,
        error: 'Incident non trouvé'
      });
    }
    
    console.log('✅ Incident mis à jour:', incident._id);
    
    res.json({
      success: true,
      message: 'Incident mis à jour',
      data: incident
    });
  } catch (error) {
    console.error('Erreur mise à jour incident:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour'
    });
  }
});

// DELETE /api/incidents/:id - Supprimer un incident (admin)
app.delete('/api/incidents/:id', async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    
    if (!incident) {
      return res.status(404).json({
        success: false,
        error: 'Incident non trouvé'
      });
    }
    
    // Supprimer la photo si elle existe
    if (incident.photo_url) {
      const photoPath = path.join(__dirname, incident.photo_url);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
    }
    
    await Incident.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Incident supprimé'
    });
  } catch (error) {
    console.error('Erreur suppression incident:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression'
    });
  }
});

// GET /api/stats - Statistiques pour le dashboard
app.get('/api/stats', async (req, res) => {
  try {
    const total = await Incident.countDocuments();
    const byType = await Incident.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);
    const byStatus = await Incident.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const recent = await Incident.find().sort({ reported_at: -1 }).limit(10);
    
    // Incidents par jour (7 derniers jours)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const byDay = await Incident.aggregate([
      { $match: { reported_at: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$reported_at' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        total,
        byType,
        byStatus,
        byDay,
        recent
      }
    });
  } catch (error) {
    console.error('Erreur stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du calcul des statistiques'
    });
  }
});

// Démarrer le serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur EkoMap démarré sur http://0.0.0.0:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/admin`);
  console.log(`📡 API: http://localhost:${PORT}/api`);
  console.log('');
  console.log('📱 Pour connecter votre téléphone:');
  console.log('1. Assurez-vous que votre téléphone et PC sont sur le même WiFi');
  console.log('2. Trouvez l\'IP de votre PC (ipconfig sur Windows, ifconfig sur Mac/Linux)');
  console.log('3. Mettez à jour BACKEND_IP dans src/api/client.js avec votre IP');
  console.log('4. L\'URL sera http://VOTRE_IP:3000/api');
  console.log('');
  console.log('📷 Les images sont servies depuis: http://localhost:${PORT}/uploads/');
});

module.exports = app;