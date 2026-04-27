import React, { useState, useEffect } from 'react';
import LmsKuLobi from './LmsKuLobi';
import LmsKuQuiz from './LmsKuQuiz';
import LmsKuAdmin from './LmsKuAdmin';
import { db, auth, googleProvider } from './firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore'; 
import { signInWithPopup, signOut } from 'firebase/auth';

function App() {
  const [halaman, setHalaman] = useState('splash');
  const [isDarkMode, setIsDarkMode] = useState(false); 
  const [user, setUser] = useState(null);
  const [googleUser, setGoogleUser] = useState(null);
  const [bankSoal, setBankSoal] = useState([]);
  const [setoran, setSetoran] = useState([]);
  const [daftarUjian, setDaftarUjian] = useState([]); 
  const [ujianAktif, setUjianAktif] = useState(null); 
  const [pengaturan, setPengaturan] = useState({ daftarHalaqah: [], daftarGuru: [], daftarBlokir: [] });
  const [kodeUndangan, setKodeUndangan] = useState('');

  const SUPER_ADMIN = 'ibnuhusny@gmail.com';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kelasDariLink = params.get('kelas');
    if (kelasDariLink) {
       sessionStorage.setItem('temp_kelas', kelasDariLink.toUpperCase());
       setKodeUndangan(kelasDariLink.toUpperCase());
    } else {
       const savedKelas = sessionStorage.getItem('temp_kelas');
       if (savedKelas) setKodeUndangan(savedKelas);
    }

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

    const unsubUjian = onSnapshot(collection(db, "ujian"), (snap) => {
      let data = snap.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
      setDaftarUjian(data);
    });

    const unsubPengaturan = onSnapshot(doc(db, "sistem", "pengaturan"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPengaturan({ 
           judul: data.judul || 'LMSKU PRO', 
           durasi: data.durasi || 5, 
           daftarHalaqah: data.daftarHalaqah || [],
           daftarGuru: data.daftarGuru || [],
           daftarBlokir: data.daftarBlokir || [] 
        });
      }
    });

    const unsubAuth = auth.onAuthStateChanged((u) => {
       setGoogleUser(u);
       if (u) {
          const sesiTersimpan = localStorage.getItem('lmsku_sesi_siswa');
          if (sesiTersimpan) {
             const dataSesi = JSON.parse(sesiTersimpan);
             if (dataSesi.email === u.email) {
                setUser(dataSesi);
                setHalaman('lobi'); 
             } else { localStorage.removeItem('lmsku_sesi_siswa'); }
          }
       } else {
          localStorage.removeItem('lmsku_sesi_siswa');
          setUser(null);
       }
    });

    return () => { unsubSoal(); unsubSetoran(); unsubUjian(); unsubPengaturan(); unsubAuth(); };
  }, []);

  const handleLoginSiswa = async () => {
    try { 
       await signInWithPopup(auth, googleProvider); 
       setHalaman('login_siswa'); 
    } catch (error) { alert("Gagal Login: " + error.message); }
  };

  const handleMasukAdmin = async () => {
     try {
        let currentUser = googleUser;
        if (!currentUser) {
           const result = await signInWithPopup(auth, googleProvider);
           currentUser = result.user;
        }
        const emailLogin = currentUser.email.toLowerCase();
        const isSuperAdmin = emailLogin === SUPER_ADMIN;
        const isGuruTerdaftar = pengaturan.daftarGuru.includes(emailLogin);

        if (isSuperAdmin || isGuruTerdaftar) setHalaman('admin'); 
        else {
           alert(`⛔ AKSES DITOLAK!\n\nEmail (${currentUser.email}) belum didaftarkan.`);
           signOut(auth); setGoogleUser(null);
        }
     } catch (error) { alert("Gagal Admin: " + error.message); }
  };

  // INI ADALAH KUNCI UTAMA LOGOUT GOOGLE
  const handleLogoutGmail = () => { 
     localStorage.removeItem('lmsku_sesi_siswa'); 
     sessionStorage.removeItem('temp_kelas');
     signOut(auth); 
     setGoogleUser(null); 
     setHalaman('splash'); 
  };

  const handleKeluarKelas = async (isPermanen = false) => {
     if (isPermanen && user) {
        if(window.confirm("Yakin ingin keluar dari kelas ini secara permanen?\nData absen Anda di kelas ini akan terhapus.")) {
           try { await deleteDoc(doc(db, "anggota", `${user.kodeHalaqah}_${user.email}`)); } catch(e) {}
        } else { return; }
     }
     localStorage.removeItem('lmsku_sesi_siswa'); 
     setUser(null); setHalaman('login_siswa');
  };

  const handleMasukRuangan = (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const kodeMasuk = data.get('kodeMasuk').toUpperCase().trim();
    if (pengaturan.daftarBlokir?.includes(googleUser.email.toLowerCase())) return alert("⛔ AKUN DIBLOKIR!");
    const halaqahDitemukan = pengaturan.daftarHalaqah.find(h => h.kode === kodeMasuk);
    if (!halaqahDitemukan) return alert("❌ Kode Salah!");
    
    const sesiBaru = { nama: data.get('nama'), email: googleUser.email, halaqah: halaqahDitemukan.nama, kodeHalaqah: halaqahDitemukan.kode };
    setDoc(doc(db, "anggota", `${halaqahDitemukan.kode}_${googleUser.email}`), { ...sesiBaru, waktuGabung: Date.now() }, { merge: true });
    setUser(sesiBaru);
    localStorage.setItem('lmsku_sesi_siswa', JSON.stringify(sesiBaru)); 
    sessionStorage.removeItem('temp_kelas');
    window.history.replaceState({}, document.title, window.location.pathname);
    setHalaman('lobi');
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);
  const getNamaDefault = () => googleUser?.displayName || googleUser?.email.split('@')[0] || '';

  return (
    <div translate="no" className={`notranslate ${isDarkMode ? 'dark' : ''} transition-colors duration-500`}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans relative">
        <button onClick={toggleTheme} className="absolute top-4 right-4 z-50 bg-white/80 dark:bg-slate-800/80 backdrop-blur p-3 rounded-full shadow-lg border border-slate-200 dark:border-slate-700">
           {isDarkMode ? '☀️' : '🌙'}
        </button>

        {halaman === 'splash' && (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 via-slate-900 to-emerald-900 px-4">
             <div className="text-center mb-12">
                <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 mb-4">LMSKU PRO</h1>
                <p className="text-slate-300 font-medium tracking-widest text-sm uppercase bg-white/10 px-6 py-2 rounded-full border border-white/10">Virtual Class System</p>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
                <button onClick={() => googleUser ? setHalaman('login_siswa') : handleLoginSiswa()} className="group p-1 rounded-3xl bg-gradient-to-b from-indigo-500 to-indigo-700">
                   <div className="bg-slate-900/90 rounded-[1.4rem] p-8 flex flex-col items-center border border-indigo-500/30">
                      <span className="text-6xl mb-4">🎓</span>
                      <h2 className="text-2xl font-black text-white">Portal Siswa</h2>
                   </div>
                </button>
                <button onClick={handleMasukAdmin} className="group p-1 rounded-3xl bg-gradient-to-b from-emerald-500 to-emerald-700">
                   <div className="bg-slate-900/90 rounded-[1.4rem] p-8 flex flex-col items-center border border-emerald-500/30">
                      <span className="text-6xl mb-4">👑</span>
                      <h2 className="text-2xl font-black text-white">Admin Guru</h2>
                   </div>
                </button>
             </div>
             {kodeUndangan && !googleUser && (
                <div className="mt-8 bg-indigo-900/50 backdrop-blur border border-indigo-400/50 p-4 rounded-2xl animate-bounce">
                   <p className="text-sm text-white font-medium">✨ Undangan Terdeteksi! Klik <strong>"Portal Siswa"</strong></p>
                </div>
             )}
          </div>
        )}

        {halaman === 'login_siswa' && (
          <div className="flex items-center justify-center min-h-screen p-4 bg-slate-100 dark:bg-slate-900">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl w-full max-w-sm border-t-8 border-indigo-500 transition-colors">
              <button onClick={() => setHalaman('splash')} className="text-slate-400 font-bold text-xs mb-6 block">← Kembali</button>
              <form onSubmit={handleMasukRuangan} className="space-y-4">
                 
                 {/* PERBAIKAN 1: KOTAK EMAIL MURID DENGAN TOMBOL GANTI AKUN */}
                 <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800 flex justify-between items-center gap-2">
                    <div className="overflow-hidden">
                       <p className="text-[10px] font-black text-indigo-400 uppercase">Akun Google:</p>
                       <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300 truncate">{googleUser?.email}</p>
                    </div>
                    <button type="button" onClick={handleLogoutGmail} className="shrink-0 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-[10px] font-bold px-3 py-2 rounded-lg hover:bg-red-200 transition-colors">Ganti</button>
                 </div>

                 <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Nama Lengkap</label>
                 <input name="nama" defaultValue={getNamaDefault()} placeholder="Nama Lengkap" required className="w-full p-4 bg-slate-50 dark:bg-slate-700 dark:text-white rounded-2xl outline-none font-bold border border-transparent" />
                 <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                   <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 text-center">Kode Kelas</p>
                   <input name="kodeMasuk" defaultValue={kodeUndangan} placeholder="KODE..." required className="w-full p-4 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-700 rounded-2xl outline-none text-center font-black text-emerald-600 dark:text-emerald-400 text-lg uppercase" />
                 </div>
                 <button type="submit" className="w-full py-4 bg-indigo-500 text-white font-black rounded-2xl border-b-4 border-indigo-700 shadow-lg">MASUK KELAS</button>
              </form>
            </div>
          </div>
        )}

        {/* PERBAIKAN 2: MENGUBAH PROP KELOGIN ADMIN AGAR BENAR-BENAR LOGOUT GOOGLE */}
        {halaman === 'admin' && <LmsKuAdmin bankSoal={bankSoal} setoran={setoran} pengaturan={pengaturan} daftarUjian={daftarUjian} keLogin={handleLogoutGmail} emailAdmin={googleUser.email} superAdmin={SUPER_ADMIN} />}
        
        {/* LOBI MURID */}
        {halaman === 'lobi' && <LmsKuLobi user={user} pengaturan={pengaturan} daftarUjian={daftarUjian} setoran={setoran} keUjian={(ujian) => {setUjianAktif(ujian); setHalaman('ujian');}} keLogin={handleKeluarKelas} />}
        
        {/* UJIAN MURID */}
        {halaman === 'ujian' && <LmsKuQuiz bankSoal={bankSoal} user={user} setoran={setoran} ujianAktif={ujianAktif} keLobi={() => setHalaman('lobi')} />}
      </div>
    </div>
  );
}

export default App;