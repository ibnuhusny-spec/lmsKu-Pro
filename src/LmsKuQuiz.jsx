import React, { useState, useEffect, useRef } from 'react';

const renderTeks = (text) => {
  if (!text) return null;
  const parts = text.split(/([\u0600-\u06FF\u064B-\u065F\u0670\s]+)/g);
  return parts.map((part, index) => (
    /[\u0600-\u06FF]/.test(part) ? <span key={index} className="teks-arab-besar inline-block px-1 align-middle text-indigo-900" dir="rtl">{part}</span> : <span key={index} className="align-middle">{part}</span>
  ));
};

const LmsKuQuiz = ({ bankSoal, kirimSetoran, kembaliKeBeranda }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [jawabanPeserta, setJawabanPeserta] = useState({});
  const [isSelesai, setIsSelesai] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const [namaMurid, setNamaMurid] = useState('');

  const handlePilihMulti = (opsi) => {
    let jwb = jawabanPeserta[currentQuestionIndex] || [];
    if (jwb.includes(opsi)) {
      jwb = jwb.filter(i => i !== opsi);
    } else {
      jwb.push(opsi);
    }
    setJawabanPeserta({ ...jawabanPeserta, [currentQuestionIndex]: jwb });
  };

  const handlePilihSingle = (opsi) => {
    setJawabanPeserta({ ...jawabanPeserta, [currentQuestionIndex]: opsi });
  };

  const submitTugas = () => {
    if(!namaMurid) return alert("Isi namamu!");

    let totalSkor = 0;
    bankSoal.forEach((soal, index) => {
      const jawaban = jawabanPeserta[index];
      
      if (soal.tipe === 'pilihan_ganda') {
        if (jawaban === soal.kunci) totalSkor += 1;
      } 
      else if (soal.tipe === 'pilihan_ganda_multi') {
        const kunci = soal.kunci || [];
        const jwbMurid = jawaban || [];
        // Hitung berapa yang benar dari jawaban murid
        const benar = jwbMurid.filter(j => kunci.includes(j)).length;
        const salah = jwbMurid.filter(j => !kunci.includes(j)).length;
        
        // Logika: (Benar / Total Kunci) - Penalti jika ada salah klik
        let poin = (benar / kunci.length) - (salah * 0.2); 
        totalSkor += Math.max(0, poin);
      }
      else if (soal.tipe === 'isian') {
        if (jawaban?.trim().toLowerCase() === soal.kunci?.trim().toLowerCase()) totalSkor += 1;
      }
    });

    const nilaiAkhir = Math.round((totalSkor / bankSoal.length) * 100);

    kirimSetoran({
      id: Date.now(),
      nama: namaMurid,
      nilaiSistem: nilaiAkhir,
      tanggal: new Date().toLocaleTimeString()
    });
    setIsSelesai(true);
  };

  if (isSelesai) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="bg-white p-8 rounded-3xl shadow-xl text-center border-t-8 border-emerald-500">
          <h1 className="text-2xl font-black mb-4">Tugas Terkirim!</h1>
          <button onClick={kembaliKeBeranda} className="px-6 py-2 bg-slate-100 rounded-xl font-bold">Beranda</button>
        </div>
      </div>
    );
  }

  const soal = bankSoal[currentQuestionIndex];
  const opsiTersedia = [soal.opsiA, soal.opsiB, soal.opsiC, soal.opsiD, soal.opsiE].filter(Boolean);

  return (
    <div className="max-w-xl mx-auto p-4 md:p-8 font-sans">
      <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border border-slate-100 min-h-[60vh] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <span className="text-xs font-black text-slate-300 uppercase">Soal {currentQuestionIndex + 1}</span>
          <span className="text-xs font-black bg-blue-50 text-blue-500 px-3 py-1 rounded-full">⏳ {Math.floor(timeLeft/60)}:{timeLeft%60}</span>
        </div>

        <div className="flex-grow">
          <h2 className="text-xl font-bold text-slate-800 mb-8 leading-relaxed">
            {renderTeks(soal.teksSoal)}
          </h2>

          <div className="space-y-3">
            {opsiTersedia.map((opsi, i) => {
              const isSelected = soal.tipe === 'pilihan_ganda_multi' 
                ? (jawabanPeserta[currentQuestionIndex] || []).includes(opsi)
                : jawabanPeserta[currentQuestionIndex] === opsi;

              return (
                <button 
                  key={i} 
                  onClick={() => soal.tipe === 'pilihan_ganda_multi' ? handlePilihMulti(opsi) : handlePilihSingle(opsi)}
                  className={`w-full p-4 rounded-2xl text-left font-bold transition-all border-b-4 active:border-b-0 active:translate-y-1 ${
                    isSelected ? 'bg-indigo-500 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  {renderTeks(opsi)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t flex justify-between gap-4">
          <button onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex-1))} className="text-slate-400 font-bold">← Balik</button>
          
          {currentQuestionIndex === bankSoal.length - 1 ? (
            <div className="flex gap-2 flex-grow">
              <input type="text" placeholder="Nama..." value={namaMurid} onChange={e => setNamaMurid(e.target.value)} className="flex-grow bg-slate-50 rounded-xl px-4 text-sm font-bold outline-none" />
              <button onClick={submitTugas} className="px-6 py-3 bg-emerald-500 text-white font-black rounded-xl border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1">Kirim</button>
            </div>
          ) : (
            <button onClick={() => setCurrentQuestionIndex(currentQuestionIndex+1)} className="px-8 py-3 bg-indigo-500 text-white font-black rounded-xl border-b-4 border-indigo-700 active:border-b-0 active:translate-y-1">Lanjut</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LmsKuQuiz;