import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, KanbanSquare, Settings, Plus, Search, 
  Phone, Mail, MoreVertical, ChevronRight, DollarSign, 
  FileText, Package, Printer, Trash2, Bell, AlertCircle, Palette, Building, Cloud, Loader
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, setDoc
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';

// TES CLES FIREBASE (Déjà configurées)
const firebaseConfig = {
  apiKey: "AIzaSyDY6zXLeebKhMxL_2_mfQOYV44JuoCArK0",
  authDomain: "crm-leadpartner.firebaseapp.com",
  projectId: "crm-leadpartner",
  storageBucket: "crm-leadpartner.firebasestorage.app",
  messagingSenderId: "588502456936",
  appId: "1:588502456936:web:5c509a0c418f34f77239dd",
  measurementId: "G-6QM0LM69Z1"
};

let app, db, auth;
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  console.error("Erreur init Firebase:", e);
}

const APP_ID = 'leadpartner-crm-v2';

const defaultSettings = {
  companyName: "LeadPartner.ch",
  address: "Avenue de l'Innovation 42\n1000 Lausanne",
  email: "info@leadpartner.ch",
  phone: "+41 21 000 00 00",
  iban: "CH50 0900 0000 0000 0000 0",
  logoUrl: "",
  primaryColor: "#2563eb",
  font: "font-sans"
};

