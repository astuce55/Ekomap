import React from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const { colors, dark, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useLanguage();
  const { user, isGuest, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* En-tête */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t('settings')}</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Informations utilisateur */}
      {user && (
        <View style={[styles.userCard, { backgroundColor: colors.card }]}>
          <View style={[styles.userAvatar, { backgroundColor: colors.accent }]}>
            <Ionicons name="person" size={30} color="black" />
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.text }]}>{user.name}</Text>
            <Text style={[styles.userEmail, { color: colors.subText }]}>{user.email}</Text>
          </View>
        </View>
      )}

      {isGuest && (
        <View style={[styles.guestCard, { backgroundColor: colors.card }]}>
          <Ionicons name="information-circle" size={24} color={colors.accent} />
          <View style={styles.guestInfo}>
            <Text style={[styles.guestText, { color: colors.text }]}>Mode Invité</Text>
            <Text style={[styles.guestSubtext, { color: colors.subText }]}>
              Connectez-vous pour accéder à toutes les fonctionnalités
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: colors.accent }]}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.loginBtnText}>Connexion</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Section Apparence */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.subText }]}>APPARENCE</Text>

        {/* Thème sombre */}
        <View style={[styles.row, { borderBottomColor: dark ? '#333' : '#EEE' }]}>
          <View style={styles.rowLeft}>
            <Ionicons
              name={dark ? 'moon' : 'sunny'}
              size={24}
              color={colors.text}
              style={styles.rowIcon}
            />
            <Text style={{ color: colors.text, fontSize: 16 }}>{t('theme')}</Text>
          </View>
          <Switch value={dark} onValueChange={toggleTheme} />
        </View>
      </View>

      {/* Section Langue */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.subText }]}>
          {t('language').toUpperCase()}
        </Text>
        <View style={styles.langGrid}>
          {['fr', 'en'].map((l) => (
            <TouchableOpacity
              key={l}
              style={[
                styles.langBtn,
                {
                  borderColor: locale === l ? colors.accent : dark ? '#333' : '#DDD',
                  borderWidth: 2,
                  backgroundColor: locale === l ? `${colors.accent}20` : colors.card
                }
              ]}
              onPress={() => setLocale(l)}
            >
              <Text
                style={{
                  color: locale === l ? colors.accent : colors.text,
                  fontWeight: locale === l ? 'bold' : 'normal',
                }}
              >
                {l === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Section Compte */}
      {(user || isGuest) && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.subText }]}>COMPTE</Text>

          <TouchableOpacity
            style={[styles.row, { borderBottomColor: dark ? '#333' : '#EEE' }]}
            onPress={handleLogout}
          >
            <View style={styles.rowLeft}>
              <Ionicons
                name="log-out-outline"
                size={24}
                color="#FF4444"
                style={styles.rowIcon}
              />
              <Text style={{ color: '#FF4444', fontSize: 16 }}>Déconnexion</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.subText} />
          </TouchableOpacity>
        </View>
      )}

      {/* Version de l'app */}
      <View style={styles.versionContainer}>
        <Text style={[styles.versionText, { color: colors.subText }]}>
          EkoMap v1.0.0
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  userCard: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 15,
    marginBottom: 20,
    alignItems: 'center',
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    marginLeft: 15,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  userEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  guestCard: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 15,
    marginBottom: 20,
    alignItems: 'center',
  },
  guestInfo: {
    marginLeft: 10,
    flex: 1,
  },
  guestText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  guestSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  loginBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  loginBtnText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 14,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 0.5,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIcon: {
    marginRight: 15,
  },
  langGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  langBtn: {
    padding: 12,
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
  },
  versionContainer: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 12,
  },
});