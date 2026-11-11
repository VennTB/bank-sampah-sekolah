(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmt = (n, d = 0) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: d, minimumFractionDigits: d }).format(n || 0);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const IKON = { Plastik: "🥤", Kertas: "📄", "Kaleng/Logam": "🥫", Kaca: "🍾", "Minyak Jelantah": "🛢️" };
const HADIAH_IKON = ["🎁", "🎒", "☂️", "🍱", "✏️", "🥤", "📚", "🌳"];
let JENIS = [], SISWA = [];

/* ---------- API ---------- */
async function api(url, method = "GET", data) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: data ? JSON.stringify(data) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || "Terjadi kesalahan. Coba lagi.");
  return j;
}

/* ---------- efek ---------- */
function leaves(el, n = 14, emojis = ["🍃", "🌿", "🌱", "✨", "⭐"]) {
  if (calm || !el) return;
  const b = el.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span"), a = Math.PI * 2 * i / n + Math.random() * .6, d = 70 + Math.random() * 110;
    s.className = "leaf"; s.textContent = emojis[i % emojis.length];
    s.style.cssText = `left:${x}px;top:${y}px;font-size:${14 + Math.random() * 12}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d + 90}px;--rot:${Math.random() * 540 - 270}deg`;
    document.body.append(s); setTimeout(() => s.remove(), 1600);
  }
}
function toast(msg, err) {
  const t = document.createElement("div"); t.className = "toast" + (err ? " err" : ""); t.textContent = (err ? "⚠️ " : "✅ ") + msg;
  $("#toasts").append(t); setTimeout(() => { t.style.transition = ".4s"; t.style.opacity = 0; setTimeout(() => t.remove(), 400); }, err ? 5200 : 3200);
}
document.addEventListener("click", e => {
  const b = e.target.closest(".btn"); if (!b || calm) return;
  const r = b.getBoundingClientRect(), z = Math.max(r.width, r.height) * 2, s = document.createElement("span");
  s.className = "ripple"; s.style.cssText = `width:${z}px;height:${z}px;left:${e.clientX - r.left - z / 2}px;top:${e.clientY - r.top - z / 2}px`;
  b.append(s); setTimeout(() => s.remove(), 600);
});
function count(el, to, dec = 0) {
  if (calm || to === 0) { el.textContent = fmt(to, dec); return; }
  const t0 = performance.now(), dur = 1100;
  (function f(t) { const p = Math.min((t - t0) / dur, 1); el.textContent = fmt(to * (1 - Math.pow(1 - p, 4)), dec); if (p < 1) requestAnimationFrame(f); })(t0);
}

/* ---------- modal ---------- */
function modal(title, html, o = {}) {
  const w = document.createElement("div"); w.className = "modal-wrap";
  w.innerHTML = `<form class="modal"><div class="modal-head"><h3>${esc(title)}</h3><button type="button" class="x" data-x aria-label="Tutup">✕</button></div>
  <div class="modal-body">${html}<p class="form-err" role="alert"></p></div>
  <div class="modal-foot">${o.noCancel ? "" : '<button type="button" class="btn ghost" data-x>Batal</button>'}<button class="btn ${o.danger ? "danger" : o.cls || ""}">${o.submit || "Simpan"}</button></div></form>`;
  document.body.append(w);
  const f = $("form", w), close = () => { w.remove(); document.removeEventListener("keydown", esc_); o.onClose && o.onClose(); };
  const esc_ = e => e.key === "Escape" && close();
  document.addEventListener("keydown", esc_);
  w.addEventListener("mousedown", e => e.target === w && close());
  $$("[data-x]", w).forEach(b => b.onclick = close);
  f.onsubmit = async e => {
    e.preventDefault(); const btn = $(".modal-foot .btn:last-child", w); btn.disabled = true;
    try { await (o.onSubmit && o.onSubmit(Object.fromEntries(new FormData(f)))); close(); }
    catch (er) { $(".form-err", w).textContent = er.message; btn.disabled = false; }
  };
  const first = $("input,select", w); first && setTimeout(() => first.focus(), 60);
  return w;
}
const ask = (msg, label = "Ya, hapus") => new Promise(res => { let ok = false; modal("Yakin?", `<p>${msg}</p>`, { danger: true, submit: label, onSubmit: () => { ok = true; }, onClose: () => res(ok) }); });
async function run(fn, after) { try { const j = await fn(); toast(j.pesan || "Berhasil."); leaves($(".toast:last-child")); await (after && after()); return j; } catch (e) { toast(e.message, true); } }

