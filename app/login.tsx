import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'; 
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const { colors, dark } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: colors.background }]}>
      
      <TouchableOpacity style={styles.settingsIcon} onPress={() => router.push('/settings')}>
        <Ionicons name="settings-outline" size={26} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={[styles.logoCircle, { backgroundColor: colors.accent }]}>
          <MaterialCommunityIcons name="leaf" size={50} color="black" />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>EkoMap</Text>
        <Text style={[styles.subtitle, { color: colors.subText }]}>{t('subtitle')}</Text>
      </View>

      <View style={styles.form}>
        <View style={[styles.inputGroup, { backgroundColor: dark ? '#222' : '#F0F0F0' }]}>
          <Ionicons name="mail-outline" size={20} color={colors.subText} />
          <TextInput style={[styles.input, { color: colors.text }]} placeholder={t('email')} placeholderTextColor={colors.subText} value={email} onChangeText={setEmail} />
        </View>

        <View style={[styles.inputGroup, { backgroundColor: dark ? '#222' : '#F0F0F0' }]}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.subText} />
          <TextInput style={[styles.input, { color: colors.text }]} placeholder={t('password')} placeholderTextColor={colors.subText} secureTextEntry value={password} onChangeText={setPassword} />
        </View>

        <TouchableOpacity style={[styles.btnMain, { backgroundColor: colors.accent }]} onPress={() => router.replace({ pathname: '/(tabs)/home', params: { role: 'user' } })}>
          <Text style={styles.btnText}>{t('login')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnGuest} onPress={() => router.replace({ pathname: '/(tabs)/home', params: { role: 'guest' } })}>
          <Text style={{ color: colors.accent, fontWeight: 'bold' }}>{t('guest')}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.footer} onPress={() => router.push('/register')}>
        <Text style={{ color: colors.subText }}>{t('noAccount')} <Text style={{ color: colors.accent }}>{t('register')}</Text></Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 30, justifyContent: 'center' },
  settingsIcon: { position: 'absolute', top: 50, right: 30 },
  header: { alignItems: 'center', marginBottom: 40 },
  logoCircle: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 30, fontWeight: 'bold' },
  subtitle: { fontSize: 14 },
  form: { width: '100%' },
  inputGroup: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 55, borderRadius: 12, marginBottom: 15 },
  input: { flex: 1, marginLeft: 10 },
  btnMain: { height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  btnText: { fontWeight: 'bold', fontSize: 16 },
  btnGuest: { marginTop: 20, alignSelf: 'center' },
  footer: { marginTop: 30, alignSelf: 'center' }
});