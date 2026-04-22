import React, { useState, useEffect } from 'react';
import LmsKuQuiz from './LmsKuQuiz';
import LmsKuAdmin from './LmsKuAdmin';
import { db, auth, googleProvider } from './firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { signInWithPopup, signOut } from 'firebase/auth';

function App() {
  const [halaman, setHalaman] = useState('login'); 
  const [user, setUser] = useState(null);
  const [googleUser, setGoogleUser] = useState(null); // Menyimpan sesi Gmail
  const [bankSoal, setBankSoal] = useState([]);
  const [setoran, setSetoran] = useState([]);
  const [pengaturan, setPengaturan] = useState({ judul: 'Ujian LmsKu', durasi: 5, daftarHalaqah: [] });

  useEffect(() => {
    const unsubSoal = onSnapshot(collection(db, "soal"), (snap) => {
      let data = snap.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
      data.sort((a, b) => a.id - b.id);
      setBankSoal(data);
    });

    const unsubSetoran = onSnapshot(collection(db, "setoran"), (snap) => {
      let data = snap.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
      data.sort((a, b) => new Date(b.tanggalReal) - new Date(a.tanggalReal));
      setSetoran(data);
    });

    const unsubPengaturan = onSnapshot(doc(db, "sistem", "pengaturan"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPengaturan({ judul: data.judul || 'Ujian LmsKu', durasi: data.durasi || 5, daftarHalaqah: data.daftarHalaqah || [] });
      }
    });

    // Mengecek apakah sudah login Gmail sebelumnya
    const unsubAuth = auth.onAuthStateChanged((u) => setGoogleUser(u));

    return () => { unsubSoal(); unsubSetoran(); unsubPengaturan(); unsubAuth(); };
  }, []);

  const handleLoginGmail = async () => {
    try { await signInWithPopup(auth, googleProvider); } 
    catch (error) { alert("Gagal Login Gmail: " + error.message); }
  };

  const handleLogoutGmail = () => {
     signOut(auth);
     setGoogleUser(null);
  };

  const handleMasukRuangan = (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const kodeMasuk = data.get('kodeMasuk').toUpperCase().trim();
    
    if (!pengaturan.daftarHalaqah || pengaturan.daftarHalaqah.length === 0) {
       return alert("🚧 Ruang ujian belum dibuka. Guru belum membuat Kode Kelas!");
    }

    const halaqahDitemukan = pengaturan.daftarHalaqah.find(h => h.kode === kodeMasuk);
    if (!halaqahDitemukan) return alert("❌ Kode Kelas salah! Periksa kembali kode yang diberikan guru.");
    
    setUser({
      nama: data.get('nama'),
      email: googleUser.email, // Menyimpan Email murid
      kodeSiswa: data.get('kodeSiswa'),
      halaqah: halaqahDitemukan.nama 
    });
    setHalaman('ujian');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100">
      {halaman === 'login' && (
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl w-full max-w-sm border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-emerald-400"></div>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-black text-indigo-600 tracking-tight">{pengaturan.judul}</h1>
              <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Portal Ujian Siswa</p>
            </div>

            {/* JIKA BELUM LOGIN GMAIL */}
            {!googleUser ? (
               <div className="space-y-4">
                  <div className="bg-orange-50 text-orange-600 p-4 rounded-2xl text-xs font-bold text-center border border-orange-100 mb-6">
                     Anda diwajibkan untuk masuk menggunakan akun Gmail (Google) yang aktif.
                  </div>
                  <button onClick={handleLoginGmail} className="w-full py-4 bg-white border-2 border-slate-200 text-slate-700 font-black rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-50 transition-all shadow-sm active:scale-95">
                     <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
                     Lanjutkan dengan Gmail
                  </button>
                  <button onClick={() => setHalaman('admin')} className="w-full mt-4 text-slate-300 hover:text-slate-500 font-bold text-xs transition-colors">
                     Masuk sebagai Admin Guru
                  </button>
               </div>
            ) : (
               /* JIKA SUDAH LOGIN GMAIL, TAMPILKAN FORMULIR */
               <form onSubmit={handleMasukRuangan} className="space-y-4">
                  <div className="flex items-center justify-between bg-indigo-50 p-3 rounded-xl border border-indigo-100 mb-4">
                     <div className="truncate pr-2">
                        <p className="text-[10px] font-black text-indigo-400 uppercase">Akun Aktif:</p>
                        <p className="text-xs font-bold text-indigo-800 truncate">{googleUser.email}</p>
                     </div>
                     <button type="button" onClick={handleLogoutGmail} className="text-[10px] bg-white border border-indigo-200 px-3 py-1.5 rounded-lg font-bold text-red-500 hover:bg-red-50">Ganti Akun</button>
                  </div>

                  {/* Nama otomatis diisi dari akun Google, tapi bisa diedit */}
                  <input name="nama" defaultValue={googleUser.displayName} placeholder="Nama Lengkap" required className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-indigo-200 font-bold text-sm" />
                  <input name="kodeSiswa" placeholder="No. Kode / ID Khusus Siswa" required className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-indigo-200 font-bold text-sm" />
                  
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 text-center">Masukkan Kode Kelas Ujian</p>
                    <input name="kodeMasuk" placeholder="Contoh: A7X9Q" required className="w-full p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl outline-none text-center font-black text-emerald-600 placeholder:text-emerald-300 uppercase tracking-widest text-lg focus:ring-2 ring-emerald-400" />
                  </div>
                  
                  <button type="submit" className="w-full py-4 bg-indigo-500 text-white font-black rounded-2xl border-b-4 border-indigo-700 active:border-b-0 active:translate-y-1 transition-all">
                    MASUK RUANG UJIAN
                  </button>
               </form>
            )}
          </div>
        </div>
      )}

      {halaman === 'admin' && <LmsKuAdmin bankSoal={bankSoal} setoran={setoran} pengaturan={pengaturan} keLogin={() => setHalaman('login')} />}
      {halaman === 'ujian' && <LmsKuQuiz bankSoal={bankSoal} user={user} setoran={setoran} pengaturan={pengaturan} keLogin={() => setHalaman('login')} />}
    </div>
  );
}

export default App;