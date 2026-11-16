
// Wishlist: screens, routing and glue. Data lives behind ./data.js.
import { h, t, icon, TYPES, typeInfo, avatar, resizeImage, hostOf, titleFromUrl } from './util.js';
import { createBackend } from './data.js';
 
const root = document.getElementById('app');
const S = { be: null, me: null, groups: [], reorder: false };
 
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
 
// ---------------------------------------------------------------------
// small UI helpers
// ---------------------------------------------------------------------
let toastTimer;
function toast(msg) {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: 'toast', role: 'status' }, t(msg));
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3200);
}
 
function openDialog(build) {
  return new Promise((resolve) => {
    const d = h('dialog');
    const close = (v) => { try { d.close(); } catch { /* already closed */ } d.remove(); resolve(v); };
    d.append(...[].concat(build(close)).filter(Boolean));
    d.addEventListener('cancel', () => { d.remove(); resolve(null); });
    document.body.append(d);
    d.showModal();
  });
}
const confirmDialog = ({ title, body, ok, danger }) => openDialog((close) => [
  h('h2', null, title), body && h('p', { class: 'lead' }, body),
  h('div', { class: 'actions' },
    h('button', { class: 'btn ghost', type: 'button', onClick: () => close(false) }, t('Cancel')),
    h('button', { class: 'btn' + (danger ? ' danger' : ''), type: 'button', onClick: () => close(true) }, ok)),
]).then(Boolean);
 
const promptDialog = ({ title, label, value = '', ok, placeholder = '', maxlength = 60, help }) => openDialog((close) => {
  const input = h('input', { type: 'text', value, placeholder, maxlength, autocomplete: 'off', required: true });
  const form = h('form', { onSubmit: (e) => { e.preventDefault(); const v = input.value.trim(); if (v) close(v); } },
    h('h2', null, title),
    h('label', { class: 'field' }, h('span', null, label), input), help && h('p', { class: 'hint' }, help),
    h('div', { class: 'actions' },
      h('button', { class: 'btn ghost', type: 'button', onClick: () => close(null) }, t('Cancel')),
      h('button', { class: 'btn', type: 'submit' }, ok)));
  setTimeout(() => input.focus(), 50);
  return form;
});
 
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: 0 } }, text);
    document.body.append(ta); ta.select(); try { document.execCommand('copy'); } catch { /* ignore */ } ta.remove();
  }
  toast(t('Copied'));
}
 
// run an async click handler: disables the button while it works, shows errors as a toast
const act = (fn) => async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try { await fn(e); } catch (err) { toast(err.message || t('Something went wrong.')); } finally { btn.disabled = false; }
};
 
function Switch({ label, desc, checked, onToggle }) {
  const btn = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(!!checked) },
    h('span', { class: 'txt' }, h('b', null, label), desc && h('span', { class: 'small' }, desc)), h('span', { class: 'track' }));
  btn.addEventListener('click', async () => {
    const next = btn.getAttribute('aria-checked') !== 'true';
    btn.setAttribute('aria-checked', String(next));
    try { await onToggle(next); } catch (err) { btn.setAttribute('aria-checked', String(!next)); toast(err.message); }
  });
  return btn;
}
 
const go = (hash) => { location.hash = hash; };
const mount = (node) => root.replaceChildren(node);
 
// ---------------------------------------------------------------------
// shell (top bar + tabs)
// ---------------------------------------------------------------------
function shell({ title, sub, back, actions, body, tab, fab }) {
  const tabs = [['home', '#/', 'gift', t('My list')], ['groups', '#/groups', 'users', t('Groups')], ['settings', '#/settings', 'gear', t('Settings')]];
  return h('div', { class: 'app' },
    S.be?.demo && h('div', { class: 'banner demo' }, t('Demo mode: nothing is shared or saved online.')),
    h('header', { class: 'topbar' },
      back && h('a', { class: 'icon-btn', href: back, 'aria-label': t('Back') }, icon('back')),
      h('h1', null, title, sub && h('span', { class: 'sub' }, sub)), actions),
    h('main', { class: fab ? 'has-fab' : null }, body),
    fab,
    h('nav', { class: 'tabbar', 'aria-label': t('Main') },
      tabs.map(([id, href, ic, label]) => h('a', { href, 'aria-current': tab === id ? 'page' : null }, icon(ic), label))));
}
 
function Empty(emoji, title, text, action) {
  return h('div', { class: 'empty' }, h('span', { class: 'big-emoji', 'aria-hidden': 'true' }, emoji), h('h2', null, title), h('p', null, text), action);
}
 
