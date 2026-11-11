import os
import sqlite3
from datetime import datetime

from flask import Flask, jsonify, render_template, request

# Di Vercel, hanya /tmp yang bisa ditulis (dan isinya tidak permanen)
DB_NAME = "/tmp/bank_sampah.db" if os.environ.get("VERCEL") else "bank_sampah.db"
# Vercel menyajikan file statis dari folder public/ (lewat CDN, tersedia di root: /style.css)
app = Flask(__name__, static_folder="public", static_url_path="")
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0


@app.context_processor
def versi_static():
    def v(f):
        try:
            return int(os.path.getmtime(os.path.join(app.static_folder, f)))
        except OSError:
            return 0
    return {"v": v}

# kode -> (nama, poin per kg)
JENIS = {
    "1": ("Plastik", 100),
    "2": ("Kertas", 80),
    "3": ("Kaleng/Logam", 150),
    "4": ("Kaca", 60),
    "5": ("Minyak Jelantah", 200),
}
POIN_PER_POHON = 500


# ------------------------------------------------------------------ DB
def db():
    c = sqlite3.connect(DB_NAME)
    c.execute("PRAGMA foreign_keys = ON")
    c.row_factory = sqlite3.Row
    return c


def setup_database():
    c = db()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS siswa (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama TEXT NOT NULL, kelas TEXT NOT NULL, total_poin INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS setoran (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        siswa_id INTEGER NOT NULL, jenis_sampah TEXT NOT NULL,
        berat_kg REAL NOT NULL, poin_didapat INTEGER NOT NULL, tanggal TEXT NOT NULL,
        FOREIGN KEY (siswa_id) REFERENCES siswa(id));
    CREATE TABLE IF NOT EXISTS hadiah (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama_hadiah TEXT NOT NULL, poin_dibutuhkan INTEGER NOT NULL, stok INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS penukaran (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        siswa_id INTEGER NOT NULL, hadiah_id INTEGER NOT NULL, tanggal TEXT NOT NULL,
        FOREIGN KEY (siswa_id) REFERENCES siswa(id),
        FOREIGN KEY (hadiah_id) REFERENCES hadiah(id));
    """)
    # migrasi: simpan poin yang dipakai saat penukaran (database lama belum punya)
    kolom = [r["name"] for r in c.execute("PRAGMA table_info(penukaran)")]
    if "poin_dipakai" not in kolom:
        c.execute("ALTER TABLE penukaran ADD COLUMN poin_dipakai INTEGER NOT NULL DEFAULT 0")
        c.execute("""UPDATE penukaran SET poin_dipakai =
                     (SELECT poin_dibutuhkan FROM hadiah WHERE hadiah.id = penukaran.hadiah_id)""")
    if c.execute("SELECT COUNT(*) FROM hadiah").fetchone()[0] == 0:
        c.executemany("INSERT INTO hadiah (nama_hadiah, poin_dibutuhkan, stok) VALUES (?,?,?)", [
            ("Alat Tulis Set", 300, 20), ("Tumbler Sekolah", 800, 10),
            ("Payung Lipat", 1200, 5), ("Voucher Kantin Rp10.000", 500, 15)])
    for r in c.execute("SELECT id FROM siswa").fetchall():
        hitung_poin(c, r["id"])
    c.commit()
    c.close()


def hitung_poin(c, siswa_id):
    """Total poin = semua setoran - semua poin yang sudah ditukar. Selalu konsisten."""
    masuk = c.execute("SELECT COALESCE(SUM(poin_didapat),0) FROM setoran WHERE siswa_id=?", (siswa_id,)).fetchone()[0]
    keluar = c.execute("SELECT COALESCE(SUM(poin_dipakai),0) FROM penukaran WHERE siswa_id=?", (siswa_id,)).fetchone()[0]
    total = masuk - keluar
    c.execute("UPDATE siswa SET total_poin=? WHERE id=?", (total, siswa_id))
    return total


def rows(cur):
    return [dict(r) for r in cur.fetchall()]


def gagal(pesan, kode=400):
    return jsonify(ok=False, error=pesan), kode


def body():
    return request.get_json(silent=True) or {}


def sekarang():
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def baca_berat(v):
    try:
        b = round(float(v), 2)
    except (TypeError, ValueError):
        return None
    return b if b > 0 else None


def cari(q):
    like = f"%{q}%"
    return ("WHERE s.nama LIKE ? OR s.kelas LIKE ? OR s.id = ?", (like, like, int(q) if q.isdigit() else -1)) if q else ("", ())


# ------------------------------------------------------------------ HALAMAN
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/jenis")
def api_jenis():
    return jsonify([{"kode": k, "nama": v[0], "harga": v[1]} for k, v in JENIS.items()])


# ------------------------------------------------------------------ RINGKASAN
@app.route("/api/ringkasan")
def api_ringkasan():
    c = db()
    one = lambda sql: c.execute(sql).fetchone()[0]
    kumpul = one("SELECT COALESCE(SUM(poin_didapat),0) FROM setoran")
    data = {
        "jumlah_siswa": one("SELECT COUNT(*) FROM siswa"),
        "total_berat": one("SELECT COALESCE(SUM(berat_kg),0) FROM setoran"),
        "poin_beredar": one("SELECT COALESCE(SUM(total_poin),0) FROM siswa"),
        "poin_terkumpul": kumpul,
        "jumlah_setoran": one("SELECT COUNT(*) FROM setoran"),
        "jumlah_penukaran": one("SELECT COUNT(*) FROM penukaran"),
        "poin_per_pohon": POIN_PER_POHON,
        "pohon": kumpul // POIN_PER_POHON,
        "sisa": kumpul % POIN_PER_POHON,
    }
    data["terbaru"] = rows(c.execute("""
        SELECT s.tanggal, si.nama, s.jenis_sampah AS ket, s.berat_kg, s.poin_didapat AS poin, 'setor' AS tipe
        FROM setoran s JOIN siswa si ON si.id=s.siswa_id
        UNION ALL
        SELECT p.tanggal, si.nama, h.nama_hadiah, NULL, -p.poin_dipakai, 'tukar'
        FROM penukaran p JOIN siswa si ON si.id=p.siswa_id JOIN hadiah h ON h.id=p.hadiah_id
        ORDER BY tanggal DESC LIMIT 6"""))
    c.close()
    return jsonify(data)


# ------------------------------------------------------------------ SISWA (CRUD)
@app.route("/api/siswa", methods=["GET"])
def siswa_list():
    where, args = cari(request.args.get("q", "").strip())
    c = db()
    data = rows(c.execute(f"""SELECT s.id, s.nama, s.kelas, s.total_poin,
        (SELECT COUNT(*) FROM setoran WHERE siswa_id=s.id) AS jml_setoran
        FROM siswa s {where} ORDER BY s.nama COLLATE NOCASE""", args))
    c.close()
    return jsonify(data)


@app.route("/api/siswa", methods=["POST"])
def siswa_tambah():
    d = body()
    nama, kelas = str(d.get("nama", "")).strip(), str(d.get("kelas", "")).strip()
    if not nama or not kelas:
        return gagal("Nama dan kelas wajib diisi.")
    c = db()
    cur = c.execute("INSERT INTO siswa (nama, kelas) VALUES (?,?)", (nama, kelas))
    c.commit()
    sid = cur.lastrowid
    c.close()
    return jsonify(ok=True, id=sid, pesan=f"{nama} terdaftar dengan ID {sid}.")


@app.route("/api/siswa/<int:sid>", methods=["PUT"])
def siswa_ubah(sid):
    d = body()
    nama, kelas = str(d.get("nama", "")).strip(), str(d.get("kelas", "")).strip()
    if not nama or not kelas:
        return gagal("Nama dan kelas wajib diisi.")
    c = db()
    cur = c.execute("UPDATE siswa SET nama=?, kelas=? WHERE id=?", (nama, kelas, sid))
    c.commit()
    c.close()
    if cur.rowcount == 0:
        return gagal("Siswa tidak ditemukan.", 404)
    return jsonify(ok=True, pesan="Data siswa diperbarui.")


@app.route("/api/siswa/hapus", methods=["POST"])
def siswa_hapus_banyak():
    ids = [int(i) for i in body().get("ids", []) if str(i).isdigit()]
    if not ids:
        return gagal("Pilih minimal satu siswa.")
    ph = ",".join("?" * len(ids))
    c = db()
    for t in ("penukaran", "setoran"):
        c.execute(f"DELETE FROM {t} WHERE siswa_id IN ({ph})", ids)
    cur = c.execute(f"DELETE FROM siswa WHERE id IN ({ph})", ids)
    c.commit()
    c.close()
    return jsonify(ok=True, pesan=f"{cur.rowcount} siswa beserta riwayatnya dihapus.")


@app.route("/api/siswa/<int:sid>", methods=["DELETE"])
def siswa_hapus(sid):
    c = db()
    c.execute("DELETE FROM penukaran WHERE siswa_id=?", (sid,))
    c.execute("DELETE FROM setoran WHERE siswa_id=?", (sid,))
    cur = c.execute("DELETE FROM siswa WHERE id=?", (sid,))
    c.commit()
    c.close()
    if cur.rowcount == 0:
        return gagal("Siswa tidak ditemukan.", 404)
    return jsonify(ok=True, pesan="Siswa dan riwayatnya dihapus.")


# ------------------------------------------------------------------ SETORAN (CRUD)
@app.route("/api/setoran", methods=["GET"])
def setoran_list():
    where, args = cari(request.args.get("q", "").strip())
    c = db()
    data = rows(c.execute(f"""SELECT st.id, st.siswa_id, st.tanggal, s.nama, s.kelas,
        st.jenis_sampah, st.berat_kg, st.poin_didapat
        FROM setoran st JOIN siswa s ON s.id=st.siswa_id {where}
        ORDER BY st.tanggal DESC, st.id DESC""", args))
    c.close()
    return jsonify(data)


@app.route("/api/setoran", methods=["POST"])
def setoran_tambah():
    d = body()
    c = db()
    s = c.execute("SELECT * FROM siswa WHERE id=?", (d.get("siswa_id"),)).fetchone()
    if not s:
        c.close()
        return gagal("Pilih siswa terlebih dahulu.")
    if str(d.get("jenis")) not in JENIS:
        c.close()
        return gagal("Jenis sampah tidak valid.")
    berat = baca_berat(d.get("berat"))
    if berat is None:
        c.close()
        return gagal("Berat harus berupa angka lebih dari 0.")
    nama, harga = JENIS[str(d["jenis"])]
    poin = int(berat * harga)
    tgl = sekarang()
    c.execute("INSERT INTO setoran (siswa_id,jenis_sampah,berat_kg,poin_didapat,tanggal) VALUES (?,?,?,?,?)",
              (s["id"], nama, berat, poin, tgl))
    sesudah = hitung_poin(c, s["id"])
    c.commit()
    c.close()
    return jsonify(ok=True, pesan=f"Setoran {nama} {berat} kg tercatat (+{poin} poin).", struk={
        "nama": s["nama"], "kelas": s["kelas"], "tanggal": tgl, "jenis": nama, "berat": berat,
        "harga": harga, "poin": poin, "sebelum": s["total_poin"], "sesudah": sesudah})


@app.route("/api/setoran/<int:tid>", methods=["PUT"])
def setoran_ubah(tid):
    d = body()
    c = db()
    row = c.execute("SELECT * FROM setoran WHERE id=?", (tid,)).fetchone()
    if not row:
        c.close()
        return gagal("Setoran tidak ditemukan.", 404)
    if str(d.get("jenis")) not in JENIS:
        c.close()
        return gagal("Jenis sampah tidak valid.")
    berat = baca_berat(d.get("berat"))
    if berat is None:
        c.close()
        return gagal("Berat harus berupa angka lebih dari 0.")
    nama, harga = JENIS[str(d["jenis"])]
    c.execute("UPDATE setoran SET jenis_sampah=?, berat_kg=?, poin_didapat=? WHERE id=?",
              (nama, berat, int(berat * harga), tid))
    if hitung_poin(c, row["siswa_id"]) < 0:
        c.rollback()
        c.close()
        return gagal("Perubahan ditolak: poin siswa akan negatif karena sebagian poin sudah ditukar hadiah.")
    c.commit()
    c.close()
    return jsonify(ok=True, pesan="Setoran diperbarui, poin dihitung ulang.")


@app.route("/api/setoran/<int:tid>", methods=["DELETE"])
def setoran_hapus(tid):
    c = db()
    row = c.execute("SELECT siswa_id FROM setoran WHERE id=?", (tid,)).fetchone()
    if not row:
        c.close()
        return gagal("Setoran tidak ditemukan.", 404)
    c.execute("DELETE FROM setoran WHERE id=?", (tid,))
    if hitung_poin(c, row["siswa_id"]) < 0:
        c.rollback()
        c.close()
        return gagal("Tidak bisa dihapus: poin siswa akan negatif karena sebagian poin sudah ditukar hadiah.")
    c.commit()
    c.close()
    return jsonify(ok=True, pesan="Setoran dihapus, poin dihitung ulang.")


# ------------------------------------------------------------------ HADIAH (CRUD)
def baca_hadiah(d):
    nama = str(d.get("nama_hadiah", "")).strip()
    try:
        poin, stok = int(d.get("poin_dibutuhkan")), int(d.get("stok"))
    except (TypeError, ValueError):
        return None, "Poin dan stok harus berupa angka bulat."
    if not nama:
        return None, "Nama hadiah wajib diisi."
    if poin <= 0 or stok < 0:
        return None, "Poin harus lebih dari 0 dan stok tidak boleh negatif."
    return (nama, poin, stok), None


@app.route("/api/hadiah", methods=["GET"])
def hadiah_list():
    c = db()
    data = rows(c.execute("SELECT * FROM hadiah ORDER BY poin_dibutuhkan, nama_hadiah"))
    c.close()
    return jsonify(data)


@app.route("/api/hadiah", methods=["POST"])
def hadiah_tambah():
    v, e = baca_hadiah(body())
    if e:
        return gagal(e)
    c = db()
    c.execute("INSERT INTO hadiah (nama_hadiah, poin_dibutuhkan, stok) VALUES (?,?,?)", v)
    c.commit()
    c.close()
    return jsonify(ok=True, pesan=f"Hadiah '{v[0]}' ditambahkan.")


@app.route("/api/hadiah/<int:hid>", methods=["PUT"])
def hadiah_ubah(hid):
    v, e = baca_hadiah(body())
    if e:
        return gagal(e)
    c = db()
    cur = c.execute("UPDATE hadiah SET nama_hadiah=?, poin_dibutuhkan=?, stok=? WHERE id=?", (*v, hid))
    c.commit()
    c.close()
    if cur.rowcount == 0:
        return gagal("Hadiah tidak ditemukan.", 404)
    return jsonify(ok=True, pesan="Hadiah diperbarui.")


@app.route("/api/hadiah/<int:hid>", methods=["DELETE"])
def hadiah_hapus(hid):
    c = db()
    if c.execute("SELECT 1 FROM penukaran WHERE hadiah_id=?", (hid,)).fetchone():
        c.close()
        return gagal("Hadiah ini sudah pernah ditukar. Set stoknya ke 0 saja agar riwayat tetap utuh.", 409)
    cur = c.execute("DELETE FROM hadiah WHERE id=?", (hid,))
    c.commit()
    c.close()
    if cur.rowcount == 0:
        return gagal("Hadiah tidak ditemukan.", 404)
    return jsonify(ok=True, pesan="Hadiah dihapus.")


# ------------------------------------------------------------------ PENUKARAN
@app.route("/api/penukaran", methods=["GET"])
def penukaran_list():
    c = db()
    data = rows(c.execute("""SELECT p.id, p.tanggal, s.nama, s.kelas, h.nama_hadiah, p.poin_dipakai
        FROM penukaran p JOIN siswa s ON s.id=p.siswa_id JOIN hadiah h ON h.id=p.hadiah_id
        ORDER BY p.tanggal DESC, p.id DESC"""))
    c.close()
    return jsonify(data)


@app.route("/api/penukaran", methods=["POST"])
def penukaran_tambah():
    d = body()
    c = db()
    s = c.execute("SELECT * FROM siswa WHERE id=?", (d.get("siswa_id"),)).fetchone()
    h = c.execute("SELECT * FROM hadiah WHERE id=?", (d.get("hadiah_id"),)).fetchone()
    if not s or not h:
        c.close()
        return gagal("Siswa atau hadiah tidak ditemukan.")
    if h["stok"] <= 0:
        c.close()
        return gagal("Stok hadiah ini sudah habis.")
    if s["total_poin"] < h["poin_dibutuhkan"]:
        c.close()
        return gagal(f"Poin kurang. Butuh {h['poin_dibutuhkan']}, poin {s['nama']} saat ini {s['total_poin']}.")
    tgl = sekarang()
    c.execute("UPDATE hadiah SET stok=stok-1 WHERE id=? AND stok>0", (h["id"],))
    c.execute("INSERT INTO penukaran (siswa_id,hadiah_id,tanggal,poin_dipakai) VALUES (?,?,?,?)",
              (s["id"], h["id"], tgl, h["poin_dibutuhkan"]))
    sisa = hitung_poin(c, s["id"])
    c.commit()
    c.close()
    return jsonify(ok=True, pesan=f"{s['nama']} menukar {h['nama_hadiah']}.", struk={
        "nama": s["nama"], "kelas": s["kelas"], "tanggal": tgl,
        "hadiah": h["nama_hadiah"], "poin": h["poin_dibutuhkan"], "sisa": sisa})


@app.route("/api/penukaran/<int:pid>", methods=["DELETE"])
def penukaran_batal(pid):
    c = db()
    p = c.execute("SELECT * FROM penukaran WHERE id=?", (pid,)).fetchone()
    if not p:
        c.close()
        return gagal("Penukaran tidak ditemukan.", 404)
    c.execute("DELETE FROM penukaran WHERE id=?", (pid,))
    c.execute("UPDATE hadiah SET stok=stok+1 WHERE id=?", (p["hadiah_id"],))
    hitung_poin(c, p["siswa_id"])
    c.commit()
    c.close()
    return jsonify(ok=True, pesan="Penukaran dibatalkan. Poin dikembalikan dan stok bertambah.")


# ------------------------------------------------------------------ LAPORAN
@app.route("/api/laporan")
def api_laporan():
    c = db()
    data = {
        "per_jenis": rows(c.execute("""SELECT jenis_sampah AS jenis, SUM(berat_kg) AS berat, SUM(poin_didapat) AS poin
            FROM setoran GROUP BY jenis_sampah ORDER BY berat DESC""")),
        "top": rows(c.execute("""SELECT nama, kelas, total_poin FROM siswa
            ORDER BY total_poin DESC, nama LIMIT 5""")),
        "per_kelas": rows(c.execute("""SELECT s.kelas, COALESCE(SUM(st.berat_kg),0) AS berat
            FROM siswa s LEFT JOIN setoran st ON st.siswa_id=s.id
            GROUP BY s.kelas ORDER BY berat DESC LIMIT 6""")),
    }
    c.close()
    return jsonify(data)


setup_database()

if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=8000)