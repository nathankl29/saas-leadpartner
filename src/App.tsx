import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Users, Settings, Plus, Search, 
  ChevronLeft, FileText, Package, Printer, Trash2, CheckCircle, Clock, 
  MessageSquare, Briefcase, PlayCircle, StopCircle, Target,
  TrendingUp, Calculator, ArrowRight,
  CalendarCheck, Globe, Share2, Loader, Lock, Wallet, LogIn, Edit2, Save, Wand2, Send, BarChart3
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, setDoc, writeBatch
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken
} from 'firebase/auth';
import type { User } from 'firebase/auth';

// --- TYPES & INTERFACES ---
interface Product {
  id: string;
  name: string;
  price: number; // CPL VENDU
  cost?: number; // CPL ACHAT
  platform?: string;
  description?: string;
}

interface Contact {
  id: string;
  name: string;
  company: string;
  email?: string;
  phone?: string;
  status: string;
  projectedBudget?: number;
  interestedProductId?: string;
  campaignStartDate?: string | null;
  createdAt?: string;
}

interface InvoiceItem {
  name: string;
  price: number;
  qty: number;
  cost?: number;
}

interface Invoice {
  id: string;
  date: string;
  clientId: string;
  clientName: string;
  status: string;
  amount: number;
  items: InvoiceItem[];
}

interface Interaction {
  id: string;
  contactId: string;
  type: string;
  content: string;
  createdAt: string;
}

interface Simulation {
  id: string;
  budget: number;
  productId: string;
  productName: string;
  productPlatform?: string;
  clientId?: string; // Ajout du client
  clientName?: string; // Ajout du nom du client
  stats: {
    volumeTotal: number;
    costTotal: number;
    profit: number;
    dailyVolume: number;
    dailyBudget: number;
    margin: number;
    fees: number;
    arbitrage: number;
  };
  createdAt: string;
}

interface AppSettings {
  companyName: string;
  address: string;
  email: string;
  phone: string;
  iban: string;
  invoiceFooter: string;
  primaryColor: string;
  logoUrl: string;
}

// --- CONFIGURATION FIREBASE ---
const firebaseConfig = JSON.parse((window as any).__firebase_config || '{}');
const RAW_APP_ID = (window as any).__app_id || 'leadpartner-crm-v29-projections';
const APP_ID = RAW_APP_ID.replace(/[^a-zA-Z0-9-_]/g, '_');

let app: any, db: any, auth: any;
try {
  if (Object.keys(firebaseConfig).length > 0) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  } else {
    console.warn("Mode Hors-Ligne activé (Config Firebase manquante)");
  }
} catch (e) {
  console.error("Erreur init Firebase:", e);
}

// --- CONSTANTES ---
const PIPELINE_STAGES = [
  { id: 'nouveau', label: 'Nouveau', color: 'bg-slate-100 border-slate-300' },
  { id: 'qualification', label: 'Qualification', color: 'bg-blue-50 border-blue-200' },
  { id: 'proposition', label: 'Proposition', color: 'bg-indigo-50 border-indigo-200' },
  { id: 'negociation', label: 'Négociation', color: 'bg-orange-50 border-orange-200' },
  { id: 'gagne', label: 'Gagné (Client)', color: 'bg-emerald-50 border-emerald-200' },
  { id: 'perdu', label: 'Perdu', color: 'bg-red-50 border-red-200' }
];

