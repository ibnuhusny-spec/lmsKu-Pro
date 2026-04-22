import React, { useState, useEffect } from 'react';
import LmsKuQuiz from './LmsKuQuiz';
import LmsKuAdmin from './LmsKuAdmin';
import { db, auth, googleProvider } from './firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { signInWithPopup, signOut } from 'firebase/auth';

function App() {
  const [halaman, setHalaman] = useState('splash'); // Dimulai dari Splash Screen
  const [isDarkMode, setIsDarkMode] = useState(false); // State Mode Gelap
  
  const [user, setUser] = useState(null);
  const [googleUser, setGoogleUser] = useState(null);
  const [bankSoal, setBankSoal] = useState([]);
  const [setoran, setSetoran] = useState([]);
  const [pengaturan, setPengaturan] = useState({ judul: 'LMSKU PRO', durasi: 5, daftarHalaqah: [] });

  // State Keamanan Admin
  const [passwordAdmin, setPasswordAdmin] = useState('');
  const [errorPassword, setErrorPassword] = useState('');
  const MASTER_PASSWORD = 'Husny77'; // GANTI PASSWORD ADMIN DI SINI

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
        setPengaturan({ judul: data.judul || 'LMSKU PRO', durasi: data.durasi || 5, daftarHalaqah: data.daftarHalaqah || [] });
      }
    });

    const unsubAuth = auth.onAuthStateChanged((u) => setGoogleUser(u));

    return () => { unsubSoal(); unsubSetoran(); unsubPengaturan(); unsubAuth(); };
  }, []);

  const handleLoginGmail = async () => {
    try { await signInWithPopup(auth, googleProvider); } 
    catch (error) { alert("Gagal Login Gmail: " + error.message); }
  };

  const handleLogoutGmail = () => { signOut(auth); setGoogleUser(null); };

  const handleMasukRuangan = (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const kodeMasuk = data.get('kodeMasuk').toUpperCase().trim();
    
    if (!pengaturan.daftarHalaqah || pengaturan.daftarHalaqah.length === 0) return alert("🚧 Ruang ujian belum dibuka.");
    const halaqahDitemukan = pengaturan.daftarHalaqah.find(h => h.kode === kodeMasuk);
    if (!halaqahDitemukan) return alert("❌ Kode Kelas salah!");
    
    setUser({ nama: data.get('nama'), email: googleUser.email, kodeSiswa: data.get('kodeSiswa'), halaqah: halaqahDitemukan.nama });
    setHalaman('ujian');
  };

  const handleLoginAdmin = (e) => {
    e.preventDefault();
    if (passwordAdmin === MASTER_PASSWORD) {
       setErrorPassword('');
       setPasswordAdmin('');
       setHalaman('admin');
    } else {
       setErrorPassword('Akses Ditolak! Password tidak valid.');
    }
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    <div className={`${isDarkMode ? 'dark' : ''} transition-colors duration-500`}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-500 relative">
        
        {/* TOMBOL SAKELAR TEMA GELAP/TERANG GLOBAL */}
        <button onClick={toggleTheme} className="absolute top-4 right-4 z-50 bg-white/80 dark:bg-slate-800/80 backdrop-blur p-3 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 hover:scale-110 transition-transform">
           {isDarkMode ? '☀️' : '🌙'}
        </button>

        {/* 1. SPLASH SCREEN (LANDING PAGE MEWAH) */}
        {halaman === 'splash' && (
          <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-900 via-slate-900 to-emerald-900 px-4">
             {/* Ornamen Latar Belakang */}
             <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl animate-pulse"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>

             <div className="relative z-10 text-center mb-12">
                <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 tracking-tighter drop-shadow-lg mb-4 animate-fade-in-up">LMSKU PRO</h1>
                <p className="text-slate-300 font-medium tracking-widest text-sm md:text-base uppercase bg-white/10 inline-block px-6 py-2 rounded-full backdrop-blur-md border border-white/10">Sistem Evaluasi Digital Premium</p>
             </div>

             <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
                <button onClick={() => setHalaman('login_siswa')} className="group relative p-1 rounded-3xl bg-gradient-to-b from-indigo-500 to-indigo-700 hover:to-indigo-600 transition-all shadow-[0_0_40px_rgba(99,102,241,0.4)] hover:shadow-[0_0_60px_rgba(99,102,241,0.6)] hover:-translate-y-2">
                   <div className="bg-slate-900/90 backdrop-blur-sm h-full w-full rounded-[1.4rem] p-8 flex flex-col items-center justify-center border border-indigo-500/30 group-hover:bg-slate-900/70 transition-all">
                      <span className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-500">🎓</span>
                      <h2 className="text-2xl font-black text-white mb-2">Portal Siswa</h2>
                      <p className="text-indigo-200 text-sm">Masuk ke ruang ujian kelas Anda</p>
                   </div>
                </button>

                <button onClick={() => setHalaman('login_admin_lock')} className="group relative p-1 rounded-3xl bg-gradient-to-b from-emerald-500 to-emerald-700 hover:to-emerald-600 transition-all shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:shadow-[0_0_60px_rgba(16,185,129,0.5)] hover:-translate-y-2">
                   <div className="bg-slate-900/90 backdrop-blur-sm h-full w-full rounded-[1.4rem] p-8 flex flex-col items-center justify-center border border-emerald-500/30 group-hover:bg-slate-900/70 transition-all">
                      <span className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-500">👑</span>
                      <h2 className="text-2xl font-black text-white mb-2">Admin Guru</h2>
                      <p className="text-emerald-200 text-sm">Kelola soal, halaqah & evaluasi</p>
                   </div>
                </button>
             </div>
          </div>
        )}

        {/* 2. LOCK SCREEN ADMIN (KEAMANAN KOKOH) */}
        {halaman === 'login_admin_lock' && (
           <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900 relative overflow-hidden">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
             <div className="relative z-10 bg-slate-800 p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-700">
                <button onClick={() => {setHalaman('splash'); setErrorPassword('');}} className="text-slate-400 hover:text-white font-bold text-sm mb-6 block transition-colors">← Kembali</button>
                <div className="text-center mb-8">
                  <span className="text-5xl block mb-4">🔐</span>
                  <h2 className="text-2xl font-black text-white tracking-tight">Otorisasi Admin</h2>
                  <p className="text-slate-400 text-xs font-bold mt-2 uppercase tracking-widest">Sistem Keamanan LMSKU PRO</p>
                </div>
                <form onSubmit={handleLoginAdmin} className="space-y-4">
                   <div>
                     <input type="password" value={passwordAdmin} onChange={(e) => setPasswordAdmin(e.target.value)} placeholder="Masukkan Password Admin..." required className="w-full p-4 bg-slate-900 text-emerald-400 font-mono text-center tracking-widest rounded-2xl outline-none focus:ring-2 ring-emerald-500 border border-slate-700 placeholder:text-slate-600" />
                     {errorPassword && <p className="text-red-400 font-bold text-xs mt-3 text-center bg-red-900/30 py-2 rounded-lg border border-red-500/50">{errorPassword}</p>}
                   </div>
                   <button type="submit" className="w-full py-4 bg-emerald-500 text-white font-black rounded-2xl hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all active:scale-95">Buka Brankas</button>
                </form>
             </div>
           </div>
        )}

        {/* 3. PORTAL LOGIN SISWA */}
        {halaman === 'login_siswa' && (
          <div className="flex items-center justify-center min-h-screen p-4 bg-slate-100 dark:bg-slate-900">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl w-full max-w-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden transition-colors">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-emerald-400"></div>
              
              <button onClick={() => setHalaman('splash')} className="text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 font-bold text-xs mb-6 block transition-colors">← Halaman Utama</button>
              
              <div className="text-center mb-8">
                <h1 className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">{pengaturan.judul}</h1>
                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Portal Ujian Siswa</p>
              </div>

              {!googleUser ? (
                 <div className="space-y-4">
                    <div className="bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 p-4 rounded-2xl text-xs font-bold text-center border border-orange-100 dark:border-orange-800 mb-6">
                       Akses ujian diwajibkan menggunakan akun Gmail (Google) yang aktif.
                    </div>
                    <button onClick={handleLoginGmail} className="w-full py-4 bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white font-black rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all shadow-sm active:scale-95">
                       <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
                       Lanjutkan dengan Gmail
                    </button>
                 </div>
              ) : (
                 <form onSubmit={handleMasukRuangan} className="space-y-4">
                    <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800 mb-4">
                       <div className="truncate pr-2">
                          <p className="text-[10px] font-black text-indigo-400 uppercase">Akun Aktif:</p>
                          <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300 truncate">{googleUser.email}</p>
                       </div>
                       <button type="button" onClick={handleLogoutGmail} className="text-[10px] bg-white dark:bg-slate-700 border border-indigo-200 dark:border-indigo-600 px-3 py-1.5 rounded-lg font-bold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-slate-600">Ganti Akun</button>
                    </div>

                    <input name="nama" defaultValue={googleUser.displayName} placeholder="Nama Lengkap" required className="w-full p-4 bg-slate-50 dark:bg-slate-700 dark:text-white rounded-2xl outline-none focus:ring-2 ring-indigo-200 font-bold text-sm border border-transparent dark:border-slate-600" />
                    <input name="kodeSiswa" placeholder="No. Kode / ID Khusus Siswa" required className="w-full p-4 bg-slate-50 dark:bg-slate-700 dark:text-white rounded-2xl outline-none focus:ring-2 ring-indigo-200 font-bold text-sm border border-transparent dark:border-slate-600" />
                    
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 text-center">Masukkan Kode Kelas Ujian</p>
                      <input name="kodeMasuk" placeholder="KODE..." required className="w-full p-4 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-700 rounded-2xl outline-none text-center font-black text-emerald-600 dark:text-emerald-400 placeholder:text-emerald-300 dark:placeholder:text-emerald-700 uppercase tracking-widest text-lg focus:ring-2 ring-emerald-400" />
                    </div>
                    
                    <button type="submit" className="w-full py-4 bg-indigo-500 text-white font-black rounded-2xl border-b-4 border-indigo-700 hover:bg-indigo-600 active:border-b-0 active:translate-y-1 transition-all">
                      MASUK RUANG UJIAN
                    </button>
                 </form>
              )}
            </div>
          </div>
        )}

        {/* 4. RENDER HALAMAN ADMIN ATAU UJIAN */}
        {halaman === 'admin' && <LmsKuAdmin bankSoal={bankSoal} setoran={setoran} pengaturan={pengaturan} keLogin={() => setHalaman('splash')} />}
        {halaman === 'ujian' && <LmsKuQuiz bankSoal={bankSoal} user={user} setoran={setoran} pengaturan={pengaturan} keLogin={() => setHalaman('splash')} />}
      </div>
    </div>
  );
}

export default App;