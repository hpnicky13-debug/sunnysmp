SUNNYSTORE — PROMO BACKEND
==========================

PENTING
File HTML saja tidak bisa melakukan validasi promo yang aman. Jalankan backend ini dan layani halaman dari backend yang sama. Jangan upload HTML ini sebagai static-only page jika ingin validasi backend bekerja.

ISI FOLDER
- server.js                       Backend Node.js tanpa dependency eksternal
- index-sunnystore-final.html     Letakkan file HTML yang sudah dimodifikasi di folder ini
- .env.example                   Contoh konfigurasi promo

CARA MENJALANKAN
1. Install Node.js 18 atau lebih baru di hosting/VPS.
2. Salin index-sunnystore-final.html ke folder yang sama dengan server.js.
3. Salin .env.example menjadi .env.
4. Edit PROMO_EXPIRES_AT di .env. Contoh:
   PROMO_EXPIRES_AT=2026-10-17T23:59:59+07:00
   Tanggal menggunakan zona waktu WIB (+07:00). Setelah lewat, server otomatis menolak SUNNY10.
5. Pastikan WHATSAPP_NUMBER benar.
6. Jalankan: node server.js
7. Buka situs melalui domain yang diarahkan ke aplikasi/port backend tersebut. Jangan buka HTML lewat file:// atau hosting statis saja.

ALUR PROMO
- Pembeli memasukkan SUNNY10 di modal rank.
- Browser meminta backend memvalidasi kode dan masa berlaku.
- Saat tombol pesan ditekan, backend menghitung ulang harga berdasarkan daftar harga server-side, tidak mempercayai harga browser.
- Jika valid, backend menyiapkan pesan WhatsApp dengan harga asli, potongan, dan total.
- Jika backend mati, kode salah, atau promo kedaluwarsa, order tidak diteruskan.

HARGA SERVER-SIDE
SUNSHINE Rp15.000
SUNBEAM Rp35.000
SUNSET Rp65.000
SUMMER Rp120.000
SOLSTICE Rp150.000
SOLARIS Rp300.000

CATATAN
Ini memvalidasi diskon di backend sebelum membuka WhatsApp, tetapi belum merupakan payment gateway otomatis dan tidak otomatis mengubah rank di Minecraft. Pembayaran dan pemberian rank tetap harus dikonfirmasi admin, kecuali nantinya dihubungkan ke sistem pembayaran/panel rank.
