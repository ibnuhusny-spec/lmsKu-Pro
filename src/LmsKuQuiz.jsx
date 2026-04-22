import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';

const abjadId = ['A', 'B', 'C', 'D', 'E'];
const abjadArab = ['أ', 'ب', 'ج', 'د', 'هـ'];

const renderTeks = (text) => {
  if (!text) return null;
  const parts = text.split(/([\u0600-\u06FF\u064B-\u065F\u0670\s]+)/g);
  return parts.map((part, index) => (
    /[\u0600-\u06FF]/.test(part) ? <span key={index} className="teks-arab-besar inline-block px-1 align-middle text-indigo-900 dark:text-indigo-300" dir="rtl">{part}</span> : <span key={index} className="align-middle">{part}</span>
  ));
};

const formatWaktuTampil = (detik) => {
  if (detik == null) return '-';
  return `${Math.floor(detik / 60)}m ${detik % 60}s`;
};

const LmsKuQuiz = ({ bankSoal, user, setoran, ujianAktif, keLobi }) => {
  const [isMulai, setIsMulai] = useState(false);
  const [waktuMulai, setWaktuMulai] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [jawabanPeserta, setJawabanPeserta] = useState({});
  const [isSelesai, setIsSelesai] = useState(false);
  const [nilaiAkhir, setNilaiAkhir] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const soalUjianIni = bankSoal.filter(s => s.idUjian === ujianAktif.docId);
  const durasiMaksimal = ujianAktif.durasi * 60;
  const [timeLeft, setTimeLeft] = useState(durasiMaksimal);
  const hasSubmitted = useRef(false);
  
  // 👈 REF UNTUK MELACAK JUMLAH PELANGGARAN MURID
  const pelanggaran = useRef(0);

  const adaUraian = soalUjianIni.some(s => s.tipe === 'uraian');

  // WAKTU MUNDUR
  useEffect(() => {
    if (!isMulai || isSelesai) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!hasSubmitted.current) {
             hasSubmitted.current = true;
             alert("⏱️ WAKTU HABIS! Jawaban Anda dikumpulkan secara otomatis.");
             submitTugas(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isMulai, isSelesai]);

  // 👈 LOGIKA SISTEM PENGAWAS UJIAN (PROCTORING)
  useEffect(() => {
     if (!isMulai || isSelesai || !ujianAktif.kunciLayar) return;

     const catatPelanggaran = () => {
        pelanggaran.current += 1;
        if (pelanggaran.current === 1) {
           alert("⚠️ PERINGATAN KERAS!\nAnda terdeteksi keluar dari layar ujian atau membuka aplikasi/tab lain.\n\nJika Anda melakukan ini sekali lagi, sistem akan MENGUMPULKAN UJIAN ANDA SECARA OTOMATIS!");
        } else if (pelanggaran.current >= 2) {
           alert("⛔ PELANGGARAN FATAL!\nAnda telah keluar dari layar ujian lebih dari batas yang diizinkan. Ujian Anda diakhiri secara otomatis!");
           if (!hasSubmitted.current) submitTugas(true);
        }
     };

     const handleVisibilityChange = () => {
        if (document.hidden && !hasSubmitted.current) catatPelanggaran();
     };

     const handleFullscreenChange = () => {
        if (!document.fullscreenElement && !hasSubmitted.current) catatPelanggaran();
     };

     document.addEventListener("visibilitychange", handleVisibilityChange);
     document.addEventListener("fullscreenchange", handleFullscreenChange);

     return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
     };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMulai, isSelesai, ujianAktif.kunciLayar]);

  const mulaiUjian = async () => { 
     setIsMulai(true); 
     setWaktuMulai(Date.now()); 
     setTimeLeft(durasiMaksimal); 
     
     // 👈 PAKSA MASUK MODE FULLSCREEN JIKA UJIAN KETAT
     if (ujianAktif.kunciLayar) {
        try { await document.documentElement.requestFullscreen(); } 
        catch (e) { console.log("Layar perangkat tidak mendukung Fullscreen otomatis."); }
     }
  };

  const handlePilihMulti = (opsi) => {
    let jwb = [...(jawabanPeserta[currentQuestionIndex] || [])];
    jwb.includes(opsi) ? jwb = jwb.filter(i => i !== opsi) : jwb.push(opsi);
    setJawabanPeserta({ ...jawabanPeserta, [currentQuestionIndex]: jwb });
  };

  const handleUraianUpdate = (jenis, nilai) => {
     const jawabanSekarang = jawabanPeserta[currentQuestionIndex] || { teks: '', gambar: null, suara: null };
     setJawabanPeserta({ ...jawabanPeserta, [currentQuestionIndex]: { ...jawabanSekarang, [jenis]: nilai } });
  };

  const handleUploadGambarUraian = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400; 
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH; 
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        handleUraianUpdate('gambar', canvas.toDataURL('image/jpeg', 0.4)); 
      }
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const startRecordingUraian = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => handleUraianUpdate('suara', reader.result);
        reader.readAsDataURL(audioBlob);
        audioChunksRef.current = []; 
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) { alert("Akses Mikrofon ditolak komputer/HP Anda."); }
  };
  const stopRecordingUraian = () => { if (mediaRecorderRef.current) { mediaRecorderRef.current.stop(); setIsRecording(false); } };

  const submitTugas = async (isAutoSubmit = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    hasSubmitted.current = true;

    // 👈 KELUAR DARI LAYAR PENUH SAAT UJIAN SELESAI
    if (document.fullscreenElement) {
       document.exitFullscreen().catch(err => console.log(err));
    }

    let skorTotal = 0;
    soalUjianIni.forEach((soal, index) => {
      const jwb = jawabanPeserta[index];
      if (!jwb) return;

      if (soal.tipe === 'pilihan_ganda') {
        if (jwb === soal.kunci[0]) skorTotal += 10; 
      } 
      else if (soal.tipe === 'pilihan_ganda_kompleks') {
        const kunciAsli = Array.isArray(soal.kunci) ? soal.kunci : [];
        const jwbMurid = Array.isArray(jwb) ? jwb : [jwb];
        const benar = jwbMurid.filter(item => kunciAsli.includes(item)).length;
        const salah = jwbMurid.filter(item => !kunciAsli.includes(item)).length;
        let poin = (benar * 5) - (salah * 5);
        skorTotal += Math.max(0, poin); 
      }
      else if (soal.tipe === 'isian') {
        if (typeof jwb === 'string' && jwb.trim().toLowerCase() === soal.kunci?.trim().toLowerCase()) skorTotal += 10; 
      }
    });

    const nilaiFinal = skorTotal; 
    const durasiPengerjaan = isAutoSubmit ? durasiMaksimal : Math.floor((Date.now() - waktuMulai) / 1000);
    setNilaiAkhir(nilaiFinal);

    const optionsTanggal = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const tanggalFormatRapi = new Date().toLocaleDateString('id-ID', optionsTanggal);

    try {
      await addDoc(collection(db, "setoran"), {
        ...user, 
        idUjian: ujianAktif.docId, 
        nilaiSistem: nilaiFinal, 
        waktuPengerjaan: durasiPengerjaan,
        jawaban: jawabanPeserta, 
        tanggal: tanggalFormatRapi,
        tanggalReal: new Date().toISOString(), 
        kuisJudul: ujianAktif.judul 
      });
      setIsSelesai(true);
    } catch (e) { 
      alert("❌ GAGAL MENGIRIM! Pastikan ukuran rekaman tidak terlalu besar."); 
      hasSubmitted.current = false;
    }
    setIsSubmitting(false);
  };

  if (!soalUjianIni || soalUjianIni.length === 0) return (
     <div className="flex justify-center min-h-screen items-center flex-col gap-4 bg-slate-50 dark:bg-slate-900">
        <h2 className="text-xl font-bold dark:text-white">Guru belum memasukkan soal ke ujian ini.</h2>
        <button onClick={keLobi} className="text-indigo-500 font-bold underline bg-indigo-50 px-4 py-2 rounded-xl">← Kembali ke Lobi</button>
     </div>
  );
  
  if (!isMulai) return (
     <div className="flex justify-center min-h-screen items-center p-4 bg-slate-50 dark:bg-slate-900">
        <div className="w-full max-w-md bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl text-center border border-slate-100 dark:border-slate-700 transition-colors">
           <span className="text-5xl mb-4 block">⏱️</span>
           <h1 className="text-3xl font-black mb-2 dark:text-white">{ujianAktif.judul}</h1>
           <p className="text-slate-500 dark:text-slate-400 font-bold mb-4">Waktu Ujian: {ujianAktif.durasi} Menit</p>
           
           {ujianAktif.kunciLayar ? (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-5 rounded-2xl mb-8 text-left shadow-inner transition-colors">
                 <p className="text-xs font-black text-red-600 dark:text-red-400 uppercase mb-2 flex items-center gap-2"><span>🔒</span> Ujian Ketat Diaktifkan:</p>
                 <ul className="text-sm text-red-800 dark:text-red-300 font-medium space-y-2 list-disc pl-4">
                    <li>Layar akan terkunci di mode Fullscreen.</li>
                    <li>Sistem akan melacak jika Anda membuka tab atau aplikasi lain.</li>
                    <li><strong>Maksimal 1 kali pelanggaran.</strong> Pelanggaran kedua akan mengumpulkan ujian otomatis.</li>
                 </ul>
              </div>
           ) : (
              <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 p-5 rounded-2xl mb-8 text-left shadow-inner transition-colors">
                 <p className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase mb-3 flex items-center gap-2"><span>⚠️</span> Tata Tertib Ujian:</p>
                 <ul className="text-sm text-indigo-900 dark:text-indigo-300 font-medium space-y-2 list-disc pl-4">
                    <li>Sistem otomatis mengumpulkan jawaban jika waktu habis.</li>
                    <li>Pastikan koneksi internet stabil sebelum mulai.</li>
                 </ul>
              </div>
           )}

           <button onClick={mulaiUjian} className="w-full py-4 bg-emerald-500 text-white font-black text-lg rounded-2xl border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 transition-all shadow-[0_10px_20px_rgba(16,185,129,0.3)]">🚀 SAYA SIAP, MULAI!</button>
        </div>
     </div>
  );

  if (isSelesai) {
    const opsiTanggal = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const tglSelesai = new Date().toLocaleDateString('id-ID', opsiTanggal);

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 pb-20 area-cetak bg-slate-50 dark:bg-slate-900">
        <div className="w-full max-w-md bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl text-center border-t-8 border-emerald-500 mb-6 transition-colors area-cetak">
          <div className="mb-6 pb-6 border-b border-dashed border-slate-200 dark:border-slate-700">
             <span className="text-6xl mb-4 block">🎓</span>
             <h1 className="text-2xl font-black mb-1 dark:text-white">Bukti Selesai Ujian</h1>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{ujianAktif.judul}</p>
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
                   <p className="font-bold text-slate-700 dark:text-slate-300">{tglSelesai}</p>
                </div>
             </div>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-800 transition-colors">
             <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Skor Dasar Anda</p>
             <p className="font-black text-emerald-500 text-6xl drop-shadow-sm">{nilaiAkhir}</p>
             {adaUraian && <p className="text-[10px] font-bold text-orange-500 mt-3">* Poin Uraian masih menunggu koreksi Guru</p>}
          </div>
        </div>

        <div className="w-full max-w-md space-y-3 no-print">
           <button onClick={() => window.print()} className="w-full py-4 bg-indigo-500 text-white font-black rounded-2xl border-b-4 border-indigo-700 hover:bg-indigo-600 active:translate-y-1 active:border-b-0 transition-all flex justify-center items-center gap-2">
              🖨️ Cetak / Download Bukti
           </button>
           <button onClick={keLobi} className="w-full py-4 bg-slate-200 dark:bg-slate-700 font-bold text-slate-600 dark:text-slate-200 rounded-2xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
              ← Kembali ke Lobi Kelas
           </button>
        </div>
      </div>
    );
  }

  const formatWaktuHitungMundur = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const soal = soalUjianIni[currentQuestionIndex];
  const isArab = soal.bahasa === 'ar';
  const arrayPilihan = [soal.opsiA, soal.opsiB, soal.opsiC, soal.opsiD, soal.opsiE].filter(Boolean);
  const izin = soal.izinUraian || { teks: true, gambar: true, suara: true };
  const jwbUraian = (soal.tipe === 'uraian' && jawabanPeserta[currentQuestionIndex]) ? jawabanPeserta[currentQuestionIndex] : { teks: '', gambar: null, suara: null };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 font-sans">
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm mb-4 flex justify-between items-center border border-slate-100 dark:border-slate-700 transition-colors">
        <div>
           <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">{ujianAktif.judul}</p>
           <p className="font-black text-slate-700 dark:text-white text-sm">{user.nama}</p>
           <p className="text-[10px] text-indigo-400 dark:text-indigo-300 font-bold truncate max-w-[150px]">{user.email}</p>
        </div>
        <div className={`px-4 py-2 rounded-xl font-mono font-bold shadow-inner ${timeLeft <= 60 ? 'bg-red-500 text-white animate-pulse' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>{formatWaktuHitungMundur(timeLeft)}</div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2.5rem] shadow-lg border border-slate-100 dark:border-slate-700 min-h-[50vh] flex flex-col transition-colors">
        <div className="flex justify-between mb-6 items-center">
           <span className="text-[10px] font-black text-indigo-500 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 px-3 py-1 rounded-full uppercase border border-indigo-100 dark:border-indigo-700">Soal {currentQuestionIndex + 1} / {soalUjianIni.length}</span>
           <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-700 px-2 py-1 rounded">{soal.tipe.replace(/_/g, ' ')}</span>
        </div>
        
        <div className="flex-grow">
          {(soal.mediaSoalGambar || soal.mediaSoalSuara) && (
             <div className="mb-6 space-y-3 border-2 border-dashed border-indigo-100 dark:border-indigo-800 p-4 rounded-2xl bg-indigo-50/30 dark:bg-indigo-900/20 transition-colors">
                <p className="text-[10px] font-black text-indigo-400 dark:text-indigo-500 uppercase text-center tracking-widest">Lampiran Soal:</p>
                {soal.mediaSoalGambar && <img src={soal.mediaSoalGambar} className="max-h-48 mx-auto rounded-lg shadow-sm border border-white dark:border-slate-700" />}
                {soal.mediaSoalSuara && <audio controls src={soal.mediaSoalSuara} className="w-full h-10 shadow-sm rounded-full" />}
             </div>
          )}

          <div className={`mb-6 ${isArab ? 'text-right' : 'text-left'}`} dir={isArab ? 'rtl' : 'ltr'}>
            <p className="text-lg md:text-xl font-bold text-slate-800 dark:text-white leading-relaxed">{renderTeks(soal.teksSoal)}</p>
            {soal.teksTambahanArab && <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl transition-colors"><p className="teks-arab-besar text-right text-indigo-900 dark:text-indigo-300" dir="rtl">{soal.teksTambahanArab}</p></div>}
          </div>

          {soal.tipe.startsWith('pilihan_ganda') && (
            <div className="space-y-3">
              {arrayPilihan.map((opsi, index) => {
                const isSelected = soal.tipe === 'pilihan_ganda_kompleks' ? (jawabanPeserta[currentQuestionIndex] || []).includes(opsi) : jawabanPeserta[currentQuestionIndex] === opsi;
                return (
                  <button key={index} onClick={() => soal.tipe === 'pilihan_ganda_kompleks' ? handlePilihMulti(opsi) : setJawabanPeserta({...jawabanPeserta, [currentQuestionIndex]: opsi})}
                    className={`w-full flex items-center p-3 md:p-4 rounded-2xl transition-all text-left border-2 ${isArab ? 'flex-row-reverse text-right' : ''} ${isSelected ? 'bg-indigo-500 text-white border-indigo-700 shadow-md' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 border-slate-100 dark:border-slate-600 hover:border-indigo-200 dark:hover:border-indigo-500'}`}
                  >
                    <span className={`font-black ${isSelected ? 'text-indigo-200' : 'text-slate-300 dark:text-slate-400'} ${isArab ? 'ml-3' : 'mr-3'}`}>{isArab ? abjadArab[index] : abjadId[index]}.</span>
                    <span className={`flex-grow font-semibold ${isArab ? 'teks-arab-besar leading-none' : 'text-sm md:text-base'}`} dir={isArab ? 'rtl' : 'ltr'}>{renderTeks(opsi)}</span>
                  </button>
                )
              })}
            </div>
          )}

          {soal.tipe === 'isian' && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-2xl border border-emerald-100 dark:border-emerald-800 shadow-inner transition-colors">
               <textarea rows="2" dir={isArab ? 'rtl' : 'ltr'} placeholder={isArab ? 'اُكْتُبْ...' : 'Ketik jawaban Anda di sini...'} value={jawabanPeserta[currentQuestionIndex] || ''} onChange={(e) => setJawabanPeserta({...jawabanPeserta, [currentQuestionIndex]: e.target.value})} className="w-full bg-white dark:bg-slate-800 rounded-xl p-4 outline-none font-bold text-emerald-800 dark:text-emerald-400 focus:ring-2 ring-emerald-200 dark:ring-emerald-700 transition-colors" />
            </div>
          )}

          {soal.tipe === 'uraian' && (
            <div className="space-y-4 border-t-2 border-dashed border-slate-200 dark:border-slate-700 pt-6 mt-4 transition-colors">
               <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Formulir Jawaban Anda:</p>
               
               {izin.teks && <textarea rows="3" dir={isArab ? 'rtl' : 'ltr'} placeholder="Ketik uraian jawaban Anda..." value={jwbUraian.teks} onChange={(e) => handleUraianUpdate('teks', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-2xl p-4 focus:border-indigo-400 dark:focus:border-indigo-500 outline-none transition-all font-medium text-slate-700 dark:text-slate-200" />}
               
               <div className="flex gap-3">
                  {izin.gambar && !jwbUraian.gambar && (
                    <label className="flex-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-2 border-blue-200 dark:border-blue-800 px-4 py-3 rounded-xl font-bold text-xs text-center cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors shadow-sm">
                      📸 Upload Foto <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUploadGambarUraian}/>
                    </label>
                  )}
                  {izin.suara && !jwbUraian.suara && (
                    <button onClick={isRecording ? stopRecordingUraian : startRecordingUraian} className={`flex-1 px-4 py-3 rounded-xl font-bold text-xs text-center border-2 transition-colors shadow-sm ${isRecording ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50'}`}>
                      {isRecording ? '⏹ Stop Rekaman' : '🎤 Rekam Suara'}
                    </button>
                  )}
               </div>

               {(jwbUraian.gambar || jwbUraian.suara) && (
                  <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-xl border border-slate-200 dark:border-slate-600 space-y-4 shadow-inner transition-colors">
                     {jwbUraian.gambar && (<div className="relative text-center"><button onClick={() => handleUraianUpdate('gambar', null)} className="absolute -top-2 right-0 bg-red-500 text-white w-6 h-6 rounded-full font-bold text-xs shadow-md">✕</button><img src={jwbUraian.gambar} className="max-h-40 mx-auto rounded-lg border-2 border-white dark:border-slate-800 shadow-sm" /></div>)}
                     {jwbUraian.suara && (<div className="relative"><button onClick={() => handleUraianUpdate('suara', null)} className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full font-bold text-xs z-10 shadow-md">✕</button><audio controls src={jwbUraian.suara} className="w-full h-10 shadow-sm rounded-full" /></div>)}
                  </div>
               )}
            </div>
          )}
        </div>

        <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between gap-3 transition-colors no-print">
          <button onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))} className={`px-4 py-3 font-bold rounded-xl text-sm transition-all ${currentQuestionIndex === 0 ? 'text-slate-300 dark:text-slate-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>← Kembali</button>
          {currentQuestionIndex === soalUjianIni.length - 1 ? (
            <button onClick={() => submitTugas(false)} disabled={isSubmitting} className="flex-1 max-w-[200px] py-3 bg-emerald-500 text-white font-black rounded-xl border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 transition-all shadow-lg">
              {isSubmitting ? 'Mengirim Data...' : 'Kumpulkan'}
            </button>
          ) : (
            <button onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)} className="flex-1 max-w-[200px] py-3 bg-indigo-500 text-white font-black rounded-xl border-b-4 border-indigo-700 active:border-b-0 active:translate-y-1 transition-all shadow-lg">Lanjut →</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LmsKuQuiz;