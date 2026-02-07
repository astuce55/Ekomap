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
  ScrollView
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { postIncident, getIncidents } from '../api/reports';
import { useRouter } from 'expo-router';

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

  // États du signalement
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [selectedIncidentType, setSelectedIncidentType] = useState(null);
  const [markerPosition, setMarkerPosition] = useState(null);
  const [photoUri, setPhotoUri] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportStep, setReportStep] = useState('type');

  // États de recherche et itinéraire
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const mapRef = useRef(null);

  // Types d'incidents disponibles
  const incidentTypes = [
    { type: 'accident', icon: 'car', label: t('accident'), color: '#FF4444', requiresPhoto: true },
    { type: 'controle', icon: 'shield-checkmark', label: t('control'), color: '#FFA726', requiresPhoto: false },
    { type: 'danger', icon: 'warning', label: t('risk'), color: '#FF9800', requiresPhoto: true },
    { type: 'travaux', icon: 'construct', label: t('works'), color: '#FFD700', requiresPhoto: true },
  ];

  // Style de carte sombre adapté au thème
  const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
    {
      featureType: 'administrative.locality',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#d59563' }],
    },
    {
      featureType: 'poi',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#d59563' }],
    },
    {
      featureType: 'poi.park',
      elementType: 'geometry',
      stylers: [{ color: '#263c3f' }],
    },
    {
      featureType: 'poi.park',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#6b9a76' }],
    },
    {
      featureType: 'road',
      elementType: 'geometry',
      stylers: [{ color: '#38414e' }],
    },
    {
      featureType: 'road',
      elementType: 'geometry.stroke',
      stylers: [{ color: '#212a37' }],
    },
    {
      featureType: 'road',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#9ca5b3' }],
    },
    {
      featureType: 'road.highway',
      elementType: 'geometry',
      stylers: [{ color: '#746855' }],
    },
    {
      featureType: 'road.highway',
      elementType: 'geometry.stroke',
      stylers: [{ color: '#1f2835' }],
    },
    {
      featureType: 'road.highway',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#f3d19c' }],
    },
    {
      featureType: 'transit',
      elementType: 'geometry',
      stylers: [{ color: '#2f3948' }],
    },
    {
      featureType: 'transit.station',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#d59563' }],
    },
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [{ color: '#17263c' }],
    },
    {
      featureType: 'water',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#515c6d' }],
    },
    {
      featureType: 'water',
      elementType: 'labels.text.stroke',
      stylers: [{ color: '#17263c' }],
    },
  ];

  // Demander les permissions de localisation
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'La localisation est nécessaire pour utiliser l\'application');
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

  // Charger les incidents au démarrage et après chaque signalement
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
      console.error('Erreur lors du chargement des incidents:', error);
    }
  };

  // Centrer sur la position de l'utilisateur
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

  // Démarrer un nouveau signalement
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

  // Sélectionner le type d'incident
  const selectIncidentType = (incident) => {
    setSelectedIncidentType(incident);
    // Initialiser la position du marqueur à la position de l'utilisateur
    if (location) {
      setMarkerPosition({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    }
    setReportStep('position');
  };

  // Confirmer la position
  const confirmPosition = () => {
    // Si le type ne nécessite pas de photo (controle), on passe à la confirmation
    if (selectedIncidentType && !selectedIncidentType.requiresPhoto) {
      setReportStep('confirm');
    } else {
      setReportStep('photo');
    }
  };

  // Prendre ou sélectionner une photo
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
      console.error('Erreur lors de la sélection de l\'image:', error);
      Alert.alert('Erreur', 'Impossible de charger l\'image');
    }
  };

  // Soumettre le signalement
  const submitReport = async () => {
    // Vérifier les conditions selon le type
    if (!selectedIncidentType || !markerPosition) {
      Alert.alert('Erreur', 'Veuillez compléter toutes les étapes');
      return;
    }

    // Si le type nécessite une photo, vérifier qu'elle est présente
    if (selectedIncidentType.requiresPhoto && !photoUri) {
      Alert.alert('Erreur', 'Une photo est requise pour ce type de signalement');
      return;
    }

    setIsSubmitting(true);

    try {
      const incidentData = {
        type: selectedIncidentType.type,
        lat: markerPosition.latitude,
        lng: markerPosition.longitude,
        photoUri: photoUri || null,
        reported_at: new Date().toISOString(),
        user_id: user?.id,
        is_guest: isGuest,
      };

      const response = await postIncident(incidentData);

      if (response.success) {
        Alert.alert(
          'Succès',
          'Votre signalement a été enregistré avec succès. Merci de contribuer à la sécurité de la communauté !',
          [{ 
            text: 'OK', 
            onPress: () => {
              closeReportModal();
              loadIncidents(); // Recharger les incidents
            }
          }]
        );
      } else {
        Alert.alert('Erreur', response.error || 'Impossible d\'envoyer le signalement');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'envoi');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fermer le modal de signalement
  const closeReportModal = () => {
    setShowReportMenu(false);
    setSelectedIncidentType(null);
    setMarkerPosition(null);
    setPhotoUri(null);
    setReportStep('type');
  };

  // Annuler le signalement à n'importe quelle étape
  const cancelReport = () => {
    Alert.alert(
      'Annuler le signalement',
      'Voulez-vous vraiment annuler ? Toutes les informations seront perdues.',
      [
        { text: 'Non', style: 'cancel' },
        { text: 'Oui, annuler', style: 'destructive', onPress: closeReportModal }
      ]
    );
  };

  // Revenir à l'étape précédente
  const goBackStep = () => {
    if (reportStep === 'confirm') {
      if (selectedIncidentType && !selectedIncidentType.requiresPhoto) {
        setReportStep('position');
      } else {
        setReportStep('photo');
        setPhotoUri(null);
      }
    } else if (reportStep === 'photo') {
      setReportStep('position');
    } else if (reportStep === 'position') {
      setReportStep('type');
      setMarkerPosition(null);
      setSelectedIncidentType(null);
    }
  };

  // Obtenir l'icône du marqueur selon le type
  const getMarkerIcon = (type) => {
    const incident = incidentTypes.find(i => i.type === type);
    return incident ? incident.icon : 'alert-circle';
  };

  // Obtenir la couleur du marqueur selon le type
  const getMarkerColor = (type) => {
    const incident = incidentTypes.find(i => i.type === type);
    return incident ? incident.color : '#999999';
  };

  return (
    <View style={styles.container}>
      {/* Carte OpenStreetMap - TOUJOURS INTERACTIVE */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
        showsPointsOfInterest={true}
        showsBuildings={true}
        mapType="standard"
        customMapStyle={dark ? darkMapStyle : []}
        // CARTE TOUJOURS INTERACTIVE - AUCUNE RESTRICTION
        scrollEnabled={true}
        zoomEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
      >
        {/* Marqueurs des incidents existants */}
        {incidents.map((incident) => (
          <Marker
            key={incident.id || incident._id}
            coordinate={{
              latitude: incident.coordinates?.lat || incident.lat,
              longitude: incident.coordinates?.lng || incident.lng,
            }}
            onPress={() => setSelectedIncident(incident)}
          >
            <View style={[styles.customMarker, { backgroundColor: getMarkerColor(incident.type) }]}>
              <Ionicons name={getMarkerIcon(incident.type)} size={20} color="white" />
            </View>
          </Marker>
        ))}

        {/* Marqueur de signalement en cours - TOUJOURS DRAGGABLE */}
        {markerPosition && selectedIncidentType && reportStep === 'position' && (
          <Marker
            coordinate={markerPosition}
            draggable={true}
            onDragEnd={(e) => setMarkerPosition(e.nativeEvent.coordinate)}
          >
            <View style={[styles.customMarkerLarge, { backgroundColor: selectedIncidentType.color }]}>
              <Ionicons name={selectedIncidentType.icon} size={28} color="white" />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Barre de recherche (masquée pour les invités) */}
      {!isGuest && !showReportMenu && (
        <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
          <Ionicons name="search" size={20} color={colors.subText} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('whereTo')}
            placeholderTextColor={colors.subText}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setShowSearch(true)}
          />
        </View>
      )}

      {/* Bouton centrer sur ma position */}
      {!showReportMenu && (
        <TouchableOpacity
          style={[styles.myLocationBtn, { backgroundColor: colors.card }]}
          onPress={centerOnUser}
        >
          <Ionicons name="locate" size={24} color={colors.accent} />
        </TouchableOpacity>
      )}

      {/* Bouton de signalement (FAB) */}
      {!showReportMenu && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.accent }]}
          onPress={startReport}
        >
          <Ionicons name="add" size={32} color="black" />
        </TouchableOpacity>
      )}

      {/* Bouton paramètres */}
      {!showReportMenu && (
        <TouchableOpacity
          style={[styles.settingsBtn, { backgroundColor: colors.card }]}
          onPress={() => router.push('/settings')}
        >
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      )}

      {/* Modal de détails d'incident */}
      <Modal
        visible={selectedIncident !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedIncident(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={{ flex: 1 }} 
            activeOpacity={1} 
            onPress={() => setSelectedIncident(null)}
          />
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Détails du signalement
              </Text>
              <TouchableOpacity onPress={() => setSelectedIncident(null)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedIncident && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Photo si disponible */}
                {selectedIncident.photo_url && (
                  <Image
                    source={{ uri: `http://192.168.1.100:3000${selectedIncident.photo_url}` }}
                    style={styles.incidentDetailPhoto}
                    resizeMode="cover"
                  />
                )}

                {/* Informations */}
                <View style={[styles.detailCard, { backgroundColor: colors.card }]}>
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconContainer}>
                      <Ionicons name="information-circle" size={20} color={colors.accent} />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={[styles.detailLabel, { color: colors.subText }]}>Type</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {incidentTypes.find(i => i.type === selectedIncident.type)?.label || selectedIncident.type}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={styles.detailIconContainer}>
                      <Ionicons name="location" size={20} color={colors.accent} />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={[styles.detailLabel, { color: colors.subText }]}>Position GPS</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {selectedIncident.coordinates?.lat.toFixed(6) || selectedIncident.lat?.toFixed(6)},{' '}
                        {selectedIncident.coordinates?.lng.toFixed(6) || selectedIncident.lng?.toFixed(6)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={styles.detailIconContainer}>
                      <Ionicons name="time" size={20} color={colors.accent} />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={[styles.detailLabel, { color: colors.subText }]}>Date et heure</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {new Date(selectedIncident.reported_at || selectedIncident.created_at).toLocaleString('fr-FR')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={styles.detailIconContainer}>
                      <Ionicons 
                        name={selectedIncident.status === 'verified' ? 'checkmark-circle' : 'time'} 
                        size={20} 
                        color={selectedIncident.status === 'verified' ? colors.accent : colors.subText} 
                      />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={[styles.detailLabel, { color: colors.subText }]}>Statut</Text>
                      <Text style={[styles.detailValue, { 
                        color: selectedIncident.status === 'verified' ? colors.accent : colors.subText 
                      }]}>
                        {selectedIncident.status === 'verified' ? 'Vérifié ✓' : 
                         selectedIncident.status === 'pending' ? 'En attente de vérification' : 'Rejeté'}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.closeDetailBtn, { backgroundColor: colors.accent }]}
                  onPress={() => setSelectedIncident(null)}
                >
                  <Text style={styles.closeDetailBtnText}>Fermer</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de signalement */}
      <Modal
        visible={showReportMenu}
        animationType="slide"
        transparent
        onRequestClose={cancelReport}
      >
        <View style={reportStep === 'position' ? styles.modalContainerPosition : styles.modalContainer}>
          {reportStep === 'position' && (
            <TouchableOpacity 
              style={{ flex: 1 }} 
              activeOpacity={1}
            />
          )}
          
          <View style={[
            reportStep === 'position' ? styles.modalContentPosition : styles.modalContent,
            { backgroundColor: colors.background }
          ]}>
            {/* En-tête avec bouton annuler */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={reportStep === 'type' ? cancelReport : goBackStep}>
                <Ionicons 
                  name={reportStep === 'type' ? "close" : "arrow-back"} 
                  size={28} 
                  color={colors.text} 
                />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {reportStep === 'type' && t('reportIncident')}
                {reportStep === 'position' && 'Positionner le marqueur'}
                {reportStep === 'photo' && 'Ajouter une photo'}
                {reportStep === 'confirm' && 'Confirmer'}
              </Text>
              {/* Bouton ANNULER toujours visible */}
              <TouchableOpacity onPress={cancelReport}>
                <Text style={[styles.cancelText, { color: '#FF4444' }]}>Annuler</Text>
              </TouchableOpacity>
            </View>

            {/* Étape 1: Sélection du type */}
            {reportStep === 'type' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.incidentTypeGrid}>
                  {incidentTypes.map((incident) => (
                    <TouchableOpacity
                      key={incident.type}
                      style={[styles.incidentTypeCard, { backgroundColor: incident.color }]}
                      onPress={() => selectIncidentType(incident)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.incidentIcon, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                        <Ionicons name={incident.icon} size={40} color="white" />
                      </View>
                      <Text style={[styles.incidentLabel, { color: 'white' }]}>
                        {incident.label}
                      </Text>
                      {!incident.requiresPhoto && (
                        <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, marginTop: 4, fontWeight: '600' }}>
                          ⚡ Sans photo
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* Étape 2: Positionnement */}
            {reportStep === 'position' && (
              <View style={styles.positionStepCompact}>
                <View style={[styles.instructionCardCompact, { backgroundColor: colors.card }]}>
                  <Ionicons name="hand-left" size={24} color={colors.accent} />
                  <Text style={[styles.instructionTextCompact, { color: colors.text }]}>
                    Déplacez la carte ou glissez le marqueur à l'emplacement exact
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.confirmBtnLarge, { backgroundColor: colors.accent }]}
                  onPress={confirmPosition}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle" size={24} color="black" />
                  <Text style={styles.confirmBtnText}>Confirmer la position</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Étape 3: Photo (sauf pour controle) */}
            {reportStep === 'photo' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.photoStep}>
                  <View style={[styles.instructionCard, { backgroundColor: colors.card }]}>
                    <Ionicons name="camera" size={24} color={colors.accent} />
                    <Text style={[styles.instructionText, { color: colors.text }]}>
                      Prenez une photo claire de l'incident
                    </Text>
                  </View>

                  <View style={styles.photoButtons}>
                    <TouchableOpacity
                      style={[styles.photoBtn, { backgroundColor: colors.card, borderColor: colors.accent, borderWidth: 2 }]}
                      onPress={() => handleImagePicker('camera')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera" size={50} color={colors.accent} />
                      <Text style={[styles.photoBtnText, { color: colors.text }]}>
                        Appareil photo
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.photoBtn, { backgroundColor: colors.card, borderColor: colors.accent, borderWidth: 2 }]}
                      onPress={() => handleImagePicker('gallery')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="images" size={50} color={colors.accent} />
                      <Text style={[styles.photoBtnText, { color: colors.text }]}>
                        Galerie
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}

            {/* Étape 4: Confirmation */}
            {reportStep === 'confirm' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.confirmStep}>
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
                        <Ionicons name="information-circle" size={20} color={colors.accent} />
                      </View>
                      <View style={styles.detailContent}>
                        <Text style={[styles.detailLabel, { color: colors.subText }]}>Type</Text>
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
                        <Text style={[styles.detailLabel, { color: colors.subText }]}>Position GPS</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>
                          {markerPosition?.latitude.toFixed(6)}, {markerPosition?.longitude.toFixed(6)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailRow}>
                      <View style={styles.detailIconContainer}>
                        <Ionicons name={photoUri ? "checkmark-circle" : "close-circle"} size={20} color={photoUri ? colors.accent : colors.subText} />
                      </View>
                      <View style={styles.detailContent}>
                        <Text style={[styles.detailLabel, { color: colors.subText }]}>Photo</Text>
                        <Text style={[styles.detailValue, { color: photoUri ? colors.accent : colors.subText }]}>
                          {photoUri ? 'Ajoutée ✓' : selectedIncidentType?.requiresPhoto ? 'Non requise' : 'Aucune'}
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
                    activeOpacity={0.8}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="black" size="small" />
                    ) : (
                      <>
                        <Ionicons name="send" size={20} color="black" />
                        <Text style={styles.submitBtnText}>Envoyer le signalement</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  searchBar: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    height: 50,
    borderRadius: 25,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
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
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainerPosition: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  modalContent: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    minHeight: '60%',
    maxHeight: '90%',
  },
  modalContentPosition: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    maxHeight: '25%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  incidentTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    justifyContent: 'space-between',
  },
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
  incidentIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  incidentLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  positionStepCompact: {
    gap: 15,
  },
  instructionCard: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 15,
    gap: 12,
    alignItems: 'center',
  },
  instructionCardCompact: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 15,
    gap: 12,
    alignItems: 'center',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  instructionTextCompact: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  confirmBtnLarge: {
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
  confirmBtnText: {
    color: 'black',
    fontSize: 17,
    fontWeight: 'bold',
  },
  photoStep: {
    flex: 1,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 20,
  },
  photoBtn: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    elevation: 3,
  },
  photoBtnText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmStep: {
    flex: 1,
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 15,
    marginBottom: 20,
  },
  detailCard: {
    padding: 15,
    borderRadius: 15,
    gap: 15,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 102, 0.1)',
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
  },
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
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: 'black',
    fontSize: 17,
    fontWeight: 'bold',
  },
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
  incidentDetailPhoto: {
    width: '100%',
    height: 220,
    borderRadius: 15,
    marginBottom: 15,
  },
  closeDetailBtn: {
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  closeDetailBtnText: {
    color: 'black',
    fontSize: 17,
    fontWeight: 'bold',
  },
});