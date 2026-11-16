// Two interchangeable backends with the same methods:
//   * supabase: the real thing (shared between phones)
//   * demo:     everything in this browser, with made-up family members, for trying the app
// The UI only ever talks to the methods below.

import { blobToDataUrl, hostOf } from './util.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';

export async function createBackend(cfg) {
  if (cfg && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) return makeSupabase(cfg);
  return makeDemo();
}

const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const nz = (s) => { const v = typeof s === 'string' ? s.trim() : s; return v === '' || v == null ? null : v; };

function itemPayload(it) {
  return {
    type: it.type || 'product',
    title: String(it.title || '').trim(),
    url: nz(it.url), image_url: nz(it.image_url), favicon_url: nz(it.favicon_url), site_name: nz(it.site_name),
    emoji: nz(it.emoji), price: nz(it.price), priority: it.priority === 'really' ? 'really' : 'nice',
    details: (it.details || []).map((d) => ({ label: String(d.label || '').trim(), value: String(d.value || '').trim() }))
      .filter((d) => d.label || d.value),
    notes: nz(it.notes),
  };
}

// =====================================================================
// Supabase
// =====================================================================
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.supabase) return resolve();
    const s = document.createElement('script');
    s.src = src; s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load the app libraries. Check your internet connection and try again.'));
    document.head.append(s);
  });
}

