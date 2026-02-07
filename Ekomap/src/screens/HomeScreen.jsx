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
  FlatList
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Callout, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { postIncident, getIncidents, updateIncidentPosition } from '../api/reports';
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

  // États des incidents
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [editingIncident, setEditingIncident] = useState(null);

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

  const mapRef = useRef(null);
  const searchTimeout = useRef(null);

  // Types d'incidents
  const incidentTypes = [
    { type: 'accident', icon: 'car', label: t('accident'), color: '#FF4444', requiresPhoto: true },
    { type: 'controle', icon: 'shield-checkmark', label: t('control'), color: '#FFA726', requiresPhoto: false },
    { type: 'danger', icon: 'warning', label: t('risk'), color: '#FF9800', requiresPhoto: true },
    { type: 'travaux', icon: 'construct', label: t('works'), color: '#FFD700', requiresPhoto: true },
  ];

  // Modes de transport
  const travelModes = [
    { mode: 'driving', icon: 'car', label: 'Voiture', color: '#4285F4' },
    { mode: 'walking', icon: 'walk', label: 'À pied', color: '#34A853' },
    { mode: 'bicycling', icon: 'bicycle', label: 'Vélo', color: '#FBBC04' },
  ];

  // Style carte sombre
  const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
    { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
    { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
    { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
    { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
  ];

  // Permissions de localisation
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'La localisation est nécessaire');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      setRegion({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    })();
  }, []);

  useEffect(() => {
    loadIncidents();
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
      
      let profile = 'driving';
      if (mode === 'walking') profile = 'foot';
      if (mode === 'bicycling') profile = 'bike';
      
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/${profile === 'driving' ? 'car' : profile}/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&steps=true`
      );
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map(coord => ({
          latitude: coord[1],
          longitude: coord[0],
        }));
        
        setRouteCoordinates(coordinates);
        
        const distanceKm = (route.distance / 1000).toFixed(1);
        const durationMin = Math.round(route.duration / 60);
        
        let durationText = '';
        if (durationMin < 60) {
          durationText = `${durationMin} min`;
        } else {
          const hours = Math.floor(durationMin / 60);
          const mins = durationMin % 60;
          durationText = mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
        }
        
        setRouteInfo({
          distance: `${distanceKm} km`,
          duration: durationText,
          durationMinutes: durationMin,
        });

        if (mapRef.current) {
          mapRef.current.fitToCoordinates(
            [
              { latitude: start.latitude, longitude: start.longitude },
              { latitude: end.latitude, longitude: end.longitude }
            ],
            {
              edgePadding: { top: 150, right: 50, bottom: 250, left: 50 },
              animated: true,
            }
          );
        }
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
    setStartPoint(null);
    setEndPoint(null);
    setRouteInfo(null);
    setSearchQuery('');
    setDestinationQuery('');
    setShowRouteMenu(false);
    setSearchResults([]);
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
          mediaTypes: ['images'],
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
          mediaTypes: ['images'],
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
                    <Ionicons name={incident.icon} size={40} color="white" />
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
      >
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={travelModes.find(m => m.mode === travelMode)?.color || colors.accent}
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
        <View style={[styles.routeMenuContainer, { backgroundColor: colors.background }]}>
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
                }}
                onFocus={() => setActiveSearchField('start')}
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
                }}
                onFocus={() => setActiveSearchField('end')}
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

          <TouchableOpacity
            style={[styles.closeRouteBtn, { backgroundColor: colors.card }]}
            onPress={clearRoute}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 10,
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
    minHeight: '60%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center', marginHorizontal: 10 },
  incidentTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, justifyContent: 'space-between' },
  incidentTypeCard: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: 20,
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  incidentIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  incidentLabel: { fontSize: 15, fontWeight: 'bold', textAlign: 'center' },
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
});