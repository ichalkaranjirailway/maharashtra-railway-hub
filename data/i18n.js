/**
 * i18n — Marathi (primary) / English (secondary)
 * Add future languages by adding a new key object below;
 * nothing else in the app needs to change.
 */
const STRINGS = {
  mr: {
    siteName: "महाराष्ट्र रेल्वे माहिती केंद्र",
    tagline: "महाराष्ट्रातील रेल्वेची संपूर्ण माहिती — एकाच ठिकाणी.",
    subtitle: "प्रकल्प • सेवा • अद्यतने • कागदपत्रे • पुरावे • इतिहास",
    navHome: "मुख्यपृष्ठ",
    navProjects: "प्रकल्प",
    navTracker: "हातकणंगले–इचलकरंजी",
    navToday: "आजचा दिवस",
    navSearch: "शोधा",
    searchPlaceholder: "प्रकल्प, स्थानक, जिल्हा शोधा…",
    liveUpdates: "ताज्या रेल्वे अद्यतने",
    dashboard: "महाराष्ट्र प्रकल्प डॅशबोर्ड",
    totalProjects: "एकूण नोंदवलेले प्रकल्प",
    underConstruction: "बांधकाम सुरू",
    sanctioned: "मंजूर",
    proposed: "प्रस्तावित",
    completed: "पूर्ण",
    updatedThisMonth: "या महिन्यात अद्यतनित",
    featuredProject: "ठळक प्रकल्प",
    viewTracker: "संपूर्ण ट्रॅकर पहा",
    viewAllProjects: "सर्व प्रकल्प पहा",
    whatChanged: "काय बदलले?",
    todayIn: "महाराष्ट्र रेल्वेमधील आजचा दिवस",
    source: "स्रोत",
    originalDocument: "मूळ कागदपत्र",
    verification: "पडताळणी स्थिती",
    status: "सद्यस्थिती",
    district: "जिल्हा",
    zone: "रेल्वे विभाग (झोन)",
    division: "मंडळ",
    category: "प्रकार",
    length: "अंतर",
    lastUpdated: "शेवटचे अद्यतन",
    statusHistory: "स्थिती इतिहास",
    demoLabel: "डेमो डेटा — प्रत्यक्ष नाही",
    demoBanner: "ही आवृत्ती नमुना (डेमो) डेटा वापरते. प्रत्यक्ष अधिकृत माहिती जोडेपर्यंत कोणतीही आकडेवारी वस्तुस्थिती मानू नये.",
    footerAbout: "याविषयी",
    footerSources: "स्रोत व कार्यपद्धती",
    footerMethodology: "पद्धत",
    noResults: "कोणताही निकाल सापडला नाही.",
    filterAll: "सर्व",
    rtiArchive: "आरटीआय संग्रह",
    documentArchive: "कागदपत्र संग्रह",
    aboutIssue: "पार्श्वभूमी",
    approxLength: "अंदाजे ८ किमी",
    latestUpdate: "ताजे अद्यतन",
    evidence: "पुरावा संग्रह",
    timeline: "कालरेषा"
  },
  en: {
    siteName: "Maharashtra Railway Information Hub",
    tagline: "Everything about railways in Maharashtra — in one place.",
    subtitle: "Projects • Services • Updates • Documents • Evidence • History",
    navHome: "Home",
    navProjects: "Projects",
    navTracker: "Hatkanangale–Ichalkaranji",
    navToday: "Today",
    navSearch: "Search",
    searchPlaceholder: "Search projects, stations, districts…",
    liveUpdates: "Latest Railway Updates",
    dashboard: "Maharashtra Project Dashboard",
    totalProjects: "Total tracked projects",
    underConstruction: "Under construction",
    sanctioned: "Sanctioned",
    proposed: "Proposed",
    completed: "Completed",
    updatedThisMonth: "Updated this month",
    featuredProject: "Featured project",
    viewTracker: "Open full tracker",
    viewAllProjects: "View all projects",
    whatChanged: "What changed?",
    todayIn: "Today in Maharashtra Railways",
    source: "Source",
    originalDocument: "Original document",
    verification: "Verification status",
    status: "Status",
    district: "District",
    zone: "Railway zone",
    division: "Division",
    category: "Category",
    length: "Length",
    lastUpdated: "Last updated",
    statusHistory: "Status history",
    demoLabel: "Demo data — not real",
    demoBanner: "This build runs on demo data. No figures here should be treated as fact until replaced with sourced, official information.",
    footerAbout: "About",
    footerSources: "Sources & methodology",
    footerMethodology: "Methodology",
    noResults: "No results found.",
    filterAll: "All",
    rtiArchive: "RTI Archive",
    documentArchive: "Document Archive",
    aboutIssue: "Background",
    approxLength: "Approx. 8 km",
    latestUpdate: "Latest update",
    evidence: "Evidence archive",
    timeline: "Timeline"
  }
};

function getLang() {
  return localStorage.getItem("mrih_lang") || "mr";
}
function setLang(lang) {
  localStorage.setItem("mrih_lang", lang);
  document.documentElement.lang = lang === "mr" ? "mr" : "en";
  renderI18n();
  window.dispatchEvent(new CustomEvent("mrih:langchange"));
}
function t(key) {
  const lang = getLang();
  return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
}
function renderI18n() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
  document.querySelectorAll("[data-lang-btn]").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-lang-btn") === getLang());
  });
  document.documentElement.lang = getLang() === "mr" ? "mr" : "en";
  
}
window.MRIH_I18N = { getLang, setLang, t, renderI18n };
