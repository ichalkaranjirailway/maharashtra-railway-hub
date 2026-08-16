/**
 * MAHARASHTRA RAILWAY INFORMATION HUB — DATA LAYER
 * ---------------------------------------------------------------
 * IMPORTANT: Every record in this file is DEMO DATA (isDemo: true)
 * created only to make the interface functional and reviewable.
 * It is NOT sourced from official records and MUST NOT be treated
 * as fact or published as-is.
 *
 * In production, this file is replaced by data fetched from a
 * real database/API (see /README.md → "Making it live"). The
 * shape of each record is intentionally the contract the backend
 * should produce, so swapping demo data for real data requires no
 * change to app.js.
 * ---------------------------------------------------------------
 */

const VERIFICATION = {
  VERIFIED: { key: "VERIFIED", dot: "🟢", label_en: "Verified", label_mr: "पडताळणी झालेली" },
  UNDER_VERIFICATION: { key: "UNDER_VERIFICATION", dot: "🟡", label_en: "Under verification", label_mr: "पडताळणी सुरू" },
  HISTORICAL: { key: "HISTORICAL", dot: "🔵", label_en: "Historical / archived", label_mr: "ऐतिहासिक / संग्रहित" },
  SOURCE_BASED: { key: "SOURCE_BASED", dot: "⚪", label_en: "Source-based report", label_mr: "स्रोत-आधारित वृत्त" },
  UNVERIFIED: { key: "UNVERIFIED", dot: "🔴", label_en: "Unverified — not published as fact", label_mr: "अपडताळित — वस्तुस्थिती म्हणून नाही" }
};

const STATUS_ORDER = [
  "PROPOSED", "SURVEY", "FLS_COMPLETED", "DPR_PREPARED", "DPR_REVISED",
  "UNDER_EXAMINATION", "PENDING_RAILWAY_BOARD", "SANCTIONED", "LAND_ACQUISITION",
  "TENDER", "UNDER_CONSTRUCTION", "PARTIALLY_COMPLETED", "COMPLETED", "ON_HOLD",
  "DROPPED", "ARCHIVED"
];

const STATUS_LABELS = {
  PROPOSED: { en: "Proposed", mr: "प्रस्तावित" },
  SURVEY: { en: "Survey", mr: "सर्वेक्षण" },
  FLS_COMPLETED: { en: "FLS completed", mr: "प्राथमिक सर्वेक्षण पूर्ण" },
  DPR_PREPARED: { en: "DPR prepared", mr: "डीपीआर तयार" },
  DPR_REVISED: { en: "DPR revised", mr: "डीपीआर सुधारित" },
  UNDER_EXAMINATION: { en: "Under examination", mr: "तपासणी सुरू" },
  PENDING_RAILWAY_BOARD: { en: "Pending Railway Board", mr: "रेल्वे बोर्डाकडे प्रलंबित" },
  SANCTIONED: { en: "Sanctioned", mr: "मंजूर" },
  LAND_ACQUISITION: { en: "Land acquisition", mr: "भूसंपादन" },
  TENDER: { en: "Tender", mr: "निविदा" },
  UNDER_CONSTRUCTION: { en: "Under construction", mr: "बांधकाम सुरू" },
  PARTIALLY_COMPLETED: { en: "Partially completed", mr: "अंशतः पूर्ण" },
  COMPLETED: { en: "Completed", mr: "पूर्ण" },
  ON_HOLD: { en: "On hold", mr: "स्थगित" },
  DROPPED: { en: "Dropped", mr: "रद्द" },
  ARCHIVED: { en: "Archived", mr: "संग्रहित" }
};

const CATEGORIES = [
  "NEW_LINE", "DOUBLING", "TRIPLING", "GAUGE_CONVERSION", "ELECTRIFICATION",
  "STATION_DEVELOPMENT", "STATION_REDEVELOPMENT", "ROB", "RUB", "BRIDGE",
  "TUNNEL", "SIGNALLING", "TRACK", "SERVICE", "OTHER"
];

const CATEGORY_LABELS = {
  NEW_LINE: { en: "New railway line", mr: "नवीन रेल्वे मार्ग" },
  DOUBLING: { en: "Doubling", mr: "दुहेरीकरण" },
  TRIPLING: { en: "Tripling", mr: "तिहेरीकरण" },
  GAUGE_CONVERSION: { en: "Gauge conversion", mr: "गेज परिवर्तन" },
  ELECTRIFICATION: { en: "Electrification", mr: "विद्युतीकरण" },
  STATION_DEVELOPMENT: { en: "Station development", mr: "स्थानक विकास" },
  STATION_REDEVELOPMENT: { en: "Station redevelopment", mr: "स्थानक पुनर्विकास" },
  ROB: { en: "Road over bridge", mr: "रोड ओव्हर ब्रिज" },
  RUB: { en: "Road under bridge", mr: "रोड अंडर ब्रिज" },
  BRIDGE: { en: "Bridge", mr: "पूल" },
  TUNNEL: { en: "Tunnel", mr: "बोगदा" },
  SIGNALLING: { en: "Signalling", mr: "सिग्नल यंत्रणा" },
  TRACK: { en: "Track project", mr: "ट्रॅक प्रकल्प" },
  SERVICE: { en: "Railway service", mr: "रेल्वे सेवा" },
  OTHER: { en: "Other infrastructure", mr: "इतर पायाभूत सुविधा" }
};

