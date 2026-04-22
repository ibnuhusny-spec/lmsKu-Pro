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

const formatWaktuTampil = (detik) => {
  if (detik == null) return '-';
  const m = Math.floor(detik / 60);
  return `${m}m ${detik % 60}s`;
};

const LmsKuQuiz = ({ bankSoal, user, setoran, pengaturan, keLogin }) => {
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

  const durasiMaksimal = pengaturan.durasi * 60;
  const [timeLeft, setTimeLeft] = useState(durasiMaksimal);
  const hasSubmitted = useRef(false);

  const adaUraian = bankSoal.some(s => s.tipe === 'uraian');

  useEffect(() => {
    if (!isMulai || isSelesai) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!hasSubmitted.current) {
             hasSubmitted.current = true;
             alert("⏱️ WAKTU HABIS! Jawaban Anda dikumpulkan secara otomatis oleh sistem.");
             submitTugas(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isMulai, isSelesai]);

  const mulaiUjian = () => { setIsMulai(true); setWaktuMulai(Date.now()); setTimeLeft(durasiMaksimal); };

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

    let skorTotal = 0;
    bankSoal.forEach((soal, index) => {
      const jwb = jawabanPeserta[index];
      if (!jwb) return;

      if (soal.tipe === 'pilihan_ganda') {
        if (jwb === soal.kunci[0]) skorTotal += 1;
      } 
      else if (soal.tipe === 'pilihan_ganda_kompleks') {
        const kunciAsli = Array.isArray(soal.kunci) ? soal.kunci : [];
        const jwbMurid = Array.isArray(jwb) ? jwb : [jwb];
        const benar = jwbMurid.filter(item => kunciAsli.includes(item)).length;
        const salah = jwbMurid.filter(item => !kunciAsli.includes(item)).length;
        let poin = (benar * 0.5) - (salah * 0.5);
        skorTotal += Math.max(0, poin); 
      }
      else if (soal.tipe === 'isian') {
        if (typeof jwb === 'string' && jwb.trim().toLowerCase() === soal.kunci?.trim().toLowerCase()) skorTotal += 1;
      }
    });

    const nilaiFinal = Math.round((skorTotal / bankSoal.length) * 100) || 0;
    const durasiPengerjaan = isAutoSubmit ? durasiMaksimal : Math.floor((Date.now() - waktuMulai) / 1000);
    setNilaiAkhir(nilaiFinal);

    // FORMAT TANGGAL INDONESIA YANG RAPI UNTUK GURU
    const optionsTanggal = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const tanggalFormatRapi = new Date().toLocaleDateString('id-ID', optionsTanggal);

    try {
      await addDoc(collection(db, "setoran"), {
        ...user, // Menyimpan nama, email gmail, kode siswa, halaqah
        nilaiSistem: nilaiFinal, 
        waktuPengerjaan: durasiPengerjaan,
        jawaban: jawabanPeserta, 
        tanggal: tanggalFormatRapi, // Disimpan dalam format: "Rabu, 22 April 2026, 09.00"
        tanggalReal: new Date().toISOString(), 
        kuisJudul: pengaturan.judul
      });
      setIsSelesai(true);
    } catch (e) { 
      alert("❌ GAGAL MENGIRIM! Pastikan rekaman suara tidak terlalu panjang (Maks 10 detik)."); 
      hasSubmitted.current = false;
    }
    setIsSubmitting(false);
  };

  if (!bankSoal || bankSoal.length === 0) return (<div className="flex justify-center min-h-screen items-center"><h2 className="text-xl font-bold">Belum Ada Soal</h2></div>);
  
  if (!isMulai) return (
     <div className="flex justify-center min-h-screen items-center p-4">
        <div className="w-full max-w-md bg-white p-8 rounded-[2.5rem] shadow-xl text-center border border-slate-100">
           <span className="text-5xl mb-4 block">⏱️</span>
           <h1 className="text-3xl font-black mb-2">{pengaturan.judul}</h1>
           <p className="text-slate-500 font-bold mb-6">Waktu Ujian: {pengaturan.durasi} Menit</p>
           
           <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl mb-8 text-left shadow-inner">
              <p className="text-xs font-black text-indigo-700 uppercase mb-3 flex items-center gap-2"><span>⚠️</span> Tata Tertib Ujian:</p>
              <ul className="text-sm text-indigo-900 font-medium space-y-2 list-disc pl-4">
                 <li>Waktu hitung mundur berjalan otomatis setelah menekan tombol mulai.</li>
                 <li>Sistem akan mengumpulkan jawaban <b>secara paksa</b> jika waktu habis.</li>
                 <li>Bagi soal Audio/Suara, rekam maksimal <b>10 detik</b> agar file sukses terkirim.</li>
                 <li>Selisih satu detik menentukan posisi medali Anda di Peringkat!</li>
              </ul>
           </div>
           
           <button onClick={mulaiUjian} className="w-full py-4 bg-emerald-500 text-white font-black text-lg rounded-2xl border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 transition-all">🚀 SAYA SIAP, MULAI!</button>
        </div>
     </div>
  );

  if (isSelesai) {
    const peringkatHalaqahIni = (setoran || []).filter(s => s.halaqah === user.halaqah && s.kuisJudul === pengaturan.judul).sort((a, b) => b.nilaiSistem - a.nilaiSistem || (a.waktuPengerjaan || 9999) - (b.waktuPengerjaan || 9999)).slice(0, 5);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 pb-20">
        <div className="w-full max-w-md bg-white p-8 rounded-[2.5rem] shadow-xl text-center border-t-8 border-emerald-500 mb-6">
          <h1 className="text-2xl font-black mb-2">Jawaban Terkirim!</h1>
          <div className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center mt-6">
             <div><p className="text-[10px] font-black text-slate-400 uppercase">Waktu Anda</p><p className="font-black text-indigo-600">{formatWaktuTampil(Math.floor((Date.now() - waktuMulai) / 1000))}</p></div>
             <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase">Skor Sementara</p>
                <p className="font-black text-emerald-500 text-3xl">{nilaiAkhir}</p>
                {adaUraian && <p className="text-[9px] font-bold text-orange-500 mt-1">*Menunggu nilai Uraian Guru</p>}
             </div>
          </div>
        </div>

        <div className="w-full max-w-md bg-white p-6 rounded-[2.5rem] shadow-sm">
           <h2 className="text-lg font-black mb-4 text-center">🏆 Peringkat {user.halaqah}</h2>
           {peringkatHalaqahIni.map((p, idx) => (
             <div key={idx} className={`flex justify-between items-center p-3 rounded-2xl border mb-2 ${p.kodeSiswa === user.kodeSiswa ? 'bg-indigo-50 border-indigo-200 shadow-md' : 'bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                   <span className="text-2xl flex-shrink-0">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : <span className="bg-slate-200 text-slate-500 text-sm font-black w-7 h-7 flex items-center justify-center rounded-full">{idx+1}</span>}</span>
                   <div>
                     <p className="font-bold text-sm text-slate-800">{p.nama}</p>
                     <p className="text-[10px] font-bold text-slate-400 uppercase">⏱️ {formatWaktuTampil(p.waktuPengerjaan)}</p>
                   </div>
                </div>
                <span className="font-black text-lg text-emerald-500">{p.nilaiSistem}</span>
             </div>
           ))}
           <button onClick={keLogin} className="w-full mt-6 px-6 py-4 bg-slate-100 font-bold text-slate-600 rounded-2xl hover:bg-slate-200">Keluar Ujian</button>
        </div>
      </div>
    );
  }

  const formatWaktuHitungMundur = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const soal = bankSoal[currentQuestionIndex];
  const isArab = soal.bahasa === 'ar';
  const arrayPilihan = [soal.opsiA, soal.opsiB, soal.opsiC, soal.opsiD, soal.opsiE].filter(Boolean);
  
  const izin = soal.izinUraian || { teks: true, gambar: true, suara: true };
  const jwbUraian = (soal.tipe === 'uraian' && jawabanPeserta[currentQuestionIndex]) ? jawabanPeserta[currentQuestionIndex] : { teks: '', gambar: null, suara: null };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 font-sans">
      <div className="bg-white p-4 rounded-2xl shadow-sm mb-4 flex justify-between items-center border border-slate-100">
        <div>
           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{pengaturan.judul}</p>
           <p className="font-black text-slate-700 text-sm">{user.nama}</p>
           {/* Menampilkan Email Gmail Murid */}
           <p className="text-[10px] text-indigo-400 font-bold truncate max-w-[150px]">{user.email}</p>
        </div>
        <div className={`px-4 py-2 rounded-xl font-mono font-bold shadow-inner ${timeLeft <= 60 ? 'bg-red-500 text-white animate-pulse' : 'bg-red-50 text-red-600'}`}>{formatWaktuHitungMundur(timeLeft)}</div>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-lg border border-slate-100 min-h-[50vh] flex flex-col">
        <div className="flex justify-between mb-6 items-center">
           <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full uppercase border border-indigo-100">Soal {currentQuestionIndex + 1} / {bankSoal.length}</span>
           <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-1 rounded">{soal.tipe.replace(/_/g, ' ')}</span>
        </div>
        
        <div className="flex-grow">
          {(soal.mediaSoalGambar || soal.mediaSoalSuara) && (
             <div className="mb-6 space-y-3 border-2 border-dashed border-indigo-100 p-4 rounded-2xl bg-indigo-50/30">
                <p className="text-[10px] font-black text-indigo-400 uppercase text-center tracking-widest">Lampiran Soal:</p>
                {soal.mediaSoalGambar && <img src={soal.mediaSoalGambar} className="max-h-48 mx-auto rounded-lg shadow-sm border border-white" />}
                {soal.mediaSoalSuara && <audio controls src={soal.mediaSoalSuara} className="w-full h-10 shadow-sm rounded-full" />}
             </div>
          )}

          <div className={`mb-6 ${isArab ? 'text-right' : 'text-left'}`} dir={isArab ? 'rtl' : 'ltr'}>
            <p className="text-lg md:text-xl font-bold text-slate-800 leading-relaxed">{renderTeks(soal.teksSoal)}</p>
            {soal.teksTambahanArab && <div className="mt-4 p-4 bg-slate-50 rounded-2xl"><p className="teks-arab-besar text-right text-indigo-900" dir="rtl">{soal.teksTambahanArab}</p></div>}
          </div>

          {soal.tipe.startsWith('pilihan_ganda') && (
            <div className="space-y-3">
              {arrayPilihan.map((opsi, index) => {
                const isSelected = soal.tipe === 'pilihan_ganda_kompleks' ? (jawabanPeserta[currentQuestionIndex] || []).includes(opsi) : jawabanPeserta[currentQuestionIndex] === opsi;
                return (
                  <button key={index} onClick={() => soal.tipe === 'pilihan_ganda_kompleks' ? handlePilihMulti(opsi) : setJawabanPeserta({...jawabanPeserta, [currentQuestionIndex]: opsi})}
                    className={`w-full flex items-center p-3 md:p-4 rounded-2xl transition-all text-left border-2 ${isArab ? 'flex-row-reverse text-right' : ''} ${isSelected ? 'bg-indigo-500 text-white border-indigo-700 shadow-md' : 'bg-white text-slate-600 border-slate-100 hover:border-indigo-200 hover:bg-indigo-50'}`}
                  >
                    <span className={`font-black ${isSelected ? 'text-indigo-200' : 'text-slate-300'} ${isArab ? 'ml-3' : 'mr-3'}`}>{isArab ? abjadArab[index] : abjadId[index]}.</span>
                    <span className={`flex-grow font-semibold ${isArab ? 'teks-arab-besar leading-none' : 'text-sm md:text-base'}`} dir={isArab ? 'rtl' : 'ltr'}>{renderTeks(opsi)}</span>
                  </button>
                )
              })}
            </div>
          )}

          {soal.tipe === 'isian' && (
            <div className="bg-emerald-50 p-2 rounded-2xl border border-emerald-100 shadow-inner">
               <textarea rows="2" dir={isArab ? 'rtl' : 'ltr'} placeholder={isArab ? 'اُكْتُبْ...' : 'Ketik jawaban Anda di sini...'} value={jawabanPeserta[currentQuestionIndex] || ''} onChange={(e) => setJawabanPeserta({...jawabanPeserta, [currentQuestionIndex]: e.target.value})} className="w-full bg-white rounded-xl p-4 outline-none font-bold text-emerald-800 focus:ring-2 ring-emerald-200" />
            </div>
          )}

          {soal.tipe === 'uraian' && (
            <div className="space-y-4 border-t-2 border-dashed border-slate-200 pt-6 mt-4">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Formulir Jawaban Anda:</p>
               
               {izin.teks && <textarea rows="3" dir={isArab ? 'rtl' : 'ltr'} placeholder="Ketik uraian jawaban Anda..." value={jwbUraian.teks} onChange={(e) => handleUraianUpdate('teks', e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 focus:border-indigo-400 outline-none transition-all font-medium text-slate-700" />}
               
               <div className="flex gap-3">
                  {izin.gambar && !jwbUraian.gambar && (
                    <label className="flex-1 bg-blue-50 text-blue-600 border-2 border-blue-200 px-4 py-3 rounded-xl font-bold text-xs text-center cursor-pointer hover:bg-blue-100 transition-colors shadow-sm">
                      📸 Upload Foto <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUploadGambarUraian}/>
                    </label>
                  )}
                  {izin.suara && !jwbUraian.suara && (
                    <button onClick={isRecording ? stopRecordingUraian : startRecordingUraian} className={`flex-1 px-4 py-3 rounded-xl font-bold text-xs text-center border-2 transition-colors shadow-sm ${isRecording ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100'}`}>
                      {isRecording ? '⏹ Stop Rekaman' : '🎤 Rekam Suara'}
                    </button>
                  )}
               </div>

               {(jwbUraian.gambar || jwbUraian.suara) && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4 shadow-inner">
                     {jwbUraian.gambar && (<div className="relative text-center"><button onClick={() => handleUraianUpdate('gambar', null)} className="absolute -top-2 right-0 bg-red-500 text-white w-6 h-6 rounded-full font-bold text-xs shadow-md">✕</button><img src={jwbUraian.gambar} className="max-h-40 mx-auto rounded-lg border-2 border-white shadow-sm" /></div>)}
                     {jwbUraian.suara && (<div className="relative"><button onClick={() => handleUraianUpdate('suara', null)} className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full font-bold text-xs shadow-md z-10">✕</button><audio controls src={jwbUraian.suara} className="w-full h-10 shadow-sm rounded-full" /></div>)}
                  </div>
               )}
            </div>
          )}
        </div>

        <div className="mt-8 pt-4 border-t flex justify-between gap-3">
          <button onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))} className={`px-4 py-3 font-bold rounded-xl text-sm transition-all ${currentQuestionIndex === 0 ? 'text-slate-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>← Kembali</button>
          {currentQuestionIndex === bankSoal.length - 1 ? (
            <button onClick={() => submitTugas(false)} disabled={isSubmitting} className="flex-1 max-w-[200px] py-3 bg-emerald-500 text-white font-black rounded-xl border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 transition-all shadow-lg">
              {isSubmitting ? 'Mengirim...' : 'Kumpulkan'}
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