/* ---------- navigasi ---------- */
const loaders = {};
function go(v) {
  if (!loaders[v]) v = "dash";
  $$(".view").forEach(s => { const on = s.id === "v-" + v; s.classList.toggle("on", on); s.hidden = !on; });
  $$("#nav button").forEach(b => b.classList.toggle("on", b.dataset.go === v));
  $("#side").classList.remove("open");
  if (location.hash !== "#" + v) { try { location.hash = v; } catch (e) {} }
  window.scrollTo(0, 0);
  try { const r = loaders[v](); r && r.catch && r.catch(er => toast(er.message, true)); } catch (er) { toast(er.message, true); }
}
window.addEventListener("hashchange", () => { const v = location.hash.slice(1); if (loaders[v] && !$("#v-" + v).classList.contains("on")) go(v); });
$("#nav").onclick = e => { const b = e.target.closest("[data-go]"); b && go(b.dataset.go); };
$("#menuFab").onclick = () => $("#side").classList.toggle("open");

const refreshSiswa = async () => (SISWA = await api("/api/siswa"));
const opsiSiswa = (sel) => SISWA.map(s => `<option value="${s.id}" ${s.id == sel ? "selected" : ""}>${esc(s.nama)} — ${esc(s.kelas)} (${fmt(s.total_poin)} poin)</option>`).join("");
const empty = (ic, t) => `<div class="empty"><b>${ic}</b>${t}</div>`;

/* ---------- BERANDA ---------- */
const FAKTA = ["1 kg kertas daur ulang menyelamatkan sekitar 17 pohon.", "Botol plastik butuh ratusan tahun untuk terurai.", "Kaca bisa didaur ulang berkali-kali tanpa turun kualitas.", "Kaleng aluminium bisa jadi kaleng baru dalam dua bulan.", "Satu liter minyak jelantah bisa mencemari ribuan liter air.", "Pilah dari rumah: langkah kecil, dampak besar. 🌎"];
let fi = 0;
loaders.dash = async () => {
  const d = await api("/api/ringkasan");
  $$("[data-count]").forEach(el => count(el, d[el.dataset.count], +el.dataset.dec || 0));
  $("#pohonN").textContent = d.pohon;
  const p = d.sisa / d.poin_per_pohon * 100;
  requestAnimationFrame(() => requestAnimationFrame(() => $("#fill").style.width = p + "%"));
  $("#fillNote").textContent = `Kurang ${fmt(d.poin_per_pohon - d.sisa)} poin lagi untuk pohon ke-${d.pohon + 1}.`;
  const sc = Math.min(1.1, .5 + d.poin_terkumpul / 4000), c = $("#canopy");
  c.style.transform = `scale(${sc})`; c.style.setProperty("--s", sc); c.classList.add("sway");
  $$(".fruit").forEach((f, i) => f.style.opacity = d.pohon > i ? 1 : 0);
  $("#feed").innerHTML = d.terbaru.length ? d.terbaru.map(a => `<li><div class="ic">${a.tipe === "setor" ? IKON[a.ket] || "♻️" : "🎁"}</div>
    <div><b>${esc(a.nama)}</b><small>${a.tipe === "setor" ? `Setor ${esc(a.ket)} ${a.berat_kg} kg` : `Menukar ${esc(a.ket)}`} · ${esc(a.tanggal)}</small></div>
    <span class="pt ${a.poin < 0 ? "neg" : ""}">${a.poin > 0 ? "+" : ""}${fmt(a.poin)}</span></li>`).join("") : empty("🌱", "Belum ada aktivitas. Mulai dengan setoran pertama!");
};
$("#garden").onclick = () => {
  const g = $("#garden"), b = $("#bubble"); g.classList.remove("shake"); void g.offsetWidth; g.classList.add("shake");
  leaves($("#canopy"), 10, ["🍃", "🍂", "🌿"]);
  b.textContent = FAKTA[fi++ % FAKTA.length]; b.classList.add("show"); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove("show"), 4200);
};
(function drift() { // daun jatuh pelan di hero (sekali saat load)
  const s = $(".hero-sky"); if (calm) return;
  for (let i = 0; i < 9; i++) { const l = document.createElement("i"); l.textContent = ["🍃", "🌿", "🍂"][i % 3];
    l.style.cssText = `left:${Math.random() * 95}%;animation-duration:${10 + Math.random() * 8}s;animation-delay:-${Math.random() * 12}s;font-size:${14 + Math.random() * 12}px;--dx:${Math.random() * 80 - 40}px;--rot:${Math.random() * 360}deg`; s.append(l); }
})();

