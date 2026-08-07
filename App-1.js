import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Alert,
  Linking,
  Share,
  LayoutAnimation,
  Platform,
  UIManager,
  BackHandler,
  Animated
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useNavigation } from 'expo-router'; 

// --- IMPORT THE HEADLESS ENGINE & UPLOADER ---
import { scanPole, HAZARD_CASES, tierFor, TIER_LABELS } from './hazardEngine';
import { uploadImageToCloudinary, uploadVideoToCloudinary } from './cloudinaryUpload';

// --- UPGRADED WEB STORAGE MOCK ---
let memoryStore = {};
const SecureStore = {
  getItemAsync: async (key) => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') return localStorage.getItem(key);
    return memoryStore[key] || null;
  },
  setItemAsync: async (key, val) => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.setItem(key, val);
    memoryStore[key] = val;
  },
  deleteItemAsync: async (key) => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.removeItem(key);
    delete memoryStore[key];
  }
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const API_KEY_STORAGE_KEY = 'gemini_api_key';
const FIREBASE_PROJECT_ID = 'pole-hazard-scan'; 
const FIREBASE_WEB_API_KEY = 'AIzaSyDVwsjmYUQRI_38T3KhwyIFFFlL97ewo-o'; 

const translations = {
  en: {
    greeting: "Good Morning",
    greetingAfternoon: "Good Afternoon",
    greetingEvening: "Good Evening",
    citizen: "Citizen",
    stayAware: "Stay aware. Report hazards quickly and keep your community safe.",
    uploadCardTitle: "HAZARD REPORTING",
    uploadCardSubtitle: "Capture. Analyze. Report.",
    takePhoto: "Take Photo",
    gallery: "Gallery",
    scanComplete: "Scan Complete",
    scanPhoto: "SCAN PHOTO",
    analyzing: "Analyzing Image...",
    inspectionComplete: "Inspection Complete",
    inspectionSummary: "Inspection Summary",
    locationInfo: "Location Information",
    address: "Address",
    coordinates: "Coordinates",
    captureDate: "Capture Date & Time",
    openMaps: "Open in Google Maps",
    obsNotes: "Observation Notes",
    obsPlaceholder: "Add observation details here...",
    shareReport: "Share Report",
    reportAuth: "Report to Authority",
    newScan: "New Scan",
    uploadVideo: "Upload Video Evidence",
    videoEvidenceDesc: "Severe hazard detected. Please capture a short video of the surrounding area for safety validation.",
    reportSent: "Report Sent to Authority",
    accountabilityTitle: "Accountability Warning",
    accountabilityMsg: "Please ensure you are uploading a genuine, real-time photo. Submitting downloaded or fabricated images is strictly prohibited.",
    cancel: "Cancel",
    agree: "I Agree",
    videoAttached: "Video evidence attached to this docket.",
    success: "Success",
    profile: "Profile",
    editProfile: "Edit Profile",
    apiSettings: "API Settings",
    logout: "Logout",
    photoPermErr: "Photo library permission is needed.",
    camPermErr: "Camera permission is needed.",
    authErr: "Something went wrong. Try again.",
    apiKeyPrompt: "This app calls Google Gemini vision API directly, so it needs your own key. Get a free one at aistudio.google.com/apikey.",
    saveKey: "Save key",
    myDockets: "My Dockets",
    history: "History",
    explore: "Explore",
    remarks: "Remarks",
    doneBy: "Done By",
    office: "Office",
    name: "Name",
    designation: "Designation",
    mobile: "Mobile",
    noReports: "No reports found.",
    loadingReports: "Loading reports...",
    docketId: "Docket ID",
    status: "Status",
    viewDetails: "View Details",
    back: "Back",
    home: "Home",
    recentAlerts: "RECENT ALERTS"
  }
};

const i18n = new I18n(translations);
i18n.enableFallback = true;
const COLORS = {
  bg: '#090D16',            // Richer deep midnight background
  surface: '#121824',       // Elevated slate card background
  surfaceLight: '#1E293B',  // High-contrast secondary surface
  border: 'rgba(255, 255, 255, 0.08)', // Ultra-clean subtle glass border
  borderActive: 'rgba(245, 158, 11, 0.3)', // Accent border glow
  text: '#F8FAFC',          // Crisp high-contrast text
  muted: '#94A3B8',         // Subtle secondary text
  accent: '#F59E0B',        // Electric amber/gold accent
  accentGlow: 'rgba(245, 158, 11, 0.15)',
  clear: '#10B981',         // Emerald green for success/resolved
  flag: '#EF4444',          // Vibrant alert red
  indigo: '#6366F1',        // Indigo action highlight
  purple: '#8B5CF6'         // Deep violet gallery highlight
};
const TIER_COLORS = { urgent: COLORS.flag, attention: COLORS.accent, clear: COLORS.clear };

