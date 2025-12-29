import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';

export default function Register() {
  const { colors, dark } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  // États pour les champs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Barre d'outils supérieure */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color={colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={26} color={colors.text} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('register')}</Text>
        <Text style={[styles.subtitle, { color: colors.subText }]}>{t('welcome')}</Text>
      </View>
      
      <View style={styles.form}>
        {/* Champ Nom */}
        <View style={[styles.inputGroup, { backgroundColor: dark ? '#222' : '#F0F0F0' }]}>
          <Ionicons name="person-outline" size={20} color={colors.subText} style={styles.icon} />
          <TextInput 
            placeholder={t('fullName')} 
            placeholderTextColor={colors.subText} 
            style={[styles.input, { color: colors.text }]} 
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Champ Email */}
        <View style={[styles.inputGroup, { backgroundColor: dark ? '#222' : '#F0F0F0' }]}>
          <Ionicons name="mail-outline" size={20} color={colors.subText} style={styles.icon} />
          <TextInput 
            placeholder={t('email')} 
            placeholderTextColor={colors.subText} 
            style={[styles.input, { color: colors.text }]} 
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Champ Mot de passe */}
        <View style={[styles.inputGroup, { backgroundColor: dark ? '#222' : '#F0F0F0' }]}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.subText} style={styles.icon} />
          <TextInput 
            placeholder={t('password')} 
            secureTextEntry 
            placeholderTextColor={colors.subText} 
            style={[styles.input, { color: colors.text }]} 
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity 
          style={[styles.btn, { backgroundColor: colors.accent }]}
          onPress={() => {
            // Ici tu ajouteras ta logique Firebase/API plus tard
            router.replace({ pathname: '/(tabs)/home', params: { role: 'user' } });
          }}
        >
          <Text style={styles.btnText}>{t('createAccount')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 30 },
  topBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 40, 
    marginBottom: 20 
  },
  header: { marginBottom: 30 },
  title: { fontSize: 32, fontWeight: 'bold' },
  subtitle: { fontSize: 16, marginTop: 5 },
  form: { width: '100%' },
  inputGroup: { 
    height: 55, 
    borderRadius: 12, 
    paddingHorizontal: 15, 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 15 
  },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16 },
  btn: { 
    height: 55, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 20,
    elevation: 3
  },
  btnText: { fontWeight: 'bold', fontSize: 16, color: '#000' }
});