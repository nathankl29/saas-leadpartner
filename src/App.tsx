import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard, Users, Settings, Plus, Search, ChevronLeft,
  FileText, Package, Trash2, CheckCircle, Clock, MessageSquare,
  Briefcase, PlayCircle, Target, TrendingUp, Calculator, ArrowRight,
  Wallet, PieChart, Globe, Share2, Loader, LogIn, Edit2, Save,
  Wand2, Send, X, Layers, AlertTriangle, Info, Rocket, Calendar as CalendarIcon,
  Mail, Percent, Download, MapPin, Eye, EyeOff, Activity, ShieldCheck,
  Paperclip, Bell, CalendarClock, RefreshCcw, GripHorizontal, Link, Archive
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, setDoc, writeBatch,
} from 'firebase/firestore';
import {
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken,
  signInWithEmailAndPassword, signOut // Remplacement de GoogleAuthProvider
} from 'firebase/auth';

// --- VERSION DU CRM ---
const APP_VERSION = '43.1';

// --- STYLES GLOBAUX & COULEURS DE MARQUE ---
const BRAND_COLOR = '#01189B';

// --- TYPES & INTERFACES ---
interface Product { id: string; name: string; price: number; cost?: number; platform?: string; description?: string; }
interface Contact { 
  id: string; name: string; company: string; email?: string; phone?: string; status: string; 
  address?: string; targetAudience?: string; offeredProducts?: string[];
  projectedBudget?: number; interestedProductId?: string; campaignStartDate?: string | null; createdAt?: string; 
  nextContactDate?: string | null; nextContactNote?: string;
}
interface InvoiceItem { name: string; description?: string; price: number; qty: number; cost?: number; }
interface Invoice { id: string; date: string; clientId: string; clientName: string; clientAddress?: string; status: string; amount: number; items: InvoiceItem[]; }
interface Interaction { id: string; contactId: string; type: string; content: string; createdAt: string; }
interface Simulation { id: string; budget: number; productId: string; productName: string; productPlatform?: string; clientId?: string; clientName?: string; stats: any; createdAt: string; }
interface TargetScenario { id: string; name: string; totalBudget: number; agencyMargin: number; targetCPL: number; currentRealCPL: number; spentBudget: number; remainingDays: number; createdAt: string; }
interface EmailTemplate { id: string; name: string; subject: string; body: string; }
interface AppSettings { 
  companyName: string; companyId: string; address: string; email: string; phone: string; 
  bankDetails: string; invoiceFooter: string; legalNotice: string; primaryColor: string; 
  monthlyGoal: number; dashboardLayout?: string[]; webhookUrl?: string;
  emailTemplates?: EmailTemplate[];
}
interface Notification { id: string; type: 'success' | 'error' | 'info'; message: string; }
interface ConfirmState { isOpen: boolean; title: string; message: string; onConfirm: () => void; }

// --- CONFIGURATION FIREBASE ---
const stackblitzConfig = JSON.parse((window as any).__firebase_config || '{}');
const firebaseConfig = Object.keys(stackblitzConfig).length > 0 ? stackblitzConfig : {
  apiKey: 'AIzaSyDY6zXLeebKhMxL_2_mfQOYV44JuoCArK0',
  authDomain: 'crm-leadpartner.firebaseapp.com',
  projectId: 'crm-leadpartner',
  storageBucket: 'crm-leadpartner.firebasestorage.app',
  messagingSenderId: '588502456936',
  appId: '1:588502456936:web:5c509a0c418f34f77239dd',
};

const RAW_APP_ID = (window as any).__app_id || 'leadpartner-crm-v43-prod';
const APP_ID = RAW_APP_ID.replace(/[^a-zA-Z0-9-_]/g, '_');

let app: any, db: any, auth: any;
try {
  if (firebaseConfig && Object.keys(firebaseConfig).length > 0 && firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  }
} catch (e) {
  console.error('Erreur init Firebase:', e);
}