async function makeSupabase(cfg) {
  await loadScript(cfg.SUPABASE_JS || SUPABASE_JS);
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'wishlist-auth' },
  });
  let uid = null;

  const fail = (error) => {
    const m = String(error?.message || error || '');
    if (/failed to fetch|networkerror|load failed/i.test(m)) throw new Error("Can't reach the server. Check your internet connection.");
    if (/anonymous sign-ins are disabled/i.test(m)) throw new Error('Setup step missing: turn on "Allow anonymous sign-ins" in Supabase (Authentication → Sign In / Providers).');
    throw new Error(m || 'Something went wrong.');
  };
  const ok = ({ data, error }) => { if (error) fail(error); return data; };

  const ensureSession = async () => {
    const { data } = await sb.auth.getSession();
    if (data.session) { uid = data.session.user.id; return; }
    const res = ok(await sb.auth.signInAnonymously());
    uid = res.user.id;
  };
  const mapItem = (r) => ({ ...r, details: r.details || [], groups: (r.item_publications || []).map((p) => p.group_id), item_publications: undefined });

  return {
    demo: false,

    async init() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return { profile: null };
      uid = data.session.user.id;
      const profile = ok(await sb.from('profiles').select('id,name,avatar').eq('id', uid).maybeSingle());
      return { profile };
    },
    async start(name, joinCode) {
      await ensureSession();
      const recovery = ok(await sb.rpc('create_profile', { p_name: name }));
      let joinError = null;
      if (cleanCode(joinCode)) {
        const r = await sb.rpc('join_group', { p_code: joinCode });
        if (r.error) joinError = r.error.message;
      }
      return { recovery, joinError };
    },
    async recover(code) {
      await ensureSession();
      ok(await sb.rpc('recover_account', { p_code: code }));
      return (await this.init()).profile;
    },
    async getRecoveryCode() {
      return ok(await sb.from('profile_secrets').select('recovery_code').eq('user_id', uid).single()).recovery_code;
    },
    async updateMe(patch) {
      ok(await sb.from('profiles').update(patch).eq('id', uid));
    },

    async listMyItems() {
      const rows = ok(await sb.from('items').select('*, item_publications(group_id)').eq('owner_id', uid).order('position').order('created_at'));
      return rows.map(mapItem);
    },
    async saveItem(it) {
      const body = itemPayload(it);
      if (it.id) return mapItem(ok(await sb.from('items').update(body).eq('id', it.id).select().single()));
      const last = ok(await sb.from('items').select('position').eq('owner_id', uid).order('position', { ascending: false }).limit(1));
      body.owner_id = uid;
      body.position = last.length ? last[0].position + 1 : 0;
      return mapItem(ok(await sb.from('items').insert(body).select().single()));
    },
    async deleteItem(id) { ok(await sb.from('items').delete().eq('id', id)); },
    async reorder(ids) {
      await Promise.all(ids.map((id, i) => sb.from('items').update({ position: i }).eq('id', id).eq('owner_id', uid)));
    },
    async setItemGroups(itemId, groupIds) {
      const cur = ok(await sb.from('item_publications').select('group_id').eq('item_id', itemId)).map((r) => r.group_id);
      const add = groupIds.filter((g) => !cur.includes(g));
      const del = cur.filter((g) => !groupIds.includes(g));
      if (add.length) ok(await sb.from('item_publications').insert(add.map((g) => ({ item_id: itemId, group_id: g }))));
      if (del.length) ok(await sb.from('item_publications').delete().eq('item_id', itemId).in('group_id', del));
    },
    async publishAll(groupId, on) { ok(await sb.rpc('publish_all', { p_group: groupId, p_on: on })); },

    async listGroups() {
      const rows = ok(await sb.from('groups').select('*, group_members(user_id, joined_at, profiles(id,name,avatar))').order('created_at'));
      return rows.map((g) => ({
        id: g.id, name: g.name, invite_code: g.invite_code, creator_id: g.creator_id, show_claimers: g.show_claimers,
        isCreator: g.creator_id === uid,
        members: (g.group_members || []).slice().sort((a, b) => a.joined_at.localeCompare(b.joined_at))
          .map((m) => m.profiles).filter(Boolean),
      }));
    },
    async createGroup(name) { return ok(await sb.rpc('create_group', { p_name: name })); },
    async joinGroup(code) { return ok(await sb.rpc('join_group', { p_code: code })); },
    async leaveGroup(id) { ok(await sb.rpc('leave_group', { p_group: id })); },
    async removeMember(gid, userId) { ok(await sb.from('group_members').delete().eq('group_id', gid).eq('user_id', userId)); },
    async regenInvite(gid) { return ok(await sb.rpc('regenerate_invite', { p_group: gid })); },
    async updateGroup(gid, patch) { ok(await sb.from('groups').update(patch).eq('id', gid)); },

    async groupCounts(gid) {
      const rows = ok(await sb.from('item_publications').select('item_id, items!inner(owner_id)').eq('group_id', gid));
      const out = {};
      rows.forEach((r) => { const o = r.items.owner_id; out[o] = (out[o] || 0) + 1; });
      return out;
    },
    async memberList(gid, userId) {
      const rows = ok(await sb.from('items').select('*, item_publications!inner(group_id)')
        .eq('owner_id', userId).eq('item_publications.group_id', gid).order('position').order('created_at'));
      const items = rows.map(mapItem);
      const status = items.length ? ok(await sb.rpc('item_claim_status', { p_item_ids: items.map((i) => i.id) })) : [];
      const byId = Object.fromEntries(status.map((s) => [s.item_id, s]));
      return items.map((i) => {
        const s = byId[i.id];
        return { ...i, claim: { claimed: !!s?.claimed, mine: !!s?.mine, by: s?.claimed_by_name || null } };
      });
    },
    async claim(id) { ok(await sb.rpc('claim_item', { p_item: id })); },
    async unclaim(id) { ok(await sb.rpc('unclaim_item', { p_item: id })); },

    async uploadImage(blob) {
      const path = `${uid}/${crypto.randomUUID()}.jpg`;
      ok(await sb.storage.from('item-images').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' }));
      return sb.storage.from('item-images').getPublicUrl(path).data.publicUrl;
    },
    async preview(url) {
      const { data, error } = await sb.functions.invoke('link-preview', { body: { url } });
      if (error) return { ok: false };
      return data || { ok: false };
    },

    async deleteAccount() { ok(await sb.rpc('delete_my_account')); await sb.auth.signOut(); },
  };
}

