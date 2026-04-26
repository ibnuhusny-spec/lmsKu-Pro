import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';

const abjadId = ['A', 'B', 'C', 'D', 'E'];
const abjadArab = ['أ', 'ب', 'ج', 'د', 'هـ'];

const renderTeks = (text) => {
  if (!text) return null;
  const parts = text.split(/([\u0600-\u06FF\u064B-\u065F\u0670\s]+)/g);
  return parts.map((part, index) => (
    /[\u0600-\u06FF]/.test(part) ? <span key={index} className="teks-arab-besar inline-block px-1 align-middle text-indigo-900" dir="rtl">{part}</span> : <span key={index} className="align-middle">{part}</span>
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

  const soalUjianIni = bankSoal.filter(s => s.idUjian === ujianAktif.docId);
  const durasiMaksimal = ujianAktif.durasi * 60;
  const [timeLeft, setTimeLeft] = useState(durasiMaksimal);
  const hasSubmitted = useRef(false);
  const keyPelanggaran = `strike_${ujianAktif?.docId}_${user?.email}`;
  const pelanggaran = useRef(parseInt(localStorage.getItem(keyPelanggaran) || '0'));
  const poinSet = Number(ujianAktif.poinBenar) || 10;

  useEffect(() => {
    if (!isMulai || isSelesai) return;
    const timer = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) { clearInterval(timer); if (!hasSubmitted.current) submitTugas(true); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isMulai, isSelesai]);

  const mulaiUjian = async () => { 
     if (ujianAktif.kunciLayar && pelanggaran.current >= 2) {
        alert("⛔ PELANGGARAN!"); setWaktuMulai(Date.now()); setTimeLeft(0); submitTugas(true); return;
     }
     setIsMulai(true); setWaktuMulai(Date.now()); setTimeLeft(durasiMaksimal); 
     if (ujianAktif.kunciLayar) { try { await document.documentElement.requestFullscreen(); } catch (e) {} }
  };

  const submitTugas = async (isAuto = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    hasSubmitted.current = true;
    if (document.fullscreenElement) document.exitFullscreen().catch(e => {});

    let skorTotal = 0;
    soalUjianIni.forEach((soal, index) => {
      const jwb = jawabanPeserta[index];
      if (!jwb) return;
      if (soal.tipe === 'pilihan_ganda') { if (jwb === soal.kunci[0] || jwb === soal.kunci) skorTotal += poinSet; } 
      else if (soal.tipe === 'pilihan_ganda_kompleks') {
        const kunciAsli = Array.isArray(soal.kunci) ? soal.kunci : [];
        const jwbMurid = Array.isArray(jwb) ? jwb : [jwb];
        const benar = jwbMurid.filter(item => kunciAsli.includes(item)).length;
        const salah = jwbMurid.filter(item => !kunciAsli.includes(item)).length;
        const poinPerKunci = poinSet / (kunciAsli.length || 1);
        skorTotal += Math.max(0, (benar * poinPerKunci) - (salah * poinPerKunci)); 
      }
      else if (soal.tipe === 'isian' && typeof jwb === 'string') {
           const kunciArray = typeof soal.kunci === 'string' ? soal.kunci.split(',').map(k => k.trim().toLowerCase()) : [];
           if (kunciArray.includes(jwb.trim().toLowerCase())) skorTotal += poinSet; 
      }
    });

    setNilaiAkhir(Math.round(skorTotal));
    try {
      await addDoc(collection(db, "setoran"), { ...user, idUjian: ujianAktif.docId, nilaiSistem: Math.round(skorTotal), kuisJudul: ujianAktif.judul, jawaban: jawabanPeserta, tanggalReal: new Date().toISOString() });
      localStorage.removeItem(keyPelanggaran);
      setIsSelesai(true);
    } catch (e) {}
    setIsSubmitting(false);
  };

  if (isSelesai) {
    return (
      <div className="min-h-screen py-6 px-4 bg-white font-sans">
         {/* 👈 CSS MEDIA PRINT UNTUK 1-2 HALAMAN */}
         <style>{`
            @media print {
              @page { size: A4; margin: 1cm; }
              body { background: white; font-size: 10pt; }
              .no-print { display: none !important; }
              .area-cetak { border: none !important; box-shadow: none !important; padding: 0 !important; width: 100% !important; margin: 0 !important; }
              .sertifikat { border: 2px solid #ccc !important; padding: 20px !important; margin-bottom: 20px !important; page-break-after: avoid; }
              .tabel-koreksi { width: 100%; border-collapse: collapse; font-size: 9pt; }
              .tabel-koreksi th, .tabel-koreksi td { border: 1px solid #ddd; padding: 6px; text-align: left; }
              .teks-arab-besar { font-size: 14pt !important; }
              .img-media { max-height: 50px !important; }
            }
         `}</style>
        
        <div className="max-w-2xl mx-auto flex flex-col items-center">
          <div className="w-full bg-white dark:bg-slate-800 p-6 rounded-3xl border-2 border-emerald-500 mb-8 transition-colors area-cetak sertifikat">
            <div className="text-center mb-4 border-b border-dashed pb-4">
               <h1 className="text-xl font-black mb-1">Bukti Selesai Ujian</h1>
               <p className="text-[10px] font-bold uppercase">{ujianAktif.judul}</p>
            </div>
            <div className="text-left text-xs mb-4 space-y-1">
               <p><strong>Nama:</strong> {user.nama}</p>
               <p><strong>Kelas:</strong> {user.halaqah} / {user.email}</p>
               <p><strong>Skor Akhir:</strong> <span className="text-lg font-black text-emerald-600">{nilaiAkhir}</span></p>
            </div>
          </div>

          <div className="w-full area-cetak">
            <h2 className="text-sm font-black uppercase mb-4 text-center">Lembar Koreksi Jawaban</h2>
            <table className="tabel-koreksi">
               <thead>
                  <tr className="bg-slate-100">
                     <th>No</th>
                     <th>Soal & Jawaban</th>
                     <th>Status</th>
                     <th>Kunci</th>
                  </tr>
               </thead>
               <tbody>
                  {soalUjianIni.map((soal, index) => {
                     const jwb = jawabanPeserta[index];
                     const isUraian = soal.tipe === 'uraian';
                     let isBenar = false;
                     if (!isUraian) {
                        if (soal.tipe === 'isian') {
                           const kunciArr = soal.kunci.split(',').map(k => k.trim().toLowerCase());
                           isBenar = typeof jwb === 'string' && kunciArr.includes(jwb.trim().toLowerCase());
                        } else {
                           const kArr = Array.isArray(soal.kunci) ? soal.kunci : [soal.kunci];
                           const jArr = Array.isArray(jwb) ? jwb : [jwb];
                           isBenar = jArr.length > 0 && jArr.length === kArr.length && jArr.every(j => kArr.includes(j));
                        }
                     }
                     return (
                        <tr key={index}>
                           <td className="text-center">{index+1}</td>
                           <td>
                              <p className="font-bold">{renderTeks(soal.teksSoal)}</p>
                              <p className="text-indigo-600 mt-1 italic">Jwb: {isUraian ? (jwb?.teks || '-') : (Array.isArray(jwb) ? jwb.join(', ') : (jwb || '-'))}</p>
                           </td>
                           <td className="text-center font-black">
                              {isUraian ? '⏳' : (isBenar ? '✅' : '❌')}
                           </td>
                           <td className="text-xs">{isUraian ? 'Koreksi Guru' : (Array.isArray(soal.kunci) ? soal.kunci.join(', ') : soal.kunci)}</td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
          </div>

          <div className="w-full max-w-md mt-8 space-y-3 no-print">
             <button onClick={() => window.print()} className="w-full py-4 bg-indigo-500 text-white font-black rounded-2xl shadow-lg flex justify-center items-center gap-2">🖨️ Cetak / Simpan PDF (1-2 Hal)</button>
             <button onClick={keLobi} className="w-full py-4 bg-slate-200 font-bold rounded-2xl">← Kembali ke Lobi</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm mb-4 flex justify-between items-center transition-colors">
        <div><p className="text-[10px] text-slate-400 font-bold uppercase">{ujianAktif.judul}</p><p className="font-black text-sm">{user.nama}</p></div>
        <div className={`px-4 py-2 rounded-xl font-mono font-bold ${timeLeft <= 60 ? 'bg-red-500 text-white animate-pulse' : 'bg-red-50 text-red-600'}`}>{Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2,'0')}</div>
      </div>
      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2.5rem] shadow-lg border min-h-[50vh] flex flex-col">
        <div className="flex-grow">
          {soalUjianIni[currentQuestionIndex] && (
            <>
               <div className="mb-6"><span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full uppercase">Soal {currentQuestionIndex + 1} / {soalUjianIni.length}</span></div>
               {(soalUjianIni[currentQuestionIndex].mediaSoalGambar || soalUjianIni[currentQuestionIndex].mediaSoalSuara) && (
                 <div className="mb-4 text-center">
                    {soalUjianIni[currentQuestionIndex].mediaSoalGambar && <img src={soalUjianIni[currentQuestionIndex].mediaSoalGambar} className="max-h-40 mx-auto rounded-lg border shadow-sm" />}
                    {soalUjianIni[currentQuestionIndex].mediaSoalSuara && <audio controls src={soalUjianIni[currentQuestionIndex].mediaSoalSuara} className="w-full h-8 mt-2" />}
                 </div>
               )}
               <div className={`mb-6 ${soalUjianIni[currentQuestionIndex].bahasa==='ar' ? 'text-right' : 'text-left'}`}>
                  <p className="text-lg font-bold">{renderTeks(soalUjianIni[currentQuestionIndex].teksSoal)}</p>
                  {soalUjianIni[currentQuestionIndex].teksTambahanArab && <p className="teks-arab-besar mt-3 text-right" dir="rtl">{soalUjianIni[currentQuestionIndex].teksTambahanArab}</p>}
               </div>
               {/* PILIHAN GANDA */}
               {soalUjianIni[currentQuestionIndex].tipe.startsWith('pilihan_ganda') && (
                  <div className="space-y-3">
                     {[soalUjianIni[currentQuestionIndex].opsiA, soalUjianIni[currentQuestionIndex].opsiB, soalUjianIni[currentQuestionIndex].opsiC, soalUjianIni[currentQuestionIndex].opsiD, soalUjianIni[currentQuestionIndex].opsiE].filter(Boolean).map((opsi, i) => {
                        const isS = soalUjianIni[currentQuestionIndex].tipe==='pilihan_ganda_kompleks' ? (jawabanPeserta[currentQuestionIndex]||[]).includes(opsi) : jawabanPeserta[currentQuestionIndex]===opsi;
                        return (
                           <button key={i} onClick={() => soalUjianIni[currentQuestionIndex].tipe==='pilihan_ganda_kompleks' ? handlePilihMulti(opsi) : setJawabanPeserta({...jawabanPeserta, [currentQuestionIndex]: opsi})} className={`w-full p-4 rounded-2xl text-left border-2 transition-all ${isS ? 'bg-indigo-500 text-white border-indigo-700' : 'bg-white border-slate-100 dark:bg-slate-700'}`}>
                              <span className="font-black mr-3">{abjadId[i]}.</span> {renderTeks(opsi)}
                           </button>
                        );
                     })}
                  </div>
               )}
               {/* ISIAN */}
               {soalUjianIni[currentQuestionIndex].tipe === 'isian' && (
                  <textarea rows="2" placeholder="Ketik jawaban..." value={jawabanPeserta[currentQuestionIndex] || ''} onChange={(e) => setJawabanPeserta({...jawabanPeserta, [currentQuestionIndex]: e.target.value})} className="w-full bg-emerald-50 p-4 rounded-xl border-2 border-emerald-200 font-bold text-emerald-800 outline-none" />
               )}
               {/* URAIAN */}
               {soalUjianIni[currentQuestionIndex].tipe === 'uraian' && (
                  <textarea rows="4" placeholder="Ketik uraian..." value={jawabanPeserta[currentQuestionIndex]?.teks || ''} onChange={(e) => handleUraianUpdate('teks', e.target.value)} className="w-full bg-slate-50 p-4 rounded-xl border-2 outline-none font-medium" />
               )}
            </>
          )}
        </div>
        <div className="mt-8 pt-4 border-t flex justify-between gap-3">
          <button onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex-1))} className="px-4 py-3 font-bold rounded-xl text-slate-400">← Kembali</button>
          {currentQuestionIndex === soalUjianIni.length - 1 ? (
            <button onClick={() => submitTugas(false)} disabled={isSubmitting} className="flex-1 max-w-[200px] py-3 bg-emerald-500 text-white font-black rounded-xl shadow-lg">Kumpulkan</button>
          ) : (
            <button onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)} className="flex-1 max-w-[200px] py-3 bg-indigo-500 text-white font-black rounded-xl shadow-lg">Lanjut →</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LmsKuQuiz;