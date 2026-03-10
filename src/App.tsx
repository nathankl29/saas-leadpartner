import { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard, Users, Settings, Plus, Search, ChevronLeft,
  FileText, Package, Trash2, CheckCircle, Clock, MessageSquare,
  Briefcase, PlayCircle, Target, TrendingUp, Calculator, ArrowRight,
  Wallet, PieChart, Globe, Share2, Loader, LogIn, LogOut, Edit2, Save,
  Wand2, Send, X, AlertTriangle, Info, Calendar as CalendarIcon,
  Mail, Download, MapPin, Eye, EyeOff, Activity,
  Paperclip, Bell, CalendarClock, GripHorizontal, Link, Archive, Upload, Moon, Sun, Zap, RefreshCcw, Copy
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, setDoc, writeBatch, getDocs, query, limit
} from 'firebase/firestore';
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, signOut,
  signInWithCustomToken, signInAnonymously
} from 'firebase/auth';

declare const __firebase_config: string | undefined;
declare const __app_id: string | undefined;
declare const __initial_auth_token: string | undefined;

declare global {
  interface Window {
    html2pdf: any;
  }
}

// --- VERSION DU CRM ---
const APP_VERSION = '60.9';

// --- STYLES GLOBAUX & COULEURS DE MARQUE ---
const BRAND_COLOR = '#01189B';

// --- OPTIMISATION : DICTIONNAIRE DE CLASSES CSS ---
const UI_CLASSES = {
  input: "w-full border-2 border-slate-100 bg-slate-50 p-2.5 rounded-xl outline-none focus:border-[#01189B] focus:bg-white transition-colors text-sm font-medium text-slate-800",
  label: "block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5",
  btnPrimary: "text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:-translate-y-0.5 transition-all",
  btnSecondary: "flex-1 py-2.5 border-2 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold transition-colors text-sm",
  card: "bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]",
  title: "text-2xl font-extrabold mb-5 font-poppins text-slate-800 flex items-center gap-3"
};

// --- CONFIGURATION FIREBASE ---
const fallbackFirebaseConfig = {
  apiKey: "AIzaSyDY6zXLeebKhMxL_2_mfQOYV44JuoCArK0",
  authDomain: "crm-leadpartner.firebaseapp.com",
  projectId: "crm-leadpartner",
  storageBucket: "crm-leadpartner.firebasestorage.app",
  messagingSenderId: "588502456936",
  appId: "1:588502456936:web:5c509a0c418f34f77239dd",
  measurementId: "G-6QM0LM69Z1"
};

// 💡 NOUVEAU SYSTEME DE RECONNEXION MANUELLE ET FORÇAGE V43
const FORCED_APP_ID = 'leadpartner-crm-v43-prod';

const getAppId = () => {
  const storedId = localStorage.getItem('leadpartner_custom_app_id');
  if (storedId) return storedId;
  // On utilise l'ID fourni par l'environnement s'il existe pour éviter les erreurs de permission
  if (typeof __app_id !== 'undefined') return __app_id;
  return FORCED_APP_ID;
};

let app: any, db: any, auth: any;
try {
  if (typeof __firebase_config !== 'undefined') {
    const config = JSON.parse(__firebase_config);
    app = initializeApp(config);
  } else if (fallbackFirebaseConfig && fallbackFirebaseConfig.apiKey) {
    app = initializeApp(fallbackFirebaseConfig);
  }
  if (app) {
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

const INVOICE_STATUSES: any = {
  brouillon: { label: 'Brouillon', color: 'bg-slate-100 text-slate-600' },
  envoyee: { label: 'Envoyée', color: 'bg-blue-100 text-[#01189B]' },
  payee: { label: 'Payée', color: 'bg-emerald-100 text-emerald-600' },
  retard: { label: 'En retard', color: 'bg-orange-100 text-orange-600' },
  annulee: { label: 'Annulée / Perdue', color: 'bg-red-100 text-red-700' },
  archive: { label: 'Archivée', color: 'bg-slate-800 text-white' },
};

const AVAILABLE_WIDGETS = [
  { id: 'objective', label: 'Objectif Mensuel' },
  { id: 'widget_finances_data', label: 'CA & Bénéfices' },
  { id: 'chart_annual_1', label: 'Bilan Annuel Complet' },
  { id: 'widget_ca_details', label: 'Détail CA par Client' },
  { id: 'reminders', label: 'Rappels & Relances' },
  { id: 'invoices', label: 'Facturation Récente' },
  { id: 'activity', label: 'Activité CRM' }
];

const DEFAULT_EMAIL_TEMPLATES = [
  { id: 'std', name: 'Standard (Envoi de Facture)', subject: 'Nouvelle Facture {{facture}} - {{agence}}', body: "Bonjour {{prenom_contact}},\n\nVeuillez trouver ci-joint votre facture {{facture}} d'un montant de {{montant}} concernant nos prestations.\n\nNous restons à votre entière disposition pour toute question.\n\nCordialement,\nL'équipe {{agence}}" },
  { id: 'relance_1', name: 'Relance Aimable', subject: 'Relance : Facture {{facture}} en attente', body: "Bonjour {{prenom_contact}},\n\nSauf erreur ou omission de notre part, le règlement de la facture {{facture}} d'un montant de {{montant}} ne nous est pas encore parvenu.\n\nNous vous prions de bien vouloir procéder à son règlement.\n\nCordialement,\nL'équipe {{agence}}" }
];

const DEFAULT_PROSPECT_EMAIL_TEMPLATES = [
  { id: 'prospect_1', name: 'Approche Directe', subject: 'Génération de leads pour {{societe}}', body: "Bonjour {{prenom_contact}},\n\nJe me permets de vous contacter car nous aidons les professionnels comme {{societe}} à scaler leur acquisition avec des leads exclusifs.\n\nSeriez-vous disponible pour un court appel afin d'en discuter ?\n\nCordialement,\n{{agence}}" },
  { id: 'prospect_relance', name: 'Relance Prospection', subject: 'Suite à mon précédent email', body: "Bonjour {{prenom_contact}},\n\nJe me permets de revenir vers vous concernant mon précédent message.\n\nAvez-vous pu en prendre connaissance ?\n\nBien à vous,\n{{agence}}" }
];

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' });
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF', minimumFractionDigits: 2 }).format(Number(amount || 0));
};

// --- HELPERS PDF ---
const getPdfOptions = (filename: string) => ({
  margin: 0,
  filename,
  image: { type: 'jpeg', quality: 1 },
  pagebreak: { mode: ['css', 'legacy'], avoid: ['.keep-together', 'tr'] },
  html2canvas: { 
      scale: 2, useCORS: true, scrollY: 0,
      onclone: (doc: any) => {
          doc.querySelectorAll('.no-print').forEach((el: any) => el.style.display = 'none');
          doc.querySelectorAll('textarea.print-input').forEach((el: any) => {
              const div = doc.createElement('div');
              div.className = el.className.replace('resize-none', '').replace('overflow-hidden', '');
              div.style.cssText = 'height: auto; white-space: pre-wrap;';
              div.innerText = el.value;
              el.parentNode.replaceChild(div, el);
          });
          doc.querySelectorAll('input.print-input').forEach((el: any) => {
              const div = doc.createElement('div');
              div.className = el.className;
              // Conversion du format US (AAAA-MM-JJ) de l'input au format FR (JJ/MM/AAAA) pour le PDF
              if (el.type === 'date' && el.value) {
                  const [y, m, d] = el.value.split('-');
                  div.innerText = `${d}/${m}/${y}`;
              } else {
                  div.innerText = el.value;
              }
              el.parentNode.replaceChild(div, el);
          });
      }
  },
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
});

const requireHtml2Pdf = async () => {
  if (window.html2pdf) return window.html2pdf;
  return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => resolve(window.html2pdf);
      script.onerror = reject;
      document.body.appendChild(script);
  });
};

// --- COMPOSANT LOGIN ---
const LoginScreen = ({ onLogin, addNotification }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleLoginSubmit = async (e: any) => {
    e.preventDefault();
    setLocalError('');
    
    if (!email || !password) {
        setLocalError('Veuillez remplir tous les champs.');
        return addNotification('error', 'Veuillez remplir les champs');
    }
    if (!auth) return addNotification('error', 'Firebase non initialisé.');

    setIsLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      addNotification('success', 'Connexion réussie !');
      onLogin();
    } catch (error: any) {
      console.error(error);
      let errorMsg = 'Échec de la connexion.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMsg = 'Email ou mot de passe incorrect.';
      }
      setLocalError(errorMsg);
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
            {localError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 animate-fade-in">
                    <AlertTriangle size={18} className="shrink-0" />
                    {localError}
                </div>
            )}
            <div>
              <label className={UI_CLASSES.label}>Email autorisé</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className={UI_CLASSES.input} 
                placeholder="votre.email@..." 
              />
            </div>
            <div>
              <label className={UI_CLASSES.label}>Mot de passe</label>
              <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className={`${UI_CLASSES.input} pr-12`} 
                    placeholder="••••••••" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    className="absolute right-4 top-3.5 text-slate-400 hover:text-[#01189B] transition-colors"
                  >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
              </div>
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

// --- COMPOSANT EMAIL EDITOR ---
const EmailTemplateEditor = ({ tpl, onSave, onDelete }: any) => {
    const [name, setName] = useState(tpl?.name || '');
    const [subject, setSubject] = useState(tpl?.subject || '');
    const [body, setBody] = useState(tpl?.body || '');

    return (
        <div className="p-5 border-2 border-slate-100 rounded-2xl bg-slate-50 relative group">
            <button 
              onClick={onDelete}
              className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            ><Trash2 size={18}/></button>

            <div className="space-y-4">
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Nom du modèle (Interne)</label>
                    <input 
                      value={name} 
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-2.5 rounded-lg mt-1 font-bold outline-none focus:border-[#01189B]" 
                    />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Sujet du mail</label>
                    <input 
                      value={subject} 
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-2.5 rounded-lg mt-1 font-medium outline-none focus:border-[#01189B]" 
                    />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Corps du message</label>
                    <textarea 
                      value={body} 
                      onChange={(e) => setBody(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-3 rounded-lg mt-1 font-medium outline-none focus:border-[#01189B] h-32 resize-none text-sm leading-relaxed" 
                    />
                </div>
                <div className="flex justify-end pt-2">
                    <button onClick={() => onSave({ ...tpl, name, subject, body })} className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:shadow-md flex items-center gap-1"><Save size={14}/> Enregistrer ce modèle</button>
                </div>
            </div>
        </div>
    );
};

// --- COMPOSANT SIGNATURE PAD ---
const SignaturePad = ({ onSave, onClear }: any) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.strokeStyle = '#01189B';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            }
        }
    }, []);

    const getCoordinates = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        if (e.touches && e.touches.length > 0) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const startDrawing = (e: any) => {
        if (e.cancelable) e.preventDefault(); 
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            setIsDrawing(true);
        }
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        if (e.cancelable) e.preventDefault();
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) {
            onSave(canvas.toDataURL('image/png'));
        }
    };

    const clearPad = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
            onClear();
        }
    };

    return (
        <div className="flex flex-col gap-3 items-start w-full max-w-md">
            <div className="border-2 border-dashed border-blue-200 rounded-2xl overflow-hidden bg-blue-50/30 touch-none w-full relative">
                <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="cursor-crosshair w-full"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseOut={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
                <div className="absolute bottom-2 right-3 text-[10px] text-blue-300 font-bold uppercase tracking-widest pointer-events-none">Signez ici</div>
            </div>
            <div className="flex gap-3 w-full items-center">
                <button type="button" onClick={clearPad} className="text-xs text-red-500 font-bold bg-white hover:bg-red-50 px-4 py-2 rounded-xl transition-colors border border-red-200 shadow-sm flex items-center gap-1.5 shrink-0"><Trash2 size={14}/> Effacer le cadre</button>
                <span className="text-[10px] text-slate-400 font-medium leading-tight">Sauvegarde automatique après le tracé.</span>
            </div>
        </div>
    );
};

