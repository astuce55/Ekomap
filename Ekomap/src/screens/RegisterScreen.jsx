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
  const { t } = useLanguage();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={28} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Inscription</Text>
        <Text style={[styles.subtitle, { color: colors.subText }]}>Rejoignez la communauté EkoMap</Text>
      </View>

      <View style={styles.form}>
        <View style={[styles.inputContainer, { backgroundColor: dark ? '#222' : '#F0F0F0' }]}>
          <Ionicons name="person-outline" size={20} color={colors.subText} />
          <TextInput style={[styles.input, { color: colors.text }]} placeholder="Nom complet" placeholderTextColor={colors.subText} value={name} onChangeText={setName} />
        </View>

        <View style={[styles.inputContainer, { backgroundColor: dark ? '#222' : '#F0F0F0' }]}>
          <Ionicons name="mail-outline" size={20} color={colors.subText} />
          <TextInput style={[styles.input, { color: colors.text }]} placeholder="Email" placeholderTextColor={colors.subText} value={email} onChangeText={setEmail} keyboardType="email-address" />
        </View>

        <View style={[styles.inputContainer, { backgroundColor: dark ? '#222' : '#F0F0F0' }]}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.subText} />
          <TextInput style={[styles.input, { color: colors.text }]} placeholder="Mot de passe" placeholderTextColor={colors.subText} secureTextEntry value={password} onChangeText={setPassword} />
        </View>

        <TouchableOpacity style={[styles.regBtn, { backgroundColor: colors.accent }]}>
          <Text style={styles.regBtnText}>CRÉER MON COMPTE</Text>
        </TouchableOpacity>
      </View>
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
  regBtnText: { color: 'black', fontWeight: 'bold', fontSize: 16 }
});