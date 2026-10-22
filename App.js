import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  StatusBar as RNStatusBar,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { CameraView, useCameraPermissions } from "expo-camera";
import QRCode from "react-native-qrcode-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { validateIdentityPayload } from "./validateIdentity";

const STORAGE_KEY = "@digital_identity_current";

// ---------- Helper: generate a unique identity ID ----------
function generateUniqueId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `DID-${timestamp}-${random}`;
}

export default function App() {
  const [tab, setTab] = useState("create"); // "create" | "scan"

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Digital Identity In QR System</Text>
        <Text style={styles.headerSubtitle}>Live Demo</Text>
      </View>

      <View style={styles.tabBar}>
        <TabButton
          label="1-2. Create + QR"
          active={tab === "create"}
          onPress={() => setTab("create")}
        />
        <TabButton
          label="3. Scan & Verify"
          active={tab === "scan"}
          onPress={() => setTab("scan")}
        />
      </View>

      {tab === "create" ? <CreateIdentityScreen /> : <ScanScreen />}
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.tabButton, active && styles.tabButtonActive]}
      onPress={onPress}
    >
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// =========================================================
// FUNCTION 1 & 2: Create Digital Identity + Generate QR Code
// =========================================================
function CreateIdentityScreen() {
  const [name, setName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [course, setCourse] = useState("");
  const [identity, setIdentity] = useState(null);

  // Load last-created identity on screen mount (so it survives app restarts)
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) setIdentity(JSON.parse(saved));
    })();
  }, []);

  const handleGenerate = async () => {
    if (!name.trim() || !regNo.trim() || !course.trim()) {
      Alert.alert("Missing details", "Please fill in Name, Registration No. and Course.");
      return;
    }

    const newIdentity = {
      id: generateUniqueId(),
      name: name.trim(),
      regNo: regNo.trim(),
      course: course.trim(),
      issuedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newIdentity));
    setIdentity(newIdentity);
  };

  const handleReset = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setIdentity(null);
    setName("");
    setRegNo("");
    setCourse("");
  };

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.sectionTitle}>Create Digital Identity</Text>

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Registration No."
        value={regNo}
        onChangeText={setRegNo}
      />
      <TextInput
        style={styles.input}
        placeholder="Course / Branch"
        value={course}
        onChangeText={setCourse}
      />

      <TouchableOpacity style={styles.primaryButton} onPress={handleGenerate}>
        <Text style={styles.primaryButtonText}>Generate Unique ID + QR Code</Text>
      </TouchableOpacity>

      {identity && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Unique Identity ID</Text>
          <Text style={styles.cardValueMono}>{identity.id}</Text>

          <View style={styles.qrWrapper}>
            <QRCode value={JSON.stringify(identity)} size={220} />
          </View>

          <Row label="Name" value={identity.name} />
          <Row label="Reg. No." value={identity.regNo} />
          <Row label="Course" value={identity.course} />
          <Row
            label="Issued"
            value={new Date(identity.issuedAt).toLocaleString()}
          />

          <TouchableOpacity style={styles.secondaryButton} onPress={handleReset}>
            <Text style={styles.secondaryButtonText}>Reset / Create New</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

// =========================================================
// FUNCTION 3: Scan QR Code & Verify Identity
// =========================================================
function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedData, setScannedData] = useState(null);
  const [scanning, setScanning] = useState(true);
  const lastScanRef = useRef(0);

  const handleBarcodeScanned = ({ data }) => {
    const now = Date.now();
    // Debounce rapid repeat scans of the same frame
    if (now - lastScanRef.current < 1500) return;
    lastScanRef.current = now;

    // Format validation only: checks shape, ID format and dates. It does not
    // prove the identity was issued by a trusted authority.
    const result = validateIdentityPayload(data);
    if (!result.valid) {
      Alert.alert(
        "Invalid QR",
        "This QR code is not a valid identity payload.\n\n" + result.errors.slice(0, 3).join("\n")
      );
      return;
    }
    setScannedData(result.identity);
    setScanning(false);
  };

  const scanAgain = () => {
    setScannedData(null);
    setScanning(true);
  };

  if (!permission) {
    return <View style={styles.screen} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.screen}>
        <Text style={styles.sectionTitle}>Camera Permission Needed</Text>
        <Text style={styles.helperText}>
          We need camera access to scan identity QR codes.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {scanning ? (
        <View style={{ flex: 1 }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={styles.scanOverlay}>
            <Text style={styles.scanOverlayText}>Point camera at an Identity QR code</Text>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.screen}>
          <Text style={styles.sectionTitle}>✔ Format Check Passed</Text>
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>Not verified as authentic</Text>
            <Text style={styles.warningText}>
              This QR has the expected structure only. The app cannot confirm who issued it or
              that these details are true. Anyone can create a QR like this.
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Unique Identity ID</Text>
            <Text style={styles.cardValueMono}>{scannedData.id}</Text>

            <Row label="Name" value={scannedData.name} />
            <Row label="Reg. No." value={scannedData.regNo} />
            <Row label="Course" value={scannedData.course} />
            <Row
              label="Claimed issue date"
              value={new Date(scannedData.issuedAt).toLocaleString()}
            />
            <Row label="Scanned At" value={new Date().toLocaleString()} />

            <TouchableOpacity style={styles.primaryButton} onPress={scanAgain}>
              <Text style={styles.primaryButtonText}>Scan Another</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingTop: RNStatusBar.currentHeight || 0,
  },
  header: {
    backgroundColor: "#1E3A8A",
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#C7D2FE",
    fontSize: 12,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  tabButtonActive: {
    borderBottomWidth: 3,
    borderBottomColor: "#1E3A8A",
  },
  tabButtonText: {
    color: "#6B7280",
    fontWeight: "600",
    fontSize: 13,
  },
  tabButtonTextActive: {
    color: "#1E3A8A",
  },
  screen: {
    padding: 20,
    flexGrow: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 14,
  },
  helperText: {
    color: "#6B7280",
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: "#1E3A8A",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#1E3A8A",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  secondaryButtonText: {
    color: "#1E3A8A",
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    marginTop: 20,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  cardValueMono: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 16,
  },
  qrWrapper: {
    alignItems: "center",
    paddingVertical: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  rowLabel: {
    color: "#6B7280",
    fontSize: 13,
  },
  rowValue: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
  },
  warningBox: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: 10,
    padding: 12,
  },
  warningTitle: {
    color: "#92400E",
    fontWeight: "700",
    marginBottom: 4,
  },
  warningText: {
    color: "#92400E",
    fontSize: 13,
  },
  scanOverlay: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: "rgba(17,24,39,0.75)",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  scanOverlayText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
