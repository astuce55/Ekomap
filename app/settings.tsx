import React from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const { colors, dark, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useLanguage();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t('settings')}</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* CHANGEMENT DE THÈME */}
      <View style={styles.row}>
        <Text style={{ color: colors.text, fontSize: 16 }}>{t('theme')}</Text>
        <Switch value={dark} onValueChange={toggleTheme} />
      </View>

      {/* CHANGEMENT DE LANGUE */}
      <View style={styles.section}>
        <Text style={{ color: colors.subText, marginBottom: 10 }}>{t('language')}</Text>
        <View style={styles.langGrid}>
          {['fr', 'en'].map((l) => (
            <TouchableOpacity 
              key={l}
              style={[styles.langBtn, { borderColor: locale === l ? colors.accent : '#8882', borderWidth: 2 }]}
              onPress={() => setLocale(l)}
            >
              <Text style={{ color: colors.text, fontWeight: locale === l ? 'bold' : 'normal' }}>
                {l === 'fr' ? 'Français' : 'English'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 30 },
  title: { fontSize: 20, fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 0.5, borderBottomColor: '#8882' },
  section: { marginTop: 20 },
  langGrid: { flexDirection: 'row', gap: 10 },
  langBtn: { padding: 10, borderRadius: 10, flex: 1, alignItems: 'center' }
});