// ═══════════════════════════════════════════════════════════
// MODULE : POTENTIEL & VERTICALES — CRM LeadPartner (v2)
// Toutes les verticales leadpartner.ch × 3 marchés suisses (FR/DE/IT).
// Les budgets saisis sont des BUDGETS MENSUELS (comme ta facturation).
// Le module calcule automatiquement les KPI mensuels ET annuels :
// objectif CA annuel (×12), run-rate annualisé au rythme réel,
// bénéfice projeté, écart à aller chercher. Vue Mensuel / Annuel.
// Connexion au fichier principal : voir instructions en bas de fichier.
// ═══════════════════════════════════════════════════════════

import { useState } from 'react';
import {
  Rocket, Globe, TrendingUp, Wand2, Zap, Trash2, Info, Wallet, Target, CalendarClock
} from 'lucide-react';

const BRAND_COLOR = '#01189B';

const UI = {
  input: "w-full border-2 border-slate-100 bg-slate-50 p-2.5 rounded-xl outline-none focus:border-[#01189B] focus:bg-white transition-colors text-sm font-medium text-slate-800",
  label: "block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF', minimumFractionDigits: 2 }).format(Number(amount || 0));

// --- MARCHÉS SUISSES ---
export const LP_MARKETS = [
  { id: 'FR', label: 'Suisse Romande', flag: '🇫🇷', bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-[#01189B]' },
  { id: 'DE', label: 'Suisse Alémanique', flag: '🇩🇪', bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-600' },
  { id: 'IT', label: 'Tessin', flag: '🇮🇹', bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-600' },
];

// --- UNIVERS ---
export const LP_UNIVERSES = [
  { id: 'prevoyance', label: '🛡️ Prévoyance & Assurance' },
  { id: 'finance', label: '💰 Finance & Crédit' },
  { id: 'immo', label: '🏠 Immobilier' },
  { id: 'energie', label: '⚡ Énergie & Habitat' },
  { id: 'autres', label: '🧩 Autres' },
];

// --- VERTICALES LEADPARTNER.CH ---
// Les mots-clés rattachent automatiquement tes factures payées
// (via le produit lié + le texte des lignes) à la bonne verticale.
// Ordre important : les plus spécifiques d'abord.
export const LP_VERTICALS = [
  // Prévoyance & Assurance
  { id: 'lpp', emoji: '💼', label: '2ᵉ Pilier / LPP', universe: 'prevoyance', keywords: ['lpp', '2e pilier', '2eme pilier', 'deuxieme pilier', 'pilier 2'] },
  { id: '3p', emoji: '🏦', label: '3ᵉ Pilier', universe: 'prevoyance', keywords: ['3p', '3e pilier', '3eme pilier', 'troisieme pilier', 'pilier 3'] },
  { id: 'vie', emoji: '🕊️', label: 'Assurance Vie', universe: 'prevoyance', keywords: ['assurance vie', 'assurance-vie'] },
  { id: 'lca', emoji: '🩺', label: 'Complémentaire Santé (LCA)', universe: 'prevoyance', keywords: ['lca', 'complementaire'] },
  { id: 'subside', emoji: '💸', label: 'Subside', universe: 'prevoyance', keywords: ['subside'] },
  { id: 'lamal', emoji: '🏥', label: 'Santé LAMal', universe: 'prevoyance', keywords: ['lamal', 'cmu', 'assurance maladie', 'caisse maladie', 'sante'] },
  { id: 'juridique', emoji: '⚖️', label: 'Protection Juridique', universe: 'prevoyance', keywords: ['juridique'] },
  { id: 'auto', emoji: '🚗', label: 'Assurance Auto', universe: 'prevoyance', keywords: ['assurance auto', 'vehicule'] },
  // Finance & Crédit
  { id: 'credit', emoji: '💳', label: 'Crédit Privé', universe: 'finance', keywords: ['credit'] },
  { id: 'invest', emoji: '📈', label: 'Investissement', universe: 'finance', keywords: ['invest'] },
  { id: 'fiscal', emoji: '🧾', label: 'Optimisation Fiscale', universe: 'finance', keywords: ['fiscal'] },
  { id: 'entreprise', emoji: '🚀', label: "Création d'Entreprise", universe: 'finance', keywords: ["creation d'entreprise", 'entreprise'] },
  // Immobilier
  { id: 'hypotheque', emoji: '🏠', label: 'Hypothèque', universe: 'immo', keywords: ['hypothe'] },
  { id: 'estimation', emoji: '🏘️', label: 'Estimation Immobilière', universe: 'immo', keywords: ['estimation'] },
  // Énergie & Habitat
  { id: 'solaire', emoji: '☀️', label: 'Photovoltaïque', universe: 'energie', keywords: ['photovolta', 'solaire', 'panneaux'] },
  { id: 'pac', emoji: '🔥', label: 'Pompe à Chaleur', universe: 'energie', keywords: ['pompe a chaleur', 'pac '] },
  { id: 'isolation', emoji: '🧱', label: 'Isolation Thermique', universe: 'energie', keywords: ['isolation'] },
  // Fallback
  { id: 'autres', emoji: '🧩', label: 'Autres / Non classé', universe: 'autres', keywords: [] },
];

const normalizeTxt = (s: any) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const matchVertical = (text: string) => {
  const t = normalizeTxt(text);
  for (const v of LP_VERTICALS) {
    if (v.keywords.length && v.keywords.some((k: string) => t.includes(k))) return v.id;
  }
  return 'autres';
};

// ═══════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL DU MODULE
// ═══════════════════════════════════════════════════════════
export default function PotentialVerticals({
  invoices = [],
  products = [],
  settings = {},
  dashboardYear,
  setDashboardYear,
  isSecretMode = false,
  addNotification,
  openConfirm,
  onSave, // (partialSettings) => sauvegarde silencieuse dans Firestore config/general
}: any) {

  // --- États internes du module ---
  const [bulkAmount, setBulkAmount] = useState<any>('');
  const [bulkMarket, setBulkMarket] = useState('all');
  const [bulkScope, setBulkScope] = useState('all');
  const [bulkMode, setBulkMode] = useState('set');
  const [period, setPeriod] = useState<'month' | 'year'>('month'); // Vue Mensuel / Annuel

  const renderCurrency = (amount: number) => isSecretMode ? 'CHF ****' : formatCurrency(amount);
  const renderNumber = (num: number | string) => isSecretMode ? '****' : num;

  const currentYear = dashboardYear;
  const projections: any = settings.verticalProjections || {};
  const marginPct = Number(settings.verticalMargin ?? 35);

  // --- Temporalité : mois écoulés sur l'année sélectionnée (pour le run-rate) ---
  const now = new Date();
  const monthsElapsed = currentYear < now.getFullYear() ? 12 : (currentYear > now.getFullYear() ? 0 : now.getMonth() + 1);
  const isYearView = period === 'year';
  const periodLabel = isYearView ? '/an' : '/mois';

  // --- CA encaissé par verticale : factures PAYÉES de l'année, rattachées via le produit + les lignes ---
  const actualByVertical: any = {};
  invoices.forEach((inv: any) => {
    if (inv.status !== 'payee') return;
    const d = new Date(inv.date);
    if (isNaN(d.getTime()) || d.getFullYear() !== currentYear) return;
    const prod = products.find((p: any) => p.id === inv.themeId);
    const text = [prod?.name, prod?.description, ...(inv.items || []).map((i: any) => `${i.name || ''} ${i.description || ''}`)].filter(Boolean).join(' ');
    const vid = matchVertical(text);
    actualByVertical[vid] = (actualByVertical[vid] || 0) + Number(inv.amount || 0);
  });

  // --- Sauvegarde (déléguée au fichier principal via onSave) ---
  const saveProjections = (next: any) => onSave && onSave({ verticalProjections: next });
  const saveMargin = (val: number) => onSave && onSave({ verticalMargin: val });

  const getProj = (vId: string, mId: string) => Number(projections[`${vId}|${mId}`] || 0);
  const setProj = (vId: string, mId: string, val: any) => {
    const n = Number(val) || 0;
    if (n === getProj(vId, mId)) return;
    saveProjections({ ...projections, [`${vId}|${mId}`]: n });
  };

  // --- Application en masse (Bulk, montants MENSUELS) ---
  const applyBulk = () => {
    const amount = Number(bulkAmount);
    if (isNaN(amount) || bulkAmount === '') return addNotification && addNotification('error', 'Saisis un montant valide.');
    const targets = LP_VERTICALS.filter(v => v.id !== 'autres' && (bulkScope === 'all' || v.universe === bulkScope));
    const markets = bulkMarket === 'all' ? LP_MARKETS.map(m => m.id) : [bulkMarket];
    const next: any = { ...projections };
    targets.forEach(v => markets.forEach(m => {
      const key = `${v.id}|${m}`;
      next[key] = bulkMode === 'add' ? (Number(next[key]) || 0) + amount : amount;
    }));
    saveProjections(next);
    addNotification && addNotification('success', `🎯 ${targets.length * markets.length} objectif(s) mensuel(s) mis à jour (${formatCurrency(amount)}/mois ${bulkMode === 'add' ? 'ajoutés' : 'appliqués'} · soit ${formatCurrency(amount * 12)}/an par case).`);
  };

  const resetAll = () => {
    if (openConfirm) {
      openConfirm('Réinitialiser toutes les projections ?', 'Tous les budgets mensuels projetés seront remis à zéro. Le CA encaissé n\'est pas affecté.', () => saveProjections({}));
    } else {
      saveProjections({});
    }
  };

  // --- Calculs par verticale (budgets saisis = MENSUELS) ---
  const rows = LP_VERTICALS.map(v => {
    const perMarket: any = {};
    LP_MARKETS.forEach(m => { perMarket[m.id] = getProj(v.id, m.id); });
    const projMonthly = LP_MARKETS.reduce((a, m) => a + perMarket[m.id], 0);
    const projAnnual = projMonthly * 12;
    const actualAnnual = actualByVertical[v.id] || 0;
    const actualMonthlyAvg = monthsElapsed > 0 ? actualAnnual / monthsElapsed : 0;

    // Valeurs affichées selon la vue (Mensuel = moyenne/mois réelle vs objectif mensuel ; Annuel = cumul vs objectif ×12)
    const actualShown = isYearView ? actualAnnual : actualMonthlyAvg;
    const objShown = isYearView ? projAnnual : projMonthly;
    const gap = Math.max(0, objShown - actualShown);
    const marginPot = gap * (marginPct / 100);
    const progress = objShown > 0 ? Math.min(100, (actualShown / objShown) * 100) : 0;

    return { v, perMarket, projMonthly, projAnnual, actualAnnual, actualMonthlyAvg, actualShown, objShown, gap, marginPot, progress };
  }).filter(r => r.v.id !== 'autres' || r.actualAnnual > 0 || r.projMonthly > 0);

  // --- Totaux globaux ---
  const totalActualAnnual = rows.reduce((a, r) => a + r.actualAnnual, 0);
  const totalActualMonthlyAvg = monthsElapsed > 0 ? totalActualAnnual / monthsElapsed : 0;
  const totalProjMonthly = rows.reduce((a, r) => a + r.projMonthly, 0);
  const totalProjAnnual = totalProjMonthly * 12;

  const totalActualShown = isYearView ? totalActualAnnual : totalActualMonthlyAvg;
  const totalObjShown = isYearView ? totalProjAnnual : totalProjMonthly;
  const totalGapShown = Math.max(0, totalObjShown - totalActualShown);
  const totalMarginPotShown = totalGapShown * (marginPct / 100);
  const globalProgress = totalObjShown > 0 ? Math.min(100, (totalActualShown / totalObjShown) * 100) : 0;

  const marketTotals: any = {};
  LP_MARKETS.forEach(m => { marketTotals[m.id] = rows.reduce((a, r) => a + (r.perMarket[m.id] || 0), 0); });

  // --- KPI ANNUELS & PROJECTIONS ---
  const runRateAnnual = totalActualMonthlyAvg * 12;                       // CA annualisé au rythme réel
  const runRateMargin = runRateAnnual * (marginPct / 100);                // Bénéfice annualisé au rythme réel
  const annualTargetMargin = totalProjAnnual * (marginPct / 100);         // Bénéfice annuel si objectif atteint
  const annualGapVsRunRate = Math.max(0, totalProjAnnual - runRateAnnual); // CA annuel manquant au rythme actuel
  const annualMarginGap = annualGapVsRunRate * (marginPct / 100);          // Bénéfice annuel manquant
  const annualRemaining = Math.max(0, totalProjAnnual - totalActualAnnual); // Reste à encaisser sur l'objectif annuel
  const runRateProgress = totalProjAnnual > 0 ? Math.min(100, (runRateAnnual / totalProjAnnual) * 100) : 0;
  const willReachAnnual = totalProjAnnual > 0 && runRateAnnual >= totalProjAnnual;
  const monthsRemaining = Math.max(0, 12 - monthsElapsed);
  const neededPerMonth = monthsRemaining > 0 ? annualRemaining / monthsRemaining : annualRemaining; // Rythme mensuel à tenir

  // --- Message de motivation dynamique ---
  const motivation = totalProjMonthly === 0
    ? '👇 Fixe tes budgets mensuels par verticale et par marché pour voir jusqu\'où tu peux aller.'
    : globalProgress >= 100
      ? '🏆 Objectif atteint ! Monte tes projections : le plafond, c\'est toi qui le fixes.'
      : globalProgress >= 75
        ? '🔥 Dernière ligne droite ! Le gros du chemin est fait, finis le travail.'
        : globalProgress >= 40
          ? '💪 Bonne dynamique. Chaque facture te rapproche de ton potentiel.'
          : '🚀 Le potentiel est énorme. Chaque verticale non travaillée = du CA laissé sur la table.';

  return (
    <div className="max-w-7xl mx-auto animate-fade-in space-y-8 pb-12">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 font-poppins flex items-center gap-3"><Rocket style={{ color: BRAND_COLOR }} size={32} /> Potentiel & Verticales</h2>
          <p className="text-slate-500 text-lg mt-1">Budgets mensuels par verticale × 3 marchés. KPI mensuels et annuels : CA, bénéfice, run-rate et potentiel restant.</p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          {/* Toggle Mensuel / Annuel */}
          <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
            <button onClick={() => setPeriod('month')} className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg transition-all ${!isYearView ? 'bg-[#01189B] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Mensuel</button>
            <button onClick={() => setPeriod('year')} className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg transition-all ${isYearView ? 'bg-[#01189B] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Annuel</button>
          </div>
          <select value={dashboardYear} onChange={e => setDashboardYear(Number(e.target.value))} className="px-4 py-2 rounded-xl text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm outline-none cursor-pointer">
            <option value={2027}>Année 2027</option>
            <option value={2026}>Année 2026</option>
            <option value={2025}>Année 2025</option>
            <option value={2024}>Année 2024</option>
          </select>
        </div>
      </div>

      {/* ═══ BANNIÈRE MOTIVATION (suit la vue Mensuel / Annuel) ═══ */}
      <div className="rounded-3xl p-8 shadow-lg relative overflow-hidden" style={{ backgroundColor: BRAND_COLOR }}>
        <div className="absolute top-0 right-0 p-32 bg-white rounded-full blur-3xl opacity-10 -mr-10 -mt-10 pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 p-24 bg-white rounded-full blur-3xl opacity-5 pointer-events-none"></div>
        <div className="relative z-10">
          <p className="text-blue-200 font-bold uppercase tracking-widest text-xs mb-2">Ton potentiel {currentYear} · Vue {isYearView ? 'Annuelle' : 'Mensuelle'}</p>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <h3 className="text-4xl md:text-5xl font-black text-white font-poppins">{renderCurrency(totalGapShown)} <span className="text-lg font-bold text-blue-200">de CA encore à aller chercher {periodLabel}</span></h3>
              <p className="text-emerald-300 font-extrabold text-xl mt-2 font-poppins">≈ {renderCurrency(totalMarginPotShown)} de bénéfice potentiel {periodLabel} <span className="text-blue-200 text-sm font-medium">({marginPct}% de marge)</span></p>
            </div>
            <div className="text-left lg:text-right shrink-0">
              <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">Progression vers l'objectif</p>
              <p className="text-3xl font-black text-white font-poppins">{isSecretMode ? '**' : globalProgress.toFixed(0)}%</p>
            </div>
          </div>
          <div className="w-full bg-white/15 rounded-full h-4 overflow-hidden mt-5 shadow-inner">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-300 transition-all duration-1000" style={{ width: `${globalProgress}%` }}></div>
          </div>
          <div className="flex justify-between mt-3 text-xs font-bold flex-wrap gap-2">
            <span className="text-white bg-white/10 px-3 py-1.5 rounded-lg">💰 {isYearView ? `Encaissé ${currentYear} : ${renderCurrency(totalActualAnnual)}` : `Moyenne réelle : ${renderCurrency(totalActualMonthlyAvg)}/mois`}</span>
            <span className="text-blue-100 italic font-medium">{motivation}</span>
            <span className="text-white bg-white/10 px-3 py-1.5 rounded-lg">🎯 Objectif : {renderCurrency(totalObjShown)}{periodLabel}</span>
          </div>
        </div>
      </div>

      {/* ═══ 📅 PROJECTION ANNUELLE (toujours visible) ═══ */}
      <div className="bg-white rounded-3xl border-2 border-indigo-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        <div className="p-5 border-b border-indigo-100 bg-indigo-50/50 flex justify-between items-center flex-wrap gap-2">
          <h3 className="font-extrabold text-slate-800 font-poppins text-lg flex items-center gap-2"><CalendarClock size={20} className="text-indigo-600" /> 📅 Projection Annuelle {currentYear}</h3>
          <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">{monthsElapsed > 0 ? `Run-rate calculé sur ${monthsElapsed} mois écoulé(s)` : 'Année future : pas encore de run-rate'}</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-50 px-5 py-4 rounded-2xl border border-slate-100">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex justify-between">🎯 Objectif CA Annuel <Target size={14} /></p>
              <p className="text-2xl font-black text-[#01189B] font-mono">{renderCurrency(totalProjAnnual)}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-1">= {renderCurrency(totalProjMonthly)}/mois × 12</p>
            </div>
            <div className="bg-slate-50 px-5 py-4 rounded-2xl border border-slate-100">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex justify-between">📈 Run-Rate (CA annualisé) <TrendingUp size={14} /></p>
              <p className={`text-2xl font-black font-mono ${willReachAnnual ? 'text-emerald-600' : 'text-orange-600'}`}>{renderCurrency(runRateAnnual)}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-1">Au rythme actuel ({renderCurrency(totalActualMonthlyAvg)}/mois)</p>
            </div>
            <div className="bg-slate-50 px-5 py-4 rounded-2xl border border-slate-100">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex justify-between">💎 Bénéfice Annuel Projeté <Wallet size={14} /></p>
              <p className="text-2xl font-black text-emerald-600 font-mono">{renderCurrency(annualTargetMargin)}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-1">Si objectif atteint · Run-rate : {renderCurrency(runRateMargin)}</p>
            </div>
            <div className="bg-orange-50 px-5 py-4 rounded-2xl border border-orange-100">
              <p className="text-[10px] text-orange-600 font-bold uppercase tracking-widest mb-1 flex justify-between">🚀 CA Annuel Manquant <Zap size={14} /></p>
              <p className="text-2xl font-black text-orange-600 font-mono">{renderCurrency(annualGapVsRunRate)}</p>
              <p className="text-[10px] text-orange-500 font-bold mt-1">= {renderCurrency(annualMarginGap)} de bénéfice en plus</p>
            </div>
          </div>

          {/* Barre run-rate vs objectif annuel */}
          <div className="mb-4">
            <div className="flex justify-between text-xs font-bold mb-1.5">
              <span className="text-slate-500 uppercase tracking-wider">Run-rate vs Objectif annuel</span>
              <span className={`font-mono ${willReachAnnual ? 'text-emerald-600' : 'text-orange-600'}`}>{isSecretMode ? '**' : runRateProgress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-1000 ${willReachAnnual ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${runRateProgress}%` }}></div>
            </div>
          </div>

          {/* Verdict annuel */}
          <div className={`p-4 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${willReachAnnual ? 'bg-emerald-50/60 border-emerald-100' : 'bg-orange-50/60 border-orange-100'}`}>
            <p className="text-sm font-bold text-slate-700">
              {totalProjAnnual === 0
                ? '🎯 Fixe tes budgets mensuels ci-dessous pour activer la projection annuelle.'
                : willReachAnnual
                  ? `✅ Au rythme actuel, tu dépasses ton objectif annuel de ${renderCurrency(Math.max(0, runRateAnnual - totalProjAnnual))}. Monte tes projections !`
                  : monthsRemaining > 0
                    ? `⚠️ Pour atteindre ${renderCurrency(totalProjAnnual)} cette année, il te faut ${renderCurrency(neededPerMonth)}/mois sur les ${monthsRemaining} mois restants (rythme actuel : ${renderCurrency(totalActualMonthlyAvg)}/mois).`
                    : `Année terminée : ${renderCurrency(totalActualAnnual)} encaissés sur ${renderCurrency(totalProjAnnual)} d'objectif.`}
            </p>
            <div className="text-right shrink-0">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Reste à encaisser sur l'objectif</p>
              <p className="text-lg font-black font-mono text-slate-800">{renderCurrency(annualRemaining)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ TUILES PAR MARCHÉ + MARGE ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {LP_MARKETS.map(m => (
          <div key={m.id} className={`bg-white px-6 py-5 rounded-3xl border ${m.border} shadow-sm`}>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex justify-between items-center">{m.flag} Marché {m.id} · {m.label} <Globe size={14} /></p>
            <p className={`text-2xl font-black font-mono ${m.text}`}>{renderCurrency(marketTotals[m.id] * (isYearView ? 12 : 1))}<span className="text-xs font-bold text-slate-400">{periodLabel}</span></p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">{isYearView ? `Soit ${renderCurrency(marketTotals[m.id])}/mois` : `Soit ${renderCurrency(marketTotals[m.id] * 12)}/an`}</p>
          </div>
        ))}
        <div className="bg-white px-6 py-5 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex justify-between items-center">Marge cible <TrendingUp size={14} /></p>
          <div className="flex items-center gap-1">
            <input
              type="number" min={0} max={100}
              key={`margin-${marginPct}`}
              defaultValue={marginPct}
              onBlur={e => { const val = Number(e.target.value); if (!isNaN(val) && val !== marginPct) saveMargin(val); }}
              className="w-16 bg-transparent text-2xl font-black text-emerald-600 font-mono outline-none border-b-2 border-transparent hover:border-emerald-200 focus:border-emerald-500 transition-colors"
            />
            <span className="text-2xl font-black text-emerald-600 font-mono">%</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-1">Utilisée pour tous les calculs de bénéfice</p>
        </div>
      </div>

      {/* ═══ AJOUT EN MASSE (BULK, montants mensuels) ═══ */}
      <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <h3 className="font-extrabold text-slate-800 font-poppins text-lg flex items-center gap-2 mb-4"><Wand2 size={20} style={{ color: BRAND_COLOR }} /> Projection en masse (Bulk)</h3>
        <div className="flex flex-col md:flex-row gap-3 md:items-end flex-wrap">
          <div className="flex-1 min-w-[150px]">
            <label className={UI.label}>Budget mensuel (CHF/mois)</label>
            <input type="number" value={bulkAmount} onChange={e => setBulkAmount(e.target.value)} className={`${UI.input} font-extrabold text-[#01189B]`} placeholder="Ex: 5000" />
            {Number(bulkAmount) > 0 && <p className="text-[10px] text-emerald-600 font-bold mt-1">= {formatCurrency(Number(bulkAmount) * 12)}/an par case</p>}
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className={UI.label}>Verticales ciblées</label>
            <select value={bulkScope} onChange={e => setBulkScope(e.target.value)} className={UI.input}>
              <option value="all">🌐 Toutes les verticales</option>
              {LP_UNIVERSES.filter(u => u.id !== 'autres').map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className={UI.label}>Marché</label>
            <select value={bulkMarket} onChange={e => setBulkMarket(e.target.value)} className={UI.input}>
              <option value="all">🇨🇭 Les 3 marchés</option>
              {LP_MARKETS.map(m => <option key={m.id} value={m.id}>{m.flag} {m.label}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className={UI.label}>Mode</label>
            <select value={bulkMode} onChange={e => setBulkMode(e.target.value)} className={UI.input}>
              <option value="set">Remplacer le budget</option>
              <option value="add">Ajouter au budget</option>
            </select>
          </div>
          <button onClick={applyBulk} className="text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 hover:shadow-lg transition-all shrink-0" style={{ backgroundColor: BRAND_COLOR }}><Zap size={16} /> Appliquer</button>
          <button onClick={resetAll} className="text-red-500 bg-red-50 border border-red-100 hover:bg-red-100 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shrink-0"><Trash2 size={16} /> Reset</button>
        </div>
        <p className="text-[10px] text-slate-400 font-medium mt-3 flex items-center gap-1.5"><Info size={12} /> Les montants saisis sont des budgets MENSUELS (comme ta facturation client). Exemple : 5'000 CHF/mois sur « Prévoyance & Assurance » × « Les 3 marchés » = 24 cases, soit 1.44M CHF/an d'objectif.</p>
      </div>

      {/* ═══ TABLEAUX PAR UNIVERS ═══ */}
      {LP_UNIVERSES.map(u => {
        const uRows = rows.filter(r => r.v.universe === u.id);
        if (uRows.length === 0) return null;
        const uActual = uRows.reduce((a, r) => a + r.actualShown, 0);
        const uProj = uRows.reduce((a, r) => a + r.objShown, 0);
        return (
          <div key={u.id} className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center flex-wrap gap-2">
              <h3 className="font-extrabold text-slate-800 font-poppins text-lg">{u.label}</h3>
              <div className="flex gap-4 text-xs font-bold">
                <span className="text-slate-500">{isYearView ? 'Encaissé' : 'Réel moyen'} : <span className="text-[#01189B] font-mono">{renderCurrency(uActual)}{periodLabel}</span></span>
                <span className="text-slate-500">Objectif : <span className="text-orange-600 font-mono">{renderCurrency(uProj)}{periodLabel}</span></span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white text-slate-500 uppercase font-extrabold text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-4 min-w-[190px]">Verticale</th>
                    <th className="px-4 py-4 text-right">{isYearView ? 'CA Encaissé (an)' : 'CA Réel (/mois)'}</th>
                    {LP_MARKETS.map(m => <th key={m.id} className="px-3 py-4 text-center">{m.flag} {m.id} <span className="normal-case font-medium text-slate-300">(/mois)</span></th>)}
                    <th className="px-4 py-4 text-right">Objectif {isYearView ? 'Annuel' : 'Mensuel'}</th>
                    <th className="px-4 py-4 min-w-[140px]">Progression</th>
                    <th className="px-4 py-4 text-right">💎 À aller chercher</th>
                    <th className="px-4 py-4 text-right">Bénéfice Pot.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {uRows.map(r => (
                    <tr key={r.v.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-800">
                        <span className="text-lg mr-2">{r.v.emoji}</span>{r.v.label}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-[#01189B]">{r.actualShown > 0 ? renderCurrency(r.actualShown) : <span className="text-slate-300">—</span>}</td>
                      {LP_MARKETS.map(m => (
                        <td key={m.id} className="px-3 py-3.5 text-center">
                          {r.v.id === 'autres' ? <span className="text-slate-300">—</span> : (
                            <input
                              type="number"
                              key={`${r.v.id}-${m.id}-${r.perMarket[m.id]}`}
                              defaultValue={r.perMarket[m.id] || ''}
                              onBlur={e => setProj(r.v.id, m.id, e.target.value)}
                              className={`w-20 text-center font-mono font-bold text-xs p-1.5 rounded-lg border-2 outline-none transition-colors ${r.perMarket[m.id] > 0 ? `${m.bg} ${m.border} ${m.text}` : 'bg-slate-50 border-slate-100 text-slate-400'} focus:border-[#01189B] focus:bg-white`}
                              placeholder="0"
                            />
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3.5 text-right">
                        <p className="font-mono font-extrabold text-orange-600">{r.objShown > 0 ? renderCurrency(r.objShown) : <span className="text-slate-300">—</span>}</p>
                        {r.projMonthly > 0 && <p className="text-[9px] text-slate-400 font-medium">{isYearView ? `${formatCurrency(r.projMonthly)}/mois` : `${formatCurrency(r.projAnnual)}/an`}</p>}
                      </td>
                      <td className="px-4 py-3.5">
                        {r.objShown > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden min-w-[60px]">
                              <div className={`h-full rounded-full transition-all duration-700 ${r.progress >= 100 ? 'bg-emerald-500' : 'bg-[#01189B]'}`} style={{ width: `${r.progress}%` }}></div>
                            </div>
                            <span className="text-[10px] font-black text-slate-500 w-9 text-right">{isSecretMode ? '**' : r.progress.toFixed(0)}%</span>
                          </div>
                        ) : <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Pas d'objectif</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-extrabold text-slate-800">{r.gap > 0 ? renderCurrency(r.gap) : (r.objShown > 0 ? <span className="text-emerald-500 font-bold text-xs uppercase">✅ Atteint</span> : <span className="text-slate-300">—</span>)}</td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-600">{r.gap > 0 ? renderCurrency(r.marginPot) : <span className="text-slate-300">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* ═══ RÉCAP FINAL ANNUEL ═══ */}
      <div className="bg-white rounded-3xl border-2 border-emerald-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 text-2xl shrink-0">🏁</div>
          <div>
            <p className="font-extrabold text-slate-800 font-poppins text-lg">Si tu tiens 100% de tes budgets mensuels sur les 3 marchés :</p>
            <p className="text-sm text-slate-500 font-medium mt-0.5">CA : <b className="text-[#01189B]">{renderCurrency(totalProjMonthly)}/mois</b> soit <b className="text-[#01189B]">{renderCurrency(totalProjAnnual)}/an</b> · Bénéfice : <b className="text-emerald-600">{renderCurrency(totalProjMonthly * (marginPct / 100))}/mois</b> soit <b className="text-emerald-600">{renderCurrency(annualTargetMargin)}/an</b></p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex items-center justify-end gap-1"><Wallet size={12} /> Bénéfice annuel cible ({marginPct}%)</p>
          <p className="text-3xl font-black text-emerald-600 font-poppins">{renderCurrency(annualTargetMargin)}</p>
        </div>
      </div>

      <p className="text-[10px] text-slate-400 font-medium bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-start gap-1.5"><Info size={12} className="shrink-0 mt-0.5" /> Le CA encaissé est rattaché automatiquement à chaque verticale via le produit et les lignes de tes factures payées (mots-clés : 3P, LPP, LAMal, hypothèque, etc.). Une facture non reconnue apparaît dans « 🧩 Autres ». Le run-rate annualise ta moyenne mensuelle réelle ({monthsElapsed} mois écoulés sur {currentYear}) pour projeter ta fin d'année.</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CONNEXION AU FICHIER PRINCIPAL (App.tsx)

   Rien ne change par rapport à la v1 : si ton App.tsx est déjà
   branché (import + onglet Rocket dans le nav + route dans le
   <main>), remplace simplement ce fichier PotentialVerticals.tsx
   par cette version et c'est tout.

   Rappel des 3 branchements si besoin :
   1) import PotentialVerticals from './PotentialVerticals';
   2) { id: 'potential', label: 'Potentiel Verticales', icon: Rocket },
      (après la ligne 'kpi' du nav, + Rocket dans l'import lucide-react)
   3) {activeView === 'potential' && ( <PotentialVerticals ...props onSave={...} /> )}
      (après {activeView === 'kpi' && renderKPI()})
   ═══════════════════════════════════════════════════════════ */