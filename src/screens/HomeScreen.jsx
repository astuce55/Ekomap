import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, Text, TextInput, TouchableOpacity, 
  Modal, Alert, Keyboard, FlatList, ActivityIndicator 
} from 'react-native';
import MapView, { UrlTile, Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function HomeScreen() {
  const { colors, dark, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const { role } = useLocalSearchParams(); 
  const mapRef = useRef(null);

  // --- ÉTATS ---
  const [userLocation, setUserLocation] = useState(null);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [origin, setOrigin] = useState({ name: t('startPos'), coords: null });
  const [destination, setDestination] = useState({ name: '', coords: null });
  const [activeInput, setActiveInput] = useState(null); 
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [routes, setRoutes] = useState({ standard: null, eko: null });
  const [selectedRoute, setSelectedRoute] = useState(null); 
  const [isNavigating, setIsNavigating] = useState(false);
  const [reports, setReports] = useState([]);

  // --- INITIALISATION ---
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({});
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(coords);
        setOrigin({ name: t('startPos'), coords: { lat: coords.latitude, lng: coords.longitude } });
        mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 1000);
      }
    })();
  }, []);

  // --- LOGIQUE DE SIGNALEMENT SÉCURISÉE ---
  const handleOpenReport = () => {
    if (role === 'guest') {
      Alert.alert(
        t('guestAlert'), 
        t('guestAlertMsg'), 
        [
          { 
            text: t('later'), 
            style: 'cancel' 
          },
          { 
            text: t('connect'), 
            onPress: () => {
              // On utilise replace pour quitter la session invité et retourner au login
              // Si ton fichier s'appelle login.tsx, utilise '/login'
              // Si c'est index.tsx, utilise '/'
              router.replace('/login'); 
            } 
          }
        ]
      );
    } else {
      setShowReportMenu(true);
    }
  };

  useEffect(() => {
    const search = async () => {
      if (searchQuery.length > 2) {
        setLoading(true);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}+Yaounde&limit=5`, { headers: { 'User-Agent': 'EkoMap' } });
          const data = await res.json();
          setSuggestions(data);
        } catch (e) { console.error(e); } finally { setLoading(false); }
      }
    };
    const delay = setTimeout(search, 800);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  const getRoutes = async (start, end) => {
    setLoading(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        const points = data.routes[0].geometry.coordinates.map(p => ({ latitude: p[1], longitude: p[0] }));
        const baseDuration = Math.round(data.routes[0].duration / 60);
        
        setRoutes({
          standard: { coords: points, duration: baseDuration + 8, distance: (data.routes[0].distance / 1000).toFixed(1) },
          eko: { coords: points, duration: baseDuration, distance: (data.routes[0].distance / 1000).toFixed(1) }
        });
        setSelectedRoute('eko');
        mapRef.current?.fitToCoordinates(points, { edgePadding: { top: 150, right: 50, bottom: 350, left: 50 } });
      }
    } catch (e) { Alert.alert("Erreur", "Calcul impossible"); } finally { setLoading(false); }
  };

  const handleSelectPlace = (item) => {
    const coords = { lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
    const name = item.display_name.split(',')[0];
    if (activeInput === 'origin') {
      setOrigin({ name, coords });
      if (destination.coords) getRoutes(coords, destination.coords);
    } else {
      setDestination({ name, coords });
      if (origin.coords) getRoutes(origin.coords, coords);
    }
    setIsSearchFocused(false);
    setSearchQuery('');
    Keyboard.dismiss();
  };

  const handleReport = (type) => {
    if (!userLocation) return;
    setReports([...reports, { id: Date.now().toString(), type, latitude: userLocation.latitude, longitude: userLocation.longitude }]);
    setShowReportMenu(false);
  };

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map} showsUserLocation>
        <UrlTile urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
        {routes.standard && (
          <Polyline 
            coordinates={routes.standard.coords} 
            strokeWidth={selectedRoute === 'standard' ? 8 : 4} 
            strokeColor={selectedRoute === 'standard' ? "#888" : "#BBB"} 
          />
        )}
        {routes.eko && (
          <Polyline 
            coordinates={routes.eko.coords} 
            strokeWidth={selectedRoute === 'eko' ? 8 : 4} 
            strokeColor="#00FF66" 
          />
        )}
        {reports.map(r => (
          <Marker key={r.id} coordinate={{ latitude: r.latitude, longitude: r.longitude }}>
            <View style={styles.reportMarker}><MaterialCommunityIcons name={r.type} size={18} color="white" /></View>
          </Marker>
        ))}
      </MapView>

      {/* BARRE DE RECHERCHE AVEC PARAMÈTRES INCRUSTÉS */}
      {!isNavigating && !isSearchFocused && !routes.eko && (
        <View style={[styles.searchBarContainer, { backgroundColor: colors.card }]}>
          <TouchableOpacity 
            style={styles.searchSection} 
            onPress={() => setIsSearchFocused(true)}
          >
            <Ionicons name="search" size={20} color={colors.accent} />
            <Text style={[styles.searchText, { color: colors.subText }]}>
              {t('whereTo')}
            </Text>
          </TouchableOpacity>

          <View style={[styles.verticalDivider, { backgroundColor: colors.subText + '40' }]} />

          <TouchableOpacity 
            style={styles.settingsAction} 
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}

      {/* PLANIFICATEUR TRADUIT */}
      {!isNavigating && (isSearchFocused || routes.eko) && (
        <View style={[styles.planner, { backgroundColor: colors.card }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => { setIsSearchFocused(false); setRoutes({ standard: null, eko: null }); }}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontWeight: 'bold' }}>{t('planning')}</Text>
            <TouchableOpacity onPress={toggleTheme}><Ionicons name={dark ? "moon" : "sunny"} size={22} color={colors.accent} /></TouchableOpacity>
          </View>
          <View style={styles.inputsBox}>
            <TextInput 
              style={[styles.input, { color: colors.text }]} 
              placeholder={t('origin')} 
              placeholderTextColor={colors.subText}
              value={activeInput === 'origin' ? searchQuery : origin.name} 
              onFocus={() => { setActiveInput('origin'); setSearchQuery(''); }} 
              onChangeText={setSearchQuery} 
            />
            <TextInput 
              style={[styles.input, { color: colors.text, marginTop: 10 }]} 
              placeholder={t('destination')} 
              placeholderTextColor={colors.subText}
              value={activeInput === 'destination' ? searchQuery : destination.name} 
              onFocus={() => { setActiveInput('destination'); setSearchQuery(''); }} 
              onChangeText={setSearchQuery} 
            />
          </View>
          {searchQuery.length > 0 && (
            <FlatList data={suggestions} keyExtractor={item => item.place_id.toString()} renderItem={({ item }) => (
              <TouchableOpacity style={styles.res} onPress={() => handleSelectPlace(item)}>
                <Text style={{ color: colors.text }}>{item.display_name.split(',')[0]}</Text>
              </TouchableOpacity>
            )} />
          )}
        </View>
      )}

      {/* PANNEAU DOUBLE ITINÉRAIRE TRADUIT */}
      {routes.eko && !isNavigating && (
        <View style={[styles.info, { backgroundColor: colors.card }]}>
          <View style={styles.routeSelector}>
            <TouchableOpacity 
              style={[styles.routeBtn, selectedRoute === 'eko' && { borderColor: '#00FF66', borderWidth: 2 }]} 
              onPress={() => setSelectedRoute('eko')}
            >
              <Text style={{ color: '#00FF66', fontWeight: 'bold' }}>EKO IA</Text>
              <Text style={{ color: colors.text, fontSize: 18 }}>{routes.eko.duration} min</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.routeBtn, selectedRoute === 'standard' && { borderColor: '#888', borderWidth: 2 }]} 
              onPress={() => setSelectedRoute('standard')}
            >
              <Text style={{ color: '#888', fontWeight: 'bold' }}>STANDARD</Text>
              <Text style={{ color: colors.text, fontSize: 18 }}>{routes.standard.duration} min</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.mainBtn, { backgroundColor: colors.accent }]} onPress={() => setIsNavigating(true)}>
            <Text style={{ fontWeight: 'bold', color: '#000' }}>{t('startNav')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FAB SIGNALEMENT */}
      {!isNavigating && (
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.accent }]} onPress={handleOpenReport}>
          <Ionicons name="megaphone" size={26} color="black" />
        </TouchableOpacity>
      )}

      {/* MODAL SIGNALEMENT TRADUIT */}
      <Modal visible={showReportMenu} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('reportIncident')}</Text>
            <View style={styles.grid}>
              {[ 
                { id: 'car-emergency', label: t('accident'), color: '#FF5252' },
                { id: 'police-badge', label: t('control'), color: '#4285F4' },
                { id: 'alert-decagram', label: t('risk'), color: '#FFB300' },
                { id: 'hammer-wrench', label: t('works'), color: '#455A64' }
              ].map(item => (
                <TouchableOpacity key={item.id} style={[styles.tile, { backgroundColor: dark ? '#333' : '#F5F5F5' }]} onPress={() => handleReport(item.id)}>
                  <MaterialCommunityIcons name={item.id} size={32} color={item.color} />
                  <Text style={{ color: colors.text, marginTop: 8, fontSize: 12 }}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.close} onPress={() => setShowReportMenu(false)}>
              <Text style={{ color: colors.accent, fontWeight: 'bold' }}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  searchBarContainer: { 
    position: 'absolute', 
    top: 60, 
    alignSelf: 'center', 
    width: '90%', 
    height: 55, 
    borderRadius: 30, 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  searchSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  searchText: {
    marginLeft: 12,
    fontSize: 16,
  },
  verticalDivider: {
    width: 1,
    height: '50%',
    marginHorizontal: 12,
  },
  settingsAction: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planner: { position: 'absolute', top: 50, alignSelf: 'center', width: '94%', borderRadius: 20, padding: 15, elevation: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  inputsBox: { backgroundColor: '#8881', borderRadius: 12, padding: 10 },
  input: { height: 40, borderBottomWidth: 1, borderBottomColor: '#8883', fontSize: 16 },
  res: { paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#8882' },
  info: { position: 'absolute', bottom: 0, width: '100%', padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 20 },
  routeSelector: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  routeBtn: { width: '48%', padding: 12, borderRadius: 15, backgroundColor: '#8881', alignItems: 'center' },
  mainBtn: { height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  fab: { position: 'absolute', bottom: 40, right: 20, width: 65, height: 65, borderRadius: 35, justifyContent: 'center', alignItems: 'center', elevation: 10 },
  reportMarker: { backgroundColor: '#FF5252', padding: 5, borderRadius: 20, borderWidth: 2, borderColor: 'white' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { padding: 25, borderTopLeftRadius: 35, borderTopRightRadius: 35 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 25 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { width: '48%', height: 100, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  close: { alignSelf: 'center', marginTop: 10, padding: 10 }
});