/* ---------- SISWA ---------- */
function formSiswa(s = {}) {
  const edit = !!s.id;
  modal(edit ? "Ubah data siswa" : "Daftarkan siswa baru",
    `<label>Nama siswa<input name="nama" value="${esc(s.nama)}" required placeholder="cth. Sapto Ganteng"></label>
     <label>Kelas<input name="kelas" value="${esc(s.kelas)}" required placeholder="cth. 12 RPL"></label>`,
    { submit: edit ? "Simpan perubahan" : "Daftarkan", onSubmit: d => run(() => api(edit ? `/api/siswa/${s.id}` : "/api/siswa", edit ? "PUT" : "POST", d), refreshAll) });
}
loaders.siswa = async () => {
  const q = $("#qSiswa").value.trim(), list = await api("/api/siswa?q=" + encodeURIComponent(q));
  $("#tSiswa").innerHTML = list.length ? `<thead><tr><th style="width:36px"></th><th>ID</th><th>Nama</th><th>Kelas</th><th class="r">Setoran</th><th class="r">Poin</th><th></th></tr></thead><tbody>` +
    list.map((s, i) => `<tr class="in" style="animation-delay:${Math.min(i * 30, 400)}ms"><td><input type="checkbox" class="check" value="${s.id}" aria-label="Pilih ${esc(s.nama)}"></td>
    <td>#${s.id}</td><td><b>${esc(s.nama)}</b></td><td>${esc(s.kelas)}</td><td class="r">${s.jml_setoran}×</td><td class="r"><span class="pill">${fmt(s.total_poin)}</span></td>
    <td class="act"><button class="btn sm ghost" data-edit="${s.id}">Ubah</button><button class="btn sm danger" data-del="${s.id}">Hapus</button></td></tr>`).join("") + "</tbody>"
    : `<tbody><tr><td>${empty("🌱", q ? "Tidak ada siswa yang cocok dengan pencarian." : "Belum ada siswa. Klik “Siswa baru” untuk mulai.")}</td></tr></tbody>`;
  SISWA_VIEW = list; syncBulk();
};
let SISWA_VIEW = [];
const syncBulk = () => { const n = $$("#tSiswa .check:checked").length; $("#bulkDel").hidden = !n; $("#bulkDel span").textContent = n; };
$("#qSiswa").oninput = debounce(() => loaders.siswa());
$("#tSiswa").onclick = async e => {
  if (e.target.matches(".check")) return syncBulk();
  const ed = e.target.closest("[data-edit]"), dl = e.target.closest("[data-del]");
  if (ed) formSiswa(SISWA_VIEW.find(s => s.id == ed.dataset.edit));
  if (dl) { const s = SISWA_VIEW.find(x => x.id == dl.dataset.del);
    if (await ask(`Hapus <b>${esc(s.nama)}</b> beserta seluruh riwayat setoran dan penukarannya? Tindakan ini tidak bisa dibatalkan.`)) run(() => api(`/api/siswa/${s.id}`, "DELETE"), refreshAll); }
};
$("#bulkDel").onclick = async () => {
  const ids = $$("#tSiswa .check:checked").map(c => +c.value);
  if (await ask(`Hapus <b>${ids.length} siswa</b> terpilih beserta seluruh riwayatnya?`)) run(() => api("/api/siswa/hapus", "POST", { ids }), refreshAll);
};

