import sqlite3
from datetime import datetime

from flask import Flask, render_template, request, redirect, url_for, flash

DB_NAME = "bank_sampah.db"

app = Flask(__name__)
app.secret_key = "bank-sampah-sekolah-secret-key"  # hanya untuk flash message

# peta endpoint -> kunci 'active' untuk highlight menu di sidebar
_ACTIVE_MAP = {
    "daftar_siswa_baru": "daftar",
    "setor_sampah": "setor",
    "setor_sampah_proses": "setor",
    "lihat_poin_siswa": "poin",
    "riwayat_setoran": "riwayat",
    "lihat_hadiah": "hadiah",
    "tukar_hadiah": "tukar",
    "tukar_hadiah_proses": "tukar",
    "laporan_total": "laporan",
    "hapus_siswa": "hapus",
    "hapus_siswa_proses": "hapus",
}


@app.context_processor
def inject_active():
    return {"active": _ACTIVE_MAP.get(request.endpoint, "")}

# Harga poin per kilogram untuk tiap jenis sampah (1 kg = sekian poin)
HARGA_SAMPAH = {
    "1": ("Plastik", 100),
    "2": ("Kertas", 80),
    "3": ("Kaleng/Logam", 150),
    "4": ("Kaca", 60),
    "5": ("Minyak Jelantah", 200),
}


# ---------------------------------------------------------
# BAGIAN DATABASE
# ---------------------------------------------------------
def buat_koneksi():
    conn = sqlite3.connect(DB_NAME)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    return conn