// --- CONSTANTES ---
const PIPELINE_STAGES = [
  { id: 'nouveau', label: 'Nouveau', color: 'bg-slate-100 border-slate-300 text-slate-700' },
  { id: 'qualification', label: 'Qualification', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { id: 'proposition', label: 'Proposition', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  { id: 'negociation', label: 'Négociation', color: 'bg-orange-50 border-orange-200 text-orange-700' },
  { id: 'gagne', label: 'Gagné (Client)', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { id: 'perdu', label: 'Perdu', color: 'bg-red-50 border-red-200 text-red-700' },
];

const INVOICE_STATUSES: Record<string, { label: string; color: string }> = {
  brouillon: { label: 'Brouillon', color: 'bg-slate-100 text-slate-600' },
  envoyee: { label: 'Envoyée', color: 'bg-blue-100 text-[#01189B]' },
  payee: { label: 'Payée', color: 'bg-emerald-100 text-emerald-600' },
  retard: { label: 'En retard', color: 'bg-orange-100 text-orange-600' },
  archive: { label: 'Archivée', color: 'bg-slate-800 text-white' }, // Nouveau statut
};

const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  { id: 'std', name: 'Standard (Envoi de Facture)', subject: 'Nouvelle Facture {{facture}} - {{agence}}', body: "Bonjour {{client}},\n\nVeuillez trouver ci-joint votre facture {{facture}} d'un montant de {{montant}} concernant nos prestations.\n\nNous restons à votre entière disposition pour toute question.\n\nCordialement,\nL'équipe {{agence}}" },
  { id: 'relance_1', name: 'Relance Aimable', subject: 'Relance : Facture {{facture}} en attente', body: "Bonjour {{client}},\n\nSauf erreur ou omission de notre part, le règlement de la facture {{facture}} d'un montant de {{montant}} ne nous est pas encore parvenu.\n\nNous vous prions de bien vouloir procéder à son règlement.\n\nCordialement,\nL'équipe {{agence}}" }
];

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' });
};

const formatCurrency = (amount?: number) => {
  return new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF', minimumFractionDigits: 2 }).format(Number(amount || 0));
};

// --- COMPOSANT LOGIN ---
const LoginScreen = ({ onLogin, addNotification }: { onLogin: () => void; addNotification: (t: any, m: string) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return addNotification('error', 'Veuillez remplir les champs');
    if (!auth) return addNotification('error', 'Firebase non initialisé.');

    setIsLoggingIn(true);
    try {
      // Tente de connecter l'utilisateur avec l'email et le mot de passe créés dans Firebase
      await signInWithEmailAndPassword(auth, email, password);
      addNotification('success', 'Connexion réussie !');
      onLogin();
    } catch (error: any) {
      console.error(error);
      let errorMsg = 'Échec de la connexion.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMsg = 'Email ou mot de passe incorrect.';
      }
      addNotification('error', errorMsg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
        <div className="p-10 text-center relative overflow-hidden rounded-t-3xl" style={{ backgroundColor: BRAND_COLOR }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <span className="text-3xl font-bold font-poppins" style={{ color: BRAND_COLOR }}>LP</span>
          </div>
          <h1 className="text-2xl font-bold text-white font-poppins tracking-wide">LeadPartner CRM</h1>
          <p className="text-blue-200 text-sm mt-2 font-inter font-medium">Espace Privé <span className="opacity-70 text-xs ml-1 font-mono">v{APP_VERSION}</span></p>
        </div>
        <div className="p-8">
          
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Email autorisé</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="w-full border-2 border-slate-100 bg-slate-50 rounded-xl p-3.5 outline-none focus:border-[#01189B] focus:bg-white transition-colors" 
                placeholder="votre.email@..." 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Mot de passe</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="w-full border-2 border-slate-100 bg-slate-50 rounded-xl p-3.5 outline-none focus:border-[#01189B] focus:bg-white transition-colors" 
                placeholder="••••••••" 
              />
            </div>
            <button 
                type="submit" 
                disabled={isLoggingIn}
                className="w-full text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] mt-4 disabled:opacity-70" 
                style={{ backgroundColor: BRAND_COLOR }}
            >
              {isLoggingIn ? <Loader className="animate-spin" size={20} /> : <LogIn size={20} />}
              {isLoggingIn ? 'Vérification...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// --- COMPOSANT PRINCIPAL ---
export default function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAppAuthenticated, setIsAppAuthenticated] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isSecretMode, setIsSecretMode] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [targetToolState, setTargetToolState] = useState({ scenarioName: 'Nouveau Scénario', totalBudget: 6000, agencyMargin: 35, targetCPL: 80, realCPL: 30, spentBudget: 0, remainingDays: 15, useMargin: true });
  const [scenarios, setScenarios] = useState<TargetScenario[]>([]);

  const [settings, setSettings] = useState<AppSettings>({
    companyName: 'LeadPartner',
    companyId: 'CHE-123.456.789 TVA',
    address: "Genève, Suisse",
    email: 'contact@leadpartner.ch',
    phone: '+41 79 000 00 00',
    bankDetails: 'Banque Cantonale de Genève\nIBAN: CH93 0000 0000 0000 0000 0\nBIC: BCGECHGG',
    invoiceFooter: 'Conditions de paiement : 30 jours net.\nEn cas de retard, des pénalités pourront être appliquées.',
    legalNotice: 'Entreprise individuelle non soumise à la TVA',
    primaryColor: BRAND_COLOR,
    monthlyGoal: 50000,
    dashboardLayout: ['objective', 'stat_ca_month', 'stat_ca_total', 'stat_pipeline', 'stat_campaigns', 'reminders', 'invoices', 'activity'],
    webhookUrl: '', 
    emailTemplates: DEFAULT_EMAIL_TEMPLATES,
  });

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [simulations, setSimulations] = useState<Simulation[]>([]);

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const selectedContact = useMemo(() => contacts.find((c) => c.id === selectedContactId) || null, [contacts, selectedContactId]);

  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editContactData, setEditContactData] = useState<Partial<Contact>>({});
  const [newNoteContent, setNewNoteContent] = useState('');
  
  // États de rappel (Fiche client)
  const [reminderNote, setReminderNote] = useState('');

  const [showModal, setShowModal] = useState<string | null>(null);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentInvoice, setCurrentInvoice] = useState<Partial<Invoice> | null>(null);
  const [contactFilterType, setContactFilterType] = useState('all');

  const [invoiceBudget, setInvoiceBudget] = useState<number | string>('');
  const [invoiceThemeId, setInvoiceThemeId] = useState('');
  const [invoiceMarginPercent, setInvoiceMarginPercent] = useState(35);

  const [planBudget, setPlanBudget] = useState(1000);
  const [planProductId, setPlanProductId] = useState('');
  const [planClientId, setPlanClientId] = useState('');

  // Modale d'envoi d'email
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailData, setEmailData] = useState({ to: '', subject: '', body: '', isSending: false, selectedTemplate: 'std' });

  // Settings Tabs
  const [settingsActiveTab, setSettingsActiveTab] = useState('general');

  const hasCheckedDefaults = useRef(false);

  // --- WRAPPERS MODE SECRET ---
  const renderCurrency = (amount?: number) => isSecretMode ? 'CHF ****' : formatCurrency(amount);
  const renderNumber = (num?: number | string) => isSecretMode ? '****' : num;

  // --- HELPERS UI ---
  const addNotification = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 4000);
  };

  const openConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmState({ isOpen: true, title, message, onConfirm: () => { onConfirm(); setConfirmState((prev) => ({ ...prev, isOpen: false })); } });
  };

  // --- AUTH ---
  useEffect(() => {
    const initAuth = async () => {
      if (!auth) {
        setIsOfflineMode(true); setUser({ uid: 'offline', email: 'demo@offline' }); setLoading(false); return;
      }
      if ((window as any).__initial_auth_token) {
        await signInWithCustomToken(auth, (window as any).__initial_auth_token);
      } else {
        try { await signInAnonymously(auth); } catch (e) {
          setIsOfflineMode(true); setUser({ uid: 'offline', email: 'demo@offline' });
        }
      }
    };
    initAuth();
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (u) => {
        if (u) { setUser(u); setIsOfflineMode(false); }
        setLoading(false);
      });
      return () => unsubscribe();
    } else setLoading(false);
  }, []);

  // --- SYNC DB & AUTO-SEED PRODUCTS/CONTACTS ---
  useEffect(() => {
    if (!user || isOfflineMode || !db) return;
    const basePath = `artifacts/${APP_ID}/users/${user.uid}`;
    try {
      const unsubs = [
        onSnapshot(collection(db, `${basePath}/contacts`), (s: any) => {
          const loadedContacts = s.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          if (s.empty) {
             const fakeClient = {
                name: 'Elon Musk', company: 'Tesla Suisse SA', email: 'elon@tesla.com', phone: '+41 79 123 45 67', status: 'gagne', projectedBudget: 15000, createdAt: new Date().toISOString()
             };
             addDoc(collection(db, `${basePath}/contacts`), fakeClient).then(() => console.log('Client de test généré.'));
          } else {
             setContacts(loadedContacts);
          }
        }),
        
        onSnapshot(collection(db, `${basePath}/products`), (s: any) => {
          const loadedProducts = s.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          if (s.empty && !hasCheckedDefaults.current) {
            hasCheckedDefaults.current = true;
            const batch = writeBatch(db);
            const defaultProds = [
              { name: '3P Meta', price: 80, cost: 30, platform: 'meta', description: 'Leads 3ème Pilier générés via Facebook/Instagram Ads.' },
              { name: 'LPP Meta', price: 90, cost: 35, platform: 'meta', description: 'Leads LPP générés via Facebook/Instagram Ads.' },
              { name: 'CMU LAMal Meta', price: 70, cost: 25, platform: 'meta', description: 'Leads Frontaliers CMU/LAMal via Meta Ads.' },
              { name: 'LPP Google', price: 120, cost: 50, platform: 'google', description: 'Leads LPP ultra-qualifiés générés via Google Search.' }
            ];
            defaultProds.forEach(p => {
              const docRef = doc(collection(db, `${basePath}/products`));
              batch.set(docRef, p);
            });
            batch.commit().then(() => console.log('Produits par défaut créés.'));
          } else {
            setProducts(loadedProducts);
            hasCheckedDefaults.current = true;
          }
        }),

        onSnapshot(collection(db, `${basePath}/invoices`), (s: any) => setInvoices(s.docs.map((d: any) => ({ id: d.id, ...d.data() })))),
        onSnapshot(collection(db, `${basePath}/interactions`), (s: any) => setInteractions(s.docs.map((d: any) => ({ id: d.id, ...d.data() })))),
        onSnapshot(collection(db, `${basePath}/simulations`), (s: any) => setSimulations(s.docs.map((d: any) => ({ id: d.id, ...d.data() })))),
        onSnapshot(collection(db, `${basePath}/target_scenarios`), (s: any) => setScenarios(s.docs.map((d: any) => ({ id: d.id, ...d.data() })))),
        onSnapshot(doc(db, `${basePath}/config`, 'general'), (s: any) => { 
            if (s.exists()) {
                const data = s.data();
                // Assurer que les templates existent toujours
                if (!data.emailTemplates || data.emailTemplates.length === 0) {
                    data.emailTemplates = DEFAULT_EMAIL_TEMPLATES;
                }
                setSettings((prev) => ({ ...prev, ...data })); 
            }
        }),
      ];
      return () => unsubs.forEach((u) => u());
    } catch (e) { setIsOfflineMode(true); }
  }, [user, isOfflineMode]);

  // --- FILTRES & STATS ---
  const displayedContacts = useMemo(() => {
    let filtered = contacts.filter((c) => c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.company?.toLowerCase().includes(searchTerm.toLowerCase()));
    if (contactFilterType === 'client') filtered = filtered.filter((c) => c.status === 'gagne');
    else if (contactFilterType === 'prospect') filtered = filtered.filter((c) => c.status !== 'gagne' && c.status !== 'perdu');
    return filtered;
  }, [contacts, searchTerm, contactFilterType]);

  const stats = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthInvoices = invoices.filter((i) => { const d = new Date(i.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; });
    const totalPaidInvoices = invoices.reduce((acc, i) => (i.status === 'payee' ? acc + Number(i.amount ?? 0) : acc), 0);
    const monthlyInvoicesAmount = monthInvoices.reduce((acc, i) => acc + Number(i.amount ?? 0), 0);
    const totalSimulations = simulations.reduce((acc, s) => acc + Number(s.budget ?? 0), 0);
    const monthSimulations = simulations.filter((s) => { const d = new Date(s.createdAt); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; });
    const monthlySimulationsAmount = monthSimulations.reduce((acc, s) => acc + Number(s.budget ?? 0), 0);

    return {
      caMensuel: monthlyInvoicesAmount + monthlySimulationsAmount,
      caTotal: totalPaidInvoices + totalSimulations,
      pipelineValue: contacts.reduce((acc, c) => c.status !== 'gagne' && c.status !== 'perdu' ? acc + Number(c.projectedBudget ?? 0) : acc, 0),
      activeCampaigns: simulations.length,
    };
  }, [invoices, contacts, simulations]);

  // --- ACTIONS ---
  const handleCreate = async (col: string, data: any) => {
    if (isOfflineMode) return addNotification('error', 'Mode hors-ligne : Sauvegarde impossible');
    if (!user) return;
    try {
      await addDoc(collection(db, `artifacts/${APP_ID}/users/${user.uid}/${col}`), { ...data, createdAt: new Date().toISOString() });
      setShowModal(null);
      addNotification('success', 'Élément créé avec succès');
    } catch (e) { addNotification('error', 'Erreur lors de la création'); }
  };

  const handleUpdate = async (col: string, id: string, data: any) => {
    if (isOfflineMode || !user) return;
    try {
      await updateDoc(doc(db, `artifacts/${APP_ID}/users/${user.uid}/${col}`, id), data);
      addNotification('success', 'Mise à jour effectuée');
    } catch (e) { addNotification('error', 'Erreur de mise à jour'); }
  };

  const handleDelete = async (col: string, id: string) => {
    if (isOfflineMode || !user) return;
    openConfirm("Supprimer l'élément ?", 'Cette action est irréversible.', async () => {
      try {
        await deleteDoc(doc(db, `artifacts/${APP_ID}/users/${user.uid}/${col}`, id));
        if (col === 'contacts' && selectedContactId === id) setSelectedContactId(null);
        if (col === 'invoices') setShowModal(null); // Close invoice modal if open
        addNotification('success', 'Suppression réussie');
      } catch (e) { addNotification('error', 'Erreur de suppression'); }
    });
  };

  const handleDeleteInvoice = async () => {
      if (!currentInvoice?.id) return;
      handleDelete('invoices', currentInvoice.id);
  };

  const handleSaveProductForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = { name: fd.get('name'), price: Number(fd.get('price')), cost: Number(fd.get('cost')), platform: fd.get('platform'), description: fd.get('description') };
    if (currentProduct && currentProduct.id) await handleUpdate('products', currentProduct.id, data);
    else await handleCreate('products', data);
    setShowModal(null); setCurrentProduct(null);
  };

  const handleSaveContactEdit = async () => {
    if (!selectedContactId || !user) return;
    await handleUpdate('contacts', selectedContactId, editContactData);
    setIsEditingContact(false);
  };

  const handleAddQuickNote = async () => {
    if (!selectedContactId || !newNoteContent.trim() || !user) return;
    await handleCreate('interactions', { contactId: selectedContactId, type: 'note', content: newNoteContent });
    setNewNoteContent('');
  };

  const handleSetReminder = async (days: number) => {
      if (!selectedContactId || !user) return;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      
      await handleUpdate('contacts', selectedContactId, {
          nextContactDate: targetDate.toISOString(),
          nextContactNote: reminderNote || `Relance planifiée (J+${days})`
      });
      setReminderNote('');
  };

  const handleClearReminder = async () => {
      if (!selectedContactId || !user) return;
      await handleUpdate('contacts', selectedContactId, {
          nextContactDate: null,
          nextContactNote: ''
      });
  };

  const generateNextInvoiceId = () => {
    if (invoices.length === 0) return 'FAC-0001';
    let max = 0;
    invoices.forEach(inv => {
      if (inv.id && inv.id.startsWith('FAC-')) {
         const num = parseInt(inv.id.replace('FAC-', ''), 10);
         if (!isNaN(num) && num > max) max = num;
      }
    });
    return `FAC-${String(max + 1).padStart(4, '0')}`;
  };

  const handleSaveSimulation = async (simStats: any) => {
    if (!user) return;
    const activeProduct = products.find((p) => p.id === planProductId);
    if (!activeProduct) return;
    const activeClient = contacts.find((c) => c.id === planClientId);
    const simData: Omit<Simulation, 'id'> = { budget: planBudget, productId: planProductId, productName: activeProduct.name, productPlatform: activeProduct.platform, clientId: planClientId, clientName: activeClient ? activeClient.company : 'Client Inconnu', stats: simStats, createdAt: new Date().toISOString() };
    await addDoc(collection(db, `artifacts/${APP_ID}/users/${user.uid}/simulations`), simData);
    addNotification('success', 'Production média activée dans vos cycles.');
  };

  const handleSaveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const newSettings = {
      ...settings,
      companyName: fd.get('companyName') || settings.companyName, 
      companyId: fd.get('companyId') || settings.companyId, 
      address: fd.get('address') || settings.address, 
      email: fd.get('email') || settings.email, 
      phone: fd.get('phone') || settings.phone, 
      bankDetails: fd.get('bankDetails') || settings.bankDetails, 
      invoiceFooter: fd.get('invoiceFooter') || settings.invoiceFooter, 
      legalNotice: fd.get('legalNotice') || settings.legalNotice, 
      monthlyGoal: Number(fd.get('monthlyGoal')) || settings.monthlyGoal, 
      webhookUrl: fd.get('webhookUrl') || settings.webhookUrl, 
      primaryColor: BRAND_COLOR,
    };
    await setDoc(doc(db, `artifacts/${APP_ID}/users/${user.uid}/config`, 'general'), newSettings);
    setSettings(newSettings as AppSettings);
    addNotification('success', 'Paramètres sauvegardés !');
  };

  const handleSaveSettingsDirect = async (newSettingsObj: Partial<AppSettings>) => {
      if (!user) return;
      const updated = { ...settings, ...newSettingsObj };
      await setDoc(doc(db, `artifacts/${APP_ID}/users/${user.uid}/config`, 'general'), updated);
      setSettings(updated as AppSettings);
      addNotification('success', 'Modèles mis à jour !');
  }

  const handleGenerateInvoice = () => {
    if (!invoiceBudget) return addNotification('error', 'Veuillez saisir un budget pour générer les lignes.');
    const theme = products.find((p) => p.id === invoiceThemeId);
    const budget = Number(invoiceBudget);
    const margin = Number(invoiceMarginPercent) / 100;
    const mediaBudget = budget * (1 - margin);
    const mgtFees = budget * margin;
    
    const newItems = [
      { 
        name: `Budget Net Investi en Média`, 
        description: `Génération de leads qualifiés - Thématique : ${theme?.name || 'Générique'}\nPlateforme de diffusion : ${theme?.platform || 'Mix Media'}.`,
        price: mediaBudget, qty: 1 
      },
      { 
        name: `Frais de Gestion & Optimisation`, 
        description: `Création des campagnes, A/B testing, gestion des enchères et optimisation continue du CPL (${invoiceMarginPercent}% du budget).`,
        price: mgtFees, qty: 1 
      },
    ];
    setCurrentInvoice({ ...(currentInvoice || {}), items: [...(currentInvoice?.items || []), ...newItems] } as Invoice);
    addNotification('success', 'Lignes calculées et ajoutées.');
  };

  const handleSaveInvoice = async () => {
    if (!user || !currentInvoice || (!currentInvoice.clientId && !currentInvoice.clientName)) return addNotification('error', 'Veuillez renseigner ou lier un client.');
    const cleanInvoiceData = JSON.parse(JSON.stringify(currentInvoice));
    const amount = (cleanInvoiceData.items || []).reduce((acc: number, item: any) => acc + Number(item.price) * (item.qty || 1), 0);
    const invData = { ...cleanInvoiceData, amount, clientName: cleanInvoiceData.clientName || 'Client Inconnu' };
    try {
      await setDoc(doc(db, `artifacts/${APP_ID}/users/${user.uid}/invoices`, invData.id), invData);
      setShowModal(null); addNotification('success', 'Facture sauvegardée avec succès');
    } catch (e) { addNotification('error', 'Erreur lors de la sauvegarde'); }
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('invoice-printable');
    if (!element) return;
    
    const opt = {
      margin:       0,
      filename:     `Facture_${currentInvoice?.clientName || 'LeadPartner'}.pdf`,
      image:        { type: 'jpeg', quality: 1 },
      html2canvas:  { 
          scale: 2, 
          useCORS: true,
          scrollY: 0,
          onclone: (doc: any) => {
              const elements = doc.querySelectorAll('.no-print');
              elements.forEach((el: any) => {
                  el.style.display = 'none';
              });
              const textareas = doc.querySelectorAll('textarea.print-input');
              textareas.forEach((el: any) => {
                  el.style.height = el.scrollHeight + 'px';
              });
          }
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if ((window as any).html2pdf) {
      (window as any).html2pdf().set(opt).from(element).save();
    } else {
      addNotification('info', 'Chargement du moteur PDF...');
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => {
        (window as any).html2pdf().set(opt).from(element).save();
      };
      document.body.appendChild(script);
    }
  };

  // --- GESTION DES EMAILS & TEMPLATES ---
  const applyEmailTemplate = (templateId: string, invoice: Partial<Invoice>, clientEmail: string) => {
      const template = (settings.emailTemplates || []).find(t => t.id === templateId) || settings.emailTemplates?.[0];
      if (!template) return;

      const invId = invoice.id || 'N/A';
      const amount = formatCurrency(invoice.amount || 0);
      const company = settings.companyName;
      const clientName = invoice.clientName || 'Client';

      // Remplacement des variables dynamiques
      const replaceVars = (str: string) => {
          return str
            .replace(/\{\{facture\}\}/g, invId)
            .replace(/\{\{montant\}\}/g, amount)
            .replace(/\{\{agence\}\}/g, company)
            .replace(/\{\{client\}\}/g, clientName);
      };

      setEmailData({ 
          to: clientEmail, 
          subject: replaceVars(template.subject), 
          body: replaceVars(template.body), 
          isSending: false, 
          selectedTemplate: template.id 
      });
  };

  const handleEmailInvoice = () => {
      if (!currentInvoice) return addNotification('error', 'Erreur facture.');
      const clientEmail = contacts.find(c => c.id === currentInvoice.clientId)?.email || '';
      
      applyEmailTemplate(settings.emailTemplates?.[0]?.id || 'std', currentInvoice, clientEmail);
      setShowEmailModal(true);
  };

  const handleSendEmailFromModal = async () => {
    if (!emailData.to) return addNotification('error', 'Veuillez renseigner une adresse email valide.');
    if (!settings.webhookUrl) return addNotification('error', 'URL du Webhook non configurée dans les paramètres.');
    
    setEmailData(prev => ({ ...prev, isSending: true }));
    
    try {
        const element = document.getElementById('invoice-printable');
        if (!element) throw new Error("Document HTML introuvable");

        const opt = {
          margin: 0,
          filename: `Facture_${currentInvoice?.id}.pdf`,
          image: { type: 'jpeg', quality: 1 },
          html2canvas: { scale: 2, useCORS: true, scrollY: 0,
              onclone: (doc: any) => {
                const elements = doc.querySelectorAll('.no-print');
                elements.forEach((el: any) => { el.style.display = 'none'; });
                const textareas = doc.querySelectorAll('textarea.print-input');
                textareas.forEach((el: any) => { el.style.height = el.scrollHeight + 'px'; });
              }
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        if (!(window as any).html2pdf) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.body.appendChild(script);
            });
        }

        // Extraction sécurisée du PDF
        const rawPdfBase64 = await new Promise<string>((resolve) => {
             (window as any).html2pdf().set(opt).from(element).toPdf().get('pdf').then((pdf: any) => {
                  resolve(pdf.output('datauristring'));
             });
        });
        
        // Nettoyage strict du préfixe pour envoyer uniquement le code pur du fichier à Make.com
        const cleanBase64 = rawPdfBase64.includes('base64,') ? rawPdfBase64.substring(rawPdfBase64.indexOf('base64,') + 7) : rawPdfBase64;

        // Conversion des sauts de ligne textuels en balises HTML <br> pour l'affichage email
        const formattedMessage = emailData.body.replace(/\n/g, '<br>');

        const payload = {
            to_email: emailData.to,
            subject: emailData.subject,
            message: formattedMessage,
            reply_to: settings.email,
            invoice_id: currentInvoice?.id || 'Facture',
            client_name: currentInvoice?.clientName || 'Client',
            pdf_attachment_base64: cleanBase64
        };

        const response = await fetch(settings.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            addNotification('success', `La facture a été transmise à votre outil d'automatisation.`);
            setShowEmailModal(false);
        } else {
            throw new Error("Erreur de réponse du Webhook");
        }
    } catch (error) {
        console.error("Erreur d'envoi:", error);
        addNotification('error', "Échec de l'envoi. Vérifiez l'URL de votre Webhook.");
    } finally {
        setEmailData(prev => ({ ...prev, isSending: false }));
    }
  };

  const handleSaveTargetScenario = async () => {
      if(!user) return;
      const data: Omit<TargetScenario, 'id'> = { name: targetToolState.scenarioName || 'Scénario', totalBudget: targetToolState.totalBudget, agencyMargin: targetToolState.agencyMargin, targetCPL: targetToolState.targetCPL, currentRealCPL: targetToolState.realCPL, spentBudget: targetToolState.spentBudget, remainingDays: targetToolState.remainingDays, createdAt: new Date().toISOString() };
      try {
          await addDoc(collection(db, `artifacts/${APP_ID}/users/${user.uid}/target_scenarios`), data);
          addNotification('success', 'Scénario sauvegardé');
      } catch(e) { addNotification('error', 'Erreur sauvegarde scénario'); }
  }

  const handleExportData = () => {
      const exportData = {
          exportDate: new Date().toISOString(),
          appId: APP_ID,
          userId: user?.uid,
          data: { settings, contacts, products, invoices, interactions, simulations, scenarios }
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_leadpartner_crm_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addNotification('success', 'Export de vos données réussi !');
  };

  // --- RENDERERS (Vues de l'application) ---

  const renderContactDetail = () => {
    if (!selectedContact) return null;
    const contactInteractions = interactions.filter(i => i.contactId === selectedContact.id).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Calculs pour la fiche client
    const clientInvoices = invoices.filter(inv => inv.clientId === selectedContact.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const caEncaisse = clientInvoices.filter(i => i.status === 'payee').reduce((acc, i) => acc + i.amount, 0);
    const clientSimulations = simulations.filter(s => s.clientId === selectedContact.id);
    const beneficeEstime = clientSimulations.reduce((acc, s) => acc + (s.stats?.profit || 0), 0);

    // Analyse du rappel (Reminder)
    const hasReminder = !!selectedContact.nextContactDate;
    const isReminderDue = hasReminder && new Date(selectedContact.nextContactDate!) <= new Date();

    return (
      <div className="flex flex-col h-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden animate-fade-in border border-slate-100">
        
        {/* BANNIÈRE DE RAPPEL */}
        {hasReminder && (
            <div className={`px-8 py-3 flex justify-between items-center text-sm font-bold shrink-0 ${isReminderDue ? 'bg-red-500 text-white' : 'bg-orange-100 text-orange-800'}`}>
                <div className="flex items-center gap-2">
                    <Bell size={18} className={isReminderDue ? 'animate-bounce' : ''} />
                    <span>
                        {isReminderDue ? 'Rappel Échu : ' : 'Rappel Planifié : '}
                        {selectedContact.nextContactNote} (Pour le {formatDate(selectedContact.nextContactDate!)})
                    </span>
                </div>
                <button onClick={handleClearReminder} className={`px-3 py-1 rounded-lg text-xs transition-colors ${isReminderDue ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-200 hover:bg-orange-300'}`}>
                    Marquer comme fait
                </button>
            </div>
        )}

        {/* Header Contact */}
        <div className="p-8 border-b border-slate-100 bg-white/50 backdrop-blur-sm flex justify-between items-start relative shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl opacity-50 pointer-events-none -mr-20 -mt-20"></div>
          <div className="flex gap-6 relative z-10">
            <button onClick={() => setSelectedContactId(null)} className="mt-1 p-3 bg-white border border-slate-200 shadow-sm rounded-xl hover:bg-slate-50 transition-colors text-slate-500 h-fit">
              <ChevronLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-4 mb-2">
                <h2 className="text-4xl font-extrabold font-poppins text-slate-800 tracking-tight">{selectedContact.company}</h2>
                <span className={`px-4 py-1.5 text-xs font-bold rounded-xl border shadow-sm ${PIPELINE_STAGES.find(s => s.id === selectedContact.status)?.color}`}>
                  {PIPELINE_STAGES.find(s => s.id === selectedContact.status)?.label}
                </span>
              </div>
              <p className="text-slate-500 flex items-center gap-2 font-medium text-lg"><Users size={20}/> {selectedContact.name}</p>
              {selectedContact.address && <p className="text-slate-400 flex items-center gap-2 font-medium mt-1 text-sm"><MapPin size={16}/> {selectedContact.address}</p>}

              <div className="flex flex-wrap gap-2 mt-5">
                  {selectedContact.targetAudience && (
                      <span className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                          <Target size={14}/> {selectedContact.targetAudience}
                      </span>
                  )}
                  {(selectedContact.offeredProducts || []).map(p => (
                      <span key={p} className="px-3 py-1.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                          <Package size={14}/> {p}
                      </span>
                  ))}
              </div>
              
              <div className="flex items-center gap-6 mt-6 text-sm font-bold text-slate-600">
                {selectedContact.email && <a href={`mailto:${selectedContact.email}`} className="flex items-center gap-2 hover:text-[#01189B] transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><Mail size={16}/> {selectedContact.email}</a>}
                {selectedContact.phone && <a href={`tel:${selectedContact.phone}`} className="flex items-center gap-2 hover:text-[#01189B] transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">📞 {selectedContact.phone}</a>}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 relative z-10">
            <button onClick={() => { setEditContactData(selectedContact); setIsEditingContact(true); }} className="px-6 py-3 bg-white border border-slate-200 shadow-sm rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
              <Edit2 size={16}/> Modifier Profil
            </button>
            <button onClick={() => handleDelete('contacts', selectedContact.id)} className="px-6 py-3 bg-white border border-slate-200 shadow-sm rounded-xl font-bold text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
              <Trash2 size={16}/> Supprimer Client
            </button>
            {selectedContact.email && (
               <a href={`mailto:${selectedContact.email}`} className="px-6 py-3 text-white rounded-xl font-bold hover:shadow-lg hover:-translate-y-0.5 flex items-center justify-center gap-2 transition-all" style={{ backgroundColor: BRAND_COLOR }}>
                 <Send size={16}/> Écrire Email
               </a>
            )}
          </div>
        </div>

        {/* Panneau d'édition (si actif) */}
        {isEditingContact && (
          <div className="p-8 bg-slate-50 border-b border-slate-200 shadow-inner animate-fade-in z-20 relative shrink-0 overflow-y-auto max-h-[50vh] custom-scrollbar">
             <div className="flex justify-between items-center mb-6">
                 <h4 className="font-bold text-slate-800 font-poppins text-lg flex items-center gap-2"><Settings size={20}/> Mode Édition</h4>
                 <button onClick={() => setIsEditingContact(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Société</label><input className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-[#01189B] outline-none mt-1 transition-colors" value={editContactData.company} onChange={e => setEditContactData({...editContactData, company: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Contact</label><input className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-[#01189B] outline-none mt-1 transition-colors" value={editContactData.name} onChange={e => setEditContactData({...editContactData, name: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email</label><input className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-[#01189B] outline-none mt-1 transition-colors" value={editContactData.email} onChange={e => setEditContactData({...editContactData, email: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Téléphone</label><input className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-[#01189B] outline-none mt-1 transition-colors" value={editContactData.phone} onChange={e => setEditContactData({...editContactData, phone: e.target.value})} /></div>
                <div className="md:col-span-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Adresse complète (Facturation)</label><textarea className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-[#01189B] outline-none mt-1 transition-colors resize-none h-14" value={editContactData.address || ''} onChange={e => setEditContactData({...editContactData, address: e.target.value})} /></div>

                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Statut Pipeline</label>
                  <select className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-[#01189B] outline-none mt-1 font-bold text-[#01189B] transition-colors" value={editContactData.status} onChange={e => setEditContactData({...editContactData, status: e.target.value})}>
                    {PIPELINE_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Intérêt Principal (Campagne)</label>
                  <select className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-[#01189B] outline-none mt-1 font-medium text-slate-700 transition-colors" value={editContactData.interestedProductId || ''} onChange={e => setEditContactData({...editContactData, interestedProductId: e.target.value})}>
                    <option value="">-- Non défini --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="col-span-1 md:col-span-2 lg:col-span-3 pt-4 border-t border-slate-200">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Audience Ciblée par ce client</label>
                    <div className="flex gap-3 mt-3">
                        {['Résident', 'Frontalier', 'Les deux'].map(aud => (
                            <button
                                key={aud} type="button" onClick={() => setEditContactData({...editContactData, targetAudience: aud})}
                                className={`px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${editContactData.targetAudience === aud ? 'border-[#01189B] bg-blue-50 text-[#01189B] shadow-sm' : 'border-slate-200 text-slate-500 bg-white hover:border-slate-300'}`}
                            >
                                {aud}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="col-span-1 md:col-span-2 lg:col-span-3">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Services & Produits vendus par ce client</label>
                    <div className="flex flex-wrap gap-2 mt-3">
                        {['LAMal', 'LCA', '3ème Pilier', 'LPP', 'Prévoyance', 'Assurance Vie', 'Hypothèque', 'Fiscalité'].map(prod => {
                            const isActive = (editContactData.offeredProducts || []).includes(prod);
                            return (
                                <button
                                    key={prod} type="button"
                                    onClick={() => {
                                        const current = editContactData.offeredProducts || [];
                                        setEditContactData({ ...editContactData, offeredProducts: isActive ? current.filter(p => p !== prod) : [...current, prod] });
                                    }}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all shadow-sm ${isActive ? 'bg-[#01189B] text-white border-[#01189B]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}
                                >
                                    {isActive ? '✓ ' : '+ '}{prod}
                                </button>
                            )
                        })}
                    </div>
                </div>

             </div>
             <div className="flex gap-4 justify-end mt-6 pt-6 border-t border-slate-200">
               <button onClick={handleSaveContactEdit} className="px-8 py-3.5 text-white rounded-xl font-bold hover:opacity-90 shadow-md transition-opacity" style={{ backgroundColor: BRAND_COLOR }}>Mettre à jour la fiche</button>
             </div>
          </div>
        )}

        {/* Contenu principal divisé en deux colonnes */}
        <div className="flex-1 overflow-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 bg-slate-50/50">
          
          {/* Colonne Gauche: Outils & Stats */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* WIDGET : PROGRAMMER UN RAPPEL */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
                <h4 className="font-extrabold text-slate-800 mb-4 font-poppins text-lg flex items-center gap-2"><CalendarClock className="text-orange-500" size={20}/> Programmer un Rappel</h4>
                <div className="space-y-4">
                    <input 
                        type="text" 
                        placeholder="Ex: Rappeler pour faire le point..." 
                        value={reminderNote}
                        onChange={e => setReminderNote(e.target.value)}
                        className="w-full text-sm border-2 border-slate-100 bg-slate-50 p-3 rounded-xl outline-none focus:border-orange-400 focus:bg-white transition-colors"
                    />
                    <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => handleSetReminder(7)} className="py-2 text-[10px] font-bold uppercase tracking-wide bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 border border-orange-100 transition-colors">+ 1 Sem.</button>
                        <button onClick={() => handleSetReminder(30)} className="py-2 text-[10px] font-bold uppercase tracking-wide bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 border border-orange-100 transition-colors">+ 1 Mois</button>
                        <button onClick={() => handleSetReminder(90)} className="py-2 text-[10px] font-bold uppercase tracking-wide bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 border border-orange-100 transition-colors">+ 3 Mois</button>
                    </div>
                </div>
            </div>

            {/* WIDGET : FINANCES POTENTIELLES */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
               <h4 className="font-extrabold text-slate-800 mb-5 font-poppins text-lg flex items-center gap-2"><Wallet size={20} className="text-slate-400"/> Finances (Potentiel)</h4>
               <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Budget Mensuel Alloué (CHF)</label>
                  <div className="relative mt-2">
                     <Wallet className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                     <input 
                       type="number" 
                       value={selectedContact.projectedBudget || ''} 
                       onChange={e => handleUpdate('contacts', selectedContact.id, { projectedBudget: Number(e.target.value) })}
                       className="w-full border-2 border-slate-100 bg-slate-50 p-3 pl-12 rounded-xl font-extrabold text-xl outline-none focus:border-[#01189B] focus:bg-white transition-all text-slate-800"
                       placeholder="0.00"
                       onBlur={() => addNotification('success', 'Budget mis à jour')}
                     />
                  </div>
               </div>
               <div className="mt-5 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-xs font-bold text-[#01189B] mb-2 uppercase tracking-wide">Action Rapide</p>
                  <button onClick={() => { setPlanClientId(selectedContact.id); setActiveView('projections'); setSelectedContactId(null); }} className="w-full py-2.5 bg-white border border-blue-200 text-[#01189B] font-bold rounded-lg hover:shadow-sm transition-all text-sm flex items-center justify-center gap-2"><PlayCircle size={16}/> Lancer Production Média</button>
               </div>
            </div>

            {/* WIDGET : VALEUR RÉELLE CLIENT LTV */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
               <h4 className="font-extrabold text-slate-800 mb-5 font-poppins text-lg flex items-center gap-2"><TrendingUp size={20} className="text-emerald-500"/> Valeur Réelle Client</h4>
               <div className="space-y-4">
                 <div className="flex justify-between items-center p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">CA Encaissé (Facturé)</span>
                    <span className="font-extrabold text-emerald-600 font-mono text-xl">{renderCurrency(caEncaisse)}</span>
                 </div>
                 <div className="flex justify-between items-center p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                    <span className="text-xs font-bold text-[#01189B] uppercase tracking-wide">Bénéfice Net (Est.)</span>
                    <span className="font-extrabold text-[#01189B] font-mono text-xl">{renderCurrency(beneficeEstime)}</span>
                 </div>
               </div>
            </div>

            {/* WIDGET : HISTORIQUE FACTURES */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
               <h4 className="font-extrabold text-slate-800 mb-4 font-poppins text-lg flex items-center gap-2"><FileText size={18} className="text-slate-400"/> Factures Associées</h4>
               {clientInvoices.length === 0 ? (
                 <p className="text-xs text-slate-400 italic text-center py-4">Aucune facture émise pour ce client.</p>
               ) : (
                 <div className="space-y-3">
                   {clientInvoices.map(inv => (
                     <div key={inv.id} onClick={() => { setCurrentInvoice(inv); setShowModal('invoice'); }} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer hover:border-[#01189B] hover:bg-white shadow-sm transition-all group">
                        <div>
                          <p className="font-bold text-slate-700 text-sm group-hover:text-[#01189B] transition-colors">{inv.id}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{formatDate(inv.date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-slate-800 text-sm">{renderCurrency(inv.amount)}</p>
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${INVOICE_STATUSES[inv.status]?.color || 'bg-slate-200 text-slate-600'}`}>{INVOICE_STATUSES[inv.status]?.label || inv.status}</span>
                        </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>

          </div>

          {/* Colonne Droite: Notes et Historique */}
          <div className="lg:col-span-2 flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
             <div className="p-6 border-b border-slate-100 bg-white flex justify-between items-center">
                 <h4 className="font-extrabold text-slate-800 flex items-center gap-2 font-poppins text-lg">
                    <MessageSquare size={20} style={{ color: BRAND_COLOR }} /> Historique & Compte-Rendus
                 </h4>
                 <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{contactInteractions.length} note(s)</span>
             </div>
             
             <div className="flex-1 overflow-auto p-6 space-y-6 bg-slate-50/50 custom-scrollbar">
                {contactInteractions.length === 0 ? (
                  <div className="text-center text-slate-400 italic mt-16 flex flex-col items-center justify-center">
                     <div className="w-20 h-20 bg-white border border-slate-100 shadow-sm rounded-full flex items-center justify-center mb-4"><MessageSquare size={32} className="text-slate-300"/></div>
                     <p className="font-bold text-slate-600 mb-1">Aucune note pour le moment.</p>
                     <p className="text-sm">Enregistrez le résumé de votre premier appel !</p>
                  </div>
                ) : (
                  contactInteractions.map(interaction => (
                    <div key={interaction.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative group hover:border-[#01189B] transition-colors">
                       <button onClick={() => handleDelete('interactions', interaction.id)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 p-1.5 rounded-lg">
                         <Trash2 size={16}/>
                       </button>
                       <div className="flex items-center gap-2 mb-3">
                           <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center"><Clock size={14} style={{ color: BRAND_COLOR }}/></div>
                           <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">{formatDateTime(interaction.createdAt)}</p>
                       </div>
                       <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed pl-10">{interaction.content}</p>
                    </div>
                  ))
                )}
             </div>

             <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-10px_30px_rgb(0,0,0,0.02)] relative z-10">
                <div className="relative">
                  <textarea 
                    value={newNoteContent} 
                    onChange={e => setNewNoteContent(e.target.value)} 
                    placeholder="Saisissez le compte-rendu du rendez-vous, une info importante..."
                    className="w-full border-2 border-slate-200 bg-slate-50 rounded-xl p-4 pr-16 h-28 outline-none focus:border-[#01189B] focus:bg-white resize-none text-sm transition-colors shadow-inner"
                  />
                  <button onClick={handleAddQuickNote} className="absolute bottom-4 right-4 p-3 text-white rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50" style={{ backgroundColor: BRAND_COLOR }} disabled={!newNoteContent.trim()}>
                    <Send size={18}/>
                  </button>
                </div>
             </div>
          </div>

        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    // ... [Code inchangé, voir structure globale pour Dashboard, Calendar, Projections]
    const goal = settings.monthlyGoal || 50000;
    const progressGoal = Math.min((stats.caMensuel / goal) * 100, 100);

    const recentActivity = [...interactions]
      .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    const recentInvoices = [...invoices]
      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 4);

    const activeReminders = contacts
      .filter(c => c.nextContactDate)
      .sort((a,b) => new Date(a.nextContactDate!).getTime() - new Date(b.nextContactDate!).getTime())
      .slice(0, 5);

    const defaultLayout = ['objective', 'stat_ca_month', 'stat_ca_total', 'stat_pipeline', 'stat_campaigns', 'reminders', 'invoices', 'activity'];
    let currentLayout = settings.dashboardLayout && settings.dashboardLayout.length > 0 ? settings.dashboardLayout : defaultLayout;
    
    // Injection automatique du nouveau widget si l'utilisateur a un ancien layout sauvegardé
    if (!currentLayout.includes('reminders')) {
        currentLayout = [...currentLayout, 'reminders'];
    }

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('widget_id', id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('widget_id');
        if (!draggedId || draggedId === targetId) return;

        const newLayout = [...currentLayout];
        const draggedIndex = newLayout.indexOf(draggedId);
        const targetIndex = newLayout.indexOf(targetId);

        newLayout.splice(draggedIndex, 1);
        newLayout.splice(targetIndex, 0, draggedId);

        setSettings(prev => ({ ...prev, dashboardLayout: newLayout }));
        
        if (user && !isOfflineMode) {
            try {
                await setDoc(doc(db, `artifacts/${APP_ID}/users/${user.uid}/config`, 'general'), { dashboardLayout: newLayout }, { merge: true });
            } catch(err) {
                console.error("Erreur save layout", err);
            }
        }
    };

    const widgetSpans: Record<string, string> = {
        objective: 'col-span-1 md:col-span-2 lg:col-span-4',
        stat_ca_month: 'col-span-1',
        stat_ca_total: 'col-span-1',
        stat_pipeline: 'col-span-1',
        stat_campaigns: 'col-span-1',
        reminders: 'col-span-1 md:col-span-2',
        invoices: 'col-span-1 md:col-span-2',
        activity: 'col-span-1 md:col-span-2',
    };

    const widgets: Record<string, React.ReactNode> = {
        objective: (
            <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden flex flex-col md:flex-row items-center gap-8 h-full">
                <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-inner shrink-0" style={{ background: `linear-gradient(135deg, ${BRAND_COLOR}22 0%, ${BRAND_COLOR}11 100%)` }}>
                    <TrendingUp size={40} style={{ color: BRAND_COLOR }} />
                </div>
                <div className="flex-1 w-full">
                    <div className="flex justify-between items-end mb-3">
                        <div>
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Objectif Mensuel Agence</p>
                            <h2 className="text-3xl font-extrabold font-poppins text-slate-800">{renderCurrency(stats.caMensuel)} <span className="text-lg text-slate-400 font-medium">/ {renderCurrency(goal)}</span></h2>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-extrabold font-poppins" style={{ color: BRAND_COLOR }}>{renderNumber(progressGoal.toFixed(1))}%</span>
                        </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner">
                        <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressGoal}%`, backgroundColor: BRAND_COLOR }}></div>
                    </div>
                    <p className="text-xs text-slate-500 mt-3 font-medium flex items-center gap-1"><Info size={12}/> L'objectif est modifiable dans les paramètres.</p>
                </div>
            </div>
        ),
        stat_ca_month: (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4"><Wallet size={24} style={{ color: BRAND_COLOR }}/></div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">CA ce mois</p>
                <h3 className="text-3xl font-extrabold mt-1 font-poppins" style={{ color: BRAND_COLOR }}>{renderCurrency(stats.caMensuel)}</h3>
            </div>
        ),
        stat_ca_total: (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4"><CheckCircle size={24} className="text-emerald-500"/></div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">CA Total Encaissé</p>
                <h3 className="text-3xl font-extrabold text-emerald-500 mt-1 font-poppins">{renderCurrency(stats.caTotal)}</h3>
            </div>
        ),
        stat_pipeline: (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full">
                <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center mb-4"><Layers size={24} className="text-orange-500"/></div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Valeur Pipeline</p>
                <h3 className="text-3xl font-extrabold text-orange-500 mt-1 font-poppins">{renderCurrency(stats.pipelineValue)}</h3>
            </div>
        ),
        stat_campaigns: (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-4"><PlayCircle size={24} className="text-indigo-600"/></div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Campagnes Actives</p>
                <h3 className="text-3xl font-extrabold text-indigo-600 mt-1 font-poppins">{renderNumber(stats.activeCampaigns)} <span className="text-sm font-medium text-slate-400 font-inter">en prod.</span></h3>
            </div>
        ),
        reminders: (
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full">
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                    <h3 className="font-extrabold text-slate-800 font-poppins text-lg flex items-center gap-2"><Bell className="text-orange-500" size={20}/> Rappels & Relances</h3>
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{activeReminders.length} à venir</span>
                </div>
                {activeReminders.length === 0 ? (
                    <p className="text-slate-400 text-sm italic text-center py-6">Aucun rappel programmé.</p>
                ) : (
                    <div className="space-y-4">
                        {activeReminders.map(contact => {
                            const date = new Date(contact.nextContactDate!);
                            const isOverdue = date <= new Date();
                            return (
                                <div key={contact.id} onClick={() => setSelectedContactId(contact.id)} className={`flex flex-col p-3 rounded-xl cursor-pointer hover:shadow-sm transition-all border ${isOverdue ? 'bg-red-50/50 border-red-100 hover:border-red-300' : 'bg-slate-50 border-slate-100 hover:border-[#01189B]'}`}>
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="font-bold text-slate-800 text-sm">{contact.company}</p>
                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{isOverdue ? 'Échu !' : formatDate(contact.nextContactDate!)}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 line-clamp-1">{contact.nextContactNote || 'Relance planifiée'}</p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        ),
        invoices: (
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full">
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                    <h3 className="font-extrabold text-slate-800 font-poppins text-lg flex items-center gap-2"><FileText style={{ color: BRAND_COLOR }} size={20}/> Facturation Récente</h3>
                    <button onClick={() => setActiveView('invoices')} className="text-sm text-[#01189B] font-bold hover:underline">Voir tout</button>
                </div>
                {recentInvoices.length === 0 ? (
                    <p className="text-slate-400 text-sm italic text-center py-6">Aucune facture générée.</p>
                ) : (
                    <div className="space-y-4">
                        {recentInvoices.map(inv => (
                            <div key={inv.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer" onClick={() => { setCurrentInvoice(inv); setShowModal('invoice'); }}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${inv.status === 'payee' ? 'bg-emerald-500' : inv.status === 'retard' ? 'bg-orange-500' : inv.status === 'archive' ? 'bg-slate-500' : 'bg-blue-400'}`}></div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{inv.clientName}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{formatDate(inv.date)}</p>
                                    </div>
                                </div>
                                <p className="font-mono font-bold text-slate-700">{renderCurrency(inv.amount)}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        ),
        activity: (
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full">
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                    <h3 className="font-extrabold text-slate-800 font-poppins text-lg flex items-center gap-2"><Activity className="text-orange-500" size={20}/> Activité CRM (Notes)</h3>
                    <button onClick={() => setActiveView('contacts')} className="text-sm text-orange-600 font-bold hover:underline">Ouvrir Pipeline</button>
                </div>
                {recentActivity.length === 0 ? (
                    <p className="text-slate-400 text-sm italic text-center py-6">Aucune interaction enregistrée sur vos contacts.</p>
                ) : (
                    <div className="space-y-4">
                        {recentActivity.map(act => {
                            const contact = contacts.find(c => c.id === act.contactId);
                            return (
                                <div key={act.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                                    <p className="text-xs font-bold text-slate-500 mb-1 flex justify-between"><span>{contact ? contact.company : 'Contact inconnu'}</span> <span className="text-slate-400 font-medium">{formatDate(act.createdAt)}</span></p>
                                    <p className="text-sm text-slate-700 line-clamp-2">{act.content}</p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        )
    };

    return (
      <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-min">
            {currentLayout.map(widgetId => {
                if (!widgets[widgetId]) return null;
                return (
                    <div
                        key={widgetId} draggable
                        onDragStart={(e) => handleDragStart(e, widgetId)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, widgetId)}
                        className={`${widgetSpans[widgetId]} relative group cursor-grab active:cursor-grabbing`}
                    >
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-slate-500 transition-opacity z-50 bg-white/50 backdrop-blur-sm p-1 rounded-md">
                            <GripHorizontal size={20} />
                        </div>
                        {widgets[widgetId]}
                    </div>
                );
            })}
        </div>
      </div>
    );
  };

  const renderSettings = () => {
      // Configuration form render
      return (
        <div className="max-w-5xl mx-auto animate-fade-in pb-12 flex gap-8">
          {/* Menu latéral Settings */}
          <div className="w-64 shrink-0 space-y-2">
              <h2 className="text-2xl font-extrabold mb-6 font-poppins text-slate-800">Paramètres</h2>
              {[
                  { id: 'general', label: 'Infos Générales', icon: Briefcase },
                  { id: 'billing', label: 'Facturation', icon: FileText },
                  { id: 'emails', label: 'Modèles d\'Emails', icon: Mail },
                  { id: 'integrations', label: 'Intégrations', icon: Link },
                  { id: 'data', label: 'Données & Export', icon: Download },
              ].map(tab => (
                  <button 
                    key={tab.id} 
                    onClick={() => setSettingsActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${settingsActiveTab === tab.id ? 'bg-[#01189B] text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                      <tab.icon size={18}/> {tab.label}
                  </button>
              ))}
          </div>

          <div className="flex-1 bg-white p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] min-h-[600px]">
              
              {settingsActiveTab === 'general' && (
                  <form onSubmit={handleSaveSettings} className="space-y-6 animate-fade-in">
                      <h3 className="font-extrabold text-xl mb-6 font-poppins border-b border-slate-100 pb-4 text-slate-800 flex items-center gap-2"><Briefcase size={22} className="text-[#01189B]"/> Général & Agence</h3>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Nom Société</label><input name="companyName" defaultValue={settings.companyName} className="w-full border-2 border-slate-100 bg-slate-50 p-3 rounded-xl mt-1 outline-none focus:border-[#01189B] focus:bg-white font-bold transition-colors text-slate-700" /></div>
                        <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Numéro d'entreprise (IDE / TVA)</label><input name="companyId" defaultValue={settings.companyId} className="w-full border-2 border-slate-100 bg-slate-50 p-3 rounded-xl mt-1 outline-none focus:border-[#01189B] focus:bg-white font-medium transition-colors text-slate-700" placeholder="Ex: CHE-123.456.789 TVA" /></div>
                        <div className="col-span-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Adresse Complète</label><textarea name="address" defaultValue={settings.address} className="w-full border-2 border-slate-100 bg-slate-50 p-3 rounded-xl mt-1 h-24 outline-none focus:border-[#01189B] focus:bg-white resize-none transition-colors text-slate-700" /></div>
                        <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Email Contact</label><input name="email" defaultValue={settings.email} className="w-full border-2 border-slate-100 bg-slate-50 p-3 rounded-xl mt-1 outline-none focus:border-[#01189B] focus:bg-white font-medium transition-colors text-slate-700" /></div>
                        <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Téléphone</label><input name="phone" defaultValue={settings.phone} className="w-full border-2 border-slate-100 bg-slate-50 p-3 rounded-xl mt-1 outline-none focus:border-[#01189B] focus:bg-white font-medium transition-colors text-slate-700" /></div>
                      </div>

                      <div className="border-t border-slate-100 pt-6 mt-6">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Objectif CA Mensuel (CHF)</label>
                          <input name="monthlyGoal" type="number" defaultValue={settings.monthlyGoal || 50000} className="w-full md:w-1/2 border-2 border-slate-100 bg-slate-50 p-3 rounded-xl mt-1 font-extrabold outline-none focus:border-[#01189B] focus:bg-white text-xl text-[#01189B] transition-colors" />
                      </div>

                      <div className="pt-4 flex justify-end">
                          <button type="submit" className="bg-[#01189B] text-white px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-opacity"><Save size={18}/> Sauvegarder</button>
                      </div>
                  </form>
              )}

              {settingsActiveTab === 'billing' && (
                  <form onSubmit={handleSaveSettings} className="space-y-6 animate-fade-in">
                      <h3 className="font-extrabold text-xl mb-6 font-poppins border-b border-slate-100 pb-4 text-slate-800 flex items-center gap-2"><FileText size={22} className="text-[#01189B]"/> Personnalisation Facture</h3>
                      <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Coordonnées Bancaires (IBAN, BIC, etc.)</label><textarea name="bankDetails" defaultValue={settings.bankDetails} className="w-full border-2 border-slate-100 bg-slate-50 p-3 rounded-xl mt-1 h-24 outline-none focus:border-[#01189B] focus:bg-white resize-none transition-colors text-slate-700" placeholder="Banque XYZ&#10;IBAN: CH...&#10;BIC: ..." /></div>
                      <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Pied de page / Conditions</label><textarea name="invoiceFooter" defaultValue={settings.invoiceFooter} className="w-full border-2 border-slate-100 bg-slate-50 p-3 rounded-xl mt-1 h-20 outline-none focus:border-[#01189B] focus:bg-white resize-none transition-colors text-slate-700" /></div>
                      <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Ligne Légale (Bas de page centré)</label><input name="legalNotice" defaultValue={settings.legalNotice || 'Entreprise individuelle non soumise à la TVA'} className="w-full border-2 border-slate-100 bg-slate-50 p-3 rounded-xl mt-1 outline-none focus:border-[#01189B] focus:bg-white font-medium transition-colors text-slate-700 text-sm" /></div>
                      
                      <div className="pt-4 flex justify-end">
                          <button type="submit" className="bg-[#01189B] text-white px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-opacity"><Save size={18}/> Sauvegarder</button>
                      </div>
                  </form>
              )}

              {settingsActiveTab === 'emails' && (
                  <div className="space-y-6 animate-fade-in flex flex-col h-full">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                        <h3 className="font-extrabold text-xl font-poppins text-slate-800 flex items-center gap-2"><Mail size={22} className="text-[#01189B]"/> Modèles d'Emails</h3>
                        <button 
                            onClick={() => {
                                const newTpl = { id: `tpl_${Date.now()}`, name: 'Nouveau Modèle', subject: '', body: '' };
                                handleSaveSettingsDirect({ emailTemplates: [...(settings.emailTemplates || []), newTpl] });
                            }} 
                            className="text-sm font-bold bg-[#01189B] text-white px-4 py-2 rounded-lg flex items-center gap-2"
                        >
                            <Plus size={16}/> Ajouter
                        </button>
                      </div>

                      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex gap-4 text-sm text-blue-800 mb-4">
                          <Info size={20} className="shrink-0 text-blue-500 mt-0.5"/>
                          <div>
                              <p className="font-bold mb-1">Variables disponibles dans les modèles :</p>
                              <div className="flex gap-3 font-mono text-xs flex-wrap">
                                  <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{{nom_contact}}`}</span>
                                  <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{{prenom_contact}}`}</span>
                                  <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{{societe}}`}</span>
                                  <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{{facture}}`}</span>
                                  <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{{montant}}`}</span>
                                  <span className="bg-white px-2 py-1 rounded border border-blue-200">{`{{agence}}`}</span>
                              </div>
                          </div>
                      </div>

                      <div className="space-y-6 flex-1 overflow-auto pr-2 custom-scrollbar">
                          {(settings.emailTemplates || []).map((tpl, i) => (
                              <EmailTemplateEditor 
                                  key={tpl.id} 
                                  tpl={tpl} 
                                  onSave={(updatedTpl: any) => {
                                      const copy = [...(settings.emailTemplates || [])];
                                      copy[i] = updatedTpl;
                                      handleSaveSettingsDirect({ emailTemplates: copy });
                                  }}
                                  onDelete={() => {
                                      const copy = [...(settings.emailTemplates || [])];
                                      copy.splice(i, 1);
                                      handleSaveSettingsDirect({ emailTemplates: copy });
                                  }}
                              />
                          ))}
                      </div>
                  </div>
              )}

              {settingsActiveTab === 'integrations' && (
                  <form onSubmit={handleSaveSettings} className="space-y-6 animate-fade-in">
                      <h3 className="font-extrabold text-xl mb-6 font-poppins border-b border-slate-100 pb-4 text-slate-800 flex items-center gap-2"><Link size={22} className="text-[#01189B]"/> Automatisation & Webhooks</h3>
                      <p className="text-sm text-slate-500 mb-6">Pour envoyer vos factures en PDF directement via votre outil de messagerie, connectez ce CRM à Make.com ou Zapier via un Webhook.</p>
                      
                      <div>
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">URL du Webhook (Make / Zapier)</label>
                          <input name="webhookUrl" defaultValue={settings.webhookUrl || ''} className="w-full border-2 border-indigo-100 bg-indigo-50/30 p-3 rounded-xl mt-1 font-mono text-sm outline-none focus:border-indigo-400 transition-colors text-slate-700" placeholder="https://hook.eu2.make.com/..." />
                      </div>
                      
                      <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500 space-y-2 font-mono">
                          <p className="font-bold text-slate-700 mb-2">Payload (JSON) envoyé par le CRM au Webhook :</p>
                          <p>{"{"}</p>
                          <p className="pl-4">"to_email": "client@email.com",</p>
                          <p className="pl-4">"subject": "Nouvelle Facture...",</p>
                          <p className="pl-4">"message": "Bonjour...",</p>
                          <p className="pl-4">"invoice_id": "FAC-0001",</p>
                          <p className="pl-4">"pdf_attachment_base64": "data:application/pdf;base64,JVBERi..."</p>
                          <p>{"}"}</p>
                      </div>

                      <div className="pt-4 flex justify-end">
                          <button type="submit" className="bg-[#01189B] text-white px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-opacity"><Save size={18}/> Sauvegarder</button>
                      </div>
                  </form>
              )}

              {settingsActiveTab === 'data' && (
                  <div className="space-y-6 animate-fade-in">
                      <h3 className="font-extrabold text-xl mb-6 font-poppins border-b border-slate-100 pb-4 text-slate-800 flex items-center gap-2"><Download size={22} className="text-emerald-500"/> Sauvegarde Data</h3>
                      <p className="text-sm text-slate-500 mb-6">Téléchargez l'intégralité des données de votre CRM (Contacts, Factures, Scénarios, Notes...) au format JSON. Idéal pour garder une copie locale sécurisée.</p>
                      
                      <button type="button" onClick={handleExportData} className="px-6 py-4 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-sm w-full justify-center text-lg">
                          <Download size={22}/> Générer & Télécharger (.json)
                      </button>
                  </div>
              )}

          </div>
        </div>
      );
  };

  // --- RENDER RACINE ---
  if (loading) return <div className="h-screen flex items-center justify-center text-slate-400 bg-slate-50" style={{ fontFamily: 'Inter, sans-serif' }}><Loader className="animate-spin mr-3 text-[#01189B]" size={32} /> <span className="font-bold text-lg">Démarrage...</span></div>;
  if (!isAppAuthenticated) return <LoginScreen onLogin={() => setIsAppAuthenticated(true)} addNotification={addNotification} />;

  return (
    <div className={`flex h-screen bg-slate-50/50 text-slate-900 font-sans`}>
      {/* INJECTION DES POLICES ET STYLES DYNAMIQUES */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@500;600;700;800;900&display=swap');
        body { font-family: 'Inter', sans-serif; }
        .font-poppins, h1, h2, h3, h4, h5, h6 { font-family: 'Poppins', sans-serif !important; }
        @media print { body * { visibility: hidden; } #invoice-printable, #invoice-printable * { visibility: visible; } #invoice-printable { position: fixed; left:0; top:0; width:100%; height:100%; padding:0; background:white; z-index:9999; } .no-print { display: none !important; } .print-input { border: none !important; padding: 0 !important; background: transparent !important; } }
        /* Scrollbar personnalisée */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
      `}} />
      
      <aside className="w-72 bg-white flex flex-col no-print shrink-0 border-r border-slate-200 relative z-20">
        <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: BRAND_COLOR }}></div>
        <div className="p-8">
          <div className="flex items-center gap-4 mb-12 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => {setActiveView('dashboard'); setSelectedContactId(null);}}>
             <div className="w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-2xl shadow-sm text-white" style={{ backgroundColor: BRAND_COLOR }}>
               LP
             </div>
             <div>
                <span className="font-extrabold text-xl font-poppins tracking-wide block leading-tight" style={{ color: BRAND_COLOR }}>LeadPartner</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CRM Cloud</span>
             </div>
          </div>
          <nav className="space-y-2">
            {[
              { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
              { id: 'contacts', label: 'Pipeline CRM', icon: Users },
              { id: 'calendar', label: 'Cycles Actifs', icon: CalendarIcon },
              { id: 'invoices', label: 'Facturation', icon: FileText },
              { id: 'products', label: 'Catalogue Offres', icon: Package },
              { id: 'projections', label: 'Production Média', icon: Calculator },
              { id: 'target-tool', label: 'Objectifs & Scénarios', icon: Rocket },
              { id: 'settings', label: 'Paramètres Agence', icon: Settings },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveView(item.id); setSelectedContactId(null); }}
                className={`w-full flex items-center gap-4 px-4 py-3.5 text-sm font-bold rounded-xl transition-all ${
                  activeView === item.id ? 'text-white shadow-md translate-x-1' : 'text-slate-500 hover:bg-slate-50 hover:text-[#01189B]'
                }`}
                style={activeView === item.id ? { backgroundColor: BRAND_COLOR } : {}}
              >
                <item.icon size={18} className={activeView === item.id ? 'text-white' : 'text-slate-400'} /> {item.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-10 no-print shrink-0 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] z-10">
          <div className="flex items-center gap-4 text-slate-400 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 focus-within:border-[#01189B] focus-within:bg-white transition-colors w-96">
            <Search size={18} className={searchTerm ? 'text-[#01189B]' : ''} />
            <input type="text" placeholder="Rechercher (Client, Email...)" className="bg-transparent outline-none text-sm font-medium text-slate-800 w-full placeholder:text-slate-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex items-center gap-4">
             {/* Bouton Mode Secret */}
             <button 
                onClick={() => setIsSecretMode(!isSecretMode)} 
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${isSecretMode ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-inner' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                title="Cacher les chiffres"
             >
                {isSecretMode ? <><EyeOff size={18} /> Mode discret activé</> : <><Eye size={18} /> Masquer données</>}
             </button>
             
             <button onClick={() => { signOut(auth); window.location.reload(); }} className="px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors">Déconnexion</button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-10 relative">
          {selectedContact ? renderContactDetail() : (
            <>
              {activeView === 'dashboard' && renderDashboard()}
              {activeView === 'calendar' && (
                  <div className="max-w-6xl mx-auto animate-fade-in space-y-8 pb-12">
                      <div className="flex justify-between items-center mb-2">
                        <h2 className="text-3xl font-extrabold text-slate-800 flex items-center gap-3 font-poppins">
                          <CalendarIcon size={32} style={{ color: BRAND_COLOR }}/> Cycles de Livraison Actifs
                        </h2>
                      </div>
                      <p className="text-slate-500 text-lg mb-8">Vue d'ensemble graphique de l'avancement de vos productions média en cours (Cycle 30 Jours).</p>

                      {simulations.length === 0 ? (
                        <div className="bg-white p-16 text-center rounded-3xl border border-slate-100 shadow-sm">
                          <div className="w-24 h-24 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CalendarIcon size={40}/>
                          </div>
                          <h3 className="text-xl font-bold text-slate-700 mb-2 font-poppins">Aucun cycle de production</h3>
                          <p className="text-slate-500">Ajoutez une simulation dans "Production Média" pour déclencher et suivre un cycle ici.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                          {simulations.map(sim => {
                            const start = new Date(sim.createdAt);
                            const diffDays = Math.max(0, Math.floor((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                            const day = Math.min(diffDays, 30);
                            const daysPercent = (day / 30) * 100;
                            
                            const targetLeads = sim.stats?.volumeTotal || 0;
                            const expectedLeads = Math.min(Math.floor((targetLeads / 30) * day), targetLeads); 
                            const leadsPercent = targetLeads > 0 ? (expectedLeads / targetLeads) * 100 : 0;
                            const isFinished = day >= 30;
                            
                            return (
                              <div key={sim.id} className={`bg-white rounded-2xl border-2 shadow-sm p-6 relative hover:shadow-lg transition-all ${isFinished ? 'border-red-200' : 'border-slate-100 hover:border-[#01189B]'}`}>
                                <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                                  <div>
                                    <h4 className="font-extrabold text-slate-800 font-poppins text-lg">{sim.clientName || 'Client Inconnu'}</h4>
                                    <p className="text-sm font-bold mt-1" style={{ color: BRAND_COLOR }}>{sim.productName}</p>
                                  </div>
                                  {isFinished && <span className="bg-red-100 text-red-700 text-[10px] font-extrabold px-3 py-1.5 rounded-full animate-pulse uppercase tracking-widest shrink-0">Renouveler</span>}
                                </div>

                                <div className="mb-6">
                                  <div className="inline-block bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-bold px-4 py-2 rounded-xl w-full text-center shadow-sm">
                                    🎯 Objectif : {renderNumber(targetLeads)} Leads
                                  </div>
                                </div>
                                
                                <div className="space-y-6">
                                  <div>
                                    <div className="flex justify-between text-xs font-extrabold mb-2">
                                      <span className="text-slate-500 uppercase tracking-wider flex items-center gap-1"><Clock size={12}/> Temps écoulé</span>
                                      <span className="text-slate-700 font-mono text-sm">{day} <span className="text-[10px] text-slate-400">/ 30 jours</span></span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
                                      <div className={`h-full rounded-full transition-all duration-1000 ${isFinished ? 'bg-red-500' : 'bg-[#01189B]'}`} style={{ width: `${daysPercent}%` }}></div>
                                    </div>
                                  </div>

                                  <div>
                                    <div className="flex justify-between text-xs font-extrabold mb-2">
                                      <span className="text-slate-500 uppercase tracking-wider flex items-center gap-1"><Users size={12}/> Leads générés (Estim.)</span>
                                      <span className="text-emerald-600 font-mono text-sm">{renderNumber(expectedLeads)} <span className="text-[10px] text-slate-400">/ {renderNumber(targetLeads)}</span></span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
                                      <div className="h-full rounded-full bg-emerald-500 transition-all duration-1000" style={{ width: `${leadsPercent}%` }}></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
              )}
              {activeView === 'settings' && renderSettings()}
              {activeView === 'projections' && (
                  // ... [Code inchangé de Projections, c.f. global app]
                  <div className="space-y-8 animate-fade-in pb-12">
                      <div className="space-y-6 max-w-7xl mx-auto">
                        <h2 className="text-3xl font-extrabold flex items-center gap-3 text-slate-800 font-poppins"><Target style={{ color: BRAND_COLOR }} size={32} /> Pilotage Mensuel Média</h2>
                        
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden mt-8">
                          <div className="bg-slate-50 p-6 border-b border-slate-100">
                            <h2 className="text-lg font-extrabold flex items-center gap-2 font-poppins text-slate-800"><Calculator style={{ color: BRAND_COLOR }} size={20} /> Convertir Contrat en Production Média</h2>
                            <p className="text-slate-500 text-sm mt-1">Ajoutez un contrat signé pour l'activer dans les cycles (Cela générera les graphiques dans le calendrier).</p>
                          </div>
                          <div className="p-8 grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wide">1. Choix Client</label><select value={planClientId} onChange={(e) => setPlanClientId(e.target.value)} className="w-full border-2 border-slate-200 bg-slate-50 focus:bg-white p-3.5 rounded-xl font-medium outline-none focus:border-[#01189B] transition-colors"><option value="">-- Aucun --</option>{contacts.map((c) => (<option key={c.id} value={c.id}>{c.company}</option>))}</select></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wide">2. Thématique</label><select value={planProductId} onChange={(e) => setPlanProductId(e.target.value)} className="w-full border-2 border-slate-200 bg-slate-50 focus:bg-white p-3.5 rounded-xl font-medium outline-none focus:border-[#01189B] transition-colors"><option value="">-- Choisir --</option>{products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}</select></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wide">3. Budget Signé</label><input type="number" value={planBudget} onChange={(e) => setPlanBudget(Number(e.target.value))} className="w-full border-2 border-slate-200 bg-slate-50 focus:bg-white p-3.5 rounded-xl font-extrabold text-lg text-[#01189B] outline-none focus:border-[#01189B] transition-colors" /></div>
                            <button onClick={() => {
                                const activeProduct = products.find((p) => p.id === planProductId) || products[0];
                                let planStats = { volumeTotal: 0, costTotal: 0, profit: 0, dailyVolume: 0, dailyBudget: 0, margin: 0, fees: 0, arbitrage: 0 };
                                if (activeProduct && planBudget > 0 && activeProduct.price > 0) {
                                  const fees = planBudget * 0.35; const netMedia = planBudget * 0.65; const volumeTotal = Math.floor(netMedia / activeProduct.price); const costTotal = volumeTotal * Number(activeProduct.cost ?? 0);
                                  const arbitrage = netMedia - costTotal; const profit = fees + arbitrage; planStats = { volumeTotal, costTotal, profit, dailyVolume: volumeTotal / 30, dailyBudget: costTotal / 30, margin: (profit / planBudget) * 100, fees, arbitrage };
                                }
                                handleSaveSimulation(planStats)
                            }} className="w-full text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:-translate-y-0.5 transition-all text-lg" style={{ backgroundColor: BRAND_COLOR }}><Plus size={20} /> Démarrer la prod.</button>
                          </div>
                        </div>

                        <h2 className="text-2xl font-extrabold text-slate-800 mb-6 mt-12 flex items-center gap-3 font-poppins"><Save size={24} style={{ color: BRAND_COLOR }} /> Carnet de Production Actuel</h2>
                        {simulations.length === 0 ? (
                          <div className="bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-slate-400 font-medium">Aucun contrat en production. Remplissez le convertisseur ci-dessus.</div>
                        ) : (
                          <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                              <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 uppercase font-extrabold text-[10px] tracking-wider border-b border-slate-100">
                                  <tr><th className="px-6 py-5">Client / Thématique</th><th className="px-6 py-5">Progression Temps</th><th className="px-6 py-5">Budget Facturé</th><th className="px-6 py-5">Objectif Leads</th><th className="px-6 py-5">Bénéfice Prévu</th><th className="px-6 py-5 text-right">Action</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {simulations.map((sim) => {
                                    const start = new Date(sim.createdAt);
                                    const diffDays = Math.max(0, Math.floor((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                                    const day = Math.min(diffDays, 30);
                                    const daysPercent = (day / 30) * 100;
                                    const isFinished = day >= 30;

                                    return (
                                    <tr key={sim.id} className="hover:bg-blue-50/30 transition-colors">
                                      <td className="px-6 py-5">
                                        <p className="font-extrabold text-slate-800 font-poppins">{sim.clientName || 'N/A'}</p>
                                        <p className="font-bold text-xs mt-1 text-[#01189B] flex items-center gap-1"><Package size={12}/> {sim.productName}</p>
                                      </td>
                                      <td className="px-6 py-5 w-48">
                                        <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                                          <span>J-{day}</span><span>30 J</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                          <div className={`h-full rounded-full transition-all ${isFinished ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${daysPercent}%` }}></div>
                                        </div>
                                        {isFinished && <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-block">Terminé</span>}
                                      </td>
                                      <td className="px-6 py-5 font-mono font-bold text-slate-600">{renderCurrency(sim.budget)}</td>
                                      <td className="px-6 py-5">
                                        <div className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg font-extrabold inline-flex items-center gap-2">
                                          <Target size={14}/> {renderNumber(sim.stats?.volumeTotal)}
                                        </div>
                                      </td>
                                      <td className="px-6 py-5">
                                        <span className={`font-extrabold px-3 py-1.5 rounded-lg font-mono ${(sim.stats?.margin || 0) >= 30 ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>
                                          {renderCurrency(sim.stats?.profit)} <span className="text-[10px] ml-1">({renderNumber((sim.stats?.margin || 0).toFixed(0))}%)</span>
                                        </span>
                                      </td>
                                      <td className="px-6 py-5 text-right"><button onClick={() => handleDelete('simulations', sim.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button></td>
                                    </tr>
                                  )})}
                                </tbody>
                              </table>
                          </div>
                        )}
                      </div>
                    </div>
              )}
              {activeView === 'target-tool' && (
                  // ... [Code inchangé de Target tool]
                  <div className="max-w-6xl mx-auto animate-fade-in space-y-8 pb-12">
                      <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-4">
                              <div className="p-4 rounded-2xl text-white shadow-[0_8px_30px_rgb(1,24,155,0.3)]" style={{ backgroundColor: BRAND_COLOR }}>
                                  <Rocket size={32} />
                              </div>
                              <div>
                                  <h2 className="text-3xl font-extrabold text-slate-800 font-poppins">Objectifs & Scénarios</h2>
                                  <p className="text-slate-500 text-lg">Simulez vos bénéfices nets par campagne avant de signer le client.</p>
                              </div>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
                          <div className="lg:col-span-4 space-y-6">
                              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden">
                                  <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: BRAND_COLOR }}></div>
                                  <h3 className="font-extrabold text-lg flex items-center gap-2 mb-6 font-poppins text-slate-800"><Settings size={20} style={{ color: BRAND_COLOR }}/> Données du Client</h3>
                                  <div className="space-y-5">
                                      <div>
                                          <label className="block text-xs font-bold text-slate-400 uppercase mb-2 tracking-wide">Nom de la Simulation</label>
                                          <input className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-[#01189B] font-medium transition-colors" value={targetToolState.scenarioName} onChange={(e) => setTargetToolState({...targetToolState, scenarioName: e.target.value})} placeholder="Ex: Client ABC - Plombier" />
                                      </div>
                                      <div>
                                          <label className="block text-xs font-bold text-slate-400 uppercase mb-2 tracking-wide">Budget Mensuel (Facturé)</label>
                                          <div className="relative">
                                              <Wallet className="absolute left-4 top-3.5 text-slate-400" size={20} />
                                              <input type="number" className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-extrabold text-xl outline-none focus:border-[#01189B] text-slate-800 transition-colors" value={targetToolState.totalBudget} onChange={(e) => setTargetToolState({...targetToolState, totalBudget: Number(e.target.value)})} />
                                          </div>
                                      </div>
                                      
                                      <div className="border-t border-slate-100 pt-5">
                                          <h4 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wide flex items-center gap-2"><Target size={16}/> Pricing Leads</h4>
                                          <div className="grid grid-cols-2 gap-4">
                                              <div>
                                                  <label className="block text-[10px] font-bold text-[#01189B] uppercase mb-2">Prix Vente (CPL)</label>
                                                  <input type="number" className="w-full px-3 py-3 bg-blue-50 border-2 border-blue-100 rounded-xl font-bold text-blue-800 outline-none focus:border-[#01189B]" value={targetToolState.targetCPL} onChange={(e) => setTargetToolState({...targetToolState, targetCPL: Number(e.target.value)})} />
                                              </div>
                                              <div>
                                                  <label className="block text-[10px] font-bold text-orange-600 uppercase mb-2">Coût Achat (Est.)</label>
                                                  <input type="number" className="w-full px-3 py-3 bg-orange-50 border-2 border-orange-100 rounded-xl font-bold text-orange-800 outline-none focus:border-orange-400" value={targetToolState.realCPL} onChange={(e) => setTargetToolState({...targetToolState, realCPL: Number(e.target.value)})} />
                                              </div>
                                          </div>
                                      </div>

                                      <div className="border-t border-slate-100 pt-5">
                                          <div className="flex justify-between items-center mb-3">
                                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1"><Briefcase size={14}/> Frais de Gestion</label>
                                              <button onClick={() => setTargetToolState({...targetToolState, useMargin: !targetToolState.useMargin})} className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md border transition-colors ${targetToolState.useMargin ? 'bg-blue-50 text-[#01189B] border-blue-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>{targetToolState.useMargin ? 'Actif' : 'Inactif'}</button>
                                          </div>
                                          <div className={`relative transition-opacity ${!targetToolState.useMargin ? 'opacity-40' : ''}`}>
                                              <Percent className="absolute left-4 top-3.5 text-slate-400" size={18} />
                                              <input type="number" className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-extrabold text-lg outline-none focus:border-[#01189B] text-slate-700" value={targetToolState.agencyMargin} disabled={!targetToolState.useMargin} onChange={(e) => setTargetToolState({...targetToolState, agencyMargin: Number(e.target.value)})} />
                                          </div>
                                      </div>

                                      <button onClick={handleSaveTargetScenario} className="w-full text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:-translate-y-0.5 transition-all mt-6" style={{ backgroundColor: BRAND_COLOR }}>
                                          <Save size={18}/> Sauvegarder ce Scénario
                                      </button>
                                  </div>
                              </div>
                          </div>

                          <div className="lg:col-span-8 space-y-6">
                              {/* Rendu des calculs (simplifié pour le layout) */}
                              <div className="rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${BRAND_COLOR} 0%, #0a2540 100%)` }}>
                                  <div className="absolute top-0 right-0 p-32 bg-white rounded-full blur-3xl opacity-10 -mr-16 -mt-16 pointer-events-none"></div>
                                  <div className="relative z-10">
                                      <p className="text-blue-200 font-bold uppercase tracking-widest text-sm mb-2">Bénéfice Net Dans Votre Poche</p>
                                      <div className="flex items-end gap-4 mb-4">
                                          <h2 className="text-6xl md:text-7xl font-extrabold font-poppins">
                                            {renderCurrency((targetToolState.totalBudget * ((targetToolState.useMargin ? targetToolState.agencyMargin : 0)/100)) + ((targetToolState.totalBudget - (targetToolState.totalBudget * ((targetToolState.useMargin ? targetToolState.agencyMargin : 0)/100))) - ((targetToolState.targetCPL > 0 ? Math.floor(targetToolState.totalBudget / targetToolState.targetCPL) : 0) * targetToolState.realCPL)))}
                                          </h2>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              )}
              {activeView === 'products' && (
                <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-3xl font-extrabold text-slate-800 flex items-center gap-3 font-poppins"><Package style={{ color: BRAND_COLOR }} size={32}/> Catalogue des Offres</h2>
                      <p className="text-slate-500 mt-2 text-lg">Gérez vos produits de génération de leads et leurs marges cibles.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <button onClick={() => setShowModal('product')} className="border-2 border-dashed border-slate-300 bg-white rounded-3xl flex flex-col items-center justify-center text-slate-400 hover:text-[#01189B] hover:border-[#01189B] hover:bg-blue-50/50 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.02)] min-h-[220px]">
                      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4"><Plus size={32} /></div>
                      <span className="font-extrabold font-poppins text-lg">Créer une Offre</span>
                    </button>
                    {products.map((p) => (
                      <div key={p.id} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative group hover:border-[#01189B] hover:shadow-xl transition-all flex flex-col min-h-[220px]">
                        <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setCurrentProduct(p); setShowModal('product'); }} className="p-2 text-slate-400 hover:text-[#01189B] bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={16} /></button>
                          <button onClick={() => handleDelete('products', p.id)} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                        </div>
                        <div className="flex items-center gap-4 mb-6">
                          <div className="p-3 bg-blue-50 rounded-xl" style={{ color: BRAND_COLOR }}>{p.platform === 'google' ? <Globe size={24} /> : <Share2 size={24} />}</div>
                          <h4 className="font-extrabold text-slate-800 text-xl font-poppins pr-16">{p.name}</h4>
                        </div>
                        <p className="text-slate-500 text-sm mb-6 flex-1 font-medium leading-relaxed">{p.description || 'Génération de leads optimisée pour ce vertical métier.'}</p>
                        <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-6">
                          <div><p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Vente Facturée</p><p className="font-extrabold text-2xl font-poppins" style={{ color: BRAND_COLOR }}>{renderCurrency(p.price)}</p></div>
                          <div className="border-l border-slate-100 pl-4"><p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Cible Achat</p><p className="font-bold text-xl text-orange-500 font-mono">{renderCurrency(p.cost)}</p></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeView === 'invoices' && (
                <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-extrabold text-slate-800 flex items-center gap-3 font-poppins"><FileText style={{ color: BRAND_COLOR }} size={32}/> Facturation</h2>
                    <button onClick={() => { 
                      const nextId = generateNextInvoiceId();
                      setCurrentInvoice({ id: nextId, clientId: '', clientName: '', date: new Date().toISOString(), items: [], status: 'brouillon' }); 
                      setShowModal('invoice'); 
                    }} className="text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 hover:shadow-lg hover:-translate-y-0.5 transition-all" style={{ backgroundColor: BRAND_COLOR }}>
                      <Plus size={18} /> Créer une Facture
                    </button>
                  </div>
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                    {invoices.length === 0 ? (
                       <div className="p-16 text-center text-slate-400 font-medium">Aucune facture générée pour le moment.</div>
                    ) : (
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-extrabold text-[10px] tracking-wider border-b border-slate-100">
                          <tr><th className="px-8 py-5">N° Facture</th><th className="px-8 py-5">Client Associé</th><th className="px-8 py-5">Date Création</th><th className="px-8 py-5">Montant Total</th><th className="px-8 py-5">Statut Paiement</th><th className="px-8 py-5 text-right">Action</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {invoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((inv) => (
                            <tr key={inv.id} className="hover:bg-blue-50/30 transition-colors group cursor-pointer" onClick={() => { setCurrentInvoice(inv); setShowModal('invoice'); }}>
                              <td className="px-8 py-5 font-bold text-slate-600 font-mono text-xs">{inv.id}</td>
                              <td className="px-8 py-5 font-extrabold text-slate-800 font-poppins">{inv.clientName}</td>
                              <td className="px-8 py-5 font-medium text-slate-500">{formatDate(inv.date)}</td>
                              <td className="px-8 py-5 font-extrabold font-mono text-lg text-slate-800">{renderCurrency(inv.amount)}</td>
                              <td className="px-8 py-5"><span className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wide border ${INVOICE_STATUSES[inv.status]?.color || 'bg-white text-slate-500'}`}>{INVOICE_STATUSES[inv.status]?.label || inv.status}</span></td>
                              <td className="px-8 py-5 text-right"><span className="text-[#01189B] font-bold text-xs uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity flex justify-end items-center gap-1">Ouvrir <ArrowRight size={14}/></span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
              {activeView === 'contacts' && (
                <div className="flex flex-col h-full animate-fade-in pb-8">
                  <div className="flex justify-between items-center mb-8">
                     <h2 className="text-3xl font-extrabold text-slate-800 flex items-center gap-3 font-poppins"><Users style={{ color: BRAND_COLOR }} size={32}/> Base CRM & Pipeline</h2>
                     <button onClick={() => setShowModal('contact')} className="text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 hover:shadow-lg hover:-translate-y-0.5 transition-all" style={{ backgroundColor: BRAND_COLOR }}><Plus size={18} /> Nouveau Contact</button>
                  </div>
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col flex-1">
                    <div className="flex border-b border-slate-100 bg-slate-50/50 p-2 gap-2">
                      <button onClick={() => setContactFilterType('all')} className={`px-6 py-3 text-sm font-bold rounded-xl transition-colors font-poppins ${contactFilterType === 'all' ? 'bg-white text-[#01189B] shadow-sm border border-slate-100' : 'text-slate-500 hover:bg-slate-100 border border-transparent'}`}>Tous les contacts</button>
                      <button onClick={() => setContactFilterType('prospect')} className={`px-6 py-3 text-sm font-bold rounded-xl transition-colors font-poppins ${contactFilterType === 'prospect' ? 'bg-white text-[#01189B] shadow-sm border border-slate-100' : 'text-slate-500 hover:bg-slate-100 border border-transparent'}`}>Prospects en cours</button>
                      <button onClick={() => setContactFilterType('client')} className={`px-6 py-3 text-sm font-bold rounded-xl transition-colors font-poppins ${contactFilterType === 'client' ? 'bg-white text-[#01189B] shadow-sm border border-slate-100' : 'text-slate-500 hover:bg-slate-100 border border-transparent'}`}>Clients Gagnés</button>
                    </div>
                    <div className="flex-1 overflow-auto bg-slate-50/20">
                      {displayedContacts.length === 0 ? (
                         <div className="p-20 text-center text-slate-400 font-medium">Aucun contact trouvé dans cette catégorie.</div>
                      ) : (
                        <table className="w-full text-sm text-left">
                          <thead className="bg-white text-slate-400 uppercase font-extrabold text-[10px] tracking-wider border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                            <tr><th className="px-8 py-5">Société & Interlocuteur</th><th className="px-8 py-5">Étape Pipeline</th><th className="px-8 py-5">Rappel Actif</th><th className="px-8 py-5 text-right">Actions</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {displayedContacts.map((c) => {
                              const hasReminder = !!c.nextContactDate;
                              const isReminderDue = hasReminder && new Date(c.nextContactDate!) <= new Date();

                              return (
                                <tr key={c.id} onClick={() => setSelectedContactId(c.id)} className="bg-white hover:bg-blue-50/40 cursor-pointer group transition-colors">
                                  <td className="px-8 py-5">
                                    <p className="font-extrabold text-slate-800 font-poppins text-lg">{c.company}</p>
                                    <p className="text-slate-500 text-sm font-medium flex items-center gap-1"><Users size={14}/> {c.name}</p>
                                  </td>
                                  <td className="px-8 py-5"><span className={`px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-wide border ${PIPELINE_STAGES.find((s) => s.id === c.status)?.color}`}>{PIPELINE_STAGES.find((s) => s.id === c.status)?.label || c.status}</span></td>
                                  <td className="px-8 py-5">
                                    {hasReminder ? (
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${isReminderDue ? 'bg-red-100 text-red-700' : 'bg-orange-50 text-orange-600'}`}>
                                            <Bell size={14} className={isReminderDue ? 'animate-bounce' : ''}/>
                                            {isReminderDue ? 'Échu !' : formatDate(c.nextContactDate!)}
                                        </span>
                                    ) : (
                                        <span className="text-slate-300 italic text-xs">Aucun</span>
                                    )}
                                  </td>
                                  <td className="px-8 py-5 text-right"><button onClick={(e) => { e.stopPropagation(); handleDelete('contacts', c.id); }} className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={18} /></button></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* --- MODALS --- */}
        <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-[1000] no-print">
          {notifications.map((n) => (
            <div key={n.id} className={`p-4 rounded-2xl shadow-2xl border flex items-center gap-3 min-w-[320px] animate-fade-in ${n.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : n.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-white border-slate-100 text-slate-800'}`}>
              {n.type === 'success' ? <CheckCircle size={22} className="shrink-0" /> : n.type === 'error' ? <AlertTriangle size={22} className="shrink-0" /> : <Info size={22} className="text-[#01189B] shrink-0" />}
              <p className="font-bold text-sm font-poppins">{n.message}</p>
            </div>
          ))}
        </div>

        {confirmState.isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-fade-in border border-slate-100">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6 text-red-600 mx-auto shadow-sm"><AlertTriangle size={32} /></div>
              <h3 className="text-2xl font-extrabold text-center mb-3 font-poppins text-slate-800">{confirmState.title}</h3>
              <p className="text-slate-500 text-center font-medium mb-8 leading-relaxed">{confirmState.message}</p>
              <div className="flex gap-4">
                <button onClick={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))} className="flex-1 py-3.5 border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors">Annuler</button>
                <button onClick={confirmState.onConfirm} className="flex-1 py-3.5 text-white font-bold rounded-xl hover:opacity-90 transition-opacity shadow-md" style={{ backgroundColor: BRAND_COLOR }}>Confirmer</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal === 'contact' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white p-10 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 animate-fade-in overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-extrabold mb-8 font-poppins text-slate-800 flex items-center gap-3"><Users style={{ color: BRAND_COLOR }} size={24}/> Créer une fiche CRM</h3>
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.target as any); handleCreate('contacts', { name: fd.get('name'), company: fd.get('company'), email: fd.get('email'), phone: fd.get('phone'), address: fd.get('address'), status: fd.get('status') }); }} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Statut Initial</label>
                <select name="status" className="w-full border-2 border-slate-100 bg-slate-50 p-3.5 rounded-xl font-bold text-[#01189B] outline-none focus:border-[#01189B] focus:bg-white transition-colors">
                  <option value="nouveau">👤 Nouveau Prospect</option>
                  <option value="gagne">✅ Client Signé</option>
                </select>
              </div>
              <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Raison Sociale / Société</label><input name="company" required className="w-full border-2 border-slate-100 bg-slate-50 p-3.5 rounded-xl outline-none focus:border-[#01189B] focus:bg-white font-bold text-slate-800 transition-colors" placeholder="Société ABC" /></div>
              <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Interlocuteur</label><input name="name" required className="w-full border-2 border-slate-100 bg-slate-50 p-3.5 rounded-xl outline-none focus:border-[#01189B] focus:bg-white font-medium text-slate-800 transition-colors" placeholder="Nom Prénom" /></div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Adresse</label>
                <textarea name="address" className="w-full border-2 border-slate-100 bg-slate-50 p-3.5 rounded-xl outline-none focus:border-[#01189B] focus:bg-white transition-colors h-20 resize-none" placeholder="Rue, N°, Code Postal, Ville..."></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Email</label><input name="email" type="email" className="w-full border-2 border-slate-100 bg-slate-50 p-3.5 rounded-xl outline-none focus:border-[#01189B] focus:bg-white transition-colors" placeholder="@" /></div>
                <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Téléphone</label><input name="phone" className="w-full border-2 border-slate-100 bg-slate-50 p-3.5 rounded-xl outline-none focus:border-[#01189B] focus:bg-white transition-colors" placeholder="+41..." /></div>
              </div>
              <div className="pt-6 flex gap-4">
                <button type="button" onClick={() => setShowModal(null)} className="flex-1 py-4 border-2 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold transition-colors">Annuler</button>
                <button type="submit" className="flex-1 py-4 text-white rounded-xl font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all" style={{ backgroundColor: BRAND_COLOR }}>Créer Fiche</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal === 'product' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white p-10 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 animate-fade-in">
            <h3 className="text-2xl font-extrabold mb-8 font-poppins text-slate-800 flex items-center gap-3"><Package style={{ color: BRAND_COLOR }} size={24}/> {currentProduct ? 'Modifier l\'Offre' : 'Créer une Offre'}</h3>
            <form onSubmit={handleSaveProductForm} className="space-y-5">
              <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Titre de l'offre</label><input name="name" defaultValue={currentProduct?.name} required placeholder="Ex: 3ème Pilier" className="w-full border-2 border-slate-100 bg-slate-50 p-3.5 rounded-xl outline-none focus:border-[#01189B] focus:bg-white font-extrabold text-slate-800 transition-colors" /></div>
              <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Description</label><textarea name="description" defaultValue={currentProduct?.description} placeholder="Avantages, détails..." className="w-full border-2 border-slate-100 bg-slate-50 p-3.5 rounded-xl h-24 outline-none focus:border-[#01189B] focus:bg-white resize-none font-medium transition-colors"></textarea></div>
              <div className="grid grid-cols-2 gap-6">
                <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Prix Vente (CHF)</label><input name="price" defaultValue={currentProduct?.price} type="number" step="0.01" required className="w-full border-2 border-slate-100 bg-slate-50 p-3.5 rounded-xl outline-none focus:border-[#01189B] focus:bg-white font-extrabold text-[#01189B] transition-colors" /></div>
                <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Cible Achat (CHF)</label><input name="cost" defaultValue={currentProduct?.cost} type="number" step="0.01" required className="w-full border-2 border-slate-100 bg-slate-50 p-3.5 rounded-xl outline-none focus:border-orange-400 focus:bg-white font-extrabold text-orange-500 transition-colors" /></div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Plateforme d'acquisition</label>
                <select name="platform" defaultValue={currentProduct?.platform} className="w-full border-2 border-slate-100 bg-slate-50 p-3.5 rounded-xl outline-none focus:border-[#01189B] focus:bg-white font-bold text-slate-700 transition-colors">
                  <option value="meta">Meta Ads (Facebook/Insta)</option>
                  <option value="google">Google Ads</option>
                  <option value="tiktok">TikTok Ads</option>
                </select>
              </div>
              <div className="pt-6 flex gap-4">
                <button type="button" onClick={() => { setShowModal(null); setCurrentProduct(null); }} className="flex-1 py-4 border-2 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold transition-colors">Annuler</button>
                <button type="submit" className="flex-1 py-4 text-white rounded-xl font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all" style={{ backgroundColor: BRAND_COLOR }}>{currentProduct ? 'Mettre à jour' : 'Ajouter'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal === 'invoice' && currentInvoice && (
        <div className="fixed inset-0 bg-slate-900/95 z-[100] flex items-center justify-center p-4 md:p-6 backdrop-blur-md">
          <div className="bg-slate-100 w-full max-w-6xl h-[95vh] md:h-[90vh] rounded-3xl flex flex-col shadow-2xl overflow-hidden animate-fade-in border border-slate-700">
            <div className="h-20 border-b border-slate-200 flex justify-between items-center px-8 bg-white no-print shrink-0 z-10 shadow-sm">
              <h3 className="font-extrabold text-xl font-poppins text-slate-800 flex items-center gap-3"><FileText style={{ color: BRAND_COLOR }} size={24}/> Éditeur de Facture</h3>
              <div className="flex gap-4">
                <div className="flex items-center gap-3 mr-6 border-r border-slate-200 pr-6 hidden lg:flex">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">État</span>
                  <select 
                    value={currentInvoice.status || 'brouillon'} 
                    onChange={e => setCurrentInvoice({...currentInvoice, status: e.target.value})}
                    className="border-2 border-slate-100 p-2.5 rounded-xl bg-slate-50 hover:bg-white text-sm font-bold text-slate-700 outline-none focus:border-[#01189B] cursor-pointer transition-colors"
                  >
                    {Object.entries(INVOICE_STATUSES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <button onClick={handleDownloadPDF} className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl flex gap-2 items-center font-bold hover:bg-slate-200 transition-colors"><Download size={18} /> Télécharger PDF</button>
                <button onClick={handleEmailInvoice} className="px-5 py-2.5 bg-orange-100 text-orange-700 rounded-xl flex gap-2 items-center font-bold hover:bg-orange-200 transition-colors"><Mail size={18} /> Gérer Envoi Email</button>
                <button onClick={handleSaveInvoice} className="px-6 py-2.5 text-white rounded-xl flex gap-2 items-center font-bold hover:shadow-lg transition-all" style={{ backgroundColor: BRAND_COLOR }}><CheckCircle size={18} /> <span className="hidden md:block">Sauvegarder</span></button>
                <button onClick={() => setShowModal(null)} className="p-3 bg-white border border-slate-200 hover:text-red-500 hover:border-red-200 rounded-xl transition-colors"><X size={20} /></button>
              </div>
            </div>
            
            {/* Split screen: Left config, Right Invoice */}
            <div className="flex-1 flex overflow-hidden">
                <div className="w-1/3 bg-slate-50 p-6 overflow-y-auto border-r border-slate-200 no-print flex flex-col gap-6 custom-scrollbar">
                    
                    {currentInvoice.status === 'archive' && (
                        <div className="bg-red-50 p-5 rounded-2xl border border-red-200 text-red-800">
                            <h4 className="font-bold flex items-center gap-2 mb-2"><Archive size={16}/> Facture Archivée</h4>
                            <p className="text-xs mb-4">Cette facture a été marquée comme archivée (erreur, annulée, etc.). Si vous le souhaitez, vous pouvez la supprimer définitivement.</p>
                            <button onClick={handleDeleteInvoice} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
                                <Trash2 size={16}/> Supprimer Définitivement
                            </button>
                        </div>
                    )}

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <h4 className="font-bold text-slate-800 mb-3 text-sm uppercase tracking-wide flex items-center gap-2"><Users size={16} style={{ color: BRAND_COLOR }}/> Client Facturé (Modifiable)</h4>
                        <select className="bg-slate-50 border-2 border-slate-100 p-3 rounded-xl w-full font-bold outline-none focus:border-[#01189B] text-slate-800 transition-colors mb-3" onChange={(e) => { const c = contacts.find((co) => co.id === e.target.value); setCurrentInvoice({ ...currentInvoice, clientId: c?.id, clientName: c?.company, clientAddress: c?.address || '' } as any); if (c?.projectedBudget) { setInvoiceBudget(c.projectedBudget); if (c.interestedProductId) setInvoiceThemeId(c.interestedProductId); } }} value={currentInvoice.clientId}>
                            <option value="">-- Sélectionner depuis le CRM --</option>
                            {contacts.map((c) => (<option key={c.id} value={c.id}>{c.company}</option>))}
                        </select>
                        <div className="space-y-3 pt-3 border-t border-slate-100">
                           <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Nom d'affichage facture</label>
                              <input value={currentInvoice.clientName || ''} onChange={e => setCurrentInvoice({...currentInvoice, clientName: e.target.value})} className="w-full border-2 border-slate-100 bg-white p-2.5 rounded-xl font-bold outline-none focus:border-[#01189B] text-sm text-slate-700" placeholder="Nom de l'entreprise..." />
                           </div>
                           <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Adresse d'affichage facture</label>
                              <textarea value={currentInvoice.clientAddress || ''} onChange={e => setCurrentInvoice({...currentInvoice, clientAddress: e.target.value})} className="w-full border-2 border-slate-100 bg-white p-2.5 rounded-xl font-medium outline-none focus:border-[#01189B] text-sm text-slate-700 h-20 resize-none" placeholder="Adresse complète..."></textarea>
                           </div>
                        </div>
                    </div>

                    <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 shadow-sm">
                        <h4 className="font-bold text-[#01189B] mb-3 text-sm uppercase tracking-wide flex items-center gap-2"><Wand2 size={16}/> Générer Ligne Auto</h4>
                        <div className="space-y-4">
                            <div><label className="block text-[10px] font-bold text-blue-800 uppercase tracking-wide mb-1.5">Budget Mensuel</label><input type="number" value={invoiceBudget} onChange={(e) => setInvoiceBudget(e.target.value)} className="w-full border-2 border-white bg-white p-2.5 rounded-xl font-bold outline-none focus:border-[#01189B] text-sm" placeholder="Ex: 5000" /></div>
                            <div>
                                <label className="block text-[10px] font-bold text-blue-800 uppercase tracking-wide mb-1.5">Thématique</label>
                                <select value={invoiceThemeId} onChange={(e) => setInvoiceThemeId(e.target.value)} className="w-full border-2 border-white bg-white p-2.5 rounded-xl font-bold outline-none focus:border-[#01189B] text-sm text-slate-700">
                                    <option value="">-- Service --</option>{products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                                </select>
                            </div>
                            <div><label className="block text-[10px] font-bold text-blue-800 uppercase tracking-wide mb-1.5">Marge (%)</label><input type="number" value={invoiceMarginPercent} onChange={(e) => setInvoiceMarginPercent(Number(e.target.value))} className="w-full border-2 border-white bg-white p-2.5 rounded-xl text-[#01189B] font-bold outline-none focus:border-[#01189B] text-sm" /></div>
                            <button onClick={handleGenerateInvoice} className="w-full text-white px-4 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity text-sm shadow-sm" style={{ backgroundColor: BRAND_COLOR }}>Ajouter le produit</button>
                        </div>
                    </div>
                </div>

                {/* FACTURE A4 */}
                <div className="flex-1 overflow-auto bg-slate-200 p-8 flex justify-center custom-scrollbar">
                    <div id="invoice-printable" className="bg-white w-[210mm] min-h-[296mm] shadow-2xl p-[15mm] flex flex-col text-slate-800 relative shrink-0 box-border">
                        {currentInvoice.status === 'archive' && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 opacity-10 pointer-events-none select-none">
                                <span className="text-8xl font-extrabold uppercase tracking-widest text-slate-900">Archivée</span>
                            </div>
                        )}
                        <div className="flex justify-between mb-8 border-b-4 pb-4" style={{ borderColor: BRAND_COLOR }}>
                        <div>
                            <h1 className="text-4xl font-extrabold uppercase mb-2 font-poppins tracking-tight" style={{ color: BRAND_COLOR }}>Facture</h1>
                            <p className="font-mono text-slate-500 font-bold text-lg">#{currentInvoice.id || 'BROUILLON'}</p>
                            <p className="text-sm mt-1 font-bold text-slate-400 uppercase tracking-widest">Date : {formatDate(currentInvoice.date)}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-extrabold text-lg font-poppins">{settings.companyName}</p>
                            {settings.companyId && <p className="text-xs font-bold text-slate-400 mt-0.5 uppercase">{settings.companyId}</p>}
                            <p className="text-xs text-slate-500 whitespace-pre-wrap mt-1.5 leading-relaxed">{settings.address}</p>
                            <p className="text-xs text-slate-500 mt-1 font-medium">{settings.email} <br/> {settings.phone}</p>
                        </div>
                        </div>
                        
                        <div className="mb-8 flex justify-end relative z-10">
                            <div className="w-1/2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Facturé à</p>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 w-full">
                                    <div className="font-extrabold text-xl font-poppins text-slate-800">{currentInvoice.clientName || 'Client à définir...'}</div>
                                    {currentInvoice.clientAddress && <p className="text-sm mt-2 text-slate-600 whitespace-pre-wrap">{currentInvoice.clientAddress}</p>}
                                </div>
                            </div>
                        </div>

                        <div className="mb-6 flex items-center justify-between no-print relative z-10">
                            <button onClick={() => setCurrentInvoice({...currentInvoice, items: [...(currentInvoice.items || []), {name: 'Nouvelle prestation', description: '', price: 0, qty: 1}]})} className="text-xs font-bold bg-white text-[#01189B] px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50">+ Ligne Manuelle</button>
                        </div>

                        <table className="w-full mb-4 table-fixed relative z-10">
                        <thead>
                            <tr className="border-b-2 text-xs" style={{ borderColor: BRAND_COLOR }}>
                            <th className="text-left py-2 font-extrabold uppercase tracking-widest w-3/4" style={{ color: BRAND_COLOR }}>Désignation des prestations</th>
                            <th className="text-right py-2 font-extrabold uppercase tracking-widest w-1/4" style={{ color: BRAND_COLOR }}>Montant Net</th>
                            <th className="w-8 no-print"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {(currentInvoice.items || []).map((item, i) => (
                            <tr key={i} className="border-b border-slate-100 group relative">
                                <td className="py-3 pr-4 align-top">
                                    <input 
                                        value={item.name} 
                                        onChange={(e) => {
                                        const newItems = [...(currentInvoice.items || [])];
                                        newItems[i].name = e.target.value;
                                        setCurrentInvoice({ ...currentInvoice, items: newItems } as Invoice);
                                        }}
                                        className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-[#01189B] outline-none font-bold text-slate-800 text-sm print-input py-1 px-1 rounded transition-colors"
                                        placeholder="Nom de la prestation"
                                    />
                                    <textarea 
                                        value={item.description || ''} 
                                        onChange={(e) => {
                                        const newItems = [...(currentInvoice.items || [])];
                                        newItems[i].description = e.target.value;
                                        setCurrentInvoice({ ...currentInvoice, items: newItems } as Invoice);
                                        }}
                                        className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-[#01189B] outline-none font-medium text-slate-500 text-xs print-input py-1 px-1 resize-none overflow-hidden rounded mt-0.5 transition-colors"
                                        rows={2}
                                        placeholder="Description détaillée (optionnelle)..."
                                        onInput={(e) => { e.currentTarget.style.height = "auto"; e.currentTarget.style.height = (e.currentTarget.scrollHeight) + "px"; }}
                                    />
                                </td>
                                <td className="py-3 text-right align-top">
                                    <input 
                                        type="number"
                                        value={item.price} 
                                        onChange={(e) => {
                                        const newItems = [...(currentInvoice.items || [])];
                                        newItems[i].price = Number(e.target.value);
                                        setCurrentInvoice({ ...currentInvoice, items: newItems } as Invoice);
                                        }}
                                        className="w-32 bg-transparent border border-transparent hover:border-slate-200 focus:border-[#01189B] outline-none font-extrabold text-lg font-mono text-slate-800 text-right print-input py-1 px-1 rounded transition-colors inline-block"
                                    />
                                </td>
                                <td className="py-3 no-print text-center align-top pt-4">
                                    <button onClick={() => {
                                        const newItems = [...(currentInvoice.items || [])];
                                        newItems.splice(i, 1);
                                        setCurrentInvoice({ ...currentInvoice, items: newItems } as Invoice);
                                    }} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white shadow-sm p-1 rounded">
                                        <Trash2 size={16}/>
                                    </button>
                                </td>
                            </tr>
                            ))}
                            {(currentInvoice.items || []).length === 0 && (
                            <tr><td colSpan={3} className="py-12 text-center text-slate-400 italic text-sm font-medium border-dashed border-2 border-slate-200 rounded-xl mt-4">Aucune prestation facturée. Utilisez le panneau à gauche pour générer les lignes.</td></tr>
                            )}
                        </tbody>
                        </table>

                        <div className="flex justify-end pt-6 mb-8 relative z-10">
                            <div className="w-72 space-y-2">
                                <div className="flex justify-between text-slate-500 font-bold text-sm"><span>Sous-total HT</span> <span className="font-mono text-slate-800">{formatCurrency((currentInvoice.items || []).reduce((acc, i) => acc + i.price * (i.qty || 1), 0))}</span></div>
                                <div className="flex justify-between text-slate-400 font-medium text-xs"><span>TVA (0.0%)</span> <span className="font-mono">0.00 CHF</span></div>
                                <div className="flex justify-between py-3 border-t-2 mt-2 text-xl font-extrabold font-poppins" style={{ borderColor: BRAND_COLOR, color: BRAND_COLOR }}>
                                    <span>Total TTC</span> <span>{formatCurrency((currentInvoice.items || []).reduce((acc, i) => acc + i.price * (i.qty || 1), 0))}</span>
                                </div>
                            </div>
                        </div>

                        {/* Pied de facture placé tout en bas via mt-auto */}
                        <div className="mt-auto relative z-10 bg-white">
                            <div className="border-t border-slate-200 grid grid-cols-2 gap-8 text-xs pt-4 mb-8">
                                <div>
                                    <p className="font-extrabold text-slate-800 mb-1.5 uppercase tracking-widest text-[10px]">Coordonnées Bancaires</p>
                                    {settings.bankDetails ? (
                                    <p className="whitespace-pre-wrap text-slate-600 font-mono text-[10px] leading-relaxed border-l-2 pl-3" style={{ borderColor: BRAND_COLOR }}>{settings.bankDetails}</p>
                                    ) : (
                                    <p className="text-slate-400 italic text-[10px]">A configurer dans les paramètres.</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="font-extrabold text-slate-800 mb-1.5 uppercase tracking-widest text-[10px]">Informations</p>
                                    <p className="whitespace-pre-wrap text-[10px] text-slate-500 font-medium leading-relaxed">{settings.invoiceFooter}</p>
                                </div>
                            </div>

                            {/* LIGNE LEGALE CENTREE EN BAS */}
                            {settings.legalNotice && (
                                <div className="text-center w-full pt-4 pb-2 text-[10px] text-slate-400 font-medium uppercase tracking-widest border-t border-slate-100">
                                    {settings.legalNotice}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL EMAIL DIRECT / APERÇU --- */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-100 animate-fade-in flex flex-col md:flex-row gap-8">
            
            {/* Colonne Explications / Templates */}
            <div className="w-full md:w-1/3 flex flex-col gap-6">
                <div>
                    <h3 className="text-2xl font-extrabold font-poppins text-slate-800 flex items-center gap-3"><Send style={{ color: BRAND_COLOR }} size={24}/> Envoi Auto</h3>
                    <p className="text-sm text-slate-500 mt-2 font-medium">Le CRM va générer le PDF et l'envoyer via votre Webhook. Choisissez un modèle pour préremplir le message.</p>
                </div>
                
                <div className="space-y-3 flex-1 overflow-auto custom-scrollbar">
                    <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wider mb-2">Modèles de Message</h4>
                    {(settings.emailTemplates || []).map(tpl => (
                        <button 
                            key={tpl.id}
                            onClick={() => applyEmailTemplate(tpl.id, currentInvoice!, emailData.to)}
                            className={`w-full text-left p-3 rounded-xl border-2 transition-all ${emailData.selectedTemplate === tpl.id ? 'border-[#01189B] bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}
                        >
                            <p className={`font-bold text-sm ${emailData.selectedTemplate === tpl.id ? 'text-[#01189B]' : 'text-slate-700'}`}>{tpl.name}</p>
                            <p className="text-[10px] text-slate-500 mt-1 uppercase truncate font-bold">{tpl.subject}</p>
                        </button>
                    ))}
                    {(settings.emailTemplates || []).length === 0 && (
                        <p className="text-xs text-slate-400 italic">Aucun modèle créé. Allez dans Paramètres.</p>
                    )}
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-auto">
                    <p className="text-xs font-bold text-slate-500 flex items-center gap-2 mb-2"><ShieldCheck size={16} className="text-emerald-500"/> Serveur Sécurisé</p>
                    <p className="text-[10px] text-slate-400">La facture est envoyée via l'API. L'expéditeur affiché sera <strong>{settings.email}</strong>.</p>
                </div>
            </div>

            {/* Colonne Formulaire Email */}
            <div className="flex-1 space-y-5 bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-inner">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Destinataire (À)</label>
                <input value={emailData.to} onChange={e => setEmailData({...emailData, to: e.target.value})} className="w-full border-2 border-slate-200 bg-white p-3 rounded-xl outline-none focus:border-[#01189B] font-medium text-slate-800 transition-colors" placeholder="email@client.com" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Sujet de l'email</label>
                <input value={emailData.subject} onChange={e => setEmailData({...emailData, subject: e.target.value})} className="w-full border-2 border-slate-200 bg-white p-3 rounded-xl outline-none focus:border-[#01189B] font-bold text-slate-800 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 flex justify-between items-center">
                    Message
                    <button onClick={() => applyEmailTemplate(emailData.selectedTemplate, currentInvoice!, emailData.to)} className="text-[10px] text-blue-500 hover:underline flex items-center gap-1"><RefreshCcw size={10}/> Réinitialiser avec le modèle</button>
                </label>
                <textarea value={emailData.body} onChange={e => setEmailData({...emailData, body: e.target.value})} className="w-full border-2 border-slate-200 bg-white p-4 rounded-xl h-48 outline-none focus:border-[#01189B] resize-none text-slate-700 transition-colors text-sm leading-relaxed custom-scrollbar"></textarea>
              </div>

              {/* Pièce jointe simulée visuellement */}
              <div className="bg-white border-2 border-dashed border-blue-200 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-50 rounded-lg text-red-500"><FileText size={20}/></div>
                  <div>
                    <p className="font-bold text-[#01189B] text-sm">Facture_{currentInvoice?.clientName || 'Client'}_{currentInvoice?.id}.pdf</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Sera généré automatiquement</p>
                  </div>
                </div>
                <Paperclip className="text-blue-300" size={20}/>
              </div>
              
              <div className="pt-4 flex gap-4 border-t border-slate-200 mt-6">
                <button disabled={emailData.isSending} onClick={() => setShowEmailModal(false)} className="px-6 py-3.5 bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-colors disabled:opacity-50">Annuler</button>
                <button disabled={emailData.isSending} onClick={handleSendEmailFromModal} className="flex-1 py-3.5 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70" style={{ backgroundColor: BRAND_COLOR }}>
                  {emailData.isSending ? <><Loader size={18} className="animate-spin"/> Transmission API...</> : <><Send size={18}/> Envoyer le message</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}