/**
 * PROJECTS
 * The Hatkanangale–Ichalkaranji project (id: htk-ich) is the seed
 * record migrated in structure (not verbatim content) from
 * https://ichalkaranjirailway.github.io/htk-ich/ per the brief.
 * Its figures below are placeholders — replace with sourced values
 * before publishing.
 */
const PROJECTS = [
  {
    id: "htk-ich",
    isDemo: true,
    featured: true,
    name_en: "Hatkanangale–Ichalkaranji Railway Connectivity",
    name_mr: "हातकणंगले–इचलकरंजी रेल्वे जोडणी",
    district: "Kolhapur",
    zone: "Central Railway",
    division: "Pune",
    category: "NEW_LINE",
    lengthKm: 8,
    status: "UNDER_EXAMINATION",
    costCrore: null,
    summary_en: "A long-standing demand to connect Ichalkaranji, one of Maharashtra's largest textile towns, to the railway network via a short link from Hatkanangale on the Pune–Miraj line.",
    summary_mr: "पुणे–मिरज मार्गावरील हातकणंगले येथून महाराष्ट्रातील प्रमुख वस्त्रोद्योग शहर इचलकरंजीला रेल्वेने जोडण्याची दीर्घकालीन मागणी.",
    statusHistory: [
      { date: "2020-01-01", status: "SURVEY", costCrore: 180.73, source: "Demo placeholder — replace with sourced record", verification: "SOURCE_BASED" },
      { date: "2026-01-01", status: "UNDER_EXAMINATION", costCrore: null, source: "Demo placeholder — replace with sourced record", verification: "UNDER_VERIFICATION" }
    ],
    updatedAt: "2026-08-01"
  },
  {
    id: "pune-nashik-hsr",
    isDemo: true,
    featured: false,
    name_en: "Pune–Nashik Semi-High-Speed Line",
    name_mr: "पुणे–नाशिक सेमी-हाय-स्पीड रेल्वे",
    district: "Pune / Ahmednagar / Nashik",
    zone: "Central Railway",
    division: "Multiple",
    category: "NEW_LINE",
    lengthKm: 235,
    status: "DPR_REVISED",
    costCrore: null,
    summary_en: "Proposed semi-high-speed corridor connecting Pune, Ahmednagar and Nashik.",
    summary_mr: "पुणे, अहमदनगर आणि नाशिक यांना जोडणारा प्रस्तावित सेमी-हाय-स्पीड कॉरिडॉर.",
    statusHistory: [
      { date: "2025-06-01", status: "DPR_PREPARED", costCrore: null, source: "Demo placeholder", verification: "SOURCE_BASED" },
      { date: "2026-03-01", status: "DPR_REVISED", costCrore: null, source: "Demo placeholder", verification: "UNDER_VERIFICATION" }
    ],
    updatedAt: "2026-07-15"
  },
  {
    id: "solapur-tuljapur-usmanabad",
    isDemo: true,
    featured: false,
    name_en: "Solapur–Tuljapur–Osmanabad New Line",
    name_mr: "सोलापूर–तुळजापूर–उस्मानाबाद नवीन मार्ग",
    district: "Solapur / Dharashiv",
    zone: "Central Railway",
    division: "Solapur",
    category: "NEW_LINE",
    lengthKm: 87,
    status: "UNDER_CONSTRUCTION",
    costCrore: null,
    summary_en: "New line intended to connect the Tuljabhavani pilgrimage town to the rail network.",
    summary_mr: "तुळजाभवानी तीर्थक्षेत्राला रेल्वे नेटवर्कशी जोडण्यासाठी नियोजित नवीन मार्ग.",
    statusHistory: [
      { date: "2024-01-01", status: "TENDER", costCrore: null, source: "Demo placeholder", verification: "SOURCE_BASED" },
      { date: "2025-01-01", status: "UNDER_CONSTRUCTION", costCrore: null, source: "Demo placeholder", verification: "UNDER_VERIFICATION" }
    ],
    updatedAt: "2026-05-20"
  },
  {
    id: "cstm-redevelopment",
    isDemo: true,
    featured: false,
    name_en: "Chhatrapati Shivaji Maharaj Terminus Redevelopment",
    name_mr: "छत्रपती शिवाजी महाराज टर्मिनस पुनर्विकास",
    district: "Mumbai",
    zone: "Central Railway",
    division: "Mumbai",
    category: "STATION_REDEVELOPMENT",
    lengthKm: null,
    status: "UNDER_CONSTRUCTION",
    costCrore: null,
    summary_en: "Redevelopment of the CSMT heritage terminus building and station facilities.",
    summary_mr: "सीएसएमटी वारसा टर्मिनस इमारत आणि स्थानक सुविधांचा पुनर्विकास.",
    statusHistory: [
      { date: "2023-01-01", status: "TENDER", costCrore: null, source: "Demo placeholder", verification: "SOURCE_BASED" },
      { date: "2024-06-01", status: "UNDER_CONSTRUCTION", costCrore: null, source: "Demo placeholder", verification: "UNDER_VERIFICATION" }
    ],
    updatedAt: "2026-06-10"
  },
  {
    id: "kolhapur-vaibhavwadi",
    isDemo: true,
    featured: false,
    name_en: "Kolhapur–Vaibhavwadi New Line",
    name_mr: "कोल्हापूर–वैभववाडी नवीन मार्ग",
    district: "Kolhapur / Sindhudurg",
    zone: "Central Railway / Konkan Railway",
    division: "Pune",
    category: "NEW_LINE",
    lengthKm: 112,
    status: "PROPOSED",
    costCrore: null,
    summary_en: "Long-proposed line intended to give Kolhapur direct rail access to the Konkan coast.",
    summary_mr: "कोल्हापूरला कोकण किनारपट्टीशी थेट रेल्वे जोडणी देण्यासाठी दीर्घकाळ प्रस्तावित मार्ग.",
    statusHistory: [
      { date: "2022-01-01", status: "PROPOSED", costCrore: null, source: "Demo placeholder", verification: "SOURCE_BASED" }
    ],
    updatedAt: "2026-02-01"
  }
];