// ---------------------------------------------------------------------
// gift tag cards
// ---------------------------------------------------------------------
function cardImage(item) {
  const info = typeInfo(item.type);
  const fallback = () => h('span', { class: 'big-emoji', 'aria-hidden': 'true' }, item.emoji || info.emoji);
  const box = h('div', { class: 't-' + item.type + ' tag-img' }, h('span', { class: 'eyelet' }));
  if (item.image_url) {
    const img = h('img', { src: item.image_url, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', () => { img.replaceWith(fallback()); });
    box.append(img);
  } else box.append(fallback());
  return box;
}
 
function cardHead(item, extraBadges) {
  const favicon = item.favicon_url && h('img', { src: item.favicon_url, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', onError: (e) => e.target.remove() });
  const site = item.site_name || (item.url ? hostOf(item.url) : '');
  return [
    h('h2', { class: 'tag-title' }, item.title),
    h('div', { class: 'meta' },
      item.price && h('span', { class: 'price' }, /^[\d.,]+$/.test(item.price) ? '€' + item.price : item.price),
      site && h('span', { class: 'site' }, favicon, site),
      item.priority === 'really' && h('span', { class: 'badge really' }, icon('star', 14), t('Really want')),
      extraBadges),
  ];
}
 
function detailsBlock(item) {
  const rows = (item.details || []).filter((d) => d.label || d.value);
  if (!rows.length && !item.notes) return null;
  const box = h('div', { class: 'details', hidden: true },
    rows.length > 0 && h('dl', null, rows.flatMap((d) => [h('dt', null, d.label), h('dd', null, d.value)])),
    item.notes && h('p', null, item.notes));
  const label = h('span', null, t('Order details & notes'));
  const btn = h('button', { class: 'expander', type: 'button', 'aria-expanded': 'false' }, label, icon('down', 16));
  btn.addEventListener('click', () => {
    const open = box.hidden;
    box.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    label.textContent = open ? t('Hide details') : t('Order details & notes');
  });
  return [btn, box];
}
 
// the owner's own card: edit, share status, reorder. Never any claim information.
function ownerCard(item, i, all) {
  const names = item.groups.map((id) => S.groups.find((g) => g.id === id)?.name).filter(Boolean);
  const badge = names.length
    ? h('span', { class: 'badge shared' }, icon('users', 14), t('Shared with {names}', { names: names.join(', ') }))
    : h('span', { class: 'badge private' }, icon('lock', 14), t('Private'));
  const move = (dir) => async () => {
    const ids = all.map((x) => x.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    await S.be.reorder(ids);
    refresh();
  };
  return h('li', { class: 'tag-wrap' }, h('article', { class: 'tag' },
    cardImage(item),
    h('div', { class: 'tag-body' }, cardHead(item, badge), detailsBlock(item),
      h('div', { class: 'tag-actions' },
        item.url && h('a', { class: 'btn ghost small', href: item.url, target: '_blank', rel: 'noopener noreferrer' }, icon('external', 16), t('Open link')),
        S.reorder
          ? h('div', { class: 'reorder-btns' },
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('Move up'), disabled: i === 0, onClick: act(move(-1)) }, icon('up')),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('Move down'), disabled: i === all.length - 1, onClick: act(move(1)) }, icon('down')))
          : h('a', { class: 'btn soft small', style: { marginLeft: 'auto' }, href: '#/item/' + item.id }, icon('edit', 16), t('Edit'))))));
}
 
// someone else's published item: buy link, "I'll buy this", crossed out when taken
function viewerCard(item, owner) {
  const c = item.claim;
  const taken = c.claimed && !c.mine;
  const note = taken
    ? h('p', { class: 'taken-note' }, icon('check', 18), c.by ? t('{name} is buying this', { name: c.by }) : t('Someone is buying this'))
    : c.mine ? h('p', { class: 'taken-note' }, icon('check', 18), t("You're buying this")) : null;
  const doClaim = act(async () => { await S.be.claim(item.id); toast(t('Marked. {name} will not see this.', { name: owner.name })); refresh(); });
  const doUnclaim = act(async () => { await S.be.unclaim(item.id); toast(t('Removed. Others can buy this again.')); refresh(); });
  const body = h('div', { class: 'tag-body' }, cardHead(item), note, detailsBlock(item),
    h('div', { class: 'tag-actions' },
      item.url && h('a', { class: 'btn ghost small', href: item.url, target: '_blank', rel: 'noopener noreferrer' }, icon('external', 16), t('Buy here')),
      !c.claimed && h('button', { class: 'btn small', style: { marginLeft: 'auto' }, type: 'button', onClick: doClaim }, icon('gift', 16), t("I'll buy this")),
      c.mine && h('button', { class: 'btn ghost small', style: { marginLeft: 'auto' }, type: 'button', onClick: doUnclaim }, t('Undo'))));
  const image = cardImage(item);
  if (taken) image.append(h('span', { class: 'sash' }, t('Taken')));
  return h('li', { class: 'tag-wrap' + (taken ? ' taken' : '') }, h('article', { class: 'tag' }, image, body));
}
 
// ---------------------------------------------------------------------
// screens
// ---------------------------------------------------------------------
const iosTip = () => (isIOS && !isStandalone)
  ? h('div', { class: 'banner' }, t('On iPhone: tap the Share button, then "Add to Home Screen", and open Wishlist from there. The Home Screen app keeps its own data, so do this before you enter your name.'))
  : null;
 
function viewWelcome() {
  const prefill = new URLSearchParams(location.search).get('join') || '';
  let mode = 'new';
  const wrap = h('div', { class: 'welcome' });
  const draw = () => {
    const err = h('p', { class: 'error', role: 'alert', hidden: true });
    const showErr = (m) => { err.textContent = t(m); err.hidden = false; };
    let form;
    if (mode === 'new') {
      const name = h('input', { type: 'text', maxlength: 40, autocomplete: 'given-name', required: true, placeholder: t('e.g. Giulia') });
      const code = h('input', { type: 'text', value: prefill, autocapitalize: 'characters', autocomplete: 'off', placeholder: t('Optional') });
      form = h('form', { class: 'stack', onSubmit: async (e) => {
        e.preventDefault();
        const btn = e.submitter || e.target.querySelector('[type=submit]'); btn.disabled = true; err.hidden = true;
        try {
          const { recovery, joinError } = await S.be.start(name.value.trim(), code.value);
          S.me = (await S.be.init()).profile;
          history.replaceState(null, '', location.pathname + location.hash);
          await recoveryDialog(recovery);
          if (joinError) toast(t('Your name is saved, but that invite code was not found.'));
          go('#/'); route();
        } catch (ex) { showErr(ex.message); btn.disabled = false; }
      } },
      h('label', { class: 'field' }, h('span', null, t('Your name')), name),
      h('label', { class: 'field' }, h('span', null, t('Invite code')), code, h('p', { class: 'hint' }, t('Got a code from a family member? Enter it here, or join a group later.'))),
      err, h('button', { class: 'btn block', type: 'submit' }, t('Get started')),
      h('button', { class: 'link-btn', type: 'button', onClick: () => { mode = 'recover'; draw(); } }, t('Moved to a new phone? Use your recovery code')));
    } else {
      const code = h('input', { type: 'text', autocapitalize: 'characters', autocomplete: 'off', required: true });
      form = h('form', { class: 'stack', onSubmit: async (e) => {
        e.preventDefault();
        const btn = e.submitter || e.target.querySelector('[type=submit]'); btn.disabled = true; err.hidden = true;
        try { S.me = await S.be.recover(code.value); toast(t('Welcome back, {name}', { name: S.me.name })); go('#/'); route(); }
        catch (ex) { showErr(ex.message); btn.disabled = false; }
      } },
      h('label', { class: 'field' }, h('span', null, t('Recovery code')), code, h('p', { class: 'hint' }, t('You can find it in Settings on your old phone.'))),
      err, h('button', { class: 'btn block', type: 'submit' }, t('Restore my account')),
      h('button', { class: 'link-btn', type: 'button', onClick: () => { mode = 'new'; draw(); } }, t('Back')));
    }
    wrap.replaceChildren(...[
      S.be.demo && h('div', { class: 'banner demo', style: { margin: '-28px -20px 0' } }, t('Demo mode: nothing is shared or saved online.')),
      h('div', { class: 'hero', 'aria-hidden': 'true' }, h('div', { class: 'tag' }, h('span', { class: 'eyelet' }), h('span', { class: 'big-emoji' }, '🎁'), h('b', null, 'Wishlist'))),
      h('h1', null, t('Gifts with the surprise intact')),
      h('p', { class: 'lead' }, t("Keep a wishlist, share it with your family, and let them claim what they'll buy. You'll never see what's been bought.")),
      form, iosTip() && h('div', { style: { marginTop: '20px' } }, iosTip())].filter(Boolean));
  };
  draw();
  return wrap;
}
 
function recoveryDialog(code) {
  return openDialog((close) => [
    h('h2', null, t('Save your recovery code')),
    h('p', { class: 'lead' }, t('If you change or lose your phone, this code brings your wishlist back. Keep it somewhere safe, like a note or a message to yourself. You can find it again in Settings.')),
    h('div', { class: 'code-box', style: { marginTop: '14px' } }, h('code', null, code), h('button', { class: 'btn ghost small', type: 'button', onClick: () => copyText(code) }, icon('copy', 16), t('Copy'))),
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onClick: () => close(true) }, t("I've saved it"))),
  ]);
}
 
