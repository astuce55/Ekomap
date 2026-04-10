import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export default function RegisterScreen({ navigation }) {
  const { colors, dark } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { t, locale, setLocale } = useLanguage();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={28} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('register')}</Text>
        <Text style={[styles.subtitle, { color: colors.subText }]}>{t('createAccount')}</Text>
      </View>

      <View style={styles.form}>
        <View style={[styles.inputContainer, { backgroundColor: dark ? '#222' : '#F0F0F0' }]}>
          <Ionicons name="person-outline" size={20} color={colors.subText} />
          <TextInput style={[styles.input, { color: colors.text }]} placeholder={t('fullName')} placeholderTextColor={colors.subText} value={name} onChangeText={setName} />
        </View>

        <View style={[styles.inputContainer, { backgroundColor: dark ? '#222' : '#F0F0F0' }]}>
          <Ionicons name="mail-outline" size={20} color={colors.subText} />
          <TextInput style={[styles.input, { color: colors.text }]} placeholder={t('email')} placeholderTextColor={colors.subText} value={email} onChangeText={setEmail} keyboardType="email-address" />
        </View>

        <View style={[styles.inputContainer, { backgroundColor: dark ? '#222' : '#F0F0F0' }]}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.subText} />
          <TextInput style={[styles.input, { color: colors.text }]} placeholder={t('password')} placeholderTextColor={colors.subText} secureTextEntry value={password} onChangeText={setPassword} />
        </View>

        <TouchableOpacity style={[styles.regBtn, { backgroundColor: colors.accent }]}>
          <Text style={styles.regBtnText}>{t('createAccount').toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      {/* Bouton de changement de langue */}
      <TouchableOpacity
        style={styles.languageBtn}
        onPress={() => setLocale(locale === 'en' ? 'fr' : 'en')}
      >
        <Text style={styles.languageBtnText}>
          {locale === 'en' ? '🇬🇧 EN' : '🇫🇷 FR'}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 30 },
  backBtn: { marginTop: 20, marginBottom: 30 },
  header: { marginBottom: 40 },
  title: { fontSize: 30, fontWeight: 'bold' },
  subtitle: { fontSize: 16, marginTop: 5 },
  form: { width: '100%' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 60, borderRadius: 15, marginBottom: 15 },
  input: { flex: 1, marginLeft: 10, fontSize: 16 },
  regBtn: { height: 60, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  regBtnText: { color: 'black', fontWeight: 'bold', fontSize: 16 },
  languageBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  languageBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});