// --- COMPOSANT PRINCIPAL ---
export default function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [dashboardYear, setDashboardYear] = useState(new Date().getFullYear());
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAppAuthenticated, setIsAppAuthenticated] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isSecretMode, setIsSecretMode] = useState(() => localStorage.getItem('leadpartner_secret_mode') === 'true');

  useEffect(() => {
      localStorage.setItem('leadpartner_secret_mode', isSecretMode.toString());
  }, [isSecretMode]);

  const [isEditingContractInInvoice, setIsEditingContractInInvoice] = useState(false);
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [dragOverWidget, setDragOverWidget] = useState<string | null>(null);

  // Nouveaux états pour la pondération manuelle
  const [manualWeights, setManualWeights] = useState<any[]>([]);
  const [manualWeightClient, setManualWeightClient] = useState('');
  const [manualWeightParts, setManualWeightParts] = useState<number>(1);
  const [manualWeightMaxDaily, setManualWeightMaxDaily] = useState<number | ''>('');
  
  // Nouveaux états pour le Script & Arbitrage
  const [manualWeightMaxTotal, setManualWeightMaxTotal] = useState<number | ''>('');
  const [manualWeightResidentOnly, setManualWeightResidentOnly] = useState(false);
  const [manualWeightSheetId, setManualWeightSheetId] = useState('');
  
  // Nouveaux états pour le Pacing (Lissage)
  const [enablePacing, setEnablePacing] = useState(true);
  
  const [bulkContacts, setBulkContacts] = useState([{ company: '', name: '', email: '', phone: '', manualCA: '', manualBenefice: '' }, { company: '', name: '', email: '', phone: '', manualCA: '', manualBenefice: '' }, { company: '', name: '', email: '', phone: '', manualCA: '', manualBenefice: '' }]);

  // Etats de configuration du Script
  const [scriptGlobalSheetId, setScriptGlobalSheetId] = useState('');
  const [scriptGlobalTabName, setScriptGlobalTabName] = useState('Distribution');
  const [scriptPhoneColIndex, setScriptPhoneColIndex] = useState(6);
  const [currentScriptId, setCurrentScriptId] = useState<string | null>(null);
  const [scriptName, setScriptName] = useState('');
  const [scriptProductId, setScriptProductId] = useState('');

  const [notifications, setNotifications] = useState<any[]>([]);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [scenarios, setScenarios] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [companiesData, setCompaniesData] = useState<any[]>([]);
  const [campaignKpis, setCampaignKpis] = useState<any[]>([]);

  const [settings, setSettings] = useState<any>({
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
    dashboardLayout: ['objective', 'widget_finances_data', 'chart_annual_1', 'widget_ca_details', 'invoices', 'reminders'],
    webhookUrl: '', 
    webhookUrlProspection: '',
    emailTemplates: DEFAULT_EMAIL_TEMPLATES,
    prospectEmailTemplates: DEFAULT_PROSPECT_EMAIL_TEMPLATES,
    defaultContractText: `CONTRAT DE PRESTATION DE SERVICES : GÉNÉRATION DE LEADS\n\nENTRE LES SOUSSIGNÉS :\n\n{{agency_company}}\nCi-après dénommé « le Prestataire »\n\nET :\n\n{{client_company}}\nSiège social : {{client_address}}\nReprésenté par : {{client_name}}\nCi-après dénommé « le Client »\n\nArticle 1 : Objet du contrat\nLe présent contrat définit les conditions dans lesquelles le Prestataire s'engage à concevoir, gérer et optimiser des campagnes publicitaires digitales (notamment sur Meta, Google et TikTok) dans le but de générer des contacts commerciaux (ci-après « Leads ») pour le compte du Client. Les canaux spécifiques utilisés pour chaque campagne seront précisés sur les factures correspondantes.\n\nArticle 2 : Définition, Livraison et Exclusivité des Leads\nDéfinition : Un lead est considéré comme valide lorsqu'il comporte les informations de base requises pour le recontacter (notamment nom, prénom, adresse e-mail, et un numéro de téléphone).\n\nLivraison : Les leads sont transmis au Client en temps réel via un document Google Sheets partagé et sécurisé, mis à disposition par le Prestataire.\n\nExclusivité : Le Prestataire garantit que chaque lead généré dans le cadre de ce contrat est strictement exclusif au Client et ne sera ni vendu ni partagé à une entreprise tierce. Toutefois, le Prestataire n'accorde aucune exclusivité géographique au Client et se réserve le droit de collaborer avec d'autres entreprises du même secteur dans la même région.\n\nArticle 3 : Qualité et Politique de Remplacement\nLe Prestataire s'engage sur la pertinence du ciblage publicitaire. Si le Client constate qu'un lead contient un numéro de téléphone invalide (faux numéro ou numéro non attribué), il doit le signaler au Prestataire. Les leads invalides reconnus comme tels par le Prestataire seront remplacés sans frais supplémentaires lors du mois en cours ou lors de la campagne suivante.\n\nArticle 4 : Conditions Financières\nLe Client confie au Prestataire un budget global pour la réalisation de ses campagnes. Le Prestataire prélève des frais de gestion sur ce budget selon un barème dégressif. Le solde restant (Budget Net) est intégralement investi dans l'achat d'espace publicitaire sur les plateformes (Meta, Google, TikTok, etc.).\n\nLes frais de gestion s'appliquent sur le budget total confié par le Client selon les paliers suivants :\nDe 0 CHF à 4'999 CHF : 35% de frais de gestion.\nDe 5'000 CHF à 9'999 CHF : 30% de frais de gestion.\nDe 10'000 CHF à 14'999 CHF : 25% de frais de gestion.\n15'000 CHF et plus : 20% de frais de gestion.\n\nToute facturation est sujette à la TVA en vigueur (si applicable).\n\nArticle 5 : Paiement et Délais d'exécution\nModalités de paiement : Afin d'alimenter les comptes publicitaires et de lancer les campagnes, les factures sont payables immédiatement par le Client, à réception de la facture.\n\nLancement publicitaire : Le Prestataire s'engage à livrer les premiers leads dans un délai maximum de 7 jours ouvrés suivant la bonne réception du paiement.\n---\nArticle 6 : Durée et Résiliation\nLe présent contrat est conclu sans durée d'engagement minimum. Le Client est libre de renouveler ou non le budget à l'issue de chaque campagne.\nEn l'absence d'engagement de durée, aucun préavis de résiliation n'est exigé de la part de l'une ou l'autre des parties pour cesser la collaboration.\n\nArticle 7 : Protection des Données (nLPD)\nConformément à la Loi fédérale sur la protection des données (nLPD), le Prestataire agit en tant que sous-traitant des données récoltées. Les données des leads sont collectées de manière transparente via les plateformes publicitaires dans le seul but d'être traitées par le Client. Le Client, en tant que responsable du traitement, s'engage à utiliser ces données dans le strict respect de la législation suisse en vigueur, à des fins de prospection légitime, et à gérer les éventuelles demandes de suppression de données des prospects.\n\nArticle 8 : Droit Applicable et For Juridique\nLe présent contrat est soumis au droit suisse. En cas de litige relatif à l'interprétation ou à l'exécution du présent contrat, et à défaut de résolution à l'amiable, le for juridique exclusif est fixé à Genève.`,
  });

  const [contacts, setContacts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [simulations, setSimulations] = useState<any[]>([]);
  const [emailHistory, setEmailHistory] = useState<any[]>([]);

  const [selectedContactId, setSelectedContactId] = useState<any>(null);
  const selectedContact = useMemo(() => contacts.find((c) => c.id === selectedContactId) || null, [contacts, selectedContactId]);

  // NOUVEAU: Etat pour gérer l'ouverture d'une fiche Entreprise
  const [selectedCompanyName, setSelectedCompanyName] = useState<string | null>(null);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [editCompanyDataState, setEditCompanyDataState] = useState<any>({});

  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editContactData, setEditContactData] = useState<any>({});
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newContactSource, setNewContactSource] = useState('');
  
  // États de rappel (Fiche client)
  const [reminderNote, setReminderNote] = useState('');
  const [companyReminderNote, setCompanyReminderNote] = useState('');
  
  // États pour les rendez-vous
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingNote, setMeetingNote] = useState('');

  const [showModal, setShowModal] = useState<any>(null);
  const [currentProduct, setCurrentProduct] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentInvoice, setCurrentInvoice] = useState<any>(null);
  const [currentSimulation, setCurrentSimulation] = useState<any>(null);
  const [contactFilterType, setContactFilterType] = useState('all');

  const [invoiceBudget, setInvoiceBudget] = useState<any>('');
  const [invoiceThemeId, setInvoiceThemeId] = useState('');
  const [invoiceMarginPercent, setInvoiceMarginPercent] = useState(35);

  const [planBudget, setPlanBudget] = useState(1000);
  const [planDuration, setPlanDuration] = useState(30);
  const [planProductId, setPlanProductId] = useState('');
  const [planClientId, setPlanClientId] = useState('');
  const [planDataSource, setPlanDataSource] = useState('deliveries');

  // --- NOUVEAUX ETATS LIVRAISONS ---
  const [deliveryActiveTab, setDeliveryActiveTab] = useState('global');

  // --- NOUVEAU : ETAT LMC ---
  const [lmcGoal, setLmcGoal] = useState<number>(10000);
  const [lmcSimulationsList, setLmcSimulationsList] = useState<any[]>([]);
  const [lmcPeriod, setLmcPeriod] = useState<'month'|'year'>('month');
  const [lmcCustomBudget, setLmcCustomBudget] = useState<number>(3000);
  const [lmcCustomProduct, setLmcCustomProduct] = useState<string>('');

  // Modale d'envoi d'email
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailData, setEmailData] = useState<any>({ to: '', subject: '', body: '', isSending: false, selectedTemplate: 'std', sendContractSeparately: false });

  // Import CSV Modal
  const [showImportModal, setShowImportModal] = useState<any>(null);

  // Settings Tabs
  const [settingsActiveTab, setSettingsActiveTab] = useState('general');

  const hasCheckedDefaults = useRef(false);

  const [isDarkMode, setIsDarkMode] = useState(false);

  // --- WRAPPERS MODE SECRET ---
  const renderCurrency = (amount: number) => isSecretMode ? 'CHF ****' : formatCurrency(amount);
  const renderNumber = (num: number | string) => isSecretMode ? '****' : num;
  const renderName = (name: string | undefined | null) => isSecretMode ? '****' : (name || 'Inconnu');

  // --- HELPERS UI ---
  const addNotification = (type: string, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications((prev: any[]) => [...prev, { id, type, message }]);
    setTimeout(() => setNotifications((prev: any[]) => prev.filter((n: any) => n.id !== id)), 4000);
  };

  const openConfirm = (title: string, message: string, onConfirm: any) => {
    setConfirmState({ isOpen: true, title, message, onConfirm: () => { onConfirm(); setConfirmState((prev: any) => ({ ...prev, isOpen: false })); } });
  };

  // --- AUTH ---
  useEffect(() => {
    if (!auth) {
        setIsOfflineMode(true); 
        setUser({ uid: 'offline', email: 'demo@offline' }); 
        setLoading(false); 
        return;
    }

    const initAuth = async () => {
        if (typeof __firebase_config !== 'undefined') {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (err) {
                console.error("Canvas Env Auth Error:", err);
            }
        }
    };

    initAuth().then(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            if (u) {
                setUser(u);
                setIsAppAuthenticated(true);
                setIsOfflineMode(false);
            } else {
                setUser(null);
                setIsAppAuthenticated(false);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    });
  }, []);

  // --- SYNC DB & AUTO-SEED PRODUCTS/CONTACTS ---
  useEffect(() => {
    if (!user || isOfflineMode || !db) return;
    
    // NOUVELLE LOGIQUE DE RECHERCHE DE DONNEES
    const findDataPath = async () => {
      try {
        // Essai 1 : Dossier avec l'UID de l'utilisateur (cas standard récent)
        const userSpecificPath = `artifacts/${getAppId()}/users/${user.uid}`;
        const userContactsQuery = query(collection(db, `${userSpecificPath}/contacts`), limit(1));
        const userContactsSnap = await getDocs(userContactsQuery);
        
        if (!userContactsSnap.empty) {
            console.log("Données trouvées dans le dossier utilisateur.");
            return userSpecificPath;
        }

        // Essai 2 : Dossier public / commun (si les données étaient globales dans votre version 59.9)
        const publicPath = `artifacts/${getAppId()}/public/data`;
        const publicContactsQuery = query(collection(db, `${publicPath}/contacts`), limit(1));
        const publicContactsSnap = await getDocs(publicContactsQuery);

        if (!publicContactsSnap.empty) {
             console.log("Données trouvées dans le dossier public.");
             return publicPath;
        }

        // Essai 3 : Sans le préfixe artifacts/ (très anciennes versions)
        const rootPath = `${getAppId()}/users/${user.uid}`;
        const rootContactsQuery = query(collection(db, `${rootPath}/contacts`), limit(1));
        const rootContactsSnap = await getDocs(rootContactsQuery);

        if (!rootContactsSnap.empty) {
             console.log("Données trouvées à la racine.");
             return rootPath;
        }

        // Par défaut, on continue avec le dossier utilisateur même s'il est vide pour l'instant
        return userSpecificPath;

      } catch (err) {
          // Silence l'erreur de permission dans la console et retourne le fallback
          return `artifacts/${getAppId()}/users/${user.uid}`; 
      }
    };

    let unsubs: any[] = [];
    
    findDataPath().then(basePath => {
        try {
          unsubs = [
            onSnapshot(collection(db, `${basePath}/contacts`), (s) => {
              const loadedContacts = s.docs.map((d) => ({ id: d.id, ...d.data() }));
              setContacts(loadedContacts);
            }),
            
            onSnapshot(collection(db, `${basePath}/products`), (s) => {
              const loadedProducts = s.docs.map((d) => ({ id: d.id, ...d.data() }));
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

            onSnapshot(collection(db, `${basePath}/invoices`), (s) => setInvoices(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
            onSnapshot(collection(db, `${basePath}/interactions`), (s) => setInteractions(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
            onSnapshot(collection(db, `${basePath}/simulations`), (s) => setSimulations(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
            onSnapshot(collection(db, `${basePath}/target_scenarios`), (s) => setScenarios(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
            onSnapshot(collection(db, `${basePath}/lead_deliveries`), (s) => setDeliveries(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
            onSnapshot(collection(db, `${basePath}/email_logs`), (s) => setEmailHistory(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
            onSnapshot(collection(db, `${basePath}/companies`), (s) => setCompaniesData(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
            onSnapshot(doc(db, `${basePath}/campaign_kpis`, 'latest'), (s) => {
                if (s.exists()) {
                    setCampaignKpis(s.data().campaigns || []);
                }
            }),
            onSnapshot(doc(db, `${basePath}/config`, 'general'), (s) => { 
                if (s.exists()) {
                    const data = s.data();
                    if (!data.emailTemplates || data.emailTemplates.length === 0) {
                        data.emailTemplates = DEFAULT_EMAIL_TEMPLATES;
                    }
                    if (!data.prospectEmailTemplates || data.prospectEmailTemplates.length === 0) {
                        data.prospectEmailTemplates = DEFAULT_PROSPECT_EMAIL_TEMPLATES;
                    }
                    setSettings((prev: any) => ({ ...prev, ...data })); 
                }
            }),
          ];
        } catch (e) { setIsOfflineMode(true); }
    });

    return () => unsubs.forEach((u) => u && u());
  }, [user, isOfflineMode]);

  // --- FILTRES & STATS ---
  const displayedContacts = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return contacts.filter((c) => {
      const matchSearch = c.name?.toLowerCase().includes(searchLower) || c.company?.toLowerCase().includes(searchLower);
      if (!matchSearch) return false;
      if (contactFilterType === 'client') return c.type === 'client' || c.status === 'gagne';
      if (contactFilterType === 'prospect') return c.type === 'prospect' || (c.status !== 'gagne' && c.status !== 'perdu');
      return true;
    });
  }, [contacts, searchTerm, contactFilterType]);

  const stats = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = dashboardYear; // <--- UPDATE CA GRÂCE A LA VARIABLE

    let monthlyInvoicesAmount = 0, totalPaidInvoices = 0, caPotentielInvoices = 0;
    const monthlyCA = new Array(12).fill(0);
    let caAnnuel = 0;
    let beneficePapierTotal = 0;
    let beneficeMensuel = 0;
    let arbitrageTotal = 0;
    
    let caPerClient: any = {};

    invoices.forEach((i) => {
      const amt = Number(i.amount ?? 0);
      // CA Encaissé (uniquement les factures PAYÉES)
      if (i.status === 'payee') {
          totalPaidInvoices += amt;
          const d = new Date(i.date);
          const marginPercent = i.marginPercent !== undefined ? i.marginPercent : 35;
          const frais = amt * (marginPercent / 100);

          if (d.getFullYear() === currentYear) {
              monthlyCA[d.getMonth()] += amt;
              caAnnuel += amt;
              beneficePapierTotal += frais;
              
              // Only count client CA for the selected year!
              const clientId = i.clientId || i.clientName || 'Inconnu';
              if (!caPerClient[clientId]) caPerClient[clientId] = { name: i.clientName || 'Inconnu', total: 0 };
              caPerClient[clientId].total += amt;

              if (d.getMonth() === currentMonth) {
                  monthlyInvoicesAmount += amt;
                  beneficeMensuel += frais; // Ajout au bénéfice du mois en cours
              }
          }
      } 
      // CA Potentiel (factures en cours, brouillons, en retard - tout sauf payée, annulée et archivée)
      else if (i.status !== 'annulee' && i.status !== 'archive') {
          const d = new Date(i.date);
          if (d.getFullYear() === currentYear) {
              caPotentielInvoices += amt;
          }
      }
    });

    simulations.forEach((s) => {
      const d = new Date(s.createdAt);

      if (d.getFullYear() === currentYear) {
          // L'arbitrage est toujours calculé via les simulations (qu'elles soient manuelles ou liées à une facture)
          arbitrageTotal += (s.stats?.arbitrage || 0);

          if (d.getMonth() === currentMonth) {
              beneficeMensuel += (s.stats?.arbitrage || 0); // Ajout de l'arbitrage au bénéfice du mois
          }
      }
    });

    // --- AJOUT DU CA ET BENEFICE MANUELS DES FICHES CLIENTS ---
    contacts.forEach(c => {
        const mCA = Number(c.manualCA || 0);
        const mBen = Number(c.manualBenefice || 0);
        if (mCA > 0) {
            totalPaidInvoices += mCA;
            caAnnuel += mCA;
            monthlyCA[currentMonth] += mCA; // On l'attribue au mois en cours pour l'affichage
            monthlyInvoicesAmount += mCA;
            const clientId = c.company || c.name || 'Inconnu';
            if (!caPerClient[clientId]) caPerClient[clientId] = { name: clientId, total: 0 };
            caPerClient[clientId].total += mCA;
        }
        if (mBen > 0) {
            beneficePapierTotal += mBen;
            beneficeMensuel += mBen;
        }
    });

    // --- AJOUT DU CA ET BENEFICE MANUELS DES SOCIÉTÉS ---
    companiesData.forEach(comp => {
        const mCA = Number(comp.manualCA || 0);
        const mBen = Number(comp.manualBenefice || 0);
        if (mCA > 0) {
            totalPaidInvoices += mCA;
            caAnnuel += mCA;
            monthlyCA[currentMonth] += mCA;
            monthlyInvoicesAmount += mCA;
            const clientId = comp.name || 'Inconnu';
            if (!caPerClient[clientId]) caPerClient[clientId] = { name: clientId, total: 0 };
            caPerClient[clientId].total += mCA;
        }
        if (mBen > 0) {
            beneficePapierTotal += mBen;
            beneficeMensuel += mBen;
        }
    });

    const caDetails = Object.values(caPerClient).sort((a: any, b: any) => b.total - a.total);

    const pipelineValue = contacts.reduce((acc, c) => (c.status !== 'gagne' && c.status !== 'perdu') ? acc + Number(c.projectedBudget ?? 0) : acc, 0);

    return {
      caMensuel: monthlyInvoicesAmount,
      caTotal: totalPaidInvoices,
      caPotentiel: caPotentielInvoices,
      pipelineValue,
      activeCampaigns: simulations.length,
      monthlyCA,
      caAnnuel,
      beneficePapierTotal,
      beneficeReelTotal: beneficePapierTotal + arbitrageTotal,
      arbitrageTotal,
      beneficeMensuel,
      caDetails
    };
  }, [invoices, contacts, simulations, dashboardYear, companiesData]); // <-- DEPENDANCE dashboardYear ET companiesData AJOUTEES

  // --- ACTIONS ---
  const handleCreate = async (col: string, data: any) => {
    if (isOfflineMode) return addNotification('error', 'Mode hors-ligne : Sauvegarde impossible');
    if (!user) return;
    try {
      await addDoc(collection(db, `artifacts/${getAppId()}/users/${user.uid}/${col}`), { ...data, createdAt: new Date().toISOString() });
      setShowModal(null);
      addNotification('success', 'Élément créé avec succès');
    } catch (e) { addNotification('error', 'Erreur lors de la création'); }
  };

  const handleUpdate = async (col: string, id: string, data: any) => {
    if (isOfflineMode || !user) return;
    try {
      await updateDoc(doc(db, `artifacts/${getAppId()}/users/${user.uid}/${col}`, id), data);
      addNotification('success', 'Mise à jour effectuée');
    } catch (e) { addNotification('error', 'Erreur de mise à jour'); }
  };

  const handleDelete = async (col: string, id: string) => {
    if (isOfflineMode || !user) return;
    openConfirm("Supprimer l'élément ?", 'Cette action est irréversible.', async () => {
      try {
        await deleteDoc(doc(db, `artifacts/${getAppId()}/users/${user.uid}/${col}`, id));
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

  const handleInvoiceStatusChange = async (inv: any, newStatus: string) => {
      if (!user || isOfflineMode) return;
      await handleUpdate('invoices', inv.id, { status: newStatus });
      
      if (newStatus === 'payee' && inv.status !== 'payee') {
          // Vérifier si une prod a déjà été lancée pour éviter les doublons
          const existingSim = simulations.find((s: any) => s.invoiceId === inv.id);
          if (existingSim) return;

          const client = contacts.find(c => c.id === inv.clientId);
          const activeProduct = products.find(p => p.id === inv.themeId) || products.find(p => p.id === client?.interestedProductId) || products[0];

          if (activeProduct) {
              const marginPercent = inv.marginPercent !== undefined ? inv.marginPercent : 35;
              const mgtFees = inv.amount * (marginPercent / 100);
              const mediaBudget = inv.amount - mgtFees;

              const volumeTotal = Math.floor(mediaBudget / activeProduct.price);
              const costTotal = volumeTotal * (activeProduct.cost || (activeProduct.price * 0.4));
              const arbitrage = mediaBudget - costTotal;
              const profit = mgtFees + arbitrage;

              const simData = { 
                  invoiceId: inv.id, // On lie le cycle à la facture
                  budget: inv.amount, 
                  duration: 30,
                  productId: activeProduct.id, 
                  productName: activeProduct.name, 
                  clientId: inv.clientId || '', 
                  clientName: inv.clientName || 'Client', 
                  stats: { volumeTotal, costTotal, profit, arbitrage, fees: mgtFees, margin: (profit/inv.amount)*100 },
                  createdAt: new Date().toISOString(),
                  dataSource: 'deliveries',
                  deliveryMatchName: inv.clientName || 'Client'
              };
              await handleCreate('simulations', simData);
              addNotification('success', 'Facture payée : Prod média lancée et arbitrage calculé !');
          }
      }
  };

  const handleSaveProductForm = async (e: any) => {
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

  const handleSaveCompanyEdit = async () => {
    if (!selectedCompanyName || !user) return;
    const existingCompany = companiesData.find(c => c.name === selectedCompanyName);
    
    if (existingCompany) {
        await handleUpdate('companies', existingCompany.id, editCompanyDataState);
    } else {
        await handleCreate('companies', { ...editCompanyDataState, name: selectedCompanyName });
    }
    
    // Mise à jour en cascade des contacts de la société si le statut a changé
    if (editCompanyDataState.type && editCompanyDataState.type !== (existingCompany?.type || 'prospect')) {
        const companyContacts = contacts.filter(c => c.company === selectedCompanyName);
        companyContacts.forEach(async (c) => {
            await handleUpdate('contacts', c.id, { type: editCompanyDataState.type, status: editCompanyDataState.type === 'client' ? 'gagne' : 'nouveau' });
        });
    }

    setIsEditingCompany(false);
    addNotification('success', 'Informations de la société mises à jour');
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

  const handleSetCompanyReminder = async (days: number) => {
      if (!selectedCompanyName || !user) return;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      const existingCompany = companiesData.find(c => c.name === selectedCompanyName);
      const data = { nextContactDate: targetDate.toISOString(), nextContactNote: companyReminderNote || `Relance planifiée (J+${days})` };
      if (existingCompany) {
          await handleUpdate('companies', existingCompany.id, data);
      } else {
          await handleCreate('companies', { name: selectedCompanyName, ...data });
      }
      setCompanyReminderNote('');
      addNotification('success', 'Rappel société programmé');
  };

  const handleClearCompanyReminder = async () => {
      if (!selectedCompanyName || !user) return;
      const existingCompany = companiesData.find(c => c.name === selectedCompanyName);
      if (existingCompany) await handleUpdate('companies', existingCompany.id, { nextContactDate: null, nextContactNote: '' });
  };

  const handleSetMeeting = async () => {
      if (!selectedContactId || !user || !meetingDate) return addNotification('error', 'Sélectionnez une date');
      await handleUpdate('contacts', selectedContactId, {
          meetingDate: new Date(meetingDate).toISOString(),
          meetingNote: meetingNote || 'Rendez-vous programmé'
      });
      setMeetingDate('');
      setMeetingNote('');
      addNotification('success', 'Rendez-vous programmé');
  };

  const handleClearMeeting = async () => {
      if (!selectedContactId || !user) return;
      await handleUpdate('contacts', selectedContactId, { meetingDate: null, meetingNote: '' });
  };

  const handleDeleteCompany = async () => {
      if (!selectedCompanyName || !user) return;
      openConfirm("Supprimer la société ?", "Attention : les contacts liés ne seront pas supprimés, mais ils perdront leur association.", async () => {
          const existingCompany = companiesData.find(c => c.name === selectedCompanyName);
          if (existingCompany) {
              await deleteDoc(doc(db, `artifacts/${getAppId()}/users/${user.uid}/companies`, existingCompany.id));
          }
          
          // Dissocier les contacts liés pour que la société disparaisse du tableau
          const linkedContacts = contacts.filter(c => c.company === selectedCompanyName);
          for (const contact of linkedContacts) {
              await handleUpdate('contacts', contact.id, { company: '' });
          }

          setSelectedCompanyName(null);
          addNotification('success', 'Société supprimée et contacts dissociés');
      });
  };

  const handleDeleteCampaignDeliveries = async (campaignName: string) => {
      if (!user || isOfflineMode) return;
      openConfirm("Supprimer la campagne ?", `Attention : Ceci va supprimer TOUTES les livraisons (${deliveries.filter((d:any) => d.campagne === campaignName).length} leads) associées à la campagne "${campaignName}". Cette action est irréversible.`, async () => {
          const batch = writeBatch(db);
          let count = 0;
          const deliveriesToDelete = deliveries.filter((d:any) => d.campagne === campaignName);
          
          deliveriesToDelete.slice(0, 490).forEach((d:any) => {
              const docRef = doc(db, `artifacts/${getAppId()}/users/${user.uid}/lead_deliveries`, d.id);
              batch.delete(docRef);
              count++;
          });
          
          try {
              await batch.commit();
              addNotification('success', `${count} livraisons supprimées avec succès.`);
              if(deliveriesToDelete.length > 490) addNotification('info', "Plus de 490 éléments. Veuillez relancer la suppression pour le reste.");
          } catch(e) {
              addNotification('error', 'Erreur lors de la suppression en masse.');
          }
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
    const clientName = activeClient ? activeClient.company : 'Client Inconnu';
    const simData = { 
        budget: planBudget, duration: planDuration, 
        productId: planProductId, productName: activeProduct.name, productPlatform: activeProduct.platform, 
        clientId: planClientId, clientName: clientName, 
        stats: simStats, createdAt: new Date().toISOString(),
        dataSource: planDataSource, deliveryMatchName: clientName
    };
    await addDoc(collection(db, `artifacts/${getAppId()}/users/${user.uid}/simulations`), simData);
    addNotification('success', 'Production média activée dans vos cycles.');
  };

  const handleSaveSettings = async (e: any) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const newSettings = {
      ...settings,
      companyName: (fd.get('companyName') as string) || settings.companyName, 
      companyId: (fd.get('companyId') as string) || settings.companyId, 
      address: (fd.get('address') as string) || settings.address, 
      email: (fd.get('email') as string) || settings.email, 
      phone: (fd.get('phone') as string) || settings.phone, 
      bankDetails: (fd.get('bankDetails') as string) || settings.bankDetails, 
      invoiceFooter: (fd.get('invoiceFooter') as string) || settings.invoiceFooter, 
      legalNotice: (fd.get('legalNotice') as string) || settings.legalNotice, 
      monthlyGoal: Number(fd.get('monthlyGoal')) || settings.monthlyGoal, 
      webhookUrl: (fd.get('webhookUrl') as string) || settings.webhookUrl, 
      webhookUrlProspection: (fd.get('webhookUrlProspection') as string) || settings.webhookUrlProspection, 
      defaultContractText: (fd.get('defaultContractText') as string) || settings.defaultContractText,
      primaryColor: BRAND_COLOR,
    };
    await setDoc(doc(db, `artifacts/${getAppId()}/users/${user.uid}/config`, 'general'), newSettings as any);
    setSettings(newSettings);
    addNotification('success', 'Paramètres sauvegardés !');
  };

  const handleSaveSettingsDirect = async (newSettingsObj: any) => {
      if (!user) return;
      const updated = { ...settings, ...newSettingsObj };
      await setDoc(doc(db, `artifacts/${getAppId()}/users/${user.uid}/config`, 'general'), updated);
      setSettings(updated);
      addNotification('success', 'Modèles mis à jour !');
  }

  const handleGenerateInvoice = () => {
    if (!invoiceBudget) return addNotification('error', 'Veuillez saisir un budget pour générer les lignes.');
    const theme = products.find((p) => p.id === invoiceThemeId);
    const budget = Number(invoiceBudget);
    const margin = Number(invoiceMarginPercent) / 100;
    const mediaBudget = budget * (1 - margin);
    const mgtFees = budget * margin;
    
    const expectedCpl = theme?.price || 10;
    const estimatedLeads = Math.floor(mediaBudget / expectedCpl);

    const newItems = [
      { 
        name: `Budget Net Investi en Média`, 
        description: `Génération de leads qualifiés (Volume estimé : ${estimatedLeads} leads).\nThématique : ${theme?.name || 'Générique'} - Plateforme : ${theme?.platform || 'Mix Media'}.`,
        price: mediaBudget, qty: 1 
      },
      { 
        name: `Frais de Gestion & Optimisation`, 
        description: `Création des campagnes, A/B testing, gestion des enchères et optimisation continue du CPL (${invoiceMarginPercent}% du budget).`,
        price: mgtFees, qty: 1 
      },
    ];
    setCurrentInvoice({ 
      ...(currentInvoice || {}), 
      themeId: theme?.id, 
      marginPercent: invoiceMarginPercent, 
      items: [...(currentInvoice?.items || []), ...newItems] 
    });
    addNotification('success', 'Lignes calculées avec volume de leads estimé.');
  };

  const handleSaveInvoice = async (closeModal: boolean = true) => {
    const shouldClose = typeof closeModal === 'boolean' ? closeModal : true;
    if (!user || !currentInvoice || (!currentInvoice.clientId && !currentInvoice.clientName)) {
        addNotification('error', 'Veuillez renseigner ou lier un client.');
        return false;
    }
    const cleanInvoiceData = JSON.parse(JSON.stringify(currentInvoice));
    const amount = (cleanInvoiceData.items || []).reduce((acc: number, item: any) => acc + Number(item.price) * (item.qty || 1), 0);
    const invData = { ...cleanInvoiceData, amount, clientName: cleanInvoiceData.clientName || 'Client Inconnu' };
    
    try {
      await setDoc(doc(db, `artifacts/${getAppId()}/users/${user.uid}/invoices`, invData.id), invData);
      if (shouldClose) setShowModal(null); 
      addNotification('success', 'Facture sauvegardée avec succès');
      return true;
    } catch (e) { 
      addNotification('error', 'Erreur lors de la sauvegarde'); 
      return false;
    }
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('invoice-printable');
    if (!element) return;
    addNotification('info', 'Génération du PDF en cours...');
    try {
        const html2pdf = await requireHtml2Pdf();
        html2pdf().set(getPdfOptions(`Facture_${currentInvoice?.clientName || 'LeadPartner'}.pdf`)).from(element).save();
    } catch(e) {
        addNotification('error', 'Erreur de chargement du moteur PDF.');
    }
  };

  // --- GESTION DES EMAILS & TEMPLATES ---
  const applyEmailTemplate = (templateId: string, invoice: any, clientEmail: string, prospectContact: any = null) => {
      const templatesList = invoice ? (settings.emailTemplates || []) : (settings.prospectEmailTemplates || []);
      const template = templatesList.find((t: any) => t.id === templateId) || templatesList[0];
      if (!template) return;

      const invId = invoice?.id || 'N/A';
      
      // Calcul du montant en temps réel (même si la facture n'est pas encore sauvegardée)
      const invoiceTotal = invoice ? (invoice.amount || (invoice.items || []).reduce((acc: number, item: any) => acc + Number(item.price) * (item.qty || 1), 0)) : 0;
      const amount = invoice ? formatCurrency(invoiceTotal) : '';
      
      const company = settings.companyName;
      const clientName = invoice?.clientName || prospectContact?.company || 'Client';

      const contactAssocie = prospectContact || contacts.find(c => c.id === invoice?.clientId);
      const nomCompletContact = contactAssocie?.name || '';
      const prenomContact = nomCompletContact.split(' ')[0] || '';

      // Remplacement des variables dynamiques
      const replaceVars = (str: string) => {
          return str
            .replace(/\{\{facture\}\}/g, invId)
            .replace(/\{\{montant\}\}/g, amount)
            .replace(/\{\{agence\}\}/g, company)
            .replace(/\{\{client\}\}/g, clientName)
            .replace(/\{\{societe\}\}/g, clientName)
            .replace(/\{\{nom_contact\}\}/g, nomCompletContact)
            .replace(/\{\{prenom_contact\}\}/g, prenomContact);
      };

      setEmailData((prev: any) => ({ 
          ...prev,
          to: clientEmail, 
          subject: replaceVars(template.subject), 
          body: replaceVars(template.body), 
          isSending: false, 
          selectedTemplate: template.id,
          prospectContact: prospectContact
      }));
  };

  const handleEmailInvoice = async () => {
      if (!currentInvoice) return addNotification('error', 'Erreur facture.');
      
      // Sauvegarde automatique et silencieuse avant d'envoyer
      const saved = await handleSaveInvoice(false);
      if (!saved) return;
      
      const clientEmail = contacts.find(c => c.id === currentInvoice.clientId)?.email || '';
      applyEmailTemplate(settings.emailTemplates?.[0]?.id || 'std', currentInvoice, clientEmail);
      setShowEmailModal(true);
  };

  const handleEmailProspect = (contact: any) => {
      setCurrentInvoice(null);
      applyEmailTemplate(settings.prospectEmailTemplates?.[0]?.id || 'prospect_1', null, contact.email, contact);
      setShowEmailModal(true);
  };

  const handleSendEmailFromModal = async () => {
    const activeWebhookUrl = currentInvoice ? settings.webhookUrl : settings.webhookUrlProspection;

    if (!emailData.to) return addNotification('error', 'Veuillez renseigner une adresse email valide.');
    if (!activeWebhookUrl) return addNotification('error', `URL du Webhook (${currentInvoice ? 'Facturation' : 'Prospection'}) non configurée.`);
    
    setEmailData((prev: any) => ({ ...prev, isSending: true }));
    
    try {
        let cleanBase64 = '';
        let contractBase64 = '';

        if (currentInvoice) {
            const element = document.getElementById('invoice-printable');
            if (!element) throw new Error("Document HTML introuvable");

            const html2pdf = await requireHtml2Pdf();

            if (emailData.sendContractSeparately && currentInvoice.includeContract && currentInvoice.contractText) {
                // Cacher le contrat pour capturer la facture seule
                const contractEl = element.querySelector('.html2pdf__page-break') as HTMLElement;
                if (contractEl) contractEl.style.display = 'none';
                
                const optInv = getPdfOptions(`Facture_${currentInvoice?.id}.pdf`);
                const rawPdfBase64: any = await new Promise((resolve) => {
                     html2pdf().set(optInv).from(element).toPdf().get('pdf').then((pdf: any) => resolve(pdf.output('datauristring')));
                });
                cleanBase64 = rawPdfBase64.includes('base64,') ? rawPdfBase64.substring(rawPdfBase64.indexOf('base64,') + 7) : rawPdfBase64;

                // Remettre le contrat, cacher la facture, pour capturer le contrat seul
                if (contractEl) {
                    contractEl.style.display = 'flex';
                    const invoicePage1 = element.querySelector('.invoice-page-1') as HTMLElement;
                    if (invoicePage1) invoicePage1.style.display = 'none';

                    const optCont = getPdfOptions(`Contrat_${currentInvoice?.id}.pdf`);
                    const rawContBase64: any = await new Promise((resolve) => {
                        html2pdf().set(optCont).from(element).toPdf().get('pdf').then((pdf: any) => resolve(pdf.output('datauristring')));
                    });
                    contractBase64 = rawContBase64.includes('base64,') ? rawContBase64.substring(rawContBase64.indexOf('base64,') + 7) : rawContBase64;
                    
                    // Réafficher la facture
                    if (invoicePage1) invoicePage1.style.display = 'flex';
                }
            } else {
                const opt = getPdfOptions(`Facture_${currentInvoice?.id}.pdf`);
                const rawPdfBase64: any = await new Promise((resolve) => {
                     html2pdf().set(opt).from(element).toPdf().get('pdf').then((pdf: any) => resolve(pdf.output('datauristring')));
                });
                cleanBase64 = rawPdfBase64.includes('base64,') ? rawPdfBase64.substring(rawPdfBase64.indexOf('base64,') + 7) : rawPdfBase64;
            }
        }

        // Conversion des sauts de ligne textuels en balises HTML <br> pour l'affichage email
        const formattedMessage = emailData.body.replace(/\n/g, '<br>');

        const payload: any = {
            to_email: emailData.to,
            subject: emailData.subject,
            message: formattedMessage,
            reply_to: settings.email,
            invoice_id: currentInvoice?.id || 'Prospection',
            client_name: currentInvoice?.clientName || emailData.prospectContact?.company || emailData.to,
        };

        if (cleanBase64) payload.pdf_attachment_base64 = cleanBase64;
        // Force l'envoi de la variable à Make/Zapier, même si le contrat est vide
        payload.contract_attachment_base64 = contractBase64 || '';

        const response = await fetch(activeWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            // Sauvegarde dans l'historique Firestore
            if (user && !isOfflineMode) {
                await handleCreate('email_logs', {
                    to: emailData.to,
                    subject: emailData.subject,
                    type: currentInvoice ? 'Facture' : 'Prospection',
                    date: new Date().toISOString()
                });
            }

            addNotification('success', `L'email a été transmis à votre outil d'automatisation.`);
            setShowEmailModal(false);
        } else {
            throw new Error("Erreur de réponse du Webhook");
        }
    } catch (error) {
        console.error("Erreur d'envoi:", error);
        addNotification('error', "Échec de l'envoi. Vérifiez l'URL de votre Webhook.");
    } finally {
        setEmailData((prev: any) => ({ ...prev, isSending: false }));
    }
  };

  const handleExportData = () => {
      const exportData = {
          exportDate: new Date().toISOString(),
          appId: getAppId(),
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

  const renderDeliveries = () => {
      // Groupement des données
      const byCampaign = deliveries.reduce((acc: any, d: any) => {
          const camp = d.campagne || 'Inconnue';
          acc[camp] = (acc[camp] || 0) + 1;
          return acc;
      }, {});
      
      const byAgent = deliveries.reduce((acc: any, d: any) => {
          const agent = d.agentName || 'Inconnu';
          acc[agent] = (acc[agent] || 0) + 1;
          return acc;
      }, {});

      // NOUVEAU: Groupement par jour de la semaine
      const byDayOfWeek = [0, 0, 0, 0, 0, 0, 0]; // Dim, Lun, Mar, Mer, Jeu, Ven, Sam

      // Groupement par campagne ET client (Détail croisé)
      const deliveriesByCampaignAndClient = deliveries.reduce((acc: any, d: any) => {
          const camp = d.campagne || 'Inconnue';
          const agent = d.agentName || 'Inconnu';
          if (!acc[camp]) acc[camp] = {};
          if (!acc[camp][agent]) acc[camp][agent] = 0;
          acc[camp][agent]++;
          return acc;
      }, {});

      // Groupement par date pour l'évolution
      const byDate = deliveries.reduce((acc: any, d: any) => {
          const dateStr = d.date || d.createdAt;
          if (!dateStr) return acc;
          const dateObj = new Date(dateStr);
          if (isNaN(dateObj.getTime())) return acc;
          
          // Ajout au jour de la semaine
          byDayOfWeek[dateObj.getDay()]++;

          const key = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
      }, {});

      const sortedCampaigns = Object.entries(byCampaign).sort((a: any, b: any) => b[1] - a[1]);
      const sortedAgents = Object.entries(byAgent).sort((a: any, b: any) => b[1] - a[1]);
      const maxCampaign = sortedCampaigns.length > 0 ? (sortedCampaigns[0][1] as number) : 1;
      const maxAgent = sortedAgents.length > 0 ? (sortedAgents[0][1] as number) : 1;

      // Tri des dates (les 30 derniers jours actifs)
      const sortedDates = Object.entries(byDate).sort((a: any, b: any) => {
          const [d1, m1] = a[0].split('/');
          const [d2, m2] = b[0].split('/');
          const year = new Date().getFullYear();
          return new Date(year, Number(m1)-1, Number(d1)).getTime() - new Date(year, Number(m2)-1, Number(d2)).getTime();
      }).slice(-30);
      const maxDate = sortedDates.length > 0 ? Math.max(...sortedDates.map((d: any) => d[1] as number)) : 1;

      // KPIs
      const todayStr = `${new Date().getDate().toString().padStart(2, '0')}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
      const leadsToday = byDate[todayStr] || 0;
      
      // Leads depuis le début du mois
      const currentMonth = new Date().getMonth() + 1;
      const leadsThisMonth = Object.entries(byDate).reduce((acc: number, [dateKey, count]: any) => {
          const [, m] = dateKey.split('/');
          if (Number(m) === currentMonth) return acc + count;
          return acc;
      }, 0);

      // Moyenne par jour actif sur les 30 derniers jours
      const avgPerDay = sortedDates.length > 0 ? (sortedDates.reduce((acc: number, [, count]: any) => acc + count, 0) / sortedDates.length).toFixed(1) : '0';

      const daysLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      const maxDayOfWeek = Math.max(...byDayOfWeek, 1);

      // NOUVEAU: Données détaillées pour les onglets Campagnes et Clients
      const detailedCampaigns = deliveries.reduce((acc: any, d: any) => {
          const camp = d.campagne || 'Inconnue';
          if(!acc[camp]) acc[camp] = { total: 0, today: 0, thisMonth: 0, clients: {} };
          acc[camp].total++;
          
          const dateStr = d.date || d.createdAt;
          if (dateStr) {
              const dateObj = new Date(dateStr);
              if (!isNaN(dateObj.getTime())) {
                  const isToday = dateObj.toDateString() === new Date().toDateString();
                  const isThisMonth = dateObj.getMonth() === new Date().getMonth() && dateObj.getFullYear() === new Date().getFullYear();
                  if (isToday) acc[camp].today++;
                  if (isThisMonth) acc[camp].thisMonth++;
              }
          }
          const agent = d.agentName || 'Inconnu';
          acc[camp].clients[agent] = (acc[camp].clients[agent] || 0) + 1;
          return acc;
      }, {});

      const detailedClients = deliveries.reduce((acc: any, d: any) => {
          const agent = d.agentName || 'Inconnu';
          if(!acc[agent]) acc[agent] = { total: 0, today: 0, thisMonth: 0, campaigns: {} };
          acc[agent].total++;
          
          const dateStr = d.date || d.createdAt;
          if (dateStr) {
              const dateObj = new Date(dateStr);
              if (!isNaN(dateObj.getTime())) {
                  const isToday = dateObj.toDateString() === new Date().toDateString();
                  const isThisMonth = dateObj.getMonth() === new Date().getMonth() && dateObj.getFullYear() === new Date().getFullYear();
                  if (isToday) acc[agent].today++;
                  if (isThisMonth) acc[agent].thisMonth++;
              }
          }
          const camp = d.campagne || 'Inconnue';
          acc[agent].campaigns[camp] = (acc[agent].campaigns[camp] || 0) + 1;
          return acc;
      }, {});

      return (
        <div className="max-w-6xl mx-auto animate-fade-in space-y-8 pb-12">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-800 font-poppins flex items-center gap-3">
                        <Activity style={{ color: BRAND_COLOR }} size={32} /> Suivi des Livraisons (Leads)
                    </h2>
                    <p className="text-slate-500 text-lg mt-1">Surveillez et analysez les volumes de leads distribués en temps réel.</p>
                </div>
            </div>

            <div className="flex gap-3 mb-6 border-b border-slate-200 pb-4 overflow-x-auto custom-scrollbar">
               <button onClick={() => setDeliveryActiveTab('global')} className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${deliveryActiveTab === 'global' ? 'bg-[#01189B] text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Vue Globale</button>
               <button onClick={() => setDeliveryActiveTab('campaigns')} className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${deliveryActiveTab === 'campaigns' ? 'bg-[#01189B] text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Vue par Campagne</button>
               <button onClick={() => setDeliveryActiveTab('clients')} className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${deliveryActiveTab === 'clients' ? 'bg-[#01189B] text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Vue par Client</button>
               <button onClick={() => setDeliveryActiveTab('kpis')} className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${deliveryActiveTab === 'kpis' ? 'bg-[#01189B] text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>KPI & Performances</button>
            </div>

            {deliveryActiveTab === 'kpis' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Top Level KPIs based on GSheet Data */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {(() => {
                            const totalSpend = campaignKpis.reduce((acc, k) => acc + Number(k.spend || 0), 0);
                            const totalSheetLeads = campaignKpis.reduce((acc, k) => acc + Number(k.leads || 0), 0);
                            const avgCpl = totalSheetLeads > 0 ? totalSpend / totalSheetLeads : 0;
                            return (
                                <>
                                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-[#01189B]"><Wallet size={28}/></div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Dépense Globale (Sheet)</p>
                                            <p className="text-2xl font-black text-slate-800 font-mono">{renderCurrency(totalSpend)}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600"><Users size={28}/></div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Leads (Sheet)</p>
                                            <p className="text-2xl font-black text-indigo-700 font-poppins">{renderNumber(totalSheetLeads)}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600"><TrendingUp size={28}/></div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">CPL Moyen Global</p>
                                            <p className="text-2xl font-black text-emerald-600 font-mono">{renderCurrency(avgCpl)}</p>
                                        </div>
                                    </div>
                                </>
                            )
                        })()}
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-8">
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg"><Users size={20} className="text-[#01189B]"/> Performances par Agent / Client (Calculées)</h3>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white text-slate-500 uppercase font-extrabold text-[10px] tracking-wider border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4">Agent / Client Ciblé</th>
                                        <th className="px-6 py-4 text-center">Leads Reçus (CRM)</th>
                                        <th className="px-6 py-4">Budget Consommé (Estim.)</th>
                                        <th className="px-6 py-4">CPL Moyen d'Acquisition</th>
                                        <th className="px-6 py-4">Sources d'Acquisition</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {Object.entries(detailedClients).sort((a:any, b:any) => b[1].total - a[1].total).map(([agent, stats]: any) => {
                                        let consumedBudget = 0;
                                        Object.entries(stats.campaigns).forEach(([campName, count]: any) => {
                                            const sheetKpi = campaignKpis.find((k:any) => k.name === campName);
                                            const exactSpend = sheetKpi ? Number(sheetKpi.spend) : null;
                                            
                                            const sim = simulations.find(s => s.productName === campName || s.clientName === campName);
                                            const dailyBudget = sim?.manualDailyBudget || (sim?.stats?.costTotal && sim?.duration ? (sim.stats.costTotal / sim.duration) : 0);
                                            
                                            const start = sim?.createdAt ? new Date(sim.createdAt) : new Date();
                                            const daysElapsed = Math.max(1, Math.floor((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                                            const estimatedSpend = dailyBudget * daysElapsed;
                                            
                                            const displaySpend = exactSpend !== null ? exactSpend : estimatedSpend;
                                            const campTotalLeads = detailedCampaigns[campName]?.total || 1; 
                                            const cpl = displaySpend / campTotalLeads;
                                            
                                            consumedBudget += (cpl * count);
                                        });

                                        const avgAgentCpl = stats.total > 0 ? (consumedBudget / stats.total) : 0;

                                        return (
                                            <tr key={agent} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4 font-bold text-slate-800 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-[#01189B] flex items-center justify-center text-xs shrink-0">{agent.substring(0,2).toUpperCase()}</div> 
                                                    <span className="truncate max-w-[150px]" title={agent}>{agent}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center"><span className="bg-blue-50 text-[#01189B] px-3 py-1 rounded-lg font-black">{stats.total}</span></td>
                                                <td className="px-6 py-4 font-mono font-bold text-orange-600">{renderCurrency(consumedBudget)}</td>
                                                <td className="px-6 py-4 font-mono font-bold text-emerald-600">{renderCurrency(avgAgentCpl)}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {Object.entries(stats.campaigns).map(([c, cnt]: any) => (
                                                            <span key={c} className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200 uppercase tracking-wide truncate max-w-[120px]" title={c}>{c} <span className="text-blue-500">({cnt})</span></span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-8">
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg"><Package size={20} className="text-[#01189B]"/> Performances par Campagne</h3>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white text-slate-500 uppercase font-extrabold text-[10px] tracking-wider border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4">Nom de la Campagne</th>
                                        <th className="px-6 py-4 text-center">Leads Générés (CRM)</th>
                                        <th className="px-6 py-4">Dépense Média (Budget)</th>
                                        <th className="px-6 py-4">Coût par Lead (CPL)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {Object.entries(detailedCampaigns).sort((a:any, b:any) => b[1].total - a[1].total).map(([campName, stats]: any) => {
                                        const sheetKpi = campaignKpis.find((k:any) => k.name === campName);
                                        const exactSpend = sheetKpi ? Number(sheetKpi.spend) : null;
                                        
                                        const sim = simulations.find(s => s.productName === campName || s.clientName === campName);
                                        const dailyBudget = sim?.manualDailyBudget || (sim?.stats?.costTotal && sim?.duration ? (sim.stats.costTotal / sim.duration) : 0);
                                        
                                        const start = sim?.createdAt ? new Date(sim.createdAt) : new Date();
                                        const daysElapsed = Math.max(1, Math.floor((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                                        const estimatedSpend = dailyBudget * daysElapsed;
                                        
                                        const displaySpend = exactSpend !== null ? exactSpend : estimatedSpend;
                                        const cpl = stats.total > 0 ? (displaySpend / stats.total) : 0;

                                        return (
                                            <tr key={campName} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4 font-bold text-slate-800 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0"><Target size={14}/></div>
                                                    <span className="truncate max-w-[200px]" title={campName}>{campName}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center"><span className="bg-blue-50 text-[#01189B] px-3 py-1 rounded-lg font-black">{stats.total}</span></td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-mono font-bold text-orange-600">{renderCurrency(displaySpend)}</span>
                                                        {exactSpend !== null ? (
                                                            <span className="text-[9px] text-purple-500 font-bold uppercase tracking-widest mt-0.5">Via Sheet</span>
                                                        ) : (
                                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Estimé</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`font-mono font-bold ${cpl > 40 ? 'text-red-500' : 'text-emerald-600'}`}>{renderCurrency(cpl)}</span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {deliveryActiveTab === 'campaigns' && (
                <div className="space-y-6">
                    <div className="bg-blue-900 text-white p-6 rounded-3xl shadow-lg border border-blue-800 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex-1">
                            <h3 className="text-xl font-bold flex items-center gap-2"><Zap className="text-yellow-400" /> Connexion Google Sheets</h3>
                            <p className="text-blue-200 text-sm mt-1">Utilisez le script ci-dessous pour synchroniser vos dépenses publicitaires et vos leads depuis votre Sheet.</p>
                        </div>
                        <button 
                            onClick={() => {
                                const script = `/**
 * SCRIPT DIRECT : SHEET KPIs -> FIREBASE CRM LEADPARTNER
 * Utilise vos propres identifiants de connexion CRM.
 */
function pushKpiToCrmDaily() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) {
    Logger.log("Synchronisation déjà en cours.");
    return;
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();

    // -- VOS IDENTIFIANTS DE CONNEXION CRM --
    const USER_EMAIL = "contact@leadpartner.ch"; 
    const USER_PASSWORD = "3Wadewade3*";

    // -- CONFIGURATION TECHNIQUE --
    const apiKey = "${fallbackFirebaseConfig.apiKey || 'AIzaSyDY6zXLeebKhMxL_2_mfQOYV44JuoCArK0'}";
    const projectId = "${fallbackFirebaseConfig.projectId || 'crm-leadpartner'}";
    const appId = "${getAppId()}";
    const uid = "${user?.uid || 'Jun1vEWPSgXnWldncg4M8QTVL0r1'}";

    let idToken = null;

    // 1. Authentification Firebase
    const authUrl = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + apiKey;
    const authRes = UrlFetchApp.fetch(authUrl, {
      method: "post",
      payload: JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD, returnSecureToken: true }),
      contentType: "application/json",
      muteHttpExceptions: true
    });
    const authJson = JSON.parse(authRes.getContentText());
    if (authJson.error) return Logger.log("Erreur Auth : " + authJson.error.message);
    idToken = authJson.idToken;

    // 2. Préparation des données
    const campaigns = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] && String(row[0]).trim() !== "") {
        campaigns.push({
          mapValue: {
            fields: {
              name: { stringValue: String(row[0]) },
              spend: { doubleValue: Number(row[1]) || 0 },
              leads: { integerValue: String(parseInt(row[2], 10) || 0) }
            }
          }
        });
      }
    }

    if (campaigns.length === 0) return Logger.log("Aucune donnée à synchroniser.");

    // Enregistrement sur le document 'latest'
    const firebaseUrl = "https://firestore.googleapis.com/v1/projects/" + projectId + "/databases/(default)/documents/artifacts/" + appId + "/users/" + uid + "/campaign_kpis/latest";

    const payload = {
      fields: {
        date: { stringValue: new Date().toISOString() },
        campaigns: { arrayValue: { values: campaigns } }
      }
    };

    const options = {
      method: "patch", 
      contentType: "application/json",
      headers: { "Authorization": "Bearer " + idToken },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(firebaseUrl, options);
    Logger.log("Synchro terminée. Statut HTTP : " + response.getResponseCode());
    
  } catch (e) {
    Logger.log("Erreur réseau/technique : " + e.toString());
  } finally {
    lock.releaseLock();
  }
}`;
                                navigator.clipboard.writeText(script);
                                addNotification('success', 'Script de synchronisation direct Firebase copié !');
                            }}
                            className="bg-white text-blue-900 px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-blue-50 transition-colors"
                        >
                            <Copy size={18} /> Copier l'AppScript KPI
                        </button>
                    </div>

                    {Object.keys(detailedCampaigns).length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-sm text-slate-400 font-medium">Aucune campagne enregistrée.</div>
                    ) : (
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500 uppercase font-extrabold text-[10px] tracking-wider border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4">Nom de la Campagne</th>
                                        <th className="px-6 py-4 text-center">Leads</th>
                                        <th className="px-6 py-4">Budget Jour</th>
                                        <th className="px-6 py-4">Coût par Lead (CPL)</th>
                                        <th className="px-6 py-4">Objectif & Reste</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {Object.entries(detailedCampaigns).sort((a:any,b:any) => b[1].total - a[1].total).map(([campName, stats]: any) => {
                                        const sheetKpi = campaignKpis.find((k:any) => k.name === campName);
                                        const exactSpend = sheetKpi ? Number(sheetKpi.spend) : null;

                                        const sim = simulations.find(s => s.productName === campName || s.clientName === campName);
                                        const dailyBudget = sim?.manualDailyBudget || (sim?.stats?.costTotal && sim?.duration ? (sim.stats.costTotal / sim.duration) : 0);
                                        const objective = sim?.manualObjective || (stats.total + 10);
                                        
                                        const start = sim?.createdAt ? new Date(sim.createdAt) : new Date();
                                        const daysElapsed = Math.max(1, Math.floor((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                                        const estimatedSpend = dailyBudget * daysElapsed;
                                        
                                        const displaySpend = exactSpend !== null ? exactSpend : estimatedSpend;
                                        const cpl = stats.total > 0 ? (displaySpend / stats.total) : 0;
                                        
                                        const remaining = Math.max(0, objective - stats.total);
                                        const progress = Math.min(100, (stats.total / objective) * 100);

                                        return (
                                            <tr key={campName} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-bold text-slate-800">{campName}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg font-black">{stats.total}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold text-slate-600">
                                                            {exactSpend !== null ? (
                                                                <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded text-[10px] uppercase tracking-widest">{renderCurrency(exactSpend)} (Sheet)</span>
                                                            ) : (
                                                                `${renderCurrency(dailyBudget)}/j`
                                                            )}
                                                        </span>
                                                        <button 
                                                            onClick={() => {
                                                                const val = prompt("Nouveau budget journalier (CHF) :", dailyBudget.toString());
                                                                if (val !== null && !isNaN(Number(val))) {
                                                                    if (sim?.id) {
                                                                        handleUpdate('simulations', sim.id, { manualDailyBudget: Number(val) });
                                                                    } else {
                                                                        addNotification('info', "Associez cette campagne à une production média (onglet Campagnes) pour sauvegarder le budget.");
                                                                    }
                                                                }
                                                            }}
                                                            className="p-1 text-slate-300 hover:text-blue-500 transition-colors"
                                                        ><Edit2 size={12}/></button>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`font-bold ${cpl > 40 ? 'text-orange-500' : 'text-emerald-500'}`}>
                                                        {renderCurrency(cpl)} <span className="text-[10px] text-slate-400">/ lead</span>
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 min-w-[80px]">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Progression</p>
                                                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                                <div className="bg-[#01189B] h-full transition-all" style={{ width: `${progress}%` }}></div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <p className="text-xs font-black text-slate-700">{remaining} à faire</p>
                                                            <button 
                                                                onClick={() => {
                                                                    const val = prompt("Nouvel objectif total de leads :", objective.toString());
                                                                    if (val !== null && !isNaN(Number(val))) {
                                                                        if (sim?.id) {
                                                                            handleUpdate('simulations', sim.id, { manualObjective: Number(val) });
                                                                        } else {
                                                                            addNotification('info', "Associez cette campagne à une production média pour sauvegarder l'objectif.");
                                                                        }
                                                                    }
                                                                }}
                                                                className="text-[9px] font-bold text-blue-500 hover:underline"
                                                            >Éditer ({objective})</button>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => handleDeleteCampaignDeliveries(campName)} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={16}/></button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {deliveryActiveTab === 'clients' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {Object.keys(detailedClients).length === 0 ? (
                        <div className="col-span-full text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-sm text-slate-400 font-medium">Aucun client trouvé dans les livraisons.</div>
                    ) : (
                        Object.entries(detailedClients).sort((a:any,b:any) => b[1].total - a[1].total).map(([clientName, stats]: any) => {
                            let consumedBudget = 0;
                            Object.entries(stats.campaigns).forEach(([campName, count]: any) => {
                                const sheetKpi = campaignKpis.find((k:any) => k.name === campName);
                                const exactSpend = sheetKpi ? Number(sheetKpi.spend) : null;
                                
                                const sim = simulations.find(s => s.productName === campName || s.clientName === campName);
                                const dailyBudget = sim?.manualDailyBudget || (sim?.stats?.costTotal && sim?.duration ? (sim.stats.costTotal / sim.duration) : 0);
                                
                                const start = sim?.createdAt ? new Date(sim.createdAt) : new Date();
                                const daysElapsed = Math.max(1, Math.floor((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                                const estimatedSpend = dailyBudget * daysElapsed;
                                
                                const displaySpend = exactSpend !== null ? exactSpend : estimatedSpend;
                                const campTotalLeads = detailedCampaigns[campName]?.total || 1; 
                                const cpl = displaySpend / campTotalLeads;
                                
                                consumedBudget += (cpl * count);
                            });

                            const contactMatch = contacts.find(c => c.company === clientName || c.name === clientName);
                            const tBudget = contactMatch?.deliveryTargetBudget || 0;
                            const tCPL = contactMatch?.deliveryTargetCPL || 40;
                            const tDuration = contactMatch?.deliveryTargetDuration || 30;

                            const tLeads = tCPL > 0 ? Math.floor(tBudget / tCPL) : 0;
                            const dailyBudgetTarget = tDuration > 0 ? (tBudget / tDuration) : 0;
                            const dailyLeadsTarget = tDuration > 0 ? (tLeads / tDuration) : 0;
                            const remainingLeads = Math.max(0, tLeads - stats.total);
                            const remainingBudget = Math.max(0, tBudget - consumedBudget);

                            return (
                            <div key={clientName} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-[#01189B] transition-colors flex flex-col">
                               <div className="flex justify-between items-start mb-6">
                                   <h3 className="font-extrabold text-lg text-slate-800 flex items-center gap-2 font-poppins"><Users className="text-[#01189B]" size={20}/> <span className="truncate">{clientName}</span></h3>
                                   {!contactMatch && <span className="bg-red-50 text-red-500 text-[9px] px-2 py-1 rounded-md font-bold uppercase" title="Créez une fiche CRM au même nom pour débloquer les objectifs">Non lié au CRM</span>}
                               </div>
                               
                               <div className="grid grid-cols-2 gap-3 mb-6">
                                   <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100"><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Leads Livrés</p><p className="text-2xl font-black text-[#01189B] font-poppins">{stats.total}</p></div>
                                   <div className="bg-orange-50 p-3 rounded-2xl border border-orange-100"><p className="text-[10px] text-orange-600 font-bold uppercase tracking-widest mb-1">Budget Consommé</p><p className="text-xl font-black text-orange-700 font-mono mt-1">{renderCurrency(consumedBudget)}</p></div>
                               </div>

                               {/* WIDGET PILOTAGE & OBJECTIFS */}
                               <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6">
                                   <div className="flex justify-between items-center mb-3">
                                       <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1.5"><Target size={14} className="text-[#01189B]"/> Pilotage & Objectifs Cibles</h4>
                                   </div>
                                   
                                   <div className="grid grid-cols-2 gap-2 mb-3">
                                       <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm relative group">
                                           <p className="text-[9px] text-slate-400 font-bold uppercase">Budget Alloué</p>
                                           <p className="font-mono font-bold text-[#01189B] text-sm mt-0.5">{renderCurrency(tBudget)}</p>
                                           <button onClick={() => {
                                               if (!contactMatch) return addNotification('error', "Fiche CRM introuvable. Créez un contact avec ce nom exact.");
                                               const val = prompt("Budget global alloué (CHF) :", tBudget.toString());
                                               if (val !== null && !isNaN(Number(val))) handleUpdate('contacts', contactMatch.id, { deliveryTargetBudget: Number(val) });
                                           }} className="absolute top-2.5 right-2.5 text-slate-300 hover:text-[#01189B] opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 size={12}/></button>
                                       </div>
                                       <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm relative group">
                                           <p className="text-[9px] text-slate-400 font-bold uppercase">CPL Cible</p>
                                           <p className="font-mono font-bold text-emerald-600 text-sm mt-0.5">{renderCurrency(tCPL)}</p>
                                           <button onClick={() => {
                                               if (!contactMatch) return addNotification('error', "Fiche CRM introuvable.");
                                               const val = prompt("CPL Cible (CHF) :", tCPL.toString());
                                               if (val !== null && !isNaN(Number(val))) handleUpdate('contacts', contactMatch.id, { deliveryTargetCPL: Number(val) });
                                           }} className="absolute top-2.5 right-2.5 text-slate-300 hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 size={12}/></button>
                                       </div>
                                       <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm relative group">
                                           <p className="text-[9px] text-slate-400 font-bold uppercase">Durée de diffusion</p>
                                           <p className="font-mono font-bold text-slate-700 text-sm mt-0.5">{tDuration} jours</p>
                                           <button onClick={() => {
                                               if (!contactMatch) return addNotification('error', "Fiche CRM introuvable.");
                                               const val = prompt("Durée prévue (Jours) :", tDuration.toString());
                                               if (val !== null && !isNaN(Number(val))) handleUpdate('contacts', contactMatch.id, { deliveryTargetDuration: Number(val) });
                                           }} className="absolute top-2.5 right-2.5 text-slate-300 hover:text-[#01189B] opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 size={12}/></button>
                                       </div>
                                       <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
                                           <p className="text-[9px] text-slate-400 font-bold uppercase">Objectif Total Leads</p>
                                           <p className="font-mono font-bold text-orange-600 text-sm mt-0.5">{tLeads} <span className="text-[9px] font-sans font-medium text-slate-400">leads</span></p>
                                       </div>
                                   </div>

                                   <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
                                       <p className="text-[9px] font-bold text-[#01189B] uppercase tracking-widest mb-2 border-b border-blue-100 pb-1">Rythme à tenir (Pacing)</p>
                                       <div className="grid grid-cols-2 gap-2">
                                           <div>
                                               <p className="text-[9px] text-slate-500">Dépense Quotidienne</p>
                                               <p className="font-mono font-bold text-slate-800 text-xs">{renderCurrency(dailyBudgetTarget)}/j</p>
                                           </div>
                                           <div>
                                               <p className="text-[9px] text-slate-500">Leads Quotidiens</p>
                                               <p className="font-mono font-bold text-slate-800 text-xs">{dailyLeadsTarget.toFixed(1)}/j</p>
                                           </div>
                                           <div className="mt-2">
                                               <p className="text-[9px] text-slate-500">Budget Restant</p>
                                               <p className="font-mono font-bold text-orange-600 text-xs">{renderCurrency(remainingBudget)}</p>
                                           </div>
                                           <div className="mt-2">
                                               <p className="text-[9px] text-slate-500">Leads Restants</p>
                                               <p className="font-mono font-bold text-emerald-600 text-xs">{remainingLeads}</p>
                                           </div>
                                       </div>
                                   </div>
                               </div>

                               <div className="mt-auto pt-4 border-t border-slate-100">
                                   <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Package size={14}/> Sources (Campagnes)</h4>
                                   <div className="flex flex-wrap gap-2">
                                       {Object.entries(stats.campaigns).sort((a:any, b:any) => b[1] - a[1]).map(([camp, count]: any) => (
                                           <span key={camp} className="bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between w-full shadow-sm"><span className="truncate pr-2">{camp}</span> <span className="bg-white text-[#01189B] px-2 py-0.5 rounded-lg shadow-sm shrink-0">{count}</span></span>
                                       ))}
                                   </div>
                               </div>
                            </div>
                        )})
                    )}
                </div>
            )}

            {deliveryActiveTab === 'global' && (
              <>
            {/* QUICK STATS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="bg-white px-6 py-5 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex justify-between">Total Livré <Package size={14}/></p>
                    <p className="text-3xl font-black text-[#01189B] font-poppins">{deliveries.length}</p>
                </div>
                <div className="bg-white px-6 py-5 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex justify-between">Aujourd'hui <Clock size={14}/></p>
                    <p className="text-3xl font-black text-emerald-500 font-poppins">{leadsToday}</p>
                </div>
                <div className="bg-white px-6 py-5 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex justify-between truncate pr-2">Ce Mois-ci <CalendarClock size={14}/></p>
                    <p className="text-3xl font-black text-purple-600 font-poppins truncate">{leadsThisMonth}</p>
                </div>
                <div className="bg-white px-6 py-5 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex justify-between truncate pr-2">Moyenne / Jour <TrendingUp size={14}/></p>
                    <p className="text-3xl font-black text-orange-500 font-poppins truncate">{avgPerDay}</p>
                </div>
            </div>

            {/* EVOLUTION TEMPORELLE (30 Jours) */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8">
                <h3 className="font-extrabold text-slate-800 mb-6 flex items-center gap-2 text-lg"><TrendingUp className="text-[#01189B]" size={20}/> Évolution des Livraisons (30 derniers jours)</h3>
                {sortedDates.length === 0 ? (
                    <p className="text-slate-400 italic text-sm text-center py-6">Aucune donnée temporelle disponible.</p>
                ) : (
                    <div className="flex-1 flex items-end gap-1 h-56 border-b border-slate-100 pb-2 relative mt-4">
                        {sortedDates.map(([dateKey, count]: any, idx: number) => {
                            const percent = (count / maxDate) * 100;
                            return (
                                <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full relative group">
                                    <div className="w-full bg-blue-100/70 rounded-t-sm relative hover:bg-[#01189B] transition-all duration-300 cursor-pointer" style={{ height: `${Math.max(percent, 2)}%` }}>
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs font-bold py-1.5 px-2.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none shadow-xl">
                                            {count} leads
                                        </div>
                                    </div>
                                    <span className="text-[7px] md:text-[9px] font-bold text-slate-400 mt-2 rotate-45 md:rotate-0 origin-left">{dateKey}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Répartition par Jour de la Semaine */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 md:col-span-1">
                    <h3 className="font-extrabold text-slate-800 mb-6 flex items-center gap-2 text-lg"><CalendarIcon className="text-purple-500" size={20}/> Répartition par Jour</h3>
                    <div className="flex h-48 items-end gap-2 border-b border-slate-100 pb-2">
                        {byDayOfWeek.map((count, idx) => {
                            // Ordre: Lun (1) à Dim (0)
                            const displayIdx = (idx + 6) % 7; 
                            return { realIdx: idx, displayIdx, count };
                        }).sort((a, b) => a.displayIdx - b.displayIdx).map(({ realIdx, count }) => {
                            const percent = (count / maxDayOfWeek) * 100;
                            return (
                                <div key={realIdx} className="flex-1 flex flex-col items-center justify-end h-full relative group">
                                    <div className="w-full bg-purple-100 rounded-t-md relative hover:bg-purple-500 transition-all duration-300 cursor-pointer" style={{ height: `${Math.max(percent, 5)}%` }}>
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                            {count}
                                        </div>
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-500 mt-2 uppercase">{daysLabels[realIdx]}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Graphique par Campagne */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 md:col-span-1">
                    <h3 className="font-extrabold text-slate-800 mb-6 flex items-center gap-2 text-lg"><Package className="text-orange-500" size={20}/> Par Campagne</h3>
                    {sortedCampaigns.length === 0 ? (
                        <p className="text-slate-400 italic text-sm">Aucune donnée de livraison.</p>
                    ) : (
                        <div className="space-y-5 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                            {sortedCampaigns.map(([campagne, count]: any) => {
                                const percent = (count / maxCampaign) * 100;
                                return (
                                    <div key={campagne}>
                                        <div className="flex justify-between text-sm font-bold text-slate-700 mb-1.5">
                                            <span className="truncate pr-4">{campagne}</span>
                                            <span className="text-orange-600 font-black">{count}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                            <div className="bg-orange-500 h-full rounded-full transition-all duration-1000" style={{ width: `${percent}%` }}></div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Graphique par Agent */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 md:col-span-1">
                    <h3 className="font-extrabold text-slate-800 mb-6 flex items-center gap-2 text-lg"><Users className="text-emerald-500" size={20}/> Par Client</h3>
                    {sortedAgents.length === 0 ? (
                        <p className="text-slate-400 italic text-sm">Aucune donnée de livraison.</p>
                    ) : (
                        <div className="space-y-5 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                            {sortedAgents.map(([agent, count]: any) => {
                                const percent = (count / maxAgent) * 100;
                                return (
                                    <div key={agent}>
                                        <div className="flex justify-between text-sm font-bold text-slate-700 mb-1.5">
                                            <span className="truncate pr-4">{agent}</span>
                                            <span className="text-emerald-600 font-black">{count}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                            <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${percent}%` }}></div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* NOUVEAU BLOC : DÉTAIL PAR CAMPAGNE ET CLIENT */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 mt-8">
                <h3 className="font-extrabold text-slate-800 mb-6 flex items-center gap-2 text-lg"><Package className="text-[#01189B]" size={20}/> Détail des Livraisons : Campagnes ➔ Clients</h3>
                {Object.keys(deliveriesByCampaignAndClient).length === 0 ? (
                    <p className="text-slate-400 italic text-sm">Aucune donnée de livraison.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.entries(deliveriesByCampaignAndClient)
                            .sort((a, b) => {
                                const totalA = Object.values(a[1] as any).reduce((sum:any, val:any) => sum + val, 0) as number;
                                const totalB = Object.values(b[1] as any).reduce((sum:any, val:any) => sum + val, 0) as number;
                                return totalB - totalA;
                            })
                            .map(([campagne, clients]: any) => {
                            const totalCampagne = Number(Object.values(clients).reduce((a: any, b: any) => a + b, 0));
                            return (
                                <div key={campagne} className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                                    <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-3">
                                        <h4 className="font-bold text-slate-800 text-sm truncate pr-2">{campagne}</h4>
                                        <span className="bg-orange-100 text-orange-700 font-extrabold text-xs px-2 py-1 rounded-lg shrink-0">{totalCampagne} leads</span>
                                    </div>
                                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                        {Object.entries(clients)
                                            .sort((a: any, b: any) => b[1] - a[1])
                                            .map(([client, count]: any) => (
                                            <div key={client} className="flex justify-between items-center text-sm">
                                                <span className="text-slate-600 font-medium flex items-center gap-1.5 truncate pr-2"><Users size={12} className="text-slate-400 shrink-0"/> <span className="truncate">{client}</span></span>
                                                <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-100 text-xs shadow-sm">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* NOUVEAU BLOC : GESTION DES DONNÉES BRUTES */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 mt-8">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-lg"><Activity className="text-[#01189B]" size={20}/> Historique brut des livraisons</h3>
                    <button onClick={() => setShowModal('add_delivery')} className="px-4 py-2 bg-blue-50 text-[#01189B] font-bold rounded-xl text-sm hover:bg-blue-100 transition-colors flex items-center gap-2">
                        <Plus size={16}/> Ajouter manuellement
                    </button>
                </div>
                <div className="max-h-96 overflow-y-auto custom-scrollbar border border-slate-100 rounded-xl">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-extrabold text-[10px] tracking-wider sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 border-b border-slate-100">Date d'enregistrement</th>
                                <th className="px-4 py-3 border-b border-slate-100">Client ciblé (Agent Name)</th>
                                <th className="px-4 py-3 border-b border-slate-100">Campagne</th>
                                <th className="px-4 py-3 border-b border-slate-100 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {[...deliveries].sort((a,b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()).map(d => (
                                <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-slate-500">{formatDateTime(d.date || d.createdAt)}</td>
                                    <td className="px-4 py-3 font-bold text-slate-800">{d.agentName || 'Inconnu'}</td>
                                    <td className="px-4 py-3 text-slate-600">{d.campagne || 'Non définie'}</td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => handleDelete('lead_deliveries', d.id)} className="p-1.5 text-slate-300 hover:text-red-500 bg-white hover:bg-red-50 rounded-lg shadow-sm border border-slate-200 hover:border-red-200 transition-colors">
                                            <Trash2 size={14}/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {deliveries.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-slate-400 italic">Aucune donnée brute enregistrée.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
              </>
            )}
        </div>
      );
  };

  const handleExportContactsCSV = () => {
      let csvContent = "Société,Contact,Email,Téléphone,Adresse,Type,Statut,Source,Budget,Audience,Produits,CA Manuel,Bénéfice Manuel\n";
      
      // S'il n'y a pas de contacts, on crée une ligne d'exemple pour le template
      if (contacts.length === 0) {
          csvContent += '"Entreprise Exemple","Jean Dupont","jean@exemple.com","+41 79 000 00 00","Genève","prospect","nouveau","Call froid","5000","Les deux","LAMal","0","0"\n';
      } else {
          contacts.forEach(c => {
              const row = [ 
                  `"${c.company || ''}"`, 
                  `"${c.name || ''}"`, 
                  `"${c.email || ''}"`, 
                  `"${c.phone || ''}"`, 
                  `"${c.address ? c.address.replace(/\n/g, ' ') : ''}"`, 
                  `"${c.type || 'prospect'}"`, 
                  `"${c.status || 'nouveau'}"`, 
                  `"${c.source || ''}"`, 
                  `"${c.projectedBudget || 0}"`,
                  `"${c.targetAudience || ''}"`,
                  `"${(c.offeredProducts || []).join(' / ')}"`,
                  `"${c.manualCA || 0}"`,
                  `"${c.manualBenefice || 0}"`
              ];
              csvContent += row.join(",") + "\n";
          });
      }

      // Ajout du BOM UTF-8 pour forcer Excel à lire correctement les accents français
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); 
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `template_import_contacts_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link); 
      link.click(); 
      document.body.removeChild(link); 
      URL.revokeObjectURL(url);
      
      addNotification('success', 'Modèle CSV exporté avec succès !');
  };

  const handleImportCSV = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file || !user) return;
      
      const type = showImportModal;
      const reader = new FileReader();
      
      reader.onload = async (event: any) => {
          const text = event.target?.result?.toString();
          if (!text) return;
          
          const lines = text.split('\n').filter((l: string) => l.trim().length > 0);
          if (lines.length < 2) return addNotification('error', 'Fichier vide ou invalide (manque d\'en-tête).');

          const batch = writeBatch(db);
          let count = 0;

          // On boucle sur chaque ligne (en ignorant la première ligne qui contient les en-têtes)
          for (let i = 1; i < lines.length; i++) {
              // Séparateur intelligent (virgule ou point-virgule) qui ignore ce qui est entre guillemets
              const row = lines[i].split(/[,;](?=(?:(?:[^"]*"){2})*[^"]*$)/).map((v: string) => v.trim().replace(/^"|"$/g, ''));
              if (row.length < 2) continue;

              if (type === 'contacts') {
                  const company = row[0] || 'Inconnu';
                  const name = row[1] || '';
                  const email = row[2] || '';
                  const phone = row[3] || '';
                  const address = row[4] || '';
                  const typeContact = row[5]?.toLowerCase() || 'prospect';
                  const status = row[6]?.toLowerCase() || 'nouveau';
                  const source = row[7] || '';
                  const projectedBudget = Number(row[8]) || 0;
                  const targetAudience = row[9] || '';
                  const offeredProducts = row[10] ? row[10].split('/').map((p: string) => p.trim()) : [];
                  const manualCA = Number(row[11]) || 0;
                  const manualBenefice = Number(row[12]) || 0;

                  const docRef = doc(collection(db, `artifacts/${getAppId()}/users/${user.uid}/contacts`));
                  batch.set(docRef, { company, name, email, phone, address, type: typeContact, status, source, projectedBudget, targetAudience, offeredProducts, manualCA, manualBenefice, createdAt: new Date().toISOString() });
                  count++;
              } else if (type === 'invoices') {
                  const id = row[0] || `FAC-IMPORT-${Date.now()}-${i}`;
                  const clientName = row[1] || 'Inconnu';
                  const amount = Number(row[2]) || 0;
                  const status = row[3]?.toLowerCase() || 'brouillon';
                  const dateStr = row[4] || new Date().toISOString();
                  const date = isNaN(Date.parse(dateStr)) ? new Date().toISOString() : new Date(dateStr).toISOString();

                  const docRef = doc(db, `artifacts/${getAppId()}/users/${user.uid}/invoices`, id);
                  batch.set(docRef, { id, clientName, amount, status, date, items: [], clientId: '' });
                  count++;
              }
          }

          try {
              await batch.commit();
              addNotification('success', `${count} éléments importés avec succès !`);
              setShowImportModal(null);
          } catch (err) {
              addNotification('error', 'Erreur lors de l\'importation vers la base de données.');
          }
      };
      reader.readAsText(file);
      // Reset input value pour permettre d'importer le même fichier deux fois de suite si besoin
      e.target.value = '';
  };

  // --- RENDERERS (Vues de l'application) ---

  const renderProspection = () => {
    const prospects = contacts.filter(c => c.type === 'prospect' || (c.status !== 'gagne' && c.status !== 'perdu'));
    
    return (
      <div className="max-w-6xl mx-auto animate-fade-in space-y-8 pb-12">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl text-white shadow-[0_8px_30px_rgb(1,24,155,0.3)]" style={{ backgroundColor: BRAND_COLOR }}>
              <Send size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-slate-800 font-poppins">Prospection & Mailing</h2>
              <p className="text-slate-500 text-lg">Gérez vos envois d'emails et relances à vos prospects.</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden mt-8">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Users size={18} className="text-[#01189B]"/> Liste des prospects ({prospects.length})</h3>
            <div className="flex gap-2">
                <button onClick={() => setShowModal('bulkIds')} className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2"><Search size={14}/> Liste des IDs</button>
                <button onClick={() => { setShowModal('contact'); setNewContactSource(''); }} className="bg-white border border-slate-200 text-[#01189B] px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2"><Plus size={14}/> Ajouter</button>
            </div>
          </div>
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-slate-500 uppercase font-extrabold text-[10px] tracking-wider border-b border-slate-100">
              <tr><th className="px-6 py-5">Société</th><th className="px-6 py-5">Contact</th><th className="px-6 py-5">Email</th><th className="px-6 py-5 text-right">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {prospects.map(p => (
                <tr key={p.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-5 font-extrabold text-slate-800">{renderName(p.company)}</td>
                  <td className="px-6 py-5 text-slate-600">{renderName(p.name)}</td>
                  <td className="px-6 py-5 text-slate-500">{isSecretMode ? '****@****' : (p.email || <span className="italic text-slate-300">Non renseigné</span>)}</td>
                  <td className="px-6 py-5 text-right">
                    {p.email ? (
                        <button 
                          onClick={() => handleEmailProspect(p)}
                          className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold gap-2 transition-all bg-blue-50 text-[#01189B] hover:bg-[#01189B] hover:text-white"
                        >
                          <Send size={14}/> Écrire
                        </button>
                    ) : (
                        <button disabled className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold gap-2 transition-all bg-slate-50 text-slate-400 cursor-not-allowed pointer-events-none">
                          <Send size={14}/> Écrire
                        </button>
                    )}
                  </td>
                </tr>
              ))}
              {prospects.length === 0 && (
                <tr><td colSpan={4} className="text-center py-12 text-slate-400 font-medium">Aucun prospect disponible dans votre base CRM.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderContactDetail = () => {
    if (!selectedContact) return null;
    const contactInteractions = interactions.filter(i => i.contactId === selectedContact.id).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Calculs pour la fiche client
    const clientInvoices = invoices.filter(inv => inv.clientId === selectedContact.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    let caEncaisse = clientInvoices.filter(i => i.status === 'payee').reduce((acc, i) => acc + i.amount, 0) + Number(selectedContact.manualCA || 0);
    
    let clientMgtFees = 0;
    clientInvoices.filter(i => i.status === 'payee').forEach(inv => {
        const marginPercent = inv.marginPercent !== undefined ? inv.marginPercent : 35;
        clientMgtFees += inv.amount * (marginPercent / 100);
    });
    
    const clientSimulations = simulations.filter(s => s.clientId === selectedContact.id);
    const clientArbitrage = clientSimulations.reduce((acc, s) => acc + (s.stats?.arbitrage || 0), 0);

    const beneficeTotalClient = clientMgtFees + clientArbitrage + Number(selectedContact.manualBenefice || 0);

    // Analyse du rappel (Reminder)
    const hasReminder = !!selectedContact.nextContactDate;
    const isReminderDue = hasReminder && new Date(selectedContact.nextContactDate) <= new Date();

    return (
      <div className="flex flex-col h-fit bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden animate-fade-in border border-slate-100">
        
        {/* BANNIÈRE DE RDV */}
        {selectedContact.meetingDate && (
            <div className="px-8 py-3 flex justify-between items-center text-sm font-bold shrink-0 bg-blue-500 text-white">
                <div className="flex items-center gap-2">
                    <CalendarIcon size={18} />
                    <span>
                        Rendez-vous planifié le {formatDateTime(selectedContact.meetingDate)} : {selectedContact.meetingNote}
                    </span>
                </div>
                <button onClick={handleClearMeeting} className="px-3 py-1 rounded-lg text-xs transition-colors bg-blue-600 hover:bg-blue-700">
                    Marquer comme terminé
                </button>
            </div>
        )}

        {/* BANNIÈRE DE RAPPEL */}
        {hasReminder && (
            <div className={`px-8 py-3 flex justify-between items-center text-sm font-bold shrink-0 ${isReminderDue ? 'bg-red-500 text-white' : 'bg-orange-100 text-orange-800'}`}>
                <div className="flex items-center gap-2">
                    <Bell size={18} className={isReminderDue ? 'animate-bounce' : ''} />
                    <span>
                        {isReminderDue ? 'Rappel Échu : ' : 'Rappel Planifié : '}
                        {selectedContact.nextContactNote} (Pour le {formatDate(selectedContact.nextContactDate)})
                    </span>
                </div>
                <button onClick={handleClearReminder} className={`px-3 py-1 rounded-lg text-xs transition-colors ${isReminderDue ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-200 hover:bg-orange-300'}`}>
                    Marquer comme fait
                </button>
            </div>
        )}

        {/* Header Contact */}
        <div className="p-6 border-b border-slate-100 bg-white/50 backdrop-blur-sm flex justify-between items-start relative shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl opacity-50 pointer-events-none -mr-20 -mt-20"></div>
          <div className="flex gap-5 relative z-10">
            <button onClick={() => setSelectedContactId(null)} className="mt-1 p-2.5 bg-white border border-slate-200 shadow-sm rounded-xl hover:bg-slate-50 transition-colors text-slate-500 h-fit">
              <ChevronLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-3xl font-extrabold font-poppins text-slate-800 tracking-tight">{renderName(selectedContact.company)}</h2>
                <span className={`px-3 py-1 text-xs font-bold rounded-xl border shadow-sm ${PIPELINE_STAGES.find(s => s.id === selectedContact.status)?.color}`}>
                  {PIPELINE_STAGES.find(s => s.id === selectedContact.status)?.label}
                </span>
              </div>
              <div className="flex gap-3 mb-4">
                  <span className="text-sm font-bold text-[#01189B] bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm flex items-center gap-2"><Wallet size={16}/> CA : {renderCurrency(caEncaisse)}</span>
                  <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm flex items-center gap-2"><TrendingUp size={16}/> Bénéfice : {renderCurrency(beneficeTotalClient)}</span>
              </div>
              <p className="text-slate-500 flex items-center gap-2 font-medium text-lg"><Users size={20}/> {renderName(selectedContact.name)}</p>
              {selectedContact.address && <p className="text-slate-400 flex items-center gap-2 font-medium mt-1 text-sm"><MapPin size={16}/> {isSecretMode ? '****' : selectedContact.address}</p>}

              <div className="flex flex-wrap gap-2 mt-5">
                  <span className={`px-3 py-1.5 border rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 ${selectedContact.type === 'client' || selectedContact.status === 'gagne' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                      <Users size={14}/> {selectedContact.type === 'client' || selectedContact.status === 'gagne' ? 'Client' : 'Prospect'}
                  </span>
                  {selectedContact.source && (
                      <span className="px-3 py-1.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                          <Globe size={14}/> Source : {selectedContact.source} {selectedContact.source === 'Recommandation' && selectedContact.sourceDetails ? `(${selectedContact.sourceDetails})` : ''}
                      </span>
                  )}
                  {selectedContact.targetAudience && (
                      <span className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                          <Target size={14}/> {selectedContact.targetAudience}
                      </span>
                  )}
                  {(selectedContact.offeredProducts || []).map((p: string) => (
                      <span key={p} className="px-3 py-1.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                          <Package size={14}/> {p}
                      </span>
                  ))}
              </div>
              
              <div className="flex items-center gap-6 mt-6 text-sm font-bold text-slate-600">
                {selectedContact.email && <button onClick={() => handleEmailProspect(selectedContact)} className="flex items-center gap-2 hover:text-[#01189B] transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><Mail size={16}/> {isSecretMode ? '****@****.com' : selectedContact.email}</button>}
                {selectedContact.phone && <a href={`tel:${selectedContact.phone}`} className="flex items-center gap-2 hover:text-[#01189B] transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">📞 {isSecretMode ? '****' : selectedContact.phone}</a>}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 relative z-10 w-48 shrink-0">
            <button 
              onClick={() => {
                navigator.clipboard.writeText(selectedContact.id);
                addNotification('success', 'ID Client copié !');
              }}
              className="px-4 py-2 text-xs bg-indigo-50 border border-indigo-200 shadow-sm rounded-lg font-bold text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center justify-start gap-2"
              title="Copier l'ID unique"
            >
              <Copy size={14}/> Copier ID
            </button>
            <button onClick={() => { setEditContactData(selectedContact); setIsEditingContact(true); }} className="px-4 py-2 text-xs bg-white border border-slate-200 shadow-sm rounded-lg font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-start gap-2">
              <Edit2 size={14}/> Modifier Profil
            </button>
            <button onClick={() => handleDelete('contacts', selectedContact.id)} className="px-4 py-2 text-xs bg-white border border-slate-200 shadow-sm rounded-lg font-bold text-red-500 hover:bg-red-50 transition-colors flex items-center justify-start gap-2">
              <Trash2 size={14}/> Supprimer
            </button>
            <button onClick={() => { 
                const comp = selectedContact.company || '';
                setBulkContacts([{ company: comp, name: '', email: '', phone: '', manualCA: '', manualBenefice: '' }, { company: comp, name: '', email: '', phone: '', manualCA: '', manualBenefice: '' }, { company: comp, name: '', email: '', phone: '', manualCA: '', manualBenefice: '' }]); 
                setShowModal('bulkContact'); 
            }} className="px-4 py-2 text-xs bg-white border border-slate-200 shadow-sm rounded-lg font-bold text-[#01189B] hover:bg-blue-50 transition-colors flex items-center justify-start gap-2">
              <Users size={14}/> Ajout Rapide (Bulk)
            </button>
            {selectedContact.email && (
               <button 
                 onClick={() => handleEmailProspect(selectedContact)}
                 className="px-4 py-2 text-xs text-white rounded-lg font-bold hover:shadow-md hover:-translate-y-0.5 flex items-center justify-start gap-2 transition-all" 
                 style={{ backgroundColor: BRAND_COLOR }}
               >
                 <Send size={14}/> Écrire Email
               </button>
            )}
          </div>
        </div>

        {/* Panneau d'édition (si actif) */}
        {isEditingContact && (
          <div className="p-6 bg-slate-50 border-b border-slate-200 shadow-inner animate-fade-in z-20 relative shrink-0">
             <div className="flex justify-between items-center mb-5">
                 <h4 className="font-bold text-slate-800 font-poppins text-lg flex items-center gap-2"><Settings size={20}/> Mode Édition</h4>
                 <button onClick={() => setIsEditingContact(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div><label className={UI_CLASSES.label}>Société</label><input className={UI_CLASSES.input} value={editContactData.company || ''} onChange={e => setEditContactData({...editContactData, company: e.target.value})} /></div>
                <div><label className={UI_CLASSES.label}>Contact</label><input className={UI_CLASSES.input} value={editContactData.name || ''} onChange={e => setEditContactData({...editContactData, name: e.target.value})} /></div>
                <div><label className={UI_CLASSES.label}>Email</label><input className={UI_CLASSES.input} value={editContactData.email || ''} onChange={e => setEditContactData({...editContactData, email: e.target.value})} /></div>
                <div><label className={UI_CLASSES.label}>Téléphone</label><input className={UI_CLASSES.input} value={editContactData.phone || ''} onChange={e => setEditContactData({...editContactData, phone: e.target.value})} /></div>
                <div><label className={UI_CLASSES.label}>Google Sheet ID (Leads)</label><input className={UI_CLASSES.input} value={editContactData.googleSheetId || ''} onChange={e => setEditContactData({...editContactData, googleSheetId: e.target.value})} placeholder="ID GSheet du client" /></div>
                <div className="col-span-1 md:col-span-2 lg:col-span-3"><label className={UI_CLASSES.label}>Adresse complète (Facturation)</label><textarea className={`${UI_CLASSES.input} resize-none h-14`} value={editContactData.address || ''} onChange={e => setEditContactData({...editContactData, address: e.target.value})} /></div>

                <div className="col-span-1 md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm my-1">
                    <div><label className={UI_CLASSES.label}>CA Historique (Manuel)</label><input type="number" className={UI_CLASSES.input} value={editContactData.manualCA || ''} onChange={e => setEditContactData({...editContactData, manualCA: e.target.value})} placeholder="Ajouter au CA global..." /></div>
                    <div><label className={UI_CLASSES.label}>Bénéfice Historique (Manuel)</label><input type="number" className={UI_CLASSES.input} value={editContactData.manualBenefice || ''} onChange={e => setEditContactData({...editContactData, manualBenefice: e.target.value})} placeholder="Ajouter au bénéfice..." /></div>
                </div>

                <div><label className={UI_CLASSES.label}>Type de Contact</label>
                  <select className={UI_CLASSES.input} value={editContactData.type || 'prospect'} onChange={e => setEditContactData({...editContactData, type: e.target.value})}>
                    <option value="prospect">Prospect</option>
                    <option value="client">Client</option>
                  </select>
                </div>
             </div>
             <div className="flex gap-4 justify-end mt-5 pt-5 border-t border-slate-200">
               <button onClick={handleSaveContactEdit} className="px-6 py-2.5 text-sm text-white rounded-xl font-bold hover:opacity-90 shadow-md transition-opacity" style={{ backgroundColor: BRAND_COLOR }}>Mettre à jour la fiche</button>
             </div>
          </div>
        )}

        {/* Contenu principal divisé en deux colonnes */}
        <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50/50">
          
          {/* Colonne Gauche: Outils & Stats */}
          <div className="lg:col-span-1 space-y-5">
            
            {/* WIDGET : PROGRAMMER UN RDV */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                <h4 className="font-extrabold text-slate-800 mb-3 font-poppins text-base flex items-center gap-2"><CalendarIcon className="text-blue-500" size={18}/> Nouveau Rendez-vous</h4>
                <div className="space-y-3">
                    <input 
                        type="datetime-local" 
                        value={meetingDate}
                        onChange={e => setMeetingDate(e.target.value)}
                        className="w-full text-sm border border-slate-200 bg-slate-50 p-2.5 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-colors"
                    />
                    <input 
                        type="text" 
                        placeholder="Motif du rendez-vous..." 
                        value={meetingNote}
                        onChange={e => setMeetingNote(e.target.value)}
                        className="w-full text-sm border border-slate-200 bg-slate-50 p-2.5 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-colors"
                    />
                    <button onClick={handleSetMeeting} className="w-full py-2 text-xs font-bold uppercase tracking-wide bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-100 transition-colors">
                        Enregistrer le RDV
                    </button>
                </div>
            </div>

            {/* WIDGET : PROGRAMMER UN RAPPEL */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
                <h4 className="font-extrabold text-slate-800 mb-3 font-poppins text-base flex items-center gap-2"><CalendarClock className="text-orange-500" size={18}/> Programmer un Rappel</h4>
                <div className="space-y-3">
                    <input 
                        type="text" 
                        placeholder="Ex: Rappeler pour faire le point..." 
                        value={reminderNote}
                        onChange={e => setReminderNote(e.target.value)}
                        className="w-full text-sm border border-slate-200 bg-slate-50 p-2.5 rounded-xl outline-none focus:border-orange-400 focus:bg-white transition-colors"
                    />
                    <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => handleSetReminder(7)} className="py-2 text-[10px] font-bold uppercase tracking-wide bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 border border-orange-100 transition-colors">+ 1 Sem.</button>
                        <button onClick={() => handleSetReminder(30)} className="py-2 text-[10px] font-bold uppercase tracking-wide bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 border border-orange-100 transition-colors">+ 1 Mois</button>
                        <button onClick={() => handleSetReminder(90)} className="py-2 text-[10px] font-bold uppercase tracking-wide bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 border border-orange-100 transition-colors">+ 3 Mois</button>
                    </div>
                </div>
            </div>

            {/* WIDGET : CAMPAGNES EN COURS */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
               <h4 className="font-extrabold text-slate-800 mb-3 font-poppins text-base flex items-center gap-2"><PlayCircle size={18} className="text-indigo-500"/> Campagnes en cours</h4>
               {clientSimulations.length === 0 ? (
                   <p className="text-xs text-slate-400 italic text-center py-4">Aucune campagne active.</p>
               ) : (
                   <div className="space-y-4">
                       {clientSimulations.map(sim => {
                           const duration = sim.duration || 30;
                           const start = new Date(sim.createdAt);
                           const diffDays = Math.max(0, Math.floor((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                           const day = Math.min(diffDays, duration);
                           const isFinished = day >= duration;
                           const endDate = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);
                           return (
                               <div key={sim.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 relative overflow-hidden">
                                   <div className="flex justify-between items-start mb-2 relative z-10">
                                       <span className="font-bold text-sm text-slate-700 flex items-center gap-1"><Package size={14}/> {sim.productName}</span>
                                       <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-widest ${isFinished ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{isFinished ? 'Terminé' : 'En cours'}</span>
                                   </div>
                                   <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2 overflow-hidden relative z-10">
                                       <div className={`h-full rounded-full transition-all ${isFinished ? 'bg-emerald-500' : 'bg-[#01189B]'}`} style={{ width: `${(day/duration)*100}%` }}></div>
                                   </div>
                                   <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider relative z-10">
                                       <span>J-{day} / {duration}</span>
                                       <span>Fin : {formatDate(endDate.toISOString())}</span>
                                   </div>
                               </div>
                           )
                       })}
                   </div>
               )}
            </div>

            {/* WIDGET : HISTORIQUE FACTURES */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
               <h4 className="font-extrabold text-slate-800 mb-3 font-poppins text-base flex items-center gap-2"><FileText size={18} className="text-slate-400"/> Factures Associées</h4>
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
          <div className="lg:col-span-2 flex flex-col h-fit bg-white rounded-2xl border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
             <div className="p-5 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
                 <h4 className="font-extrabold text-slate-800 flex items-center gap-2 font-poppins text-base">
                    <MessageSquare size={18} style={{ color: BRAND_COLOR }} /> Historique & Compte-Rendus
                 </h4>
                 <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{contactInteractions.length} note(s)</span>
             </div>
             
             <div className="p-5 space-y-5 bg-slate-50/50">
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

             <div className="p-5 bg-white border-t border-slate-100 shadow-[0_-10px_30px_rgb(0,0,0,0.02)] relative z-10 shrink-0">
                <div className="relative">
                  <textarea 
                    value={newNoteContent} 
                    onChange={e => setNewNoteContent(e.target.value)} 
                    placeholder="Saisissez le compte-rendu du rendez-vous, une info importante..."
                    className="w-full border-2 border-slate-200 bg-slate-50 rounded-xl p-3 pr-14 h-20 outline-none focus:border-[#01189B] focus:bg-white resize-none text-sm transition-colors shadow-inner custom-scrollbar"
                  />
                  <button onClick={handleAddQuickNote} className="absolute bottom-3 right-3 p-2.5 text-white rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50" style={{ backgroundColor: BRAND_COLOR }} disabled={!newNoteContent.trim()}>
                    <Send size={16}/>
                  </button>
                </div>
             </div>
          </div>

        </div>
      </div>
    );
  };

  const renderCompanyDetail = () => {
    if (!selectedCompanyName) return null;
    const companyContacts = contacts.filter(c => c.company === selectedCompanyName);
    const companyInfo = companiesData.find(c => c.name === selectedCompanyName) || {};

    // Agrégations au niveau de l'entreprise
    const companyInvoices = invoices.filter(inv => inv.clientName === selectedCompanyName || companyContacts.some((c:any) => c.id === inv.clientId));
    const caEncaisse = companyInvoices.filter(i => i.status === 'payee').reduce((a, b) => a + b.amount, 0) + companyContacts.reduce((a:any, b:any) => a + Number(b.manualCA || 0), 0) + Number(companyInfo.manualCA || 0);
    
    let companyMgtFees = 0;
    companyInvoices.filter(i => i.status === 'payee').forEach(inv => {
        const marginPercent = inv.marginPercent !== undefined ? inv.marginPercent : 35;
        companyMgtFees += inv.amount * (marginPercent / 100);
    });
    
    const companySimulations = simulations.filter(s => companyContacts.some(c => c.id === s.clientId) || s.clientName === selectedCompanyName);
    const companyArbitrage = companySimulations.reduce((acc, s) => acc + (s.stats?.arbitrage || 0), 0);
    const beneficeTotal = companyMgtFees + companyArbitrage + companyContacts.reduce((a:any, b:any) => a + Number(b.manualBenefice || 0), 0) + Number(companyInfo.manualBenefice || 0);

    const companyType = companyInfo.type || (companyContacts.some(c => c.type === 'client' || c.status === 'gagne') ? 'client' : 'prospect');
    const isClient = companyType === 'client';

    // Nouvelles extractions pour le profil de la société
    const mainContact = companyContacts.find(c => c.type === 'client') || companyContacts.find(c => c.address) || companyContacts[0] || {} as any;
    const allProducts = Array.from(new Set([...(companyInfo.offeredProducts || []), ...companyContacts.flatMap(c => c.offeredProducts || [])]));
    const allAudiences = Array.from(new Set([companyInfo.targetAudience, ...companyContacts.map(c => c.targetAudience)].filter(Boolean)));
    
    const companyInteractions = interactions.filter(i => companyContacts.some(c => c.id === i.contactId)).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

    return (
      <div className="flex flex-col h-fit bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden animate-fade-in border border-slate-100">
        
        {/* BANNIÈRE DE RAPPEL SOCIÉTÉ */}
        {companyInfo.nextContactDate && (
            <div className={`px-8 py-3 flex justify-between items-center text-sm font-bold shrink-0 ${new Date(companyInfo.nextContactDate) <= new Date() ? 'bg-red-500 text-white' : 'bg-orange-100 text-orange-800'}`}>
                <div className="flex items-center gap-2">
                    <Bell size={18} className={new Date(companyInfo.nextContactDate) <= new Date() ? 'animate-bounce' : ''} />
                    <span>
                        {new Date(companyInfo.nextContactDate) <= new Date() ? 'Rappel Échu : ' : 'Rappel Planifié : '}
                        {companyInfo.nextContactNote} (Pour le {formatDate(companyInfo.nextContactDate)})
                    </span>
                </div>
                <button onClick={handleClearCompanyReminder} className={`px-3 py-1 rounded-lg text-xs transition-colors ${new Date(companyInfo.nextContactDate) <= new Date() ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-200 hover:bg-orange-300'}`}>
                    Marquer comme fait
                </button>
            </div>
        )}

        {/* Header Société */}
        <div className="p-6 border-b border-slate-100 bg-white/50 backdrop-blur-sm flex justify-between items-start relative shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl opacity-50 pointer-events-none -mr-20 -mt-20"></div>
          <div className="flex gap-5 relative z-10 flex-1">
            <button onClick={() => setSelectedCompanyName(null)} className="mt-1 p-2.5 bg-white border border-slate-200 shadow-sm rounded-xl hover:bg-slate-50 transition-colors text-slate-500 h-fit shrink-0">
              <ChevronLeft size={20} />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-3xl font-extrabold font-poppins text-slate-800 tracking-tight">{renderName(selectedCompanyName)}</h2>
                <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-xl border shadow-sm ${isClient ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                    {isClient ? 'Client Actif' : 'Prospect'}
                </span>
              </div>
              <div className="flex gap-3 mb-4">
                  <span className="text-sm font-bold text-[#01189B] bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm flex items-center gap-2"><Wallet size={16}/> CA Global : {renderCurrency(caEncaisse)}</span>
                  <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm flex items-center gap-2"><TrendingUp size={16}/> Bénéfice Global : {renderCurrency(beneficeTotal)}</span>
              </div>
              
              <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-200/50">
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600 font-medium">
                      {(companyInfo.legalStatus || companyInfo.cheNumber) && (
                          <p className="flex items-center gap-1.5"><Briefcase size={14} className="text-slate-400"/> {companyInfo.legalStatus} {companyInfo.cheNumber ? `(IDE: ${companyInfo.cheNumber})` : ''}</p>
                      )}
                      {(mainContact.name || mainContact.email || mainContact.phone) && (
                          <p className="flex items-center gap-1.5"><Users size={14} className="text-slate-400"/> {renderName(mainContact.name || 'Contact Principal')} {mainContact.email ? `• ${isSecretMode ? '****@****' : mainContact.email}` : ''} {mainContact.phone ? `• ${isSecretMode ? '****' : mainContact.phone}` : ''}</p>
                      )}
                      {(companyInfo.addressLine || mainContact.address) && (
                          <p className="flex items-center gap-1.5"><MapPin size={14} className="text-slate-400"/> {isSecretMode ? '****' : (companyInfo.addressLine ? `${companyInfo.addressLine}, ${companyInfo.zipCode || ''} ${companyInfo.city || ''} ${companyInfo.country || ''}` : mainContact.address)}</p>
                      )}
                  </div>
                  {companyInfo.notes && (
                      <p className="flex items-start gap-1.5 text-slate-500 italic text-sm mt-1 bg-white/60 p-2 rounded-lg border border-slate-100"><MessageSquare size={14} className="text-slate-400 mt-0.5 shrink-0"/> {companyInfo.notes}</p>
                  )}
                  {(allAudiences.length > 0 || allProducts.length > 0) && (
                      <div className="flex flex-wrap gap-2 mt-1">
                          {allAudiences.map((aud: any) => <span key={aud} className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-bold uppercase tracking-wide">{aud}</span>)}
                          {allProducts.map((prod: any) => <span key={prod} className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold uppercase tracking-wide">{prod}</span>)}
                      </div>
                  )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 relative z-10 w-48 shrink-0">
             <button onClick={() => { setEditCompanyDataState(companyInfo); setIsEditingCompany(true); }} className="px-4 py-2 text-xs bg-white border border-slate-200 shadow-sm rounded-lg font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-start gap-2">
               <Edit2 size={14}/> Modifier Société
             </button>
             <button onClick={() => { setShowModal('contact'); setNewContactSource(''); }} className="px-4 py-2 text-xs text-white rounded-lg font-bold hover:shadow-md hover:-translate-y-0.5 flex items-center justify-start gap-2 transition-all" style={{ backgroundColor: BRAND_COLOR }}>
               <Plus size={14}/> Ajouter un contact
             </button>
             <button onClick={() => { 
                const comp = selectedCompanyName || '';
                setBulkContacts([{ company: comp, name: '', email: '', phone: '', manualCA: '', manualBenefice: '' }, { company: comp, name: '', email: '', phone: '', manualCA: '', manualBenefice: '' }, { company: comp, name: '', email: '', phone: '', manualCA: '', manualBenefice: '' }]); 
                setShowModal('bulkContact'); 
             }} className="px-4 py-2 text-xs bg-white border border-slate-200 shadow-sm rounded-lg font-bold text-[#01189B] hover:bg-blue-50 transition-colors flex items-center justify-start gap-2">
               <Users size={14}/> Ajout Contacts (Bulk)
             </button>
             <button onClick={handleDeleteCompany} className="px-4 py-2 text-xs bg-white border border-slate-200 shadow-sm rounded-lg font-bold text-red-500 hover:bg-red-50 transition-colors flex items-center justify-start gap-2 mt-2">
               <Trash2 size={14}/> Supprimer Société
             </button>
          </div>
        </div>

        {/* Panneau d'édition Société (si actif) */}
        {isEditingCompany && (
          <div className="p-6 bg-slate-50 border-b border-slate-200 shadow-inner animate-fade-in z-20 relative shrink-0">
             <div className="flex justify-between items-center mb-5">
                 <h4 className="font-bold text-slate-800 font-poppins text-lg flex items-center gap-2"><Settings size={20}/> Modifier la Société</h4>
                 <button onClick={() => setIsEditingCompany(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className={UI_CLASSES.label}>Statut de la Société</label>
                  <select className={`${UI_CLASSES.input} font-bold ${editCompanyDataState.type === 'client' ? 'text-emerald-600' : 'text-[#01189B]'}`} value={editCompanyDataState.type || companyType} onChange={e => setEditCompanyDataState({...editCompanyDataState, type: e.target.value})}>
                    <option value="prospect">Prospect</option>
                    <option value="client">Client Actif</option>
                  </select>
                </div>
                <div>
                  <label className={UI_CLASSES.label}>Forme Juridique</label>
                  <select className={UI_CLASSES.input} value={editCompanyDataState.legalStatus || ''} onChange={e => setEditCompanyDataState({...editCompanyDataState, legalStatus: e.target.value})}>
                    <option value="">-- Non définie --</option>
                    <option value="SA">SA</option>
                    <option value="SARL">SARL / Sàrl</option>
                    <option value="Raison Individuelle">Raison Individuelle</option>
                    <option value="SNC">SNC</option>
                    <option value="Association">Association</option>
                  </select>
                </div>
                <div><label className={UI_CLASSES.label}>Numéro IDE / CHE</label><input className={UI_CLASSES.input} value={editCompanyDataState.cheNumber || ''} onChange={e => setEditCompanyDataState({...editCompanyDataState, cheNumber: e.target.value})} placeholder="Ex: CHE-123.456.789" /></div>
                <div><label className={UI_CLASSES.label}>Numéro TVA</label><input className={UI_CLASSES.input} value={editCompanyDataState.tvaNumber || ''} onChange={e => setEditCompanyDataState({...editCompanyDataState, tvaNumber: e.target.value})} placeholder="Si applicable..." /></div>
                
                <div className="col-span-1 md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm my-1">
                    <div><label className={UI_CLASSES.label}>CA Historique (Manuel)</label><input type="number" className={UI_CLASSES.input} value={editCompanyDataState.manualCA || ''} onChange={e => setEditCompanyDataState({...editCompanyDataState, manualCA: e.target.value})} placeholder="Ajouter au CA global..." /></div>
                    <div><label className={UI_CLASSES.label}>Bénéfice Historique (Manuel)</label><input type="number" className={UI_CLASSES.input} value={editCompanyDataState.manualBenefice || ''} onChange={e => setEditCompanyDataState({...editCompanyDataState, manualBenefice: e.target.value})} placeholder="Ajouter au bénéfice..." /></div>
                </div>

                <div className="col-span-1 md:col-span-2 lg:col-span-3 pt-4 border-t border-slate-200">
                    <h5 className="font-bold text-slate-700 text-sm mb-4">Adresse Officielle</h5>
                </div>
                <div className="col-span-1 md:col-span-2 lg:col-span-3">
                    <label className={UI_CLASSES.label}>Adresse Ligne 1</label>
                    <input className={UI_CLASSES.input} value={editCompanyDataState.addressLine || ''} onChange={e => setEditCompanyDataState({...editCompanyDataState, addressLine: e.target.value})} placeholder="Rue, Numéro..." />
                </div>
                <div><label className={UI_CLASSES.label}>NPA / Code Postal</label><input className={UI_CLASSES.input} value={editCompanyDataState.zipCode || ''} onChange={e => setEditCompanyDataState({...editCompanyDataState, zipCode: e.target.value})} /></div>
                <div><label className={UI_CLASSES.label}>Ville</label><input className={UI_CLASSES.input} value={editCompanyDataState.city || ''} onChange={e => setEditCompanyDataState({...editCompanyDataState, city: e.target.value})} /></div>
                <div><label className={UI_CLASSES.label}>Pays</label><input className={UI_CLASSES.input} value={editCompanyDataState.country || ''} onChange={e => setEditCompanyDataState({...editCompanyDataState, country: e.target.value})} /></div>
             </div>
             <div className="flex gap-4 justify-end mt-5 pt-5 border-t border-slate-200">
               <button onClick={handleSaveCompanyEdit} className="px-6 py-2.5 text-sm text-white rounded-xl font-bold hover:opacity-90 shadow-md transition-opacity" style={{ backgroundColor: BRAND_COLOR }}>Enregistrer les infos</button>
             </div>
          </div>
        )}

        <div className="flex-1 p-6 bg-slate-50/50 grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLONNE GAUCHE : INFOS & CAMPAGNES */}
            <div className="lg:col-span-1 space-y-5">
               
               {/* Widget Rappels Société */}
               <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
                   <h4 className="font-extrabold text-slate-800 mb-3 font-poppins text-base flex items-center gap-2"><CalendarClock className="text-orange-500" size={18}/> Programmer un Rappel</h4>
                   <div className="space-y-3">
                       <input 
                           type="text" 
                           placeholder="Ex: Rappeler la société..." 
                           value={companyReminderNote}
                           onChange={e => setCompanyReminderNote(e.target.value)}
                           className="w-full text-sm border border-slate-200 bg-slate-50 p-2.5 rounded-xl outline-none focus:border-orange-400 focus:bg-white transition-colors"
                       />
                       <div className="grid grid-cols-3 gap-2">
                           <button onClick={() => handleSetCompanyReminder(7)} className="py-2 text-[10px] font-bold uppercase tracking-wide bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 border border-orange-100 transition-colors">+ 1 Sem.</button>
                           <button onClick={() => handleSetCompanyReminder(30)} className="py-2 text-[10px] font-bold uppercase tracking-wide bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 border border-orange-100 transition-colors">+ 1 Mois</button>
                           <button onClick={() => handleSetCompanyReminder(90)} className="py-2 text-[10px] font-bold uppercase tracking-wide bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 border border-orange-100 transition-colors">+ 3 Mois</button>
                       </div>
                   </div>
               </div>

               {/* Widget Campagnes en cours */}
               <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                 <h4 className="font-extrabold text-slate-800 mb-3 font-poppins text-base flex items-center gap-2"><PlayCircle size={18} className="text-indigo-500"/> Campagnes Actives</h4>
                 {companySimulations.length === 0 ? (
                     <p className="text-xs text-slate-400 italic text-center py-4">Aucune campagne active pour cette société.</p>
                 ) : (
                     <div className="space-y-4">
                         {companySimulations.map(sim => {
                             const duration = sim.duration || 30;
                             const start = new Date(sim.createdAt);
                             const diffDays = Math.max(0, Math.floor((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                             const day = Math.min(diffDays, duration);
                             const isFinished = day >= duration;
                             const endDate = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);
                             
                             const targetLeads = sim.stats?.volumeTotal || 0;
                             let expectedLeads = 0;
                             if (sim.dataSource === 'deliveries') {
                                 const matchName = sim.deliveryMatchName !== undefined ? sim.deliveryMatchName : sim.clientName;
                                 expectedLeads = deliveries.filter((d:any) => d.agentName === matchName).length + Number(sim.manualLeadsOffset || 0);
                             } else if (sim.dataSource === 'manual') {
                                 expectedLeads = Number(sim.manualLeads || 0);
                             } else {
                                 expectedLeads = Math.min(Math.floor((targetLeads / duration) * day), targetLeads);
                             }
                             const leadsPercent = targetLeads > 0 ? (expectedLeads / targetLeads) * 100 : 0;

                             return (
                                 <div key={sim.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 relative overflow-hidden">
                                     <div className="flex justify-between items-start mb-4 relative z-10">
                                         <div>
                                            <span className="font-bold text-sm text-slate-700 flex items-center gap-1.5"><Package size={14}/> {sim.productName}</span>
                                         </div>
                                         <span className={`text-[9px] px-2 py-1 rounded font-bold uppercase tracking-widest shrink-0 ${isFinished ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{isFinished ? 'Terminé' : 'En cours'}</span>
                                     </div>
                                     
                                     <div className="space-y-3 relative z-10">
                                        <div>
                                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                                                <span className="flex items-center gap-1"><Clock size={10}/> {day} / {duration} J</span>
                                                <span>Fin : {formatDate(endDate.toISOString())}</span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                                <div className={`h-full rounded-full transition-all ${isFinished ? 'bg-emerald-500' : 'bg-[#01189B]'}`} style={{ width: `${(day/duration)*100}%` }}></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                                                <span className="flex items-center gap-1"><Target size={10}/> Leads (Estim.)</span>
                                                <span className="text-emerald-600">{renderNumber(expectedLeads)} / {renderNumber(targetLeads)}</span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                                <div className="h-full rounded-full transition-all bg-emerald-500" style={{ width: `${leadsPercent}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                 </div>
                             )
                         })}
                     </div>
                 )}
               </div>

               {/* Widget Factures */}
               <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                 <h4 className="font-extrabold text-slate-800 mb-3 font-poppins text-base flex items-center gap-2"><FileText size={18} className="text-slate-400"/> Factures Globales</h4>
                 {companyInvoices.length === 0 ? (
                     <p className="text-xs text-slate-400 italic text-center py-4">Aucune facture pour cette société.</p>
                 ) : (
                     <div className="space-y-3 pr-1">
                         {companyInvoices.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((inv: any) => (
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

            {/* COLONNE DROITE : EQUIPE & ACTIVITE */}
            <div className="lg:col-span-2 space-y-5 flex flex-col h-fit">
              {/* Widget Activité Globale */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-5 shrink-0">
                  <h3 className="font-extrabold text-slate-800 mb-3 font-poppins text-base flex items-center gap-2"><Activity className="text-orange-500" size={18}/> Activité Globale (Notes récentes)</h3>
                  {companyInteractions.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-4">Aucune activité enregistrée sur les contacts de cette société.</p>
                  ) : (
                      <div className="space-y-3">
                          {companyInteractions.map(act => {
                              const relatedContact = companyContacts.find(c => c.id === act.contactId);
                              return (
                                  <div key={act.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                                      <p className="text-[10px] font-bold text-slate-500 mb-1 flex justify-between uppercase tracking-widest">
                                          <span className="flex items-center gap-1.5"><Users size={12}/> {relatedContact ? relatedContact.name : 'Inconnu'}</span> 
                                          <span className="text-slate-400 font-medium"><Clock size={10} className="inline mr-1 -mt-0.5"/> {formatDateTime(act.createdAt)}</span>
                                      </p>
                                      <p className="text-sm text-slate-700 line-clamp-2">{act.content}</p>
                                  </div>
                              )
                          })}
                      </div>
                  )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-5 shrink-0">
                  <h3 className="font-extrabold text-slate-800 font-poppins text-lg flex items-center gap-2"><Users size={20} style={{ color: BRAND_COLOR }}/> Contacts ({companyContacts.length})</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1">
                     {companyContacts.map(c => {
                        const cInvoices = invoices.filter(inv => inv.clientId === c.id);
                        const cCaEncaisse = cInvoices.filter(i => i.status === 'payee').reduce((a, b) => a + b.amount, 0) + Number(c.manualCA || 0);
                        return (
                          <div key={c.id} onClick={() => setSelectedContactId(c.id)} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-[#01189B] hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between">
                             <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                   <div className="w-10 h-10 rounded-full bg-blue-100 text-[#01189B] flex items-center justify-center font-bold text-lg shrink-0">{isSecretMode ? '**' : (c.name ? c.name.substring(0,2).toUpperCase() : '?')}</div>
                                   <div className="overflow-hidden">
                                     <p className="font-bold text-slate-800 text-sm truncate">{renderName(c.name || 'Sans Nom')}</p>
                                     <p className="text-[10px] text-slate-500 font-medium truncate">{isSecretMode ? '****@****' : (c.email || 'Pas d\'email')}</p>
                                   </div>
                                </div>
                                <span className={`px-2 py-1 text-[9px] font-bold uppercase tracking-widest rounded-md border shrink-0 ${c.type === 'client' || c.status === 'gagne' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                   {c.status}
                                </span>
                             </div>
                             <div className="grid grid-cols-2 gap-2 mt-auto pt-4 border-t border-slate-100">
                                <div>
                                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">CA Indiv.</p>
                                   <p className="text-sm font-extrabold text-[#01189B] font-mono">{renderCurrency(cCaEncaisse)}</p>
                                </div>
                                <div className="text-right">
                                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Notes</p>
                                   <p className="text-sm font-bold text-slate-600 flex items-center justify-end gap-1"><MessageSquare size={14}/> {interactions.filter(i => i.contactId === c.id).length}</p>
                                </div>
                             </div>
                          </div>
                        );
                     })}
                  </div>
                  {companyContacts.length === 0 && (
                      <div className="text-center py-12 text-slate-400 font-medium bg-slate-50 rounded-2xl border border-slate-200 border-dashed mt-4 flex-1 flex flex-col items-center justify-center">
                          Aucun contact pour cette société. <br/>Cliquez sur "Ajouter un contact" en haut à droite.
                      </div>
                  )}
              </div>
            </div>

        </div>
      </div>
    );
  };

  const renderProjections = () => {
    const activeProduct = products.find((p) => p.id === planProductId) || products[0];
    let planStats = { volumeTotal: 0, costTotal: 0, profit: 0, dailyVolume: 0, dailyBudget: 0, margin: 0, fees: 0, arbitrage: 0 };
    if (activeProduct && planBudget > 0 && activeProduct.price > 0) {
      const fees = planBudget * 0.35; const netMedia = planBudget * 0.65; const volumeTotal = Math.floor(netMedia / activeProduct.price); const costTotal = volumeTotal * Number(activeProduct.cost ?? 0);
      const arbitrage = netMedia - costTotal; const profit = fees + arbitrage; planStats = { volumeTotal, costTotal, profit, dailyVolume: volumeTotal / planDuration, dailyBudget: costTotal / planDuration, margin: (profit / planBudget) * 100, fees, arbitrage };
    }

    const totalSimulations = simulations.length;
    const globalStats = simulations.reduce((acc, sim) => ({ totalBudget: acc.totalBudget + sim.budget, totalMediaSpend: acc.totalMediaSpend + sim.stats.costTotal, totalProfit: acc.totalProfit + sim.stats.profit, totalLeads: acc.totalLeads + sim.stats.volumeTotal }), { totalBudget: 0, totalMediaSpend: 0, totalProfit: 0, totalLeads: 0 });
    const globalMarginPercent = globalStats.totalBudget > 0 ? (globalStats.totalProfit / globalStats.totalBudget) * 100 : 0;

    // --- CALCUL DES BUDGETS JOURNALIERS ACTIFS PAR PLATEFORME ---
    const activeDailyByPlatform: any = {};
    let totalDailyMediaSpend = 0;

    simulations.forEach(sim => {
        const duration = sim.duration || 30;
        const start = new Date(sim.createdAt);
        const diffDays = Math.max(0, Math.floor((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        const isFinished = diffDays >= duration;

        if (!isFinished && sim.stats?.costTotal) {
            const daily = sim.stats.costTotal / duration;
            totalDailyMediaSpend += daily;

            let platform = sim.productPlatform || 'autre';
            if (platform === 'autre' || !sim.productPlatform) {
                 const p = products.find(prod => prod.name === sim.productName);
                 if (p && p.platform) platform = p.platform;
            }
            const platformKey = platform.toLowerCase();

            if (!activeDailyByPlatform[platformKey]) activeDailyByPlatform[platformKey] = 0;
            activeDailyByPlatform[platformKey] += daily;
        }
    });

    return (
      <div className="space-y-8 animate-fade-in pb-12">
        <div className="space-y-6 max-w-7xl mx-auto">
          <h2 className="text-3xl font-extrabold flex items-center gap-3 text-slate-800 font-poppins"><Target style={{ color: BRAND_COLOR }} size={32} /> Pilotage Mensuel Média</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className={UI_CLASSES.card}><p className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wide flex justify-between">CA Signé <Wallet style={{ color: BRAND_COLOR }} size={18} /></p><p className="text-3xl font-extrabold text-slate-800 font-poppins">{renderCurrency(globalStats.totalBudget)}</p><p className="text-xs font-bold text-[#01189B] mt-2 bg-blue-50 inline-block px-2 py-1 rounded-md">{renderNumber(totalSimulations)} contrats validés</p></div>
            <div className={UI_CLASSES.card}><p className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wide flex justify-between">Budget Média <PieChart className="text-orange-400" size={18} /></p><p className="text-3xl font-extrabold text-orange-500 font-poppins">{renderCurrency(globalStats.totalMediaSpend)}</p><p className="text-xs font-medium text-slate-500 mt-2">Dépense publicitaire max</p></div>
            <div className={UI_CLASSES.card}><p className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wide flex justify-between">Marge Nette <TrendingUp className="text-emerald-500" size={18} /></p><p className="text-3xl font-extrabold text-emerald-500 font-poppins">{renderCurrency(globalStats.totalProfit)}</p><p className="text-xs text-emerald-700 font-extrabold mt-2 bg-emerald-50 inline-block px-2 py-1 rounded-md">{renderNumber(globalMarginPercent.toFixed(1))}% rentabilité</p></div>
            <div className="p-6 rounded-2xl shadow-lg hover:-translate-y-1 transition-transform cursor-default relative overflow-hidden" style={{ backgroundColor: BRAND_COLOR }}>
              <div className="absolute top-0 right-0 p-16 bg-white rounded-full blur-3xl opacity-10 -mr-8 -mt-8"></div>
              <p className="text-xs font-bold text-blue-200 uppercase mb-2 tracking-wide flex justify-between relative z-10">Volume Leads <Users size={18} /></p>
              <p className="text-4xl font-extrabold font-poppins text-white relative z-10">{renderNumber(globalStats.totalLeads)}</p>
              <p className="text-xs text-blue-200 mt-2 font-medium relative z-10">À produire ce mois-ci</p>
            </div>
          </div>

          {/* NOUVEAU WIDGET : BUDGETS JOURNALIERS INTELLIGENTS */}
          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-lg mt-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 opacity-10 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <h3 className="text-lg font-extrabold flex items-center gap-2 font-poppins mb-6 relative z-10"><Zap className="text-yellow-400" size={20}/> Répartition Quotidienne des Campagnes (Ads)</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
                  <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-700/50">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Dépense Quotidienne Totale</p>
                      <p className="text-3xl font-black font-mono text-white">{renderCurrency(totalDailyMediaSpend)}<span className="text-sm text-slate-500 font-sans font-medium">/j</span></p>
                  </div>

                  {Object.entries(activeDailyByPlatform).map(([plat, amount]: any) => {
                      let label = plat; let icon = <Share2 size={16}/>; let colorClass = 'text-blue-400';
                      if (plat.includes('meta')) { label = 'Meta Ads'; icon = <Share2 size={16}/>; colorClass = 'text-blue-400'; }
                      if (plat.includes('google')) { label = 'Google Ads'; icon = <Globe size={16}/>; colorClass = 'text-orange-400'; }
                      if (plat.includes('tiktok')) { label = 'TikTok Ads'; icon = <PlayCircle size={16}/>; colorClass = 'text-pink-400'; }

                      return (
                          <div key={plat} className="bg-slate-900/50 p-5 rounded-2xl border border-slate-700/50">
                              <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5 ${colorClass}`}>{icon} {label}</p>
                              <p className="text-2xl font-black font-mono text-white">{renderCurrency(amount)}<span className="text-xs text-slate-500 font-sans font-medium">/j</span></p>
                          </div>
                      )
                  })}

                  {Object.keys(activeDailyByPlatform).length === 0 && (
                      <div className="md:col-span-3 flex items-center text-sm text-slate-400 italic">
                          Aucune campagne active. Lancez une production ci-dessous pour voir la répartition.
                      </div>
                  )}
              </div>
          </div>
          
          <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden mt-8">
            <div className="bg-slate-50 p-6 border-b border-slate-100">
              <h2 className="text-lg font-extrabold flex items-center gap-2 font-poppins text-slate-800"><Calculator style={{ color: BRAND_COLOR }} size={20} /> Convertir Contrat en Production Média</h2>
              <p className="text-slate-500 text-sm mt-1">Ajoutez un contrat signé pour l'activer dans les cycles (Cela générera les graphiques dans le calendrier).</p>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-6 gap-6 items-end">
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wide">1. Choix Client</label><select value={planClientId} onChange={(e) => setPlanClientId(e.target.value)} className={UI_CLASSES.input}><option value="">-- Aucun --</option>{contacts.map((c) => (<option key={c.id} value={c.id}>{c.company}</option>))}</select></div>
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wide">2. Thématique</label><select value={planProductId} onChange={(e) => setPlanProductId(e.target.value)} className={UI_CLASSES.input}><option value="">-- Choisir --</option>{products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}</select></div>
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wide">3. Budget Signé</label><input type="number" value={planBudget} onChange={(e) => setPlanBudget(Number(e.target.value))} className={`${UI_CLASSES.input} text-[#01189B] text-lg font-extrabold`} /></div>
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wide">4. Jours</label><input type="number" value={planDuration} onChange={(e) => setPlanDuration(Number(e.target.value))} className={`${UI_CLASSES.input} text-slate-700 text-lg font-extrabold`} /></div>
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wide">5. Suivi Leads</label><select value={planDataSource} onChange={(e) => setPlanDataSource(e.target.value)} className={UI_CLASSES.input}><option value="deliveries">Livraisons</option><option value="auto">Auto (Temps)</option><option value="manual">Manuel</option></select></div>
              <button onClick={() => handleSaveSimulation(planStats)} className="w-full text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:-translate-y-0.5 transition-all text-lg" style={{ backgroundColor: BRAND_COLOR }}><Plus size={20} /> Lancer</button>
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-slate-800 mb-6 mt-12 flex items-center gap-3 font-poppins"><Save size={24} style={{ color: BRAND_COLOR }} /> Carnet de Production Actuel</h2>
          {simulations.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-slate-400 font-medium">Aucun contrat en production. Remplissez le convertisseur ci-dessus.</div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-extrabold text-[10px] tracking-wider border-b border-slate-100">
                    <tr><th className="px-6 py-5">Client / Thématique</th><th className="px-6 py-5">Progression Temps</th><th className="px-6 py-5">Finances & Budget/Jour</th><th className="px-6 py-5">Objectif Leads</th><th className="px-6 py-5">Bénéfice Prévu</th><th className="px-6 py-5 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {simulations.map((sim) => {
                      const duration = sim.duration || 30;
                      const start = new Date(sim.createdAt);
                      const diffDays = Math.max(0, Math.floor((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                      const day = Math.min(diffDays, duration);
                      const daysPercent = (day / duration) * 100;
                      const isFinished = day >= duration;
                      
                      let platform = sim.productPlatform || 'autre';
                      if (platform === 'autre' || !sim.productPlatform) {
                           const p = products.find(prod => prod.name === sim.productName);
                           if (p && p.platform) platform = p.platform;
                      }

                      return (
                      <tr key={sim.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-5">
                          <p className="font-extrabold text-slate-800 font-poppins">{renderName(sim.clientName || 'N/A')}</p>
                          <div className="flex items-center gap-2 mt-1">
                              <p className="font-bold text-xs text-[#01189B] flex items-center gap-1"><Package size={12}/> {sim.productName}</p>
                              <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${platform.toLowerCase().includes('google') ? 'bg-orange-100 text-orange-700' : platform.toLowerCase().includes('meta') ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}`}>{platform}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 w-48">
                          <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                            <span>J-{day}</span><span>{duration} J</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${isFinished ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${daysPercent}%` }}></div>
                          </div>
                          {isFinished && <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-block">Terminé</span>}
                        </td>
                        <td className="px-6 py-5">
                            <p className="font-mono font-bold text-slate-800">{renderCurrency(sim.budget)} <span className="text-[9px] text-slate-400 font-sans uppercase tracking-widest">Facturé</span></p>
                            <p className="font-mono font-bold text-orange-600 text-xs mt-1 bg-orange-50 px-2 py-0.5 rounded inline-block">{renderCurrency((sim.stats?.costTotal || 0) / duration)}/j <span className="text-[9px] text-orange-400 font-sans uppercase tracking-widest">Ads</span></p>
                        </td>
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
                        <td className="px-6 py-5 text-right flex justify-end gap-2">
                          <button onClick={() => { setCurrentSimulation(sim); setShowModal('simulation'); }} className="p-2 text-slate-300 hover:text-[#01189B] hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={18} /></button>
                          <button onClick={() => handleDelete('simulations', sim.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLMC = () => {
    const totalSimulatedProfit = lmcSimulationsList.reduce((acc, sim) => acc + sim.profit, 0);
    const totalSimulatedCA = lmcSimulationsList.reduce((acc, sim) => acc + sim.budget, 0);
    const totalSimulatedLeads = lmcSimulationsList.reduce((acc, sim) => acc + sim.leads, 0);
    const progressPercent = Math.min((totalSimulatedProfit / lmcGoal) * 100, 100);
    const remainingProfit = Math.max(lmcGoal - totalSimulatedProfit, 0);

    const avgProfit = lmcSimulationsList.length > 0 ? totalSimulatedProfit / lmcSimulationsList.length : 1500;
    const clientsNeeded = Math.ceil(remainingProfit / avgProfit);
    const callsNeeded = clientsNeeded * 5; // Hypothèse de 20% de closing

    const addSimulatedClient = (budget = 3000, productId: string | null = null) => {
      const prod = productId ? products.find(p => p.id === productId) : products[0];
      if (!prod) return addNotification('error', 'Aucun produit disponible.');
      
      const fees = budget * 0.35; 
      const netMedia = budget * 0.65; 
      const volumeTotal = Math.floor(netMedia / prod.price); 
      const costTotal = volumeTotal * Number(prod.cost ?? 0);
      const profit = fees + (netMedia - costTotal);

      const newSim = {
          id: Math.random().toString(36).substr(2, 9),
          name: `Simulation ${lmcSimulationsList.length + 1}`,
          productName: prod.name,
          budget,
          leads: volumeTotal,
          profit,
          margin: (profit / budget) * 100
      };
      setLmcSimulationsList([...lmcSimulationsList, newSim]);
    };

    const handleCustomAdd = () => {
       addSimulatedClient(lmcCustomBudget, lmcCustomProduct || (products[0]?.id));
    };

    const generateAutoScenario = () => {
       let currentProfit = totalSimulatedProfit;
       let localList = [...lmcSimulationsList];
       let safeGuard = 0;
       
       const defaultBudget = 3000;
       const prod = products[0];
       if(!prod) return addNotification('error', 'Aucun produit disponible pour simuler.');

       const fees = defaultBudget * 0.35;
       const netMedia = defaultBudget * 0.65;
       const volumeTotal = Math.floor(netMedia / prod.price);
       const costTotal = volumeTotal * Number(prod.cost ?? 0);
       const profitPerClient = fees + (netMedia - costTotal);

       if (currentProfit >= lmcGoal) return addNotification('info', 'Objectif déjà atteint !');

       while(currentProfit < lmcGoal && safeGuard < 50) {
           const newSim = {
              id: Math.random().toString(36).substr(2, 9),
              name: `Client Auto ${localList.length + 1}`,
              productName: prod.name,
              budget: defaultBudget,
              leads: volumeTotal,
              profit: profitPerClient,
              margin: (profitPerClient / defaultBudget) * 100
           };
           localList.push(newSim);
           currentProfit += profitPerClient;
           safeGuard++;
       }
       setLmcSimulationsList(localList);
       addNotification('success', 'Scénario magique généré !');
    };

    return (
       <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-12">
          <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div>
              <h2 className="text-2xl font-extrabold flex items-center gap-3 text-slate-800 font-poppins">
                <Target style={{ color: BRAND_COLOR }} size={28} /> Prévisionnel de Croissance
              </h2>
              <p className="text-slate-500 mt-1 text-sm">Définissez vos objectifs financiers et simulez les ventes nécessaires pour les atteindre.</p>
            </div>
            <div className="flex gap-4">
                <div className="bg-slate-50 p-1 rounded-xl flex border border-slate-200">
                    <button onClick={() => setLmcPeriod('month')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${lmcPeriod === 'month' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>Au Mois</button>
                    <button onClick={() => setLmcPeriod('year')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${lmcPeriod === 'year' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>A l'Année</button>
                </div>
                <button onClick={() => setLmcSimulationsList([])} className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-100 transition-all flex items-center gap-2 border border-red-100">
                   <Trash2 size={16}/> Vider
                </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* PANNEAU GAUCHE : OBJECTIFS & CONSEILS */}
              <div className="lg:col-span-1 space-y-6">
                  {/* Objectif Box */}
                  <div className="bg-gradient-to-br from-[#01189B] to-blue-800 p-8 rounded-3xl text-white shadow-lg relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                      <p className="text-blue-200 font-bold uppercase tracking-widest text-xs mb-2">Objectif Bénéfice ({lmcPeriod === 'month' ? 'Mensuel' : 'Annuel'})</p>
                      <div className="flex items-center gap-2 mb-6">
                          <input 
                              type="number" 
                              value={lmcGoal} 
                              onChange={e => setLmcGoal(Number(e.target.value))} 
                              className="bg-transparent border-b-2 border-blue-400/50 text-4xl font-extrabold text-white w-full outline-none focus:border-white font-poppins transition-colors"
                          />
                          <span className="text-xl font-bold text-blue-300">CHF</span>
                      </div>
                      
                      <div className="bg-black/20 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                          <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest mb-1">Bénéfice Simulé</p>
                          <p className="text-2xl font-black font-mono">{renderCurrency(totalSimulatedProfit)}</p>
                          
                          <div className="w-full bg-black/30 rounded-full h-2 mt-4 overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-1000 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" style={{ width: `${progressPercent}%` }}></div>
                          </div>
                          <p className="text-right text-xs font-bold mt-2 text-emerald-300">{progressPercent.toFixed(1)}% de l'objectif</p>
                      </div>
                  </div>

                  {/* Conseils Box */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                      <h3 className="font-extrabold text-slate-800 mb-4 flex items-center gap-2 text-lg"><Activity className="text-orange-500" size={20}/> Stratégie & Conseils</h3>
                      {remainingProfit <= 0 ? (
                          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-700">
                              <p className="font-bold flex items-center gap-2 mb-1"><CheckCircle size={18}/> Objectif Atteint !</p>
                              <p className="text-sm">Votre prévisionnel couvre parfaitement votre objectif financier. Validez ces signatures pour sécuriser votre CA.</p>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              <p className="text-sm text-slate-600">Pour atteindre les <b className="text-[#01189B]">{renderCurrency(remainingProfit)}</b> restants, voici le plan d'action estimé selon votre panier moyen actuel ({renderCurrency(avgProfit)}) :</p>
                              
                              <div className="grid grid-cols-2 gap-3">
                                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                                      <p className="text-3xl font-black text-slate-800 font-poppins">{clientsNeeded}</p>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Nouveaux Clients</p>
                                  </div>
                                  <div className="p-3 bg-orange-50 border border-orange-100 rounded-xl text-center">
                                      <p className="text-3xl font-black text-orange-600 font-poppins">{callsNeeded}</p>
                                      <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mt-1">Appels Découverte</p>
                                  </div>
                              </div>
                              <p className="text-xs text-slate-400 italic text-center">*Basé sur un taux de closing estimé à 20%.</p>
                          </div>
                      )}
                  </div>
              </div>

              {/* PANNEAU CENTRAL & DROIT : SIMULATION */}
              <div className="lg:col-span-2 space-y-6">
                  
                  {/* Outils d'ajout */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                      <h3 className="font-extrabold text-slate-800 mb-4 flex items-center gap-2"><Plus size={18} className="text-[#01189B]"/> Ajouter des signatures au prévisionnel</h3>
                      
                      <div className="flex flex-wrap gap-3 mb-6">
                          <button onClick={() => addSimulatedClient(2000)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-sm border border-slate-200 shadow-sm">
                              + Petit Client (2k)
                          </button>
                          <button onClick={() => addSimulatedClient(5000)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-sm border border-slate-200 shadow-sm">
                              + Client Moyen (5k)
                          </button>
                          <button onClick={() => addSimulatedClient(10000)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-sm border border-slate-200 shadow-sm">
                              + Gros Client (10k)
                          </button>
                          <button onClick={generateAutoScenario} className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold rounded-xl transition-colors text-sm border border-purple-200 shadow-sm flex items-center gap-1.5 ml-auto">
                              <Wand2 size={16}/> Compléter Auto
                          </button>
                      </div>

                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Ajout sur-mesure</p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                              <div>
                                  <label className={UI_CLASSES.label}>Budget Facturé</label>
                                  <input type="number" value={lmcCustomBudget} onChange={e => setLmcCustomBudget(Number(e.target.value))} className={`${UI_CLASSES.input} py-2.5`} />
                              </div>
                              <div>
                                  <label className={UI_CLASSES.label}>Thématique</label>
                                  <select value={lmcCustomProduct} onChange={e => setLmcCustomProduct(e.target.value)} className={`${UI_CLASSES.input} py-2.5`}>
                                      <option value="">Sélectionner</option>
                                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                              </div>
                              <button onClick={handleCustomAdd} className="w-full bg-[#01189B] hover:bg-blue-800 text-white font-bold py-3 rounded-xl transition-colors shadow-sm">Ajouter Fiche</button>
                          </div>
                      </div>
                  </div>

                  {/* Liste des simulations */}
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-[400px] flex flex-col">
                      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                          <h3 className="font-extrabold text-slate-800 font-poppins text-lg flex items-center gap-2">
                             <Briefcase size={20} className="text-[#01189B]"/> Portefeuille Simulé ({lmcSimulationsList.length})
                          </h3>
                          <div className="flex gap-4 text-sm font-bold text-slate-500">
                             <span className="flex items-center gap-1"><Wallet size={16} className="text-blue-500"/> CA: {renderCurrency(totalSimulatedCA)}</span>
                             <span className="flex items-center gap-1"><Users size={16} className="text-emerald-500"/> Leads: {renderNumber(totalSimulatedLeads)}</span>
                          </div>
                      </div>
                      
                      <div className="flex-1 overflow-auto p-4 space-y-3 bg-slate-50/20 custom-scrollbar">
                          {lmcSimulationsList.length === 0 ? (
                              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                  <Target size={48} className="mb-4 opacity-20 text-[#01189B]"/>
                                  <p className="font-bold text-lg text-slate-600 mb-1">Aucun contrat simulé</p>
                                  <p className="text-sm">Ajoutez des clients fictifs pour construire votre prévisionnel.</p>
                              </div>
                          ) : (
                              lmcSimulationsList.map((sim, index) => (
                                  <div key={sim.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-[#01189B] transition-colors group">
                                      <div className="flex items-center gap-4">
                                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-xs shrink-0">{index + 1}</div>
                                          <div>
                                              <h4 className="font-bold text-slate-800 text-sm">{sim.name}</h4>
                                              <p className="text-[10px] text-slate-500 font-bold mt-0.5">{sim.productName}</p>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-8 pr-4 w-full sm:w-auto justify-end">
                                          <div className="text-right">
                                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Budget</p>
                                              <p className="font-mono font-bold text-slate-700 text-sm">{renderCurrency(sim.budget)}</p>
                                          </div>
                                          <div className="text-right">
                                              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">Bénéfice</p>
                                              <p className="font-mono font-extrabold text-emerald-600 text-sm bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{renderCurrency(sim.profit)}</p>
                                          </div>
                                          <button onClick={() => setLmcSimulationsList(lmcSimulationsList.filter(s => s.id !== sim.id))} className="text-slate-300 hover:text-red-500 transition-colors bg-red-50 p-2 rounded-xl sm:opacity-0 group-hover:opacity-100">
                                              <Trash2 size={16}/>
                                          </button>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
              </div>
          </div>
       </div>
    );
  };

  const renderDashboard = () => {
    const goal = Number(settings.monthlyGoal || 50000);
    const progressGoal = Math.min((stats.caMensuel / goal) * 100, 100);

    const recentActivity = [...interactions]
      .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    const recentInvoices = [...invoices]
      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 4);

    const activeReminders = contacts
      .filter(c => c.nextContactDate)
      .sort((a,b) => new Date(a.nextContactDate).getTime() - new Date(b.nextContactDate).getTime())
      .slice(0, 5);

    const defaultLayout = ['objective', 'widget_finances_data', 'chart_annual_1', 'widget_ca_details', 'invoices', 'reminders'];
    let currentLayout = (settings.dashboardLayout !== undefined ? settings.dashboardLayout : defaultLayout).filter((id: string) => AVAILABLE_WIDGETS.map(w=>w.id).includes(id));
    if (currentLayout.length === 0) currentLayout = defaultLayout;

    const toggleWidget = async (widgetId: string) => {
        let newLayout = [...currentLayout];
        if (newLayout.includes(widgetId)) {
            newLayout = newLayout.filter(id => id !== widgetId);
        } else {
            newLayout.push(widgetId);
        }
        setSettings((prev: any) => ({ ...prev, dashboardLayout: newLayout }));
        if (user && !isOfflineMode) {
            try {
                await setDoc(doc(db, `artifacts/${getAppId()}/users/${user.uid}/config`, 'general'), { dashboardLayout: newLayout }, { merge: true });
            } catch(err) {
                console.error("Erreur save layout", err);
            }
        }
    };

    const defaultSizes: Record<string, string> = {
        objective: 'grand', widget_finances_data: 'grand', chart_annual_1: 'grand',
        widget_ca_details: 'moyen', reminders: 'moyen', invoices: 'moyen', activity: 'moyen'
    };
    const widgetSizes = settings.dashboardWidgetSizes || defaultSizes;

    const changeWidgetSize = async (widgetId: string, size: string) => {
        const newSizes = { ...widgetSizes, [widgetId]: size };
        setSettings((prev: any) => ({ ...prev, dashboardWidgetSizes: newSizes }));
        if (user && !isOfflineMode) {
            try {
                await setDoc(doc(db, `artifacts/${getAppId()}/users/${user.uid}/config`, 'general'), { dashboardWidgetSizes: newSizes }, { merge: true });
            } catch(err) {}
        }
    };

    const handleDragStart = (e: any, widgetId: string) => {
        e.dataTransfer.setData('widgetId', widgetId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = async (e: any, targetWidgetId: string) => {
        e.preventDefault();
        const draggedWidgetId = e.dataTransfer.getData('widgetId');
        if (!draggedWidgetId || draggedWidgetId === targetWidgetId) return;

        const newLayout = [...currentLayout];
        const draggedIdx = newLayout.indexOf(draggedWidgetId);
        const targetIdx = newLayout.indexOf(targetWidgetId);

        if (draggedIdx > -1 && targetIdx > -1) {
            newLayout.splice(draggedIdx, 1);
            newLayout.splice(targetIdx, 0, draggedWidgetId);

            setSettings((prev: any) => ({ ...prev, dashboardLayout: newLayout }));
            if (user && !isOfflineMode) {
                try {
                    await setDoc(doc(db, `artifacts/${getAppId()}/users/${user.uid}/config`, 'general'), { dashboardLayout: newLayout }, { merge: true });
                } catch(err) {}
            }
        }
    };

    const getWidgetSpan = (widgetId: string) => {
        const size = widgetSizes[widgetId] || defaultSizes[widgetId] || 'moyen';
        if (size === 'petit') return 'col-span-1 md:col-span-1 lg:col-span-1';
        if (size === 'moyen') return 'col-span-1 md:col-span-2 lg:col-span-2';
        return 'col-span-1 md:col-span-2 lg:col-span-4'; // grand
    };

    const widgets: Record<string, any> = {
        widget_finances_data: (
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-blue-50/30 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="flex justify-between items-start mb-6 relative z-10">
                    <div>
                        <h3 className="font-extrabold text-slate-800 font-poppins text-xl flex items-center gap-3"><Wallet style={{ color: BRAND_COLOR }} size={24}/> CA & Bénéfices</h3>
                        <p className="text-sm text-slate-500 mt-1 font-medium">Récapitulatif de vos encaissements et marges nettes.</p>
                    </div>
                    <div className="bg-white border-2 border-[#01189B]/10 px-4 py-2.5 rounded-2xl shadow-sm text-right shrink-0">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">CA Encaissé</p>
                        <p className="text-2xl font-black font-poppins text-[#01189B]">{renderCurrency(stats.caAnnuel)}</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 relative z-10 mt-auto">
                    <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                        <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wider mb-1">Marge Gestion</p>
                        <p className="text-lg font-extrabold text-orange-700 font-mono">{renderCurrency(stats.beneficePapierTotal)}</p>
                    </div>
                    <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100">
                        <p className="text-[10px] text-purple-600 font-bold uppercase tracking-wider mb-1">Marge Arbitrage</p>
                        <p className="text-lg font-extrabold text-purple-700 font-mono">{renderCurrency(stats.arbitrageTotal)}</p>
                    </div>
                    <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 shadow-sm">
                        <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">Bénéfice Total</p>
                        <p className="text-lg font-extrabold text-emerald-700 font-mono">{renderCurrency(stats.beneficePapierTotal + stats.arbitrageTotal)}</p>
                    </div>
                </div>
            </div>
        ),
        widget_finances_chart: (
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full flex flex-col relative overflow-hidden min-h-[300px]">
                <div className="flex justify-between items-start mb-8 relative z-10">
                    <h3 className="font-extrabold text-slate-800 font-poppins text-xl flex items-center gap-3"><TrendingUp style={{ color: BRAND_COLOR }} size={24}/> Évolution Mensuelle {dashboardYear}</h3>
                    <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Annuel {dashboardYear}</p>
                        <p className="text-lg font-black font-poppins text-[#01189B]">{renderCurrency(stats.caAnnuel)}</p>
                    </div>
                </div>
                <div className="flex-1 flex h-40 mt-auto relative z-10">
                    <div className="flex flex-col justify-between items-end pr-3 border-r border-slate-100 text-[9px] font-bold text-slate-400 pb-6 w-10 shrink-0">
                        <span>{Math.floor(Math.max(...stats.monthlyCA, 1) / 1000)}k</span>
                        <span>{Math.floor((Math.max(...stats.monthlyCA, 1) / 2) / 1000)}k</span>
                        <span>0</span>
                    </div>
                    <div className="flex-1 flex items-end gap-2 pl-3 pb-2 border-b border-slate-100">
                        {stats.monthlyCA.map((val: number, idx: number) => {
                            const max = Math.max(...stats.monthlyCA, 1);
                            const height = `${(val / max) * 100}%`;
                            const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
                            return (
                                <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full relative">
                                    <div className="w-full bg-blue-100/50 rounded-t-sm relative hover:bg-[#01189B] transition-all duration-300 cursor-pointer group/bar" style={{ height: height === '0%' ? '4px' : height, backgroundColor: val > 0 ? '' : '#f1f5f9' }}>
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold py-1.5 px-2 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none shadow-xl">
                                            {renderCurrency(val)}
                                        </div>
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-widest">{months[idx]}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        ),
        chart_annual_1: (
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full flex flex-col relative overflow-hidden min-h-[350px]">
                <div className="absolute top-0 right-0 p-32 bg-blue-50/30 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="flex justify-between items-start mb-8 relative z-10">
                    <div>
                        <h3 className="font-extrabold text-slate-800 font-poppins text-xl flex items-center gap-3"><TrendingUp style={{ color: BRAND_COLOR }} size={24}/> Évolution Mensuelle {dashboardYear}</h3>
                    </div>
                    <div className="bg-white border-2 border-[#01189B]/10 px-5 py-3 rounded-2xl shadow-sm">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">CA Total Encaissé {dashboardYear}</p>
                        <p className="text-3xl font-black font-poppins text-[#01189B]">{renderCurrency(stats.caAnnuel)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 relative z-10">
                    <div className="p-5 bg-gradient-to-br from-orange-50 to-orange-50/30 rounded-2xl border border-orange-100 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Briefcase size={14}/> 1. Marge de Gestion</p>
                            <p className="text-2xl font-extrabold text-orange-700 font-mono">{renderCurrency(stats.beneficePapierTotal)}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-orange-300"><Briefcase size={20}/></div>
                    </div>
                    <div className="p-5 bg-gradient-to-br from-emerald-50 to-emerald-50/30 rounded-2xl border border-emerald-100 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Zap size={14}/> 2. Marge d'Arbitrage</p>
                            <p className="text-2xl font-extrabold text-emerald-700 font-mono">{renderCurrency(stats.arbitrageTotal)}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-emerald-300"><Target size={20}/></div>
                    </div>
                </div>

                <div className="flex-1 flex items-end gap-3 h-32 mt-auto border-b border-slate-100 pb-2 relative z-10">
                    {stats.monthlyCA.map((val: number, idx: number) => {
                        const max = Math.max(...stats.monthlyCA, 1);
                        const height = `${(val / max) * 100}%`;
                        const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
                        return (
                            <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full relative">
                                <div className="w-full bg-blue-100/50 rounded-t-xl relative hover:bg-[#01189B] transition-all duration-300 cursor-pointer group/month" style={{ height: height === '0%' ? '4px' : height, backgroundColor: val > 0 ? '' : '#f1f5f9' }}>
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs font-bold py-2 px-3 rounded-lg opacity-0 group-hover/month:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none shadow-xl">
                                        {renderCurrency(val)}
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 mt-3 uppercase tracking-widest">{months[idx]}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        ),
        stat_ca_month: (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4"><Wallet size={24} style={{ color: BRAND_COLOR }}/></div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">CA Encaissé (Mois)</p>
                <h3 className="text-3xl font-extrabold mt-1 font-poppins" style={{ color: BRAND_COLOR }}>{renderCurrency(stats.caMensuel)}</h3>
            </div>
        ),
        stat_ca_total: (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4"><CheckCircle size={24} className="text-emerald-500"/></div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">CA Encaissé (Total)</p>
                <h3 className="text-3xl font-extrabold text-emerald-500 mt-1 font-poppins">{renderCurrency(stats.caTotal)}</h3>
            </div>
        ),
        stat_ca_potentiel: (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full">
                <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center mb-4"><PieChart size={24} className="text-orange-500"/></div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">CA Potentiel</p>
                <h3 className="text-3xl font-extrabold text-orange-500 mt-1 font-poppins">{renderCurrency(stats.caPotentiel)}</h3>
            </div>
        ),
        stat_pipeline: (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full">
                <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mb-4"><Target size={24} className="text-purple-600"/></div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Valeur Pipeline</p>
                <h3 className="text-3xl font-extrabold text-purple-600 mt-1 font-poppins">{renderCurrency(stats.pipelineValue)}</h3>
            </div>
        ),
        objective: (
            <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden flex flex-col md:flex-row items-center gap-8 h-full">
                <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-inner shrink-0" style={{ background: `linear-gradient(135deg, ${BRAND_COLOR}22 0%, ${BRAND_COLOR}11 100%)` }}>
                    <TrendingUp size={40} style={{ color: BRAND_COLOR }} />
                </div>
                <div className="flex-1 w-full text-center md:text-left">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Objectif Mensuel Encaissé</p>
                    <h2 className="text-3xl font-extrabold font-poppins text-slate-800">{renderCurrency(stats.caMensuel)} <span className="text-lg text-slate-400 font-medium">/ {renderCurrency(goal)}</span></h2>
                    <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner mt-4">
                        <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressGoal}%`, backgroundColor: BRAND_COLOR }}></div>
                    </div>
                </div>
            </div>
        ),
        stat_campaigns: (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-4"><PlayCircle size={24} className="text-indigo-600"/></div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Campagnes Actives</p>
                <h3 className="text-3xl font-extrabold text-indigo-600 mt-1 font-poppins">{renderNumber(stats.activeCampaigns)} <span className="text-sm font-medium text-slate-400 font-inter">en prod.</span></h3>
            </div>
        ),
        widget_ca_details: (
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full">
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                    <h3 className="font-extrabold text-slate-800 font-poppins text-lg flex items-center gap-2"><Wallet className="text-emerald-500" size={20}/> Détail CA par Client</h3>
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{stats.caDetails?.length || 0} clients</span>
                </div>
                {(!stats.caDetails || stats.caDetails.length === 0) ? (
                    <p className="text-slate-400 text-sm italic text-center py-6">Aucun CA encaissé pour le moment.</p>
                ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                        {stats.caDetails.map((client: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-emerald-50 hover:border-emerald-200 transition-colors">
                                <p className="font-bold text-slate-800 text-sm truncate pr-4">{renderName(client.name)}</p>
                                <p className="font-mono font-extrabold text-emerald-600 whitespace-nowrap">{renderCurrency(client.total)}</p>
                            </div>
                        ))}
                    </div>
                )}
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
                            const date = new Date(contact.nextContactDate);
                            const isOverdue = date <= new Date();
                            return (
                                <div key={contact.id} onClick={() => setSelectedContactId(contact.id)} className={`flex flex-col p-3 rounded-xl cursor-pointer hover:shadow-sm transition-all border ${isOverdue ? 'bg-red-50/50 border-red-100 hover:border-red-300' : 'bg-slate-50 border-slate-100 hover:border-[#01189B]'}`}>
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="font-bold text-slate-800 text-sm">{renderName(contact.company)}</p>
                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{isOverdue ? 'Échu !' : formatDate(contact.nextContactDate)}</span>
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
                                    <div className={`w-2 h-2 rounded-full ${inv.status === 'payee' ? 'bg-emerald-500' : inv.status === 'retard' ? 'bg-orange-500' : inv.status === 'archive' || inv.status === 'annulee' ? 'bg-slate-500' : 'bg-blue-400'}`}></div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{renderName(inv.clientName)}</p>
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
                                    <p className="text-xs font-bold text-slate-500 mb-1 flex justify-between"><span>{contact ? renderName(contact.company) : 'Contact inconnu'}</span> <span className="text-slate-400 font-medium">{formatDate(act.createdAt)}</span></p>
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
        <div className="flex justify-between items-center flex-wrap gap-4">
            <h2 className="text-3xl font-extrabold text-slate-800 font-poppins"><LayoutDashboard style={{ color: BRAND_COLOR }} className="inline-block mr-3" size={32}/> Tableau de bord</h2>
            <div className="flex gap-3">
                <select value={dashboardYear} onChange={e => setDashboardYear(Number(e.target.value))} className="px-4 py-2 rounded-xl text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm outline-none cursor-pointer">
                    <option value={2027}>Année 2027</option>
                    <option value={2026}>Année 2026</option>
                    <option value={2025}>Année 2025</option>
                    <option value={2024}>Année 2024</option>
                </select>
                <button onClick={() => setIsEditingLayout(!isEditingLayout)} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm ${isEditingLayout ? 'bg-[#01189B] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <Settings size={16}/> {isEditingLayout ? 'Terminer' : 'Personnaliser'}
                </button>
            </div>
        </div>

        {isEditingLayout && (
            <div className="bg-white p-6 rounded-3xl border-2 border-[#01189B] shadow-lg animate-fade-in flex flex-col gap-6">
                <div>
                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><LayoutDashboard size={18} style={{color: BRAND_COLOR}}/> Activer/Désactiver les Widgets</h4>
                    <div className="flex flex-wrap gap-3">
                        {AVAILABLE_WIDGETS.map(w => {
                            const isActive = currentLayout.includes(w.id);
                            return (
                                <button
                                    key={w.id}
                                    onClick={() => toggleWidget(w.id)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all flex items-center gap-2 ${isActive ? 'bg-blue-50 border-[#01189B] text-[#01189B] shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'}`}
                                >
                                    {isActive ? <CheckCircle size={14}/> : <Plus size={14}/>} {w.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {currentLayout.length > 0 && (
                    <div className="pt-4 border-t border-slate-100">
                        <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Settings size={18} className="text-orange-500"/> Personnaliser la taille</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {currentLayout.map((wId: string) => {
                                const wDef = AVAILABLE_WIDGETS.find(w => w.id === wId);
                                const currentSize = widgetSizes[wId] || defaultSizes[wId] || 'moyen';
                                return (
                                    <div key={`size-${wId}`} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col gap-2">
                                        <p className="text-xs font-bold text-slate-700">{wDef?.label}</p>
                                        <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
                                            {['petit', 'moyen', 'grand'].map(sz => (
                                                <button 
                                                    key={sz}
                                                    onClick={() => changeWidgetSize(wId, sz)}
                                                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${currentSize === sz ? 'bg-[#01189B] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                                                >
                                                    {sz}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        )}

        {currentLayout.length === 0 && !isEditingLayout && (
            <div className="bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center mt-8">
                <LayoutDashboard size={48} className="text-slate-300 mb-4" />
                <h3 className="text-xl font-bold text-slate-700 font-poppins mb-2">Votre tableau de bord est vide</h3>
                <p className="text-slate-500 mb-6">Personnalisez votre espace en ajoutant les widgets dont vous avez besoin.</p>
                <button onClick={() => setIsEditingLayout(true)} className="px-6 py-3 bg-[#01189B] text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center gap-2">
                    <Plus size={18}/> Ajouter des widgets
                </button>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-min">
            {currentLayout.map((widgetId: string) => {
                if (!widgets[widgetId]) return null;
                const isDragOver = dragOverWidget === widgetId;
                return (
                    <div
                        key={widgetId} draggable
                        onDragStart={(e) => handleDragStart(e, widgetId)}
                        onDragOver={(e) => { e.preventDefault(); setDragOverWidget(widgetId); }}
                        onDragLeave={() => setDragOverWidget(null)}
                        onDrop={(e) => { setDragOverWidget(null); handleDrop(e, widgetId); }}
                        className={`${getWidgetSpan(widgetId)} relative group cursor-grab active:cursor-grabbing transition-all duration-200 ${isDragOver ? 'scale-[1.02] shadow-[0_0_0_4px_#01189B33] rounded-3xl z-10' : ''}`}
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
        <div className="max-w-5xl mx-auto animate-fade-in pb-12 flex flex-col md:flex-row gap-8">
          {/* Menu latéral Settings */}
          <div className="w-full md:w-64 shrink-0 space-y-2">
              <h2 className="text-2xl font-extrabold mb-6 font-poppins text-slate-800">Paramètres</h2>
              {[
                  { id: 'general', label: 'Infos Générales', icon: Briefcase },
                  { id: 'billing', label: 'Facturation', icon: FileText },
                  { id: 'contract', label: 'Contrat', icon: FileText },
              { id: 'emails', label: 'Modèles d\'Emails', icon: Mail },
              { id: 'integrations', label: 'Intégrations', icon: Link },
              { id: 'emailHistory', label: 'Historique Mails', icon: Clock },
              { id: 'data', label: 'Données & Export', icon: Download },
              { id: 'diagnostic', label: 'Diagnostic Système', icon: Activity },
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
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div><label className={UI_CLASSES.label}>Nom Société</label><input name="companyName" defaultValue={settings.companyName} className={UI_CLASSES.input} /></div>
                        <div><label className={UI_CLASSES.label}>Numéro d'entreprise (IDE / TVA)</label><input name="companyId" defaultValue={settings.companyId} className={UI_CLASSES.input} placeholder="Ex: CHE-123.456.789 TVA" /></div>
                        <div className="md:col-span-2"><label className={UI_CLASSES.label}>Adresse Complète</label><textarea name="address" defaultValue={settings.address} className={`${UI_CLASSES.input} h-24 resize-none`} /></div>
                        <div><label className={UI_CLASSES.label}>Email Contact</label><input name="email" defaultValue={settings.email} className={UI_CLASSES.input} /></div>
                        <div><label className={UI_CLASSES.label}>Téléphone</label><input name="phone" defaultValue={settings.phone} className={UI_CLASSES.input} /></div>
                      </div>

                      <div className="border-t border-slate-100 pt-6 mt-6">
                          <label className={UI_CLASSES.label}>Objectif CA Mensuel (CHF)</label>
                          <input name="monthlyGoal" type="number" defaultValue={settings.monthlyGoal || 50000} className={`${UI_CLASSES.input} w-full md:w-1/2 text-xl text-[#01189B] font-extrabold`} />
                      </div>

                      <div className="pt-4 flex justify-end">
                          <button type="submit" className={UI_CLASSES.btnPrimary} style={{ backgroundColor: BRAND_COLOR }}><Save size={18}/> Sauvegarder</button>
                      </div>
                  </form>
              )}

              {settingsActiveTab === 'billing' && (
                  <form onSubmit={handleSaveSettings} className="space-y-6 animate-fade-in">
                      <h3 className="font-extrabold text-xl mb-6 font-poppins border-b border-slate-100 pb-4 text-slate-800 flex items-center gap-2"><FileText size={22} className="text-[#01189B]"/> Personnalisation Facture</h3>
                      <div><label className={UI_CLASSES.label}>Coordonnées Bancaires (IBAN, BIC, etc.)</label><textarea name="bankDetails" defaultValue={settings.bankDetails} className={`${UI_CLASSES.input} h-24 resize-none`} placeholder="Banque XYZ&#10;IBAN: CH...&#10;BIC: ..." /></div>
                      <div><label className={UI_CLASSES.label}>Pied de page / Conditions</label><textarea name="invoiceFooter" defaultValue={settings.invoiceFooter} className={`${UI_CLASSES.input} h-20 resize-none`} /></div>
                      <div><label className={UI_CLASSES.label}>Ligne Légale (Bas de page centré)</label><input name="legalNotice" defaultValue={settings.legalNotice || 'Entreprise individuelle non soumise à la TVA'} className={`${UI_CLASSES.input} text-sm`} /></div>

                      <div className="pt-4 flex justify-end">
                          <button type="submit" className={UI_CLASSES.btnPrimary} style={{ backgroundColor: BRAND_COLOR }}><Save size={18}/> Sauvegarder</button>
                      </div>
                  </form>
              )}

              {settingsActiveTab === 'contract' && (
                  <form onSubmit={handleSaveSettings} className="space-y-6 animate-fade-in">
                      <h3 className="font-extrabold text-xl mb-6 font-poppins border-b border-slate-100 pb-4 text-slate-800 flex items-center gap-2"><FileText size={22} className="text-[#01189B]"/> Modèle de Contrat</h3>
                      
                      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-4 text-sm text-blue-800">
                          <p className="font-bold flex items-center gap-2 mb-2"><Info size={16}/> Astuces & Variables :</p>
                          <div className="flex flex-wrap gap-2 mb-2">
                              <code className="bg-white px-2 py-1 rounded border border-blue-200 text-xs font-bold">{'{{client_company}}'}</code>
                              <code className="bg-white px-2 py-1 rounded border border-blue-200 text-xs font-bold">{'{{client_address}}'}</code>
                              <code className="bg-white px-2 py-1 rounded border border-blue-200 text-xs font-bold">{'{{client_name}}'}</code>
                              <code className="bg-white px-2 py-1 rounded border border-blue-200 text-xs font-bold">{'{{agency_company}}'}</code>
                          </div>
                          <p className="text-xs">Insérez <code className="bg-white px-1 rounded font-bold">---</code> (3 tirets) dans votre texte pour forcer un saut de page manuel sur le PDF.</p>
                      </div>

                      <div>
                          <label className={UI_CLASSES.label}>Texte du contrat par défaut</label>
                          <textarea name="defaultContractText" defaultValue={settings.defaultContractText} className={`${UI_CLASSES.input} h-64 resize-none custom-scrollbar text-sm`} placeholder="Texte de votre contrat type..." />
                      </div>
                      
                      <div className="border-t border-slate-100 pt-6">
                          <label className={UI_CLASSES.label}>Signature de l'Agence</label>
                          <div className="mt-4">
                              {settings.agencySignature ? (
                                  <div className="relative group inline-block">
                                      <img src={settings.agencySignature} alt="Signature" className="h-24 object-contain border-2 border-slate-200 rounded-2xl p-4 bg-white shadow-sm" />
                                      <button type="button" onClick={() => handleSaveSettingsDirect({ agencySignature: '' })} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:scale-110"><X size={14}/></button>
                                      <p className="text-[10px] text-slate-400 mt-3 font-medium flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-500"/> Signature enregistrée avec succès. Cliquez sur la croix rouge pour la refaire.</p>
                                  </div>
                              ) : (
                                  <SignaturePad 
                                      onSave={(base64: string) => handleSaveSettingsDirect({ agencySignature: base64 })} 
                                      onClear={() => handleSaveSettingsDirect({ agencySignature: '' })}
                                  />
                              )}
                          </div>
                      </div>

                      <div className="pt-4 flex justify-end mt-4">
                          <button type="submit" className={UI_CLASSES.btnPrimary} style={{ backgroundColor: BRAND_COLOR }}><Save size={18}/> Sauvegarder</button>
                      </div>
                  </form>
              )}

              {settingsActiveTab === 'emails' && (
                  <div className="space-y-6 animate-fade-in">
                      <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                          <h3 className="font-extrabold text-xl font-poppins text-slate-800 flex items-center gap-2"><Mail size={22} className="text-[#01189B]"/> Modèles d'Emails</h3>
                      </div>

                      <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 mb-6">
                          <p className="text-sm font-bold text-[#01189B] flex items-center gap-2 mb-4"><Info size={18}/> Variables disponibles dans les modèles :</p>
                          <div className="flex flex-wrap gap-3">
                              {['{{nom_contact}}', '{{prenom_contact}}', '{{societe}}', '{{facture}}', '{{montant}}', '{{agence}}'].map(v => (
                                  <span 
                                    key={v} 
                                    onClick={() => {
                                        const textArea = document.createElement("textarea");
                                        textArea.value = v;
                                        document.body.appendChild(textArea);
                                        textArea.select();
                                        document.execCommand('copy');
                                        document.body.removeChild(textArea);
                                        addNotification('info', `Variable ${v} copiée !`);
                                    }}
                                    className="bg-white text-[#01189B] px-3 py-1.5 rounded-xl border border-blue-200 text-xs font-mono font-bold shadow-sm cursor-pointer hover:bg-blue-50 transition-colors"
                                    title="Cliquer pour copier"
                                  >
                                      {v}
                                  </span>
                              ))}
                          </div>
                      </div>

                      <div className="space-y-6">
                          <div className="flex justify-between items-center mb-4">
                              <h4 className="font-bold text-lg text-slate-800">Envois de Facturation</h4>
                              <button onClick={() => {
                                  const newTpl = { id: Math.random().toString(36).substr(2, 9), name: 'Nouveau Modèle', subject: 'Sujet...', body: 'Corps du message...' };
                                  handleSaveSettingsDirect({ emailTemplates: [...(settings.emailTemplates || []), newTpl] });
                              }} className="bg-[#01189B] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:shadow-lg hover:-translate-y-0.5 transition-all"><Plus size={14}/> Ajouter Modèle</button>
                          </div>
                          {(settings.emailTemplates || []).map((tpl: any) => (
                              <EmailTemplateEditor 
                                  key={tpl.id} 
                                  tpl={tpl} 
                                  onSave={(updated: any) => {
                                      const list = (settings.emailTemplates || []).map((t: any) => t.id === updated.id ? updated : t);
                                      handleSaveSettingsDirect({ emailTemplates: list });
                                  }}
                                  onDelete={() => {
                                      openConfirm('Supprimer le modèle ?', 'Cette action est irréversible.', () => {
                                          const list = (settings.emailTemplates || []).filter((t: any) => t.id !== tpl.id);
                                          handleSaveSettingsDirect({ emailTemplates: list });
                                      });
                                  }}
                              />
                          ))}

                          <div className="flex justify-between items-center mb-4 mt-12 border-t border-slate-100 pt-8">
                              <h4 className="font-bold text-lg text-slate-800">Prospection & Relances CRM</h4>
                              <button onClick={() => {
                                  const newTpl = { id: Math.random().toString(36).substr(2, 9), name: 'Nouveau Modèle', subject: 'Sujet...', body: 'Corps du message...' };
                                  handleSaveSettingsDirect({ prospectEmailTemplates: [...(settings.prospectEmailTemplates || []), newTpl] });
                              }} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:shadow-lg hover:-translate-y-0.5 transition-all"><Plus size={14}/> Ajouter Modèle</button>
                          </div>
                          {(settings.prospectEmailTemplates || []).map((tpl: any) => (
                              <EmailTemplateEditor 
                                  key={tpl.id} 
                                  tpl={tpl} 
                                  onSave={(updated: any) => {
                                      const list = (settings.prospectEmailTemplates || []).map((t: any) => t.id === updated.id ? updated : t);
                                      handleSaveSettingsDirect({ prospectEmailTemplates: list });
                                  }}
                                  onDelete={() => {
                                      openConfirm('Supprimer le modèle ?', 'Cette action est irréversible.', () => {
                                          const list = (settings.prospectEmailTemplates || []).filter((t: any) => t.id !== tpl.id);
                                          handleSaveSettingsDirect({ prospectEmailTemplates: list });
                                      });
                                  }}
                              />
                          ))}
                      </div>
                  </div>
              )}

              {settingsActiveTab === 'integrations' && (
                  <form onSubmit={handleSaveSettings} className="space-y-6 animate-fade-in">
                      <h3 className="font-extrabold text-xl mb-6 font-poppins border-b border-slate-100 pb-4 text-slate-800 flex items-center gap-2"><Link size={22} className="text-purple-500"/> Intégrations & API</h3>
                      
                      <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100">
                          <h4 className="font-bold text-purple-800 mb-2">Webhook d'envoi d'emails (Facturation)</h4>
                          <p className="text-sm text-purple-600 mb-4">L'URL ci-dessous recevra le PDF de la facture encodé en Base64 ainsi que les données du client.</p>
                          <input name="webhookUrl" defaultValue={settings.webhookUrl} className="w-full border-2 border-purple-200 bg-white p-3.5 rounded-xl outline-none focus:border-purple-400 font-medium text-slate-800" placeholder="https://hook.make.com/..." />
                      </div>

                      <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                          <h4 className="font-bold text-blue-800 mb-2">Webhook d'envoi d'emails (Prospection)</h4>
                          <p className="text-sm text-blue-600 mb-4">Utilisé depuis la page Prospection ou Fiche Client (ne reçoit pas de PDF en pièce jointe).</p>
                          <input name="webhookUrlProspection" defaultValue={settings.webhookUrlProspection} className="w-full border-2 border-blue-200 bg-white p-3.5 rounded-xl outline-none focus:border-[#01189B] font-medium text-slate-800" placeholder="https://hook.make.com/..." />
                          
                          <div className="mt-6 p-4 bg-white rounded-xl border border-blue-200 text-sm text-slate-700 space-y-2">
                              <h5 className="font-bold text-[#01189B] flex items-center gap-2"><Info size={16}/> Comment activer le Webhook (Make / Zapier) ?</h5>
                              <ol className="list-decimal pl-5 space-y-1.5 mt-2 marker:text-blue-500 marker:font-bold">
                                  <li>Créez un scénario sur <a href="https://make.com" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold">Make.com</a> ou Zapier.</li>
                                  <li>Ajoutez un déclencheur <b>"Custom Webhook"</b> et copiez l'URL fournie.</li>
                                  <li>Collez cette URL dans le champ ci-dessus et sauvegardez.</li>
                                  <li>Faites un envoi depuis la page <b>Prospection</b> pour que Make reçoive les données de test.</li>
                                  <li>Dans Make, ajoutez un module <b>Gmail / Outlook</b>, et mappez les variables reçues : <code className="bg-slate-100 px-1 py-0.5 rounded text-[#01189B] text-xs font-mono">to_email</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-[#01189B] text-xs font-mono">subject</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-[#01189B] text-xs font-mono">message</code>.</li>
                                  <li>Pour la facturation, vous recevrez aussi <code className="bg-slate-100 px-1 py-0.5 rounded text-[#01189B] text-xs font-mono">pdf_attachment_base64</code> et <code className="bg-slate-100 px-1 py-0.5 rounded text-[#01189B] text-xs font-mono">contract_attachment_base64</code> (à convertir en data binaire pour l'envoyer en pièces jointes distinctes).</li>
                              </ol>
                          </div>
                      </div>

                      <div className="pt-4 flex justify-end">
                          <button type="submit" className={UI_CLASSES.btnPrimary} style={{ backgroundColor: BRAND_COLOR }}><Save size={18}/> Sauvegarder</button>
                      </div>
                  </form>
              )}

              {settingsActiveTab === 'emailHistory' && (
                  <div className="space-y-6 animate-fade-in">
                      <h3 className="font-extrabold text-xl mb-6 font-poppins border-b border-slate-100 pb-4 text-slate-800 flex items-center gap-2"><Clock size={22} className="text-[#01189B]"/> Historique d'envoi d'Emails</h3>
                      
                      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-500 uppercase font-extrabold text-[10px] tracking-wider border-b border-slate-100">
                            <tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Type</th><th className="px-6 py-4">Destinataire</th><th className="px-6 py-4">Sujet</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {[...emailHistory].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(log => (
                                <tr key={log.id} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-4 font-medium text-slate-500">{formatDateTime(log.date)}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${log.type === 'Facture' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{log.type}</span>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-slate-800">{log.to}</td>
                                    <td className="px-6 py-4 text-slate-600 line-clamp-1">{log.subject}</td>
                                </tr>
                            ))}
                            {emailHistory.length === 0 && <tr><td colSpan={4} className="text-center py-12 text-slate-400 font-medium">Aucun email enregistré dans l'historique.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                  </div>
              )}

              {settingsActiveTab === 'data' && (
                  <div className="space-y-8 animate-fade-in">
                      <div>
                          <h3 className="font-extrabold text-xl mb-6 font-poppins border-b border-slate-100 pb-4 text-slate-800 flex items-center gap-2"><Download size={22} className="text-emerald-500"/> Sauvegarde Complète (JSON)</h3>
                          <p className="text-sm text-slate-500 mb-6">Téléchargez l'intégralité des données de votre CRM (Contacts, Factures, Scénarios, Notes...) au format JSON. Idéal pour garder une copie locale sécurisée.</p>
                          
                          <button type="button" onClick={handleExportData} className="px-6 py-4 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-sm w-full justify-center text-lg">
                              <Download size={22}/> Générer & Télécharger (.json)
                          </button>
                      </div>

                      <div className="pt-8 border-t border-slate-100">
                          <h3 className="font-extrabold text-xl mb-6 font-poppins border-b border-slate-100 pb-4 text-slate-800 flex items-center gap-2"><Users size={22} className="text-[#01189B]"/> Import / Export Contacts (CSV)</h3>
                          <p className="text-sm text-slate-500 mb-6">Gérez votre base de contacts (clients et prospects) en masse via des fichiers CSV.</p>
                          <div className="flex gap-4">
                              <button onClick={handleExportContactsCSV} className="flex-1 bg-white text-slate-600 px-4 py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 border border-slate-200 shadow-sm transition-all"><Download size={18} /> Exporter le modèle CSV</button>
                              <button onClick={() => setShowImportModal('contacts')} className="flex-1 bg-slate-100 text-[#01189B] px-4 py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-50 border border-blue-100 shadow-sm transition-all"><Upload size={18} /> Importer des Contacts (CSV)</button>
                          </div>
                      </div>

                      <div className="pt-8 border-t border-slate-100 mt-8">
                          <h3 className="font-extrabold text-xl mb-6 font-poppins border-b border-slate-100 pb-4 text-slate-800 flex items-center gap-2"><Link size={22} className="text-red-500"/> Forcer la Reconnexion DB</h3>
                          <p className="text-sm text-slate-500 mb-6">Si vous avez changé de document et perdu vos données, entrez l'ID de votre ancienne base de données ici.</p>
                          <div className="flex gap-4 items-end flex-wrap md:flex-nowrap">
                              <div className="flex-1 w-full">
                                  <label className={UI_CLASSES.label}>ID Base de données / Document</label>
                                  <input 
                                    id="customDbInput"
                                    defaultValue={localStorage.getItem('leadpartner_custom_app_id') || ''} 
                                    className={UI_CLASSES.input} 
                                    placeholder="Ex: leadpartner-crm-v43-prod ou ID invisible..." 
                                  />
                              </div>
                              <button onClick={() => {
                                  const val = (document.getElementById('customDbInput') as HTMLInputElement).value;
                                  if (val) {
                                      localStorage.setItem('leadpartner_custom_app_id', val);
                                  } else {
                                      localStorage.removeItem('leadpartner_custom_app_id');
                                  }
                                  window.location.reload();
                              }} className="bg-red-50 text-red-600 px-6 py-2.5 rounded-xl font-bold hover:bg-red-100 transition-colors h-[42px] border border-red-100 w-full md:w-auto shrink-0">
                                  Recharger les données
                              </button>
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 mt-3 bg-slate-50 p-2 rounded-lg inline-block">ID Actuel utilisé par ce document : <span className="font-mono text-[#01189B] select-all">{getAppId()}</span></p>
                      </div>
                  </div>
              )}

              {settingsActiveTab === 'diagnostic' && (
                  <div className="space-y-8 animate-fade-in">
                      <div>
                          <h3 className="font-extrabold text-xl mb-6 font-poppins border-b border-slate-100 pb-4 text-slate-800 flex items-center gap-2"><Activity size={22} className="text-orange-500"/> Diagnostic Système</h3>
                          <p className="text-sm text-slate-500 mb-6">Utilisez ces informations pour identifier les problèmes de connexion à la base de données ou transmettre ces infos au support technique.</p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">ID Utilisateur (UID Firebase)</p>
                                  <p className="font-mono text-sm font-bold text-slate-800 break-all">{user?.uid || 'Non connecté'}</p>
                              </div>
                              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">ID Application (App ID cible)</p>
                                  <p className="font-mono text-sm font-bold text-slate-800 break-all">{getAppId()}</p>
                              </div>
                              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Stockage Local (Forçage ID)</p>
                                  <p className="font-mono text-sm font-bold text-slate-800 break-all">{localStorage.getItem('leadpartner_custom_app_id') || 'Aucun forçage (Défaut utilisé)'}</p>
                              </div>
                              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">État Firebase & Firestore</p>
                                  <p className="font-mono text-sm font-bold text-slate-800">{db ? 'Initialisé ✅' : 'Erreur ❌'}</p>
                              </div>
                              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 md:col-span-2">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Données actuellement chargées en mémoire</p>
                                  <div className="flex flex-wrap gap-4 mt-3">
                                      <span className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold shadow-sm">Contacts : <span className="text-[#01189B]">{contacts.length}</span></span>
                                      <span className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold shadow-sm">Factures : <span className="text-[#01189B]">{invoices.length}</span></span>
                                      <span className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold shadow-sm">Simulations : <span className="text-[#01189B]">{simulations.length}</span></span>
                                      <span className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold shadow-sm">Produits : <span className="text-[#01189B]">{products.length}</span></span>
                                  </div>
                              </div>
                              <div className="p-5 bg-blue-50 rounded-2xl border border-blue-200 md:col-span-2">
                                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">Chemins de base de données testés</p>
                                  <ul className="font-mono text-[11px] text-blue-800 space-y-2 list-decimal pl-5">
                                      <li>artifacts/{getAppId()}/users/{user?.uid || '{uid}'}</li>
                                      <li>artifacts/{getAppId()}/public/data</li>
                                      <li>{getAppId()}/users/{user?.uid || '{uid}'}</li>
                                  </ul>
                              </div>
                          </div>
                      </div>
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
      
      {isDarkMode && (
        <style dangerouslySetInnerHTML={{__html: `
          html { 
            background-color: #111827; 
            filter: invert(0.93) hue-rotate(180deg) brightness(1.05) contrast(1.02); 
          }
          img, video, iframe, .no-invert { 
            filter: invert(0.93) hue-rotate(180deg) brightness(1.05) contrast(1.02); 
          }
          /* Correction des fonds gris pour un rendu sombre élégant */
          body, .bg-\\[\\#F8FAFC\\], .bg-slate-50\\/50, .bg-slate-50 { 
            background-color: #ffffff !important; 
          }
          .border-slate-100, .border-slate-200 {
            border-color: #f1f5f9 !important;
          }
        `}} />
      )}
      
      <aside className="w-72 bg-white flex flex-col no-print shrink-0 border-r border-slate-200 relative z-20">
        <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: BRAND_COLOR }}></div>
        <div className="p-8">
          <div className="flex items-center gap-4 mb-12 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => {setActiveView('dashboard'); setSelectedContactId(null); setSelectedCompanyName(null); setIsEditingCompany(false);}}>
             <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-50 text-[#01189B] font-black text-2xl shadow-inner border-2 border-blue-100">
                LP
             </div>
             <div className="overflow-hidden">
                <span className="font-extrabold text-xl font-poppins tracking-wide block leading-tight truncate" style={{ color: BRAND_COLOR }}>{settings.companyName}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CRM Cloud v{APP_VERSION}</span>
             </div>
          </div>
          <nav className="space-y-2">
            {[
              { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
              { id: 'contacts', label: 'CRM', icon: Users },
              { id: 'prospection', label: 'Prospection', icon: Mail },
              { id: 'deliveries', label: 'Suivi Livraisons', icon: Activity },
              { id: 'calendar', label: 'Campagnes', icon: Target },
              { id: 'ponderation', label: 'Pondération', icon: PieChart },
              { id: 'invoices', label: 'Facturation', icon: FileText },
              { id: 'products', label: 'Catalogue Offres', icon: Package },
              { id: 'projections', label: 'Production Média', icon: Calculator },
              { id: 'lmc', label: 'Simulateur LMC', icon: Wand2 },
              { id: 'settings', label: 'Paramètres Agence', icon: Settings },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveView(item.id); setSelectedContactId(null); setSelectedCompanyName(null); }}
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
        <div className="mt-auto p-8 border-t border-slate-50">
          <button onClick={() => setIsSecretMode(!isSecretMode)} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 text-[10px] font-bold uppercase tracking-widest transition-colors">
            {isSecretMode ? <EyeOff size={16}/> : <Eye size={16}/>} {isSecretMode ? 'Données Masquées' : 'Mode Secret'}
          </button>
          <button onClick={() => { signOut(auth); window.location.reload(); }} className="flex items-center gap-2 mt-4 text-red-400 hover:text-red-600 text-[10px] font-bold uppercase tracking-widest transition-colors w-full">
            <LogOut size={16}/> Déconnexion
          </button>
          <p className="text-[10px] text-slate-300 font-bold uppercase mt-4">Version {APP_VERSION}</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-10 no-print shrink-0 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] z-10">
          <div className="flex items-center gap-4 text-slate-400 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 focus-within:border-[#01189B] focus-within:bg-white transition-colors w-96">
            <Search size={18} className={searchTerm ? 'text-[#01189B]' : ''} />
            <input type="text" placeholder="Rechercher (Client, Email...)" className="bg-transparent outline-none text-sm font-medium text-slate-800 w-full placeholder:text-slate-400" value={searchTerm} onChange={(e) => {
                setSearchTerm(e.target.value);
                if (e.target.value && activeView !== 'contacts') {
                    setActiveView('contacts');
                    setContactFilterType('all');
                    setSelectedContactId(null);
                    setSelectedCompanyName(null);
                }
            }} />
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
             
             {/* Bouton Mode Sombre */}
             <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 text-slate-400 hover:text-indigo-500 transition-colors" title={isDarkMode ? "Passer en mode clair" : "Passer en mode sombre"}>
                {isDarkMode ? <Sun size={24}/> : <Moon size={24}/>}
             </button>

             <button onClick={() => setActiveView('settings')} className="p-2.5 text-slate-400 hover:text-[#01189B] transition-colors"><Settings size={24}/></button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-10 relative">
          {selectedContactId ? renderContactDetail() : selectedCompanyName ? renderCompanyDetail() : (
            <>
              {activeView === 'dashboard' && renderDashboard()}
              {activeView === 'prospection' && renderProspection()}
              {activeView === 'deliveries' && renderDeliveries()}
              {activeView === 'calendar' && (
                  <div className="max-w-6xl mx-auto animate-fade-in space-y-8 pb-12">
                      <div className="flex justify-between items-center mb-2">
                        <h2 className={UI_CLASSES.title}>
                          <Target size={32} style={{ color: BRAND_COLOR }}/> Campagnes
                        </h2>
                      </div>
                      <p className="text-slate-500 text-lg mb-8">Vue d'ensemble graphique de l'avancement de vos productions média en cours.</p>

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
                            const duration = sim.duration || 30;
                            const start = new Date(sim.createdAt);
                            const diffDays = Math.max(0, Math.floor((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                            const day = Math.min(diffDays, duration);
                            const daysPercent = (day / duration) * 100;
                            
                            const targetLeads = sim.stats?.volumeTotal || 0;
                            let expectedLeads = 0;
                            if (sim.dataSource === 'deliveries') {
                                const matchName = sim.deliveryMatchName !== undefined ? sim.deliveryMatchName : sim.clientName;
                                expectedLeads = deliveries.filter((d:any) => d.agentName === matchName).length + Number(sim.manualLeadsOffset || 0);
                            } else if (sim.dataSource === 'manual') {
                                expectedLeads = Number(sim.manualLeads || 0);
                            } else {
                                expectedLeads = Math.min(Math.floor((targetLeads / duration) * day), targetLeads); 
                            }
                            const leadsPercent = targetLeads > 0 ? (expectedLeads / targetLeads) * 100 : 0;
                            const isFinished = day >= duration;
                            
                            return (
                              <div key={sim.id} className={`bg-white rounded-2xl border-2 shadow-sm p-6 relative hover:shadow-lg transition-all ${isFinished ? 'border-red-200' : 'border-slate-100 hover:border-[#01189B]'}`}>
                                <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                                  <div>
                                    <h4 className="font-extrabold text-slate-800 font-poppins text-lg">{sim.clientName || 'Client Inconnu'}</h4>
                                    <p className="text-sm font-bold mt-1" style={{ color: BRAND_COLOR }}>{sim.productName}</p>
                                  </div>
                                  <div className="flex gap-2">
                                     <button onClick={() => { setCurrentSimulation(sim); setShowModal('simulation'); }} className="p-1.5 text-slate-400 hover:text-[#01189B] bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={16} /></button>
                                     {isFinished && <span className="bg-red-100 text-red-700 text-[10px] font-extrabold px-3 py-1.5 rounded-full animate-pulse uppercase tracking-widest shrink-0">Renouveler</span>}
                                  </div>
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
                                      <span className="text-slate-700 font-mono text-sm">{day} <span className="text-[10px] text-slate-400">/ {duration} jours</span></span>
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

              {activeView === 'ponderation' && (() => {
                  const loadScriptConfig = (id: string) => {
                      if (!id) {
                          setCurrentScriptId(null); setScriptName(''); setScriptProductId(''); setManualWeights([]); 
                          setEnablePacing(true);
                          setScriptGlobalSheetId(''); setScriptGlobalTabName('Distribution'); setScriptPhoneColIndex(6);
                          return;
                      }
                      const conf = (settings.distributionScripts || []).find((s:any) => s.id === id);
                      if (conf) {
                          setCurrentScriptId(conf.id); setScriptName(conf.name); setScriptProductId(conf.productId || ''); setManualWeights(conf.manuals || []);
                          setEnablePacing(conf.enablePacing !== false);
                          setScriptGlobalSheetId(conf.sheetId || ''); setScriptGlobalTabName(conf.tabName || 'Distribution'); setScriptPhoneColIndex(conf.phoneCol || 6);
                      }
                  };

                  const saveScriptConfig = () => {
                      if (!scriptName) return addNotification('error', 'Veuillez donner un nom à cette configuration.');
                      const newConf = { id: currentScriptId || Math.random().toString(36).substr(2, 9), name: scriptName, productId: scriptProductId, manuals: manualWeights, enablePacing, sheetId: scriptGlobalSheetId, tabName: scriptGlobalTabName, phoneCol: scriptPhoneColIndex };
                      let list = [...(settings.distributionScripts || [])];
                      if (currentScriptId) list = list.map(s => s.id === currentScriptId ? newConf : s);
                      else list.push(newConf);
                      handleSaveSettingsDirect({ distributionScripts: list });
                      setCurrentScriptId(newConf.id);
                      addNotification('success', 'Configuration sauvegardée !');
                  };
                  
                  const deleteScriptConfig = () => {
                      if (!currentScriptId) return;
                      openConfirm('Supprimer cette configuration ?', 'Cette action est irréversible.', () => {
                          const list = (settings.distributionScripts || []).filter((s:any) => s.id !== currentScriptId);
                          handleSaveSettingsDirect({ distributionScripts: list });
                          loadScriptConfig('');
                      });
                  };

                  const handleAddManualWeight = () => {
                      const inputValue = manualWeightClient.trim();
                      if (!inputValue) return addNotification('error', 'Veuillez saisir le nom d\'un client.');
                      if(manualWeightParts <= 0) return addNotification('error', 'Veuillez définir un nombre de leads supérieur à 0.');
                      
                      setManualWeights([...manualWeights, {
                          id: Math.random().toString(36).substr(2,9),
                          clientId: inputValue,
                          name: inputValue,
                          parts: manualWeightParts,
                          maxDaily: manualWeightMaxDaily,
                          maxTotal: manualWeightMaxTotal,
                          residentOnly: manualWeightResidentOnly,
                          sheetId: manualWeightSheetId
                      }]);
                      addNotification('success', 'Client ajouté au calcul !');
                      setManualWeightClient(''); 
                      setManualWeightMaxDaily(''); 
                      setManualWeightMaxTotal('');
                      setManualWeightResidentOnly(false);
                      setManualWeightSheetId('');
                      setManualWeightParts(1);
                  };

                  // --- CALCUL DE LA PONDÉRATION (Nombre de leads direct) ---
                  let cycleData = manualWeights.map(mw => ({ ...mw, parts: Number(mw.parts || 1) }));
                  let totalCycleParts = cycleData.reduce((acc, mw) => acc + mw.parts, 0);
                  
                  // Lissage par entrelacement (Weighted Round Robin) pour éviter qu'un client reçoive tout d'un coup
                  let sequence: string[] = [];
                  if (enablePacing && totalCycleParts > 0 && totalCycleParts <= 1000) {
                      let items = cycleData.map(c => ({ name: c.name, weight: c.parts, current: 0 })).filter(c => c.weight > 0);
                      for (let i = 0; i < totalCycleParts; i++) {
                          let maxItem = null;
                          let maxVal = -Infinity;
                          for (let item of items) {
                              item.current += item.weight;
                              if (item.current > maxVal) {
                                  maxVal = item.current;
                                  maxItem = item;
                              }
                          }
                          if (maxItem) {
                              maxItem.current -= totalCycleParts;
                              sequence.push(maxItem.name);
                          }
                      }
                  } else {
                      // Sans lissage, on les ajoute simplement à la suite
                      cycleData.forEach(c => {
                          for(let i=0; i<c.parts; i++) sequence.push(c.name);
                      });
                  }

                  const scriptContent = `/**
 * Redistribution automatique des leads (Séquence Lissée)
 * Généré par LeadPartner CRM
 */
function redistributeLeads() {
  const FILE_ID = "${scriptGlobalSheetId || "ID_FICHIER_SOURCE"}";
  const SOURCE_SHEET_NAME = "${scriptGlobalTabName || "Distribution"}";
  const START_ROW = 2;
  const PHONE_INDEX_IN_LEAD = ${Math.max(0, scriptPhoneColIndex - 1)}; // Index 0-based

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.openById(FILE_ID);
    const feuille = ss.getSheetByName(SOURCE_SHEET_NAME);
    if (!feuille) throw new Error('Onglet "Distribution" introuvable.');

    // === CONFIG AGENTS ===
    const agentsMap = {
${manualWeights.map(mw => `      "${mw.name}": { name: "${mw.name}", fileId: "${mw.sheetId || 'ID_FICHIER_CIBLE'}", sheetName: "Feuille 1", residentOnly: ${mw.residentOnly ? 'true' : 'false'}, maxLeads: ${mw.maxTotal || 'null'} }`).join(',\n')}
    };

    // === CYCLE LISSÉ ===
    const cycleNames = ${JSON.stringify(sequence)};
    const cycle = cycleNames.map(name => agentsMap[name]).filter(Boolean);

    if (cycle.length === 0) throw new Error("Cycle vide.");

    const props = PropertiesService.getScriptProperties();
    let currentIndex = parseInt(props.getProperty("currentAgentIndex") || "0", 10);
    if (isNaN(currentIndex) || currentIndex >= cycle.length) currentIndex = 0;

    let pending = JSON.parse(props.getProperty("pendingDebts") || "{}");
    let leadsCount = JSON.parse(props.getProperty("leadsCount") || "{}");

    const lastRow = feuille.getLastRow();
    if (lastRow < START_ROW) return;

    const nbRows = lastRow - START_ROW + 1;
    const data = feuille.getRange(START_ROW, 1, nbRows, 7).getValues();
    const status = feuille.getRange(START_ROW, 8, nbRows, 1).getValues();

    let leadsEnvoyes = 0;

    for (let i = 0; i < nbRows; i++) {
      if ((status[i][0] || "").toString().trim() !== "") continue;

      const rowIndex = START_ROW + i;
      const lead = data[i];

      const phoneRaw = (lead[PHONE_INDEX_IN_LEAD] || "").toString();
      const phoneNorm = normalizePhone(phoneRaw);
      const isPlus41 = phoneNorm.startsWith("+41");

      // 1. PRIORITÉ : Rattrapage des dettes (Resident Only)
      let rattrapageFait = false;
      if (isPlus41) {
        for (let agentName in pending) {
          if (pending[agentName] > 0) {
            const agent = agentsMap[agentName];
            if (!agent) continue;
            if (agent.maxLeads && (leadsCount[agent.name] || 0) >= agent.maxLeads) continue;

            if (envoyerLead(agent, lead)) {
              feuille.getRange(rowIndex, 8).setValue(agent.name);
              feuille.getRange(rowIndex, 10).setValue(\`CYCLE | RATTRAPAGE (reste \${pending[agentName] - 1}) | \${agent.name}\`);
              pending[agentName]--;
              leadsCount[agent.name] = (leadsCount[agent.name] || 0) + 1;
              leadsEnvoyes++;
              rattrapageFait = true;
              break;
            }
          }
        }
      }
      if (rattrapageFait) continue;

      // 2. Assignation normale
      let tries = 0;
      let assigned = false;
      let deferredLogs = [];

      while (tries < cycle.length && !assigned) {
        const agent = cycle[currentIndex];
        const usedIndexForThisLead = currentIndex;

        // Arbitrage: Quota max atteint ?
        if (agent.maxLeads && (leadsCount[agent.name] || 0) >= agent.maxLeads) {
            currentIndex = (currentIndex + 1) % cycle.length;
            tries++;
            continue;
        }

        // Arbitrage: Résident uniquement ?
        if (agent.residentOnly && !isPlus41) {
          pending[agent.name] = (pending[agent.name] || 0) + 1;
          deferredLogs.push(agent.name);
          currentIndex = (currentIndex + 1) % cycle.length;
          tries++;
          continue;
        }

        if (envoyerLead(agent, lead)) {
          feuille.getRange(rowIndex, 8).setValue(agent.name);
          let log = \`CYCLE | \${usedIndexForThisLead + 1}/\${cycle.length} | \${agent.name}\`;
          if (deferredLogs.length > 0) {
            log += \` | ATTENTE: \${deferredLogs.join(',')}\`;
          }
          feuille.getRange(rowIndex, 10).setValue(log);

          leadsCount[agent.name] = (leadsCount[agent.name] || 0) + 1;
          leadsEnvoyes++;
          currentIndex = (currentIndex + 1) % cycle.length;
          assigned = true;
        } else {
          currentIndex = (currentIndex + 1) % cycle.length;
          tries++;
        }
      }
    }

    props.setProperty("currentAgentIndex", String(currentIndex));
    props.setProperty("pendingDebts", JSON.stringify(pending));
    props.setProperty("leadsCount", JSON.stringify(leadsCount));

  } catch (e) {
    Logger.log("Erreur : " + e.message);
  } finally {
    lock.releaseLock();
  }
}

function normalizePhone(phoneStr) {
  return (phoneStr || "").toString().trim().toLowerCase().replace(/\\s+/g, "").replace(/^p:/, "").replace(/^phone:/, "");
}

function envoyerLead(agent, ligne) {
  try {
    const fichier = SpreadsheetApp.openById(agent.fileId);
    const feuilleAgent = fichier.getSheetByName(agent.sheetName) || fichier.getSheets()[0];
    if (!feuilleAgent) throw new Error("Feuille introuvable");
    feuilleAgent.appendRow(ligne);
    return true;
  } catch (e) {
    Logger.log("Erreur envoi " + agent.name + " : " + e.message);
    return false;
  }
}`;

                  return (
                      <div className="max-w-6xl mx-auto animate-fade-in space-y-8 pb-12">
                          <div className="flex justify-between items-center mb-2">
                              <div>
                                  <h2 className={UI_CLASSES.title}><PieChart size={32} style={{ color: BRAND_COLOR }}/> Pondération des Leads</h2>
                                  <p className="text-slate-500 text-lg">Créez vos cycles de distribution proportionnels au budget alloué par chaque client.</p>
                              </div>
                          </div>

                          <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                              <div className="p-6">
                                  <div className="mb-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                                      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 pb-4 border-b border-slate-200">
                                          <div className="flex items-center gap-3 w-full md:w-auto">
                                              <select value={currentScriptId || ''} onChange={e => loadScriptConfig(e.target.value)} className="w-full md:w-64 border-2 border-slate-200 p-2 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-[#01189B]">
                                                  <option value="">-- Nouvelle configuration --</option>
                                                  {(settings.distributionScripts || []).map((s:any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                              </select>
                                              {currentScriptId && <button onClick={deleteScriptConfig} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors shrink-0" title="Supprimer"><Trash2 size={16}/></button>}
                                          </div>
                                          <div className="flex items-center gap-3 w-full md:w-auto">
                                              <input type="text" placeholder="Nom de la campagne (ex: 3P Meta)..." value={scriptName} onChange={e => setScriptName(e.target.value)} className="w-full md:w-auto border-2 border-slate-200 p-2 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-[#01189B]" />
                                              <button onClick={saveScriptConfig} className="bg-[#01189B] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 hover:bg-blue-800 transition-colors shrink-0"><Save size={16}/> {currentScriptId ? 'Mettre à jour' : 'Sauvegarder'}</button>
                                          </div>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div>
                                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Thématique / Produit</label>
                                              <select value={scriptProductId} onChange={e => setScriptProductId(e.target.value)} className="w-full border border-slate-200 p-2 rounded-lg text-xs outline-none focus:border-[#01189B] font-bold text-[#01189B]">
                                                  <option value="">-- Non définie --</option>
                                                  {products.map((p:any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                              </select>
                                          </div>
                                          <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col justify-center">
                                              <div className="flex items-center justify-between mb-2">
                                                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 cursor-pointer" onClick={() => setEnablePacing(!enablePacing)}><Activity size={14} className={enablePacing ? "text-[#01189B]" : "text-slate-400"}/> Lead Pacing (Lissage de la distribution)</label>
                                                  <input type="checkbox" checked={enablePacing} onChange={e => setEnablePacing(e.target.checked)} className="w-4 h-4 text-[#01189B] cursor-pointer" />
                                              </div>
                                              <p className="text-[10px] text-slate-400 font-medium">Répartit les leads de manière alternée pour éviter les envois groupés consécutifs.</p>
                                          </div>
                                      </div>

                                      <h4 className="font-bold text-slate-800 mb-3 text-sm flex items-center gap-2 mt-4 pt-4 border-t border-slate-200"><Settings size={16} className="text-[#01189B]"/> Configuration du Fichier Source (GSheet)</h4>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                          <div>
                                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ID GSheet Source</label>
                                              <input type="text" value={scriptGlobalSheetId} onChange={e => setScriptGlobalSheetId(e.target.value)} className="w-full border border-slate-200 p-2 rounded-lg text-xs outline-none focus:border-[#01189B]" placeholder="Ex: 1J00eOFuCVqiykfK5TeR3qBNZG..." />
                                          </div>
                                          <div>
                                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nom de l'onglet</label>
                                              <input type="text" value={scriptGlobalTabName} onChange={e => setScriptGlobalTabName(e.target.value)} className="w-full border border-slate-200 p-2 rounded-lg text-xs outline-none focus:border-[#01189B]" placeholder="Ex: Distribution" />
                                          </div>
                                          <div>
                                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Col. Téléphone</label>
                                              <div className="flex items-center gap-2">
                                                  <input type="number" min="1" value={scriptPhoneColIndex} onChange={e => setScriptPhoneColIndex(Number(e.target.value))} className="w-full border border-slate-200 p-2 rounded-lg text-xs outline-none focus:border-[#01189B]" />
                                                  <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">A=1, F=6</span>
                                              </div>
                                          </div>
                                      </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                      <div className="md:col-span-1 space-y-4">
                                          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                              <h4 className="font-bold text-[#01189B] text-sm mb-3">Ajouter un Client</h4>
                                              <div className="space-y-3">
                                                  <input 
                                                      type="text"
                                                      value={manualWeightClient} 
                                                      onChange={e => {
                                                          const val = e.target.value;
                                                          setManualWeightClient(val);
                                                          const c = contacts.find(co => co.company === val || co.name === val);
                                                          if (c && c.googleSheetId) setManualWeightSheetId(c.googleSheetId);
                                                      }} 
                                                      list="calc-clients-list"
                                                      className="w-full border border-slate-200 p-2 rounded-lg text-xs font-bold outline-none focus:border-[#01189B]"
                                                      placeholder="Écrire un nom ou sélectionner..."
                                                  />
                                                  <datalist id="calc-clients-list">
                                                      {contacts.map(c => <option key={c.id} value={c.company || c.name} />)}
                                                  </datalist>
                                                  <div>
                                                      <label className="text-[10px] font-bold text-slate-500 uppercase">ID GSheet de réception</label>
                                                      <input type="text" value={manualWeightSheetId} onChange={e => setManualWeightSheetId(e.target.value)} className="w-full border border-slate-200 p-2 rounded-lg text-xs font-mono outline-none mt-1" placeholder="ID du GSheet Client" />
                                                  </div>
                                                  <div className="grid grid-cols-2 gap-2">
                                                      <div>
                                                          <label className="text-[10px] font-bold text-slate-500 uppercase">Nombre de leads</label>
                                                          <input type="number" min="1" value={manualWeightParts} onChange={e => setManualWeightParts(Number(e.target.value))} className="w-full border border-slate-200 p-2 rounded-lg text-xs font-mono outline-none mt-1 focus:border-[#01189B]" />
                                                      </div>
                                                      <div>
                                                          <label className="text-[10px] font-bold text-slate-500 uppercase flex justify-between"><span>Max Leads</span><span className="text-slate-300 font-medium">Opt.</span></label>
                                                          <input type="number" placeholder="Illimité" value={manualWeightMaxTotal} onChange={e => setManualWeightMaxTotal(e.target.value ? Number(e.target.value) : '')} className="w-full border border-slate-200 p-2 rounded-lg text-xs font-mono outline-none mt-1 focus:border-[#01189B]" />
                                                      </div>
                                                  </div>
                                                  <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-xl border border-slate-200 hover:border-[#01189B] transition-colors mt-1 shadow-sm">
                                                      <input type="checkbox" checked={manualWeightResidentOnly} onChange={e => setManualWeightResidentOnly(e.target.checked)} className="w-4 h-4 text-[#01189B]" />
                                                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Globe size={14} className="text-[#01189B]"/> Uniquement Résident (+41)</span>
                                                  </label>
                                                  <button onClick={handleAddManualWeight} className="w-full bg-[#01189B] text-white text-xs font-bold py-2.5 rounded-lg hover:bg-blue-800 transition-colors shadow-sm flex justify-center items-center gap-1.5 mt-2"><Plus size={14}/> Intégrer au calcul</button>
                                              </div>
                                          </div>
                                      </div>

                                      <div className="md:col-span-2 flex flex-col h-full">
                                           <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                                              <h4 className="font-bold text-slate-800 flex items-center gap-2"><PieChart size={18} className="text-orange-500"/> Distribution du Cycle</h4>
                                              <div className="text-right">
                                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Taille du Cycle : <span className="text-[#01189B] font-extrabold text-sm">{totalCycleParts} leads</span></p>
                                              </div>
                                           </div>
                                           
                                           {/* NOUVEAU BLOC : APERÇU DU CYCLE ET LISSAGE */}
                                           {cycleData.length > 0 && (
                                               <div className="mb-4 p-5 bg-blue-50/80 border border-blue-200 rounded-2xl shadow-sm">
                                                   <h5 className="font-extrabold text-[#01189B] text-sm mb-3 flex items-center gap-2"><Users size={16}/> Aperçu des parts ({totalCycleParts} leads par boucle)</h5>
                                                   <div className="flex flex-wrap gap-2.5 mb-4 pb-4 border-b border-blue-200/50">
                                                       {cycleData.map((mw, idx) => (
                                                           <span key={idx} className="bg-white px-4 py-2 rounded-xl border border-blue-200 text-sm font-bold text-slate-700 shadow-sm flex items-center gap-2">
                                                               {mw.name} : <span className="text-[#01189B] font-extrabold bg-blue-50 px-2 py-0.5 rounded-lg">{mw.parts} part(s)</span>
                                                           </span>
                                                       ))}
                                                   </div>
                                                   
                                                   <h5 className="font-extrabold text-indigo-700 text-sm mb-3 flex items-center gap-2"><Zap size={16}/> Séquence Entrelacée (Ordre de distribution)</h5>
                                                   <div className="max-h-64 overflow-y-auto custom-scrollbar border border-indigo-200/60 rounded-xl bg-white shadow-inner">
                                                       <table className="w-full text-left text-sm">
                                                           <thead className="bg-indigo-50 text-indigo-800 text-[10px] uppercase font-extrabold tracking-widest sticky top-0 z-10 shadow-sm">
                                                               <tr>
                                                                   <th className="px-4 py-3 border-r border-indigo-100">Ordre</th>
                                                                   <th className="px-4 py-3">Client Bénéficiaire</th>
                                                                   <th className="px-4 py-3 text-right">Progression Client</th>
                                                               </tr>
                                                           </thead>
                                                           <tbody className="divide-y divide-indigo-50">
                                                               {(() => {
                                                                   let counts: any = {};
                                                                   return sequence.map((name, idx) => {
                                                                       counts[name] = (counts[name] || 0) + 1;
                                                                       const totalForClient = cycleData.find(c => c.name === name)?.parts || 0;
                                                                       return (
                                                                           <tr key={idx} className="hover:bg-indigo-50/50 transition-colors">
                                                                               <td className="px-4 py-2.5 font-mono text-indigo-400 text-xs font-bold border-r border-indigo-50 w-24">Lead #{idx + 1}</td>
                                                                               <td className="px-4 py-2.5 font-bold text-indigo-900 text-xs flex items-center gap-2"><Users size={12} className="text-indigo-300"/> {name}</td>
                                                                               <td className="px-4 py-2.5 text-right w-40">
                                                                                   <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50/80 px-2 py-1 rounded border border-indigo-100">
                                                                                       {counts[name]} / {totalForClient} lead(s)
                                                                                   </span>
                                                                               </td>
                                                                           </tr>
                                                                       );
                                                                   });
                                                               })()}
                                                           </tbody>
                                                       </table>
                                                   </div>
                                                   <div className="flex items-center justify-between mt-3">
                                                       <p className="text-[10px] text-indigo-500 font-medium flex items-start gap-1.5 leading-tight"><Info size={12} className="shrink-0 mt-0.5"/> Cet algorithme garantit un pacing équitable et empêche la réception groupée.</p>
                                                       <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-white px-2 py-1 rounded-md shadow-sm border border-indigo-100">Fin de boucle ↻</span>
                                                   </div>
                                               </div>
                                           )}
                                           
                                           <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                                              {cycleData.map((mw, idx) => {
                                                  return (
                                                      <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group hover:border-[#01189B] transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                          <button onClick={() => setManualWeights(manualWeights.filter(m => m.id !== mw.id))} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 p-1.5 rounded-md"><Trash2 size={14}/></button>
                                                          
                                                          <div className="flex-1">
                                                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                  <span className="font-bold text-slate-800 text-sm truncate">{mw.name}</span>
                                                                  {mw.residentOnly && <span className="bg-red-100 text-red-700 text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-widest flex items-center gap-1"><Globe size={10}/> +41 Only</span>}
                                                                  {mw.maxTotal ? <span className="bg-orange-100 text-orange-700 text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-widest flex items-center gap-1"><Target size={10}/> Max {mw.maxTotal}</span> : null}
                                                              </div>
                                                          </div>
                                                          
                                                          <div className="flex gap-6 items-center w-full md:w-auto mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                                                              <div className="text-center min-w-[60px]">
                                                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Part du Cycle</p>
                                                                  <span className="text-blue-600 font-extrabold bg-blue-50 px-3 py-1.5 rounded-md text-sm">{mw.parts} leads</span>
                                                              </div>
                                                          </div>
                                                      </div>
                                                  )
                                              })}
                                              {cycleData.length === 0 && (
                                                  <div className="text-center p-8 bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-sm font-medium">Aucun client ajouté au calcul.</div>
                                              )}
                                          </div>
                                      </div>

                                      <div className="md:col-span-3 mt-8 border-t border-slate-100 pt-8 animate-fade-in">
                                          <div className="flex justify-between items-center mb-4">
                                              <div>
                                                  <h4 className="font-extrabold text-slate-800 flex items-center gap-2 text-lg"><FileText size={20} className="text-[#01189B]"/> Script de Distribution Automatique (Apps Script)</h4>
                                                  <p className="text-sm text-slate-500 mt-1">Copiez ce code généré sur-mesure et collez-le dans <b>Extensions {'>'} Apps Script</b> sur votre Google Sheet principal.</p>
                                              </div>
                                              <button onClick={() => { navigator.clipboard.writeText(scriptContent); addNotification('success', 'Script copié dans le presse-papier !'); }} className="text-sm font-bold text-white bg-[#01189B] hover:bg-blue-800 px-5 py-2.5 rounded-xl transition-colors shadow-sm flex items-center gap-2"><Copy size={16}/> Copier le script</button>
                                          </div>
                                          <textarea 
                                              readOnly 
                                              value={scriptContent} 
                                              className="w-full min-h-[400px] bg-[#1e293b] text-blue-300 font-mono text-[11px] leading-relaxed p-6 rounded-2xl outline-none resize-none custom-scrollbar border-4 border-slate-800"
                                          />
                                      </div>

                                  </div>
                              </div>
                          </div>
                      </div>
                  );
              })()}
              {activeView === 'settings' && renderSettings()}
              {activeView === 'projections' && renderProjections()}
              {activeView === 'lmc' && renderLMC()}
              {activeView === 'products' && (
                <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className={UI_CLASSES.title}><Package style={{ color: BRAND_COLOR }} size={32}/> Catalogue des Offres</h2>
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
                    <h2 className={UI_CLASSES.title}><FileText style={{ color: BRAND_COLOR }} size={32}/> Facturation</h2>
                    <div className="flex gap-3">
                        <button onClick={() => setShowImportModal('invoices')} className="bg-slate-100 text-slate-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-200 transition-all"><Upload size={18} /> Importer (CSV)</button>
                        <button onClick={() => { 
                          const nextId = generateNextInvoiceId();
                          setCurrentInvoice({ id: nextId, clientId: '', clientName: '', date: new Date().toISOString(), items: [], status: 'brouillon' }); 
                          setShowModal('invoice'); 
                        }} className={UI_CLASSES.btnPrimary} style={{ backgroundColor: BRAND_COLOR }}>
                          <Plus size={18} /> Créer une Facture
                        </button>
                    </div>
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
                          {[...invoices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((inv) => (
                            <tr key={inv.id} className="hover:bg-blue-50/30 transition-colors group cursor-pointer" onClick={() => { setCurrentInvoice(inv); setShowModal('invoice'); }}>
                              <td className="px-8 py-5 font-bold text-slate-600 font-mono text-xs">{inv.id}</td>
                              <td className="px-8 py-5 font-extrabold text-slate-800 font-poppins">{renderName(inv.clientName)}</td>
                              <td className="px-8 py-5 font-medium text-slate-500">{formatDate(inv.date)}</td>
                              <td className="px-8 py-5 font-extrabold font-mono text-lg text-slate-800">{renderCurrency(inv.amount)}</td>
                              <td className="px-8 py-5" onClick={(e) => e.stopPropagation()}>
                                <select 
                                    value={inv.status} 
                                    onChange={(e) => handleInvoiceStatusChange(inv, e.target.value)}
                                    className={`px-2 py-1.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide border outline-none cursor-pointer ${INVOICE_STATUSES[inv.status]?.color || 'bg-slate-100 text-slate-600'}`}
                                >
                                    {Object.entries(INVOICE_STATUSES).map(([k,v]: any) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                              </td>
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
                <div className="flex flex-col h-full animate-fade-in pb-8 max-w-7xl mx-auto w-full">
                  <div className="flex justify-between items-center mb-8">
                     <h2 className={UI_CLASSES.title}><Users style={{ color: BRAND_COLOR }} size={32}/> Portefeuille Clients</h2>
                     <div className="flex gap-3">
                         <button onClick={() => setShowModal('bulkIds')} className="bg-white text-slate-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-50 border border-slate-200 shadow-sm transition-all"><Search size={18} /> Liste des IDs</button>
                         <button onClick={() => { 
                             setBulkContacts([{ company: '', name: '', email: '', phone: '', manualCA: '', manualBenefice: '' }, { company: '', name: '', email: '', phone: '', manualCA: '', manualBenefice: '' }, { company: '', name: '', email: '', phone: '', manualCA: '', manualBenefice: '' }]);
                             setShowModal('bulkContact'); 
                         }} className="bg-white text-[#01189B] px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-50 border border-blue-200 shadow-sm transition-all"><Users size={18} /> Ajout Rapide (Bulk)</button>
                         <button onClick={() => { setShowModal('contact'); setNewContactSource(''); }} className={UI_CLASSES.btnPrimary} style={{ backgroundColor: BRAND_COLOR }}><Plus size={18} /> Nouvelle Société</button>
                     </div>
                  </div>
                  
                  <div className="flex gap-3 mb-6 border-b border-slate-200 pb-4">
                     <button onClick={() => setContactFilterType('all')} className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all ${contactFilterType === 'all' ? 'bg-[#01189B] text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Toutes les sociétés</button>
                     <button onClick={() => setContactFilterType('client')} className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all ${contactFilterType === 'client' ? 'bg-[#01189B] text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Client</button>
                     <button onClick={() => setContactFilterType('prospect')} className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all ${contactFilterType === 'prospect' ? 'bg-[#01189B] text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Prospects</button>
                  </div>

                  <div className="flex-1 overflow-auto custom-scrollbar pb-10">
                     {displayedContacts.length === 0 ? (
                         <div className="p-20 text-center text-slate-400 font-medium">Aucune entreprise trouvée.</div>
                     ) : (
                         <div className="space-y-3">
                            {Object.entries(
                                displayedContacts.reduce((acc: any, c: any) => {
                                    const comp = c.company || 'Sans Entreprise';
                                    if (!acc[comp]) acc[comp] = [];
                                    acc[comp].push(c);
                                    return acc;
                                }, {})
                            ).map(([companyName, companyContacts]: any) => {
                                // Find highest status or aggregate CA
                                const clientInvoices = invoices.filter(inv => inv.clientName === companyName || companyContacts.some((c:any) => c.id === inv.clientId));
                                const companyNode = companiesData.find((c:any) => c.name === companyName) || {};
                                const caTotal = clientInvoices.filter(i => i.status === 'payee').reduce((a, b) => a + b.amount, 0) + companyContacts.reduce((a:any, b:any) => a + Number(b.manualCA || 0), 0) + Number(companyNode.manualCA || 0);
                                const isClient = companyContacts.some((c:any) => c.type === 'client' || c.status === 'gagne');

                                return (
                                    <div key={companyName} onClick={() => setSelectedCompanyName(companyName)} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-[#01189B] hover:shadow-md cursor-pointer transition-all group flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 w-full md:w-1/3">
                                            <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-extrabold text-xl shadow-inner group-hover:scale-105 transition-transform shrink-0">
                                                {isSecretMode ? '**' : companyName.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="overflow-hidden">
                                                <h3 className="font-extrabold text-slate-800 font-poppins text-base leading-tight truncate" title={companyName}>{renderName(companyName)}</h3>
                                                <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[9px] uppercase font-bold tracking-widest ${isClient ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>{isClient ? 'Client' : 'Prospect'}</span>
                                            </div>
                                        </div>
                                        <div className="text-right w-24 md:w-32 md:border-l md:border-slate-100 md:pl-6">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">CA Encaissé</p>
                                            <p className="text-sm font-extrabold text-[#01189B] font-mono">{renderCurrency(caTotal)}</p>
                                        </div>
                                        <div className="text-slate-300 group-hover:text-[#01189B] transition-colors hidden md:block ml-2">
                                            <ArrowRight size={20} />
                                        </div>
                                    </div>
                                )
                            })}
                         </div>
                     )}
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
                <button onClick={() => setConfirmState((prev: any) => ({ ...prev, isOpen: false }))} className={UI_CLASSES.btnSecondary}>Annuler</button>
                <button onClick={confirmState.onConfirm} className={UI_CLASSES.btnPrimary} style={{ backgroundColor: BRAND_COLOR }}>Confirmer</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[2000] p-4">
          <div className="bg-white p-10 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 animate-fade-in text-center">
            <h3 className="text-2xl font-extrabold mb-4 font-poppins text-slate-800 flex items-center justify-center gap-3"><Upload style={{ color: BRAND_COLOR }} size={24}/> Importer {showImportModal === 'contacts' ? 'des Contacts' : 'des Factures'}</h3>
            <p className="text-slate-500 mb-6 text-sm font-medium">Sélectionnez un fichier CSV structuré selon le modèle d'export.</p>
            
            {showImportModal === 'contacts' && (
                <button onClick={handleExportContactsCSV} className="mb-6 w-full bg-blue-50 text-[#01189B] border border-blue-200 px-4 py-3 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 shadow-sm"><Download size={18}/> Télécharger le modèle (Template) à remplir</button>
            )}

            <input type="file" accept=".csv,.txt" onChange={handleImportCSV} className="mb-6 block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer outline-none border-2 border-slate-100 rounded-xl p-2 bg-slate-50" />
            <button onClick={() => setShowImportModal(null)} className={UI_CLASSES.btnSecondary + " w-full"}>Annuler et fermer</button>
          </div>
        </div>
      )}

      {showModal === 'bulkIds' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-3xl shadow-2xl border border-slate-100 animate-fade-in flex flex-col max-h-[90vh]">
            <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-center shrink-0">
                <div>
                    <h3 className="text-2xl font-extrabold text-slate-800 font-poppins flex items-center gap-3"><Search style={{ color: BRAND_COLOR }} size={28}/> Liste des IDs Clients</h3>
                    <p className="text-slate-500 text-sm mt-2">Récupérez rapidement les IDs de vos clients pour vos configurations ou scripts.</p>
                </div>
                <button onClick={() => setShowModal(null)} className="p-2 text-slate-400 hover:text-[#01189B] bg-slate-50 hover:bg-blue-50 rounded-xl transition-colors"><X size={24}/></button>
            </div>
            
            <div className="flex-1 overflow-auto custom-scrollbar pr-2 mb-4 space-y-2">
                <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 sticky top-0 z-10 shadow-sm">
                    <Search size={16} className="text-slate-400"/>
                    <input type="text" placeholder="Filtrer par nom ou société..." className="bg-transparent outline-none w-full text-sm font-bold text-slate-700" onChange={(e) => setSearchTerm(e.target.value)} value={searchTerm} />
                </div>
                {displayedContacts.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-[#01189B] transition-colors group">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[#01189B] font-bold text-xs shrink-0"><Users size={14}/></div>
                            <div className="truncate">
                                <p className="font-bold text-slate-800 text-sm truncate">{c.company || c.name}</p>
                                <p className="text-[10px] text-slate-500 font-mono truncate">{c.email || c.type}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                            <code className="text-[10px] bg-slate-50 px-2 py-1 rounded text-slate-500 font-mono border border-slate-200 select-all">{c.id}</code>
                            <button onClick={() => { navigator.clipboard.writeText(c.id); addNotification('success', 'ID copié !'); }} className="p-1.5 text-slate-400 hover:text-[#01189B] hover:bg-blue-50 rounded-md transition-colors" title="Copier l'ID"><Copy size={16}/></button>
                        </div>
                    </div>
                ))}
                {displayedContacts.length === 0 && (
                    <div className="text-center py-10 text-slate-400 font-medium">Aucun client trouvé.</div>
                )}
            </div>
            
            <div className="pt-4 border-t border-slate-100 flex justify-end shrink-0">
                <button type="button" onClick={() => setShowModal(null)} className="px-6 py-2.5 text-white rounded-xl font-bold flex items-center gap-2 hover:shadow-lg transition-all" style={{ backgroundColor: BRAND_COLOR }}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {showModal === 'bulkContact' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-6xl shadow-2xl border border-slate-100 animate-fade-in">
            <div className="mb-6 border-b border-slate-100 pb-4">
                <h3 className="text-2xl font-extrabold text-slate-800 font-poppins flex items-center gap-3"><Users style={{ color: BRAND_COLOR }} size={28}/> Ajout Rapide (Tableau)</h3>
                <p className="text-slate-500 text-sm mt-2">Remplissez les lignes ci-dessous. Les lignes vides seront automatiquement ignorées.</p>
            </div>
            <form onSubmit={async (e: any) => {
                e.preventDefault();
                if (!user || isOfflineMode) return addNotification('error', 'Mode hors-ligne.');
                
                const validContacts = bulkContacts.filter(c => c.company.trim() || c.name.trim() || c.email.trim() || c.phone.trim());
                if (validContacts.length === 0) return addNotification('error', 'Aucune donnée à importer.');

                const batch = writeBatch(db);
                let count = 0;
                validContacts.forEach((c) => {
                    const company = c.company.trim() || 'Inconnu';
                    const docRef = doc(collection(db, `artifacts/${getAppId()}/users/${user.uid}/contacts`));
                    batch.set(docRef, { 
                        company, 
                        name: c.name.trim(), 
                        email: c.email.trim(), 
                        phone: c.phone.trim(), 
                        manualCA: Number(c.manualCA) || 0,
                        manualBenefice: Number(c.manualBenefice) || 0,
                        type: 'prospect', 
                        status: 'nouveau', 
                        createdAt: new Date().toISOString() 
                    });
                    count++;
                });
                try {
                    await batch.commit();
                    addNotification('success', `${count} contacts ajoutés !`);
                    setBulkContacts([{ company: '', name: '', email: '', phone: '', manualCA: '', manualBenefice: '' }, { company: '', name: '', email: '', phone: '', manualCA: '', manualBenefice: '' }, { company: '', name: '', email: '', phone: '', manualCA: '', manualBenefice: '' }]);
                    setShowModal(null);
                } catch (err) {
                    addNotification('error', 'Erreur lors de l\'ajout.');
                }
            }} className="space-y-4">
                <div className="max-h-[50vh] overflow-y-auto custom-scrollbar border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-extrabold text-[10px] tracking-wider sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 border-b border-slate-200">Société</th>
                                <th className="px-4 py-3 border-b border-slate-200">Contact</th>
                                <th className="px-4 py-3 border-b border-slate-200">Email</th>
                                <th className="px-4 py-3 border-b border-slate-200">Téléphone</th>
                                <th className="px-4 py-3 border-b border-slate-200">CA Manuel</th>
                                <th className="px-4 py-3 border-b border-slate-200">Bénéfice Manuel</th>
                                <th className="px-4 py-3 border-b border-slate-200 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {bulkContacts.map((c, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-2"><input value={c.company} onChange={e => { const newB = [...bulkContacts]; newB[idx].company = e.target.value; setBulkContacts(newB); }} className="w-full bg-transparent outline-none border-2 border-transparent focus:border-blue-100 focus:bg-white rounded-lg p-2 font-bold text-slate-700 transition-colors" placeholder="Nom..." /></td>
                                    <td className="p-2"><input value={c.name} onChange={e => { const newB = [...bulkContacts]; newB[idx].name = e.target.value; setBulkContacts(newB); }} className="w-full bg-transparent outline-none border-2 border-transparent focus:border-blue-100 focus:bg-white rounded-lg p-2 text-slate-700 transition-colors" placeholder="Prénom Nom..." /></td>
                                    <td className="p-2"><input value={c.email} onChange={e => { const newB = [...bulkContacts]; newB[idx].email = e.target.value; setBulkContacts(newB); }} className="w-full bg-transparent outline-none border-2 border-transparent focus:border-blue-100 focus:bg-white rounded-lg p-2 text-slate-700 transition-colors" placeholder="@" /></td>
                                    <td className="p-2"><input value={c.phone} onChange={e => { const newB = [...bulkContacts]; newB[idx].phone = e.target.value; setBulkContacts(newB); }} className="w-full bg-transparent outline-none border-2 border-transparent focus:border-blue-100 focus:bg-white rounded-lg p-2 text-slate-700 transition-colors" placeholder="+41..." /></td>
                                    <td className="p-2"><input type="number" value={c.manualCA} onChange={e => { const newB = [...bulkContacts]; newB[idx].manualCA = e.target.value; setBulkContacts(newB); }} className="w-full bg-transparent outline-none border-2 border-transparent focus:border-blue-100 focus:bg-white rounded-lg p-2 text-slate-700 transition-colors" placeholder="CA..." /></td>
                                    <td className="p-2"><input type="number" value={c.manualBenefice} onChange={e => { const newB = [...bulkContacts]; newB[idx].manualBenefice = e.target.value; setBulkContacts(newB); }} className="w-full bg-transparent outline-none border-2 border-transparent focus:border-blue-100 focus:bg-white rounded-lg p-2 text-slate-700 transition-colors" placeholder="Bénéfice..." /></td>
                                    <td className="p-2 text-center">
                                        <button type="button" onClick={() => { const newB = [...bulkContacts]; newB.splice(idx, 1); setBulkContacts(newB); }} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                <div className="flex justify-between items-center pt-2">
                    <button type="button" onClick={() => {
                        const lastCompany = bulkContacts.length > 0 ? bulkContacts[bulkContacts.length - 1].company : '';
                        setBulkContacts([...bulkContacts, { company: lastCompany, name: '', email: '', phone: '', manualCA: '', manualBenefice: '' }]);
                    }} className="text-sm font-bold text-[#01189B] bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors flex items-center gap-2"><Plus size={16}/> Ajouter une ligne</button>
                    <div className="flex justify-end gap-4">
                        <button type="button" onClick={() => setShowModal(null)} className="px-6 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold transition-colors">Annuler</button>
                        <button type="submit" className="px-6 py-2.5 text-white rounded-xl font-bold flex items-center gap-2 hover:shadow-lg hover:-translate-y-0.5 transition-all" style={{ backgroundColor: BRAND_COLOR }}><CheckCircle size={18}/> Importer les lignes</button>
                    </div>
                </div>
            </form>
          </div>
        </div>
      )}

      {showModal === 'contact' && (() => {
        // Extraction des sociétés uniques déjà existantes dans le CRM pour l'auto-complétion
        const uniqueCompanies = Array.from(new Set(contacts.map((c: any) => c.company).filter(Boolean)));
        
        return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 md:p-10 rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-100 animate-fade-in overflow-y-auto max-h-[90vh] custom-scrollbar">
            
            <div className="mb-8 border-b border-slate-100 pb-5">
                <h3 className="text-2xl font-extrabold text-slate-800 font-poppins flex items-center gap-3"><Users style={{ color: BRAND_COLOR }} size={28}/> Nouvelle Fiche CRM</h3>
                <p className="text-slate-500 text-sm mt-2 leading-relaxed">Créez un nouveau prospect ou client. <br/><span className="bg-blue-50 text-[#01189B] px-2 py-0.5 rounded font-bold mr-1">💡 Astuce :</span> Si ce contact appartient à une entreprise déjà existante (ex: un conseiller d'une <i>Agence</i> apportant son propre budget), sélectionnez le même nom de société. Leurs données (CA, notes) seront regroupées dans la vue pipeline sous cette même entité.</p>
            </div>

            <form onSubmit={(e: any) => { e.preventDefault(); const fd = new FormData(e.target); handleCreate('contacts', { name: fd.get('name'), company: fd.get('company'), email: fd.get('email'), phone: fd.get('phone'), address: fd.get('address'), status: fd.get('type') === 'client' ? 'gagne' : 'nouveau', type: fd.get('type'), source: fd.get('source'), sourceDetails: fd.get('sourceDetails'), googleSheetId: fd.get('googleSheetId'), manualCA: Number(fd.get('manualCA') || 0), manualBenefice: Number(fd.get('manualBenefice') || 0) }); }} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                  {/* Colonne 1 : Infos de base */}
                  <div className="bg-blue-50/40 p-5 rounded-2xl border border-blue-100 h-full flex flex-col">
                      <h4 className="font-bold text-[#01189B] text-sm mb-4 flex items-center gap-2"><Briefcase size={18}/> 1. Informations Profil</h4>
                      
                      <div className="space-y-4 flex-1">
                          <div>
                              <label className={UI_CLASSES.label}>Type de Profil</label>
                              <div className="flex gap-3">
                                  <label className="flex-1 cursor-pointer">
                                      <input type="radio" name="type" value="prospect" defaultChecked className="peer sr-only" />
                                      <div className="text-center px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all peer-checked:border-[#01189B] peer-checked:bg-[#01189B] peer-checked:text-white border-blue-200 text-[#01189B] bg-white hover:bg-blue-50 shadow-sm hover:-translate-y-0.5">
                                          Prospect
                                      </div>
                                  </label>
                                  <label className="flex-1 cursor-pointer">
                                      <input type="radio" name="type" value="client" className="peer sr-only" />
                                      <div className="text-center px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-checked:text-white border-emerald-200 text-emerald-600 bg-white hover:bg-emerald-50 shadow-sm hover:-translate-y-0.5">
                                          Client Actif
                                      </div>
                                  </label>
                              </div>
                          </div>
                          <div>
                              <label className={UI_CLASSES.label}>Société / Agence mère</label>
                              <input name="company" required defaultValue={selectedCompanyName || ''} className={UI_CLASSES.input} placeholder="Ex: LeadPartner, TechCorp..." list="companies-list" autoComplete="off" />
                              <datalist id="companies-list">
                                  {uniqueCompanies.map((comp: any) => <option key={comp} value={comp} />)}
                              </datalist>
                              <p className="text-[10px] text-slate-400 mt-1.5 font-medium leading-tight"><Info size={12} className="inline mr-0.5" /> Tapez pour créer une nouvelle société ou sélectionnez-en une existante.</p>
                          </div>
                          <div>
                              <label className={UI_CLASSES.label}>Nom de l'interlocuteur / Conseiller</label>
                              <input name="name" required className={UI_CLASSES.input} placeholder="Ex: Jean Dupont" />
                          </div>
                      </div>
                  </div>

                  {/* Colonne 2 : Coordonnées & Source */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col">
                      <h4 className="font-bold text-slate-700 text-sm mb-4 flex items-center gap-2"><Mail size={18}/> 2. Coordonnées & Origine</h4>
                      
                      <div className="space-y-4 flex-1">
                          <div className="grid grid-cols-2 gap-4">
                            <div><label className={UI_CLASSES.label}>Email</label><input name="email" type="email" className={UI_CLASSES.input} placeholder="contact@" /></div>
                            <div><label className={UI_CLASSES.label}>Téléphone</label><input name="phone" className={UI_CLASSES.input} placeholder="+41..." /></div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className={UI_CLASSES.label}>Source</label>
                                <select name="source" value={newContactSource} onChange={(e) => setNewContactSource(e.target.value)} className={UI_CLASSES.input}>
                                  <option value="">-- Inconnue --</option>
                                  <option value="Recommandation">Recommandation</option>
                                  <option value="Call froid">Call froid</option>
                                  <option value="Lead site internet">Lead site internet</option>
                                  <option value="LinkedIn">LinkedIn</option>
                                  <option value="Autre">Autre</option>
                                </select>
                              </div>
                              {newContactSource === 'Recommandation' && (
                                <div>
                                  <label className={UI_CLASSES.label}>Recommandé par</label>
                                  <input name="sourceDetails" className={UI_CLASSES.input} placeholder="Nom..." />
                                </div>
                              )}
                          </div>

                          <div>
                            <label className={UI_CLASSES.label}>Adresse Facturation / Locaux</label>
                            <textarea name="address" className={`${UI_CLASSES.input} h-12 resize-none`} placeholder="Rue, NPA, Ville..."></textarea>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="pt-6 mt-4 border-t border-slate-100 flex justify-end gap-4">
                <button type="button" onClick={() => setShowModal(null)} className="px-8 py-3.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold transition-colors">Annuler</button>
                <button type="submit" className="px-8 py-3.5 text-white rounded-xl font-bold flex items-center gap-2 hover:shadow-lg hover:-translate-y-0.5 transition-all text-lg" style={{ backgroundColor: BRAND_COLOR }}><CheckCircle size={20}/> Enregistrer le Profil</button>
              </div>
            </form>
          </div>
        </div>
        );
      })()}

      {showModal === 'product' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white p-10 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 animate-fade-in">
            <h3 className={UI_CLASSES.title}><Package style={{ color: BRAND_COLOR }} size={24}/> {currentProduct ? 'Modifier l\'Offre' : 'Créer une Offre'}</h3>
            <form onSubmit={handleSaveProductForm} className="space-y-5">
              <div><label className={UI_CLASSES.label}>Titre de l'offre</label><input name="name" defaultValue={currentProduct?.name} required placeholder="Ex: 3ème Pilier" className={`${UI_CLASSES.input} font-extrabold`} /></div>
              <div><label className={UI_CLASSES.label}>Description</label><textarea name="description" defaultValue={currentProduct?.description} placeholder="Avantages, détails..." className={`${UI_CLASSES.input} h-24 resize-none`}></textarea></div>
              <div className="grid grid-cols-2 gap-6">
                <div><label className={UI_CLASSES.label}>Prix Vente (CHF)</label><input name="price" defaultValue={currentProduct?.price} type="number" step="0.01" required className={`${UI_CLASSES.input} font-extrabold text-[#01189B]`} /></div>
                <div><label className={UI_CLASSES.label}>Cible Achat (CHF)</label><input name="cost" defaultValue={currentProduct?.cost} type="number" step="0.01" required className={`${UI_CLASSES.input} focus:border-orange-400 font-extrabold text-orange-500`} /></div>
              </div>
              <div>
                <label className={UI_CLASSES.label}>Plateforme d'acquisition</label>
                <select name="platform" defaultValue={currentProduct?.platform} className={UI_CLASSES.input}>
                  <option value="meta">Meta Ads (Facebook/Insta)</option>
                  <option value="google">Google Ads</option>
                  <option value="tiktok">TikTok Ads</option>
                </select>
              </div>
              <div className="pt-6 flex gap-4">
                <button type="button" onClick={() => { setShowModal(null); setCurrentProduct(null); }} className={UI_CLASSES.btnSecondary}>Annuler</button>
                <button type="submit" className={UI_CLASSES.btnPrimary} style={{ backgroundColor: BRAND_COLOR }}>{currentProduct ? 'Mettre à jour' : 'Ajouter'}</button>
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
              <div className="flex gap-2">
                <div className="flex items-center gap-2 mr-2 border-r border-slate-200 pr-2 hidden lg:flex">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">État</span>
                  <select 
                    value={currentInvoice.status || 'brouillon'} 
                    onChange={e => {
                        const newStatus = e.target.value;
                        handleInvoiceStatusChange(currentInvoice, newStatus);
                        setCurrentInvoice({...currentInvoice, status: newStatus});
                    }}
                    className="border-2 border-slate-100 p-1.5 rounded-lg bg-slate-50 hover:bg-white text-xs font-bold text-slate-700 outline-none focus:border-[#01189B] cursor-pointer transition-colors"
                  >
                    {Object.entries(INVOICE_STATUSES).map(([k,v]: any) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <button onClick={handleDownloadPDF} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg flex gap-1.5 items-center font-bold hover:bg-slate-200 transition-colors text-xs whitespace-nowrap"><Download size={14} /> PDF</button>
                <button onClick={handleEmailInvoice} className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg flex gap-1.5 items-center font-bold hover:bg-orange-200 transition-colors text-xs whitespace-nowrap"><Mail size={14} /> Email</button>
                <button onClick={() => handleSaveInvoice(true)} className="px-3 py-1.5 text-white rounded-lg flex gap-1.5 items-center font-bold hover:shadow-lg transition-all text-xs whitespace-nowrap" style={{ backgroundColor: BRAND_COLOR }}><CheckCircle size={14} /> <span className="hidden md:inline">Enregistrer</span></button>
                <button onClick={() => setShowModal(null)} className="p-1.5 bg-white border border-slate-200 hover:text-red-500 hover:border-red-200 rounded-lg transition-colors"><X size={16} /></button>
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
                        <select className="bg-slate-50 border-2 border-slate-100 p-3 rounded-xl w-full font-bold outline-none focus:border-[#01189B] text-slate-800 transition-colors mb-3" onChange={(e) => { const c = contacts.find((co) => co.id === e.target.value); setCurrentInvoice({ ...currentInvoice, clientId: c?.id, clientName: c?.company, clientAddress: c?.address || '', clientContactName: c?.name || '' }); if (c?.projectedBudget) { setInvoiceBudget(c.projectedBudget); if (c.interestedProductId) setInvoiceThemeId(c.interestedProductId); } }} value={currentInvoice.clientId}>
                            <option value="">-- Sélectionner depuis le CRM --</option>
                            {contacts.map((c) => (<option key={c.id} value={c.id}>{c.company}</option>))}
                        </select>
                        <div className="space-y-3 pt-3 border-t border-slate-100">
                           <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Nom d'affichage facture</label>
                              <input value={currentInvoice.clientName || ''} onChange={e => setCurrentInvoice({...currentInvoice, clientName: e.target.value})} className="w-full border-2 border-slate-100 bg-white p-2.5 rounded-xl font-bold outline-none focus:border-[#01189B] text-sm text-slate-700" placeholder="Nom de l'entreprise..." />
                           </div>
                           <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Représenté par (Contrat)</label>
                              <input value={currentInvoice.clientContactName || ''} onChange={e => setCurrentInvoice({...currentInvoice, clientContactName: e.target.value})} className="w-full border-2 border-slate-100 bg-white p-2.5 rounded-xl font-medium outline-none focus:border-[#01189B] text-sm text-slate-700" placeholder="Prénom et Nom..." />
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

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2"><FileText size={16} style={{ color: BRAND_COLOR }}/> Contrat Associé</h4>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    checked={currentInvoice.includeContract || false} 
                                    onChange={() => {
                                        const defaultText = settings.defaultContractText || '';
                                        setCurrentInvoice({...currentInvoice, includeContract: !currentInvoice.includeContract, contractText: currentInvoice.contractText || defaultText});
                                    }}
                                    className="w-4 h-4 text-[#01189B] border-slate-300 rounded focus:ring-[#01189B] cursor-pointer"
                                />
                                <button onClick={() => setIsEditingContractInInvoice(!isEditingContractInInvoice)} className="text-[10px] font-bold uppercase text-slate-400 hover:text-[#01189B] flex items-center gap-1 transition-colors">
                                    {isEditingContractInInvoice ? <X size={12}/> : <Edit2 size={12}/>} Modifier
                                </button>
                            </div>
                        </div>
                        {isEditingContractInInvoice && currentInvoice.includeContract && (
                            <div className="animate-fade-in">
                                <div className="flex justify-end mb-2">
                                    <button onClick={() => setCurrentInvoice({...currentInvoice, contractText: settings.defaultContractText || ''})} className="text-[10px] font-bold text-[#01189B] hover:text-blue-800 flex items-center gap-1 transition-colors bg-blue-50 px-2 py-1 rounded-lg">
                                        <RefreshCcw size={12}/> Mettre à jour avec le modèle par défaut
                                    </button>
                                </div>
                                <textarea
                                    value={currentInvoice.contractText || ''}
                                    onChange={e => setCurrentInvoice({...currentInvoice, contractText: e.target.value})}
                                    className="w-full border-2 border-slate-100 bg-slate-50 p-3 rounded-xl font-medium outline-none focus:border-[#01189B] text-xs text-slate-700 h-64 custom-scrollbar resize-none"
                                    placeholder="Texte du contrat..."
                                />
                            </div>
                        )}
                        {!isEditingContractInInvoice && currentInvoice.includeContract && (
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                                <p className="text-[10px] text-blue-600 font-bold leading-tight">Le contrat sera ajouté automatiquement à la fin du PDF. <br/><span className="text-xl inline-block mt-1">💡</span> <b>Astuce :</b> Tapez <code className="bg-white px-1.5 py-0.5 rounded shadow-sm text-black">---</code> (3 tirets consécutifs) dans votre texte pour forcer un saut de page manuel vers la page suivante.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* FACTURE A4 */}
                <div className="flex-1 overflow-auto bg-slate-200 p-8 flex justify-center custom-scrollbar relative">
                    <div id="invoice-printable" className="bg-transparent w-[210mm] h-max text-slate-800 relative shrink-0 box-border block">
                        
                        <div className="invoice-page-1 bg-white w-full h-[297mm] max-h-[297mm] overflow-hidden shadow-2xl px-[10mm] pt-[10mm] pb-[20mm] flex flex-col justify-between relative box-border mb-8 print:mb-0">
                            {/* Marqueur visuel de fin de page 1 (no-print) */}
                            <div className="absolute bottom-0 left-0 w-full border-b-2 border-red-300 border-dashed no-print z-[100] flex justify-center">
                                 <span className="bg-red-50 px-2 text-[8px] text-red-500 font-bold uppercase tracking-widest -mt-3">Limite Page 1 (A4)</span>
                            </div>

                            {currentInvoice.status === 'archive' && (
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 opacity-10 pointer-events-none select-none">
                                    <span className="text-8xl font-extrabold uppercase tracking-widest text-slate-900">Archivée</span>
                                </div>
                            )}
                            {currentInvoice.status === 'annulee' && (
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 opacity-10 pointer-events-none select-none">
                                    <span className="text-8xl font-extrabold uppercase tracking-widest text-red-900">Annulée</span>
                                </div>
                            )}

                            <div className="flex flex-col flex-1">
                                <div className="flex justify-between mb-2 border-b-2 pb-2" style={{ borderColor: BRAND_COLOR }}>
                                <div>
                                    <h1 className="text-3xl font-extrabold uppercase mb-1 font-poppins tracking-tight" style={{ color: BRAND_COLOR }}>Facture</h1>
                                    <div className="text-slate-500 font-medium text-[11px] space-y-0.5 mt-1">
                                        <p className="flex items-center gap-1"><span className="font-bold w-20 inline-block">N° Facture</span> <input value={currentInvoice.id} onChange={e => setCurrentInvoice({...currentInvoice, id: e.target.value})} className="text-slate-800 font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded outline-none border-none print-input w-28 text-[11px]" /></p>
                                        <p className="flex items-center gap-1"><span className="font-bold w-20 inline-block">Date</span> <input type="date" value={currentInvoice.date ? currentInvoice.date.split('T')[0] : ''} onChange={e => {
                                            if(e.target.value) {
                                                const [y,m,d] = e.target.value.split('-');
                                                const dObj = new Date(Number(y), Number(m)-1, Number(d), 12, 0, 0);
                                                if(!isNaN(dObj.getTime())) setCurrentInvoice({...currentInvoice, date: dObj.toISOString()});
                                            }
                                        }} className="bg-slate-100 px-1.5 py-0.5 rounded outline-none border-none print-input text-[11px] font-medium font-sans w-28 cursor-pointer hover:bg-slate-200 transition-colors" title="Modifie le mois d'attribution du CA" /></p>
                                        <p className="flex items-center gap-1"><span className="font-bold w-20 inline-block">Échéance</span> <span className="px-1.5 py-0.5">{formatDate(new Date(new Date(currentInvoice.date).getTime() + 30*24*60*60*1000).toISOString())}</span></p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <h2 className="text-xl font-black font-poppins tracking-tight" style={{ color: BRAND_COLOR }}>{settings.companyName}</h2>
                                    <p className="text-xs text-slate-500 mt-1.5 whitespace-pre-wrap leading-relaxed">{settings.address}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{settings.email}</p>
                                    {settings.companyId && <p className="text-[10px] text-slate-400 mt-1.5 font-bold uppercase tracking-widest">{settings.companyId}</p>}
                                </div>
                                </div>

                                <div className="mb-4 bg-slate-50 p-4 rounded-xl border border-slate-100 w-1/2 ml-auto">
                                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Facturé à</p>
                                    <h3 className="text-sm font-extrabold text-slate-800 font-poppins">{currentInvoice.clientName || 'Nom du Client'}</h3>
                                    {currentInvoice.clientAddress && <p className="text-xs text-slate-600 mt-1.5 whitespace-pre-wrap leading-relaxed font-medium">{currentInvoice.clientAddress}</p>}
                                </div>

                                {/* TABLEAU DES LIGNES */}
                                <table className="w-full text-xs text-left mb-2 relative z-10">
                                <thead className="bg-slate-50 text-slate-500 uppercase font-extrabold text-[9px] tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="px-3 py-2 w-3/5">Désignation</th>
                                        <th className="px-2 py-2 text-center w-16">Qté</th>
                                        <th className="px-3 py-2 text-right">Montant HT</th>
                                        <th className="w-6 no-print"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(currentInvoice.items || []).map((item: any, i: number) => (
                                    <tr key={i} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-3 py-2">
                                            <input value={item.name} onChange={e => { const newItems = [...(currentInvoice.items || [])]; newItems[i].name = e.target.value; setCurrentInvoice({ ...currentInvoice, items: newItems }); }} className="font-bold text-slate-800 bg-transparent outline-none w-full print-input text-xs" placeholder="Nom de l'article" />
                                            <textarea value={item.description || ''} onChange={e => { const newItems = [...(currentInvoice.items || [])]; newItems[i].description = e.target.value; setCurrentInvoice({ ...currentInvoice, items: newItems }); }} className="text-[10px] text-slate-500 mt-0.5 bg-transparent outline-none w-full resize-none overflow-hidden print-input leading-tight" placeholder="Description (optionnelle)" rows={2} />
                                        </td>
                                        <td className="px-2 py-2 text-center align-top pt-2.5">
                                            <input type="number" value={item.qty || 1} onChange={e => { const newItems = [...(currentInvoice.items || [])]; newItems[i].qty = Number(e.target.value); setCurrentInvoice({ ...currentInvoice, items: newItems }); }} className="font-mono font-bold text-slate-800 bg-transparent outline-none w-12 text-center print-input text-xs" />
                                        </td>
                                        <td className="px-3 py-2 text-right align-top pt-2.5">
                                            <input type="number" value={item.price} onChange={e => { const newItems = [...(currentInvoice.items || [])]; newItems[i].price = Number(e.target.value); setCurrentInvoice({ ...currentInvoice, items: newItems }); }} className="font-mono font-bold text-slate-800 bg-transparent outline-none w-20 text-right print-input text-xs" />
                                        </td>
                                        <td className="py-2 no-print text-center align-top pt-2">
                                            <button onClick={() => {
                                                const newItems = [...(currentInvoice.items || [])];
                                                newItems.splice(i, 1);
                                                setCurrentInvoice({ ...currentInvoice, items: newItems });
                                            }} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white shadow-sm p-1 rounded mt-0.5">
                                                <Trash2 size={14}/>
                                            </button>
                                        </td>
                                    </tr>
                                    ))}
                                    {(currentInvoice.items || []).length === 0 && (
                                    <tr><td colSpan={4} className="py-8 text-center text-slate-400 italic text-[10px] font-medium border-dashed border-2 border-slate-200 rounded-xl mt-2">Aucune prestation facturée. Utilisez le panneau à gauche pour générer les lignes.</td></tr>
                                    )}
                                </tbody>
                                </table>

                                {/* Ligne d'ajout manuelle */}
                                <div className="no-print mt-2 text-center">
                                    <button onClick={() => setCurrentInvoice({ ...currentInvoice, items: [...(currentInvoice.items || []), { name: 'Nouvelle ligne', price: 0, qty: 1, description: '' }] })} className="text-[10px] font-bold text-[#01189B] bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5 border border-blue-200">
                                        <Plus size={14}/> Ajouter une ligne
                                    </button>
                                </div>
                            </div>

                            {/* Bloc inséparable pour les totaux ET le footer (break-inside-avoid) collé en bas de la page 1 */}
                            <div className="keep-together break-inside-avoid w-full pt-2 mt-auto">
                                <div className="flex justify-end mb-2 relative z-10">
                                    <div className="w-80 space-y-1.5">
                                        <div className="flex justify-between text-slate-500 font-bold text-sm"><span>Sous-total HT</span> <span className="font-mono text-slate-800">{formatCurrency((currentInvoice.items || []).reduce((acc: number, i: any) => acc + i.price * (i.qty || 1), 0))}</span></div>
                                        <div className="flex justify-between text-slate-400 font-medium text-xs"><span>TVA (0.0%)</span> <span className="font-mono">0.00 CHF</span></div>
                                        <div className="flex justify-between py-2 border-t-2 mt-1.5 text-xl font-extrabold font-poppins" style={{ borderColor: BRAND_COLOR, color: BRAND_COLOR }}>
                                            <span>Total TTC</span> <span>{formatCurrency((currentInvoice.items || []).reduce((acc: number, i: any) => acc + i.price * (i.qty || 1), 0))}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative z-10 bg-white">
                                    <div className="border-t border-slate-200 grid grid-cols-2 gap-8 pt-4 mb-3">
                                        <div>
                                            <p className="font-extrabold text-slate-800 mb-1.5 uppercase tracking-widest text-[10px]">Coordonnées Bancaires</p>
                                            {settings.bankDetails ? (
                                            <p className="whitespace-pre-wrap text-slate-600 font-mono text-xs leading-relaxed border-l-2 pl-3" style={{ borderColor: BRAND_COLOR }}>{settings.bankDetails}</p>
                                            ) : (
                                            <p className="text-slate-400 italic text-xs">A configurer dans les paramètres.</p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="font-extrabold text-slate-800 mb-1.5 uppercase tracking-widest text-[10px]">Informations</p>
                                            <p className="whitespace-pre-wrap text-[11px] text-slate-500 font-medium leading-relaxed">{settings.invoiceFooter}</p>
                                        </div>
                                    </div>

                                    {settings.legalNotice && (
                                        <div className="text-center w-full pt-3 pb-2 text-[10px] text-slate-400 font-medium uppercase tracking-widest border-t border-slate-100">
                                            {settings.legalNotice}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* --- PAGE CONTRAT (OPTIONNELLE) --- */}
                        {currentInvoice.includeContract && currentInvoice.contractText && (
                            <div className="html2pdf__page-break bg-white w-full h-max shadow-2xl p-[10mm] pb-[20mm] box-border block mt-8 print:mt-0 print:p-[10mm] print:pb-[20mm]" style={{ pageBreakBefore: 'always' }}>
                                <div className="text-[10px] text-slate-700 leading-[1.5] font-medium text-justify mb-6 block">
                                    {currentInvoice.contractText
                                        .replace(/\{\{client_company\}\}/g, currentInvoice.clientName || '_______________')
                                        .replace(/\{\{client_address\}\}/g, currentInvoice.clientAddress || '_______________')
                                        .replace(/\{\{client_name\}\}/g, currentInvoice.clientContactName || '_______________')
                                        .replace(/\{\{agency_company\}\}/g, settings.companyName || '_______________')
                                        .split('\n\n')
                                        .map((paragraph: string, idx: number) => {
                                            if (paragraph.trim() === '---') {
                                                return <div key={idx} className="html2pdf__page-break" style={{ pageBreakBefore: 'always', height: '1px', width: '100%' }}></div>;
                                            }
                                            return (
                                                <div key={idx} className="keep-together mb-4 whitespace-pre-wrap block" style={{ pageBreakInside: 'avoid' }}>
                                                    {paragraph}
                                                </div>
                                            )
                                        })
                                    }
                                </div>
                                <div className="keep-together mt-8 grid grid-cols-2 gap-8 pt-6 pb-2 shrink-0 block" style={{ pageBreakInside: 'avoid' }}>
                                    <div>
                                        <p className="font-bold text-slate-800 text-[10px] uppercase mb-2 tracking-widest">Le Prestataire</p>
                                        <div className="h-14 flex items-end mb-2">
                                            {settings.agencySignature ? (
                                                <img src={settings.agencySignature} alt="Signature" className="max-h-12 object-contain" />
                                            ) : (
                                                <div className="h-8"></div>
                                            )}
                                        </div>
                                        <div className="border-b-2 border-slate-200 w-3/4"></div>
                                        <p className="text-[10px] mt-2 font-extrabold" style={{ color: BRAND_COLOR }}>{settings.companyName}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-slate-800 text-[10px] uppercase mb-10 tracking-widest flex flex-col items-end"><span>Le Client</span> <span className="text-[8px] text-slate-500">(Lu et approuvé)</span></p>
                                        <div className="border-b-2 border-slate-200 w-3/4 ml-auto"></div>
                                        <p className="text-[10px] text-slate-800 mt-2 font-bold">{currentInvoice.clientName}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
      </div>
    )}

    {/* MODAL EDITION CAMPAGNE / SIMULATION */}
    {showModal === 'simulation' && currentSimulation && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[2000] p-4">
        <div className="bg-white p-8 rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 animate-fade-in overflow-y-auto max-h-[90vh]">
          <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-extrabold text-slate-800 font-poppins flex items-center gap-3"><Settings style={{ color: BRAND_COLOR }} size={24}/> Modifier la Campagne</h3>
              <button onClick={() => setShowModal(null)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
          </div>
          <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div><label className={UI_CLASSES.label}>Date de début</label><input type="date" value={currentSimulation.createdAt ? currentSimulation.createdAt.split('T')[0] : ''} onChange={e => {
                      if(e.target.value) {
                          const [y,m,d] = e.target.value.split('-');
                          const dObj = new Date(Number(y), Number(m)-1, Number(d), 12, 0, 0);
                          if(!isNaN(dObj.getTime())) setCurrentSimulation({...currentSimulation, createdAt: dObj.toISOString()});
                      }
                  }} className={UI_CLASSES.input} /></div>
                  <div><label className={UI_CLASSES.label}>Durée (Jours)</label><input type="number" value={currentSimulation.duration || 30} onChange={e => setCurrentSimulation({...currentSimulation, duration: Number(e.target.value)})} className={UI_CLASSES.input} /></div>
              </div>
              <div><label className={UI_CLASSES.label}>Objectif de Leads</label><input type="number" value={currentSimulation.stats?.volumeTotal || 0} onChange={e => setCurrentSimulation({...currentSimulation, stats: {...currentSimulation.stats, volumeTotal: Number(e.target.value)}})} className={UI_CLASSES.input} /></div>
              
              <div className="pt-4 border-t border-slate-100">
                  <label className={UI_CLASSES.label}>Suivi des Leads Générés</label>
                  <select value={currentSimulation.dataSource || 'auto'} onChange={e => setCurrentSimulation({...currentSimulation, dataSource: e.target.value})} className={UI_CLASSES.input}>
                      <option value="auto">Estimation Automatique (Temps écoulé)</option>
                      <option value="manual">Saisie Manuelle</option>
                      <option value="deliveries">Connecter au Suivi Livraisons réelles</option>
                  </select>
              </div>

              {currentSimulation.dataSource === 'manual' && (
                  <div className="animate-fade-in"><label className={UI_CLASSES.label}>Nombre de leads actuel</label><input type="number" value={currentSimulation.manualLeads || 0} onChange={e => setCurrentSimulation({...currentSimulation, manualLeads: Number(e.target.value)})} className={UI_CLASSES.input} /></div>
              )}
              {currentSimulation.dataSource === 'deliveries' && (
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl animate-fade-in space-y-4">
                      <div>
                          <label className={UI_CLASSES.label}>Nom du client dans les livraisons (Agent Name)</label>
                          <input type="text" value={currentSimulation.deliveryMatchName !== undefined ? currentSimulation.deliveryMatchName : (currentSimulation.clientName || '')} onChange={e => setCurrentSimulation({...currentSimulation, deliveryMatchName: e.target.value})} className={UI_CLASSES.input} placeholder="Nom exact dans les livraisons..." />
                      </div>
                      <div className="pt-2 border-t border-blue-100">
                          <label className={UI_CLASSES.label}>Ajustement manuel (Correctif de Leads)</label>
                          <input type="number" value={currentSimulation.manualLeadsOffset || 0} onChange={e => setCurrentSimulation({...currentSimulation, manualLeadsOffset: Number(e.target.value)})} className={UI_CLASSES.input} placeholder="Ex: +5 ou -2" />
                          <p className="text-[10px] text-blue-600 mt-2 font-medium">Permet d'ajouter ou retirer des leads manuellement au compte automatique. <br/>(Le compte final sera : <b>Leads reçus par webhook + cet ajustement</b>).</p>
                      </div>
                  </div>
              )}
          </div>
          <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setShowModal(null)} className={UI_CLASSES.btnSecondary}>Annuler</button>
              <button onClick={async () => {
                  if (user && !isOfflineMode) {
                      await handleUpdate('simulations', currentSimulation.id, currentSimulation);
                      addNotification('success', 'Campagne mise à jour avec succès');
                  }
                  setShowModal(null);
              }} className={UI_CLASSES.btnPrimary} style={{ backgroundColor: BRAND_COLOR }}><Save size={18}/> Enregistrer</button>
          </div>
        </div>
      </div>
    )}

    {/* MODAL AJOUT LIVRAISON MANUELLE */}
    {showModal === 'add_delivery' && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[2000] p-4">
        <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 animate-fade-in">
          <h3 className="text-2xl font-extrabold text-slate-800 font-poppins flex items-center gap-3 mb-6"><Plus style={{ color: BRAND_COLOR }} size={24}/> Ajouter un Lead Manuellement</h3>
          <form onSubmit={(e: any) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              handleCreate('lead_deliveries', {
                  agentName: fd.get('agentName'),
                  campagne: fd.get('campagne'),
                  date: new Date().toISOString(),
                  createdAt: new Date().toISOString()
              });
              setShowModal(null);
          }} className="space-y-4">
              <div>
                  <label className={UI_CLASSES.label}>Client (Agent Name exact)</label>
                  <input name="agentName" required className={UI_CLASSES.input} placeholder="Ex: TechCorp" />
                  <p className="text-[10px] text-slate-400 mt-1">Doit correspondre exactement au nom surveillé par la campagne pour être comptabilisé.</p>
              </div>
              <div>
                  <label className={UI_CLASSES.label}>Nom de la campagne</label>
                  <input name="campagne" className={UI_CLASSES.input} placeholder="Ex: Meta Ads 3P" />
              </div>
              <div className="flex gap-4 pt-4 mt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setShowModal(null)} className={UI_CLASSES.btnSecondary}>Annuler</button>
                  <button type="submit" className={UI_CLASSES.btnPrimary} style={{ backgroundColor: BRAND_COLOR }}>Ajouter le Lead</button>
              </div>
          </form>
        </div>
      </div>
    )}

    {/* EMAIL MODAL */}
    {showEmailModal && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4">
        <div className="bg-white p-10 rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 animate-fade-in">
          <h3 className="text-2xl font-extrabold mb-6 font-poppins text-slate-800 flex items-center gap-3"><Send style={{ color: BRAND_COLOR }} size={24}/> Envoyer par Email</h3>
          
          <div className="space-y-4 mb-6">
              <div>
                  <label className={UI_CLASSES.label}>Modèle d'email</label>
                  <select 
                      value={emailData.selectedTemplate} 
                      onChange={(e) => applyEmailTemplate(e.target.value, currentInvoice, emailData.to, emailData.prospectContact)}
                      className={UI_CLASSES.input}
                  >
                      {(currentInvoice ? (settings.emailTemplates || []) : (settings.prospectEmailTemplates || [])).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
              </div>
              <div>
                  <label className={UI_CLASSES.label}>Destinataire</label>
                  <input value={emailData.to} onChange={e => setEmailData({...emailData, to: e.target.value})} className={UI_CLASSES.input} placeholder="client@email.com" />
              </div>
              <div>
                  <label className={UI_CLASSES.label}>Sujet</label>
                  <input value={emailData.subject} onChange={e => setEmailData({...emailData, subject: e.target.value})} className={UI_CLASSES.input} />
              </div>
              <div>
                  <label className={UI_CLASSES.label}>Message</label>
                  <textarea value={emailData.body} onChange={e => setEmailData({...emailData, body: e.target.value})} className={`${UI_CLASSES.input} h-40 resize-none text-sm leading-relaxed`} />
              </div>
          </div>

          {/* Pièce jointe simulée visuellement (Masquée si ce n'est pas une facture) */}
          {currentInvoice && (
              <div className="bg-white border-2 border-dashed border-blue-200 p-4 rounded-xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-50 rounded-lg text-red-500"><FileText size={20}/></div>
                      <div>
                        <p className="font-bold text-[#01189B] text-sm">Facture_{currentInvoice?.clientName || 'Client'}_{currentInvoice?.id}.pdf</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Sera généré automatiquement</p>
                      </div>
                    </div>
                    <Paperclip className="text-blue-300" size={20}/>
                </div>
                
                <div className="pt-3 border-t border-blue-100 mt-2">
                    {currentInvoice?.includeContract ? (
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="sep-contract" 
                                checked={emailData.sendContractSeparately} 
                                onChange={(e) => setEmailData({...emailData, sendContractSeparately: e.target.checked})} 
                                className="w-4 h-4 text-[#01189B] rounded border-blue-200 focus:ring-[#01189B]" 
                            />
                            <label htmlFor="sep-contract" className="text-sm font-bold text-slate-700 cursor-pointer">
                                Joindre le contrat en PDF (Pièce jointe séparée)
                            </label>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <input type="checkbox" disabled className="w-4 h-4 rounded border-slate-200 cursor-not-allowed bg-slate-100" />
                            <label className="text-sm font-medium text-slate-400 cursor-not-allowed">
                                Option contrat indisponible (Non activé sur cette facture)
                            </label>
                        </div>
                    )}
                </div>
              </div>
          )}
          
          <div className="pt-4 flex gap-4 border-t border-slate-200 mt-6">
            <button onClick={() => setShowEmailModal(false)} className={UI_CLASSES.btnSecondary} disabled={emailData.isSending}>Annuler</button>
            <button 
                onClick={handleSendEmailFromModal} 
                disabled={emailData.isSending || !emailData.to}
                className="flex-1 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 hover:shadow-lg hover:scale-[1.02] disabled:opacity-50" 
                style={{ backgroundColor: BRAND_COLOR }}
            >
                {emailData.isSending ? <Loader className="animate-spin" size={18}/> : <Send size={18}/>}
                {emailData.isSending ? 'Envoi en cours...' : 'Envoyer'}
            </button>
          </div>
        </div>
      </div>
    )}

    </div>
  );
}