const HistoryCard = ({ item, onPress }) => {
  const latestStep = item.history && item.history.length > 0 
    ? item.history[item.history.length - 1] 
    : { stateName: item.status };
    
  const stepName = latestStep.stateName;
  const isResolved = item.status === 'Resolved' || stepName === 'Resolved' || stepName === 'Complaint Resolved';
  const pillColor = isResolved ? COLORS.clear : COLORS.accent;
  const pillBg = isResolved ? 'rgba(52, 211, 153, 0.15)' : 'rgba(242, 183, 5, 0.15)';

  const formattedDate = new Date(item.timestamp).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric'
  });

  return (
    <TouchableOpacity style={styles.historyCard} onPress={() => onPress(item)} activeOpacity={0.7}>
      <View style={styles.historyCardContent}>
        <View style={styles.thumbnailContainer}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%', borderRadius: 10 }} />
          ) : (
            <Ionicons name="image-outline" size={24} color={COLORS.muted} />
          )}
        </View>
        <View style={styles.historyCardTextSection}>
          <Text style={styles.historyDocketId}>Docket: #{item.docketId}</Text>
          <Text style={styles.historyCardLocation} numberOfLines={1}>
            {item.city || item.region || 'Location Unavailable'}
          </Text>
          <Text style={styles.historyCardDate}>{formattedDate}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: pillBg, borderColor: pillColor }]}>
          <Text style={[styles.statusPillText, { color: pillColor }]}>{stepName}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function App() {
  const router = useRouter(); 
  const navigation = useNavigation();

  // --- 1. INTRO ANIMATION LOGIC ---
  const [showIntro, setShowIntro] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current; 
  const slideAnim = useRef(new Animated.Value(20)).current; 

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 1200, useNativeDriver: true })
      ]),
      Animated.delay(1200),
      Animated.timing(fadeAnim, { toValue: 0, duration: 600, useNativeDriver: true })
    ]).start(() => {
      setShowIntro(false); 
    });
  }, []);

  useEffect(() => {
    navigation.setOptions({ headerShown: false, tabBarStyle: { display: 'none' } });
  }, [navigation]);

  const locales = Localization.getLocales();
  const defaultLang = locales && locales.length > 0 ? locales[0].languageCode : 'en';
  const [appLanguage, setAppLanguage] = useState(defaultLang);
  i18n.locale = appLanguage;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return i18n.t('greeting');
    if (hour < 18) return i18n.t('greetingAfternoon');
    return i18n.t('greetingEvening');
  };

  const [authChecking, setAuthChecking] = useState(true);
  const [idToken, setIdToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null);
  const [uid, setUid] = useState(null);

  const [authMode, setAuthMode] = useState('signup');
  const [profilePhotoUri, setProfilePhotoUri] = useState(null);
  const [profilePhotoBase64, setProfilePhotoBase64] = useState(null);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [address, setAddress] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState(null);

  const [apiKey, setApiKey] = useState(null);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [checkingKey, setCheckingKey] = useState(true);

  const [imageUri, setImageUri] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [imageMime, setImageMime] = useState('image/jpeg');
  const [videoUri, setVideoUri] = useState(null);
  
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [geocodedAddress, setGeocodedAddress] = useState(null);
  const [captureTime, setCaptureTime] = useState(null);
  const [observationNotes, setObservationNotes] = useState('');

  const [reporting, setReporting] = useState(false);
  const [reportStatusText, setReportStatusText] = useState('');
  const [reported, setReported] = useState(false);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [scanProgressText, setScanProgressText] = useState(i18n.t('analyzing'));

  const [activeTab, setActiveTab] = useState('home');
  const [docketTab, setDocketTab] = useState('active'); // active vs history filter
  
  // --- 2. ACTIVE VS HISTORY STATES ---
  const [activeReports, setActiveReports] = useState([]);
  const [historyReports, setHistoryReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [expandedStep, setExpandedStep] = useState(null);

  useEffect(() => {
    const onBackPress = () => {
      if (selectedReport) {
        setSelectedReport(null); 
        return true; 
      }
      if (imageUri && activeTab === 'home') {
        resetAll(); 
        return true; 
      }
      return false; 
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [selectedReport, imageUri, activeTab]);

  const resetAll = () => {
    setImageUri(null);
    setImageBase64(null);
    setResult(null);
    setError(null);
    setReported(false);
    setVideoUri(null);
    setObservationNotes('');
    setExpandedStep(null);
  };

  const fetchUserProfile = async (localId, token) => {
    try {
      const res = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${localId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const doc = await res.json();
        if (doc.fields) {
          if (doc.fields.fullName) setFullName(doc.fields.fullName.stringValue || '');
          if (doc.fields.phoneNumber) setPhoneNumber(doc.fields.phoneNumber.stringValue || '');
          if (doc.fields.address) setAddress(doc.fields.address.stringValue || '');
          if (doc.fields.photoBase64) setProfilePhotoUri(`data:image/jpeg;base64,${doc.fields.photoBase64.stringValue}`);
        }
      }
    } catch (err) {
      console.log('Failed to fetch profile', err);
    }
  };

  const fetchUserReports = async () => {
    if (!uid) return;
    setLoadingReports(true);
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${FIREBASE_WEB_API_KEY}`;
      const payload = {
        structuredQuery: {
          from: [{ collectionId: 'reports' }],
          where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const reportsList = data.filter(item => item.document).map(item => {
            const doc = item.document;
            const docId = doc.name.split('/').pop();
            const fields = doc.fields || {};

            let parsedHistory = [];
            if (fields.history?.arrayValue?.values) {
              parsedHistory = fields.history.arrayValue.values.map(val => {
                const mapFields = val.mapValue?.fields || {};
                return {
                  stateName: mapFields.stateName?.stringValue || 'Complaint Registered',
                  remarks: mapFields.remarks?.stringValue || null,
                  createdAt: mapFields.createdAt?.stringValue || '',
                  createdBy: mapFields.createdBy?.stringValue || '',
                  forwardToName: mapFields.forwardToName?.stringValue || null,
                  forwardToDesig: mapFields.forwardToDesig?.stringValue || null,
                  forwardToMobileNo: mapFields.forwardToMobileNo?.stringValue || null,
                  forwardToOffice: mapFields.forwardToOffice?.stringValue || null,
                };
              });
            }

            if (parsedHistory.length === 0) {
              parsedHistory.push({
                stateName: fields.status?.stringValue || 'Complaint Registered',
                remarks: fields.remarks?.stringValue || null,
                createdAt: fields.timestamp?.stringValue || new Date().toISOString(),
                createdBy: 'System',
              });
            }

            let parsedCases = [];
            HAZARD_CASES.forEach(c => {
              if (fields[`${c.key}_percent`]) {
                parsedCases.push({
                  key: c.key,
                  label: c.label,
                  icon: c.icon,
                  percent: Number(fields[`${c.key}_percent`].integerValue || 0),
                  note: fields[`${c.key}_note`]?.stringValue || '',
                });
              }
            });

            return {
              id: docId,
              docketId: fields.docketId?.stringValue || 'N/A',
              status: fields.status?.stringValue || 'Submitted',
              timestamp: fields.timestamp?.stringValue || '',
              captureTime: fields.captureTime?.stringValue || '',
              observationNotes: fields.observationNotes?.stringValue || '',
              imageUrl: fields.imageUrl?.stringValue || null,
              videoUrl: fields.videoUrl?.stringValue || null,
              latitude: fields.latitude?.doubleValue || null,
              longitude: fields.longitude?.doubleValue || null,
              city: fields.city?.stringValue || '',
              region: fields.region?.stringValue || '',
              history: parsedHistory,
              cases: parsedCases,
            };
          });

        reportsList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // --- Split Logic based on Status ---
        const active = [];
        const resolved = [];
        
        reportsList.forEach(report => {
          if (report.status === 'Resolved' || report.status === 'Complaint Resolved') {
            resolved.push(report);
          } else {
            active.push(report);
          }
        });
        
        setActiveReports(active);
        setHistoryReports(resolved);
      }
    } catch (err) {
      console.log('Failed to fetch reports', err);
    } finally {
      setLoadingReports(false);
    }
  };

  // --- RESOLVE ISSUE FUNCTION ---
  const markAsResolved = async (documentId) => {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/reports/${documentId}?updateMask.fieldPaths=status&key=${FIREBASE_WEB_API_KEY}`;
      
      const payload = {
        fields: {
          status: { stringValue: 'Resolved' }
        }
      };

      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        if (Platform.OS !== 'web') Alert.alert("Success", "Issue resolved and moved to history!");
        fetchUserReports(); // Re-fetch to update the split lists
      }
    } catch (err) {
      console.error("Failed to resolve:", err);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const keysData = await Promise.all([
          SecureStore.getItemAsync('idToken'),
          SecureStore.getItemAsync('refreshToken'),
          SecureStore.getItemAsync('tokenExpiresAt'),
          SecureStore.getItemAsync('uid')
        ]);
        const [sIdToken, sRefreshToken, sExpiresAt, sUid] = keysData;
        if (sIdToken && sRefreshToken) {
          setIdToken(sIdToken);
          setRefreshToken(sRefreshToken);
          setTokenExpiresAt(sExpiresAt ? Number(sExpiresAt) : 0);
          setUid(sUid);
          await fetchUserProfile(sUid, sIdToken); 
        }
      } finally {
        setAuthChecking(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
        if (stored) setApiKey(stored);
        else setShowApiKeyInput(true);
      } finally {
        setCheckingKey(false);
      }
    })();
  }, []);

  useEffect(() => {
    let timeouts = [];
    if (analyzing) {
      setScanProgressText(i18n.t('analyzing'));
      timeouts.push(setTimeout(() => setScanProgressText('Detecting Hazards...'), 1500));
      timeouts.push(setTimeout(() => setScanProgressText('Generating Report...'), 3500));
      timeouts.push(setTimeout(() => setScanProgressText('Preparing Results...'), 5500));
    }
    return () => timeouts.forEach(clearTimeout);
  }, [analyzing]);

  const pickProfilePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return setAuthError(i18n.t('photoPermErr'));
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true });
    if (!res.canceled && res.assets && res.assets.length > 0) {
      setProfilePhotoUri(res.assets[0].uri);
      setProfilePhotoBase64(res.assets[0].base64);
    }
  };

  const validateSignup = () => {
    if (!fullName.trim()) return 'Please enter your full name.';
    if (!phoneNumber.trim() || phoneNumber.trim().length < 7) return 'Please enter a valid phone number.';
    if (!authEmail.trim() || !authEmail.includes('@')) return 'Please enter a valid email.';
    if (authPassword.length < 6) return 'Password must be at least 6 characters.';
    if (authPassword !== confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const submitAuth = async () => {
    setAuthError(null);
    if (authMode === 'signup') {
      const validationError = validateSignup();
      if (validationError) return setAuthError(validationError);
    } else if (!authEmail.trim() || !authPassword) {
      return setAuthError('Enter your email and password.');
    }
    setAuthSubmitting(true);
    try {
      const endpoint = authMode === 'signup' ? 'accounts:signUp' : 'accounts:signInWithPassword';
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${FIREBASE_WEB_API_KEY}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: authEmail.trim(), password: authPassword, returnSecureToken: true }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || i18n.t('authErr'));
      
      const expiresAt = Date.now() + Number(data.expiresIn) * 1000;
      await Promise.all([
        SecureStore.setItemAsync('idToken', data.idToken),
        SecureStore.setItemAsync('refreshToken', data.refreshToken),
        SecureStore.setItemAsync('tokenExpiresAt', String(expiresAt)),
        SecureStore.setItemAsync('uid', data.localId)
      ]);
      setIdToken(data.idToken); setRefreshToken(data.refreshToken); setTokenExpiresAt(expiresAt); setUid(data.localId);

      if (authMode === 'signup') {
        const profileFields = {
          role: { stringValue: 'field' },
          fullName: { stringValue: fullName.trim() },
          phoneNumber: { stringValue: phoneNumber.trim() },
          email: { stringValue: authEmail.trim() },
          address: { stringValue: address.trim() },
        };
        if (profilePhotoBase64) profileFields.photoBase64 = { stringValue: profilePhotoBase64 };
        await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${data.localId}?key=${FIREBASE_WEB_API_KEY}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ fields: profileFields }),
        });
      } else {
        await fetchUserProfile(data.localId, data.idToken);
      }
    } catch (err) {
      setAuthError(i18n.t('authErr'));
    } finally {
      setAuthSubmitting(false);
    }
  };

  const logOut = async () => {
    setShowProfileMenu(false);
    await Promise.all([SecureStore.deleteItemAsync('idToken'), SecureStore.deleteItemAsync('refreshToken'), SecureStore.deleteItemAsync('tokenExpiresAt'), SecureStore.deleteItemAsync('uid')]);
    setIdToken(null); setRefreshToken(null); setTokenExpiresAt(null); setUid(null); setAuthMode('signin'); 
    setActiveReports([]); setHistoryReports([]); setSelectedReport(null); setExpandedStep(null);
  };

  const saveApiKey = async () => {
    const trimmed = apiKeyDraft.trim();
    if (trimmed.length < 20) return Alert.alert('That looks too short', 'Gemini API keys are usually 30+ characters.');
    await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, trimmed);
    setApiKey(trimmed); setApiKeyDraft(''); setShowApiKeyInput(false);
  };

  const reverseGeocode = async (coords) => {
    try {
      const results = await Location.reverseGeocodeAsync(coords);
      if (results && results.length > 0) {
        const firstAddress = results[0];
        setGeocodedAddress({
          city: firstAddress.city || firstAddress.subregion || null,
          region: firstAddress.region || null,
          country: firstAddress.country || null,
          postalCode: firstAddress.postalCode || null,
          street: firstAddress.street || null,
          district: firstAddress.district || null,
        });
      }
    } catch (err) { }
  };

  const getLocation = async () => {
    setLocating(true); setLocationError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return setLocationError('Location permission denied');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setLocation(coords); reverseGeocode(coords);
    } catch (err) {
      setLocationError('Could not get location');
    } finally {
      setLocating(false);
    }
  };

  const openInMaps = () => {
    if (!location) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`);
  };

  const handleImageAsset = (asset) => {
    setResult(null); setError(null); setReported(false); setVideoUri(null); setObservationNotes('');
    setImageUri(asset.uri); setImageBase64(asset.base64); setImageMime(asset.mimeType?.startsWith('image/') ? asset.mimeType : 'image/jpeg');
    setCaptureTime(new Date()); setLocation(null); setLocationError(null); setGeocodedAddress(null); getLocation(); 
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') return setError(i18n.t('camPermErr'));
    const res = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true, allowsEditing: false });
    if (!res.canceled && res.assets && res.assets.length > 0) handleImageAsset(res.assets[0]);
  };

  const executePickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return setError(i18n.t('photoPermErr'));
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, base64: true, allowsEditing: false });
    if (!res.canceled && res.assets && res.assets.length > 0) handleImageAsset(res.assets[0]);
  };

 const pickFromGalleryWithWarning = () => {
  const warningTitle = "⚠️ Important Warning";
  const warningMessage = "This platform is intended for reporting genuine infrastructure and public safety concerns.\n\nUploading false, misleading, manipulated, or unrelated images may result in incorrect hazard assessments and unnecessary resource deployment.\n\nBy proceeding, you acknowledge that you are accountable for the content you submit and confirm that the image accurately represents the reported location or condition.";

  if (Platform.OS === 'web') {
    // Forces a native browser popup for web users
    const proceed = window.confirm(`${warningTitle}\n\n${warningMessage}`);
    if (proceed) {
      executePickFromGallery();
    }
  } else {
    // Uses standard React Native alert for iOS/Android
    Alert.alert(
      warningTitle, 
      warningMessage, 
      [
        { text: "Cancel", style: 'cancel' }, 
        { text: "Proceed", onPress: executePickFromGallery }
      ]
    );
  }
};

  const pickVideoFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return setError(i18n.t('photoPermErr'));
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.5,
      allowsEditing: true, 
      videoMaxDuration: 15 
    });
    if (!res.canceled && res.assets && res.assets.length > 0) {
      setVideoUri(res.assets[0].uri);
      if (Platform.OS !== 'web') Alert.alert(i18n.t('success'), i18n.t('videoAttached'));
    }
  };

  const handleAnalyze = async () => {
    if (!imageBase64) return;
    if (!apiKey) return setShowApiKeyInput(true);
    setAnalyzing(true); setError(null); setResult(null); setReported(false);
    
    try {
      const hazardResults = await scanPole({ apiKey, imageBase64, imageMime });
      setResult({ cases: hazardResults });
    } catch (err) {
      setError(err.message || "Couldn't read a result from that photo. Try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const reportToAuthority = async () => {
    if (!result) return;
    setReporting(true);
    setReportStatusText('UPLOADING MEDIA...'); 
    
    const genDocketId = String(Math.floor(1000000000 + Math.random() * 9000000000)); 
    const NULL_VAL = { nullValue: 'NULL_VALUE' }; 
    
    try {
      let uploadedImageUrl = null;
      let uploadedVideoUrl = null;

      if (imageBase64) {
        uploadedImageUrl = await uploadImageToCloudinary(imageBase64, imageMime);
      }

      if (videoUri) {
        uploadedVideoUrl = await uploadVideoToCloudinary(videoUri);
      }

      setReportStatusText('SAVING DOCKET...');

      const firstHistoryNode = {
        mapValue: {
          fields: {
            stateName: { stringValue: 'Complaint Registered' },
            remarks: NULL_VAL,
            createdAt: { stringValue: new Date().toISOString() },
            createdBy: { stringValue: fullName.trim() || 'Citizen' },
            modifiedAt: { stringValue: new Date().toISOString() },
            modifiedBy: { stringValue: fullName.trim() || 'Citizen' },
            forwardToName: NULL_VAL,
            forwardToDesig: NULL_VAL,
            forwardToMobileNo: NULL_VAL,
            forwardToOffice: NULL_VAL
          }
        }
      };

      const fields = {
        userId: { stringValue: uid || 'anonymous' },
        docketId: { stringValue: genDocketId },
        observationNotes: { stringValue: (observationNotes || '').trim() },
        status: { stringValue: 'Submitted' },
        imageUrl: uploadedImageUrl ? { stringValue: uploadedImageUrl } : NULL_VAL,
        videoUrl: uploadedVideoUrl ? { stringValue: uploadedVideoUrl } : NULL_VAL,
        videoAttached: { booleanValue: !!uploadedVideoUrl },
        timestamp: { stringValue: new Date().toISOString() },
        captureTime: { stringValue: (captureTime || new Date()).toISOString() },
        resolved: { booleanValue: false },
        latitude: location && typeof location.latitude === 'number' ? { doubleValue: location.latitude } : NULL_VAL,
        longitude: location && typeof location.longitude === 'number' ? { doubleValue: location.longitude } : NULL_VAL,
        city: { stringValue: (geocodedAddress && geocodedAddress.city) || '' },
        region: { stringValue: (geocodedAddress && geocodedAddress.region) || '' },
        country: { stringValue: (geocodedAddress && geocodedAddress.country) || '' },
        postalCode: { stringValue: (geocodedAddress && geocodedAddress.postalCode) || '' },
        history: { arrayValue: { values: [firstHistoryNode] } }
      };
      
      result.cases.forEach((c) => {
        const safePercent = Number(c.percent) || 0;
        Reflect.set(fields, c.key + '_percent', { integerValue: String(safePercent) });
        Reflect.set(fields, c.key + '_note', { stringValue: String(c.note || '') });
      });
      
      const endpointUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/reports`;
      
      
      const res = await fetch(endpointUrl + '?key=' + FIREBASE_WEB_API_KEY, {
        method: 'POST',
        headers: { 
          'content-type': 'application/json'
        },
        body: JSON.stringify({ fields }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        console.error("Firestore Error Details:", JSON.stringify(errJson, null, 2));
        throw new Error(errJson.error?.message || 'request failed');
      }

      setReported(true);
    } catch (err) {
      console.error("Report Submission Failed:", err);
      if (Platform.OS !== 'web') Alert.alert('Upload Failed', err.message || 'Check your internet connection and try again.');
    } finally {
      setReporting(false);
      setReportStatusText('');
    }
  };

  const handleShareReport = async () => {
    try {
      const formattedAddress = geocodedAddress ? [geocodedAddress.street, geocodedAddress.city, geocodedAddress.postalCode].filter(Boolean).join(', ') : 'N/A';
      const shareMessage = `
--- POLE INSPECTION REPORT ---
DATE & TIME: ${captureTime ? captureTime.toLocaleString() : new Date().toLocaleString()}
LOCATION: Lat ${location?.latitude || 'N/A'}, Lng ${location?.longitude || 'N/A'}
OBSERVATION: ${observationNotes || 'None'}
      `.trim();

      await Share.share({ message: shareMessage, title: 'Utility Pole Inspection Report' });
    } catch (error) {
      if (Platform.OS !== 'web') Alert.alert('Error', 'Could not share the report.');
    }
  };

  const handleNewScan = () => {
    if (Platform.OS === 'web') {
      resetAll();
    } else {
      Alert.alert(i18n.t('newScan'), "This will clear the current scan results.", [{ text: i18n.t('cancel'), style: 'cancel' }, { text: i18n.t('agree'), onPress: resetAll }]);
    }
  };

  const renderTimelineStep = (step, index, totalSteps) => {
    const isLatest = index === totalSteps - 1; 
    const isPast = index < totalSteps - 1;     
    const isExpanded = expandedStep === index;

    const toggleStep = () => {
      if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpandedStep(isExpanded ? null : index);
    };

    const formattedDate = new Date(step.createdAt).toLocaleString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });

    return (
      <View key={index} style={styles.timelineStepContainer}>
        <View style={styles.timelineLeftColumn}>
          <View style={[styles.timelineNode, isLatest ? styles.timelineNodeActive : (isPast ? styles.timelineNodePast : styles.timelineNodeFuture)]}>
            {isPast && <Ionicons name="checkmark" size={14} color={COLORS.clear} />}
            {isLatest && <View style={styles.timelineNodePulse} />}
          </View>
          {index < totalSteps - 1 && (
            <View style={[styles.timelineLine, isPast && styles.timelineLineActive]} />
          )}
        </View>

        <TouchableOpacity style={[styles.timelineRightColumn, isLatest && styles.timelineRightColumnActive]} activeOpacity={0.8} onPress={toggleStep}>
          <View style={styles.timelineHeaderRow}>
            <View style={styles.flex1}>
              <Text style={[styles.timelineStateText, isLatest && { color: COLORS.accent }]}>{step.stateName}</Text>
              <Text style={styles.timelineDateText}>{formattedDate}</Text>
            </View>
            {(step.remarks || step.forwardToName || step.createdBy) && (
              <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={isLatest ? COLORS.accent : COLORS.muted} />
            )}
          </View>

          {isExpanded && (step.remarks || step.forwardToName || step.createdBy) && (
            <View style={styles.timelineDetailsCard}>
              {step.remarks && (
                <View style={styles.timelineDetailItem}>
                  <Text style={styles.timelineDetailLabel}>{i18n.t('remarks')}</Text>
                  <Text style={styles.timelineDetailValue}>"{step.remarks}"</Text>
                </View>
              )}
              {step.createdBy && (
                <View style={styles.timelineDetailItem}>
                  <Text style={styles.timelineDetailLabel}>{i18n.t('doneBy')}</Text>
                  <Text style={styles.timelineDetailValue}>{step.createdBy}</Text>
                </View>
              )}
              {step.forwardToName && (
                <View style={styles.forwardToInfoBox}>
                  <Text style={styles.timelineDetailLabel}>Forwarded To Details</Text>
                  <View style={styles.forwardToRow}>
                    <Text style={styles.forwardToLabel}>{i18n.t('office')}</Text>
                    <Text style={styles.forwardToValue}>{step.forwardToOffice || 'N/A'}</Text>
                  </View>
                  <View style={styles.forwardToRow}>
                    <Text style={styles.forwardToLabel}>{i18n.t('name')}</Text>
                    <Text style={styles.forwardToValue}>{step.forwardToName || 'N/A'} ({step.forwardToDesig})</Text>
                  </View>
                  {step.forwardToMobileNo && (
                    <View style={styles.forwardToRow}>
                      <Text style={styles.forwardToLabel}>{i18n.t('mobile')}</Text>
                      <TouchableOpacity style={styles.callButton} onPress={() => Linking.openURL(`tel:${step.forwardToMobileNo}`)}>
                        <Ionicons name="call" size={12} color={COLORS.bg} style={{ marginRight: 4 }} />
                        <Text style={styles.callButtonText}>{step.forwardToMobileNo}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // --- RENDERING INTRO ANIMATION FIRST ---
  if (showIntro) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
          <Animated.View style={{ 
            opacity: fadeAnim, 
            transform: [{ translateY: slideAnim }],
            alignItems: 'center'
          }}>
            <Text style={{ fontSize: 26, fontWeight: '300', letterSpacing: 8, color: '#ffffff' }}>HAZARD LENS</Text>
    
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  if (authChecking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerFill}><ActivityIndicator color={COLORS.accent} /></View>
      </SafeAreaView>
    );
  }

  if (!idToken) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>Field Inspection Tool</Text>
          <Text style={styles.title}>{authMode === 'signup' ? 'Create Account' : 'Welcome Back'}</Text>
          <Text style={styles.subtitle}>
            {authMode === 'signup' ? 'Set up your profile to start reporting hazards.' : 'Sign in to continue scanning.'}
          </Text>

          {authMode === 'signup' && (
            <TouchableOpacity style={styles.photoPicker} onPress={pickProfilePhoto}>
              {profilePhotoUri ? (
                <Image source={{ uri: profilePhotoUri }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoPlaceholder}><Ionicons name="camera" size={26} color={COLORS.muted} /></View>
              )}
              <Text style={styles.photoPickerText}>{profilePhotoUri ? 'Change photo' : 'Add profile photo'}</Text>
            </TouchableOpacity>
          )}

          {authMode === 'signup' && (
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={18} color={COLORS.muted} style={styles.inputIcon} />
              <TextInput style={styles.inputFlex} value={fullName} onChangeText={setFullName} placeholder="Full name" placeholderTextColor={COLORS.muted} />
            </View>
          )}

          {authMode === 'signup' && (
            <View style={styles.inputRow}>
              <Ionicons name="call-outline" size={18} color={COLORS.muted} style={styles.inputIcon} />
              <TextInput style={styles.inputFlex} value={phoneNumber} onChangeText={setPhoneNumber} placeholder="Phone number" placeholderTextColor={COLORS.muted} keyboardType="phone-pad" />
            </View>
          )}

          <View style={styles.inputRow}>
            <Ionicons name="mail-outline" size={18} color={COLORS.muted} style={styles.inputIcon} />
            <TextInput style={styles.inputFlex} value={authEmail} onChangeText={setAuthEmail} placeholder="Email" placeholderTextColor={COLORS.muted} autoCapitalize="none" keyboardType="email-address" />
          </View>

          {authMode === 'signup' && (
            <View style={styles.inputRow}>
              <Ionicons name="location-outline" size={18} color={COLORS.muted} style={styles.inputIcon} />
              <TextInput style={styles.inputFlex} value={address} onChangeText={setAddress} placeholder="Address (optional)" placeholderTextColor={COLORS.muted} />
            </View>
          )}

          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={18} color={COLORS.muted} style={styles.inputIcon} />
            <TextInput style={styles.inputFlex} value={authPassword} onChangeText={setAuthPassword} placeholder="Password" placeholderTextColor={COLORS.muted} secureTextEntry />
          </View>

          {authMode === 'signup' && (
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.muted} style={styles.inputIcon} />
              <TextInput style={styles.inputFlex} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" placeholderTextColor={COLORS.muted} secureTextEntry />
            </View>
          )}

          {authError && (
            <View style={styles.errorBox}><Text style={styles.errorText}>{authError}</Text></View>
          )}

          <TouchableOpacity
            style={Object.assign({}, styles.primaryButton, styles.authSubmitButton, authSubmitting ? styles.disabled : {})}
            onPress={submitAuth}
            disabled={authSubmitting}
          >
            {authSubmitting ? <ActivityIndicator color={COLORS.bg} /> : <Text style={styles.primaryButtonText}>{authMode === 'signup' ? 'Create Account' : 'Sign In'}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={() => { setAuthMode(authMode === 'signup' ? 'signin' : 'signup'); setAuthError(null); }}>
            <Text style={styles.linkButtonText}>
              {authMode === 'signup' ? 'Already have an account? Sign in' : "New here? Create an account"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (checkingKey) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerFill}><ActivityIndicator color={COLORS.accent} /></View>
      </SafeAreaView>
    );
  }

  if (showApiKeyInput) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.eyebrow}>Setup</Text>
          <Text style={styles.title}>Add your API key</Text>
          <Text style={styles.subtitle}>{i18n.t('apiKeyPrompt')}</Text>
          <TextInput
            style={styles.input} value={apiKeyDraft} onChangeText={setApiKeyDraft}
            placeholder="AIza..." placeholderTextColor={COLORS.muted} autoCapitalize="none" autoCorrect={false} secureTextEntry
          />
          <TouchableOpacity style={styles.primaryButton} onPress={saveApiKey}>
            <Text style={styles.primaryButtonText}>{i18n.t('saveKey')}</Text>
          </TouchableOpacity>
          {apiKey && (
            <TouchableOpacity style={styles.linkButton} onPress={() => setShowApiKeyInput(false)}>
              <Text style={styles.linkButtonText}>{i18n.t('cancel')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.linkButton} onPress={logOut}>
            <Text style={styles.linkButtonText}>{i18n.t('logout')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const hasSevereHazard = result && result.cases.some((c) => c.percent >= 60);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        
        {/* --- ACTIVE TAB: HOME --- */}
        {activeTab === 'home' && (
          <View>
            {!imageUri && (
              <View>
                <View style={styles.headerContainer}>
                  <View style={styles.greetingWrapper}>
                    <Text style={styles.greetingText}>
                      🌤 {getGreeting()}, {fullName || i18n.t('citizen')}
                    </Text>
                    <Text style={styles.subGreetingText}>{i18n.t('stayAware')}</Text>
                  </View>

                  <View style={styles.profileWrapper}>
                    <TouchableOpacity onPress={() => setShowProfileMenu(!showProfileMenu)}>
                      {profilePhotoUri ? (
                        <Image source={{ uri: profilePhotoUri }} style={styles.profileAvatar} />
                      ) : (
                        <View style={styles.profileAvatarPlaceholder}>
                          <Ionicons name="person" size={24} color={COLORS.text} />
                        </View>
                      )}
                    </TouchableOpacity>

                    {showProfileMenu && (
                      <View style={styles.dropdownMenu}>
                        <TouchableOpacity style={styles.dropdownItem} onPress={() => setShowProfileMenu(false)}>
                          <Ionicons name="person-outline" size={18} color={COLORS.text} />
                          <Text style={styles.dropdownText}>{i18n.t('profile')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dropdownItem} onPress={() => setShowProfileMenu(false)}>
                          <Ionicons name="create-outline" size={18} color={COLORS.text} />
                          <Text style={styles.dropdownText}>{i18n.t('editProfile')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowApiKeyInput(true); setShowProfileMenu(false); }}>
                          <Ionicons name="settings-outline" size={18} color={COLORS.text} />
                          <Text style={styles.dropdownText}>{i18n.t('apiSettings')}</Text>
                        </TouchableOpacity>
                        <View style={styles.dropdownDivider} />
                        <TouchableOpacity style={styles.dropdownItem} onPress={() => { setAppLanguage('en'); setShowProfileMenu(false); }}>
                          <Ionicons name="language" size={18} color={COLORS.text} />
                          <Text style={styles.dropdownText}>English</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dropdownItem} onPress={() => { setAppLanguage('hi'); setShowProfileMenu(false); }}>
                          <Ionicons name="language" size={18} color={COLORS.text} />
                          <Text style={styles.dropdownText}>हिन्दी</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dropdownItem} onPress={() => { setAppLanguage('as'); setShowProfileMenu(false); }}>
                          <Ionicons name="language" size={18} color={COLORS.text} />
                          <Text style={styles.dropdownText}>অসমীয়া</Text>
                        </TouchableOpacity>
                        <View style={styles.dropdownDivider} />
                        <TouchableOpacity style={styles.dropdownItem} onPress={logOut}>
                          <Ionicons name="log-out-outline" size={18} color={COLORS.flag} />
                          <Text style={Object.assign({}, styles.dropdownText, { color: COLORS.flag })}>{i18n.t('logout')}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>

                {/* --- UPLOAD CARD --- */}
                <View style={styles.uploadCardPro}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderTopRow}>
                      <Ionicons name="warning" size={20} color={COLORS.accent} />
                      <Text style={styles.cardTitle}>{i18n.t('uploadCardTitle')}</Text>
                    </View>
                    <Text style={styles.cardSubtitle}>{i18n.t('uploadCardSubtitle')}</Text>
                  </View>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity style={styles.uploadBtnLeft} onPress={pickFromCamera}>
                      <Ionicons name="camera" size={34} color={COLORS.bg} style={styles.vibrantIcon} />
                      <Text style={styles.uploadBtnText}>{i18n.t('takePhoto')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.uploadBtnRight} onPress={pickFromGalleryWithWarning}>
                      <Ionicons name="images" size={34} color={COLORS.bg} style={styles.vibrantIcon} />
                      <Text style={styles.uploadBtnText}>{i18n.t('gallery')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* --- RECENT ALERTS SECTION --- */}
                <Text style={styles.sectionHeader}>{i18n.t('recentAlerts')}</Text>
                
                <View style={styles.recentAlertCard}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={styles.alertTitle}>📍 Pothole, Main Street</Text>
                    <Text style={styles.alertDesc} numberOfLines={2}>
                      Pothole Main Street is reported at eytnaies and holl...
                    </Text>
                  </View>
                  <View style={styles.alertThumbnail}>
                    <Ionicons name="image" size={20} color={COLORS.muted} />
                  </View>
                </View>

                <View style={styles.recentAlertCard}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={styles.alertTitle}>🗺️ Map Explore</Text>
                    <Text style={styles.alertDesc} numberOfLines={1}>
                      Infographic infographic
                    </Text>
                  </View>
                  <View style={styles.alertThumbnail}>
                    <Ionicons name="map" size={20} color={COLORS.muted} />
                  </View>
                </View>

              </View>
            )}

            {imageUri && (
              <View style={styles.resultScreenContainer}>
                {/* --- NEW TOP BACK BUTTON --- */}
                 <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
                onPress={resetAll}
                >
                <Ionicons name="arrow-back" size={18} color={COLORS.text} style={{ marginRight: 6 }} />
                <Text style={styles.secondaryButtonText}>{i18n.t('back')}</Text>
                </TouchableOpacity>
                {result && (
                  <View style={styles.successHeader}>
                    <Ionicons name="checkmark-circle" size={28} color={COLORS.clear} />
                    <Text style={styles.successHeaderText}>{i18n.t('inspectionComplete')}</Text>
                  </View>
                )}

                <View style={styles.modernCard}>
                  <Image source={{ uri: imageUri }} style={styles.scannedImage} />
                  
                  {!result ? (
                    <TouchableOpacity 
                      style={Object.assign({}, styles.scanActionBtn, analyzing ? styles.scanActionBtnAnalyzing : {})} 
                      onPress={handleAnalyze} 
                      disabled={analyzing}
                    >
                      {analyzing ? (
                        <View style={styles.buttonRowSpinner}>
                          <ActivityIndicator size="small" color={COLORS.bg} style={styles.inputIcon} />
                          <Text style={styles.scanActionBtnTextDark}>{scanProgressText}</Text>
                        </View>
                      ) : (
                        <View style={styles.buttonRowSpinner}>
                          <Ionicons name="flash" size={22} color={COLORS.bg} style={styles.inputIcon} />
                          <Text style={styles.scanActionBtnTextDark}>{i18n.t('scanPhoto')}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.scanLockedBtn}>
                      <Ionicons name="checkmark" size={20} color={COLORS.clear} style={styles.inputIcon} />
                      <Text style={styles.scanLockedBtnText}>{i18n.t('scanComplete')}</Text>
                    </View>
                  )}
                </View>

                {error && (
                  <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
                )}

                {result && (
                  <View style={styles.container}>
                    <Text style={styles.sectionHeader}>{i18n.t('inspectionSummary')}</Text>
                    
                    <View style={styles.modernCard}>
                      {result.cases.map((c) => {
                        const tier = tierFor(c.percent);
                        const color = TIER_COLORS[tier];
                        return (
                          <View key={c.key} style={styles.caseResultCard}>
                            <View style={Object.assign({}, styles.percentBadge, { backgroundColor: color })}>
                              <Text style={styles.percentBadgeText}>{c.percent}%</Text>
                            </View>
                            <View style={styles.flex1}>
                              <View style={styles.caseResultHeader}>
                                <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                                  <Ionicons name={c.icon} size={16} color={COLORS.muted} />
                                  <Text style={styles.caseResultLabel}>{c.label}</Text>
                                </View>
                                <View style={{ backgroundColor: color + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                                  <Text style={Object.assign({}, styles.caseResultTier, { color: color })}>{Reflect.get(TIER_LABELS, tier)}</Text>
                                </View>
                              </View>
                              {!!c.note && <Text style={styles.caseResultNote}>{c.note}</Text>}
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    {hasSevereHazard && (
                      <View style={Object.assign({}, styles.modernCard, { borderColor: COLORS.flag })}>
                        <Text style={styles.cardTitle}>{i18n.t('uploadVideo')}</Text>
                        <Text style={Object.assign({}, styles.metadataLabel, { marginBottom: 12 })}>
                          {i18n.t('videoEvidenceDesc')}
                        </Text>
                        {videoUri ? (
                          <View style={styles.sentBox}>
                            <Ionicons name="checkmark-circle" size={22} color={COLORS.clear} style={styles.inputIcon} />
                            <Text style={styles.sentText}>{i18n.t('videoAttached')}</Text>
                          </View>
                        ) : (
                          <TouchableOpacity style={styles.reportActionBtn} onPress={pickVideoFromGallery}>
                            <Ionicons name="videocam" size={18} color={COLORS.bg} style={styles.inputIcon} />
                            <Text style={styles.reportActionBtnText}>{i18n.t('uploadVideo')}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    <View style={styles.modernCard}>
                      <View style={styles.cardTitleRow}>
                        <Ionicons name="location" size={20} color={COLORS.accent} />
                        <Text style={styles.cardTitle}>{i18n.t('locationInfo')}</Text>
                      </View>
                      <View style={styles.divider} />
                      
                      <Text style={styles.metadataLabel}>{i18n.t('address')}</Text>
                      <Text style={styles.metadataValue}>
                        {geocodedAddress ? 
                          [geocodedAddress.street, geocodedAddress.district, geocodedAddress.city, geocodedAddress.region, geocodedAddress.postalCode, geocodedAddress.country].filter(Boolean).join(', ') 
                          : (locating ? 'Getting location...' : 'Address unavailable')}
                      </Text>
                      <Text style={styles.metadataLabel}>{i18n.t('coordinates')}</Text>
                      <Text style={styles.metadataValue}>
                        {location ? `Lat: ${location.latitude.toFixed(5)}, Lng: ${location.longitude.toFixed(5)}` : 'N/A'}
                      </Text>
                      <Text style={styles.metadataLabel}>{i18n.t('captureDate')}</Text>
                      <Text style={styles.metadataValue}>{captureTime ? captureTime.toLocaleString() : 'N/A'}</Text>
                      <TouchableOpacity style={styles.secondaryButton} onPress={openInMaps}>
                        <Ionicons name="map-outline" size={16} color={COLORS.text} style={styles.inputIcon} />
                        <Text style={styles.secondaryButtonText}>{i18n.t('openMaps')}</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.modernCard}>
                      <Text style={styles.cardTitle}>{i18n.t('obsNotes')}</Text>
                      <TextInput
                        style={styles.modernNotesInput}
                        multiline
                        placeholder={i18n.t('obsPlaceholder')}
                        placeholderTextColor={COLORS.muted}
                        value={observationNotes}
                        onChangeText={setObservationNotes}
                      />
                    </View>

                    <View style={styles.actionButtonGroup}>
                      <TouchableOpacity style={styles.secondaryButton} onPress={handleShareReport}>
                        <Ionicons name="share-social" size={18} color={COLORS.text} style={styles.inputIcon} />
                        <Text style={styles.secondaryButtonText}>{i18n.t('shareReport')}</Text>
                      </TouchableOpacity>

                      {reported ? (
                        <View style={styles.sentBox}>
                          <Ionicons name="checkmark-circle" size={22} color={COLORS.clear} style={styles.inputIcon} />
                          <Text style={styles.sentText}>{i18n.t('reportSent')}</Text>
                        </View>
                      ) : (
                        <TouchableOpacity style={Object.assign({}, styles.reportActionBtn, reporting ? styles.disabled : {})} onPress={reportToAuthority} disabled={reporting}>
                          {reporting ? (
                            <View style={styles.buttonRowSpinner}>
                              <ActivityIndicator color={COLORS.bg} style={{ marginRight: 8 }} />
                              <Text style={styles.reportActionBtnText}>{reportStatusText}</Text>
                            </View>
                          ) : (
                            <View style={styles.buttonRowSpinner}>
                              <Ionicons name="warning" size={18} color={COLORS.bg} style={styles.inputIcon} />
                              <Text style={styles.reportActionBtnText}>{i18n.t('reportAuth')}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity style={styles.newScanButton} onPress={handleNewScan}>
                        <Ionicons name="add" size={20} color={COLORS.bg} style={styles.inputIcon} />
                        <Text style={styles.newScanButtonText}>{i18n.t('newScan')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* --- ACTIVE TAB: HISTORY (My Dockets) --- */}
        {activeTab === 'history' && (
          <View>
            {!selectedReport ? (
              <View style={styles.historyContainer}>
                <Text style={styles.sectionHeader}>{i18n.t('myDockets')}</Text>

                {/* --- ACTIVE VS HISTORY TOGGLE --- */}
                <View style={styles.tabToggleContainer}>
                  <TouchableOpacity
                    style={[styles.tabToggleButton, docketTab === 'active' && styles.tabToggleActive]}
                    onPress={() => setDocketTab('active')}
                  >
                    <Text style={[styles.tabToggleText, { color: docketTab === 'active' ? COLORS.text : COLORS.muted }]}>Live Tracking</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tabToggleButton, docketTab === 'history' && styles.tabToggleActive]}
                    onPress={() => setDocketTab('history')}
                  >
                    <Text style={[styles.tabToggleText, { color: docketTab === 'history' ? COLORS.text : COLORS.muted }]}>Resolved History</Text>
                  </TouchableOpacity>
                </View>
                
                {loadingReports ? (
                  <ActivityIndicator color={COLORS.accent} style={{ marginTop: 40 }} />
                ) : docketTab === 'active' ? (
                  // --- ACTIVE REPORTS: DELIVERY UI ---
                  activeReports.length === 0 ? (
                    <Text style={styles.noReportsText}>No active reports in progress.</Text>
                  ) : (
                    activeReports.map((report) => {
                      const latestStatus = report.history.length > 0 ? report.history[report.history.length - 1].stateName : report.status;
                      
                      return (
                        <View key={report.id} style={styles.modernCard}>
                          <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center'}}>
                            <Text style={styles.cardTitle}>Live Tracking: #{report.docketId}</Text>
                            <TouchableOpacity onPress={() => setSelectedReport(report)}>
                              <Text style={{color: COLORS.accent, fontSize: 13, fontWeight: 'bold'}}>View Details</Text>
                            </TouchableOpacity>
                          </View>

                          <View style={{ borderLeftWidth: 2, borderColor: COLORS.clear, marginLeft: 10, paddingLeft: 20 }}>
                            {report.history.map((node, index) => (
                              <View key={index} style={{ marginBottom: 20 }}>
                                <View style={{ position: 'absolute', left: -27, top: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.clear }} />
                                <Text style={{ fontWeight: 'bold', fontSize: 15, color: COLORS.text }}>{node.stateName}</Text>
                                <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>
                                  {new Date(node.createdAt).toLocaleString()}
                                </Text>
                              </View>
                            ))}
                          </View>

                          {/* Only show if backend updated it to Crew Dispatched or similar */}
                          {(latestStatus === 'Crew Dispatched' || latestStatus === 'Resolved') && report.status !== 'Resolved' && (
                            <TouchableOpacity 
                              style={[styles.reportActionBtn, {marginTop: 10}]}
                              onPress={() => markAsResolved(report.id)}
                            >
                              <Ionicons name="checkmark-done" size={18} color={COLORS.bg} style={styles.inputIcon} />
                              <Text style={styles.reportActionBtnText}>Mark as Resolved</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })
                  )
                ) : (
                  // --- HISTORY REPORTS: TRADITIONAL CARD ---
                  historyReports.length === 0 ? (
                    <Text style={styles.noReportsText}>No resolved reports yet.</Text>
                  ) : (
                    historyReports.map((item) => (
                      <HistoryCard key={item.id} item={item} onPress={setSelectedReport} />
                    ))
                  )
                )}
              </View>
            ) : (
              <View style={styles.resultScreenContainer}>
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
                  onPress={() => setSelectedReport(null)}
                >
                  <Ionicons name="arrow-back" size={18} color={COLORS.text} style={{ marginRight: 6 }} />
                  <Text style={styles.secondaryButtonText}>{i18n.t('back')}</Text>
                </TouchableOpacity>

                <View style={styles.successHeader}>
                  <Ionicons name="receipt-outline" size={24} color={COLORS.clear} />
                  <Text style={styles.successHeaderText}>Docket ID: {selectedReport.docketId}</Text>
                </View>

                {/* Display Full Sized Image in History */}
                {selectedReport.imageUrl && (
                  <Image source={{ uri: selectedReport.imageUrl }} style={styles.scannedImage} />
                )}

                {/* Display Video Link in History */}
                {selectedReport.videoUrl && (
                  <TouchableOpacity style={[styles.secondaryButton, { marginBottom: 16, borderColor: COLORS.accent }]} onPress={() => Linking.openURL(selectedReport.videoUrl)}>
                    <Ionicons name="play-circle" size={18} color={COLORS.accent} style={styles.inputIcon} />
                    <Text style={[styles.secondaryButtonText, { color: COLORS.accent }]}>View Attached Video Evidence</Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.sectionHeader}>Status Timeline</Text>
                <View style={styles.modernCard}>
                  {selectedReport.history.map((step, idx) => 
                    renderTimelineStep(step, idx, selectedReport.history.length)
                  )}
                </View>

                <Text style={styles.sectionHeader}>{i18n.t('inspectionSummary')}</Text>
                <View style={styles.modernCard}>
                  {selectedReport.cases.map((c) => {
                    const tier = tierFor(c.percent);
                    const color = TIER_COLORS[tier];
                    return (
                      <View key={c.key} style={styles.caseResultCard}>
                        <View style={Object.assign({}, styles.percentBadge, { backgroundColor: color })}>
                          <Text style={styles.percentBadgeText}>{c.percent}%</Text>
                        </View>
                        <View style={styles.flex1}>
                          <View style={styles.caseResultHeader}>
                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                              <Ionicons name={c.icon} size={16} color={COLORS.muted} />
                              <Text style={styles.caseResultLabel}>{c.label}</Text>
                            </View>
                            <View style={{ backgroundColor: color + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                              <Text style={Object.assign({}, styles.caseResultTier, { color: color })}>{Reflect.get(TIER_LABELS, tier)}</Text>
                            </View>
                          </View>
                          {!!c.note && <Text style={styles.caseResultNote}>{c.note}</Text>}
                        </View>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.modernCard}>
                  <View style={styles.cardTitleRow}>
                    <Ionicons name="location" size={20} color={COLORS.accent} />
                    <Text style={styles.cardTitle}>{i18n.t('locationInfo')}</Text>
                  </View>
                  <View style={styles.divider} />
                  <Text style={styles.metadataLabel}>{i18n.t('address')}</Text>
                  <Text style={styles.metadataValue}>
                    {selectedReport.city || selectedReport.region ? `${selectedReport.city}, ${selectedReport.region}` : 'N/A'}
                  </Text>
                  <Text style={styles.metadataLabel}>{i18n.t('coordinates')}</Text>
                  <Text style={styles.metadataValue}>
                    {selectedReport.latitude && selectedReport.longitude ? `Lat: ${selectedReport.latitude.toFixed(5)}, Lng: ${selectedReport.longitude.toFixed(5)}` : 'N/A'}
                  </Text>
                  <Text style={styles.metadataLabel}>{i18n.t('captureDate')}</Text>
                  <Text style={styles.metadataValue}>
                    {selectedReport.captureTime ? new Date(selectedReport.captureTime).toLocaleString() : 'N/A'}
                  </Text>
                  <TouchableOpacity style={styles.secondaryButton} onPress={openInMaps}>
                    <Ionicons name="map-outline" size={16} color={COLORS.text} style={styles.inputIcon} />
                    <Text style={styles.secondaryButtonText}>{i18n.t('openMaps')}</Text>
                  </TouchableOpacity>
                </View>

                {selectedReport.observationNotes ? (
                  <View style={styles.modernCard}>
                    <Text style={styles.cardTitle}>{i18n.t('obsNotes')}</Text>
                    <Text style={styles.caseResultNote}>{selectedReport.observationNotes}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* --- MATCHED 4-ICON BOTTOM TAB BAR --- */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => { setActiveTab('home'); resetAll(); }}>
          <Ionicons name="home" size={22} color={activeTab === 'home' ? COLORS.accent : COLORS.muted} />
          <Text style={[styles.tabLabel, { color: activeTab === 'home' ? COLORS.accent : COLORS.muted }]}>{i18n.t('home')}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.tabItem} onPress={() => { setActiveTab('history'); fetchUserReports(); }}>
          <Ionicons name="calendar-outline" size={22} color={activeTab === 'history' ? COLORS.accent : COLORS.muted} />
          <Text style={[styles.tabLabel, { color: activeTab === 'history' ? COLORS.accent : COLORS.muted }]}>{i18n.t('history')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => Alert.alert('Explore', 'Map explore feature coming soon!')}>
          <Ionicons name="location-outline" size={22} color={COLORS.muted} />
          <Text style={[styles.tabLabel, { color: COLORS.muted }]}>{i18n.t('explore')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setShowProfileMenu(true)}>
          <Ionicons name="person-outline" size={22} color={COLORS.muted} />
          <Text style={[styles.tabLabel, { color: COLORS.muted }]}>{i18n.t('profile')}</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingTop: 16, flexGrow: 1, paddingBottom: 90 },

  // --- TYPOGRAPHY & BUTTONS ---
  eyebrow: { fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase', color: COLORS.accent, fontWeight: '700' },
  title: { fontSize: 30, fontWeight: '800', color: COLORS.text, marginTop: 4, marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: COLORS.muted, lineHeight: 21, marginBottom: 24 },
  primaryButton: { backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  primaryButtonText: { color: '#000000', fontWeight: '800', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },
  disabled: { opacity: 0.5 },
  flex1: { flex: 1 },
  errorBox: { marginTop: 14, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.4)', backgroundColor: 'rgba(239, 68, 68, 0.12)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  errorText: { color: '#FCA5A5', fontSize: 13, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, color: COLORS.text, fontSize: 15, marginBottom: 14 },
  linkButton: { alignItems: 'center', marginTop: 16 },
  linkButtonText: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  
  // --- AUTH / PROFILE PICKER ---
  photoPicker: { alignItems: 'center', marginBottom: 24 },
  photoPreview: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: COLORS.accent },
  photoPlaceholder: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  photoPickerText: { color: COLORS.accent, fontSize: 13, marginTop: 10, fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, borderRadius: 12, paddingHorizontal: 14, marginBottom: 14 },
  inputIcon: { marginRight: 10 },
  inputFlex: { flex: 1, color: COLORS.text, fontSize: 15, paddingVertical: 14 },
  authSubmitButton: { marginTop: 8 },

  // --- HEADER & DASHBOARD ---
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 28, zIndex: 10 },
  greetingWrapper: { flex: 1, paddingRight: 15 },
  greetingText: { fontSize: 23, fontWeight: '800', color: COLORS.text, marginBottom: 6, letterSpacing: -0.3 },
  subGreetingText: { fontSize: 13, color: COLORS.muted, lineHeight: 19 },
  profileWrapper: { position: 'relative' },
  profileAvatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: COLORS.accent },
  profileAvatarPlaceholder: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  
  dropdownMenu: { position: 'absolute', top: 62, right: 0, backgroundColor: COLORS.surface, borderRadius: 16, paddingVertical: 8, minWidth: 180, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 12 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  dropdownText: { color: COLORS.text, fontSize: 14, marginLeft: 12, fontWeight: '600' },
  dropdownDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 6 },

  // --- UPLOAD CARD PRO ---
  uploadCardPro: { backgroundColor: COLORS.surface, borderRadius: 24, padding: 22, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.25)', shadowColor: '#6366F1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8, marginBottom: 28 },
  cardHeader: { marginBottom: 20, alignItems: 'center' },
  cardHeaderTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, letterSpacing: 0.5 },
  cardSubtitle: { fontSize: 13, color: COLORS.muted },
  buttonRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  buttonRowSpinner: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  
  uploadBtnLeft: { flex: 1, backgroundColor: COLORS.indigo, borderRadius: 18, paddingVertical: 20, alignItems: 'center', shadowColor: COLORS.indigo, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  uploadBtnRight: { flex: 1, backgroundColor: COLORS.purple, borderRadius: 18, paddingVertical: 20, alignItems: 'center', shadowColor: COLORS.purple, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  vibrantIcon: { marginBottom: 8 },
  uploadBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },

  // --- RECENT ALERTS ---
  recentAlertCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  alertTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  alertDesc: { fontSize: 13, color: COLORS.muted, lineHeight: 18 },
  alertThumbnail: { width: 56, height: 48, borderRadius: 10, backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },

  // --- RESULTS & CARDS ---
  resultScreenContainer: { paddingBottom: 40 },
  successHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingVertical: 14, borderRadius: 14, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.25)' },
  successHeaderText: { fontSize: 16, fontWeight: '800', color: COLORS.clear, marginLeft: 8 },
  sectionHeader: { fontSize: 12, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 12, marginBottom: 14, marginLeft: 4 },
  modernCard: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 14 },
  scannedImage: { width: '100%', height: 280, borderRadius: 16, marginBottom: 16 },
  
  scanActionBtn: { flexDirection: 'row', backgroundColor: COLORS.accent, paddingVertical: 16, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  scanActionBtnAnalyzing: { backgroundColor: '#B47804' },
  scanActionBtnTextDark: { color: '#000000', fontSize: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  scanLockedBtn: { flexDirection: 'row', backgroundColor: 'rgba(16, 185, 129, 0.12)', paddingVertical: 16, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.clear },
  scanLockedBtnText: { color: COLORS.clear, fontSize: 15, fontWeight: '800' },
  
  metadataLabel: { fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 10, marginBottom: 4, fontWeight: '700' },
  metadataValue: { fontSize: 14, color: COLORS.text, marginBottom: 6, fontWeight: '500' },
  modernNotesInput: { backgroundColor: COLORS.bg, borderRadius: 12, padding: 14, color: COLORS.text, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: COLORS.border, fontSize: 14 },
  
  actionButtonGroup: { marginTop: 12, gap: 12 },
  secondaryButton: { flexDirection: 'row', backgroundColor: COLORS.surface, paddingVertical: 14, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  secondaryButtonText: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  reportActionBtn: { flexDirection: 'row', backgroundColor: COLORS.flag, paddingVertical: 16, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.flag, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  reportActionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  newScanButton: { flexDirection: 'row', backgroundColor: COLORS.text, paddingVertical: 16, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 6 },
  newScanButtonText: { color: COLORS.bg, fontSize: 15, fontWeight: '800' },
  
  caseResultCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.bg, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  percentBadge: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  percentBadgeText: { color: '#000000', fontWeight: '900', fontSize: 14 },
  caseResultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  caseResultLabel: { color: COLORS.text, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  caseResultTier: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  caseResultNote: { color: COLORS.muted, fontSize: 13, lineHeight: 18 },
  
  sentBox: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.clear, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 14, paddingVertical: 16 },
  sentText: { color: COLORS.clear, fontSize: 15, fontWeight: '800' },

  // --- HISTORY & TRACKING ---
  historyContainer: { paddingBottom: 40 },
  noReportsText: { color: COLORS.muted, fontSize: 14, textAlign: 'center', marginTop: 40 },
  historyCard: { backgroundColor: COLORS.surface, borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  historyCardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  thumbnailContainer: { width: 52, height: 52, borderRadius: 12, backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  historyCardTextSection: { flex: 1, paddingRight: 10, justifyContent: 'center' },
  historyDocketId: { color: COLORS.text, fontSize: 15, fontWeight: '800', marginBottom: 4, letterSpacing: 0.3 },
  historyCardLocation: { color: COLORS.muted, fontSize: 13, fontWeight: '500', marginBottom: 4 },
  historyCardDate: { color: 'rgba(148, 163, 184, 0.7)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start' },
  statusPillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  tabToggleContainer: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 12, padding: 4, marginBottom: 18, borderWidth: 1, borderColor: COLORS.border },
  tabToggleButton: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: 'transparent', alignItems: 'center' },
  tabToggleActive: { backgroundColor: COLORS.surfaceLight },
  tabToggleText: { fontWeight: '700', fontSize: 13 },

  timelineStepContainer: { flexDirection: 'row', marginBottom: 8, minHeight: 70 },
  timelineLeftColumn: { alignItems: 'center', marginRight: 16, width: 28 },
  timelineNode: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  timelineNodePast: { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderWidth: 1, borderColor: COLORS.clear },
  timelineNodeActive: { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderWidth: 1, borderColor: COLORS.accent },
  timelineNodeFuture: { backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.border },
  timelineNodePulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.accent },
  timelineLine: { position: 'absolute', top: 26, bottom: -6, width: 2, zIndex: 1, backgroundColor: COLORS.border },
  timelineLineActive: { backgroundColor: COLORS.clear },
  timelineRightColumn: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  timelineRightColumnActive: { borderColor: COLORS.borderActive, backgroundColor: 'rgba(245, 158, 11, 0.03)' },
  timelineHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineStateText: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  timelineDateText: { color: COLORS.muted, fontSize: 12, fontWeight: '500' },
  timelineDetailsCard: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  timelineDetailItem: { marginBottom: 12 },
  timelineDetailLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  timelineDetailValue: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  forwardToInfoBox: { backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: 12, padding: 12, marginTop: 4, borderWidth: 1, borderColor: COLORS.border },
  forwardToRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  forwardToLabel: { color: COLORS.muted, fontSize: 13 },
  forwardToValue: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  callButton: { flexDirection: 'row', backgroundColor: COLORS.clear, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignItems: 'center' },
  callButtonText: { color: '#000000', fontSize: 12, fontWeight: '800' },

  // --- BOTTOM TAB BAR ---
  tabBar: { flexDirection: 'row', height: 68, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: '#0B0F17', alignItems: 'center', justifyContent: 'space-around', position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: Platform.OS === 'ios' ? 12 : 0 },
  tabItem: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8, flex: 1 },
  tabLabel: { fontSize: 11, marginTop: 4, fontWeight: '700' }
});