import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { useAuth } from '../src/context/AuthContext';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const { colors, dark } = useTheme();
  const { t } = useLanguage();
  const { login, continueAsGuest } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    // Validation simple de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Erreur', 'Adresse email invalide');
      return;
    }

    setLoading(true);

    try {
      await login(email, password);
      router.replace('/(tabs)/home');
    } catch (error) {
      Alert.alert('Erreur', 'Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = async () => {
    Alert.alert(
      'Mode Invité',
      'En mode invité, vous pouvez signaler des incidents mais pas consulter les itinéraires. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          onPress: async () => {
            await continueAsGuest();
            router.replace('/(tabs)/home');
          }
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Bouton paramètres */}
      <TouchableOpacity
        style={styles.settingsIcon}
        onPress={() => router.push('/settings')}
      >
        <Ionicons name="settings-outline" size={26} color={colors.text} />
      </TouchableOpacity>

      {/* En-tête avec logo */}
      <View style={styles.header}>
        <Image 
          source={require('../assets/images/LOGO-2.png')} 
          style={styles.logo}
        />
        <Text style={[styles.title, { color: colors.text }]}>EkoMap</Text>
        <Text style={[styles.subtitle, { color: colors.subText }]}>
          {t('subtitle')}
        </Text>
      </View>

      {/* Formulaire de connexion */}
      <View style={styles.form}>
        {/* Champ Email */}
        <View style={[styles.inputGroup, { backgroundColor: dark ? '#222' : '#F0F0F0' }]}>
          <Ionicons name="mail-outline" size={20} color={colors.subText} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={t('email')}
            placeholderTextColor={colors.subText}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />
        </View>

        {/* Champ Mot de passe */}
        <View style={[styles.inputGroup, { backgroundColor: dark ? '#222' : '#F0F0F0' }]}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.subText} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={t('password')}
            placeholderTextColor={colors.subText}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.subText}
            />
          </TouchableOpacity>
        </View>

        {/* Bouton de connexion */}
        <TouchableOpacity
          style={[
            styles.btnMain,
            { backgroundColor: colors.accent },
            loading && styles.btnDisabled
          ]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="black" />
          ) : (
            <Text style={styles.btnText}>{t('login')}</Text>
          )}
        </TouchableOpacity>

        {/* Bouton mode invité */}
        <TouchableOpacity
          style={styles.btnGuest}
          onPress={handleGuestMode}
          disabled={loading}
        >
          <Text style={{ color: colors.accent, fontWeight: 'bold' }}>
            {t('guest')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lien vers l'inscription */}
      <TouchableOpacity
        style={styles.footer}
        onPress={() => router.push('/register')}
        disabled={loading}
      >
        <Text style={{ color: colors.subText }}>
          {t('noAccount')}{' '}
          <Text style={{ color: colors.accent, fontWeight: 'bold' }}>
            {t('register')}
          </Text>
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 30,
    justifyContent: 'center',
  },
  settingsIcon: {
    position: 'absolute',
    top: 50,
    right: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 5,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    height: 55,
    borderRadius: 12,
    marginBottom: 15,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  btnMain: {
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: 'black',
  },
  btnGuest: {
    marginTop: 20,
    alignSelf: 'center',
  },
  footer: {
    marginTop: 30,
    alignSelf: 'center',
  },
});