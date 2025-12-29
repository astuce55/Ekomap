import React from 'react';
import { StyleSheet, Text, View, ImageBackground, TextInput, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';

export default function LoginScreen() {
  const { colors, dark, toggleTheme } = useTheme();
  const router = useRouter();

  return (
    <ImageBackground 
      source={{ uri: dark ? 'https://votre-carte-sombre.jpg' : 'https://votre-carte-claire.jpg' }} 
      style={styles.background}
    >
      <View style={[styles.overlay, { backgroundColor: dark ? 'rgba(0, 20, 10, 0.85)' : 'rgba(255, 255, 255, 0.7)' }]}>
        <SafeAreaView style={styles.container}>
          
          {/* Switch de Thème Flottant */}
          <TouchableOpacity onPress={toggleTheme} style={styles.themeToggle}>
             <Ionicons name={dark ? "sunny" : "moon"} size={24} color={colors.accent} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={[styles.logoCircle, { backgroundColor: colors.input }]}>
               <MaterialCommunityIcons name="leaf" size={40} color={colors.accent} />
            </View>
            <Text style={[styles.brandName, { color: colors.text }]}>Eko<Text style={{color: colors.accent}}>Map</Text></Text>
            <Text style={[styles.welcomeText, { color: colors.text }]}>Bienvenue</Text>
          </View>

          {/* Onglets */}
          <View style={[styles.tabContainer, { backgroundColor: colors.input }]}>
            <TouchableOpacity style={[styles.activeTab, { backgroundColor: colors.accent }]}>
              <Text style={styles.activeTabText}>Se Connecter</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.inactiveTab}>
              <Text style={[styles.inactiveTabText, { color: colors.subText }]}>S'inscrire</Text>
            </TouchableOpacity>
          </View>

          {/* Formulaire */}
          <View style={styles.form}>
            <Text style={[styles.inputLabel, { color: colors.subText }]}>EMAIL OU TÉLÉPHONE</Text>
            <View style={[styles.inputContainer, { backgroundColor: colors.input, borderColor: dark ? '#2A3E36' : '#DDD' }]}>
              <Ionicons name="mail-outline" size={20} color={colors.subText} />
              <TextInput placeholder="ex: 699 99 99 99" placeholderTextColor={colors.subText} style={[styles.input, { color: colors.text }]} />
            </View>

            <TouchableOpacity onPress={() => router.push('/home')} style={[styles.mainButton, { backgroundColor: colors.accent }]}>
              <Text style={styles.mainButtonText}>C'est parti  ➔</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 30, alignItems: 'center' },
  themeToggle: { position: 'absolute', top: 50, right: 20, padding: 10 },
  header: { alignItems: 'center', marginTop: 60 },
  logoCircle: { padding: 15, borderRadius: 20, marginBottom: 10 },
  brandName: { fontSize: 32, fontWeight: 'bold' },
  welcomeText: { fontSize: 28, fontWeight: 'bold', marginTop: 10 },
  tabContainer: { flexDirection: 'row', borderRadius: 15, marginTop: 30, padding: 5 },
  activeTab: { paddingVertical: 12, paddingHorizontal: 25, borderRadius: 12 },
  inactiveTab: { paddingVertical: 12, paddingHorizontal: 25 },
  activeTabText: { color: '#000', fontWeight: 'bold' },
  form: { width: '100%', marginTop: 30 },
  inputLabel: { fontSize: 12, marginBottom: 8, fontWeight: 'bold' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 15, marginBottom: 20, borderWidth: 1 },
  input: { flex: 1, paddingVertical: 15, marginLeft: 10 },
  mainButton: { width: '100%', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10 }
});