/**
 * LATEST UPDATES ("ताजी बातमी")
 * Each item must map to a project id where relevant.
 */
const UPDATES = [
  {
    id: "u-2026-08-14-1",
    isDemo: true,
    date: "2026-08-14",
    time: "11:20",
    projectId: "htk-ich",
    category: "NEW_LINE",
    headline_en: "[Demo] Placeholder update on Hatkanangale–Ichalkaranji examination status",
    headline_mr: "[डेमो] हातकणंगले–इचलकरंजी तपासणी स्थितीबाबत नमुना अद्यतन",
    summary_en: "This is placeholder text standing in for a real, source-backed summary. Replace before publishing.",
    summary_mr: "हा वास्तविक, स्रोत-आधारित सारांशाच्या जागी ठेवलेला नमुना मजकूर आहे. प्रकाशित करण्यापूर्वी बदला.",
    source_en: "Demo source",
    sourceDate: "2026-08-14",
    sourceUrl: "",
    verification: "UNDER_VERIFICATION"
  },
  {
    id: "u-2026-08-10-1",
    isDemo: true,
    date: "2026-08-10",
    time: "09:00",
    projectId: "pune-nashik-hsr",
    category: "NEW_LINE",
    headline_en: "[Demo] Placeholder update on Pune–Nashik DPR revision",
    headline_mr: "[डेमो] पुणे–नाशिक डीपीआर सुधारणेबाबत नमुना अद्यतन",
    summary_en: "Placeholder summary text for the interface. Not sourced.",
    summary_mr: "इंटरफेससाठी नमुना सारांश मजकूर. स्रोत नाही.",
    source_en: "Demo source",
    sourceDate: "2026-08-10",
    sourceUrl: "",
    verification: "SOURCE_BASED"
  },
  {
    id: "u-2026-07-28-1",
    isDemo: true,
    date: "2026-07-28",
    time: "16:45",
    projectId: "cstm-redevelopment",
    category: "STATION_REDEVELOPMENT",
    headline_en: "[Demo] Placeholder update on CSMT redevelopment progress",
    headline_mr: "[डेमो] सीएसएमटी पुनर्विकास प्रगतीबाबत नमुना अद्यतन",
    summary_en: "Placeholder summary text for the interface. Not sourced.",
    summary_mr: "इंटरफेससाठी नमुना सारांश मजकूर. स्रोत नाही.",
    source_en: "Demo source",
    sourceDate: "2026-07-28",
    sourceUrl: "",
    verification: "SOURCE_BASED"
  }
];

/**
 * RTI ARCHIVE (demo shape only)
 */
const RTI_RECORDS = [
  {
    id: "rti-demo-1",
    isDemo: true,
    projectId: "htk-ich",
    applicationDate: "2021-03-01",
    applicationNumber: "DEMO/0000/2021",
    authority: "Demo authority — replace",
    subject_en: "[Demo] Placeholder RTI subject line",
    subject_mr: "[डेमो] नमुना आरटीआय विषय",
    replyDate: "2021-05-01",
    replyReference: "DEMO-REF-0000",
    keyInfo_en: "Placeholder — do not treat as an actual RTI reply.",
    keyInfo_mr: "नमुना — हे प्रत्यक्ष आरटीआय उत्तर मानू नये.",
    documentUrl: "",
    verification: "SOURCE_BASED"
  }
];

// Frozen exports so the rendering layer can't accidentally mutate source data.
window.MRIH_DATA = Object.freeze({
  VERIFICATION,
  STATUS_ORDER,
  STATUS_LABELS,
  CATEGORIES,
  CATEGORY_LABELS,
  PROJECTS,
  UPDATES,
  RTI_RECORDS
});