// =====================================================================
// Demo (all in this browser)
// =====================================================================
function makeDemo() {
  const KEY = 'wishlist-demo-v1';
  const uuid = () => crypto.randomUUID();
  const me = 'me';
  const seed = () => {
    const P = { rosa: 'p-rosa', marco: 'p-marco', giulia: 'p-giulia' };
    const g = 'g-demo';
    const item = (owner, pos, o) => ({ id: uuid(), owner_id: owner, position: pos, type: 'product', priority: 'nice', details: [], url: null, image_url: null, favicon_url: null, site_name: null, emoji: null, price: null, notes: null, ...o });
    const items = [
      item(P.rosa, 0, { title: 'Wooden wool winder', url: 'https://example.com/wool-winder', site_name: 'example.com', emoji: '🧶', price: '35', priority: 'really', details: [{ label: 'Colour', value: 'Natural wood' }], notes: 'The hand-cranked one, not the electric one.' }),
      item(P.rosa, 1, { type: 'experience', title: 'Afternoon at the thermal baths', emoji: '♨️', price: '40–60', details: [{ label: 'Where', value: 'Anywhere with a view' }], notes: 'Happy to go with a grandchild.' }),
      item(P.marco, 0, { title: 'Guitar strings, light gauge', url: 'https://example.com/strings', site_name: 'example.com', emoji: '🎸', price: '12', details: [{ label: 'Gauge', value: '10–46' }, { label: 'Quantity', value: '2 sets' }] }),
      item(P.marco, 1, { title: 'Trail running shoes', url: 'https://example.com/shoes', site_name: 'example.com', emoji: '👟', price: '120', priority: 'really', details: [{ label: 'Shoe size', value: '43' }, { label: 'Colour', value: 'Navy' }], notes: 'Any similar model is fine.' }),
      item(P.marco, 2, { type: 'money', title: 'Towards the summer road trip', emoji: '🚐', price: '20–100', notes: 'Any amount helps!' }),
      item(P.giulia, 0, { type: 'gift_card', title: 'Bookshop gift card', emoji: '📚', price: '25', priority: 'really', notes: 'The one on the corner of the old town.' }),
      item(P.giulia, 1, { title: 'Reading lamp', url: 'https://example.com/lamp', site_name: 'example.com', emoji: '💡', price: '45', details: [{ label: 'Colour', value: 'Brass' }] }),
    ];
    const claimedItem = items.find((i) => i.title === 'Bookshop gift card');
    return {
      me: null, recovery: 'DEMO-CODE-ABCD-EFGH',
      profiles: { [P.rosa]: { id: P.rosa, name: 'Nonna Rosa', avatar: '🧶' }, [P.marco]: { id: P.marco, name: 'Marco', avatar: '🎸' }, [P.giulia]: { id: P.giulia, name: 'Giulia', avatar: '📚' } },
      groups: [{ id: g, name: 'Demo Family', invite_code: 'DEMOFAMILY', creator_id: P.rosa, show_claimers: true, members: [P.rosa, P.marco, P.giulia] }],
      items, pubs: items.map((i) => ({ item_id: i.id, group_id: g })),
      claims: [{ item_id: claimedItem.id, claimed_by: P.marco }],
    };
  };
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
  if (!db) db = seed();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* private mode: keep in memory */ } };
  const sleep = (ms = 120) => new Promise((r) => setTimeout(r, ms));
  const person = (id) => db.profiles[id];
  const myGroups = () => db.groups.filter((g) => g.members.includes(me));
  const withGroups = (i) => ({ ...i, groups: db.pubs.filter((p) => p.item_id === i.id).map((p) => p.group_id) });

  return {
    demo: true,

    async init() { await sleep(); return { profile: db.me ? person(me) : null }; },
    async start(name, joinCode) {
      await sleep();
      db.profiles[me] = { id: me, name: name.trim(), avatar: null };
      db.me = true;
      let joinError = null;
      const codes = [cleanCode(joinCode), 'DEMOFAMILY'].filter(Boolean);
      for (const c of codes) {
        const g = db.groups.find((x) => x.invite_code === c);
        if (g && !g.members.includes(me)) g.members.push(me);
        else if (!g && c === cleanCode(joinCode)) joinError = 'Invalid invite code';
      }
      save();
      return { recovery: db.recovery, joinError };
    },
    async recover(code) {
      await sleep();
      if (cleanCode(code) !== cleanCode(db.recovery)) throw new Error('Recovery code not found');
      db.profiles[me] = db.profiles[me] || { id: me, name: 'Demo user', avatar: null };
      db.me = true; save();
      return person(me);
    },
    async getRecoveryCode() { return db.recovery; },
    async updateMe(patch) { Object.assign(db.profiles[me], patch); save(); },

    async listMyItems() { await sleep(60); return db.items.filter((i) => i.owner_id === me).sort((a, b) => a.position - b.position).map(withGroups); },
    async saveItem(it) {
      await sleep();
      const body = itemPayload(it);
      if (it.id) {
        const cur = db.items.find((x) => x.id === it.id);
        Object.assign(cur, body); save(); return withGroups(cur);
      }
      const mine = db.items.filter((i) => i.owner_id === me);
      const row = { id: uuid(), owner_id: me, position: mine.length ? Math.max(...mine.map((i) => i.position)) + 1 : 0, ...body };
      db.items.push(row); save(); return withGroups(row);
    },
    async deleteItem(id) {
      db.items = db.items.filter((i) => i.id !== id);
      db.pubs = db.pubs.filter((p) => p.item_id !== id);
      db.claims = db.claims.filter((c) => c.item_id !== id);
      save();
    },
    async reorder(ids) { ids.forEach((id, i) => { const it = db.items.find((x) => x.id === id); if (it) it.position = i; }); save(); },
    async setItemGroups(itemId, groupIds) {
      db.pubs = db.pubs.filter((p) => p.item_id !== itemId);
      groupIds.forEach((g) => db.pubs.push({ item_id: itemId, group_id: g }));
      save();
    },
    async publishAll(gid, on) {
      const mine = db.items.filter((i) => i.owner_id === me).map((i) => i.id);
      db.pubs = db.pubs.filter((p) => !(p.group_id === gid && mine.includes(p.item_id)));
      if (on) mine.forEach((id) => db.pubs.push({ item_id: id, group_id: gid }));
      save();
    },

    async listGroups() {
      await sleep(60);
      return myGroups().map((g) => ({
        id: g.id, name: g.name, invite_code: g.invite_code, creator_id: g.creator_id, show_claimers: g.show_claimers,
        isCreator: g.creator_id === me, members: g.members.map(person).filter(Boolean),
      }));
    },
    async createGroup(name) {
      const g = { id: uuid(), name: name.trim(), invite_code: Math.random().toString(36).slice(2, 10).toUpperCase(), creator_id: me, show_claimers: true, members: [me] };
      db.groups.push(g); save(); return g;
    },
    async joinGroup(code) {
      const g = db.groups.find((x) => x.invite_code === cleanCode(code));
      if (!g) throw new Error('Invalid invite code');
      if (!g.members.includes(me)) g.members.push(me);
      save(); return g.id;
    },
    async leaveGroup(id) {
      const g = db.groups.find((x) => x.id === id);
      g.members = g.members.filter((m) => m !== me);
      db.pubs = db.pubs.filter((p) => !(p.group_id === id && db.items.find((i) => i.id === p.item_id)?.owner_id === me));
      if (g.creator_id === me) { if (g.members.length) g.creator_id = g.members[0]; else db.groups = db.groups.filter((x) => x !== g); }
      save();
    },
    async removeMember(gid, userId) { const g = db.groups.find((x) => x.id === gid); g.members = g.members.filter((m) => m !== userId); save(); },
    async regenInvite(gid) { const g = db.groups.find((x) => x.id === gid); g.invite_code = Math.random().toString(36).slice(2, 10).toUpperCase(); save(); return g.invite_code; },
    async updateGroup(gid, patch) { Object.assign(db.groups.find((x) => x.id === gid), patch); save(); },

    async groupCounts(gid) {
      const out = {};
      db.pubs.filter((p) => p.group_id === gid).forEach((p) => { const o = db.items.find((i) => i.id === p.item_id)?.owner_id; if (o) out[o] = (out[o] || 0) + 1; });
      return out;
    },
    async memberList(gid, userId) {
      await sleep(60);
      const g = db.groups.find((x) => x.id === gid);
      const ids = new Set(db.pubs.filter((p) => p.group_id === gid).map((p) => p.item_id));
      return db.items.filter((i) => i.owner_id === userId && ids.has(i.id)).sort((a, b) => a.position - b.position).map((i) => {
        const c = db.claims.find((x) => x.item_id === i.id);
        const mine = c?.claimed_by === me;
        // same rule as the real database: the owner of an item never gets claim data
        const claim = userId === me ? { claimed: false, mine: false, by: null }
          : { claimed: !!c, mine, by: c && (mine || g.show_claimers) ? person(c.claimed_by)?.name : null };
        return { ...i, claim };
      });
    },
    async claim(id) {
      const it = db.items.find((i) => i.id === id);
      if (it.owner_id === me) throw new Error('You cannot claim your own item');
      if (db.claims.find((c) => c.item_id === id)) throw new Error('Someone already claimed this');
      db.claims.push({ item_id: id, claimed_by: me }); save();
    },
    async unclaim(id) { db.claims = db.claims.filter((c) => !(c.item_id === id && c.claimed_by === me)); save(); },

    async uploadImage(blob) { return blobToDataUrl(blob); },
    async preview(url) {
      await sleep(500);
      const host = hostOf(url);
      return { ok: true, url, title: 'Demo product from ' + host, image: null, site_name: host, favicon: null };
    },

    async deleteAccount() {
      db.items = db.items.filter((i) => i.owner_id !== me);
      db.pubs = db.pubs.filter((p) => db.items.find((i) => i.id === p.item_id));
      db.groups.forEach((g) => { g.members = g.members.filter((m) => m !== me); });
      db.me = null; delete db.profiles[me]; save();
    },
  };
}
