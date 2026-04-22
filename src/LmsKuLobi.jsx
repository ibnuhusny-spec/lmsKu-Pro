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

const LmsKuLobi = ({ user, pengaturan, keUjian, keLogin }) => {
  const [pesanText, setPesanText] = useState('');
  const [gambarUpload, setGambarUpload] = useState(null);
  const [semuaPesan, setSemuaPesan] = useState([]);
  const [isKirim, setIsKirim] = useState(false);
  
  // State untuk mode Edit
  const [editPesanId, setEditPesanId] = useState(null);
  const [teksEdit, setTeksEdit] = useState('');

  const scrollRef = useRef(null);

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
        kodeHalaqah: user.kodeHalaqah,
        nama: user.nama,
        email: user.email,
        peran: 'siswa',
        teks: pesanText,
        gambar: gambarUpload,
        waktu: Date.now(),
        waktuTampil: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      });
      setPesanText('');
      setGambarUpload(null);
    } catch (err) { alert("Gagal mengirim. Gambar mungkin terlalu besar."); }
    setIsKirim(false);
  };

  // FUNGSI HAPUS DAN EDIT PESAN MURID
  const hapusPesan = async (docId) => {
     if(window.confirm("Hapus pesan ini?")) {
        await deleteDoc(doc(db, "forum", docId));
     }
  };

  const simpanEdit = async (docId) => {
     if(!teksEdit.trim()) return;
     try {
        await updateDoc(doc(db, "forum", docId), { teks: teksEdit });
        setEditPesanId(null);
     } catch(e) { alert("Gagal mengedit pesan."); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8 transition-colors flex justify-center items-center">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-[85vh]">
        
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-6 flex flex-wrap justify-between items-center shadow-md relative overflow-hidden shrink-0">
           <div className="absolute top-[-50%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
           <div className="relative z-10">
              <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1">Lobi Kelas Virtual</p>
              <h1 className="text-2xl font-black text-white">{user.halaqah}</h1>
              <p className="text-xs font-bold text-indigo-200 mt-1">Siswa Aktif: {user.nama}</p>
           </div>
           <div className="relative z-10 flex gap-3 mt-4 md:mt-0">
              <button onClick={keLogin} className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-inner border border-white/20">🚪 Keluar</button>
              <button onClick={keUjian} className="bg-emerald-500 hover:bg-emerald-400 text-white font-black text-sm px-6 py-2 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.5)] hover:-translate-y-1 transition-all border-b-4 border-emerald-700 active:border-b-0 active:translate-y-0">
                 📝 MULAI UJIAN
              </button>
           </div>
        </div>

        <div className="flex-1 bg-slate-50/50 dark:bg-slate-900/50 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4" ref={scrollRef}>
           <div className="text-center mb-4">
              <span className="inline-block bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] px-4 py-1 rounded-full uppercase tracking-widest border border-indigo-200 dark:border-indigo-800">Ruang Diskusi & Informasi Materi</span>
           </div>

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
                          {/* TOMBOL EDIT & HAPUS JIKA INI PESAN SAYA */}
                          {isSaya && (
                             <div className="flex gap-1">
                                <button onClick={() => {setEditPesanId(pesan.docId); setTeksEdit(pesan.teks);}} className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-200 px-1.5 py-0.5 rounded">✏️</button>
                                <button onClick={() => hapusPesan(pesan.docId)} className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 px-1.5 py-0.5 rounded">🗑️</button>
                             </div>
                          )}
                       </div>
                       
                       <div className={`p-4 rounded-3xl shadow-sm text-sm md:text-base whitespace-pre-wrap ${bubbleStyle}`}>
                          {pesan.gambar && <img src={pesan.gambar} className="max-w-[200px] rounded-xl mb-3 border border-white/30 shadow-sm" alt="Lampiran" />}
                          
                          {/* KONDISI JIKA SEDANG DIEDIT ATAU TAMPIL BIASA */}
                          {editPesanId === pesan.docId ? (
                             <div className="flex flex-col gap-2 mt-1">
                                <textarea value={teksEdit} onChange={(e) => setTeksEdit(e.target.value)} className="w-full text-slate-800 p-2 rounded-xl text-sm outline-none" rows="2" />
                                <div className="flex justify-end gap-2">
                                   <button onClick={() => setEditPesanId(null)} className="text-xs bg-slate-300 text-slate-700 px-3 py-1 rounded-lg font-bold">Batal</button>
                                   <button onClick={() => simpanEdit(pesan.docId)} className="text-xs bg-emerald-500 text-white px-3 py-1 rounded-lg font-bold">Simpan</button>
                                </div>
                             </div>
                          ) : (
                             formatTeksDenganLink(pesan.teks)
                          )}
                       </div>
                    </div>
                 )
              })
           )}
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 shrink-0">
           {gambarUpload && (
              <div className="mb-3 relative inline-block">
                 <button onClick={() => setGambarUpload(null)} className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full font-bold text-xs shadow-md z-10">✕</button>
                 <img src={gambarUpload} className="h-16 rounded-xl border-2 border-indigo-200 shadow-sm" alt="Preview" />
              </div>
           )}
           <form onSubmit={kirimPesan} className="flex gap-2 relative">
              <label className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 p-4 rounded-2xl cursor-pointer transition-colors shadow-inner flex items-center justify-center">
                 📸<input type="file" accept="image/*" className="hidden" onChange={handleUploadGambar} />
              </label>
              <input type="text" value={pesanText} onChange={(e) => setPesanText(e.target.value)} placeholder="Tanya sesuatu di forum kelas..." className="flex-1 p-4 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-white rounded-2xl outline-none font-medium focus:ring-2 ring-indigo-400 transition-all border border-transparent dark:border-slate-700" />
              <button type="submit" disabled={isKirim} className="bg-indigo-600 text-white p-4 rounded-2xl font-black shadow-lg hover:bg-indigo-500 active:scale-95 transition-all w-16 flex items-center justify-center">
                 {isKirim ? '⏳' : '➤'}
              </button>
           </form>
        </div>
      </div>
    </div>
  );
};

export default LmsKuLobi;