import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';

const formatTeksDenganLink = (teks) => {
  if (!teks) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return teks.split(urlRegex).map((part, i) => {
    if (part.match(urlRegex)) {
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-700 dark:text-blue-300 underline font-black break-all hover:opacity-80">{part}</a>;
    }
    return <span key={i}>{part}</span>;
  });
};

const LmsKuLobi = ({ user, pengaturan, daftarUjian, setoran, keUjian, keLogin }) => {
  const [pesanText, setPesanText] = useState('');
  const [gambarUpload, setGambarUpload] = useState(null);
  const [semuaPesan, setSemuaPesan] = useState([]);
  const [isKirim, setIsKirim] = useState(false);
  const [editPesanId, setEditPesanId] = useState(null);
  const [teksEdit, setTeksEdit] = useState('');
  const [waktuSekarang, setWaktuSekarang] = useState(new Date());
  
  // 👈 STATE BARU UNTUK MODAL QR CODE MURID
  const [tampilQR, setTampilQR] = useState(false);

  const scrollRef = useRef(null);
  const jadwalUjianKelasIni = daftarUjian.filter(u => u.kodeHalaqah === user.kodeHalaqah);

  useEffect(() => {
     const timer = setInterval(() => setWaktuSekarang(new Date()), 10000);
     return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubForum = onSnapshot(collection(db, "forum"), (snap) => {
      let data = snap.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
      let pesanKelasIni = data.filter(d => d.kodeHalaqah === user.kodeHalaqah);
      pesanKelasIni.sort((a, b) => a.waktu - b.waktu);
      setSemuaPesan(pesanKelasIni);
      setTimeout(() => { if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 100);
    });
    return () => unsubForum();
  }, [user.kodeHalaqah]);

  const handleUploadGambar = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400; 
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setGambarUpload(canvas.toDataURL('image/jpeg', 0.5));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const kirimPesan = async (e) => {
    e.preventDefault();
    if (!pesanText.trim() && !gambarUpload) return;
    setIsKirim(true);
    try {
      await addDoc(collection(db, "forum"), {
        kodeHalaqah: user.kodeHalaqah, nama: user.nama, email: user.email, peran: 'siswa',
        teks: pesanText, gambar: gambarUpload, waktu: Date.now(),
        waktuTampil: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      });
      setPesanText(''); setGambarUpload(null);
    } catch (err) { alert("Gagal mengirim."); }
    setIsKirim(false);
  };

  const hapusPesan = async (docId) => { if(window.confirm("Hapus pesan ini?")) await deleteDoc(doc(db, "forum", docId)); };
  const simpanEdit = async (docId) => {
     if(!teksEdit.trim()) return;
     try { await updateDoc(doc(db, "forum", docId), { teks: teksEdit }); setEditPesanId(null); } catch(e) { alert("Gagal mengedit."); }
  };

  const formatTgl = (tglString) => {
     if(!tglString) return '-';
     const d = new Date(tglString);
     return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8 transition-colors flex flex-col items-center">
      
      {/* 👈 POP-UP MODAL QR CODE UNTUK MURID */}
      {tampilQR && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full border border-slate-200 dark:border-slate-700 relative animate-fade-in-up">
               <button onClick={() => setTampilQR(false)} className="absolute top-4 right-4 bg-red-100 text-red-600 hover:bg-red-500 hover:text-white w-8 h-8 rounded-full font-bold transition-colors">✕</button>
               <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1 text-center">Scan untuk Gabung</h3>
               <p className="text-sm font-bold text-slate-500 mb-6 text-center">Kelas: {user.halaqah}</p>
               <div className="bg-white p-4 rounded-2xl shadow-inner border-4 border-indigo-100 mb-6">
                  <img src={`https://quickchart.io/qr?size=250&text=${encodeURIComponent(window.location.origin + window.location.pathname + '?kelas=' + user.kodeHalaqah)}`} alt="QR Code Kelas" className="w-48 h-48 md:w-56 md:h-56" />
               </div>
               <p className="text-xs text-slate-400 text-center font-medium">Arahkan kamera HP temanmu ke kode QR ini agar bisa langsung masuk kelas.</p>
            </div>
         </div>
      )}

      <div className="w-full max-w-4xl bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 mb-6 p-6">
         <h2 className="text-xl font-black text-slate-800 dark:text-white mb-4">📋 Daftar Tugas & Ujian Anda</h2>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jadwalUjianKelasIni.length === 0 ? (
               <div className="col-span-full text-center py-6 border-2 border-dashed dark:border-slate-700 rounded-2xl text-slate-400 font-bold text-sm">
                  Tidak ada ujian yang dijadwalkan.
               </div>
            ) : (
               jadwalUjianKelasIni.map((ujian, idx) => {
                  const tglMulai = new Date(ujian.waktuMulai);
                  const tglSelesai = new Date(ujian.waktuSelesai);
                  
                  let targetSesuai = true;
                  if (ujian.targetSiswa) {
                     const daftarTarget = ujian.targetSiswa.split(',').map(s => s.trim().toLowerCase());
                     if (!daftarTarget.includes(user.email.toLowerCase())) {
                        targetSesuai = false;
                     }
                  }

                  let statusWaktu = 'berlangsung'; 
                  if (waktuSekarang < tglMulai) statusWaktu = 'belum';
                  else if (waktuSekarang > tglSelesai) statusWaktu = 'lewat';

                  const sudahDikerjakan = setoran.find(s => s.email === user.email && s.idUjian === ujian.docId);

                  if (!targetSesuai) return null; 

                  return (
                     <div key={idx} className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl p-5 flex flex-col justify-between">
                        <div className="mb-4">
                           <h3 className="font-black text-lg text-indigo-700 dark:text-indigo-400 leading-tight mb-2">{ujian.judul}</h3>
                           <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">⏳ Durasi: {ujian.durasi} Menit</p>
                           <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-1">📅 Jadwal: {formatTgl(ujian.waktuMulai)} s/d {formatTgl(ujian.waktuSelesai)}</p>
                        </div>

                        <div>
                           {sudahDikerjakan ? (
                              <button disabled className="w-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-bold py-3 rounded-xl cursor-not-allowed">✅ Sudah Dikerjakan (Skor: {sudahDikerjakan.nilaiSistem})</button>
                           ) : statusWaktu === 'belum' ? (
                              <button disabled className="w-full bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 font-bold py-3 rounded-xl cursor-not-allowed">🕒 Belum Waktunya</button>
                           ) : statusWaktu === 'lewat' ? (
                              <button disabled className="w-full bg-red-100 dark:bg-red-900/30 text-red-500 font-bold py-3 rounded-xl cursor-not-allowed">❌ Waktu Habis</button>
                           ) : (
                              <button onClick={() => keUjian(ujian)} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-black py-3 rounded-xl shadow-md transition-colors active:scale-95">📝 KERJAKAN SEKARANG</button>
                           )}
                        </div>
                     </div>
                  )
               })
            )}
         </div>
      </div>

      <div className="w-full max-w-4xl bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-[70vh]">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-6 flex flex-wrap justify-between items-center shadow-md relative overflow-hidden shrink-0">
           <div className="absolute top-[-50%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
           <div className="relative z-10">
              <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1">Forum Kelas Virtual</p>
              <h1 className="text-2xl font-black text-white">{user.halaqah}</h1>
              <p className="text-xs font-bold text-indigo-200 mt-1">Siswa Aktif: {user.nama}</p>
           </div>
           
           <div className="relative z-10 flex gap-2 mt-4 md:mt-0 flex-wrap justify-end">
              {/* 👈 TOMBOL TAMPIL QR CODE UNTUK MURID */}
              <button onClick={() => setTampilQR(true)} className="bg-white/10 hover:bg-white/30 text-white font-bold text-[10px] px-3 py-2 rounded-xl transition-all shadow-inner border border-white/20" title="Tampilkan QR Code Kelas">📱 QR Kelas</button>
              
              <button onClick={() => keLogin(false)} className="bg-indigo-900/50 hover:bg-indigo-900/80 text-white font-bold text-[10px] px-3 py-2 rounded-xl transition-all shadow-inner border border-indigo-400/50" title="Ganti Akun Tanpa Meninggalkan Kelas">🔒 Ganti Sesi</button>
              <button onClick={() => keLogin(true)} className="bg-red-500/80 hover:bg-red-500 text-white font-bold text-[10px] px-3 py-2 rounded-xl transition-all shadow-inner border border-red-400/50" title="Hapus Diri Saya Dari Kelas Ini">🚪 Keluar Kelas</button>
           </div>
        </div>

        <div className="flex-1 bg-slate-50/50 dark:bg-slate-900/50 p-4 md:p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4" ref={scrollRef}>
           {semuaPesan.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 opacity-60">
                 <span className="text-6xl mb-4 block">💬</span>
                 <p className="font-bold text-sm">Belum ada diskusi di kelas ini.</p>
              </div>
           ) : (
              semuaPesan.map((pesan, idx) => {
                 const isSaya = pesan.email === user.email;
                 const isGuru = pesan.peran === 'guru';
                 let bubbleStyle = isSaya ? 'bg-indigo-500 text-white rounded-tr-sm border border-indigo-600' : 'bg-white dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 rounded-tl-sm';
                 if (isGuru) bubbleStyle = 'bg-gradient-to-br from-amber-100 to-yellow-300 dark:from-yellow-600 dark:to-amber-700 text-slate-900 dark:text-white font-medium rounded-tl-sm border-2 border-yellow-400 dark:border-yellow-500 shadow-md';

                 return (
                    <div key={idx} className={`flex flex-col max-w-[85%] ${isSaya ? 'self-end items-end' : 'self-start items-start'}`}>
                       <div className="flex items-center gap-2 mb-1 ml-2 mr-2">
                          <span className={`text-[10px] font-bold ${isGuru ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                             {isGuru ? '👑 Guru Pengajar' : pesan.nama} • {pesan.waktuTampil}
                          </span>
                          {isSaya && (
                             <div className="flex gap-1">
                                <button onClick={() => {setEditPesanId(pesan.docId); setTeksEdit(pesan.teks);}} className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-200 px-1.5 py-0.5 rounded">✏️</button>
                                <button onClick={() => hapusPesan(pesan.docId)} className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 px-1.5 py-0.5 rounded">🗑️</button>
                             </div>
                          )}
                       </div>
                       <div className={`p-3 md:p-4 rounded-3xl shadow-sm text-sm md:text-base whitespace-pre-wrap break-words w-full ${bubbleStyle}`}>
                          {pesan.gambar && <img src={pesan.gambar} className="max-w-[200px] w-full rounded-xl mb-3 border border-white/30 shadow-sm" alt="Lampiran" />}
                          {editPesanId === pesan.docId ? (
                             <div className="flex flex-col gap-2 mt-1">
                                <textarea value={teksEdit} onChange={(e) => setTeksEdit(e.target.value)} className="w-full text-slate-800 p-2 rounded-xl text-sm outline-none" rows="2" />
                                <div className="flex justify-end gap-2">
                                   <button onClick={() => setEditPesanId(null)} className="text-xs bg-slate-300 text-slate-700 px-3 py-1 rounded-lg font-bold">Batal</button>
                                   <button onClick={() => simpanEdit(pesan.docId)} className="text-xs bg-emerald-500 text-white px-3 py-1 rounded-lg font-bold">Simpan</button>
                                </div>
                             </div>
                          ) : ( formatTeksDenganLink(pesan.teks) )}
                       </div>
                    </div>
                 )
              })
           )}
        </div>

        <div className="p-3 md:p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 shrink-0">
           {gambarUpload && (
              <div className="mb-3 relative inline-block">
                 <button onClick={() => setGambarUpload(null)} className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full font-bold text-xs shadow-md z-10">✕</button>
                 <img src={gambarUpload} className="h-16 rounded-xl border-2 border-indigo-200 shadow-sm" alt="Preview" />
              </div>
           )}
           <form onSubmit={kirimPesan} className="flex gap-2 items-center relative w-full">
              <label className="shrink-0 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 w-12 h-12 md:w-14 md:h-14 rounded-2xl cursor-pointer transition-colors shadow-inner flex items-center justify-center text-xl">
                 📸<input type="file" accept="image/*" className="hidden" onChange={handleUploadGambar} />
              </label>
              
              <input type="text" value={pesanText} onChange={(e) => setPesanText(e.target.value)} placeholder="Tanya di forum kelas..." className="flex-1 min-w-0 p-3 md:p-4 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-white rounded-2xl outline-none font-medium focus:ring-2 ring-indigo-400 transition-all border border-transparent dark:border-slate-700 text-sm md:text-base" />
              
              <button type="submit" disabled={isKirim} className="shrink-0 bg-indigo-600 text-white w-12 h-12 md:w-14 md:h-14 rounded-2xl font-black shadow-lg hover:bg-indigo-500 active:scale-95 transition-all flex items-center justify-center text-xl">
                 {isKirim ? '⏳' : '➤'}
              </button>
           </form>
        </div>
      </div>
    </div>
  );
};

export default LmsKuLobi;