import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';

const renderTeks = (text) => {
  if (!text) return null;
  const regexArab = new RegExp('([\\u0600-\\u06FF\\u064B-\\u065F\\u0670\\s]+)', 'g');
  const checkArab = new RegExp('[\\u0600-\\u06FF]');
  const parts = text.split(regexArab);
  return parts.map((part, index) => (
    checkArab.test(part) ? <span key={index} className="teks-arab-besar inline-block px-1 align-middle text-indigo-900 dark:text-indigo-300" dir="rtl">{part}</span> : <span key={index} className="align-middle">{part}</span>
  ));
};

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

const formatWaktuTampil = (detik) => {
   if (detik == null) return '-';
   return `${Math.floor(detik / 60)}m ${detik % 60}s`;
};

const LmsKuLobi = ({ user, pengaturan, daftarUjian, setoran, bankSoal, keUjian, keLogin, updateNama }) => {
  const [activeTab, setActiveTab] = useState('ujian'); 
  const [pesanText, setPesanText] = useState('');
  const [gambarUpload, setGambarUpload] = useState(null);
  const [semuaPesan, setSemuaPesan] = useState([]);
  const [isKirim, setIsKirim] = useState(false);
  const [editPesanId, setEditPesanId] = useState(null);
  const [teksEdit, setTeksEdit] = useState('');
  const [unreadForum, setUnreadForum] = useState(false);
  const [waktuSekarang, setWaktuSekarang] = useState(new Date());
  const [tampilQR, setTampilQR] = useState(false);
  
  // State untuk Ganti Nama
  const [isEditingNama, setIsEditingNama] = useState(false);
  const [namaBaruTemp, setNamaBaruTemp] = useState(user?.nama || '');
  
  const [semuaAnggota, setSemuaAnggota] = useState([]);
  const [hasilTampil, setHasilTampil] = useState(null);

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
    const unsubAnggota = onSnapshot(collection(db, "anggota"), (snap) => {
       let data = snap.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
       setSemuaAnggota(data.filter(d => d.kodeHalaqah === user.kodeHalaqah));
    });
    return () => { unsubForum(); unsubAnggota(); };
  }, [user.kodeHalaqah]);

  useEffect(() => {
     if (activeTab === 'forum') {
         localStorage.setItem(`last_read_forum_${user.kodeHalaqah}`, Date.now());
         setUnreadForum(false);
     } else {
         const lastRead = localStorage.getItem(`last_read_forum_${user.kodeHalaqah}`) || 0;
         const adaPesanBaru = semuaPesan.some(p => p.waktu > lastRead && p.email !== user.email);
         setUnreadForum(adaPesanBaru);
     }
  }, [semuaPesan, activeTab, user.kodeHalaqah, user.email]);

  const setoranKelasIni = setoran.filter(s => s.kodeHalaqah === user.kodeHalaqah);
  
  // LOGIKA REKAP NAMA SINKRON DENGAN ADMIN
  const daftarSiswaUnikMap = new Map();
  semuaAnggota.forEach(a => {
     if (a.email) daftarSiswaUnikMap.set(a.email.toLowerCase().trim(), { email: a.email, nama: a.nama || 'Siswa' });
  });
  setoranKelasIni.forEach(s => {
     if (s.email) {
        const emailKey = s.email.toLowerCase().trim();
        const dataLama = daftarSiswaUnikMap.get(emailKey);
        if (!dataLama || (dataLama.nama.includes('@') && s.nama && !s.nama.includes('@'))) {
           daftarSiswaUnikMap.set(emailKey, { email: s.email, nama: s.nama || (dataLama ? dataLama.nama : s.email.split('@')[0]) });
        }
     }
  });

  const daftarSiswaUnik = Array.from(daftarSiswaUnikMap.values());
  const rekapRapor = daftarSiswaUnik.map(siswa => {
      let totalSkor = 0; let totalDurasi = 0;
      jadwalUjianKelasIni.forEach(ujian => {
         const s = setoranKelasIni.find(x => (x.email || '').toLowerCase().trim() === siswa.email.toLowerCase().trim() && x.idUjian === ujian.docId);
         if (s) { totalSkor += Number(s.nilaiSistem || 0); totalDurasi += Number(s.waktuPengerjaan || 0); }
      });
      return { ...siswa, totalSkor, totalDurasi };
  });

  rekapRapor.sort((a, b) => {
     if (b.totalSkor !== a.totalSkor) return b.totalSkor - a.totalSkor;
     return a.totalDurasi - b.totalDurasi;
  });

  const peringkatSayaIndex = rekapRapor.findIndex(s => s.email.toLowerCase().trim() === user.email.toLowerCase().trim());
  const peringkatSayaObj = rekapRapor[peringkatSayaIndex] || { totalSkor: 0, totalDurasi: 0 };
  const top10 = rekapRapor.slice(0, 10);

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

  // MODAL HASIL CETAK RINCI
  if (hasilTampil) {
     const soalUjianIni = bankSoal ? bankSoal.filter(s => s.idUjian === hasilTampil.idUjian) : [];
     const jawabanPeserta = hasilTampil.jawaban || {};
     const adaUraian = soalUjianIni.some(s => s.tipe === 'uraian');

     return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-50 dark:bg-slate-900 overflow-y-auto font-sans">
           <style>{`
            @media print {
              @page { size: A4; margin: 1cm; }
              body { background: white; font-size: 10pt; color: black; }
              .no-print { display: none !important; }
              .area-cetak { border: none !important; box-shadow: none !important; padding: 0 !important; width: 100% !important; margin: 0 !important; }
              .sertifikat { border: 2px solid #ccc !important; padding: 20px !important; margin-bottom: 20px !important; page-break-after: avoid; border-radius: 10px !important;}
              .tabel-koreksi { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 10px;}
              .tabel-koreksi th, .tabel-koreksi td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              .teks-arab-besar { font-size: 14pt !important; }
              .img-media { max-height: 50px !important; }
            }
           `}</style>
           
           <div className="bg-white dark:bg-slate-800 p-4 flex justify-between items-center shadow-md no-print sticky top-0 z-50">
              <button onClick={() => setHasilTampil(null)} className="text-slate-500 font-bold bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-xl hover:bg-slate-200 transition-colors">← Kembali</button>
              <button onClick={() => window.print()} className="bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl shadow-md hover:bg-indigo-600 transition-colors flex items-center gap-2">🖨️ Cetak / PDF</button>
           </div>
           
           <div className="max-w-3xl w-full mx-auto p-4 md:p-8 flex flex-col items-center">
              <div className="w-full bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl text-center border-t-8 border-emerald-500 mb-8 transition-colors area-cetak sertifikat">
                 <div className="mb-6 pb-6 border-b border-dashed border-slate-200 dark:border-slate-700">
                    <span className="text-6xl mb-4 block">🎓</span>
                    <h1 className="text-2xl font-black mb-1 dark:text-white">Bukti Selesai Ujian</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{hasilTampil.kuisJudul}</p>
                 </div>
                 <div className="text-left space-y-3 mb-8">
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase">Nama Peserta</p>
                       <p className="font-bold text-slate-800 dark:text-white text-lg">{user.nama}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase">Kelas / Akun</p>
                          <p className="font-bold text-indigo-600 dark:text-indigo-400">{user.halaqah} / {user.email.split('@')[0]}</p>
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase">Waktu Selesai</p>
                          <p className="font-bold text-slate-700 dark:text-slate-300">{hasilTampil.tanggal || formatTgl(hasilTampil.tanggalReal)}</p>
                       </div>
                    </div>
                 </div>
                 <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-800 transition-colors">
                    <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Skor Anda</p>
                    <p className="font-black text-emerald-500 text-6xl drop-shadow-sm">{hasilTampil.nilaiSistem}</p>
                    {adaUraian && <p className="text-[10px] font-bold text-orange-500 mt-3">* Jika ada soal uraian, skor ini belum termasuk koreksi manual Guru</p>}
                 </div>
              </div>

              <div className="w-full space-y-6 text-left area-cetak">
                 <div className="text-center mb-8 border-b border-slate-200 dark:border-slate-700 pb-6 no-print">
                    <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Lembar Koreksi Jawaban</h2>
                    <p className="text-xs font-bold text-slate-400 mt-1">Review hasil pekerjaan Anda</p>
                 </div>

                 {/* TABEL VERSI PRINT */}
                 <div className="hidden print:block w-full">
                    <h2 className="text-sm font-black uppercase mb-4 text-center">Rincian Jawaban</h2>
                    <table className="tabel-koreksi">
                       <thead>
                          <tr className="bg-slate-100 text-black">
                             <th className="font-bold text-center">No</th>
                             <th className="font-bold">Soal & Jawaban Murid</th>
                             <th className="font-bold text-center">Hasil</th>
                             <th className="font-bold">Kunci Sebenarnya</th>
                          </tr>
                       </thead>
                       <tbody>
                          {soalUjianIni.map((soal, index) => {
                             const jwb = jawabanPeserta[index];
                             const isUraian = soal.tipe === 'uraian';
                             let isBenar = false;
                             if (!isUraian) {
                                if (soal.tipe === 'isian') {
                                   const kunciArr = typeof soal.kunci === 'string' ? soal.kunci.split(',').map(k => k.trim().toLowerCase()) : [];
                                   isBenar = typeof jwb === 'string' && kunciArr.includes(jwb.trim().toLowerCase());
                                } else {
                                   const kArr = Array.isArray(soal.kunci) ? soal.kunci : [soal.kunci];
                                   const jArr = Array.isArray(jwb) ? jwb : [jwb];
                                   isBenar = jArr.length > 0 && jArr.length === kArr.length && jArr.every(j => kArr.includes(j));
                                }
                             }
                             return (
                                <tr key={index}>
                                   <td className="text-center align-top">{index+1}</td>
                                   <td className="align-top">
                                      <p className="font-bold mb-1">{renderTeks(soal.teksSoal)}</p>
                                      <p className="text-indigo-600 italic text-xs">Jwb: {isUraian ? (jwb?.teks || '(Foto/Audio)') : (Array.isArray(jwb) ? jwb.join(', ') : (jwb || '-'))}</p>
                                   </td>
                                   <td className="text-center align-top font-black text-sm">{isUraian ? '⏳' : (isBenar ? '✅' : '❌')}</td>
                                   <td className="text-xs align-top">{isUraian ? 'Koreksi Guru' : (Array.isArray(soal.kunci) ? soal.kunci.join(', ') : soal.kunci)}</td>
                                </tr>
                             );
                          })}
                       </tbody>
                    </table>
                 </div>

                 {/* KARTU VERSI LAYAR */}
                 <div className="no-print">
                    {soalUjianIni.length === 0 && <p className="text-center text-slate-400 font-bold py-10">Data soal tidak dapat dimuat. Mungkin soal sudah dihapus oleh guru.</p>}
                    {soalUjianIni.map((soal, index) => {
                       const jawabanMurid = jawabanPeserta[index];
                       if (soal.tipe === 'uraian') {
                          const jwb = jawabanMurid || {};
                          return (
                             <div key={index} className="p-5 rounded-2xl border-2 border-purple-100 dark:border-purple-900/50 bg-purple-50/30 dark:bg-purple-900/10 transition-colors break-inside-avoid shadow-sm mb-6">
                                <div className="flex justify-between items-start mb-3">
                                   <span className="text-[10px] font-black bg-purple-200 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400 px-2 py-1 rounded uppercase">Soal {index+1} (Uraian)</span>
                                   <span className="text-xs font-bold text-orange-500 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded">⏳ Tunggu Guru</span>
                                </div>
                                <div className="mb-4">
                                   <p className="font-bold text-slate-700 dark:text-white text-base">{renderTeks(soal.teksSoal)}</p>
                                   {soal.teksTambahanArab && <p className="teks-arab-besar text-right text-indigo-900 dark:text-indigo-300 mt-2" dir="rtl">{soal.teksTambahanArab}</p>}
                                   {soal.mediaSoalGambar && <img src={soal.mediaSoalGambar} className="h-20 mt-2 rounded border dark:border-slate-600" />}
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                   <span className="text-[10px] font-black text-slate-400 uppercase block mb-2 border-b dark:border-slate-700 pb-1">Jawaban Anda:</span>
                                   {jwb.teks ? <p className="font-bold text-indigo-700 dark:text-indigo-400 mb-2 whitespace-pre-wrap">{jwb.teks}</p> : <p className="text-xs text-slate-300 dark:text-slate-500 italic mb-2">Tidak ada teks</p>}
                                   {jwb.gambar && <img src={jwb.gambar} className="max-w-xs rounded-xl border-2 border-slate-200 dark:border-slate-600 mb-2" />}
                                   {!jwb.teks && !jwb.gambar && !jwb.suara && <p className="text-red-400 font-bold text-sm">Tidak dijawab.</p>}
                                </div>
                             </div>
                          );
                       }

                       const kunciAsli = Array.isArray(soal.kunci) ? soal.kunci : [soal.kunci];
                       const jawabanMuridArray = Array.isArray(jawabanMurid) ? jawabanMurid : (jawabanMurid ? [jawabanMurid] : []);
                       let isBenar = false;

                       if (soal.tipe === 'isian') {
                          const kunciArray = typeof soal.kunci === 'string' ? soal.kunci.split(',').map(k => k.trim().toLowerCase()) : [];
                          isBenar = typeof jawabanMurid === 'string' && kunciArray.includes(jawabanMurid.trim().toLowerCase());
                       } else {
                          isBenar = (jawabanMuridArray.length > 0 && jawabanMuridArray.length === kunciAsli.length) && jawabanMuridArray.every(j => kunciAsli.includes(j)); 
                       }

                       return (
                          <div key={index} className={`p-5 rounded-2xl border-2 transition-colors break-inside-avoid shadow-sm mb-6 ${isBenar ? 'border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-red-100 dark:border-red-900/50 bg-red-50/30 dark:bg-red-900/10'}`}>
                             <div className="flex justify-between items-start mb-3">
                               <span className="text-[10px] font-black bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded uppercase">Soal {index + 1}</span>
                               {isBenar ? <span className="text-sm font-bold bg-emerald-100 text-emerald-600 px-2 py-1 rounded">✅ Benar</span> : <span className="text-sm font-bold bg-red-100 text-red-600 px-2 py-1 rounded">❌ Salah</span>}
                             </div>
                             <div className={soal.bahasa === 'ar' ? 'text-right' : 'text-left'} dir={soal.bahasa === 'ar' ? 'rtl' : 'ltr'}>
                               <p className="font-bold text-slate-700 dark:text-white text-base">{renderTeks(soal.teksSoal)}</p>
                               {soal.teksTambahanArab && <p className="teks-arab-besar text-right text-indigo-900 dark:text-indigo-300 mt-2" dir="rtl">{soal.teksTambahanArab}</p>}
                               {soal.mediaSoalGambar && <img src={soal.mediaSoalGambar} className="h-20 mt-2 rounded border dark:border-slate-600" />}
                             </div>
                             <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                               <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                 <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Jawaban Anda:</span>
                                 <span className={`font-bold ${isBenar ? 'text-emerald-600' : 'text-red-500'}`} dir={soal.bahasa === 'ar' ? 'rtl' : 'ltr'}>
                                    {jawabanMuridArray.length > 0 ? renderTeks(jawabanMuridArray.join(' | ')) : <i className="text-slate-300 dark:text-slate-600">Tidak dijawab</i>}
                                 </span>
                               </div>
                               <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                 <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Kunci Sebenarnya:</span>
                                 <span className="font-bold text-indigo-600 dark:text-indigo-400" dir={soal.bahasa === 'ar' ? 'rtl' : 'ltr'}>
                                    {kunciAsli.length > 0 ? renderTeks(kunciAsli.join(' | ')) : <i className="text-slate-300 dark:text-slate-600">Kosong</i>}
                                 </span>
                               </div>
                             </div>
                          </div>
                       );
                    })}
                 </div>
              </div>
           </div>
        </div>
     );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors flex flex-col pb-24 font-sans">
      
      {tampilQR && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full relative animate-fade-in-up">
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

      {/* HEADER PROFIL KELAS - DENGAN FITUR GANTI NAMA TERBARU */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-6 flex flex-wrap justify-between items-center shadow-md relative overflow-hidden shrink-0 rounded-b-3xl">
         <div className="absolute top-[-50%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
         <div className="relative z-10 w-full md:w-auto">
            <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-2">Kelas Virtual 
               <button onClick={() => setTampilQR(true)} className="bg-white/20 text-white px-2 py-0.5 rounded text-[8px]">📱 QR</button>
            </p>
            <h1 className="text-2xl font-black text-white">{user.halaqah}</h1>
            
            <div className="mt-2 flex items-center gap-2">
               {isEditingNama ? (
                  <div className="flex gap-2">
                     <input type="text" value={namaBaruTemp} onChange={e=>setNamaBaruTemp(e.target.value)} className="px-3 py-1 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/40 text-sm font-bold w-48 outline-none focus:bg-white focus:text-indigo-900 transition-all shadow-inner" placeholder="Ketik nama baru..." />
                     <button onClick={() => { updateNama(namaBaruTemp); setIsEditingNama(false); }} className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs px-3 py-1 rounded-lg font-bold shadow-md transition-colors">Simpan</button>
                     <button onClick={() => { setNamaBaruTemp(user.nama); setIsEditingNama(false); }} className="bg-slate-800/40 hover:bg-slate-800/60 text-white text-xs px-3 py-1 rounded-lg font-bold transition-colors">Batal</button>
                  </div>
               ) : (
                  <div className="flex items-center gap-2">
                     <p className="text-sm font-bold text-indigo-100 bg-white/10 px-3 py-1 rounded-full">Siswa: {user.nama}</p>
                     <button onClick={() => setIsEditingNama(true)} className="text-indigo-200 hover:text-white bg-white/10 w-6 h-6 flex items-center justify-center rounded-full text-xs">✏️</button>
                  </div>
               )}
            </div>
         </div>
         
         <div className="relative z-10 flex gap-2 mt-4 md:mt-0 w-full md:w-auto justify-end">
            <button onClick={() => keLogin(false)} className="bg-indigo-900/50 hover:bg-indigo-900/80 text-white font-bold text-[10px] px-3 py-2 rounded-xl transition-all border border-indigo-400/50">🔒 Ganti Akun</button>
            <button onClick={() => keLogin(true)} className="bg-red-500/80 hover:bg-red-500 text-white font-bold text-[10px] px-3 py-2 rounded-xl transition-all border border-red-400/50">🚪 Keluar Kelas</button>
         </div>
      </div>

      <div className="w-full max-w-4xl mx-auto p-4 flex-1">
         {/* KONTEN TAB UJIAN */}
         {activeTab === 'ujian' && (
            <div className="animate-fade-in-up">
               <h2 className="text-lg font-black text-slate-800 dark:text-white mb-4">📋 Daftar Tugas & Ujian</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {jadwalUjianKelasIni.length === 0 ? (
                     <div className="col-span-full text-center py-10 border-2 border-dashed dark:border-slate-700 rounded-3xl text-slate-400 font-bold">
                        Tidak ada ujian yang dijadwalkan saat ini.
                     </div>
                  ) : (
                     jadwalUjianKelasIni.map((ujian, idx) => {
                        const tglMulai = new Date(ujian.waktuMulai);
                        const tglSelesai = new Date(ujian.waktuSelesai);
                        let targetSesuai = true;
                        
                        if (ujian.targetSiswa) {
                           const daftarTarget = ujian.targetSiswa.split(',').map(s => s.trim().toLowerCase());
                           if (!daftarTarget.includes(user.email.toLowerCase())) targetSesuai = false;
                        }

                        let statusWaktu = 'berlangsung'; 
                        if (waktuSekarang < tglMulai) statusWaktu = 'belum';
                        else if (waktuSekarang > tglSelesai) statusWaktu = 'lewat';

                        const sudahDikerjakan = setoran.find(s => s.email === user.email && s.idUjian === ujian.docId);

                        if (!targetSesuai) return null; 

                        return (
                           <div key={idx} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[2rem] p-6 flex flex-col justify-between shadow-sm">
                              <div className="mb-4">
                                 <h3 className="font-black text-lg text-indigo-700 dark:text-indigo-400 leading-tight mb-2">{ujian.judul}</h3>
                                 <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">⏳ Durasi: {ujian.durasi} Menit</p>
                                 <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-1">📅 Jadwal: {formatTgl(ujian.waktuMulai)} s/d {formatTgl(ujian.waktuSelesai)}</p>
                              </div>
                              <div>
                                 {sudahDikerjakan ? (
                                    <div className="space-y-2">
                                       <div className="w-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-bold py-3 rounded-2xl border border-emerald-100 dark:border-emerald-800 text-center text-sm flex justify-center items-center gap-2">
                                          ✅ Selesai <span className="bg-emerald-200 dark:bg-emerald-800 px-2 py-0.5 rounded-lg text-xs">Skor: {sudahDikerjakan.nilaiSistem}</span>
                                       </div>
                                       <button onClick={() => setHasilTampil(sudahDikerjakan)} className="w-full text-xs font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 py-2 rounded-xl hover:bg-indigo-100">📥 Lihat & Unduh Hasil</button>
                                    </div>
                                 ) : statusWaktu === 'belum' ? (
                                    <button disabled className="w-full bg-slate-100 dark:bg-slate-700 text-slate-400 font-bold py-3 rounded-2xl cursor-not-allowed">🕒 Belum Waktunya</button>
                                 ) : statusWaktu === 'lewat' ? (
                                    <button disabled className="w-full bg-red-50 dark:bg-red-900/30 text-red-500 font-bold py-3 rounded-2xl cursor-not-allowed border border-red-100 dark:border-red-800">❌ Waktu Habis</button>
                                 ) : (
                                    <button onClick={() => keUjian(ujian)} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-[0_5px_15px_rgba(99,102,241,0.3)] transition-all active:scale-95">📝 KERJAKAN SEKARANG</button>
                                 )}
                              </div>
                           </div>
                        )
                     })
                  )}
               </div>
            </div>
         )}

         {/* KONTEN TAB FORUM */}
         {activeTab === 'forum' && (
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-[65vh] animate-fade-in-up">
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
                        let bubbleStyle = isSaya ? 'bg-indigo-500 text-white rounded-tr-sm border border-indigo-600' : 'bg-white dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 rounded-tl-sm shadow-sm';
                        if (isGuru) bubbleStyle = 'bg-gradient-to-br from-amber-100 to-yellow-300 dark:from-yellow-600 dark:to-amber-700 text-slate-900 dark:text-white font-medium rounded-tl-sm border-2 border-yellow-400 dark:border-yellow-500 shadow-md';

                        const namaPengirim = isGuru ? '👑 Guru Pengajar' : (pesan.nama || pesan.email.split('@')[0]);

                        return (
                           <div key={idx} className={`flex flex-col max-w-[85%] ${isSaya ? 'self-end items-end' : 'self-start items-start'}`}>
                              <div className="flex items-center gap-2 mb-1 ml-2 mr-2">
                                 <span className={`text-[10px] font-bold ${isGuru ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                                    {namaPengirim} • {pesan.waktuTampil}
                                 </span>
                                 {isSaya && (
                                    <div className="flex gap-1">
                                       <button onClick={() => {setEditPesanId(pesan.docId); setTeksEdit(pesan.teks);}} className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-200 px-1.5 py-0.5 rounded">✏️</button>
                                       <button onClick={() => hapusPesan(pesan.docId)} className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 px-1.5 py-0.5 rounded">🗑️</button>
                                    </div>
                                 )}
                              </div>
                              <div className={`p-3 md:p-4 rounded-3xl text-sm md:text-base whitespace-pre-wrap break-words w-full ${bubbleStyle}`}>
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
                     <label className="shrink-0 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-500 w-12 h-12 rounded-2xl cursor-pointer transition-colors shadow-inner flex items-center justify-center text-xl">
                        📸<input type="file" accept="image/*" className="hidden" onChange={handleUploadGambar} />
                     </label>
                     <input type="text" value={pesanText} onChange={(e) => setPesanText(e.target.value)} placeholder="Tanya di forum kelas..." className="flex-1 min-w-0 p-3 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-white rounded-2xl outline-none font-medium focus:ring-2 ring-indigo-400 transition-all border border-transparent text-sm" />
                     <button type="submit" disabled={isKirim} className="shrink-0 bg-indigo-600 text-white w-12 h-12 rounded-2xl font-black shadow-lg hover:bg-indigo-500 active:scale-95 flex items-center justify-center text-xl">
                        {isKirim ? '⏳' : '➤'}
                     </button>
                  </form>
               </div>
            </div>
         )}

         {/* KONTEN TAB PERINGKAT TOP 10 */}
         {activeTab === 'peringkat' && (
            <div className="animate-fade-in-up">
               <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-6 rounded-[2rem] shadow-lg mb-6 text-white text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">Peringkat Anda Saat Ini</p>
                  <div className="text-5xl font-black drop-shadow-md mb-2">
                     #{peringkatSayaIndex !== -1 ? peringkatSayaIndex + 1 : '-'}
                  </div>
                  <div className="flex justify-center gap-4 text-xs font-bold bg-black/20 rounded-xl py-2 px-4 inline-flex">
                     <span>Skor: {peringkatSayaObj.totalSkor}</span>
                     <span>•</span>
                     <span>Waktu: {formatWaktuTampil(peringkatSayaObj.totalDurasi)}</span>
                  </div>
               </div>

               <h2 className="text-lg font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">🏆 Papan Peringkat (Top 10)</h2>
               
               {top10.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed dark:border-slate-700 rounded-3xl text-slate-400 font-bold">Belum ada nilai yang masuk.</div>
               ) : (
                  <div className="space-y-3">
                     {top10.map((m, idx) => (
                        <div key={idx} className={`flex justify-between items-center p-4 rounded-2xl shadow-sm border ${m.email.toLowerCase().trim() === user.email.toLowerCase().trim() ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                           <div className="flex items-center gap-4">
                              <span className="text-3xl drop-shadow-sm w-10 text-center">
                                 {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : <span className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-full text-sm font-black mx-auto">{idx+1}</span>}
                              </span>
                              <div>
                                 <p className={`font-bold text-sm md:text-base ${m.email.toLowerCase().trim() === user.email.toLowerCase().trim() ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-white'}`}>{m.nama}</p>
                                 <p className="text-[10px] font-bold text-slate-400">⏱️ {formatWaktuTampil(m.totalDurasi)}</p>
                              </div>
                           </div>
                           <div className="text-right">
                              <span className="text-2xl font-black text-emerald-500 block leading-none">{m.totalSkor}</span>
                              <span className="text-[8px] font-black text-slate-400 uppercase">Poin</span>
                           </div>
                        </div>
                     ))}
                  </div>
               )}
            </div>
         )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 pb-safe z-50 flex justify-around p-2 no-print shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
         <button onClick={() => setActiveTab('ujian')} className={`flex flex-col items-center p-2 px-6 rounded-2xl transition-all ${activeTab === 'ujian' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 scale-105' : 'text-slate-400 hover:text-indigo-500'}`}>
            <span className="text-2xl mb-1 block leading-none">📝</span>
            <span className="text-[10px] font-black uppercase">Tugas</span>
         </button>
         
         <button onClick={() => setActiveTab('forum')} className={`relative flex flex-col items-center p-2 px-6 rounded-2xl transition-all ${activeTab === 'forum' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 scale-105' : 'text-slate-400 hover:text-indigo-500'}`}>
            <span className="text-2xl mb-1 block leading-none">💬</span>
            <span className="text-[10px] font-black uppercase">Forum</span>
            {unreadForum && activeTab !== 'forum' && <span className="absolute top-2 right-4 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-bounce"></span>}
         </button>

         <button onClick={() => setActiveTab('peringkat')} className={`flex flex-col items-center p-2 px-6 rounded-2xl transition-all ${activeTab === 'peringkat' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 scale-105' : 'text-slate-400 hover:text-indigo-500'}`}>
            <span className="text-2xl mb-1 block leading-none">🏆</span>
            <span className="text-[10px] font-black uppercase">Rank</span>
         </button>
      </div>
    </div>
  );
};

export default LmsKuLobi;