export default function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const [settings, setSettings] = useState(defaultSettings);
  const [contacts, setContacts] = useState([]);
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [showModal, setShowModal] = useState(null);
  const [currentInvoice, setCurrentInvoice] = useState(null);
  
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
          signInAnonymously(auth).catch(err => {
                console.error("Erreur Auth:", err);
                setAuthError("Erreur d'authentification. Vérifiez que le mode 'Anonyme' est activé dans Firebase.");
                setLoading(false);
            });
      } else {
          setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const basePath = `artifacts/${APP_ID}/users/${user.uid}`;

    const unsubContacts = onSnapshot(collection(db, `${basePath}/contacts`), (snap) => setContacts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubProducts = onSnapshot(collection(db, `${basePath}/products`), (snap) => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubInvoices = onSnapshot(collection(db, `${basePath}/invoices`), (snap) => setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSettings = onSnapshot(doc(db, `${basePath}/config`, 'general'), (docSnap) => {
      if (docSnap.exists()) setSettings({ ...defaultSettings, ...docSnap.data() });
    });

    return () => { unsubContacts(); unsubProducts(); unsubInvoices(); unsubSettings(); };
  }, [user]);

  const calculateTotals = () => {
      const currentMonth = new Date().getMonth();
      const monthInvoices = invoices.filter(inv => new Date(inv.date).getMonth() === currentMonth);
      const ca = monthInvoices.reduce((acc, inv) => acc + (inv.amount || 0), 0);
      const cout = monthInvoices.reduce((acc, inv) => acc + (inv.cost || 0), 0);
      return { ca, benefice: ca - cout };
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.target);
    await addDoc(collection(db, `artifacts/${APP_ID}/users/${user.uid}/contacts`), {
      name: fd.get('name'),
      company: fd.get('company'),
      email: fd.get('email'),
      status: 'nouveau',
      type: 'prospect',
      value: Number(fd.get('value')) || 0,
      createdAt: new Date().toISOString()
    });
    setShowModal(null);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.target);
    await addDoc(collection(db, `artifacts/${APP_ID}/users/${user.uid}/products`), {
      name: fd.get('name'),
      price: Number(fd.get('price')),
      cost: Number(fd.get('cost')),
      description: fd.get('description')
    });
    setShowModal(null);
  };

  const handleSaveInvoice = async () => {
    if (!user || !currentInvoice.clientId) return alert("Client requis");
    
    const items = currentInvoice.items;
    const totalHT = items.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const totalCost = items.reduce((acc, item) => acc + ((item.cost || 0) * item.qty), 0);
    const client = contacts.find(c => c.id === currentInvoice.clientId);
    
    const invoiceData = {
      date: currentInvoice.date,
      clientId: currentInvoice.clientId,
      clientName: client ? client.company : 'Inconnu',
      items, amount: totalHT, cost: totalCost,
      status: currentInvoice.id ? currentInvoice.status : 'attente'
    };

    if (!currentInvoice.id) {
       const newId = `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`;
       await setDoc(doc(db, `artifacts/${APP_ID}/users/${user.uid}/invoices`, newId), { ...invoiceData, id: newId });
    } else {
       await updateDoc(doc(db, `artifacts/${APP_ID}/users/${user.uid}/invoices`, currentInvoice.id), invoiceData);
    }
    setShowModal(null);
  };

  const deleteItem = async (col, id) => {
    if(confirm("Supprimer ?")) await deleteDoc(doc(db, `artifacts/${APP_ID}/users/${user.uid}/${col}`, id));
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    await setDoc(doc(db, `artifacts/${APP_ID}/users/${user.uid}/config`, 'general'), settings);
    alert("Réglages sauvegardés !");
  };

  const styles = { primary: { backgroundColor: settings.primaryColor }, textPrimary: { color: settings.primaryColor } };

  if (authError) return <div className="h-screen flex items-center justify-center p-6 text-center text-red-600 font-bold bg-slate-50">{authError}</div>;
  if (loading) return <div className="h-screen flex items-center justify-center text-blue-600"><Loader className="animate-spin mr-2"/> Chargement...</div>;

  return (
    <div className={`flex h-screen bg-slate-50 text-slate-900 ${settings.font} font-sans`}>
      <style>{`@media print { body * { visibility: hidden; } #invoice-printable, #invoice-printable * { visibility: visible; } #invoice-printable { position: fixed; left:0; top:0; width:100%; height:100%; background:white; padding:40px; z-index:9999; } .no-print { display: none !important; } }`}</style>

      <div className="w-64 bg-white border-r border-slate-200 flex flex-col no-print">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
             <div className="h-8 w-8 rounded bg-blue-600 flex items-center justify-center text-white font-bold">LP</div>
             <span className="font-bold text-slate-800 text-sm">{settings.companyName}</span>
          </div>
          <nav className="space-y-1">
            {[{id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard}, {id: 'pipeline', label: 'Pipeline', icon: KanbanSquare}, {id: 'contacts', label: 'Contacts', icon: Users}, {id: 'products', label: 'Produits', icon: Package}, {id: 'invoices', label: 'Factures', icon: FileText}, {id: 'settings', label: 'Réglages', icon: Settings}].map(item => (
                <button key={item.id} onClick={() => setActiveView(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg ${activeView === item.id ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <item.icon size={18} style={activeView === item.id ? { color: settings.primaryColor } : {}}/> {item.label}
                </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 no-print">
            <h2 className="text-lg font-bold text-slate-800 capitalize">{activeView}</h2>
            <div className="flex gap-3">
                {activeView === 'contacts' && <button onClick={() => setShowModal('contact')} style={styles.primary} className="text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Plus size={16}/> Contact</button>}
                {activeView === 'products' && <button onClick={() => setShowModal('product')} style={styles.primary} className="text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Plus size={16}/> Produit</button>}
                {activeView === 'invoices' && <button onClick={() => { setCurrentInvoice({ clientId: '', date: new Date().toISOString().split('T')[0], items: [] }); setShowModal('invoice'); }} style={styles.primary} className="text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Plus size={16}/> Facture</button>}
            </div>
        </header>

        <main className="flex-1 overflow-auto p-8 no-print">
            {activeView === 'dashboard' && (
                <div className="grid grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Chiffre d'Affaires</p><h3 className="text-3xl font-bold text-slate-800 mt-2">{calculateTotals().ca} CHF</h3></div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Bénéfice Net</p><h3 className="text-3xl font-bold text-emerald-600 mt-2">{calculateTotals().benefice} CHF</h3></div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Clients Signés</p><h3 className="text-3xl font-bold text-blue-600 mt-2">{contacts.filter(c => c.status === 'signé').length}</h3></div>
                </div>
            )}
            {activeView === 'settings' && (<div className="max-w-2xl mx-auto space-y-6"><div className="flex justify-between items-center"><h2 className="text-xl font-bold">Réglages</h2><button onClick={handleSaveSettings} className="bg-blue-600 text-white px-4 py-2 rounded shadow">Sauvegarder</button></div><div className="bg-white p-6 rounded border space-y-4"><input value={settings.companyName} onChange={e => setSettings({...settings, companyName: e.target.value})} className="w-full border p-2 rounded" placeholder="Nom Société"/><input value={settings.email} onChange={e => setSettings({...settings, email: e.target.value})} className="w-full border p-2 rounded" placeholder="Email"/><input value={settings.logoUrl} onChange={e => setSettings({...settings, logoUrl: e.target.value})} className="w-full border p-2 rounded" placeholder="Logo URL"/></div></div>)}
            {activeView === 'contacts' && (<div className="bg-white rounded-xl border border-slate-200">{contacts.map(c => (<div key={c.id} className="flex justify-between p-4 border-b last:border-0 hover:bg-slate-50"><div><p className="font-bold">{c.name}</p><p className="text-sm text-slate-500">{c.company}</p></div><div className="flex gap-4 items-center"><span className="text-xs bg-slate-100 px-2 py-1 rounded font-bold uppercase">{c.status}</span><button onClick={() => deleteItem('contacts', c.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button></div></div>))}</div>)}
            {activeView === 'products' && (<div className="bg-white rounded-xl border border-slate-200">{products.map(p => (<div key={p.id} className="flex justify-between p-4 border-b last:border-0 hover:bg-slate-50"><div><p className="font-bold">{p.name}</p><p className="text-sm text-slate-500">{p.description}</p></div><div className="flex gap-4 items-center"><span className="font-mono">{p.price} CHF</span><button onClick={() => deleteItem('products', p.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button></div></div>))}</div>)}
            {activeView === 'invoices' && (<div className="grid gap-4">{invoices.map(inv => (<div key={inv.id} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center"><div><h4 className="font-bold">{inv.clientName}</h4><p className="text-sm text-slate-500">{inv.id}</p></div><div className="text-right"><p className="font-bold">{inv.amount} CHF</p><button onClick={() => { setCurrentInvoice(inv); setShowModal('invoice'); }} className="text-blue-600 text-sm hover:underline">Ouvrir</button></div></div>))}</div>)}
        </main>
      </div>

      {showModal === 'contact' && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white p-6 rounded-xl w-96"><h3 className="font-bold mb-4">Nouveau Contact</h3><form onSubmit={handleSaveContact} className="space-y-3"><input name="name" required placeholder="Nom" className="w-full border p-2 rounded"/><input name="company" required placeholder="Société" className="w-full border p-2 rounded"/><input name="email" placeholder="Email" className="w-full border p-2 rounded"/><button type="submit" style={styles.primary} className="w-full py-2 text-white rounded">Ajouter</button><button type="button" onClick={() => setShowModal(null)} className="w-full py-2 text-slate-500">Annuler</button></form></div></div>)}
      {showModal === 'product' && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white p-6 rounded-xl w-96"><h3 className="font-bold mb-4">Nouveau Produit</h3><form onSubmit={handleSaveProduct} className="space-y-3"><input name="name" required placeholder="Nom Service" className="w-full border p-2 rounded"/><input name="price" type="number" required placeholder="Prix Vente" className="w-full border p-2 rounded"/><input name="cost" type="number" placeholder="Coût Interne" className="w-full border p-2 rounded"/><button type="submit" style={styles.primary} className="w-full py-2 text-white rounded">Ajouter</button><button type="button" onClick={() => setShowModal(null)} className="w-full py-2 text-slate-500">Annuler</button></form></div></div>)}
      {showModal === 'invoice' && currentInvoice && (<div className="fixed inset-0 bg-slate-900/90 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col"><div className="p-4 border-b flex justify-between items-center bg-slate-50 no-print"><h3 className="font-bold">Facture</h3><div className="flex gap-2"><button onClick={() => window.print()} className="bg-slate-800 text-white px-3 py-1 rounded text-sm flex gap-2 items-center"><Printer size={16}/> Imprimer</button><button onClick={handleSaveInvoice} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Sauvegarder</button><button onClick={() => setShowModal(null)} className="text-slate-500 px-3">Fermer</button></div></div><div className="flex-1 overflow-auto p-8 bg-slate-100"><div id="invoice-printable" className="bg-white mx-auto shadow p-12 max-w-2xl text-sm"><div className="flex justify-between mb-12"><div><h1 className="text-2xl font-bold text-blue-900">FACTURE</h1><p>{currentInvoice.id || 'BROUILLON'}</p></div><div className="text-right"><p className="font-bold">{settings.companyName}</p><p>{settings.email}</p></div></div><div className="mb-8"><label className="block text-xs font-bold text-slate-400 uppercase">Client</label>{currentInvoice.id ? <span className="font-bold text-lg">{currentInvoice.clientName}</span> : <select className="border p-2 rounded w-full no-print" onChange={e => setCurrentInvoice({...currentInvoice, clientId: e.target.value})} value={currentInvoice.clientId}><option value="">Choisir un client...</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}</select>}</div><table className="w-full mb-8"><thead><tr className="border-b-2 border-slate-800"><th className="text-left py-2">Description</th><th className="text-right">Prix</th><th className="text-right">Qté</th><th className="text-right">Total</th></tr></thead><tbody>{currentInvoice.items.map((item, i) => (<tr key={i} className="border-b border-slate-100"><td className="py-2">{item.name}</td><td className="text-right">{item.price}</td><td className="text-right">{item.qty}</td><td className="text-right font-bold">{item.price * item.qty}</td></tr>))}</tbody></table><div className="no-print mb-8"><select className="border p-2 rounded w-full" onChange={(e) => {if(!e.target.value) return; const prod = products.find(p => p.id === e.target.value); setCurrentInvoice({...currentInvoice, items: [...currentInvoice.items, { ...prod, qty: 1 }]}); e.target.value = "";}}><option value="">+ Ajouter un produit</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.price} CHF)</option>)}</select></div><div className="text-right text-xl font-bold border-t pt-4">Total: {currentInvoice.items.reduce((acc, item) => acc + (item.price * item.qty), 0)} CHF</div></div></div></div></div>)}
    </div>
  );
}