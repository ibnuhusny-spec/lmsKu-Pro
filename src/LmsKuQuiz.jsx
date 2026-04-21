import React, { useState, useEffect, useRef } from 'react';

const abjadId = ['A', 'B', 'C'];
const abjadArab = ['أ', 'ب', 'ج'];

// --- 🌟 SMART TEXT PARSER (Untuk Teks Campuran dalam 1 Baris) ---
const renderTeks = (text) => {
  if (!text) return null;
  
  // Memecah kalimat berdasarkan keberadaan huruf Arab & Harakat
  const parts = text.split(/([\u0600-\u06FF\u064B-\u065F\u0670\s]+)/g);
  
  return parts.map((part, index) => {
    // Jika bagian tersebut mengandung karakter Arab
    if (/[\u0600-\u06FF]/.test(part)) {
      return (
        <span 
          key={index} 
          className="teks-arab-besar inline-block px-1 align-middle text-indigo-900" 
          dir="rtl"
        >
          {part}
        </span>
      );
    }
    // Jika bagian tersebut adalah Latin/Indonesia
    return <span key={index} className="align-middle">{part}</span>;
  });
};

const LmsKuQuiz = ({ bankSoal }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [jawabanPeserta, setJawabanPeserta] = useState({});
  const [isSelesai, setIsSelesai] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);

  const [isRecording, setIsRecording] = useState(false);
  const [audioURLs, setAudioURLs] = useState({});
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  if (!bankSoal || bankSoal.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm text-center max-w-sm w-full border-t-8 border-yellow-500">
          <span className="text-5xl md:text-6xl mb-4 block">🚧</span>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">Ujian Kosong</h2>
          <p className="text-sm md:text-base text-slate-500">Admin belum memasukkan soal ke dalam sistem.</p>
        </div>
      </div>
    );
  }

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handlePilihJawaban = (jawaban) => {
    setJawabanPeserta({ ...jawabanPeserta, [currentQuestionIndex]: jawaban });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        setAudioURLs({ ...audioURLs, [currentQuestionIndex]: url });
        handlePilihJawaban(audioBlob); 
        audioChunksRef.current = []; 
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert("Gagal mengakses mikrofon.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const hapusRekaman = () => {
    const newURLs = { ...audioURLs };
    delete newURLs[currentQuestionIndex];
    setAudioURLs(newURLs);
    handlePilihJawaban(null);
  };

  const handleSelanjutnya = () => {
    if (currentQuestionIndex < bankSoal.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setIsSelesai(true); 
    }
  };

  const handleSebelumnya = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  useEffect(() => {
    if (isSelesai || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isSelesai]);

  if (isSelesai) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-sm md:max-w-md bg-white p-6 md:p-8 rounded-3xl shadow-lg text-center border-t-8 border-emerald-500">
          <span className="text-5xl mb-4 block">🎉</span>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 mb-2">Ujian Selesai!</h1>
          <p className="text-sm md:text-base text-slate-500 mb-6">Jawaban Anda berhasil dikirim ke Ustadz/Guru.</p>
        </div>
      </div>
    );
  }

  const soalAktif = bankSoal[currentQuestionIndex];
  const isArab = soalAktif.bahasa === 'ar';
  const arrayPilihan = [soalAktif.opsiA, soalAktif.opsiB, soalAktif.opsiC].filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-4 px-2 md:py-8 md:px-4 font-sans">
      
      {/* --- HEADER (Mobile Friendly: Kolom di HP, Baris di PC) --- */}
      <div className="w-full max-w-4xl bg-white rounded-t-2xl shadow-sm border-b-4 border-blue-600 p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-lg md:text-xl font-black text-slate-800 uppercase tracking-tight">LmsKu Pro</h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full inline-block mt-1">
            Soal {currentQuestionIndex + 1} / {bankSoal.length}
          </p>
        </div>
        <div className={`px-4 py-2 rounded-xl font-mono text-xl md:text-2xl font-black shadow-inner ${timeLeft < 60 ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
          ⏳ {formatTime(timeLeft)}
        </div>
      </div>

      {/* --- KONTAINER SOAL --- */}
      <div className="w-full max-w-4xl bg-white p-5 md:p-10 rounded-b-2xl shadow-lg mt-1 flex flex-col flex-grow">
        
        <div className={`mb-6 md:mb-10 border-b pb-6 ${isArab ? 'text-right' : 'text-left'}`} dir={isArab ? 'rtl' : 'ltr'}>
          {/* Instruksi Utama dengan Smart Text Parser */}
          <p className="text-base md:text-xl font-semibold text-slate-800 leading-loose md:leading-relaxed">
            {renderTeks(soalAktif.teksSoal)}
          </p>
          
          {/* Teks Arab Tambahan (Opsional) */}
          {soalAktif.teksTambahanArab && (
            <div className="mt-4 md:mt-6 p-4 md:p-6 bg-indigo-50 border-2 border-indigo-100 rounded-xl md:rounded-2xl shadow-sm">
              <p className="teks-arab-besar text-right text-indigo-950 leading-loose" dir="rtl">
                {soalAktif.teksTambahanArab}
              </p>
            </div>
          )}
        </div>

        {/* --- AREA JAWABAN --- */}
        <div className="flex-grow">
          
          {/* Pilihan Ganda */}
          {soalAktif.tipe === 'pilihan_ganda' && arrayPilihan.length > 0 && (
            <div className="grid grid-cols-1 gap-3 md:gap-4">
              {arrayPilihan.map((opsi, index) => (
                <label 
                  key={index} 
                  className={`flex items-center p-3 md:p-5 border-2 rounded-xl md:rounded-2xl cursor-pointer transition-all ${
                    isArab ? 'justify-end' : 'justify-start'
                  } ${
                    jawabanPeserta[currentQuestionIndex] === opsi ? 'bg-blue-50 border-blue-500 shadow-md transform scale-[1.01]' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {!isArab && (
                     <>
                        <input type="radio" name="jawaban" className="w-5 h-5 md:w-6 md:h-6 text-blue-600 mr-3 md:mr-4 flex-shrink-0" checked={jawabanPeserta[currentQuestionIndex] === opsi} onChange={() => handlePilihJawaban(opsi)} />
                        <span className="font-bold text-base md:text-lg text-slate-400 mr-2 md:mr-3">{abjadId[index]}.</span>
                     </>
                  )}
                  
                  {/* Opsi Jawaban juga menggunakan Smart Text Parser */}
                  <span className="text-sm md:text-lg font-medium text-slate-700 w-full" dir={isArab ? 'rtl' : 'ltr'}>
                    {renderTeks(opsi)}
                  </span>

                  {isArab && (
                     <>
                        <span className="font-bold text-base md:text-lg text-slate-400 ml-2 md:ml-3">.{abjadArab[index]}</span>
                        <input type="radio" name="jawaban" className="w-5 h-5 md:w-6 md:h-6 text-blue-600 ml-3 md:ml-4 flex-shrink-0" checked={jawabanPeserta[currentQuestionIndex] === opsi} onChange={() => handlePilihJawaban(opsi)} />
                     </>
                  )}
                </label>
              ))}
            </div>
          )}

          {/* Isian */}
          {soalAktif.tipe === 'isian' && (
            <div className="mt-2 md:mt-4">
              <textarea 
                rows="3"
                className="w-full border-2 border-slate-300 rounded-xl md:rounded-2xl p-4 md:p-5 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-inner outline-none transition-all text-base md:text-lg"
                dir={isArab ? 'rtl' : 'ltr'}
                placeholder={isArab ? 'اُكْتُبْ هُنَا...' : 'Ketik jawaban Anda di sini...'}
                value={jawabanPeserta[currentQuestionIndex] || ''}
                onChange={(e) => handlePilihJawaban(e.target.value)}
              ></textarea>
            </div>
          )}

          {/* Suara */}
          {soalAktif.tipe === 'suara' && (
            <div className="mt-2 md:mt-4 flex flex-col items-center justify-center bg-slate-50 p-6 md:p-10 rounded-2xl md:rounded-3xl border-4 border-dashed border-slate-200">
              {!audioURLs[currentQuestionIndex] ? (
                <>
                  <div className={`w-16 h-16 md:w-24 md:h-24 rounded-full flex items-center justify-center text-3xl md:text-4xl mb-4 md:mb-6 shadow-xl transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse scale-110' : 'bg-white text-blue-600 border border-blue-100'}`}>
                    🎤
                  </div>
                  {!isRecording ? (
                    <button onClick={startRecording} className="px-6 py-3 md:px-10 md:py-4 bg-blue-600 text-white text-sm md:text-base font-black rounded-full hover:bg-blue-700 shadow-lg active:scale-95 transition-all">
                      MULAI REKAMAN
                    </button>
                  ) : (
                    <button onClick={stopRecording} className="px-6 py-3 md:px-10 md:py-4 bg-red-600 text-white text-sm md:text-base font-black rounded-full hover:bg-red-700 shadow-lg active:scale-95 transition-all">
                      ⏹ BERHENTI
                    </button>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center w-full max-w-sm bg-white p-4 md:p-6 rounded-xl md:rounded-2xl shadow-sm border border-slate-100">
                  <p className="text-emerald-600 font-black mb-3 md:mb-4 text-sm md:text-base flex items-center gap-2">
                    <span className="text-lg">✅</span> TERSIMPAN
                  </p>
                  <audio controls src={audioURLs[currentQuestionIndex]} className="w-full mb-4 md:mb-6 h-10 md:h-14"></audio>
                  <button onClick={hapusRekaman} className="text-red-500 hover:text-red-700 font-bold text-xs md:text-sm underline decoration-2 underline-offset-4">
                    Hapus & Rekam Ulang
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- NAVIGASI BAWAH --- */}
        <div className="mt-8 md:mt-12 flex justify-between items-center border-t pt-6 md:pt-8 gap-4">
          <button 
            onClick={handleSebelumnya}
            disabled={currentQuestionIndex === 0}
            className={`px-4 py-2 md:px-8 md:py-3 text-xs md:text-sm font-bold rounded-lg md:rounded-xl transition-all ${currentQuestionIndex === 0 ? 'bg-slate-50 text-slate-300' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            ← Kembali
          </button>
          
          <button 
            onClick={handleSelanjutnya}
            className={`px-6 py-3 md:px-10 md:py-4 text-white text-xs md:text-base font-black rounded-lg md:rounded-xl shadow-lg transition-all transform active:scale-95 ${currentQuestionIndex === bankSoal.length - 1 ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
          >
            {currentQuestionIndex === bankSoal.length - 1 ? 'KUMPULKAN' : 'LANJUT →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LmsKuQuiz;