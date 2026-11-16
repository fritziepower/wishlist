// Small helpers: DOM builder, translations, icons, image resizing.

// ---------- DOM builder: h('div', {class:'x', onClick: fn}, child, child...) ----------
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  let deferredValue;
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'value') deferredValue = v;                       // set after <option>s exist
    else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected') el[k] = !!v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  if (deferredValue !== undefined) el.value = deferredValue;
  return el;
}

// ---------- translations ----------
// The English text IS the key. To add a language, add a dictionary to DICT (see Italian below).
// Anything missing falls back to English. ONE holds the singular for texts with a count {n}.
const DICT = {};
const ONE = { en: {
  "{n} still available": "1 still available",
  "{n} wishes": "1 wish",
  "{n} members": "1 member",
  "{n} wishes shared": "1 wish shared",
} };

DICT.it = {
  "Cancel": "Annulla",
  "Copied": "Copiato",
  "Something went wrong.": "Qualcosa è andato storto.",
  "My list": "La mia lista",
  "Groups": "Gruppi",
  "Settings": "Impostazioni",
  "Demo mode: nothing is shared or saved online.": "Modalità demo: niente viene condiviso o salvato online.",
  "Back": "Indietro",
  "Main": "Principale",
  "Really want": "Lo voglio proprio",
  "Order details & notes": "Dettagli dell'ordine e note",
  "Hide details": "Nascondi dettagli",
  "Shared with {names}": "Condiviso con {names}",
  "Private": "Privato",
  "Open link": "Apri il link",
  "Move up": "Sposta su",
  "Move down": "Sposta giù",
  "Edit": "Modifica",
  "{name} is buying this": "{name} lo sta comprando",
  "Someone is buying this": "Qualcuno lo sta comprando",
  "You're buying this": "Lo stai comprando tu",
  "Marked. {name} will not see this.": "Fatto! {name} non vedrà nulla.",
  "Removed. Others can buy this again.": "Annullato. Gli altri possono comprarlo di nuovo.",
  "Buy here": "Compra qui",
  "I'll buy this": "Lo compro io",
  "Undo": "Annulla",
  "Taken": "Preso",
  "On iPhone: tap the Share button, then \"Add to Home Screen\", and open Wishlist from there. The Home Screen app keeps its own data, so do this before you enter your name.": "Su iPhone: tocca il pulsante Condividi, poi \"Aggiungi alla schermata Home\" e apri Wishlist da lì. L'app sulla schermata Home conserva i suoi dati, quindi fallo prima di inserire il tuo nome.",
  "e.g. Giulia": "es. Giulia",
  "Optional": "Facoltativo",
  "Your name is saved, but that invite code was not found.": "Il tuo nome è stato salvato, ma il codice d'invito non è stato trovato.",
  "Your name": "Il tuo nome",
  "Invite code": "Codice d'invito",
  "Got a code from a family member? Enter it here, or join a group later.": "Hai ricevuto un codice da un familiare? Inseriscilo qui, oppure unisciti a un gruppo più tardi.",
  "Get started": "Inizia",
  "Moved to a new phone? Use your recovery code": "Hai cambiato telefono? Usa il tuo codice di recupero",
  "Welcome back, {name}": "Ciao di nuovo, {name}!",
  "Recovery code": "Codice di recupero",
  "You can find it in Settings on your old phone.": "Lo trovi in Impostazioni sul tuo vecchio telefono.",
  "Restore my account": "Recupera il mio account",
  "Gifts with the surprise intact": "Regali con la sorpresa intatta",
  "Keep a wishlist, share it with your family, and let them claim what they'll buy. You'll never see what's been bought.": "Tieni una lista dei desideri, condividila con la famiglia e lascia che gli altri scelgano cosa comprare. Tu non vedrai mai cosa è stato comprato.",
  "Save your recovery code": "Salva il tuo codice di recupero",
  "If you change or lose your phone, this code brings your wishlist back. Keep it somewhere safe, like a note or a message to yourself. You can find it again in Settings.": "Se cambi o perdi il telefono, questo codice ti restituisce la tua lista. Conservalo in un posto sicuro, come una nota o un messaggio a te stesso. Lo ritrovi sempre in Impostazioni.",
  "Copy": "Copia",
  "I've saved it": "L'ho salvato",
  "Only people in your groups see what you share. You'll never see what has been bought.": "Solo le persone dei tuoi gruppi vedono ciò che condividi. Tu non vedrai mai cosa è stato comprato.",
  "Share your list": "Condividi la tua lista",
  "{n} of {total} wishes shared": "Condivisi: {n} su {total}",
  "To share only some wishes, open a wish and choose where it shows.": "Per condividere solo alcuni desideri, apri un desiderio e scegli dove mostrarlo.",
  "Nothing here yet": "Ancora niente qui",
  "Add something you'd love to get. It stays private until you share it.": "Aggiungi qualcosa che ti piacerebbe ricevere. Resta privato finché non lo condividi.",
  "Add your first wish": "Aggiungi il tuo primo desiderio",
  "My wishlist": "La mia lista dei desideri",
  "{n} wishes": "{n} desideri",
  "Reorder wishes": "Riordina i desideri",
  "Add wish": "Aggiungi desiderio",
  "That wish no longer exists.": "Questo desiderio non esiste più.",
  "Paste a full link, starting with https://": "Incolla un link completo, che inizi con https://",
  "Filled in from the link. Check it and change anything you like.": "Compilato dal link. Controlla e cambia quello che vuoi.",
  "Couldn't read that page. You can fill in the details yourself.": "Non sono riuscito a leggere quella pagina. Puoi compilare i dettagli a mano.",
  "Add a title first.": "Aggiungi prima un titolo.",
  "Wish added": "Desiderio aggiunto",
  "Changes saved": "Modifiche salvate",
  "Delete this wish?": "Eliminare questo desiderio?",
  "It disappears from your list and from every group.": "Sparirà dalla tua lista e da tutti i gruppi.",
  "Delete": "Elimina",
  "Wish deleted": "Desiderio eliminato",
  "Type": "Tipo",
  "What kind of wish is it?": "Che tipo di desiderio è?",
  "Link to the product": "Link al prodotto",
  "Link (optional)": "Link (facoltativo)",
  "Reading the link…": "Leggo il link…",
  "Fill in from link": "Compila dal link",
  "Title": "Titolo",
  "What would you love?": "Cosa ti piacerebbe?",
  "Picture": "Immagine",
  "Replace": "Sostituisci",
  "Upload photo": "Carica foto",
  "Or pick an emoji": "Oppure scegli un'emoji",
  "Emoji": "Emoji",
  "Price": "Prezzo",
  "Amount or budget": "Importo o budget",
  "How much do you want it?": "Quanto lo desideri?",
  "Nice to have": "Sarebbe bello",
  "Order details": "Dettagli dell'ordine",
  "Size, colour or anything the buyer needs to get it right.": "Taglia, colore o qualsiasi cosa serva a chi compra per scegliere giusto.",
  "Label": "Nome",
  "Value": "Valore",
  "Remove detail": "Rimuovi dettaglio",
  "Custom": "Personalizzato",
  "Notes": "Note",
  "Anything else the buyer should know": "Altro che chi compra dovrebbe sapere",
  "Who can see this?": "Chi può vederlo?",
  "Private unless you choose a group.": "Privato, a meno che tu non scelga un gruppo.",
  "Only you, for now. Create or join a group to share it.": "Per ora solo tu. Crea un gruppo o unisciti a uno per condividerlo.",
  "Save changes": "Salva le modifiche",
  "Delete this wish": "Elimina questo desiderio",
  "New wish": "Nuovo desiderio",
  "Edit wish": "Modifica desiderio",
  "Create a group": "Crea un gruppo",
  "Group name": "Nome del gruppo",
  "e.g. Family": "es. Famiglia",
  "Create group": "Crea gruppo",
  "Group created": "Gruppo creato",
  "Join a group": "Unisciti a un gruppo",
  "Join group": "Unisciti al gruppo",
  "Ask the person who made the group for the code.": "Chiedi il codice a chi ha creato il gruppo.",
  "You joined the group": "Ti sei unito al gruppo",
  "Join with code": "Unisciti con un codice",
  "{n} members": "{n} membri",
  "No groups yet": "Ancora nessun gruppo",
  "Create a group for your family, then share the invite code. Or join one with a code.": "Crea un gruppo per la tua famiglia e poi condividi il codice d'invito. Oppure unisciti a uno con un codice.",
  "You are not in that group.": "Non fai parte di questo gruppo.",
  "{name} (you)": "{name} (tu)",
  "{n} wishes shared": "{n} desideri condivisi",
  "Nothing shared yet": "Ancora niente di condiviso",
  "Remove {name}": "Rimuovi {name}",
  "Remove {name}?": "Rimuovere {name}?",
  "They will no longer see this group or the lists shared in it.": "Non vedrà più questo gruppo né le liste condivise al suo interno.",
  "Removed": "Rimosso",
  "Invite someone": "Invita qualcuno",
  "Join \"{name}\" on Wishlist with this code: {code}": "Unisciti a \"{name}\" su Wishlist con questo codice: {code}",
  "Share": "Condividi",
  "Tell them to add Wishlist to their Home Screen first, then enter the code.": "Di' di aggiungere prima Wishlist alla schermata Home, poi di inserire il codice.",
  "They enter the code when they join, or in Groups → Join with code.": "Inseriscono il codice quando si uniscono, oppure in Gruppi → Unisciti con un codice.",
  "Make a new code?": "Creare un nuovo codice?",
  "The old code stops working. People already in the group stay in.": "Il vecchio codice smette di funzionare. Chi è già nel gruppo resta dentro.",
  "Make new code": "Crea nuovo codice",
  "New code ready": "Nuovo codice pronto",
  "Make a new code": "Crea un nuovo codice",
  "Group settings": "Impostazioni del gruppo",
  "Show who is buying what": "Mostra chi compra cosa",
  "Members see the name of whoever claimed a gift. Turn off to show only that it is taken.": "I membri vedono il nome di chi ha scelto un regalo. Disattiva per mostrare solo che è già preso.",
  "Rename group": "Rinomina il gruppo",
  "Save": "Salva",
  "Leave {name}?": "Lasciare {name}?",
  "Your wishes will no longer be visible here. You can join again with the code.": "I tuoi desideri non saranno più visibili qui. Puoi rientrare con il codice.",
  "Leave group": "Lascia il gruppo",
  "You left the group": "Hai lasciato il gruppo",
  "Wishlists": "Liste dei desideri",
  "Tap \"I'll buy this\" so nobody else gets the same gift. {name} can't see which gifts are taken.": "Tocca \"Lo compro io\" così nessun altro prenderà lo stesso regalo. {name} non può vedere quali regali sono presi.",
  "{name} hasn't shared any wishes with this group.": "{name} non ha condiviso desideri con questo gruppo.",
  "{name}'s wishlist": "La lista di {name}",
  "Initial": "Iniziale",
  "Your profile": "Il tuo profilo",
  "Name": "Nome",
  "Your name cannot be empty.": "Il nome non può essere vuoto.",
  "Saved": "Salvato",
  "Save name": "Salva il nome",
  "Use this to get your wishlist back if you change phones or clear the app.": "Usalo per riavere la tua lista se cambi telefono o cancelli l'app.",
  "Show my recovery code": "Mostra il mio codice di recupero",
  "Privacy": "Privacy",
  "Your wishes are private until you share them with a group. People in the group can mark gifts they'll buy. That information is never sent to you, and the app has no notifications about it.": "I tuoi desideri sono privati finché non li condividi con un gruppo. Le persone del gruppo possono segnare i regali che compreranno. Questa informazione non ti viene mai inviata e l'app non ha notifiche al riguardo.",
  "Delete my data": "Elimina i miei dati",
  "Removes your name, your wishes and your group memberships from this app.": "Rimuove da questa app il tuo nome, i tuoi desideri e le tue iscrizioni ai gruppi.",
  "Delete everything?": "Eliminare tutto?",
  "This can't be undone. Your recovery code will stop working too.": "Non si può annullare. Anche il tuo codice di recupero smetterà di funzionare.",
  "Your data was deleted": "I tuoi dati sono stati eliminati",
  "Loading": "Caricamento",
  "Something went wrong": "Qualcosa è andato storto",
  "That didn't work": "Non ha funzionato",
  "Try again": "Riprova",
  "Wishlist can't start": "Wishlist non riesce ad avviarsi",
  "Join this group?": "Unirti a questo gruppo?",
  "Invite code {code}": "Codice d'invito {code}",
  "Product link": "Link a un prodotto",
  "Gift card": "Carta regalo",
  "Money contribution": "Contributo in denaro",
  "Experience": "Esperienza",
  "Other": "Altro",
  "Remove": "Rimuovi",
  "Press and hold a wish, then drag it to reorder.": "Tieni premuto un desiderio e trascinalo per riordinare.",
  "Group menu": "Menu del gruppo",
  "People": "Persone",
  "Gifts": "Regali",
  "Gifts shared": "Regali condivisi",
  "Gifts taken": "Regali presi",
  "Still available": "Ancora disponibili",
  "You're buying {n}": "Ne stai comprando {n}",
  "All taken": "Tutti presi",
  "{n} still available": "{n} ancora disponibili",
  "I'm buying": "Li compro io",
  "Everything": "Tutto",
  "for {name}": "per {name}",
  "Nothing to show": "Niente da mostrare",
  "When others share their wishes, they appear here.": "Quando gli altri condividono i desideri, appaiono qui.",
  "Try another filter.": "Prova un altro filtro.",
  "Just you so far": "Per ora ci sei solo tu",
  "Invite your family to see their wishes here.": "Invita la tua famiglia per vedere qui i loro desideri.",
  "Done": "Fatto",
  "Members": "Membri",
  "Which store?": "Da quale negozio?",
  "e.g. Amazon, Feltrinelli": "es. Amazon, Feltrinelli",
  "The link reader isn't switched on yet (step 4 of the setup guide). I made a title from the link instead.": "Il lettore di link non è ancora attivo (passo 4 della guida). Ho creato un titolo dalle parole del link.",
  "This shop doesn't let Wishlist read its page. I made a title from the link. Add a photo yourself.": "Questo negozio non permette a Wishlist di leggere la sua pagina. Ho creato un titolo dal link. Aggiungi tu una foto.",
  "Size": "Taglia",
  "Shoe size": "Numero di scarpe",
  "Colour": "Colore",
  "Quantity": "Quantità",
  "Model": "Modello",
  "Invalid invite code": "Codice d'invito non valido",
  "Recovery code not found": "Codice di recupero non trovato",
  "Someone already claimed this": "Qualcuno lo ha già preso",
  "You cannot claim your own item": "Non puoi scegliere un tuo stesso desiderio",
  "This device already has its own wishlist": "Questo dispositivo ha già una sua lista",
  "Item not found": "Desiderio non trovato",
  "Can't reach the server. Check your internet connection.": "Server non raggiungibile. Controlla la connessione a internet.",
  "Create a profile first": "Crea prima un profilo",
  "Only the group creator can do this": "Solo chi ha creato il gruppo può farlo",
  "Not signed in": "Accesso non effettuato",
  "Could not read that image.": "Impossibile leggere questa immagine.",
  "Could not load the app libraries. Check your internet connection and try again.": "Impossibile caricare l'app. Controlla la connessione a internet e riprova.",
};
ONE.it = {
  "{n} still available": "1 ancora disponibile",
  "{n} wishes": "1 desiderio",
  "{n} members": "1 membro",
  "{n} wishes shared": "1 desiderio condiviso",
};

