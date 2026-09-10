# Bank Sampah Sekolah — Versi Web

Versi web dari aplikasi Bank Sampah Sekolah, dibangun dengan **Flask** + **SQLite**.
Semua fitur dari versi terminal (versi `.py` awal) sudah tersedia di sini, tapi
dijalankan lewat **browser**, bukan terminal.

## Fitur
1. Daftar Siswa Baru
2. Setor Sampah (dengan struk digital)
3. Lihat Poin Siswa
4. Riwayat Setoran
5. Lihat Daftar Hadiah
6. Tukar Poin dengan Hadiah (dengan struk digital)
7. Laporan Rekap (grafik & peringkat siswa)
8. Hapus Data Siswa

## Cara Menjalankan

1. Pastikan Python 3.8+ sudah terpasang.
2. Buka terminal di folder ini, lalu install dependensi:

   ```bash
   pip install -r requirements.txt
   ```

3. Jalankan aplikasi:

   ```bash
   python app.py
   ```

4. Buka browser dan akses:

   ```
   http://127.0.0.1:5000
   ```

5. Database `bank_sampah.db` akan otomatis dibuat di folder ini saat pertama
   kali dijalankan — sama seperti versi terminal, tidak perlu setup database
   tambahan.

## Struktur Folder

```
bank_sampah_web/
├── app.py                 # Backend Flask (semua logika & route)
├── requirements.txt
├── bank_sampah.db          # dibuat otomatis saat pertama dijalankan
├── static/
│   └── style.css          # tampilan (tema "buku tabungan hijau")
└── templates/
    ├── base.html           # kerangka halaman + sidebar navigasi
    ├── index.html          # dashboard
    ├── daftar_siswa.html
    ├── setor_sampah.html
    ├── struk_setoran.html
    ├── lihat_poin.html
    ├── riwayat.html
    ├── hadiah.html
    ├── tukar_hadiah.html
    ├── struk_tukar.html
    ├── laporan.html
    └── hapus_siswa.html
```

## Catatan
- Untuk mematikan mode debug saat dipakai sungguhan (bukan sekadar demo),
  ubah `app.run(debug=True)` di baris terakhir `app.py` menjadi
  `app.run(debug=False)`.
- Jika ingin diakses dari perangkat lain di jaringan sekolah yang sama,
  jalankan dengan `app.run(host="0.0.0.0")`.