const INVOICE_STATUSES: Record<string, { label: string, color: string }> = {
  'brouillon': { label: 'Brouillon', color: 'bg-slate-100 text-slate-600' },
  'envoyee': { label: 'Envoyée', color: 'bg-blue-100 text-blue-600' },
  'payee': { label: 'Payée', color: 'bg-emerald-100 text-emerald-600' },
  'retard': { label: 'En retard', color: 'bg-red-100 text-red-600' }
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatCurrency = (amount?: number) => {
  return new Intl.NumberFormat('fr-CH', { 
    style: 'currency', 
    currency: 'CHF', 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(Number(amount || 0));
};

const getCampaignProgress = (startDate?: string | null) => {
  if (!startDate) return null;
  const start = new Date(startDate);
  const now = new Date();
  const diffTime = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
  
  if (diffDays < 0) return { day: 0, percent: 0, label: 'Démarre bientôt', finished: false };
  if (diffDays >= 30) return { day: 30, percent: 100, finished: true, label: 'Terminée (Relancer !)' };
  
  return { day: diffDays, percent: (diffDays / 30) * 100, finished: false, label: `Jour ${diffDays} / 30` };
};

// --- COMPOSANT LOGIN ---
const LoginScreen = ({ onLogin }: { onLogin: () => void }) => {
  const [email, setEmail] = useState('admin@leadpartner.ch');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      onLogin(); 
    } else {
      setError("Veuillez remplir les champs");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        <div className="bg-blue-600 p-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <span className="text-2xl font-bold text-white">LP</span>
          </div>
          <h1 className="text-2xl font-bold text-white">LeadPartner CRM</h1>
          <p className="text-blue-100 text-sm mt-2">Gestion d'agence & Arbitrage LeadGen</p>
        </div>
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="nom@exemple.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mot de passe</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
            <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"><LogIn size={20}/> Se connecter</button>
          </form>
          <div className="mt-6 text-center"><p className="text-xs text-slate-400">Version 29.0 (Secure Projections)</p></div>
        </div>
      </div>
    </div>
  );
};

// --- COMPOSANT PRINCIPAL ---
export default function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAppAuthenticated, setIsAppAuthenticated] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  
  // Données
  const [settings, setSettings] = useState<AppSettings>({
    companyName: "Mon Agence LeadGen",
    address: "Adresse de l'agence...",
    email: "contact@agence.ch",
    phone: "",
    iban: "",
    invoiceFooter: "Non soumis à la TVA. Paiement à 30 jours net.",
    primaryColor: "#2563eb",
    logoUrl: ""
  });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]); 
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  
  // UI States
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const selectedContact = useMemo(() => contacts.find(c => c.id === selectedContactId) || null, [contacts, selectedContactId]);

  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editContactData, setEditContactData] = useState<Partial<Contact>>({});
  const [newNoteContent, setNewNoteContent] = useState("");

  const [showModal, setShowModal] = useState<string | null>(null);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentInvoice, setCurrentInvoice] = useState<Partial<Invoice> | null>(null);
  const [contactFilterType, setContactFilterType] = useState('all');

  // Facturation
  const [invoiceBudget, setInvoiceBudget] = useState<number | string>(0);
  const [invoiceThemeId, setInvoiceThemeId] = useState('');
  const [invoiceMarginPercent, setInvoiceMarginPercent] = useState(35);

  // Planificateur
  const [planBudget, setPlanBudget] = useState(1000); 
  const [planProductId, setPlanProductId] = useState('');
  const [planClientId, setPlanClientId] = useState(''); // NEW: Link to client

  // Trésorerie / Projections
  const [treasuryUnlocked, setTreasuryUnlocked] = useState(false);
  const [treasuryPasswordInput, setTreasuryPasswordInput] = useState('');
  const [paperMarginPercent, setPaperMarginPercent] = useState(35); // Default for comparison

  // --- AUTH ---
  useEffect(() => {
    const initAuth = async () => {
      if (!auth) {
         setIsOfflineMode(true);
         setUser({ uid: 'offline', email: 'demo@offline' } as User);
         setLoading(false);
         return;
      }
      if ((window as any).__initial_auth_token) await signInWithCustomToken(auth, (window as any).__initial_auth_token);
      else {
         try { await signInAnonymously(auth); } 
         catch(e) { setIsOfflineMode(true); setUser({ uid: 'offline', email: 'demo@offline' } as User); }
      }
    };
    initAuth();
    if(auth) {
        const unsubscribe = onAuthStateChanged(auth, (u) => { 
            if(u) { setUser(u); setIsOfflineMode(false); }
            setLoading(false); 
        });
        return () => unsubscribe();
    } else { setLoading(false); }
  }, []);

  // --- SYNC ---
  useEffect(() => {
    if (!user || isOfflineMode || !db) return;
    const basePath = `artifacts/${APP_ID}/users/${user.uid}`;
    try {
        const unsubs = [
        onSnapshot(collection(db, `${basePath}/contacts`), (s: any) => setContacts(s.docs.map((d: any) => ({id: d.id, ...d.data()} as Contact)))),
        onSnapshot(collection(db, `${basePath}/products`), (s: any) => setProducts(s.docs.map((d: any) => ({id: d.id, ...d.data()} as Product)))),
        onSnapshot(collection(db, `${basePath}/invoices`), (s: any) => setInvoices(s.docs.map((d: any) => ({id: d.id, ...d.data()} as Invoice)))),
        onSnapshot(collection(db, `${basePath}/interactions`), (s: any) => setInteractions(s.docs.map((d: any) => ({id: d.id, ...d.data()} as Interaction)))),
        onSnapshot(collection(db, `${basePath}/simulations`), (s: any) => setSimulations(s.docs.map((d: any) => ({id: d.id, ...d.data()} as Simulation)))),
        onSnapshot(doc(db, `${basePath}/config`, 'general'), (s: any) => { if(s.exists()) setSettings(prev => ({...prev, ...s.data()} as AppSettings)) })
        ];
        return () => unsubs.forEach(u => u());
    } catch(e) { setIsOfflineMode(true); }
  }, [user, isOfflineMode]);

  // --- FILTRES & STATS ---
  const displayedContacts = useMemo(() => {
    let filtered = contacts.filter(c => 
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.company?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (contactFilterType === 'client') filtered = filtered.filter(c => c.status === 'gagne');
    else if (contactFilterType === 'prospect') filtered = filtered.filter(c => c.status !== 'gagne' && c.status !== 'perdu');
    return filtered;
  }, [contacts, searchTerm, contactFilterType]);

  const stats = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const monthInvoices = invoices.filter(i => new Date(i.date).getMonth() === currentMonth);
    const activeCampaigns = contacts.filter(c => c.campaignStartDate).length;
    return {
      caMensuel: monthInvoices.reduce((acc, i) => acc + Number(i.amount ?? 0), 0),
      caTotal: invoices.reduce((acc, i) => i.status === 'payee' ? acc + Number(i.amount ?? 0) : acc, 0),
      pipelineValue: contacts.reduce((acc, c) => (c.status !== 'gagne' && c.status !== 'perdu') ? acc + Number(c.projectedBudget ?? 0) : acc, 0),
      activeCampaigns
    };
  }, [invoices, contacts]);

  // --- ACTIONS ---
  const handleCreate = async (col: string, data: any) => { 
      if(isOfflineMode) return alert("Mode hors-ligne");
      if (!user) return; 
      await addDoc(collection(db, `artifacts/${APP_ID}/users/${user.uid}/${col}`), { ...data, createdAt: new Date().toISOString() }); 
      setShowModal(null); 
  };
  
  const handleUpdate = async (col: string, id: string, data: any) => { 
    if(isOfflineMode || !user) return;
    await updateDoc(doc(db, `artifacts/${APP_ID}/users/${user.uid}/${col}`, id), data); 
  };
  
  const handleDelete = async (col: string, id: string) => { 
    if(isOfflineMode || !user) return;
    if (confirm("Confirmer la suppression ?")) await deleteDoc(doc(db, `artifacts/${APP_ID}/users/${user.uid}/${col}`, id)); 
    if (col === 'contacts' && selectedContactId === id) setSelectedContactId(null); 
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
      if(!selectedContactId || !user) return;
      await handleUpdate('contacts', selectedContactId, editContactData);
      setIsEditingContact(false);
  };

  const handleAddQuickNote = async () => {
      if(!selectedContactId || !newNoteContent.trim() || !user) return;
      await handleCreate('interactions', {
          contactId: selectedContactId,
          type: 'note',
          content: newNoteContent,
      });
      setNewNoteContent("");
  };

  const handleSaveSimulation = async (simStats: any) => {
      if(!user) return;
      const activeProduct = products.find(p => p.id === planProductId);
      const activeClient = contacts.find(c => c.id === planClientId);
      
      if(!activeProduct) return;
      
      const simData: Omit<Simulation, 'id'> = { 
          budget: planBudget, 
          productId: planProductId, 
          productName: activeProduct.name, 
          productPlatform: activeProduct.platform, 
          clientId: planClientId, // Link to client
          clientName: activeClient ? activeClient.company : 'Client Inconnu',
          stats: simStats, 
          createdAt: new Date().toISOString() 
      };
      
      await addDoc(collection(db, `artifacts/${APP_ID}/users/${user.uid}/simulations`), simData);
  };

  const handleSaveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const newSettings = { companyName: fd.get('companyName'), address: fd.get('address'), email: fd.get('email'), phone: fd.get('phone'), iban: fd.get('iban'), invoiceFooter: fd.get('invoiceFooter'), logoUrl: fd.get('logoUrl'), primaryColor: settings.primaryColor };
    await setDoc(doc(db, `artifacts/${APP_ID}/users/${user.uid}/config`, 'general'), newSettings);
    setSettings(newSettings as AppSettings);
    alert("Paramètres sauvegardés !");
  };

  const loadDemoData = async (silent: boolean = false) => {
    if (isOfflineMode || !user) return;
    if (!silent && !confirm("⚠️ Charger les données de démonstration ?")) return;
    try {
      const batch = writeBatch(db);
      const basePath = `artifacts/${APP_ID}/users/${user.uid}`;
      const confRef = doc(db, `${basePath}/config/general`);
      batch.set(confRef, { companyName: "LeadGen Performance", address: "Place de la Gare 4\n1003 Lausanne", email: "hello@leadgen-perf.ch", phone: "+41 21 000 00 00", iban: "CH50 0900 0000 0000 0000 0", invoiceFooter: "Non soumis à la TVA. Paiement net à 30 jours.", primaryColor: "#2563eb", logoUrl: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png" });
      const p1Ref = doc(collection(db, `${basePath}/products`)); batch.set(p1Ref, { name: "Leads 3ème Pilier", price: 120, cost: 35, platform: "meta", description: "Leads qualifiés 3A" });
      const p2Ref = doc(collection(db, `${basePath}/products`)); batch.set(p2Ref, { name: "Assurance Maladie", price: 65, cost: 18, platform: "google", description: "Leads LAMal" });
      const p3Ref = doc(collection(db, `${basePath}/products`)); batch.set(p3Ref, { name: "Gestion de Fortune", price: 250, cost: 80, platform: "meta", description: "Investisseurs qualifiés" });
      const c1Ref = doc(collection(db, `${basePath}/contacts`)); batch.set(c1Ref, { name: "Jean Dupont", company: "Allianz Agence Dupont", email: "jean@dupont-assur.ch", phone: "079 123 45 67", status: "gagne", projectedBudget: 15000, interestedProductId: p1Ref.id, campaignStartDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), createdAt: new Date().toISOString() });
      const c2Ref = doc(collection(db, `${basePath}/contacts`)); batch.set(c2Ref, { name: "Marie Curie", company: "Curie Courtage", email: "marie@curie.ch", phone: "078 987 65 43", status: "negociation", projectedBudget: 5000, interestedProductId: p2Ref.id, createdAt: new Date().toISOString() });
      const i1 = doc(collection(db, `${basePath}/invoices`)); batch.set(i1, { id: "INV-2024-001", date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), clientId: c1Ref.id, clientName: "Allianz Agence Dupont", status: "payee", amount: 6000, items: [{ name: "Budget Net Investi - Leads 3ème Pilier (meta)", price: 3900, qty: 1 }, { name: "Frais de Gestion & Optimisation (35%)", price: 2100, qty: 1 }] });
      await batch.commit();
      alert("✅ Données de démo chargées !");
      setActiveView('dashboard');
    } catch (e) { console.error("Erreur demo:", e); }
  };

  const handleGenerateInvoice = () => {
      if(!invoiceBudget || !invoiceThemeId) return;
      const theme = products.find(p => p.id === invoiceThemeId);
      const budget = Number(invoiceBudget);
      const margin = Number(invoiceMarginPercent) / 100;
      
      const mediaBudget = budget * (1 - margin);
      const managementFees = budget * margin;

      const newItems = [
          { name: `Budget Net Investi - ${theme?.name || 'Campagne'} (${theme?.platform || 'Mix'})`, price: mediaBudget, qty: 1 },
          { name: `Frais de Gestion & Optimisation (${invoiceMarginPercent}%)`, price: managementFees, qty: 1 }
      ];
      setCurrentInvoice({...currentInvoice, items: newItems} as Invoice);
  };

  const handleSaveInvoice = async () => {
    if (!user || !currentInvoice?.clientId) return alert("Client requis.");
    // Ensure currentInvoice items have default values if undefined
    const items = currentInvoice.items || [];
    const amount = items.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const client = contacts.find(c => c.id === currentInvoice.clientId);
    
    const invData = { 
        ...currentInvoice, 
        amount, 
        clientName: client?.company || 'Client Inconnu' 
    };

    if (invData.id) await handleUpdate('invoices', invData.id, invData);
    else await setDoc(doc(db, `artifacts/${APP_ID}/users/${user!.uid}/invoices`, `INV-${Date.now()}`), { ...invData, status: 'brouillon', date: new Date().toISOString() });
    setShowModal(null);
  };

  const toggleCampaign = async (contact: Contact) => {
    if (contact.campaignStartDate) { if(confirm("Arrêter la campagne ?")) await handleUpdate('contacts', contact.id, { campaignStartDate: null }); } 
    else await handleUpdate('contacts', contact.id, { campaignStartDate: new Date().toISOString() });
  };

  const handleTreasuryUnlock = (e: React.FormEvent) => { e.preventDefault(); if (treasuryPasswordInput === 'Naha') { setTreasuryUnlocked(true); setTreasuryPasswordInput(''); } else alert("Mdp incorrect."); };

  // --- RENDERERS ---
  
  // VUE PROJECTIONS (SÉCURISÉE + KPIs + SIMULATEUR)
  const renderProjections = () => {
    if (!treasuryUnlocked) return (
      <div className="flex items-center justify-center h-full bg-slate-50 animate-fade-in"><div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm text-center"><div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-500"><Lock size={24}/></div><h3 className="font-bold text-lg mb-2">Accès Sécurisé</h3><form onSubmit={handleTreasuryUnlock}><input type="password" autoFocus placeholder="Mot de passe" className="w-full border p-3 rounded-lg mb-4 text-center tracking-widest outline-none focus:ring-2 focus:ring-blue-500" value={treasuryPasswordInput} onChange={e => setTreasuryPasswordInput(e.target.value)}/><button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold">Déverrouiller</button></form></div></div>
    );

    // Calcul des KPIs Globaux sur toutes les simulations
    let globalStats = { profit: 0, realSpend: 0, volume: 0, dailySpend: 0 };
    simulations.forEach(sim => {
        globalStats.profit += Number(sim.stats?.profit ?? 0);
        globalStats.realSpend += Number(sim.stats?.costTotal ?? 0);
        globalStats.volume += Number(sim.stats?.volumeTotal ?? 0);
        globalStats.dailySpend += Number(sim.stats?.dailyBudget ?? 0);
    });

    // Logique du Simulateur
    const activeProduct = products.find(p => p.id === planProductId) || products[0];
    let planStats = { volumeTotal: 0, costTotal: 0, profit: 0, dailyVolume: 0, dailyBudget: 0, margin: 0, fees: 0, arbitrage: 0 };
    
    if (activeProduct && planBudget > 0 && activeProduct.price > 0) {
        // 1. Frais de Gestion (35% fixe)
        const fees = planBudget * 0.35;
        // 2. Budget Média Client (65%)
        const netMedia = planBudget * 0.65;
        // 3. Volume à livrer = Net Media / CPL Vendu
        const volumeTotal = Math.floor(netMedia / activeProduct.price);
        // 4. Coût Réel = Volume * CPL Achat
        const costTotal = volumeTotal * Number(activeProduct.cost ?? 0);
        // 5. Arbitrage = Net Media - Coût Réel
        const arbitrage = netMedia - costTotal;
        // 6. Marge Totale = Frais + Arbitrage
        const profit = fees + arbitrage;
        
        const margin = (profit / planBudget) * 100;
        
        planStats = { 
            volumeTotal, 
            costTotal, 
            profit, 
            dailyVolume: volumeTotal/30, 
            dailyBudget: costTotal/30, 
            margin,
            fees,
            arbitrage
        };
    }

    return (
      <div className="space-y-8 animate-fade-in pb-12">
        
        {/* KPI DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Marge Nette (Poche)</p>
                <h3 className="text-2xl font-bold text-emerald-600">{formatCurrency(globalStats.profit)}</h3>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Budget Pub Réel</p>
                <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(globalStats.realSpend)}</h3>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Volume Leads Total</p>
                <h3 className="text-2xl font-bold text-blue-600">{globalStats.volume}</h3>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Dépense / Jour (Global)</p>
                <h3 className="text-2xl font-bold text-orange-600">{formatCurrency(globalStats.dailySpend)}</h3>
            </div>
        </div>

        {/* SIMULATEUR AVEC ASSIGNATION */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
           <div className="bg-slate-900 p-6 text-white flex justify-between items-center"><div><h2 className="text-xl font-bold flex items-center gap-2"><CalendarCheck className="text-blue-400"/> Nouvelle Projection (35% + Arbitrage)</h2><p className="text-slate-400 text-sm">Estimez la rentabilité réelle d'une campagne.</p></div></div>
           <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4 space-y-6 border-r border-slate-100 pr-6">
                 <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">1. Client (Optionnel)</label><select value={planClientId} onChange={(e) => setPlanClientId(e.target.value)} className="w-full border border-slate-300 rounded-lg p-3 font-medium outline-none focus:ring-2 focus:ring-blue-500"><option value="">-- Aucun --</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}</select></div>
                 <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">2. Thématique</label><select value={planProductId} onChange={(e) => setPlanProductId(e.target.value)} className="w-full border border-slate-300 rounded-lg p-3 font-medium outline-none focus:ring-2 focus:ring-blue-500">{!planProductId && <option value="">-- Sélectionner --</option>}{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                 <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">3. Budget Client</label><div className="relative"><input type="number" value={planBudget} onChange={(e) => setPlanBudget(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg p-3 pl-4 font-bold text-2xl outline-none focus:ring-2 focus:ring-blue-500 text-blue-600"/><span className="absolute right-4 top-4 text-sm text-slate-400 font-bold">CHF</span></div></div>
                 <button onClick={() => handleSaveSimulation(planStats)} className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors"><Plus size={18}/> Sauvegarder Projection</button>
              </div>
              <div className="lg:col-span-8 flex flex-col justify-center">
                 {!activeProduct ? <div className="text-center text-slate-400 italic py-10 flex flex-col items-center"><ArrowRight className="mb-2 opacity-50"/> Sélectionner une thématique.</div> : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
                           <p className="text-slate-500 text-xs font-bold uppercase mb-2">Volume Leads</p>
                           <div className="text-center py-2"><span className="text-4xl font-bold text-slate-800">{planStats.volumeTotal}</span></div>
                           <div className="text-center border-t pt-2 mt-2 text-xs text-slate-400">Budget Net Média: {formatCurrency(planBudget * 0.65)}</div>
                       </div>
                       <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 relative overflow-hidden flex flex-col justify-between shadow-sm">
                           <p className="text-blue-800 text-xs font-bold uppercase mb-2">Coût Réel (Vous)</p>
                           <div className="text-center py-2"><span className="text-3xl font-bold text-blue-700">{formatCurrency(planStats.costTotal)}</span></div>
                           <div className="text-center border-t border-blue-200 pt-2 mt-2"><p className="text-xs text-blue-500 font-bold">~{formatCurrency(planStats.dailyBudget)} / jour</p></div>
                       </div>
                       <div className={`p-5 rounded-xl border flex flex-col justify-between shadow-sm ${planStats.margin >= 30 ? 'bg-emerald-50 border-emerald-100' : 'bg-orange-50 border-orange-100'}`}>
                           <p className={`${planStats.margin >= 30 ? 'text-emerald-800' : 'text-orange-800'} text-xs font-bold uppercase mb-2`}>Marge Nette</p>
                           <div className="text-center py-2"><span className={`text-3xl font-bold ${planStats.margin >= 30 ? 'text-emerald-700' : 'text-orange-700'}`}>{formatCurrency(planStats.profit)}</span></div>
                           <div className="text-center border-t border-emerald-200 pt-2 mt-2 flex justify-between px-2">
                               <p className="text-[10px] text-emerald-800">Frais: {formatCurrency(planStats.fees)}</p>
                               <p className="text-[10px] text-emerald-800">Arb: {formatCurrency(planStats.arbitrage)}</p>
                           </div>
                       </div>
                    </div>
                 )}
              </div>
           </div>
        </div>
        
        {/* TABLEAU DES SIMULATIONS */}
        <div><h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Save size={20}/> Projections Enregistrées</h2><div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">{simulations.length === 0 ? (<div className="p-8 text-center text-slate-400 italic">Aucune projection enregistrée.</div>) : (<table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b"><tr><th className="px-6 py-4">Client</th><th className="px-6 py-4">Thématique</th><th className="px-6 py-4">Budget</th><th className="px-6 py-4">Volume</th><th className="px-6 py-4">Coût Réel</th><th className="px-6 py-4">Marge Nette</th><th className="px-6 py-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{simulations.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(sim => (<tr key={sim.id} className="hover:bg-slate-50"><td className="px-6 py-4 font-bold text-blue-600">{sim.clientName || 'N/A'}</td><td className="px-6 py-4 font-bold text-slate-700">{sim.productName}</td><td className="px-6 py-4 font-mono">{formatCurrency(sim.budget)}</td><td className="px-6 py-4"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded font-bold">{sim.stats.volumeTotal}</span></td><td className="px-6 py-4 text-slate-500">{formatCurrency(sim.stats.costTotal)}</td><td className="px-6 py-4"><span className={`font-bold ${sim.stats.margin >= 30 ? 'text-emerald-600' : 'text-orange-600'}`}>{formatCurrency(sim.stats.profit)} ({sim.stats.margin.toFixed(0)}%)</span></td><td className="px-6 py-4 text-right"><button onClick={() => handleDelete('simulations', sim.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button></td></tr>))}</tbody></table>)}</div></div>
      </div>
    );
  };

  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"><div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><p className="text-slate-500 text-xs font-bold uppercase">CA ce mois</p><h3 className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(stats.caMensuel)}</h3></div><div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><p className="text-slate-500 text-xs font-bold uppercase">CA Total</p><h3 className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(stats.caTotal)}</h3></div></div><div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><h3 className="font-bold text-slate-800 mb-4">Produits & Arbitrage</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-4">{products.map(p => (<div key={p.id} className="bg-slate-50 p-4 rounded-lg border border-slate-100 relative group"><div className="absolute top-2 right-2 flex gap-1"><button onClick={() => { setCurrentProduct(p); setShowModal('product'); }} className="p-1 text-slate-300 hover:text-blue-500"><Edit2 size={14}/></button><button onClick={() => handleDelete('products', p.id)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={14}/></button></div><p className="font-bold text-slate-700">{p.name}</p><div className="flex justify-between mt-2 text-xs"><span>Vente: <b>{p.price}</b></span><span>Coût: <b>{p.cost}</b></span></div></div>))}</div></div></div>
  );

  const renderSettings = () => (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <h2 className="text-2xl font-bold mb-6">Paramètres</h2>
      <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Briefcase size={20}/> Informations Générales</h3>
          <div><label className="text-xs font-bold text-slate-500 uppercase">Nom Société</label><input name="companyName" defaultValue={settings.companyName} className="w-full border p-2 rounded mt-1"/></div>
          <div><label className="text-xs font-bold text-slate-500 uppercase">Adresse Complète</label><textarea name="address" defaultValue={settings.address} className="w-full border p-2 rounded mt-1 h-20"/></div>
          <div><label className="text-xs font-bold text-slate-500 uppercase">Email Contact</label><input name="email" defaultValue={settings.email} className="w-full border p-2 rounded mt-1"/></div>
          <div><label className="text-xs font-bold text-slate-500 uppercase">Téléphone</label><input name="phone" defaultValue={settings.phone} className="w-full border p-2 rounded mt-1"/></div>
          <div><label className="text-xs font-bold text-slate-500 uppercase">Logo URL (Image)</label><input name="logoUrl" defaultValue={settings.logoUrl} placeholder="https://..." className="w-full border p-2 rounded mt-1"/></div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><FileText size={20}/> Personnalisation Facture</h3>
          <div><label className="text-xs font-bold text-slate-500 uppercase">IBAN</label><input name="iban" defaultValue={settings.iban} className="w-full border p-2 rounded mt-1"/></div>
          <div><label className="text-xs font-bold text-slate-500 uppercase">Pied de page</label><textarea name="invoiceFooter" defaultValue={settings.invoiceFooter} className="w-full border p-2 rounded mt-1 h-24"/></div>
          <div className="pt-4 flex gap-4"><button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">Sauvegarder</button></div>
        </div>
      </form>
    </div>
  );

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-400"><Loader className="animate-spin mr-2"/> Chargement...</div>;
  if (!isAppAuthenticated) return <LoginScreen onLogin={() => setIsAppAuthenticated(true)} />;

  return (
    <div className={`flex h-screen bg-slate-50 text-slate-900 font-sans`}>
      <style>{`@media print { body * { visibility: hidden; } #invoice-printable, #invoice-printable * { visibility: visible; } #invoice-printable { position: fixed; left:0; top:0; width:100%; height:100%; padding:0; background:white; z-index:9999; } .no-print { display: none !important; } }`}</style>
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col no-print shrink-0">
        <div className="p-6"><div className="flex items-center gap-3 mb-10 text-white"><div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-lg">LP</div><div><span className="font-bold block">LeadPartner</span><span className="text-xs text-slate-500 uppercase">CRM V28</span></div></div><nav className="space-y-1">{[{id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard}, {id: 'contacts', label: 'Contacts', icon: Users}, {id: 'invoices', label: 'Factures', icon: FileText}, {id: 'products', label: 'Thématiques', icon: Package}, {id: 'projections', label: 'Projections (Privé)', icon: Lock}, {id: 'settings', label: 'Paramètres', icon: Settings}].map(item => (<button key={item.id} onClick={() => { setActiveView(item.id); setSelectedContactId(null); }} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg ${activeView === item.id ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50'}`}><item.icon size={18} className={activeView === item.id ? "text-blue-400" : "text-slate-500"}/> {item.label}</button>))}</nav></div>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden relative"><header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 no-print shrink-0"><div className="flex items-center gap-4 text-slate-400"><Search size={18}/><input type="text" placeholder="Rechercher..." className="bg-transparent outline-none text-sm text-slate-800 w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/></div></header>
        <main className="flex-1 overflow-auto bg-slate-50/50 p-6 relative">
          {selectedContact ? renderContactDetail() : (
            <>
              {activeView === 'dashboard' && renderDashboard()}
              {activeView === 'settings' && renderSettings()}
              {activeView === 'projections' && renderProjections()}
              {activeView === 'contacts' && (<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full"><div className="flex border-b"><button onClick={() => setContactFilterType('all')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${contactFilterType === 'all' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>Tous</button><button onClick={() => setContactFilterType('prospect')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${contactFilterType === 'prospect' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>Prospects</button><button onClick={() => setContactFilterType('client')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${contactFilterType === 'client' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>Clients</button><div className="ml-auto p-2"><button onClick={() => setShowModal('contact')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700"><Plus size={16}/> Nouveau</button></div></div><div className="flex-1 overflow-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b sticky top-0"><tr><th className="px-6 py-4">Société</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Thématique</th><th className="px-6 py-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{displayedContacts.map(c => { const p = products.find(prod => prod.id === c.interestedProductId); return (<tr key={c.id} onClick={() => setSelectedContactId(c.id)} className="hover:bg-blue-50/50 cursor-pointer group transition-colors"><td className="px-6 py-4"><p className="font-bold text-slate-800">{c.company}</p><p className="text-slate-500 text-xs">{c.name}</p></td><td className="px-6 py-4"><span className={`px-2 py-1 rounded-md text-xs font-bold border ${PIPELINE_STAGES.find(s=>s.id===c.status)?.color}`}>{PIPELINE_STAGES.find(s=>s.id===c.status)?.label || c.status}</span></td><td className="px-6 py-4 text-xs font-bold text-slate-600">{p ? p.name : '-'}</td><td className="px-6 py-4 text-right"><button onClick={(e) => { e.stopPropagation(); handleDelete('contacts', c.id); }} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={16}/></button></td></tr>)})}</tbody></table></div></div>)}
              {activeView === 'invoices' && (<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-4 border-b flex justify-between items-center bg-slate-50"><h3 className="font-bold">Factures</h3><button onClick={() => { setCurrentInvoice({ clientId: '', date: new Date().toISOString(), items: [], status: 'brouillon' }); setShowModal('invoice'); }} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-bold flex items-center gap-2"><Plus size={16}/> Créer</button></div><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b"><tr><th className="px-6 py-4">Client</th><th className="px-6 py-4">Date</th><th className="px-6 py-4">Montant</th><th className="px-6 py-4">Statut</th><th className="px-6 py-4 text-right">Action</th></tr></thead><tbody>{invoices.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(inv => (<tr key={inv.id} className="border-b last:border-0 hover:bg-slate-50"><td className="px-6 py-4 font-bold text-slate-700">{inv.clientName}</td><td className="px-6 py-4 text-slate-500">{formatDate(inv.date)}</td><td className="px-6 py-4 font-bold">{formatCurrency(inv.amount)}</td><td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${INVOICE_STATUSES[inv.status]?.color}`}>{INVOICE_STATUSES[inv.status]?.label || inv.status}</span></td><td className="px-6 py-4 text-right"><button onClick={() => { setCurrentInvoice(inv); setShowModal('invoice'); }} className="text-blue-600 hover:underline">Ouvrir</button></td></tr>))}</tbody></table></div>)}
              {activeView === 'products' && (<div className="grid grid-cols-1 md:grid-cols-3 gap-6"><button onClick={() => setShowModal('product')} className="border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-blue-500 hover:text-blue-500 transition-colors h-48"><Plus size={32} className="mb-2"/> <span className="font-bold">Ajouter Thématique</span></button>{products.map(p => (<div key={p.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative group"><div className="absolute top-4 right-4 flex gap-2"><button onClick={() => { setCurrentProduct(p); setShowModal('product'); }} className="p-1 text-slate-300 hover:text-blue-500"><Edit2 size={16}/></button><button onClick={() => handleDelete('products', p.id)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button></div><div className="absolute top-4 left-4 bg-slate-100 p-1.5 rounded-md text-slate-500">{p.platform === 'google' ? <Globe size={16}/> : <Share2 size={16}/>}</div><h4 className="font-bold text-slate-800 text-lg mb-2 mt-6">{p.name}</h4><p className="text-slate-500 text-sm mb-4 h-10 line-clamp-2">{p.description || 'Aucune description'}</p><div className="flex justify-between items-end border-t pt-4"><div><p className="text-[10px] text-slate-400 uppercase font-bold">Prix Vente</p><p className="font-bold text-xl text-blue-600">{formatCurrency(p.price)}</p></div><div className="text-right"><p className="text-[10px] text-slate-400 uppercase font-bold">Coût Achat (Est.)</p><p className="font-bold text-lg text-slate-600">{formatCurrency(p.cost)}</p></div></div></div>))}</div>)}
            </>
          )}
        </main>
      </div>
      {showModal === 'contact' && (<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"><div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl"><h3 className="text-xl font-bold mb-6">Ajouter une personne</h3><form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.target); handleCreate('contacts', { name: fd.get('name'), company: fd.get('company'), email: fd.get('email'), phone: fd.get('phone'), status: fd.get('status') }); }} className="space-y-4"><div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex gap-2"><select name="status" className="w-full bg-transparent font-bold text-slate-700 outline-none p-1"><option value="nouveau">👤 Prospect (En cours)</option><option value="gagne">✅ Client (Gagné)</option></select></div><input name="company" required className="w-full border p-3 rounded-lg" placeholder="Nom de la Société"/><input name="name" required className="w-full border p-3 rounded-lg" placeholder="Nom du Contact (Ex: Jean Dupont)"/><div className="grid grid-cols-2 gap-4"><input name="email" type="email" className="w-full border p-3 rounded-lg" placeholder="Email"/><input name="phone" className="w-full border p-3 rounded-lg" placeholder="Téléphone"/></div><div className="pt-4 flex gap-3"><button type="button" onClick={() => setShowModal(null)} className="flex-1 py-3 text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button><button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold">Valider</button></div></form></div></div>)}
      {showModal === 'product' && (<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"><div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl"><h3 className="text-xl font-bold mb-6">{currentProduct ? 'Modifier Thématique' : 'Nouvelle Thématique'}</h3><form onSubmit={handleSaveProductForm} className="space-y-4"><input name="name" defaultValue={currentProduct?.name} required placeholder="Nom (ex: 3ème Pilier)" className="w-full border p-3 rounded-lg"/><textarea name="description" defaultValue={currentProduct?.description} placeholder="Description courte" className="w-full border p-3 rounded-lg h-20"></textarea><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold uppercase text-slate-500">Prix Vente (CHF)</label><input name="price" defaultValue={currentProduct?.price} type="number" step="0.01" required className="w-full border p-3 rounded-lg mt-1" placeholder="80.00"/></div><div><label className="text-xs font-bold uppercase text-slate-500">Coût Achat Cible</label><input name="cost" defaultValue={currentProduct?.cost} type="number" step="0.01" required className="w-full border p-3 rounded-lg mt-1" placeholder="25.00"/></div></div><div><label className="text-xs font-bold uppercase text-slate-500">Plateforme Pub</label><select name="platform" defaultValue={currentProduct?.platform} className="w-full border p-3 rounded-lg mt-1"><option value="meta">Meta Ads (Facebook/Insta)</option><option value="google">Google Ads</option><option value="tiktok">TikTok Ads</option></select></div><div className="pt-4 flex gap-3"><button type="button" onClick={() => { setShowModal(null); setCurrentProduct(null); }} className="flex-1 py-3 text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button><button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold">{currentProduct ? 'Mettre à jour' : 'Ajouter'}</button></div></form></div></div>)}
      {showModal === 'invoice' && currentInvoice && (
        <div className="fixed inset-0 bg-slate-900/95 z-[100] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-5xl h-[95vh] rounded-xl flex flex-col shadow-2xl overflow-hidden">
              <div className="h-16 border-b flex justify-between items-center px-6 bg-slate-50 no-print shrink-0"><h3 className="font-bold text-lg">Facture {currentInvoice.id}</h3><div className="flex gap-3"><button onClick={() => window.print()} className="px-4 py-2 bg-slate-200 rounded-lg flex gap-2 items-center"><Printer size={16}/> Imprimer</button><button onClick={handleSaveInvoice} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex gap-2 items-center"><CheckCircle size={16}/> Sauvegarder</button><button onClick={() => setShowModal(null)} className="p-2 hover:bg-red-50 text-slate-400"><X size={20}/></button></div></div>
              <div className="flex-1 overflow-auto bg-slate-200/50 p-8 flex justify-center">
                 <div id="invoice-printable" className="bg-white w-[21cm] min-h-[29.7cm] shadow-xl p-[2.5cm] flex flex-col text-slate-800 relative">
                    <div className="flex justify-between mb-12"><div><h1 className="text-4xl font-bold uppercase mb-2" style={{color: settings.primaryColor}}>Facture</h1><p className="font-mono">#{currentInvoice.id || 'BROUILLON'}</p><p className="text-sm mt-1">Date: {formatDate(currentInvoice.date)}</p></div><div className="text-right">{settings.logoUrl && <img src={settings.logoUrl} className="h-16 mb-2 ml-auto object-contain" alt="Logo"/>}<p className="font-bold text-lg">{settings.companyName}</p><p className="text-sm text-slate-500 whitespace-pre-wrap">{settings.address}</p><p className="text-sm text-slate-500">{settings.email} • {settings.phone}</p></div></div>
                    <div className="mb-8"><p className="text-xs font-bold text-slate-400 uppercase mb-2">Facturé à</p>{currentInvoice.id ? <div className="font-bold text-lg">{currentInvoice.clientName}</div> : <select className="bg-slate-50 border p-2 rounded w-full font-bold no-print" onChange={e => { const c = contacts.find(co => co.id === e.target.value); setCurrentInvoice({...currentInvoice, clientId: c?.id, clientName: c?.company, projectedBudget: c?.projectedBudget, interestedProductId: c?.interestedProductId } as any); if(c?.projectedBudget) { setInvoiceBudget(c.projectedBudget); if(c.interestedProductId) setInvoiceThemeId(c.interestedProductId); } }} value={currentInvoice.clientId}><option value="">-- Sélectionner Client --</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}</select>}{currentInvoice.clientName && !currentInvoice.id && <div className="font-bold text-lg mt-1">{currentInvoice.clientName}</div>}</div>
                    
                    {/* GENERATEUR LEADGEN FLEXIBLE (V20) */}
                    {!currentInvoice.id && (
                        <div className="no-print bg-slate-50 border border-slate-200 rounded-xl p-4 mb-8">
                            <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Wand2 size={16}/> Générateur LeadGen</h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Budget Total</label><input type="number" value={invoiceBudget} onChange={e => setInvoiceBudget(e.target.value)} className="w-full border p-2 rounded font-bold" placeholder="0.00"/></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Thématique</label><select value={invoiceThemeId} onChange={e => setInvoiceThemeId(e.target.value)} className="w-full border p-2 rounded"><option value="">-- Choisir --</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Marge Agence (%)</label><input type="number" value={invoiceMarginPercent} onChange={e => setInvoiceMarginPercent(Number(e.target.value))} className="w-full border p-2 rounded text-blue-600 font-bold"/></div>
                                <button onClick={handleGenerateInvoice} className="bg-slate-900 text-white px-4 py-2 rounded font-bold hover:bg-slate-700">Appliquer</button>
                            </div>
                        </div>
                    )}

                    <table className="w-full mb-8"><thead><tr className="border-b-2 border-slate-900 text-sm"><th className="text-left py-3 font-bold uppercase w-3/4">Description</th><th className="text-right py-3 font-bold uppercase">Montant</th></tr></thead><tbody>{(currentInvoice.items || []).map((item, i) => (<tr key={i} className="border-b border-slate-100 group"><td className="py-4">{item.name}</td><td className="py-4 text-right font-bold text-lg font-mono">{formatCurrency(item.price)}</td></tr>))}</tbody></table>
                    
                    <div className="flex justify-end mt-auto">
                        <div className="w-64 space-y-2">
                            <div className="flex justify-between text-slate-500"><span>Total HT</span> <span>{formatCurrency((currentInvoice.items || []).reduce((acc, i) => acc + (i.price * i.qty), 0))}</span></div>
                            <div className="flex justify-between text-slate-500"><span>TVA (0.0%)</span> <span>0.00 CHF</span></div>
                            <div className="flex justify-between py-4 border-t-2 border-slate-900 text-2xl font-bold"><span>Total TTC</span> <span>{formatCurrency((currentInvoice.items || []).reduce((acc, i) => acc + (i.price * i.qty), 0))}</span></div>
                        </div>
                    </div>
                    <div className="mt-12 pt-8 border-t text-center text-xs text-slate-400">{settings.iban && <p className="font-bold text-slate-600 mb-1">IBAN: {settings.iban}</p>}<p className="whitespace-pre-wrap">{settings.invoiceFooter}</p></div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}