const lang = (navigator.language || 'en').slice(0, 2).toLowerCase();
if (DICT[lang]) document.documentElement.lang = lang;
export function t(text, vars) {
  const one = vars && vars.n === 1 ? (ONE[lang] || ONE.en)[text] : null;
  let s = one || (DICT[lang] && DICT[lang][text]) || text;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

// ---------- icons (24px stroke icons) ----------
const PATHS = {
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M7.5 8a2.5 2.5 0 1 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 1 1 0 5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.3c2 .7 3.5 2.5 3.5 5.2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  up: '<path d="M6 14l6-6 6 6"/>',
  down: '<path d="M6 10l6 6 6-6"/>',
  share: '<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  edit: '<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z"/>',
  sort: '<path d="M7 4v16M3.5 16.5L7 20l3.5-3.5M17 20V4M13.5 7.5L17 4l3.5 3.5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2l-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
};
export function icon(name, size = 22) {
  const span = document.createElement('span');
  span.className = 'ico';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${PATHS[name] || ''}</svg>`;
  return span;
}

// ---------- item types ----------
export const TYPES = [
  { id: 'product', label: 'Product link', emoji: '🎁' },
  { id: 'gift_card', label: 'Gift card', emoji: '💳' },
  { id: 'money', label: 'Money contribution', emoji: '💶' },
  { id: 'experience', label: 'Experience', emoji: '🎟️' },
  { id: 'other', label: 'Other', emoji: '✨' },
];
export const typeInfo = (id) => TYPES.find((x) => x.id === id) || TYPES[4];

// ---------- avatars ----------
const AVATAR_COLORS = ['#FFB3C7', '#FFD98A', '#A8E6CF', '#B8C4FF', '#FFC8A2', '#D9B8FF'];
export function avatar(person, size = 40) {
  const name = person?.name || '?';
  let n = 0;
  for (const ch of name) n = (n * 31 + ch.codePointAt(0)) % 997;
  const el = h('span', {
    class: 'avatar',
    style: { width: size + 'px', height: size + 'px', fontSize: size * 0.46 + 'px', background: AVATAR_COLORS[n % AVATAR_COLORS.length] },
    'aria-hidden': 'true',
  }, person?.avatar || [...name][0].toUpperCase());
  return el;
}

// ---------- images: shrink a photo before upload ----------
export function resizeImage(file, max = 1000, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that image.'))), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')); };
    img.src = url;
  });
}

export const blobToDataUrl = (blob) =>
  new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });

// A readable title made from the words in a product link, for shops that block page reading.
export function titleFromUrl(url) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      const seg = decodeURIComponent(parts[i]).replace(/\.(html?|php|aspx?)$/i, '');
      if (!/[a-z]{3,}/i.test(seg) || (/\d/.test(seg) && !/[-_+ ]/.test(seg)) || /^(p|dp|product|products|prodotto|prodotti|item|it_it|en_us|en_gb)$/i.test(seg)) continue;
      const words = seg.replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (words.length >= 4) return words.charAt(0).toUpperCase() + words.slice(1, 120);
    }
  } catch { /* not a valid link */ }
  return '';
}

// Amazon links carry a long tracking tail. Keep just the product: https://www.amazon.it/dp/ASIN
export function cleanProductUrl(url) {
  try {
    const u = new URL(String(url).trim());
    if (/(^|\.)amazon\.[a-z.]{2,6}$/i.test(u.hostname)) {
      const m = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i);
      if (m) return `${u.origin}/dp/${m[1].toUpperCase()}`;
    }
  } catch { /* not a valid link: leave it alone */ }
  return String(url).trim();
}

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