async function viewHome() {
  const items = await S.be.listMyItems();
  const body = h('div', { class: 'stack' });
  body.append(h('p', { class: 'small' }, t("Only people in your groups see what you share. You'll never see what has been bought.")));
 
  if (S.groups.length && items.length) {
    body.append(h('section', { class: 'panel' }, h('h2', null, t('Share your list')),
      S.groups.map((g) => {
        const n = items.filter((i) => i.groups.includes(g.id)).length;
        return Switch({
          label: g.name, desc: t('{n} of {total} wishes shared', { n, total: items.length }), checked: n === items.length,
          onToggle: async (on) => { await S.be.publishAll(g.id, on); refresh(); },
        });
      }),
      h('p', { class: 'hint' }, t('To share only some wishes, open a wish and choose where it shows.'))));
  }
  if (!items.length) {
    body.append(Empty('🎁', t('Nothing here yet'), t("Add something you'd love to get. It stays private until you share it."),
      h('a', { class: 'btn', href: '#/item/new' }, icon('plus', 18), t('Add your first wish'))));
  } else {
    body.append(h('ul', { class: 'tags' }, items.map((it, i) => ownerCard(it, i, items))));
  }
  return {
    title: t('My wishlist'), sub: items.length ? t('{n} wishes', { n: items.length }) : null, tab: 'home', body,
    actions: items.length > 1 ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('Reorder wishes'), 'aria-pressed': String(S.reorder), style: S.reorder ? { background: 'var(--line)' } : null,
      onClick: () => { S.reorder = !S.reorder; refresh(); } }, icon('sort')) : null,
    fab: items.length ? h('a', { class: 'btn fab', href: '#/item/new' }, icon('plus', 20), t('Add wish')) : null,
  };
}
 
