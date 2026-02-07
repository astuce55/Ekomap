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
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { useAuth } from '../src/context/AuthContext';

export default function RegisterScreen() {
  const { colors, dark } = useTheme();
  const { t } = useLanguage();
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    // Validation des champs
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    // Validation du nom
    if (name.length < 3) {
      Alert.alert('Erreur', 'Le nom doit contenir au moins 3 caractères');
      return;
    }

    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Erreur', 'Adresse email invalide');
      return;
    }

    // Validation du mot de passe
    if (password.length < 8) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);

    try {
      await register(name, email, password);
      Alert.alert(
        'Succès',
        'Votre compte a été créé avec succès !',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)/home')
          }
        ]
      );
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de créer le compte. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Barre d'outils supérieure */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} disabled={loading}>
          <Ionicons name="arrow-back" size={28} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/settings')} disabled={loading}>
          <Ionicons name="settings-outline" size={26} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* En-tête */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('register')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.subText }]}>
          Rejoignez la communauté EkoMap
        </Text>
      </View>

      {/* Formulaire */}
      <View style={styles.form}>
        {/* Champ Nom */}
        <View style={[styles.inputGroup, { backgroundColor: dark ? '#222' : '#F0F0F0' }]}>
          <Ionicons name="person-outline" size={20} color={colors.subText} />
          <TextInput
            placeholder={t('fullName')}
            placeholderTextColor={colors.subText}
            style={[styles.input, { color: colors.text }]}
            value={name}
            onChangeText={setName}
            editable={!loading}
          />
        </View>

        {/* Champ Email */}
        <View style={[styles.inputGroup, { backgroundColor: dark ? '#222' : '#F0F0F0' }]}>
          <Ionicons name="mail-outline" size={20} color={colors.subText} />
          <TextInput
            placeholder={t('email')}
            placeholderTextColor={colors.subText}
            style={[styles.input, { color: colors.text }]}
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
            placeholder={t('password')}
            secureTextEntry
            placeholderTextColor={colors.subText}
            style={[styles.input, { color: colors.text }]}
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />
        </View>

        {/* Champ Confirmation mot de passe */}
        <View style={[styles.inputGroup, { backgroundColor: dark ? '#222' : '#F0F0F0' }]}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.subText} />
          <TextInput
            placeholder="Confirmer le mot de passe"
            secureTextEntry
            placeholderTextColor={colors.subText}
            style={[styles.input, { color: colors.text }]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            editable={!loading}
          />
        </View>

        {/* Bouton d'inscription */}
        <TouchableOpacity
          style={[
            styles.btn,
            { backgroundColor: colors.accent },
            loading && styles.btnDisabled
          ]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="black" />
          ) : (
            <Text style={styles.btnText}>{t('createAccount')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Lien vers connexion */}
      <TouchableOpacity
        style={styles.footer}
        onPress={() => router.push('/login')}
        disabled={loading}
      >
        <Text style={{ color: colors.subText }}>
          Déjà un compte ?{' '}
          <Text style={{ color: colors.accent, fontWeight: 'bold' }}>
            Se connecter
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
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 5,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    height: 55,
    borderRadius: 12,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  input: {
    flex: 1,
    fontSize: 16,
    marginLeft: 10,
  },
  btn: {
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    elevation: 3,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#000',
  },
  footer: {
    marginTop: 30,
    alignSelf: 'center',
  },
});