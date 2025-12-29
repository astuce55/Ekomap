import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, Text, TextInput, TouchableOpacity, 
  Modal, Alert, Keyboard, FlatList, ActivityIndicator, Dimensions 
} from 'react-native';
import MapView, { UrlTile, Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { colors, dark, toggleTheme } = useTheme();
  const mapRef = useRef(null);

  // --- ÉTATS ---
  const [userLocation, setUserLocation] = useState(null);
  const [showReportMenu, setShowReportMenu] = useState(false);
  
  // Points A et B
  const [origin, setOrigin] = useState({ name: 'Ma position', coords: null });
  const [destination, setDestination] = useState({ name: '', coords: null });
  const [activeInput, setActiveInput] = useState(null); 

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  const [routes, setRoutes] = useState({ standard: null, eko: null });
  const [selectedRoute, setSelectedRoute] = useState(null); 
  const [isNavigating, setIsNavigating] = useState(false);
  const [reports, setReports] = useState([]);

  // --- 1. INITIALISATION ---
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({});
        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        };
        setUserLocation(coords);
        setOrigin({ name: 'Ma position', coords: { lat: coords.latitude, lng: coords.longitude } });
        mapRef.current?.animateToRegion(coords, 1000);
      }
      const savedHistory = await AsyncStorage.getItem('searchHistory');
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    })();
  }, []);

  // --- 2. RECHERCHE SÉCURISÉE (Correction du bug JSON) ---
  useEffect(() => {
    const search = async () => {
      if (searchQuery.length > 2) {
        setLoading(true);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}+Yaounde&limit=5`,
            { headers: { 'User-Agent': 'EkoMap_Mobile_App' } }
          );
          
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await res.json();
            setSuggestions(data);
          } else {
            console.warn("L'API n'a pas renvoyé de JSON");
          }
        } catch (e) {
          console.error("Erreur de recherche:", e);
        } finally {
          setLoading(false);
        }
      } else {
        setSuggestions([]);
      }
    };
    const delay = setTimeout(search, 800);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  // --- 3. CALCUL ITINÉRAIRES ---
  const getRoutes = async (startCoords, endCoords, destName) => {
    if (!startCoords || !endCoords) return;
    setLoading(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startCoords.lng},${startCoords.lat};${endCoords.lng},${endCoords.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const points = route.geometry.coordinates.map(p => ({ latitude: p[1], longitude: p[0] }));
        setRoutes({
          standard: { coords: points, distance: (route.distance / 1000).toFixed(1), duration: Math.round(route.duration / 60) + 8 },
          eko: { coords: points, distance: (route.distance / 1000).toFixed(1), duration: Math.round(route.duration / 60) }
        });
        setSelectedRoute('eko');
        mapRef.current?.fitToCoordinates(points, { edgePadding: { top: 150, right: 50, bottom: 350, left: 50 } });
      }
      if (destName && destName !== 'Ma position') saveToHistory(destName);
    } catch (e) {
      Alert.alert("Erreur", "Impossible de calculer l'itinéraire.");
    } finally {
      setLoading(false);
    }
  };

  const saveToHistory = async (placeName) => {
    let newHistory = [placeName, ...history.filter(item => item !== placeName)].slice(0, 3);
    setHistory(newHistory);
    await AsyncStorage.setItem('searchHistory', JSON.stringify(newHistory));
  };

  const handleSelectPlace = (item) => {
    const name = item.display_name.split(',')[0];
    const coords = { lat: parseFloat(item.lat), lng: parseFloat(item.lon) };

    if (activeInput === 'origin') {
      setOrigin({ name, coords });
      if (destination.coords) getRoutes(coords, destination.coords, name);
    } else {
      setDestination({ name, coords });
      if (origin.coords) getRoutes(origin.coords, coords, name);
    }

    setSearchQuery('');
    setSuggestions([]);
    setIsSearchFocused(false);
    Keyboard.dismiss();
  };

  return (
    <View style={styles.container}>
      <MapView 
        ref={mapRef} 
        style={styles.map} 
        showsUserLocation
        onPress={() => { setIsSearchFocused(false); Keyboard.dismiss(); }}
      >
        <UrlTile urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
        {routes.standard && <Polyline coordinates={routes.standard.coords} strokeWidth={selectedRoute === 'standard' ? 7 : 3} strokeColor="#BBB" />}
        {routes.eko && <Polyline coordinates={routes.eko.coords} strokeWidth={selectedRoute === 'eko' ? 7 : 3} strokeColor="#00FF66" />}
      </MapView>

      {/* BARRE DE RECHERCHE SIMPLE (QUI OUVRE LE PLANIFICATEUR) */}
      {!isNavigating && !isSearchFocused && !routes.eko && (
        <TouchableOpacity 
          style={[styles.simpleSearchBar, { backgroundColor: colors.card }]}
          onPress={() => setIsSearchFocused(true)}
        >
          <Ionicons name="search" size={20} color={colors.accent} />
          <Text style={[styles.simpleSearchText, { color: colors.subText }]}>Où allez-vous ?</Text>
        </TouchableOpacity>
      )}

      {/* PLANIFICATEUR A -> B (S'affiche si focus ou si route active) */}
      {!isNavigating && (isSearchFocused || routes.eko) && (
        <View style={[styles.plannerWrapper, { backgroundColor: colors.card }]}>
          <View style={styles.plannerHeader}>
             <TouchableOpacity onPress={() => { setIsSearchFocused(false); setRoutes({standard:null, eko:null}); }}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
             </TouchableOpacity>
             <Text style={[styles.plannerTitle, { color: colors.text }]}>Planifier le trajet</Text>
             <TouchableOpacity onPress={toggleTheme}>
                <Ionicons name={dark ? "moon" : "sunny"} size={22} color={colors.accent} />
             </TouchableOpacity>
          </View>

          <View style={styles.inputsBox}>
            <View style={styles.inputRow}>
              <View style={styles.dotOrigin} />
              <TextInput 
                style={[styles.input, { color: colors.text }]}
                placeholder="Lieu de départ"
                value={activeInput === 'origin' ? searchQuery : origin.name}
                onFocus={() => { setActiveInput('origin'); setSearchQuery(''); }}
                onChangeText={setSearchQuery}
              />
            </View>
            <View style={styles.verticalLine} />
            <View style={styles.inputRow}>
              <Ionicons name="location" size={18} color="#FF5252" />
              <TextInput 
                style={[styles.input, { color: colors.text }]}
                placeholder="Lieu d'arrivée"
                value={activeInput === 'destination' ? searchQuery : destination.name}
                onFocus={() => { setActiveInput('destination'); setSearchQuery(''); }}
                onChangeText={setSearchQuery}
              />
              {loading && <ActivityIndicator size="small" color={colors.accent} />}
            </View>
          </View>

          {/* RÉSULTATS */}
          {searchQuery.length > 0 && (
            <FlatList 
              data={suggestions}
              style={styles.resultsList}
              keyExtractor={(item) => item.place_id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.resultItem} onPress={() => handleSelectPlace(item)}>
                  <Ionicons name="map-outline" size={18} color={colors.subText} />
                  <Text style={[styles.resultText, { color: colors.text }]} numberOfLines={1}>
                    {item.display_name.split(',')[0]}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}

      {/* INFOS TRAJET ET DÉMARRER */}
      {routes.eko && !isNavigating && (
        <View style={[styles.infoPanel, { backgroundColor: colors.card }]}>
          <View style={styles.routeChoices}>
            <TouchableOpacity 
              style={[styles.choiceCard, selectedRoute === 'eko' && styles.activeEko]} 
              onPress={() => setSelectedRoute('eko')}
            >
              <Text style={styles.choiceLabel}>EKO IA</Text>
              <Text style={[styles.choiceTime, { color: '#00FF66' }]}>{routes.eko.duration} min</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.choiceCard, selectedRoute === 'standard' && styles.activeStd]} 
              onPress={() => setSelectedRoute('standard')}
            >
              <Text style={styles.choiceLabel}>STANDARD</Text>
              <Text style={[styles.choiceTime, { color: colors.text }]}>{routes.standard.duration} min</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.btnStart, { backgroundColor: colors.accent }]} onPress={() => setIsNavigating(true)}>
            <Text style={styles.btnStartText}>DÉMARRER</Text>
          </TouchableOpacity>
        </View>
      )}

      {isNavigating && (
        <TouchableOpacity style={styles.btnStop} onPress={() => {setIsNavigating(false); setRoutes({standard:null, eko:null}); setIsSearchFocused(false);}}>
          <Ionicons name="close" size={30} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  // Barre simple du début
  simpleSearchBar: { position: 'absolute', top: 60, alignSelf: 'center', width: '90%', height: 55, borderRadius: 30, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, elevation: 10 },
  simpleSearchText: { marginLeft: 10, fontSize: 16 },
  // Planificateur complet
  plannerWrapper: { position: 'absolute', top: 50, alignSelf: 'center', width: '94%', borderRadius: 25, padding: 15, elevation: 20 },
  plannerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  plannerTitle: { fontWeight: 'bold', fontSize: 16 },
  inputsBox: { backgroundColor: '#8881', borderRadius: 15, padding: 5 },
  inputRow: { flexDirection: 'row', alignItems: 'center', height: 45, paddingHorizontal: 12 },
  input: { flex: 1, marginLeft: 10, fontSize: 15 },
  dotOrigin: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00FF66', marginLeft: 5 },
  verticalLine: { width: 1, height: 15, backgroundColor: '#888', marginLeft: 21 },
  // Résultats
  resultsList: { maxHeight: 200, marginTop: 10 },
  resultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#8882' },
  resultText: { marginLeft: 12, fontSize: 15 },
  // Panneau bas
  infoPanel: { position: 'absolute', bottom: 0, width: '100%', padding: 25, borderTopLeftRadius: 35, borderTopRightRadius: 35, elevation: 25 },
  routeChoices: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  choiceCard: { width: '48%', padding: 15, borderRadius: 15, backgroundColor: '#8881', alignItems: 'center' },
  activeEko: { borderColor: '#00FF66', borderWidth: 2 },
  activeStd: { borderColor: '#888', borderWidth: 2 },
  choiceLabel: { fontSize: 10, fontWeight: 'bold', color: '#888' },
  choiceTime: { fontSize: 22, fontWeight: '900' },
  btnStart: { height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  btnStartText: { fontWeight: 'bold', fontSize: 16 },
  btnStop: { position: 'absolute', top: 60, right: 20, backgroundColor: '#FF5252', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 10 }
});