const QUICK_DETAILS = ['Size', 'Shoe size', 'Colour', 'Quantity', 'Model'];
 
async function viewEditor(id) {
  const isNew = id === 'new';
  let f;
  if (isNew) f = { type: 'product', title: '', url: '', image_url: '', favicon_url: '', site_name: '', emoji: '', price: '', priority: 'nice', details: [], notes: '', groups: [] };
  else {
    const it = (await S.be.listMyItems()).find((x) => x.id === id);
    if (!it) throw new Error(t('That wish no longer exists.'));
    f = { ...it, url: it.url || '', image_url: it.image_url || '', favicon_url: it.favicon_url || '', site_name: it.site_name || '', emoji: it.emoji || '', price: it.price || '', notes: it.notes || '',
      details: it.details.map((d) => ({ ...d })), groups: [...it.groups] };
  }
  let status = null;
  const box = h('div', { class: 'stack' });
  const draw = () => box.replaceChildren(...build());
  const bind = (el, key) => { el.addEventListener('input', () => { f[key] = el.value; }); return el; };
 
  const fetchLink = async () => {
    const u = f.url.trim();
    if (!/^https?:\/\//i.test(u)) { status = { err: t('Paste a full link, starting with https://') }; draw(); return; }
    status = { busy: true }; draw();
    let r = null;
    try { r = await S.be.preview(u); } catch { r = { ok: false, reason: 'function' }; }
    if (r && r.ok) {
      if (!f.title.trim() && r.title) f.title = r.title;
      if (!f.image_url && r.image) f.image_url = r.image;
      if (!f.price.trim() && r.price) f.price = (!r.currency || r.currency === 'EUR') ? r.price : `${r.currency} ${r.price}`;
      if (r.favicon) f.favicon_url = r.favicon;
      f.site_name = r.site_name || f.site_name || hostOf(u);
      status = { ok: t('Filled in from the link. Check it and change anything you like.') };
    } else {
      // could not read the page: still fill in what the link itself tells us
      const host = hostOf(u);
      f.site_name = f.site_name || host;
      if (!f.favicon_url && host) f.favicon_url = `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
      const guess = titleFromUrl(u);
      if (!f.title.trim() && guess) f.title = guess;
      status = { warn: r?.reason === 'function'
        ? t("The link reader isn't switched on yet (step 4 of the setup guide). I made a title from the link instead.")
        : t("This shop doesn't let Wishlist read its page. I made a title from the link. Add a photo yourself.") };
    }
    draw();
  };
 
  const pickImage = async (file) => {
    if (!file) return;
    status = { busy: true }; draw();
    try { f.image_url = await S.be.uploadImage(await resizeImage(file)); status = null; }
    catch (e) { status = { err: e.message }; }
    draw();
  };
 
  const save = act(async () => {
    if (!f.title.trim()) { toast(t('Add a title first.')); return; }
    if (f.url.trim() && !/^https?:\/\//i.test(f.url.trim())) f.url = 'https://' + f.url.trim();
    const saved = await S.be.saveItem({ ...f, id: isNew ? undefined : id });
    await S.be.setItemGroups(saved.id, f.groups);
    toast(isNew ? t('Wish added') : t('Changes saved'));
    go('#/');
  });
  const remove = act(async () => {
    if (!(await confirmDialog({ title: t('Delete this wish?'), body: t('It disappears from your list and from every group.'), ok: t('Delete'), danger: true }))) return;
    await S.be.deleteItem(id); toast(t('Wish deleted')); go('#/');
  });
 
  function build() {
    const info = typeInfo(f.type);
    const out = [];
    out.push(h('div', { role: 'radiogroup', 'aria-label': t('Type') }, h('span', { class: 'label' }, t('What kind of wish is it?')),
      h('div', { class: 'chips' }, TYPES.map((ty) => h('button', { class: 'chip', type: 'button', role: 'radio', 'aria-checked': String(f.type === ty.id),
        onClick: () => { f.type = ty.id; draw(); } }, ty.emoji, t(ty.label))))));
 
    const url = bind(h('input', { type: 'url', inputmode: 'url', value: f.url, placeholder: 'https://', autocapitalize: 'none', autocomplete: 'off' }), 'url');
    url.addEventListener('paste', () => setTimeout(() => { f.url = url.value; fetchLink(); }, 0));
    out.push(h('div', null,
      h('label', { class: 'field' }, h('span', null, f.type === 'product' ? t('Link to the product') : t('Link (optional)')), url),
      h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap' } },
        h('button', { class: 'btn soft small', type: 'button', disabled: status?.busy, onClick: fetchLink }, icon('link', 16), status?.busy ? t('Reading the link…') : t('Fill in from link')),
        status?.ok && h('span', { class: 'small' }, status.ok)),
      status?.warn && h('p', { class: 'hint' }, status.warn),
      status?.err && h('p', { class: 'error', role: 'alert' }, t(status.err))));
 
    out.push(h('label', { class: 'field' }, h('span', null, t('Title')), bind(h('input', { type: 'text', value: f.title, maxlength: 200, required: true, placeholder: t('What would you love?') }), 'title')));
 
    const fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true, onChange: (e) => pickImage(e.target.files[0]) });
    out.push(h('div', null, h('span', { class: 'label' }, t('Picture')),
      h('div', { class: 'img-edit' },
        h('div', { class: 'thumb' }, f.image_url ? h('img', { src: f.image_url, alt: '', referrerpolicy: 'no-referrer' }) : (f.emoji || info.emoji)),
        h('div', { class: 'btns' },
          h('button', { class: 'btn ghost small', type: 'button', onClick: () => fileInput.click() }, icon('camera', 16), f.image_url ? t('Replace') : t('Upload photo')),
          f.image_url && h('button', { class: 'btn ghost small', type: 'button', onClick: () => { f.image_url = ''; draw(); } }, t('Remove')),
          fileInput)),
      !f.image_url && h('div', { style: { marginTop: '10px' } }, h('label', { class: 'field' }, h('span', null, t('Or pick an emoji')),
        bind(h('input', { class: 'emoji-input', type: 'text', value: f.emoji, maxlength: 8, placeholder: info.emoji, 'aria-label': t('Emoji') }), 'emoji')))));
 
    out.push(h('div', { style: { display: 'grid', gap: '14px', gridTemplateColumns: '1fr 1fr' } },
      h('label', { class: 'field' }, h('span', null, f.type === 'product' ? t('Price') : t('Amount or budget')),
        bind(h('input', { type: 'text', value: f.price, maxlength: 60, placeholder: f.type === 'product' ? '29.90' : '20–40', inputmode: 'text' }), 'price')),
      h('div', null, h('span', { class: 'label' }, t('How much do you want it?')),
        h('div', { class: 'chips' }, [['nice', t('Nice to have')], ['really', t('Really want')]].map(([v, l]) =>
          h('button', { class: 'chip', type: 'button', 'aria-pressed': String(f.priority === v), onClick: () => { f.priority = v; draw(); } }, l))))));
 
    out.push(h('div', null, h('span', { class: 'label' }, t('Order details')), h('p', { class: 'hint', style: { marginTop: '-2px', marginBottom: '8px' } }, t('Size, colour or anything the buyer needs to get it right.')),
      f.details.map((d, i) => h('div', { class: 'detail-row' },
        bind2(h('input', { type: 'text', value: d.label, maxlength: 40, placeholder: t('Label'), 'aria-label': t('Label') }), d, 'label'),
        bind2(h('input', { type: 'text', value: d.value, maxlength: 80, placeholder: t('Value'), 'aria-label': t('Value') }), d, 'value'),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('Remove detail'), onClick: () => { f.details.splice(i, 1); draw(); } }, icon('x', 18)))),
      h('div', { class: 'chips' },
        QUICK_DETAILS.filter((q) => !f.details.some((d) => d.label === t(q))).map((q) => h('button', { class: 'chip', type: 'button', onClick: () => { f.details.push({ label: t(q), value: '' }); draw(); } }, icon('plus', 14), t(q))),
        h('button', { class: 'chip', type: 'button', onClick: () => { f.details.push({ label: '', value: '' }); draw(); } }, icon('plus', 14), t('Custom')))));
 
    out.push(h('label', { class: 'field' }, h('span', null, t('Notes')), bind(h('textarea', { maxlength: 2000, placeholder: t('Anything else the buyer should know') }, f.notes), 'notes')));
 
    out.push(h('section', { class: 'panel' }, h('h2', null, t('Who can see this?')),
      S.groups.length
        ? [h('p', { class: 'hint', style: { marginTop: 0 } }, t('Private unless you choose a group.')),
          S.groups.map((g) => Switch({ label: g.name, checked: f.groups.includes(g.id), onToggle: async (on) => { f.groups = on ? [...f.groups, g.id] : f.groups.filter((x) => x !== g.id); } }))]
        : h('p', { class: 'hint', style: { marginTop: 0 } }, t('Only you, for now. Create or join a group to share it.'))));
 
    out.push(h('div', { class: 'sticky-save' },
      h('a', { class: 'btn ghost', href: '#/' }, t('Cancel')),
      h('button', { class: 'btn', type: 'button', onClick: save }, isNew ? t('Add wish') : t('Save changes'))));
    if (!isNew) out.push(h('button', { class: 'btn danger block', type: 'button', onClick: remove }, icon('trash', 18), t('Delete this wish')));
    return out;
  }
  const bind2 = (el, obj, key) => { el.addEventListener('input', () => { obj[key] = el.value; }); return el; };
 
  draw();
  return { title: isNew ? t('New wish') : t('Edit wish'), back: '#/', tab: 'home', body: box };
}
 
async function viewGroups() {
  const createGroup = async () => {
    const name = await promptDialog({ title: t('Create a group'), label: t('Group name'), placeholder: t('e.g. Family'), ok: t('Create group') });
    if (!name) return;
    const g = await S.be.createGroup(name);
    toast(t('Group created')); go('#/group/' + g.id);
  };
  const joinGroup = async () => {
    const code = await promptDialog({ title: t('Join a group'), label: t('Invite code'), ok: t('Join group'), maxlength: 20, help: t('Ask the person who made the group for the code.') });
    if (!code) return;
    const gid = await S.be.joinGroup(code);
    toast(t('You joined the group')); go('#/group/' + gid);
  };
  const body = h('div', { class: 'stack' },
    h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
      h('button', { class: 'btn', type: 'button', onClick: act(createGroup) }, icon('plus', 18), t('Create group')),
      h('button', { class: 'btn ghost', type: 'button', onClick: act(joinGroup) }, t('Join with code'))),
    S.groups.length
      ? h('div', { class: 'stack' }, S.groups.map((g) => h('a', { class: 'group-card', href: '#/group/' + g.id },
        h('h2', null, g.name),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
          h('div', { class: 'avatars' }, g.members.slice(0, 5).map((m) => avatar(m, 32))),
          h('span', { class: 'small' }, t('{n} members', { n: g.members.length }))))))
      : Empty('👪', t('No groups yet'), t('Create a group for your family, then share the invite code. Or join one with a code.')));
  return { title: t('Groups'), tab: 'groups', body };
}
 
async function viewGroup(gid) {
  const g = S.groups.find((x) => x.id === gid);
  if (!g) throw new Error(t('You are not in that group.'));
  const counts = await S.be.groupCounts(gid);
  const link = S.be.demo ? null : `${location.origin}${location.pathname}?join=${g.invite_code}`;
 
  const members = h('ul', { class: 'rows' }, g.members.map((m) => {
    const isMe = m.id === S.me.id;
    const n = counts[m.id] || 0;
    return h('li', { style: { display: 'flex', alignItems: 'center' } },
      h('a', { class: 'row', href: isMe ? '#/' : `#/group/${gid}/${m.id}` },
        avatar(m, 44),
        h('span', { class: 'grow' }, h('b', null, isMe ? t('{name} (you)', { name: m.name }) : m.name),
          h('span', { class: 'small' }, n ? t('{n} wishes shared', { n }) : t('Nothing shared yet'))),
        h('span', { class: 'chev' }, icon('down', 18))),
      g.isCreator && !isMe && h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('Remove {name}', { name: m.name }),
        onClick: act(async () => {
          if (!(await confirmDialog({ title: t('Remove {name}?', { name: m.name }), body: t('They will no longer see this group or the lists shared in it.'), ok: t('Remove'), danger: true }))) return;
          await S.be.removeMember(gid, m.id); toast(t('Removed')); refresh();
        }) }, icon('x', 18)));
  }));
 
  const invite = h('section', { class: 'panel' }, h('h2', null, t('Invite someone')),
    h('div', { class: 'code-box' }, h('code', null, g.invite_code),
      h('div', { style: { display: 'flex', gap: '8px' } },
        h('button', { class: 'btn ghost small', type: 'button', onClick: () => copyText(g.invite_code) }, icon('copy', 16), t('Copy')),
        navigator.share && h('button', { class: 'btn small', type: 'button', onClick: () => navigator.share({ title: 'Wishlist', text: t('Join "{name}" on Wishlist with this code: {code}', { name: g.name, code: g.invite_code }), url: link || undefined }).catch(() => {}) }, icon('share', 16), t('Share')))),
    h('p', { class: 'hint' }, isIOS ? t('Tell them to add Wishlist to their Home Screen first, then enter the code.') : t('They enter the code when they join, or in Groups → Join with code.')),
    g.isCreator && h('button', { class: 'link-btn', type: 'button', onClick: act(async () => {
      if (!(await confirmDialog({ title: t('Make a new code?'), body: t('The old code stops working. People already in the group stay in.'), ok: t('Make new code') }))) return;
      await S.be.regenInvite(gid); toast(t('New code ready')); refresh();
    }) }, t('Make a new code')));
 
  const manage = h('section', { class: 'panel' }, h('h2', null, t('Group settings')),
    g.isCreator && Switch({ label: t('Show who is buying what'), desc: t('Members see the name of whoever claimed a gift. Turn off to show only that it is taken.'), checked: g.show_claimers,
      onToggle: async (on) => { await S.be.updateGroup(gid, { show_claimers: on }); } }),
    g.isCreator && h('button', { class: 'link-btn', type: 'button', onClick: act(async () => {
      const name = await promptDialog({ title: t('Rename group'), label: t('Group name'), value: g.name, ok: t('Save') });
      if (name) { await S.be.updateGroup(gid, { name }); refresh(); }
    }) }, t('Rename group')),
    g.isCreator && h('div', { class: 'divider' }),
    h('button', { class: 'btn danger block', type: 'button', onClick: act(async () => {
      if (!(await confirmDialog({ title: t('Leave {name}?', { name: g.name }), body: t('Your wishes will no longer be visible here. You can join again with the code.'), ok: t('Leave group'), danger: true }))) return;
      await S.be.leaveGroup(gid); toast(t('You left the group')); go('#/groups');
    }) }, t('Leave group')));
 
  return { title: g.name, sub: t('{n} members', { n: g.members.length }), back: '#/groups', tab: 'groups',
    body: h('div', { class: 'stack' }, h('section', { class: 'panel' }, h('h2', null, t('Wishlists')), members), invite, manage) };
}
 