/* ---------- SETOR ---------- */
const hitungEst = () => { const j = JENIS.find(x => x.kode === $("#selJenis").value); $("#estPoin").textContent = fmt(Math.floor((parseFloat($("#inBerat").value) || 0) * (j ? j.harga : 0))); };
$("#selJenis").onchange = $("#inBerat").oninput = hitungEst;
function formSetoran(t) {
  const kodeNow = (JENIS.find(j => j.nama === t.jenis_sampah) || {}).kode;
  modal(`Ubah setoran ${t.nama}`,
    `<label>Jenis sampah<select name="jenis">${JENIS.map(j => `<option value="${j.kode}" ${j.kode === kodeNow ? "selected" : ""}>${j.nama} — ${j.harga} poin/kg</option>`).join("")}</select></label>
     <label>Berat (kg)<input name="berat" type="number" step="0.01" min="0.01" value="${t.berat_kg}" required></label>
     <p class="muted">Poin siswa akan dihitung ulang otomatis.</p>`,
    { submit: "Simpan perubahan", onSubmit: d => run(() => api(`/api/setoran/${t.id}`, "PUT", d), refreshAll) });
}
let SETOR_VIEW = [];
loaders.setor = async () => {
  await refreshSiswa();
  const keep = $("#selSiswa").value;
  $("#selSiswa").innerHTML = SISWA.length ? opsiSiswa(keep) : `<option value="">(daftarkan siswa dulu)</option>`;
  $("#selJenis").innerHTML = JENIS.map(j => `<option value="${j.kode}">${IKON[j.nama] || ""} ${j.nama} — ${j.harga} poin/kg</option>`).join(""); hitungEst();
  const q = $("#qSetor").value.trim(), list = SETOR_VIEW = await api("/api/setoran?q=" + encodeURIComponent(q));
  $("#tSetor").innerHTML = list.length ? `<thead><tr><th>Tanggal</th><th>Siswa</th><th>Jenis</th><th class="r">Berat</th><th class="r">Poin</th><th></th></tr></thead><tbody>` +
    list.map((t, i) => `<tr class="in" style="animation-delay:${Math.min(i * 30, 400)}ms"><td>${esc(t.tanggal)}</td><td><b>${esc(t.nama)}</b> <small class="muted">${esc(t.kelas)}</small></td>
    <td>${IKON[t.jenis_sampah] || ""} ${esc(t.jenis_sampah)}</td><td class="r">${fmt(t.berat_kg, 2)} kg</td><td class="r"><span class="pill">+${fmt(t.poin_didapat)}</span></td>
    <td class="act"><button class="btn sm ghost" data-edit="${t.id}">Ubah</button><button class="btn sm danger" data-del="${t.id}">Hapus</button></td></tr>`).join("") + "</tbody>"
    : `<tbody><tr><td>${empty("♻️", "Belum ada setoran yang cocok.")}</td></tr></tbody>`;
};
$("#qSetor").oninput = debounce(() => loaders.setor());
$("#fSetor").onsubmit = async e => {
  e.preventDefault(); const f = e.target, btn = $(".btn", f); btn.disabled = true;
  try {
    const j = await api("/api/setoran", "POST", Object.fromEntries(new FormData(f))), s = j.struk;
    f.reset(); toast(j.pesan);
    const w = modal("Setoran berhasil 🌱", `<div class="struk"><div class="mk">♻</div>
      <p><span>Nama</span><b>${esc(s.nama)}</b></p><p><span>Kelas</span><span>${esc(s.kelas)}</span></p><p><span>Tanggal</span><span>${esc(s.tanggal)}</span></p><hr>
      <p><span>${esc(s.jenis)}</span><span>${s.berat} kg × ${s.harga}</span></p><p><span>Poin sebelumnya</span><span>${fmt(s.sebelum)}</span></p>
      <p><span>Poin didapat</span><b>+${fmt(s.poin)}</b></p><hr><p class="tot"><span>Total poin</span><span>${fmt(s.sesudah)}</span></p></div>`,
      { submit: "Selesai", noCancel: true, cls: "amber" });
    setTimeout(() => leaves($(".struk .mk", w), 18), 250); await loaders.setor();
  } catch (er) { toast(er.message, true); } btn.disabled = false;
};
$("#tSetor").onclick = async e => {
  const ed = e.target.closest("[data-edit]"), dl = e.target.closest("[data-del]");
  if (ed) formSetoran(SETOR_VIEW.find(t => t.id == ed.dataset.edit));
  if (dl) { const t = SETOR_VIEW.find(x => x.id == dl.dataset.del);
    if (await ask(`Hapus setoran <b>${esc(t.jenis_sampah)} ${t.berat_kg} kg</b> milik ${esc(t.nama)}? Poin ${fmt(t.poin_didapat)} akan dikurangi.`)) run(() => api(`/api/setoran/${t.id}`, "DELETE"), loaders.setor); }
};

