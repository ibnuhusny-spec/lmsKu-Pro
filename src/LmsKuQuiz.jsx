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

  // 👈 STATE BARU UNTUK PENGACAK GANDA (OPSI & NOMOR SOAL)
  const [shuffledOptionsMap, setShuffledOptionsMap] = useState({});
  const [shuffledIndices, setShuffledIndices] = useState([]);

  const soalUjianIni = bankSoal.filter(s => s.idUjian === ujianAktif.docId);
  const durasiMaksimal = ujianAktif.durasi * 60;
  const [timeLeft, setTimeLeft] = useState(durasiMaksimal);
  const hasSubmitted = useRef(false);
  
  const keyPelanggaran = `strike_${ujianAktif?.docId}_${user?.email}`;
  const pelanggaran = useRef(parseInt(localStorage.getItem(keyPelanggaran) || '0'));
  const waktuPelanggaranTerakhir = useRef(0);

  const adaUraian = soalUjianIni.some(s => s.tipe === 'uraian');
  const poinSet = Number(ujianAktif.poinBenar) || 10;

  // 👈 MESIN PENGACAK GANDA FISHER-YATES (Dijalankan 1x saat ujian dimuat)
  useEffect(() => {
     if (soalUjianIni.length > 0 && Object.keys(shuffledOptionsMap).length === 0) {
        const mapAcak = {};
        
        // 1. Mengacak Urutan Nomor Soal
        const indices = soalUjianIni.map((_, idx) => idx);
        for (let i = indices.length - 1; i > 0; i--) {
           const j = Math.floor(Math.random() * (i + 1));
           [indices[i], indices[j]] = [indices[j], indices[i]];
        }

        // 2. Mengacak Opsi Jawaban Pilihan Ganda
        soalUjianIni.forEach((s, idx) => {
           if (s.tipe && s.tipe.startsWith('pilihan')) {
              const arr = [s.opsiA, s.opsiB, s.opsiC, s.opsiD, s.opsiE].filter(Boolean);
              for (let i = arr.length - 1; i > 0; i--) {
                 const j = Math.floor(Math.random() * (i + 1));
                 [arr[i], arr[j]] = [arr[j], arr[i]];
              }
              mapAcak[idx] = arr;
           }
        });
        
        setShuffledIndices(indices);
        setShuffledOptionsMap(mapAcak);
     }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soalUjianIni]);

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

  useEffect(() => {
     if (!isMulai || isSelesai || !ujianAktif.kunciLayar) return;

     const catatPelanggaran = () => {
        const sekarang = Date.now();
        if (sekarang - waktuPelanggaranTerakhir.current < 2000) return;
        waktuPelanggaranTerakhir.current = sekarang;

        pelanggaran.current += 1;
        localStorage.setItem(keyPelanggaran, pelanggaran.current.toString()); 

        if (pelanggaran.current === 1) {
           alert("⚠️ PERINGATAN KERAS!\nAnda terdeteksi keluar dari layar ujian atau membuka aplikasi/tab lain.\n\nJika Anda keluar satu kali lagi, sistem akan MENGUMPULKAN UJIAN ANDA SECARA OTOMATIS!");
        } else if (pelanggaran.current >= 2) {
           alert("⛔ PELANGGARAN FATAL!\nAnda telah keluar dari aplikasi lebih dari batas yang diizinkan. Ujian Anda diakhiri secara otomatis!");
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
     if (ujianAktif.kunciLayar && pelanggaran.current >= 2) {
        alert("⛔ UJIAN DIBATALKAN!\nAnda telah tercatat melakukan pelanggaran fatal (keluar aplikasi/layar) pada percobaan sebelumnya.\n\nSistem akan mengumpulkan kertas ujian Anda apa adanya secara otomatis sekarang.");
        setIsMulai(true);
        setWaktuMulai(Date.now());
        setTimeLeft(0);
        submitTugas(true);
        return;
     }

     setIsMulai(true); 
     setWaktuMulai(Date.now()); 
     setTimeLeft(durasiMaksimal); 
     
     if (ujianAktif.kunciLayar) {
        try { await document.documentElement.requestFullscreen(); } 
        catch (e) { console.log("Layar perangkat tidak mendukung Fullscreen otomatis."); }
     }
  };

  // 👈 RUMUS ILUSI VISUAL: Menerjemahkan soal yang tampil ke index asli database
  const getActualIndex = () => shuffledIndices.length > 0 ? shuffledIndices[currentQuestionIndex] : currentQuestionIndex;

  const handlePilihMulti = (opsi) => {
    const aIdx = getActualIndex();
    let jwb = [...(jawabanPeserta[aIdx] || [])];
    jwb.includes(opsi) ? jwb = jwb.filter(i => i !== opsi) : jwb.push(opsi);
    setJawabanPeserta({ ...jawabanPeserta, [aIdx]: jwb });
  };

  const handleUraianUpdate = (jenis, nilai) => {
     const aIdx = getActualIndex();
     const jawabanSekarang = jawabanPeserta[aIdx] || { teks: '', gambar: null, suara: null };
     setJawabanPeserta({ ...jawabanPeserta, [aIdx]: { ...jawabanSekarang, [jenis]: nilai } });
  };

  const handleUploadGambarUraian = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; 
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH; 
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        handleUraianUpdate('gambar', canvas.toDataURL('image/jpeg', 0.5)); 
      }
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const startRecordingUraian = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 16000 };
      
      if (MediaRecorder.isTypeSupported(options.mimeType)) {
         mediaRecorderRef.current = new MediaRecorder(stream, options);
      } else {
         mediaRecorderRef.current = new MediaRecorder(stream);
      }

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

  // 👈 SAAT SUBMIT, KITA MENGHITUNG MENGGUNAKAN ARRAY ASLI AGAR KOREKSI GURU TIDAK ERROR
  const submitTugas = async (isAutoSubmit = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    hasSubmitted.current = true;

    if (document.fullscreenElement) {
       document.exitFullscreen().catch(err => console.log(err));
    }

    let skorTotal = 0;
    soalUjianIni.forEach((soal, index) => {
      const jwb = jawabanPeserta[index];
      if (!jwb) return;

      if (soal.tipe === 'pilihan_ganda') {
        if (jwb === soal.kunci[0] || jwb === soal.kunci) skorTotal += poinSet; 
      } 
      else if (soal.tipe === 'pilihan_ganda_kompleks') {
        const kunciAsli = Array.isArray(soal.kunci) ? soal.kunci : [];
        const jwbMurid = Array.isArray(jwb) ? jwb : [jwb];
        const benar = jwbMurid.filter(item => kunciAsli.includes(item)).length;
        const salah = jwbMurid.filter(item => !kunciAsli.includes(item)).length;
        
        const poinPerKunci = poinSet / (kunciAsli.length || 1);
        let poin = (benar * poinPerKunci) - (salah * poinPerKunci);
        skorTotal += Math.max(0, poin); 
      }
      else if (soal.tipe === 'isian') {
        if (typeof jwb === 'string') {
           const jawabanMurid = jwb.trim().toLowerCase();
           const kunciArray = typeof soal.kunci === 'string' ? soal.kunci.split(',').map(k => k.trim().toLowerCase()) : [];
           if (kunciArray.includes(jawabanMurid)) skorTotal += poinSet; 
        }
      }
    });

    const nilaiFinal = Math.round(skorTotal); 
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
      localStorage.removeItem(keyPelanggaran);
      setIsSelesai(true);
    } catch (e) { 
      alert("❌ GAGAL MENGIRIM JAWABAN KE SERVER! Pastikan Koneksi Internet Stabil."); 
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
      <div className="min-h-screen py-12 px-4 bg-slate-50 dark:bg-slate-900 font-sans">
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

        <div className="max-w-3xl mx-auto flex flex-col items-center">
          <div className="w-full bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl text-center border-t-8 border-emerald-500 mb-8 transition-colors area-cetak sertifikat">
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

          <div className="w-full space-y-6 text-left area-cetak">
            <div className="text-center mb-8 border-b border-slate-200 dark:border-slate-700 pb-6 no-print">
               <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Lembar Koreksi Jawaban</h2>
               <p className="text-xs font-bold text-slate-400 mt-1">Evaluasi mandiri hasil pekerjaan Anda</p>
            </div>

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
                             <td className="text-center align-top font-black text-sm">
                                {isUraian ? '⏳' : (isBenar ? '✅' : '❌')}
                             </td>
                             <td className="text-xs align-top">
                                {isUraian ? 'Koreksi Guru' : (Array.isArray(soal.kunci) ? soal.kunci.join(', ') : soal.kunci)}
                             </td>
                          </tr>
                       );
                    })}
                 </tbody>
              </table>
            </div>

            <div className="no-print">
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
                          {soal.teksTambahanArab && <p className="teks-arab-besar text-indigo-900 dark:text-indigo-300 mt-2" dir="rtl">{soal.teksTambahanArab}</p>}
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

          <div className="w-full max-w-md mt-10 space-y-3 no-print">
             <button onClick={() => window.print()} className="w-full py-4 bg-indigo-500 text-white font-black rounded-2xl border-b-4 border-indigo-700 hover:bg-indigo-600 active:translate-y-1 active:border-b-0 transition-all flex justify-center items-center gap-2">
                🖨️ Cetak / Simpan PDF
             </button>
             <button onClick={keLobi} className="w-full py-4 bg-slate-200 dark:bg-slate-700 font-bold text-slate-600 dark:text-slate-200 rounded-2xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                ← Kembali ke Lobi Kelas
             </button>
          </div>
        </div>
      </div>
    );
  }

  const formatWaktuHitungMundur = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  
  // 👈 PEMBACA SOAL BERDASARKAN ILUSI (ACAK)
  const actualIndex = getActualIndex();
  const soal = soalUjianIni[actualIndex];
  const isArab = soal?.bahasa === 'ar';
  
  const arrayPilihan = shuffledOptionsMap[actualIndex] || [soal?.opsiA, soal?.opsiB, soal?.opsiC, soal?.opsiD, soal?.opsiE].filter(Boolean);
  
  const izin = soal?.izinUraian || { teks: true, gambar: true, suara: true };
  const jwbUraian = (soal?.tipe === 'uraian' && jawabanPeserta[actualIndex]) ? jawabanPeserta[actualIndex] : { teks: '', gambar: null, suara: null };

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
           <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-700 px-2 py-1 rounded">{soal?.tipe.replace(/_/g, ' ')}</span>
        </div>
        
        <div className="flex-grow">
          {(soal?.mediaSoalGambar || soal?.mediaSoalSuara) && (
             <div className="mb-6 space-y-3 border-2 border-dashed border-indigo-100 dark:border-indigo-800 p-4 rounded-2xl bg-indigo-50/30 dark:bg-indigo-900/20 transition-colors">
                <p className="text-[10px] font-black text-indigo-400 dark:text-indigo-500 uppercase text-center tracking-widest">Lampiran Soal:</p>
                {soal.mediaSoalGambar && <img src={soal.mediaSoalGambar} className="max-h-48 mx-auto rounded-lg shadow-sm border border-white dark:border-slate-700" />}
                {soal.mediaSoalSuara && <audio controls src={soal.mediaSoalSuara} className="h-10 shadow-sm rounded-full w-full" />}
             </div>
          )}

          <div className={`mb-6 ${isArab ? 'text-right' : 'text-left'}`} dir={isArab ? 'rtl' : 'ltr'}>
            <p className="text-lg md:text-xl font-bold text-slate-800 dark:text-white leading-relaxed">{renderTeks(soal?.teksSoal)}</p>
            {soal?.teksTambahanArab && <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl transition-colors"><p className="teks-arab-besar text-right text-indigo-900 dark:text-indigo-300 mt-2" dir="rtl">{soal.teksTambahanArab}</p></div>}
          </div>

          {soal?.tipe === 'pilihan_ganda_kompleks' && (
             <div className="mb-4 bg-sky-50 dark:bg-sky-900/30 p-3 rounded-xl border border-sky-100 dark:border-sky-800 flex items-center gap-3">
                <span className="text-2xl">💡</span>
                <div>
                   <p className="text-xs font-black text-sky-700 dark:text-sky-400 uppercase">Petunjuk Khusus</p>
                   <p className="text-sm font-medium text-sky-800 dark:text-sky-300">Soal ini membutuhkan <strong>{Array.isArray(soal.kunci) ? soal.kunci.length : 2} Jawaban Benar</strong>. Silakan centang semuanya!</p>
                </div>
             </div>
          )}

          {soal?.tipe.startsWith('pilihan_ganda') && (
            <div className="space-y-3">
              {arrayPilihan.map((opsi, index) => {
                const isSelected = soal.tipe === 'pilihan_ganda_kompleks' ? (jawabanPeserta[actualIndex] || []).includes(opsi) : jawabanPeserta[actualIndex] === opsi;
                return (
                  <button key={index} onClick={() => soal.tipe === 'pilihan_ganda_kompleks' ? handlePilihMulti(opsi) : setJawabanPeserta({...jawabanPeserta, [actualIndex]: opsi})}
                    className={`w-full flex items-center p-3 md:p-4 rounded-2xl transition-all text-left border-2 ${isArab ? 'flex-row-reverse text-right' : ''} ${isSelected ? 'bg-indigo-500 text-white border-indigo-700 shadow-md' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 border-slate-100 dark:border-slate-600 hover:border-indigo-200 dark:hover:border-indigo-500'}`}
                  >
                    <span className={`font-black ${isSelected ? 'text-indigo-200' : 'text-slate-300 dark:text-slate-400'} ${isArab ? 'ml-3' : 'mr-3'}`}>{isArab ? abjadArab[index] : abjadId[index]}.</span>
                    <span className={`flex-grow font-semibold ${isArab ? 'teks-arab-besar leading-none' : 'text-sm md:text-base'}`} dir={isArab ? 'rtl' : 'ltr'}>{renderTeks(opsi)}</span>
                  </button>
                )
              })}
            </div>
          )}

          {soal?.tipe === 'isian' && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-2xl border border-emerald-100 dark:border-emerald-800 shadow-inner transition-colors">
               <textarea rows="2" dir={isArab ? 'rtl' : 'ltr'} placeholder={isArab ? 'اُكْتُبْ...' : 'Ketik jawaban Anda di sini...'} value={jawabanPeserta[actualIndex] || ''} onChange={(e) => setJawabanPeserta({...jawabanPeserta, [actualIndex]: e.target.value})} className="w-full bg-white dark:bg-slate-800 rounded-xl p-4 outline-none font-bold text-emerald-800 dark:text-emerald-400 focus:ring-2 ring-emerald-200 dark:ring-emerald-700 transition-colors" />
            </div>
          )}

          {soal?.tipe === 'uraian' && (
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