def setup_database():
    """Membuat tabel-tabel yang dibutuhkan jika belum ada."""
    conn = buat_koneksi()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS siswa (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nama TEXT NOT NULL,
            kelas TEXT NOT NULL,
            total_poin INTEGER DEFAULT 0
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS setoran (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            siswa_id INTEGER NOT NULL,
            jenis_sampah TEXT NOT NULL,
            berat_kg REAL NOT NULL,
            poin_didapat INTEGER NOT NULL,
            tanggal TEXT NOT NULL,
            FOREIGN KEY (siswa_id) REFERENCES siswa(id)
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS hadiah (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nama_hadiah TEXT NOT NULL,
            poin_dibutuhkan INTEGER NOT NULL,
            stok INTEGER NOT NULL
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS penukaran (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            siswa_id INTEGER NOT NULL,
            hadiah_id INTEGER NOT NULL,
            tanggal TEXT NOT NULL,
            FOREIGN KEY (siswa_id) REFERENCES siswa(id),
            FOREIGN KEY (hadiah_id) REFERENCES hadiah(id)
        )
    """)

    cur.execute("SELECT COUNT(*) FROM hadiah")
    if cur.fetchone()[0] == 0:
        contoh_hadiah = [
            ("Alat Tulis Set", 300, 20),
            ("Tumbler Sekolah", 800, 10),
            ("Payung Lipat", 1200, 5),
            ("Voucher Kantin Rp10.000", 500, 15),
        ]
        cur.executemany(
            "INSERT INTO hadiah (nama_hadiah, poin_dibutuhkan, stok) VALUES (?, ?, ?)",
            contoh_hadiah,
        )

    conn.commit()
    conn.close()


def cari_siswa(cur, kata_kunci):
    kata_kunci = (kata_kunci or "").strip()
    cur.execute(
        "SELECT id, nama, kelas, total_poin FROM siswa WHERE id = ? OR nama LIKE ? ORDER BY nama",
        (kata_kunci if kata_kunci.isdigit() else -1, f"%{kata_kunci}%"),
    )
    return cur.fetchall()


def ambil_ringkasan():
    conn = buat_koneksi()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM siswa")
    jumlah_siswa = cur.fetchone()[0]
    cur.execute("SELECT COALESCE(SUM(berat_kg), 0) FROM setoran")
    total_berat = cur.fetchone()[0]
    cur.execute("SELECT COALESCE(SUM(poin_didapat), 0) FROM setoran")
    total_poin = cur.fetchone()[0]
    conn.close()
    return {
        "jumlah_siswa": jumlah_siswa,
        "total_berat": total_berat,
        "total_poin": total_poin,
    }


# ---------------------------------------------------------
# ROUTES
# ---------------------------------------------------------
@app.route("/")
def index():
    ringkasan = ambil_ringkasan()
    return render_template("index.html", ringkasan=ringkasan)


# ---- 1. Daftar Siswa Baru ----
@app.route("/siswa/baru", methods=["GET", "POST"])
def daftar_siswa_baru():
    if request.method == "POST":
        nama = request.form.get("nama", "").strip()
        kelas = request.form.get("kelas", "").strip()

        if not nama or not kelas:
            flash("Nama dan kelas tidak boleh kosong.", "error")
            return redirect(url_for("daftar_siswa_baru"))

        conn = buat_koneksi()
        cur = conn.cursor()
        cur.execute("INSERT INTO siswa (nama, kelas) VALUES (?, ?)", (nama, kelas))
        conn.commit()
        siswa_id = cur.lastrowid
        conn.close()

        flash(f"Siswa '{nama}' berhasil didaftarkan dengan ID {siswa_id}.", "success")
        return redirect(url_for("daftar_siswa_baru"))

    return render_template("daftar_siswa.html")


# ---- 2. Setor Sampah ----
@app.route("/setor", methods=["GET"])
def setor_sampah():
    kata_kunci = request.args.get("q", "").strip()
    hasil = []
    if kata_kunci:
        conn = buat_koneksi()
        cur = conn.cursor()
        hasil = cari_siswa(cur, kata_kunci)
        conn.close()
    return render_template(
        "setor_sampah.html",
        kata_kunci=kata_kunci,
        hasil=hasil,
        harga_sampah=HARGA_SAMPAH,
    )


@app.route("/setor/proses", methods=["POST"])
def setor_sampah_proses():
    siswa_id = request.form.get("siswa_id")
    kode_jenis = request.form.get("jenis")
    berat_raw = request.form.get("berat", "").strip()

    conn = buat_koneksi()
    cur = conn.cursor()
    cur.execute("SELECT id, nama, kelas, total_poin FROM siswa WHERE id = ?", (siswa_id,))
    siswa = cur.fetchone()

    if not siswa:
        conn.close()
        flash("Siswa tidak ditemukan.", "error")
        return redirect(url_for("setor_sampah"))

    if kode_jenis not in HARGA_SAMPAH:
        conn.close()
        flash("Jenis sampah tidak valid.", "error")
        return redirect(url_for("setor_sampah", q=siswa["nama"]))

    try:
        berat = float(berat_raw)
        if berat <= 0:
            raise ValueError
    except ValueError:
        conn.close()
        flash("Berat harus berupa angka positif.", "error")
        return redirect(url_for("setor_sampah", q=siswa["nama"]))

    nama_sampah, harga_per_kg = HARGA_SAMPAH[kode_jenis]
    poin_didapat = int(berat * harga_per_kg)
    tanggal = datetime.now().strftime("%Y-%m-%d %H:%M")

    cur.execute(
        "INSERT INTO setoran (siswa_id, jenis_sampah, berat_kg, poin_didapat, tanggal) VALUES (?, ?, ?, ?, ?)",
        (siswa["id"], nama_sampah, berat, poin_didapat, tanggal),
    )
    cur.execute(
        "UPDATE siswa SET total_poin = total_poin + ? WHERE id = ?",
        (poin_didapat, siswa["id"]),
    )
    conn.commit()
    conn.close()

    struk = {
        "nama": siswa["nama"],
        "kelas": siswa["kelas"],
        "jenis_sampah": nama_sampah,
        "berat": berat,
        "harga_per_kg": harga_per_kg,
        "poin_didapat": poin_didapat,
        "total_poin_sebelum": siswa["total_poin"],
        "total_poin_sesudah": siswa["total_poin"] + poin_didapat,
        "tanggal": tanggal,
    }
    return render_template("struk_setoran.html", struk=struk)


# ---- 3. Lihat Poin Siswa ----
@app.route("/siswa/poin")
def lihat_poin_siswa():
    kata_kunci = request.args.get("q", "").strip()
    hasil = []
    if kata_kunci:
        conn = buat_koneksi()
        cur = conn.cursor()
        hasil = cari_siswa(cur, kata_kunci)
        conn.close()
    else:
        conn = buat_koneksi()
        cur = conn.cursor()
        cur.execute("SELECT id, nama, kelas, total_poin FROM siswa ORDER BY nama")
        hasil = cur.fetchall()
        conn.close()
    return render_template("lihat_poin.html", kata_kunci=kata_kunci, hasil=hasil)


# ---- 4. Riwayat Setoran ----
@app.route("/riwayat")
def riwayat_setoran():
    kata_kunci = request.args.get("q", "").strip()
    conn = buat_koneksi()
    cur = conn.cursor()

    if kata_kunci:
        hasil_siswa = cari_siswa(cur, kata_kunci)
        if not hasil_siswa:
            conn.close()
            flash("Siswa tidak ditemukan.", "error")
            return render_template("riwayat.html", kata_kunci=kata_kunci, data=[])
        siswa_id = hasil_siswa[0]["id"]
        cur.execute(
            """SELECT s.tanggal, si.nama, s.jenis_sampah, s.berat_kg, s.poin_didapat
               FROM setoran s JOIN siswa si ON s.siswa_id = si.id
               WHERE s.siswa_id = ? ORDER BY s.tanggal DESC""",
            (siswa_id,),
        )
    else:
        cur.execute(
            """SELECT s.tanggal, si.nama, s.jenis_sampah, s.berat_kg, s.poin_didapat
               FROM setoran s JOIN siswa si ON s.siswa_id = si.id
               ORDER BY s.tanggal DESC"""
        )

    data = cur.fetchall()
    conn.close()
    return render_template("riwayat.html", kata_kunci=kata_kunci, data=data)


# ---- 5. Lihat Daftar Hadiah ----
@app.route("/hadiah")
def lihat_hadiah():
    conn = buat_koneksi()
    cur = conn.cursor()
    cur.execute("SELECT id, nama_hadiah, poin_dibutuhkan, stok FROM hadiah ORDER BY poin_dibutuhkan")
    data = cur.fetchall()
    conn.close()
    return render_template("hadiah.html", data=data)


# ---- 6. Tukar Poin dengan Hadiah ----
@app.route("/tukar", methods=["GET"])
def tukar_hadiah():
    kata_kunci = request.args.get("q", "").strip()
    siswa = None
    hasil = []
    conn = buat_koneksi()
    cur = conn.cursor()

    if kata_kunci:
        hasil = cari_siswa(cur, kata_kunci)

    siswa_id = request.args.get("siswa_id")
    if siswa_id:
        cur.execute("SELECT id, nama, kelas, total_poin FROM siswa WHERE id = ?", (siswa_id,))
        siswa = cur.fetchone()

    cur.execute("SELECT id, nama_hadiah, poin_dibutuhkan, stok FROM hadiah ORDER BY poin_dibutuhkan")
    daftar_hadiah = cur.fetchall()
    conn.close()

    return render_template(
        "tukar_hadiah.html",
        kata_kunci=kata_kunci,
        hasil=hasil,
        siswa=siswa,
        daftar_hadiah=daftar_hadiah,
    )


@app.route("/tukar/proses", methods=["POST"])
def tukar_hadiah_proses():
    siswa_id = request.form.get("siswa_id")
    hadiah_id = request.form.get("hadiah_id")

    conn = buat_koneksi()
    cur = conn.cursor()
    cur.execute("SELECT id, nama, kelas, total_poin FROM siswa WHERE id = ?", (siswa_id,))
    siswa = cur.fetchone()

    if not siswa:
        conn.close()
        flash("Siswa tidak ditemukan.", "error")
        return redirect(url_for("tukar_hadiah"))

    cur.execute("SELECT id, nama_hadiah, poin_dibutuhkan, stok FROM hadiah WHERE id = ?", (hadiah_id,))
    hadiah = cur.fetchone()

    if not hadiah:
        conn.close()
        flash("Hadiah tidak ditemukan.", "error")
        return redirect(url_for("tukar_hadiah", q=siswa["nama"], siswa_id=siswa["id"]))

    if hadiah["stok"] <= 0:
        conn.close()
        flash("Maaf, stok hadiah ini sudah habis.", "error")
        return redirect(url_for("tukar_hadiah", q=siswa["nama"], siswa_id=siswa["id"]))

    if siswa["total_poin"] < hadiah["poin_dibutuhkan"]:
        conn.close()
        flash(
            f"Poin tidak cukup. Dibutuhkan {hadiah['poin_dibutuhkan']}, poin kamu {siswa['total_poin']}.",
            "error",
        )
        return redirect(url_for("tukar_hadiah", q=siswa["nama"], siswa_id=siswa["id"]))

    tanggal = datetime.now().strftime("%Y-%m-%d %H:%M")
    cur.execute(
        "UPDATE siswa SET total_poin = total_poin - ? WHERE id = ?",
        (hadiah["poin_dibutuhkan"], siswa["id"]),
    )
    cur.execute("UPDATE hadiah SET stok = stok - 1 WHERE id = ?", (hadiah["id"],))
    cur.execute(
        "INSERT INTO penukaran (siswa_id, hadiah_id, tanggal) VALUES (?, ?, ?)",
        (siswa["id"], hadiah["id"], tanggal),
    )
    conn.commit()
    conn.close()

    struk = {
        "nama": siswa["nama"],
        "kelas": siswa["kelas"],
        "nama_hadiah": hadiah["nama_hadiah"],
        "poin_dibutuhkan": hadiah["poin_dibutuhkan"],
        "sisa_poin": siswa["total_poin"] - hadiah["poin_dibutuhkan"],
        "tanggal": tanggal,
    }
    return render_template("struk_tukar.html", struk=struk)


# ---- 7. Laporan Rekap ----
@app.route("/laporan")
def laporan_total():
    conn = buat_koneksi()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM siswa")
    jumlah_siswa = cur.fetchone()[0]

    cur.execute("SELECT COALESCE(SUM(berat_kg), 0) FROM setoran")
    total_berat = cur.fetchone()[0]

    cur.execute("SELECT COALESCE(SUM(poin_didapat), 0) FROM setoran")
    total_poin_terkumpul = cur.fetchone()[0]

    cur.execute("""
        SELECT jenis_sampah, SUM(berat_kg) as total
        FROM setoran GROUP BY jenis_sampah ORDER BY total DESC
    """)
    per_jenis = cur.fetchall()
    max_berat = max([row["total"] for row in per_jenis], default=0)

    cur.execute("""
        SELECT si.nama, si.total_poin FROM siswa si
        ORDER BY si.total_poin DESC LIMIT 3
    """)
    top3 = cur.fetchall()

    conn.close()

    return render_template(
        "laporan.html",
        jumlah_siswa=jumlah_siswa,
        total_berat=total_berat,
        total_poin_terkumpul=total_poin_terkumpul,
        per_jenis=per_jenis,
        max_berat=max_berat,
        top3=top3,
    )


# ---- 8. Hapus Data Siswa ----
@app.route("/siswa/hapus")
def hapus_siswa():
    kata_kunci = request.args.get("q", "").strip()
    conn = buat_koneksi()
    cur = conn.cursor()
    if kata_kunci:
        hasil = cari_siswa(cur, kata_kunci)
    else:
        cur.execute("SELECT id, nama, kelas, total_poin FROM siswa ORDER BY nama")
        hasil = cur.fetchall()
    conn.close()
    return render_template("hapus_siswa.html", kata_kunci=kata_kunci, hasil=hasil)


@app.route("/siswa/hapus/proses", methods=["POST"])
def hapus_siswa_proses():
    daftar_id = request.form.getlist("siswa_id")

    if not daftar_id:
        flash("Tidak ada siswa yang dipilih untuk dihapus.", "error")
        return redirect(url_for("hapus_siswa"))

    conn = buat_koneksi()
    cur = conn.cursor()
    placeholder = ",".join("?" * len(daftar_id))
    cur.execute(f"SELECT nama FROM siswa WHERE id IN ({placeholder})", daftar_id)
    nama_list = [row["nama"] for row in cur.fetchall()]

    cur.execute(f"DELETE FROM penukaran WHERE siswa_id IN ({placeholder})", daftar_id)
    cur.execute(f"DELETE FROM setoran WHERE siswa_id IN ({placeholder})", daftar_id)
    cur.execute(f"DELETE FROM siswa WHERE id IN ({placeholder})", daftar_id)
    conn.commit()
    conn.close()

    flash(f"Berhasil menghapus {len(nama_list)} data siswa: {', '.join(nama_list)}.", "success")
    return redirect(url_for("hapus_siswa"))


if __name__ == "__main__":
    setup_database()
    app.run(debug=True, host="127.0.0.1", port=8000)