/* ---------- HADIAH ---------- */
function formHadiah(h = {}) {
  const edit = !!h.id;
  modal(edit ? "Ubah hadiah" : "Tambah hadiah",
    `<label>Nama hadiah<input name="nama_hadiah" value="${esc(h.nama_hadiah)}" required></label>
     <label>Poin dibutuhkan<input name="poin_dibutuhkan" type="number" min="1" value="${h.poin_dibutuhkan ?? ""}" required></label>
     <label>Stok<input name="stok" type="number" min="0" value="${h.stok ?? ""}" required></label>`,
    { submit: edit ? "Simpan perubahan" : "Tambah hadiah", onSubmit: d => run(() => api(edit ? `/api/hadiah/${h.id}` : "/api/hadiah", edit ? "PUT" : "POST", d), refreshAll) });
}
let HADIAH = [];
loaders.hadiah = async () => {
  HADIAH = await api("/api/hadiah");
  $("#gifts").innerHTML = HADIAH.length ? HADIAH.map(h => `<div class="gift"><span class="em">${HADIAH_IKON[h.id % HADIAH_IKON.length]}</span><h3>${esc(h.nama_hadiah)}</h3>
    <span class="pill">${fmt(h.poin_dibutuhkan)} poin</span> <span class="pill ${h.stok ? "" : "warn"}">${h.stok ? "Stok " + h.stok : "Stok habis"}</span>
    <div class="acts"><button class="btn sm ghost" data-edit="${h.id}">Ubah</button><button class="btn sm danger" data-del="${h.id}">Hapus</button></div></div>`).join("")
    : empty("🎁", "Belum ada hadiah. Tambahkan hadiah pertama untuk siswa.");
};
$("#gifts").onclick = async e => {
  const ed = e.target.closest("[data-edit]"), dl = e.target.closest("[data-del]");
  if (ed) formHadiah(HADIAH.find(h => h.id == ed.dataset.edit));
  if (dl) { const h = HADIAH.find(x => x.id == dl.dataset.del); if (await ask(`Hapus hadiah <b>${esc(h.nama_hadiah)}</b>?`)) run(() => api(`/api/hadiah/${h.id}`, "DELETE"), loaders.hadiah); }
};