async function viewMember(gid, uid) {
  if (uid === S.me.id) { go('#/'); return viewHome(); }
  const g = S.groups.find((x) => x.id === gid);
  const owner = g?.members.find((m) => m.id === uid);
  if (!g || !owner) throw new Error(t('You are not in that group.'));
  const items = await S.be.memberList(gid, uid);
  const body = h('div', { class: 'stack' },
    h('p', { class: 'small' }, t("Tap \"I'll buy this\" so nobody else gets the same gift. {name} can't see which gifts are taken.", { name: owner.name })),
    items.length
      ? h('ul', { class: 'tags' }, items.map((i) => viewerCard(i, owner)))
      : Empty('🎁', t('Nothing shared yet'), t("{name} hasn't shared any wishes with this group.", { name: owner.name })));
  return { title: t("{name}'s wishlist", { name: owner.name }), sub: g.name, back: '#/group/' + gid, tab: 'groups', body };
}
 
const AVATARS = ['🙂', '😎', '🦊', '🐱', '🐶', '🐼', '🦄', '🌸', '⭐', '🎸', '📚', '🧶'];
 
async function viewSettings() {
  const name = h('input', { type: 'text', value: S.me.name, maxlength: 40, autocomplete: 'given-name' });
  const codeBox = h('div', { hidden: true });
  const avatarChips = h('div', { class: 'chips' });
  const drawAvatars = () => avatarChips.replaceChildren(
    h('button', { class: 'chip', type: 'button', 'aria-pressed': String(!S.me.avatar), onClick: () => setAvatar(null) }, t('Initial')),
    ...AVATARS.map((e) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(S.me.avatar === e), 'aria-label': e, onClick: () => setAvatar(e) }, e)));
  let bigAvatar = avatar(S.me, 56);
  const setAvatar = async (e) => {
    await S.be.updateMe({ avatar: e }); S.me.avatar = e; drawAvatars();
    const fresh = avatar(S.me, 56); bigAvatar.replaceWith(fresh); bigAvatar = fresh;
  };
  drawAvatars();
 
  const body = h('div', { class: 'stack' },
    h('section', { class: 'panel stack' }, h('h2', null, t('Your profile')),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px' } }, bigAvatar,
        h('label', { class: 'field', style: { flex: 1 } }, h('span', null, t('Name')), name)),
      h('button', { class: 'btn small', type: 'button', style: { alignSelf: 'start' }, onClick: act(async () => {
        const v = name.value.trim(); if (!v) { toast(t('Your name cannot be empty.')); return; }
        await S.be.updateMe({ name: v }); S.me.name = v; toast(t('Saved')); refresh();
      }) }, t('Save name')),
      h('div', null, h('span', { class: 'label' }, t('Picture')), avatarChips)),
    h('section', { class: 'panel' }, h('h2', null, t('Recovery code')),
      h('p', { class: 'lead' }, t('Use this to get your wishlist back if you change phones or clear the app.')),
      h('button', { class: 'btn ghost small', type: 'button', style: { marginTop: '12px' }, onClick: act(async (e) => {
        const self = e.currentTarget;
        const code = await S.be.getRecoveryCode();
        codeBox.replaceChildren(h('div', { class: 'code-box', style: { marginTop: '12px' } }, h('code', null, code),
          h('button', { class: 'btn ghost small', type: 'button', onClick: () => copyText(code) }, icon('copy', 16), t('Copy'))));
        codeBox.hidden = false; self.hidden = true;
      }) }, t('Show my recovery code')), codeBox),
    iosTip(),
    h('section', { class: 'panel' }, h('h2', null, t('Privacy')),
      h('p', { class: 'lead' }, t("Your wishes are private until you share them with a group. People in the group can mark gifts they'll buy. That information is never sent to you, and the app has no notifications about it."))),
    h('section', { class: 'panel' }, h('h2', null, t('Delete my data')),
      h('p', { class: 'lead', style: { marginBottom: '12px' } }, t('Removes your name, your wishes and your group memberships from this app.')),
      h('button', { class: 'btn danger', type: 'button', onClick: act(async () => {
        if (!(await confirmDialog({ title: t('Delete everything?'), body: t("This can't be undone. Your recovery code will stop working too."), ok: t('Delete my data'), danger: true }))) return;
        await S.be.deleteAccount(); S.me = null; S.groups = []; toast(t('Your data was deleted')); history.replaceState(null, '', location.pathname); route();
      }) }, icon('trash', 18), t('Delete my data'))));
  return { title: t('Settings'), tab: 'settings', body };
}
 
