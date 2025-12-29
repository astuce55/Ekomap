import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'; 
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useRouter } from 'expo-router'; // Import important

export default function LoginScreen() {
  const { colors, dark } = useTheme();
  const router = useRouter(); // On initialise le router
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useLanguage();

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <View style={[styles.logoCircle, { backgroundColor: colors.accent }]}>
          <MaterialCommunityIcons name="leaf" size={50} color="black" />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>EkoMap</Text>
        <Text style={[styles.subtitle, { color: colors.subText }]}>L'IA au service de votre trajet</Text>
      </View>

      <View style={styles.form}>
        {/* Email Input */}
        <View style={[styles.inputContainer, { backgroundColor: dark ? '#222' : '#F0F0F0' }]}>
          <Ionicons name="mail-outline" size={20} color={colors.subText} />
          <TextInput 
            style={[styles.input, { color: colors.text }]}
            placeholder="Email"
            placeholderTextColor={colors.subText}
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* Password Input */}
        <View style={[styles.inputContainer, { backgroundColor: dark ? '#222' : '#F0F0F0' }]}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.subText} />
          <TextInput 
            style={[styles.input, { color: colors.text }]}
            placeholder="Mot de passe"
            placeholderTextColor={colors.subText}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.subText} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.loginBtn, { backgroundColor: colors.accent }]}
          onPress={() => router.replace('/(tabs)/home')} // Connexion simulée
        >
          <Text style={styles.loginBtnText}>SE CONNECTER</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.guestBtn}
          onPress={() => router.replace('/(tabs)/home')} // Mode invité
        >
          <Text style={[styles.guestBtnText, { color: colors.accent }]}>Continuer en tant qu'invité</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={{ color: colors.subText }}>Nouveau ici ? </Text>
        <TouchableOpacity onPress={() => router.push('/register')}>
          <Text style={{ color: colors.accent, fontWeight: 'bold' }}>Créer un compte</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, padding: 30, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 50 },
  logoCircle: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 32, fontWeight: '900', letterSpacing: 1 },
  subtitle: { fontSize: 14, marginTop: 5 },
  form: { width: '100%' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 60, borderRadius: 15, marginBottom: 15 },
  input: { flex: 1, marginLeft: 10, fontSize: 16 },
  loginBtn: { height: 60, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 10, elevation: 5 },
  loginBtnText: { color: 'black', fontWeight: 'bold', fontSize: 16 },
  guestBtn: { marginTop: 20, alignSelf: 'center' },
  guestBtnText: { fontWeight: 'bold', textDecorationLine: 'underline' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 40 }
});