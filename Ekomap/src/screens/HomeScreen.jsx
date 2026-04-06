import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Modal,
  Alert,
  Image,
  ActivityIndicator,
  TextInput,
  Platform,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Callout, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { postIncident, getIncidents, updateIncidentPosition } from '../api/reports';
import { getTrafficStatus } from '../api/traffic';
import { calculateBothRoutes, formatDistance, formatDuration } from '../api/routing';
import { useRouter } from 'expo-router';
import { BACKEND_IP } from '../api/client';

// Service de géocodage amélioré
const searchPlacesPhoton = async (query, location = null) => {
  if (!query || query.length < 3) {
    return [];
  }

  try {
    let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8&lang=fr`;
    
    if (location) {
      url += `&lat=${location.latitude}&lon=${location.longitude}`;
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'EkoMapApp/1.0',
      },
    });

    if (!response.ok) {
      console.error('Erreur HTTP:', response.status);
      return [];
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return [];
    }

    return data.features.map(feature => ({
      id: feature.properties.osm_id || Math.random().toString(),
      name: feature.properties.name || feature.properties.street || 'Sans nom',
      shortName: feature.properties.name || feature.properties.street || 'Sans nom',
      address: [
        feature.properties.name,
        feature.properties.street,
        feature.properties.city,
        feature.properties.state || 'Cameroun',
      ].filter(Boolean).join(', '),
      latitude: feature.geometry.coordinates[1],
      longitude: feature.geometry.coordinates[0],
      type: feature.properties.type || 'unknown',
    }));

  } catch (error) {
    console.error('Erreur Photon:', error);
    return [];
  }
};

export default function HomeScreen() {
  const { colors, dark } = useTheme();
  const { t } = useLanguage();
  const { user, isGuest } = useAuth();
  const router = useRouter();

  // États de la carte
  const [location, setLocation] = useState(null);
  const [region, setRegion] = useState({
    latitude: 3.8480,
    longitude: 11.5021,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [mapReady, setMapReady] = useState(false);

  // États des incidents
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [editingIncident, setEditingIncident] = useState(null);

  // États du trafic
  const [trafficData, setTrafficData] = useState([]);
  const [lastTrafficUpdate, setLastTrafficUpdate] = useState(null);

  // États du signalement
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [selectedIncidentType, setSelectedIncidentType] = useState(null);
  const [photoUri, setPhotoUri] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportStep, setReportStep] = useState('type');

  // États de recherche et itinéraire
  const [showRouteMenu, setShowRouteMenu] = useState(false);
  const [routeMode, setRouteMode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [travelMode, setTravelMode] = useState('driving');
  const [activeSearchField, setActiveSearchField] = useState('start');
  const [isRoutePanelMinimized, setIsRoutePanelMinimized] = useState(false);
  const [showRouteResultsBar, setShowRouteResultsBar] = useState(false);

  // Nouveaux états pour l'itinéraire optimisé
  const [selectedRouteType, setSelectedRouteType] = useState('normal'); // 'normal' ou 'optimized'
  const [normalRouteCoordinates, setNormalRouteCoordinates] = useState([]);
  const [optimizedRouteCoordinates, setOptimizedRouteCoordinates] = useState([]);
  const [normalRouteInfo, setNormalRouteInfo] = useState(null);
  const [optimizedRouteInfo, setOptimizedRouteInfo] = useState(null);
  const [showBothRoutes, setShowBothRoutes] = useState(true);
  const [routeComparison, setRouteComparison] = useState(null);
  
  // Stocker les temps pour tous les modes de transport
  const [allModesRouteInfo, setAllModesRouteInfo] = useState({
    driving: { normal: null, optimized: null },
    walking: { normal: null, optimized: null },
    bicycling: { normal: null, optimized: null },
  });

  const mapRef = useRef(null);
  const searchTimeout = useRef(null);

  // Types d'incidents
  const incidentTypes = [
    { type: 'accident', icon: 'car', label: t('accident'), color: '#FF4444', requiresPhoto: true },
    { type: 'danger', icon: 'warning', label: t('risk'), color: '#FF9800', requiresPhoto: true },
    { type: 'travaux', icon: 'construct', label: t('works'), color: '#FFD700', requiresPhoto: true },
  ];

  // Modes de transport avec vitesses moyennes (km/h)
  const travelModes = [
    { mode: 'driving', icon: 'car', label: 'Voiture', color: '#4285F4', avgSpeed: 30 },
    { mode: 'walking', icon: 'walk', label: 'À pied', color: '#34A853', avgSpeed: 5 },
    { mode: 'bicycling', icon: 'bicycle', label: 'Vélo', color: '#FBBC04', avgSpeed: 15 },
  ];

  // Style carte sombre amélioré avec plus de détails visibles
  const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
    
    // Routes principales plus visibles
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212121' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#b0b0b0' }] },
    
    // Autoroutes
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#2c2c2c' }] },
    { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f0d040' }] },
    
    // Routes artérielles
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
    { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#c0c0c0' }] },
    
    // Localités et villes - PLUS VISIBLES
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#e0e0e0' }] },
    { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#c0c0c0' }] },
    
    // POI (Points d'intérêt) - Écoles, boutiques, etc. - BEAUCOUP PLUS VISIBLES
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#e0e0e0' }] },
    { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'on' }, { saturation: 20 }, { lightness: 20 }] },
    
    // Écoles spécifiquement
    { featureType: 'poi.school', elementType: 'geometry', stylers: [{ color: '#3a3a3a' }] },
    { featureType: 'poi.school', elementType: 'labels.text.fill', stylers: [{ color: '#f0f0f0' }] },
    { featureType: 'poi.school', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
    
    // Commerces et boutiques
    { featureType: 'poi.business', elementType: 'labels.text.fill', stylers: [{ color: '#e8e8e8' }] },
    { featureType: 'poi.business', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
    
    // Parcs
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#2a3a2a' }] },
    { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#8bc34a' }] },
    
    // Transport
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
    { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d0d0d0' }] },
    { featureType: 'transit.station', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
    
    // Eau
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1b2a' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6b9ab8' }] },
    { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#0d1b2a' }] },
  ];

  // Permissions de localisation
  useEffect(() => {
    (async () => {
      try {
        console.log('📍 Demande de permission de localisation...');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('⚠️ Permission de localisation refusée');
          Alert.alert('Permission refusée', 'La localisation est nécessaire');
          return;
        }
        
        console.log('✅ Permission accordée, récupération de la position...');
        const currentLocation = await Location.getCurrentPositionAsync({});
        console.log('✅ Position obtenue:', currentLocation.coords.latitude, currentLocation.coords.longitude);
        
        setLocation(currentLocation);
        setRegion({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        
        console.log('✅ Carte initialisée avec succès');
      } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de la carte:', error);
        // Utiliser une position par défaut (Yaoundé) en cas d'erreur
        console.log('🔄 Utilisation de la position par défaut (Yaoundé)');
        setRegion({
          latitude: 3.8480,
          longitude: 11.5021,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    })();
  }, []);

  useEffect(() => {
    loadIncidents();
  }, []);

  // Fonction pour charger les données de trafic
  const loadTrafficData = async () => {
    try {
      const response = await getTrafficStatus();
      if (response.success) {
        setTrafficData(response.data || []);
        setLastTrafficUpdate(new Date());
        console.log('🚦 Données de trafic mises à jour:', response.data?.length || 0, 'points');
      }
    } catch (error) {
      console.error('Erreur chargement trafic:', error);
    }
  };

  // Polling du trafic toutes les 20 secondes
  useEffect(() => {
    // Chargement initial
    loadTrafficData();

    // Polling toutes les 20 secondes
    const trafficInterval = setInterval(() => {
      loadTrafficData();
    }, 20000);

    // Cleanup lors du démontage
    return () => {
      clearInterval(trafficInterval);
    };
  }, []);

  const loadIncidents = async () => {
    try {
      const response = await getIncidents();
      if (response.success) {
        setIncidents(response.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement incidents:', error);
    }
  };

  const centerOnUser = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const getImageUrl = (photoUrl) => {
    if (!photoUrl) return null;
    if (photoUrl.startsWith('http')) return photoUrl;
    return `http://${BACKEND_IP}:3000${photoUrl}`;
  };

  // Recherche de lieux avec Photon (plus stable)
  const searchPlaces = async (query, field) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        console.log('🔍 Recherche:', query);
        const results = await searchPlacesPhoton(query, location?.coords);
        console.log('✅ Résultats:', results.length);
        setSearchResults(results);
      } catch (error) {
        console.error('❌ Erreur recherche:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const selectPlace = (place, field) => {
    if (field === 'start') {
      setStartPoint(place);
      setSearchQuery(place.shortName);
    } else {
      setEndPoint(place);
      setDestinationQuery(place.shortName);
    }
    
    setSearchResults([]);
    
    if ((field === 'start' && endPoint) || (field === 'end' && startPoint)) {
      const start = field === 'start' ? place : startPoint;
      const end = field === 'end' ? place : endPoint;
      calculateRoute(start, end, travelMode);
    }

    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: place.latitude,
        longitude: place.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const useMyLocation = (field) => {
    if (!location) {
      Alert.alert('Erreur', 'Position non disponible');
      return;
    }

    const myLocationPoint = {
      id: 'my-location',
      name: 'Ma position',
      shortName: 'Ma position',
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };

    if (field === 'start') {
      setStartPoint(myLocationPoint);
      setSearchQuery('Ma position');
      if (endPoint) {
        calculateRoute(myLocationPoint, endPoint, travelMode);
      }
    } else {
      setEndPoint(myLocationPoint);
      setDestinationQuery('Ma position');
      if (startPoint) {
        calculateRoute(startPoint, myLocationPoint, travelMode);
      }
    }
  };

  const swapLocations = () => {
    const tempPoint = startPoint;
    const tempQuery = searchQuery;
    
    setStartPoint(endPoint);
    setSearchQuery(destinationQuery);
    
    setEndPoint(tempPoint);
    setDestinationQuery(tempQuery);

    if (startPoint && endPoint) {
      calculateRoute(endPoint, tempPoint, travelMode);
    }
  };

  const calculateRoute = async (start, end, mode) => {
    try {
      setIsSearching(true);
      
      console.log('🗺️ Calcul des itinéraires pour tous les modes...');
      
      // Calculer les itinéraires pour TOUS les modes de transport
      const modesPromises = travelModes.map(async (travelMode) => {
        const routes = await calculateBothRoutes(start, end, incidents, trafficData, travelMode.mode);
        return {
          mode: travelMode.mode,
          normal: {
            distance: formatDistance(routes.normal.distance),
            duration: formatDuration(routes.normal.duration),
            durationMinutes: Math.round(routes.normal.duration / 60),
          },
          optimized: {
            distance: formatDistance(routes.optimized.distance),
            duration: formatDuration(routes.optimized.duration),
            durationMinutes: Math.round(routes.optimized.duration / 60),
            obstaclesAvoided: routes.optimized.obstaclesAvoided,
            safetyScore: routes.optimized.safetyScore
          },
          coordinates: routes.normal.coordinates,
          optimizedCoordinates: routes.optimized.coordinates,
        };
      });
      
      const allModesResults = await Promise.all(modesPromises);
      
      // Stocker les infos pour tous les modes
      const newAllModesInfo = {};
      allModesResults.forEach(result => {
        newAllModesInfo[result.mode] = {
          normal: result.normal,
          optimized: result.optimized,
          coordinates: result.coordinates,
          optimizedCoordinates: result.optimizedCoordinates,
        };
      });
      setAllModesRouteInfo(newAllModesInfo);
      
      // Définir les coordonnées pour le mode sélectionné
      const selectedModeResult = allModesResults.find(r => r.mode === mode);
      setNormalRouteCoordinates(selectedModeResult.coordinates);
      setOptimizedRouteCoordinates(selectedModeResult.optimizedCoordinates);
      setNormalRouteInfo(selectedModeResult.normal);
      setOptimizedRouteInfo(selectedModeResult.optimized);
      
      // Par défaut, sélectionner l'itinéraire approprié
      if (selectedModeResult.optimized.obstaclesAvoided > 0) {
        setSelectedRouteType('optimized');
        setRouteCoordinates(selectedModeResult.optimizedCoordinates);
        setRouteInfo(selectedModeResult.optimized);
      } else {
        setSelectedRouteType('normal');
        setRouteCoordinates(selectedModeResult.coordinates);
        setRouteInfo(selectedModeResult.normal);
      }
      
      console.log('✅ Itinéraires calculés pour tous les modes');

      // Minimiser le panneau automatiquement après calcul
      setTimeout(() => {
        setShowRouteMenu(false); // Fermer le menu de recherche
        setShowRouteResultsBar(true); // Afficher la barre de résultats
        Keyboard.dismiss();
      }, 500);

      // Ajuster la vue de la carte
      if (mapRef.current) {
        mapRef.current.fitToCoordinates(
          [
            { latitude: start.latitude, longitude: start.longitude },
            { latitude: end.latitude, longitude: end.longitude }
          ],
          {
            edgePadding: { top: 150, right: 50, bottom: 200, left: 50 },
            animated: true,
          }
        );
      }
    } catch (error) {
      console.error('Erreur calcul itinéraire:', error);
      Alert.alert('Erreur', 'Impossible de calculer l\'itinéraire');
    } finally {
      setIsSearching(false);
    }
  };

  const changeTravelMode = (mode) => {
    setTravelMode(mode);
    if (startPoint && endPoint) {
      calculateRoute(startPoint, endPoint, mode);
    }
  };

  const clearRoute = () => {
    setRouteCoordinates([]);
    setNormalRouteCoordinates([]);
    setOptimizedRouteCoordinates([]);
    setStartPoint(null);
    setEndPoint(null);
    setRouteInfo(null);
    setNormalRouteInfo(null);
    setOptimizedRouteInfo(null);
    setRouteComparison(null);
    setSelectedRouteType('normal');
    setShowBothRoutes(true);
    setSearchQuery('');
    setDestinationQuery('');
    setShowRouteMenu(false);
    setShowRouteResultsBar(false);
    setSearchResults([]);
    setIsRoutePanelMinimized(false);
    setAllModesRouteInfo({
      driving: { normal: null, optimized: null },
      walking: { normal: null, optimized: null },
      bicycling: { normal: null, optimized: null },
    });
  };

  const openRouteMenu = (mode) => {
    setRouteMode(mode);
    
    if (mode === 'from-here' && location) {
      const myLocationPoint = {
        id: 'my-location',
        name: 'Ma position',
        shortName: 'Ma position',
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setStartPoint(myLocationPoint);
      setSearchQuery('Ma position');
      setActiveSearchField('end');
    } else if (mode === 'to-here' && location) {
      const myLocationPoint = {
        id: 'my-location',
        name: 'Ma position',
        shortName: 'Ma position',
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setEndPoint(myLocationPoint);
      setDestinationQuery('Ma position');
      setActiveSearchField('start');
    } else {
      setActiveSearchField('start');
    }
    
    setShowRouteMenu(true);
  };

  const startReport = () => {
    if (isGuest || user) {
      setShowReportMenu(true);
      setReportStep('type');
    } else {
      Alert.alert(
        'Connexion requise',
        'Veuillez vous connecter pour signaler un incident',
        [
          { text: 'Plus tard', style: 'cancel' },
          { text: 'Se connecter', onPress: () => router.push('/login') }
        ]
      );
    }
  };

  const selectIncidentType = (incident) => {
    setSelectedIncidentType(incident);
    if (!incident.requiresPhoto) {
      setReportStep('confirm');
    } else {
      setReportStep('photo');
    }
  };

  const handleImagePicker = async (source) => {
    try {
      let result;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission refusée', 'L\'accès à la caméra est nécessaire');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission refusée', 'L\'accès à la galerie est nécessaire');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
        setReportStep('confirm');
      }
    } catch (error) {
      console.error('Erreur sélection image:', error);
      Alert.alert('Erreur', 'Impossible de charger l\'image');
    }
  };

  const submitReport = async () => {
    if (!selectedIncidentType || !location) {
      Alert.alert('Erreur', 'Veuillez compléter toutes les étapes');
      return;
    }

    if (selectedIncidentType.requiresPhoto && !photoUri) {
      Alert.alert('Erreur', 'Une photo est requise pour ce type de signalement');
      return;
    }

    setIsSubmitting(true);

    try {
      const incidentData = {
        type: selectedIncidentType.type,
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        photoUri: photoUri || null,
        reported_at: new Date().toISOString(),
        user_id: user?.id,
        is_guest: isGuest,
      };

      const response = await postIncident(incidentData);

      if (response.success) {
        Alert.alert(
          'Succès',
          'Votre signalement a été enregistré avec succès !',
          [{ 
            text: 'OK', 
            onPress: () => {
              closeReportModal();
              loadIncidents();
            }
          }]
        );
      } else {
        Alert.alert('Erreur', response.error || 'Impossible d\'envoyer le signalement');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeReportModal = () => {
    setShowReportMenu(false);
    setSelectedIncidentType(null);
    setPhotoUri(null);
    setReportStep('type');
  };

  const enableEditMode = (incident) => {
    if (!user && !isGuest) {
      Alert.alert('Erreur', 'Vous devez être connecté');
      return;
    }

    if (user && incident.user_id !== user.id) {
      Alert.alert('Erreur', 'Vous ne pouvez modifier que vos propres incidents');
      return;
    }

    setEditingIncident(incident);
    setSelectedIncident(null);
  };

  const saveNewPosition = async () => {
    if (!editingIncident) return;

    try {
      const response = await updateIncidentPosition(
        editingIncident._id,
        editingIncident.coordinates.lat,
        editingIncident.coordinates.lng
      );

      if (response.success) {
        Alert.alert('Succès', 'Position mise à jour');
        setEditingIncident(null);
        loadIncidents();
      } else {
        Alert.alert('Erreur', 'Impossible de mettre à jour');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue');
    }
  };

  const cancelEdit = () => {
    setEditingIncident(null);
    loadIncidents();
  };

  const handleMarkerDragEnd = (e, incident) => {
    if (editingIncident && editingIncident._id === incident._id) {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      setEditingIncident({
        ...editingIncident,
        coordinates: { lat: latitude, lng: longitude }
      });
    }
  };

  const renderReportContent = () => {
    switch (reportStep) {
      case 'type':
        return (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.instructionText, { color: colors.subText, marginBottom: 20 }]}>
              Sélectionnez le type d'incident :
            </Text>
            <View style={styles.incidentTypeGrid}>
              {incidentTypes.map((incident) => (
                <TouchableOpacity
                  key={incident.type}
                  style={[styles.incidentTypeCard, { backgroundColor: colors.card }]}
                  onPress={() => selectIncidentType(incident)}
                >
                  <View style={[styles.incidentIcon, { backgroundColor: incident.color }]}>
                    <Ionicons name={incident.icon} size={28} color="white" />
                  </View>
                  <Text style={[styles.incidentLabel, { color: colors.text }]}>
                    {incident.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        );

      case 'photo':
        return (
          <View style={styles.photoStep}>
            <View style={[styles.instructionCard, { backgroundColor: colors.card }]}>
              <Ionicons name="camera" size={24} color={colors.accent} />
              <Text style={[styles.instructionText, { color: colors.text }]}>
                Prenez une photo de l'incident
              </Text>
            </View>

            <View style={styles.photoButtons}>
              <TouchableOpacity
                style={[styles.photoBtn, { backgroundColor: colors.card }]}
                onPress={() => handleImagePicker('camera')}
              >
                <Ionicons name="camera" size={48} color={colors.accent} />
                <Text style={[styles.photoBtnText, { color: colors.text }]}>
                  Appareil photo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.photoBtn, { backgroundColor: colors.card }]}
                onPress={() => handleImagePicker('gallery')}
              >
                <Ionicons name="images" size={48} color={colors.accent} />
                <Text style={[styles.photoBtnText, { color: colors.text }]}>
                  Galerie
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'confirm':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={styles.confirmStep}>
            {photoUri && (
              <Image
                source={{ uri: photoUri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            )}

            <View style={[styles.detailCard, { backgroundColor: colors.card }]}>
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Ionicons
                    name={selectedIncidentType?.icon}
                    size={20}
                    color={selectedIncidentType?.color}
                  />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: colors.subText }]}>
                    Type d'incident
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {selectedIncidentType?.label}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Ionicons name="location" size={20} color={colors.accent} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: colors.subText }]}>
                    Position
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {location?.coords.latitude.toFixed(4)}, {location?.coords.longitude.toFixed(4)}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Ionicons name="time" size={20} color={colors.accent} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: colors.subText }]}>
                    Date et heure
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {new Date().toLocaleString('fr-FR')}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: colors.accent },
                isSubmitting && styles.submitBtnDisabled
              ]}
              onPress={submitReport}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="black" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color="black" />
                  <Text style={styles.submitBtnText}>Envoyer</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={region}
        customMapStyle={dark ? darkMapStyle : []}
        showsUserLocation
        showsMyLocationButton={false}
        onMapReady={() => {
          console.log('✅ Carte chargée et prête');
          setMapReady(true);
        }}
      >
        {/* Itinéraire normal (en gris semi-transparent si les deux sont affichés) */}
        {normalRouteCoordinates.length > 0 && showBothRoutes && (
          <Polyline
            coordinates={normalRouteCoordinates}
            strokeColor={selectedRouteType === 'normal' ? (travelModes.find(m => m.mode === travelMode)?.color || colors.accent) : 'rgba(128, 128, 128, 0.5)'}
            strokeWidth={selectedRouteType === 'normal' ? 5 : 3}
            lineDashPattern={selectedRouteType === 'normal' ? null : [10, 10]}
          />
        )}

        {/* Itinéraire optimisé (en vert/accent si sélectionné) */}
        {optimizedRouteCoordinates.length > 0 && showBothRoutes && (
          <Polyline
            coordinates={optimizedRouteCoordinates}
            strokeColor={selectedRouteType === 'optimized' ? '#00E676' : 'rgba(0, 230, 118, 0.5)'}
            strokeWidth={selectedRouteType === 'optimized' ? 5 : 3}
            lineDashPattern={selectedRouteType === 'optimized' ? null : [5, 5]}
          />
        )}

        {/* Si un seul itinéraire affiché */}
        {!showBothRoutes && routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={selectedRouteType === 'optimized' ? '#00E676' : (travelModes.find(m => m.mode === travelMode)?.color || colors.accent)}
            strokeWidth={5}
          />
        )}

        {startPoint && (
          <Marker
            coordinate={{ latitude: startPoint.latitude, longitude: startPoint.longitude }}
            pinColor="#34A853"
          >
            <View style={[styles.routeMarker, { backgroundColor: '#34A853' }]}>
              <Text style={styles.routeMarkerText}>A</Text>
            </View>
          </Marker>
        )}

        {endPoint && (
          <Marker
            coordinate={{ latitude: endPoint.latitude, longitude: endPoint.longitude }}
            pinColor="#EA4335"
          >
            <View style={[styles.routeMarker, { backgroundColor: '#EA4335' }]}>
              <Text style={styles.routeMarkerText}>B</Text>
            </View>
          </Marker>
        )}

        {incidents.map((incident) => {
          const incidentType = incidentTypes.find(t => t.type === incident.type);
          const isEditing = editingIncident && editingIncident._id === incident._id;
          
          return (
            <Marker
              key={incident._id}
              coordinate={{
                latitude: isEditing ? editingIncident.coordinates.lat : incident.coordinates.lat,
                longitude: isEditing ? editingIncident.coordinates.lng : incident.coordinates.lng,
              }}
              onPress={() => {
                if (!isEditing) {
                  setSelectedIncident(incident);
                }
              }}
              draggable={isEditing}
              onDragEnd={(e) => handleMarkerDragEnd(e, incident)}
            >
              <View
                style={[
                  isEditing ? styles.customMarkerLarge : styles.customMarker,
                  { backgroundColor: incidentType?.color || '#666' },
                  isEditing && { borderColor: colors.accent, borderWidth: 3 }
                ]}
              >
                <Ionicons
                  name={incidentType?.icon || 'alert-circle'}
                  size={isEditing ? 28 : 22}
                  color="white"
                />
              </View>
            </Marker>
          );
        })}

        {/* Marqueurs de trafic (embouteillages) */}
        {trafficData.map((traffic) => {
          // Afficher uniquement si embouteillage détecté
          if (traffic.statut !== 'Embouteillage') return null;

          return (
            <Marker
              key={`traffic-${traffic.id}`}
              coordinate={{
                latitude: traffic.coordinates.lat,
                longitude: traffic.coordinates.lng,
              }}
              onPress={() => {
                Alert.alert(
                  '🚦 Embouteillage détecté',
                  `Position: ${traffic.coordinates.lat.toFixed(4)}, ${traffic.coordinates.lng.toFixed(4)}\n` +
                  `Véhicules: ${traffic.vehicules_detectes}\n` +
                  `Taux d'immobilité: ${(traffic.taux_immobilite * 100).toFixed(0)}%`,
                  [{ text: 'OK' }]
                );
              }}
            >
              <View style={styles.trafficMarker}>
                <MaterialCommunityIcons
                  name="car-multiple"
                  size={18}
                  color="#FF1744"
                />
                <View style={styles.trafficPulse} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {!showRouteMenu && !editingIncident && (
        <TouchableOpacity
          style={[styles.routeBtn, { backgroundColor: colors.card }]}
          onPress={() => openRouteMenu(null)}
        >
          <Ionicons name="navigate" size={24} color={colors.accent} />
          <Text style={[styles.routeBtnText, { color: colors.text }]}>Itinéraire</Text>
        </TouchableOpacity>
      )}

      {showRouteMenu && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[
            styles.routeMenuContainer,
            { 
              backgroundColor: colors.background,
              maxHeight: isRoutePanelMinimized && routeInfo ? '25%' : '70%',
            }
          ]}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Barre de défilement pour minimiser/maximiser */}
          {routeInfo && (
            <TouchableOpacity
              style={styles.routePanelHandle}
              onPress={() => setIsRoutePanelMinimized(!isRoutePanelMinimized)}
            >
              <View style={[styles.routePanelHandleBar, { backgroundColor: colors.subText }]} />
            </TouchableOpacity>
          )}

          <ScrollView 
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isRoutePanelMinimized}
          >
            {/* Affichage compact quand minimisé */}
            {isRoutePanelMinimized && routeInfo ? (
              <TouchableOpacity
                style={[styles.minimizedRouteInfo, { backgroundColor: colors.card }]}
                onPress={() => setIsRoutePanelMinimized(false)}
              >
                <View style={styles.minimizedRouteRow}>
                  <View style={styles.minimizedRoutePoints}>
                    <View style={[styles.routeInputDot, { backgroundColor: '#34A853' }]} />
                    <View style={styles.minimizedRouteLine} />
                    <View style={[styles.routeInputDot, { backgroundColor: '#EA4335' }]} />
                  </View>
                  <View style={styles.minimizedRouteDetails}>
                    <Text style={[styles.minimizedRouteText, { color: colors.text }]} numberOfLines={1}>
                      {searchQuery} -- {destinationQuery}
                    </Text>
                    <View style={styles.minimizedRouteStats}>
                      <Text style={[styles.minimizedRouteStatText, { color: colors.accent }]}>
                        {routeInfo.duration}
                      </Text>
                      <Text style={[styles.minimizedRouteStatText, { color: colors.subText }]}> • </Text>
                      <Text style={[styles.minimizedRouteStatText, { color: colors.accent }]}>
                        {routeInfo.distance}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-up" size={24} color={colors.subText} />
                </View>
              </TouchableOpacity>
            ) : (
              <>
                <View style={[styles.routeSearchCard, { backgroundColor: colors.card }]}>
                  <View style={styles.routeInputRow}>
                    <View style={[styles.routeInputDot, { backgroundColor: '#34A853' }]} />
                    <TextInput
                      style={[styles.routeInput, { color: colors.text, backgroundColor: dark ? '#222' : '#F5F5F5' }]}
                      placeholder="Point de départ"
                      placeholderTextColor={colors.subText}
                      value={searchQuery}
                      onChangeText={(text) => {
                        setSearchQuery(text);
                        setActiveSearchField('start');
                        searchPlaces(text, 'start');
                        setIsRoutePanelMinimized(false);
                      }}
                      onFocus={() => {
                        setActiveSearchField('start');
                        setIsRoutePanelMinimized(false);
                      }}
                    />
                    {searchQuery !== '' && (
                      <TouchableOpacity onPress={() => {
                        setSearchQuery('');
                        setStartPoint(null);
                        setRouteCoordinates([]);
                      }}>
                        <Ionicons name="close-circle" size={20} color={colors.subText} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity 
                    style={styles.swapButton}
                    onPress={swapLocations}
                  >
                    <Ionicons name="swap-vertical" size={24} color={colors.subText} />
                  </TouchableOpacity>

                  <View style={styles.routeInputRow}>
                    <View style={[styles.routeInputDot, { backgroundColor: '#EA4335' }]} />
                    <TextInput
                      style={[styles.routeInput, { color: colors.text, backgroundColor: dark ? '#222' : '#F5F5F5' }]}
                      placeholder="Destination"
                      placeholderTextColor={colors.subText}
                      value={destinationQuery}
                      onChangeText={(text) => {
                        setDestinationQuery(text);
                        setActiveSearchField('end');
                        searchPlaces(text, 'end');
                        setIsRoutePanelMinimized(false);
                      }}
                      onFocus={() => {
                        setActiveSearchField('end');
                        setIsRoutePanelMinimized(false);
                      }}
                    />
                    {destinationQuery !== '' && (
                      <TouchableOpacity onPress={() => {
                        setDestinationQuery('');
                        setEndPoint(null);
                        setRouteCoordinates([]);
                      }}>
                        <Ionicons name="close-circle" size={20} color={colors.subText} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.myLocationButton}
                    onPress={() => useMyLocation(activeSearchField)}
                  >
                    <Ionicons name="locate" size={20} color={colors.accent} />
                    <Text style={[styles.myLocationButtonText, { color: colors.accent }]}>
                      Utiliser ma position
                    </Text>
                  </TouchableOpacity>
                </View>

                {searchResults.length > 0 && (
                  <View style={[styles.searchResultsContainer, { backgroundColor: colors.card }]}>
                    <FlatList
                      data={searchResults}
                      keyExtractor={(item) => item.id.toString()}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={[styles.searchResultItem, { borderBottomColor: dark ? '#333' : '#EEE' }]}
                          onPress={() => selectPlace(item, activeSearchField)}
                        >
                          <Ionicons name="location" size={20} color={colors.subText} />
                          <View style={styles.searchResultContent}>
                            <Text style={[styles.searchResultName, { color: colors.text }]}>
                              {item.shortName}
                            </Text>
                            <Text style={[styles.searchResultAddress, { color: colors.subText }]} numberOfLines={1}>
                              {item.address}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}
                      scrollEnabled={false}
                      nestedScrollEnabled
                    />
                  </View>
                )}

                {routeCoordinates.length > 0 && (
                  <View style={[styles.travelModesContainer, { backgroundColor: colors.card }]}>
                    {travelModes.map((mode) => (
                      <TouchableOpacity
                        key={mode.mode}
                        style={[
                          styles.travelModeBtn,
                          travelMode === mode.mode && { backgroundColor: `${mode.color}20` }
                        ]}
                        onPress={() => changeTravelMode(mode.mode)}
                      >
                        <Ionicons
                          name={mode.icon}
                          size={24}
                          color={travelMode === mode.mode ? mode.color : colors.subText}
                        />
                        <Text style={[
                          styles.travelModeText,
                          { color: travelMode === mode.mode ? mode.color : colors.subText }
                        ]}>
                          {mode.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Sélecteur de type d'itinéraire */}
                {normalRouteInfo && optimizedRouteInfo && (
                  <View style={[styles.routeTypeSelectorContainer, { backgroundColor: colors.card }]}>
                    <Text style={[styles.routeTypeSelectorTitle, { color: colors.subText }]}>
                      Type d'itinéraire
                    </Text>
                    <View style={styles.routeTypeBtns}>
                      {/* Itinéraire Normal */}
                      <TouchableOpacity
                        style={[
                          styles.routeTypeBtn,
                          selectedRouteType === 'normal' && { backgroundColor: '#4285F420', borderColor: '#4285F4' }
                        ]}
                        onPress={() => {
                          setSelectedRouteType('normal');
                          setRouteCoordinates(normalRouteCoordinates);
                          setRouteInfo(normalRouteInfo);
                        }}
                      >
                        <View style={styles.routeTypeBtnHeader}>
                          <Ionicons 
                            name="navigate" 
                            size={20} 
                            color={selectedRouteType === 'normal' ? '#4285F4' : colors.subText} 
                          />
                          <Text style={[
                            styles.routeTypeBtnTitle,
                            { color: selectedRouteType === 'normal' ? '#4285F4' : colors.text }
                          ]}>
                            Rapide
                          </Text>
                        </View>
                        <Text style={[styles.routeTypeInfo, { color: colors.subText }]}>
                          {normalRouteInfo.duration} • {normalRouteInfo.distance}
                        </Text>
                      </TouchableOpacity>

                      {/* Itinéraire Optimisé */}
                      <TouchableOpacity
                        style={[
                          styles.routeTypeBtn,
                          selectedRouteType === 'optimized' && { backgroundColor: '#00E67620', borderColor: '#00E676' }
                        ]}
                        onPress={() => {
                          setSelectedRouteType('optimized');
                          setRouteCoordinates(optimizedRouteCoordinates);
                          setRouteInfo(optimizedRouteInfo);
                        }}
                      >
                        <View style={styles.routeTypeBtnHeader}>
                          <Ionicons 
                            name="shield-checkmark" 
                            size={20} 
                            color={selectedRouteType === 'optimized' ? '#00E676' : colors.subText} 
                          />
                          <Text style={[
                            styles.routeTypeBtnTitle,
                            { color: selectedRouteType === 'optimized' ? '#00E676' : colors.text }
                          ]}>
                            Sécurisé
                          </Text>
                          {optimizedRouteInfo.obstaclesAvoided > 0 && (
                            <View style={styles.obstaclesBadge}>
                              <Text style={styles.obstaclesBadgeText}>
                                {optimizedRouteInfo.obstaclesAvoided}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.routeTypeInfo, { color: colors.subText }]}>
                          {optimizedRouteInfo.duration} • {optimizedRouteInfo.distance}
                        </Text>
                        <View style={styles.safetyScoreContainer}>
                          <View style={[
                            styles.safetyScoreBar,
                            { 
                              width: `${optimizedRouteInfo.safetyScore}%`,
                              backgroundColor: optimizedRouteInfo.safetyScore >= 80 ? '#00E676' : 
                                             optimizedRouteInfo.safetyScore >= 50 ? '#FFA726' : '#FF4444'
                            }
                          ]} />
                        </View>
                        <Text style={[styles.safetyScoreText, { color: colors.subText }]}>
                          Sécurité: {optimizedRouteInfo.safetyScore}%
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Toggle pour afficher/masquer les deux itinéraires */}
                    <TouchableOpacity
                      style={styles.showBothRoutesBtn}
                      onPress={() => setShowBothRoutes(!showBothRoutes)}
                    >
                      <Ionicons 
                        name={showBothRoutes ? 'eye' : 'eye-off'} 
                        size={18} 
                        color={colors.accent} 
                      />
                      <Text style={[styles.showBothRoutesText, { color: colors.accent }]}>
                        {showBothRoutes ? 'Masquer l\'autre' : 'Afficher les deux'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {routeInfo && (
                  <View style={[styles.routeInfoCard, { backgroundColor: colors.card }]}>
                    <View style={styles.routeInfoRow}>
                      <Ionicons name="time-outline" size={20} color={colors.accent} />
                      <Text style={[styles.routeInfoText, { color: colors.text }]}>
                        {routeInfo.duration}
                      </Text>
                    </View>
                    <View style={styles.routeInfoRow}>
                      <Ionicons name="navigate-outline" size={20} color={colors.accent} />
                      <Text style={[styles.routeInfoText, { color: colors.text }]}>
                        {routeInfo.distance}
                      </Text>
                    </View>
                    {isSearching && (
                      <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 10 }} />
                    )}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.closeRouteBtn, { backgroundColor: colors.card }]}
            onPress={clearRoute}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </KeyboardAvoidingView>
      )}

      <TouchableOpacity
        style={[styles.myLocationBtn, { backgroundColor: colors.card }]}
        onPress={centerOnUser}
      >
        <Ionicons name="locate" size={24} color={colors.accent} />
      </TouchableOpacity>

      {!editingIncident && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.accent }]}
          onPress={startReport}
        >
          <Ionicons name="add" size={32} color="black" />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.settingsBtn, { backgroundColor: colors.card }]}
        onPress={() => router.push('/settings')}
      >
        <Ionicons name="settings-outline" size={24} color={colors.text} />
      </TouchableOpacity>

      {editingIncident && (
        <View style={[styles.editBar, { backgroundColor: colors.card }]}>
          <Text style={[styles.editBarText, { color: colors.text }]}>
            Déplacez le marqueur
          </Text>
          <View style={styles.editBarButtons}>
            <TouchableOpacity
              style={[styles.editBarBtn, { backgroundColor: '#FF4444' }]}
              onPress={cancelEdit}
            >
              <Text style={styles.editBarBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editBarBtn, { backgroundColor: colors.accent }]}
              onPress={saveNewPosition}
            >
              <Text style={styles.editBarBtnText}>Valider</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal
        visible={showReportMenu}
        animationType="slide"
        transparent
        onRequestClose={closeReportModal}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeReportModal}>
                <Ionicons name="arrow-back" size={28} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {reportStep === 'type' && 'Nouveau signalement'}
                {reportStep === 'photo' && 'Ajouter une photo'}
                {reportStep === 'confirm' && 'Confirmation'}
              </Text>
              <View style={{ width: 28 }} />
            </View>

            {renderReportContent()}
          </View>
        </View>
      </Modal>

      <Modal
        visible={selectedIncident !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedIncident(null)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedIncident(null)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Détails
              </Text>
              <View style={{ width: 28 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedIncident?.photo_url && (
                <Image
                  source={{ uri: getImageUrl(selectedIncident.photo_url) }}
                  style={styles.incidentDetailPhoto}
                  resizeMode="cover"
                />
              )}

              <View style={[styles.detailCard, { backgroundColor: colors.card }]}>
                <View style={styles.detailRow}>
                  <View style={styles.detailIconContainer}>
                    <Ionicons
                      name={incidentTypes.find(t => t.type === selectedIncident?.type)?.icon || 'alert-circle'}
                      size={20}
                      color={incidentTypes.find(t => t.type === selectedIncident?.type)?.color || '#666'}
                    />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={[styles.detailLabel, { color: colors.subText }]}>
                      Type
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {incidentTypes.find(t => t.type === selectedIncident?.type)?.label || 'Inconnu'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailIconContainer}>
                    <Ionicons name="time" size={20} color={colors.accent} />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={[styles.detailLabel, { color: colors.subText }]}>
                      Signalé le
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {selectedIncident && new Date(selectedIncident.reported_at).toLocaleString('fr-FR')}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailIconContainer}>
                    <Ionicons name="location" size={20} color={colors.accent} />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={[styles.detailLabel, { color: colors.subText }]}>
                      Coordonnées
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {selectedIncident?.coordinates.lat.toFixed(4)}, {selectedIncident?.coordinates.lng.toFixed(4)}
                    </Text>
                  </View>
                </View>
              </View>

              {(user?.id === selectedIncident?.user_id || isGuest) && (
                <TouchableOpacity
                  style={[styles.editPositionBtn, { backgroundColor: colors.accent }]}
                  onPress={() => enableEditMode(selectedIncident)}
                >
                  <Ionicons name="move" size={20} color="black" />
                  <Text style={styles.editPositionBtnText}>Modifier la position</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.closeDetailBtn, { backgroundColor: colors.card }]}
                onPress={() => setSelectedIncident(null)}
              >
                <Text style={[styles.closeDetailBtnText, { color: colors.text }]}>
                  Fermer
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Nouvelle barre de résultats d'itinéraire en bas */}
      {showRouteResultsBar && routeCoordinates.length > 0 && (
        <View style={[styles.routeResultsBar, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.closeResultsBarBtn}
            onPress={() => {
              setShowRouteResultsBar(false);
              clearRoute();
            }}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </TouchableOpacity>

          {/* Sélecteur de type d'itinéraire EN HAUT */}
          {normalRouteInfo && optimizedRouteInfo && (
            <View style={styles.routeTypeToggle}>
              <TouchableOpacity
                style={[
                  styles.routeTypeToggleBtn,
                  selectedRouteType === 'normal' && { 
                    backgroundColor: '#4285F420',
                    borderColor: '#4285F4',
                  }
                ]}
                onPress={() => {
                  setSelectedRouteType('normal');
                  const modeData = allModesRouteInfo[travelMode];
                  setRouteCoordinates(modeData.coordinates);
                  setRouteInfo(modeData.normal);
                }}
              >
                <Ionicons 
                  name="flash" 
                  size={16} 
                  color={selectedRouteType === 'normal' ? '#4285F4' : colors.subText} 
                />
                <Text style={[
                  styles.routeTypeToggleText,
                  { color: selectedRouteType === 'normal' ? '#4285F4' : colors.subText }
                ]}>
                  Rapide
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.routeTypeToggleBtn,
                  selectedRouteType === 'optimized' && { 
                    backgroundColor: '#00E67620',
                    borderColor: '#00E676',
                  }
                ]}
                onPress={() => {
                  setSelectedRouteType('optimized');
                  const modeData = allModesRouteInfo[travelMode];
                  setRouteCoordinates(modeData.optimizedCoordinates);
                  setRouteInfo(modeData.optimized);
                }}
              >
                <Ionicons 
                  name="shield-checkmark" 
                  size={16} 
                  color={selectedRouteType === 'optimized' ? '#00E676' : colors.subText} 
                />
                <Text style={[
                  styles.routeTypeToggleText,
                  { color: selectedRouteType === 'optimized' ? '#00E676' : colors.subText }
                ]}>
                  Sécurisé
                </Text>
                {allModesRouteInfo[travelMode]?.optimized?.obstaclesAvoided > 0 && (
                  <View style={styles.obstaclesBadgeSmall}>
                    <Text style={styles.obstaclesBadgeSmallText}>
                      {allModesRouteInfo[travelMode].optimized.obstaclesAvoided}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Afficher le warning s'il y en a un */}
          {optimizedRouteInfo?.warning && selectedRouteType === 'optimized' && (
            <View style={[styles.warningBanner, { 
              backgroundColor: optimizedRouteInfo.warning.includes('✓') ? '#00E67615' : '#FFA72615',
              borderColor: optimizedRouteInfo.warning.includes('✓') ? '#00E676' : '#FFA726'
            }]}>
              <Ionicons 
                name={optimizedRouteInfo.warning.includes('✓') ? 'checkmark-circle' : 'alert-circle'} 
                size={16} 
                color={optimizedRouteInfo.warning.includes('✓') ? '#00E676' : '#FFA726'} 
              />
              <Text style={[styles.warningText, { 
                color: optimizedRouteInfo.warning.includes('✓') ? '#00E676' : '#FFA726'
              }]}>
                {optimizedRouteInfo.warning}
              </Text>
            </View>
          )}

          {/* Modes de transport avec TOUS les temps */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.travelModesScroll}>
            {travelModes.map((mode) => {
              const modeData = allModesRouteInfo[mode.mode];
              const modeInfo = modeData 
                ? (selectedRouteType === 'normal' ? modeData.normal : modeData.optimized)
                : null;
              
              return (
                <TouchableOpacity
                  key={mode.mode}
                  style={[
                    styles.travelModeResultCard,
                    { 
                      backgroundColor: travelMode === mode.mode ? mode.color + '20' : 'transparent',
                      borderColor: travelMode === mode.mode ? mode.color : colors.border,
                    }
                  ]}
                  onPress={() => {
                    setTravelMode(mode.mode);
                    // Mettre à jour les coordonnées pour le nouveau mode
                    if (modeData) {
                      if (selectedRouteType === 'normal') {
                        setRouteCoordinates(modeData.coordinates);
                        setRouteInfo(modeData.normal);
                      } else {
                        setRouteCoordinates(modeData.optimizedCoordinates);
                        setRouteInfo(modeData.optimized);
                      }
                    }
                  }}
                >
                  <Ionicons 
                    name={mode.icon} 
                    size={24} 
                    color={travelMode === mode.mode ? mode.color : colors.subText} 
                  />
                  <View style={styles.travelModeResultInfo}>
                    <Text style={[
                      styles.travelModeResultLabel, 
                      { color: travelMode === mode.mode ? mode.color : colors.text }
                    ]}>
                      {mode.label}
                    </Text>
                    {modeInfo && (
                      <Text style={[styles.travelModeResultTime, { color: colors.subText }]}>
                        {modeInfo.duration}
                      </Text>
                    )}
                    {!modeInfo && (
                      <ActivityIndicator size="small" color={colors.subText} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  routeBtn: {
    position: 'absolute',
    top: 60,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 25,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    gap: 8,
  },
  routeBtnText: { fontSize: 16, fontWeight: '600' },
  routeMenuContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    zIndex: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  routePanelHandle: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  routePanelHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.3,
  },
  minimizedRouteInfo: {
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    elevation: 3,
  },
  minimizedRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  minimizedRoutePoints: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimizedRouteLine: {
    width: 2,
    height: 20,
    backgroundColor: '#999',
    marginVertical: 2,
  },
  minimizedRouteDetails: {
    flex: 1,
  },
  minimizedRouteText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  minimizedRouteStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  minimizedRouteStatText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  routeSearchCard: {
    borderRadius: 15,
    padding: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  routeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  routeInputDot: { width: 12, height: 12, borderRadius: 6 },
  routeInput: {
    flex: 1,
    height: 45,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  swapButton: {
    alignSelf: 'flex-start',
    marginLeft: 22,
    marginVertical: 5,
  },
  myLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  myLocationButtonText: { fontSize: 14, fontWeight: '600' },
  searchResultsContainer: {
    marginTop: 10,
    borderRadius: 15,
    maxHeight: 250,
    elevation: 5,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  searchResultContent: { flex: 1 },
  searchResultName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  searchResultAddress: { fontSize: 13 },
  travelModesContainer: {
    flexDirection: 'row',
    marginTop: 10,
    borderRadius: 15,
    padding: 10,
    elevation: 3,
    gap: 10,
  },
  travelModeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  travelModeText: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  routeInfoCard: {
    flexDirection: 'row',
    marginTop: 10,
    padding: 15,
    borderRadius: 15,
    elevation: 3,
    gap: 20,
  },
  routeInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeInfoText: { fontSize: 16, fontWeight: 'bold' },
  closeRouteBtn: {
    position: 'absolute',
    top: 70,
    right: 30,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  routeMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  routeMarkerText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  myLocationBtn: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    width: 65,
    height: 65,
    borderRadius: 33,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  settingsBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 45,
    height: 45,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  editBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    elevation: 10,
  },
  editBarText: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  editBarButtons: { flexDirection: 'row', gap: 10 },
  editBarBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBarBtnText: { color: 'black', fontWeight: 'bold', fontSize: 16 },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    minHeight: '45%',
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center', marginHorizontal: 10 },
  incidentTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  incidentTypeCard: {
    width: '31%',
    aspectRatio: 0.95,
    borderRadius: 20,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  incidentIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  incidentLabel: { fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  instructionCard: { flexDirection: 'row', padding: 15, borderRadius: 15, gap: 12, alignItems: 'center' },
  instructionText: { flex: 1, fontSize: 14, lineHeight: 20 },
  photoStep: { flex: 1 },
  photoButtons: { flexDirection: 'row', gap: 15, marginTop: 20 },
  photoBtn: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    elevation: 3,
  },
  photoBtnText: { marginTop: 12, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  confirmStep: { flex: 1 },
  previewImage: { width: '100%', height: 220, borderRadius: 15, marginBottom: 20 },
  detailCard: { padding: 15, borderRadius: 15, gap: 15, marginBottom: 20 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 102, 0.1)',
  },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 12, marginBottom: 2 },
  detailValue: { fontSize: 15, fontWeight: '600' },
  submitBtn: {
    height: 55,
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: 'black', fontSize: 17, fontWeight: 'bold' },
  customMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  customMarkerLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'white',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  incidentDetailPhoto: { width: '100%', height: 220, borderRadius: 15, marginBottom: 15 },
  editPositionBtn: {
    height: 50,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  editPositionBtnText: { color: 'black', fontSize: 16, fontWeight: 'bold' },
  closeDetailBtn: {
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  closeDetailBtnText: { fontSize: 17, fontWeight: 'bold' },
  // Styles pour les marqueurs de trafic
  trafficMarker: {
    width: 35,
    height: 35,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF1744',
    elevation: 3,
    shadowColor: '#FF1744',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  trafficPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 23, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 23, 68, 0.3)',
  },
  // Styles pour le sélecteur de type d'itinéraire
  routeTypeSelectorContainer: {
    padding: 15,
    borderRadius: 15,
    marginTop: 15,
    gap: 12,
  },
  routeTypeSelectorTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeTypeBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  routeTypeBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  routeTypeBtnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  routeTypeBtnTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  routeTypeInfo: {
    fontSize: 12,
    marginTop: 4,
  },
  obstaclesBadge: {
    backgroundColor: '#FF4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 'auto',
  },
  obstaclesBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  safetyScoreContainer: {
    height: 4,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  safetyScoreBar: {
    height: '100%',
    borderRadius: 2,
  },
  safetyScoreText: {
    fontSize: 10,
    marginTop: 4,
  },
  showBothRoutesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  showBothRoutesText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Styles pour la barre de résultats d'itinéraire en bas
  routeResultsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    flexDirection: 'column',
    gap: 12,
  },
  closeResultsBarBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  travelModesScroll: {
    marginTop: 5,
  },
  travelModeResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 12,
    borderWidth: 2,
    marginRight: 10,
    minWidth: 130,
  },
  travelModeResultInfo: {
    gap: 2,
  },
  travelModeResultLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  travelModeResultTime: {
    fontSize: 12,
  },
  routeTypeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 5,
  },
  routeTypeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  routeTypeToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  obstaclesBadgeSmall: {
    backgroundColor: '#FF4444',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 4,
  },
  obstaclesBadgeSmallText: {
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 5,
  },
  warningText: {
    fontSize: 12,
    flex: 1,
    fontWeight: '500',
  },
});