// ---------------------------------------------------------------------
// router
// ---------------------------------------------------------------------
let routeToken = 0;
let lastKey = '';
const refresh = () => route({ quiet: true });
 
async function route(opts = {}) {
  const tok = ++routeToken;
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const key = parts.join('/');
  if (!S.me) { mount(viewWelcome()); return; }
  const quiet = opts.quiet && key === lastKey;
  const y = window.scrollY;
  const tab = { groups: 'groups', group: 'groups', settings: 'settings' }[parts[0]] || 'home';
  if (!quiet) mount(shell({ title: ' ', tab, body: h('div', { class: 'spinner', role: 'status', 'aria-label': t('Loading') }) }));
  try {
    S.groups = await S.be.listGroups();
    let view;
    switch (parts[0]) {
      case 'item': view = await viewEditor(parts[1] || 'new'); break;
      case 'groups': view = await viewGroups(); break;
      case 'group': view = parts[2] ? await viewMember(parts[1], parts[2]) : await viewGroup(parts[1]); break;
      case 'settings': view = await viewSettings(); break;
      default: view = await viewHome();
    }
    if (tok !== routeToken) return;
    mount(shell(view));
    lastKey = key;
    window.scrollTo(0, quiet ? y : 0);
  } catch (e) {
    if (tok !== routeToken) return;
    mount(shell({ title: t('Something went wrong'), tab, body: Empty('😕', t("That didn't work"), t(e.message || ''), h('button', { class: 'btn', type: 'button', onClick: () => route() }, t('Try again'))) }));
  }
}
addEventListener('hashchange', () => { S.reorder = false; route(); });
 
// ---------------------------------------------------------------------
// start
// ---------------------------------------------------------------------
async function boot() {
  mount(h('div', { class: 'spinner', role: 'status', 'aria-label': t('Loading') }));
  try {
    S.be = await createBackend(window.WISHLIST_CONFIG || {});
    S.me = (await S.be.init()).profile;
  } catch (e) {
    mount(h('div', { class: 'welcome' }, Empty('😕', t("Wishlist can't start"), t(e.message), h('button', { class: 'btn', type: 'button', onClick: () => location.reload() }, t('Try again')))));
    return;
  }
  await route();
  // opened from an invite link while already signed in
  const join = new URLSearchParams(location.search).get('join');
  if (join && S.me) {
    history.replaceState(null, '', location.pathname + location.hash);
    if (await confirmDialog({ title: t('Join this group?'), body: t('Invite code {code}', { code: join }), ok: t('Join group') })) {
      try { const gid = await S.be.joinGroup(join); toast(t('You joined the group')); go('#/group/' + gid); } catch (e) { toast(e.message); }
    }
  }
}
boot();
 
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
 