/* ---------- TUKAR ---------- */
loaders.tukar = async () => {
  await refreshSiswa(); const sel = $("#tukarSiswa"), keep = sel.value;
  sel.innerHTML = SISWA.length ? opsiSiswa(keep) : `<option value="">(belum ada siswa)</option>`;
  await renderTukar();
  const list = await api("/api/penukaran");
  $("#tTukar").innerHTML = list.length ? `<thead><tr><th>Tanggal</th><th>Siswa</th><th>Hadiah</th><th class="r">Poin</th><th></th></tr></thead><tbody>` +
    list.map(p => `<tr class="in"><td>${esc(p.tanggal)}</td><td><b>${esc(p.nama)}</b> <small class="muted">${esc(p.kelas)}</small></td><td>${esc(p.nama_hadiah)}</td>
    <td class="r"><span class="pill warn">−${fmt(p.poin_dipakai)}</span></td><td class="act"><button class="btn sm ghost" data-batal="${p.id}" data-n="${esc(p.nama)}" data-h="${esc(p.nama_hadiah)}">Batalkan</button></td></tr>`).join("") + "</tbody>"
    : `<tbody><tr><td>${empty("🎁", "Belum ada penukaran.")}</td></tr></tbody>`;
};
async function renderTukar() {
  const s = SISWA.find(x => x.id == $("#tukarSiswa").value), box = $("#tukarBody"); HADIAH = await api("/api/hadiah");
  if (!s) { box.innerHTML = ""; return; }
  box.innerHTML = `<div class="passbook"><div><small>Buku tabungan</small><h2>${esc(s.nama)}</h2><small>Kelas ${esc(s.kelas)} · ID #${s.id}</small></div><div class="pts"><b>${fmt(s.total_poin)}</b><small>poin saat ini</small></div></div>
  <div class="tukar-grid">${HADIAH.map(h => { const ok = h.stok > 0 && s.total_poin >= h.poin_dibutuhkan;
    return `<div class="gift"><span class="em">${HADIAH_IKON[h.id % HADIAH_IKON.length]}</span><h3>${esc(h.nama_hadiah)}</h3><span class="pill">${fmt(h.poin_dibutuhkan)} poin</span>
    <span class="pill ${h.stok ? "" : "warn"}">${h.stok ? "Stok " + h.stok : "Habis"}</span>
    <div class="acts"><button class="btn sm amber" data-tukar="${h.id}" ${ok ? "" : "disabled"}>${h.stok <= 0 ? "Stok habis" : ok ? "Tukar sekarang" : `Kurang ${fmt(h.poin_dibutuhkan - s.total_poin)} poin`}</button></div></div>`; }).join("")}</div>`;
}
$("#tukarSiswa").onchange = renderTukar;
$("#tukarBody").onclick = async e => {
  const b = e.target.closest("[data-tukar]"); if (!b) return;
  const s = SISWA.find(x => x.id == $("#tukarSiswa").value), h = HADIAH.find(x => x.id == b.dataset.tukar);
  if (!await ask(`Tukar <b>${fmt(h.poin_dibutuhkan)} poin</b> milik ${esc(s.nama)} dengan <b>${esc(h.nama_hadiah)}</b>?`, "Ya, tukar")) return;
  try {
    const j = await api("/api/penukaran", "POST", { siswa_id: s.id, hadiah_id: h.id }), r = j.struk;
    const w = modal("Penukaran berhasil 🎁", `<div class="struk"><div class="mk">🎁</div><p><span>Nama</span><b>${esc(r.nama)}</b></p><p><span>Tanggal</span><span>${esc(r.tanggal)}</span></p><hr>
      <p><span>Hadiah</span><b>${esc(r.hadiah)}</b></p><p><span>Poin dipakai</span><span>−${fmt(r.poin)}</span></p><hr><p class="tot"><span>Sisa poin</span><span>${fmt(r.sisa)}</span></p></div>`, { submit: "Selesai", noCancel: true, cls: "amber" });
    setTimeout(() => leaves($(".struk .mk", w), 18, ["🎉", "✨", "🍃", "⭐"]), 250); await loaders.tukar();
  } catch (er) { toast(er.message, true); }
};
$("#tTukar").onclick = async e => {
  const b = e.target.closest("[data-batal]"); if (!b) return;
  if (await ask(`Batalkan penukaran <b>${b.dataset.h}</b> oleh ${b.dataset.n}? Poin dikembalikan dan stok bertambah.`, "Ya, batalkan")) run(() => api(`/api/penukaran/${b.dataset.batal}`, "DELETE"), loaders.tukar);
};

/* ---------- LAPORAN ---------- */
const bars = (arr, key, unit) => { const max = Math.max(...arr.map(a => a.berat), 0);
  return arr.length ? arr.map(a => `<div class="bar"><span>${esc(a[key])}</span><div class="t"><i data-w="${max ? a.berat / max * 100 : 0}"></i></div><b>${fmt(a.berat, 2)} ${unit}</b></div>`).join("") : empty("📊", "Belum ada data setoran."); };
loaders.laporan = async () => {
  const d = await api("/api/laporan");
  $("#barJenis").innerHTML = bars(d.per_jenis.map(j => ({ ...j, jenis: (IKON[j.jenis] || "") + " " + j.jenis })), "jenis", "kg");
  $("#barKelas").innerHTML = bars(d.per_kelas, "kelas", "kg");
  $("#rank").innerHTML = d.top.length ? d.top.map(s => `<li><b>${esc(s.nama)}</b><small class="muted">${esc(s.kelas)}</small><span>${fmt(s.total_poin)} poin</span></li>`).join("") : empty("🌱", "Belum ada siswa.");
  requestAnimationFrame(() => requestAnimationFrame(() => $$(".bar i").forEach(i => i.style.width = i.dataset.w + "%")));
};

/* ---------- aksi global ---------- */
const refreshAll = async () => { await refreshSiswa(); const v = ($(".view.on").id || "").slice(2); loaders[v] && loaders[v](); };
const ACT = {
  "siswa-baru": () => formSiswa(), "hadiah-baru": () => formHadiah(),
  setor: () => go("setor"), tukar: () => go("tukar"),
};
document.addEventListener("click", e => {
  const a = e.target.closest("[data-act]"); if (a) ACT[a.dataset.act]();
  const g = e.target.closest("[data-go]"); if (g && !g.closest("#nav")) go(g.dataset.go);
});

(async () => {
  try { JENIS = await api("/api/jenis"); await refreshSiswa(); } catch (e) { toast(e.message, true); }
  const v = location.hash.slice(1); go(loaders[v] ? v : "dash");
})();
})();