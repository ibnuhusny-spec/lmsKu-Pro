import React, { useState } from 'react';

// --- 🌟 SMART TEXT PARSER ---
const renderTeks = (text) => {
  if (!text) return null;
  const parts = text.split(/([\u0600-\u06FF\u064B-\u065F\u0670\s]+)/g);
  
  return parts.map((part, index) => {
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
    return <span key={index} className="align-middle text-lg font-semibold">{part}</span>;
  });
};

const LmsKuAdmin = ({ bankSoal, setBankSoal }) => {
  const [form, setForm] = useState({
    tipe: 'pilihan_ganda',
    bahasa: 'id',
    teksSoal: '',
    teksTambahanArab: '',
    opsiA: '',
    opsiB: '',
    opsiC: '',
    kunci: ''
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSimpanSoal = (e) => {
    e.preventDefault();
    if (!form.teksSoal) return alert('Teks soal tidak boleh kosong!');
    
    setBankSoal([...bankSoal, { ...form, id: Date.now() }]);
    
    setForm({
      tipe: 'pilihan_ganda', bahasa: 'id', teksSoal: '', teksTambahanArab: '', opsiA: '', opsiB: '', opsiC: '', kunci: ''
    });
  };

  const hapusSoal = (id) => {
    setBankSoal(bankSoal.filter(s => s.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* --- PANEL INPUT --- */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-lg border-t-8 border-indigo-600 flex flex-col h-fit">
          <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2">
            <span>➕</span> Arsitek Soal
          </h2>
          
          <form onSubmit={handleSimpanSoal} className="space-y-6">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Tipe Soal</label>
                <select name="tipe" value={form.tipe} onChange={handleChange} className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-semibold focus:border-indigo-500 outline-none">
                  <option value="pilihan_ganda">Pilihan Ganda</option>
                  <option value="isian">Isian Singkat</option>
                  <option value="suara">Perekam Suara</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Bahasa Utama</label>
                <select name="bahasa" value={form.bahasa} onChange={handleChange} className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-semibold focus:border-indigo-500 outline-none">
                  <option value="id">🇮🇩 Indonesia</option>
                  <option value="ar">🇸🇦 Arab</option>
                  <option value="campuran">🔄 Campuran</option>
                </select>
              </div>
            </div>

            {/* KOTAK KETIK: INSTRUKSI SOAL */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Instruksi / Teks Soal</label>
              <textarea 
                name="teksSoal" value={form.teksSoal} onChange={handleChange} rows="3" 
                dir={form.bahasa === 'ar' ? 'rtl' : 'ltr'}
                // Font dibuat text-xl agar ketikan Arab mentah tetap terbaca harakatnya
                className={`w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-xl leading-relaxed font-medium`}
                placeholder="Ketik pertanyaan di sini..."
              />
              
              {/* LIVE PREVIEW UNTUK SOAL */}
              {form.teksSoal && (
                <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-xl shadow-inner">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">👁️ Live Preview</span>
                  <div className={`leading-loose ${form.bahasa === 'ar' ? 'text-right' : 'text-left'}`} dir={form.bahasa === 'ar' ? 'rtl' : 'ltr'}>
                    {renderTeks(form.teksSoal)}
                  </div>
                </div>
              )}
            </div>

            {/* KOTAK KETIK: ARAB TAMBAHAN */}
            {(form.tipe === 'suara' || form.bahasa === 'campuran') && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Teks Arab Tambahan (Opsional)</label>
                <textarea 
                  name="teksTambahanArab" value={form.teksTambahanArab} onChange={handleChange} rows="2" dir="rtl"
                  className="w-full p-4 bg-blue-50 border-2 border-blue-100 rounded-xl teks-arab-besar outline-none"
                  placeholder="Ketik teks khusus Arab di sini..."
                />
              </div>
            )}

            {/* KOTAK KETIK: PILIHAN GANDA */}
            {form.tipe === 'pilihan_ganda' && (
              <div className="space-y-5 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Opsi Jawaban</p>
                
                {['A', 'B', 'C'].map((label) => {
                  const nilaiOpsi = form[`opsi${label}`];
                  return (
                    <div key={label} className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-black text-slate-400 text-lg">{label === 'A' ? 'أ' : label === 'B' ? 'ب' : 'ج'}</span>
                        <input 
                          type="text" name={`opsi${label}`} value={nilaiOpsi} onChange={handleChange} 
                          dir={form.bahasa === 'ar' ? 'rtl' : 'ltr'}
                          className="flex-1 p-3 border-b-2 border-slate-300 bg-white rounded-t-lg focus:border-indigo-500 outline-none text-xl font-medium"
                          placeholder={`Ketik opsi ${label}...`}
                        />
                      </div>
                      
                      {/* LIVE PREVIEW UNTUK OPSI */}
                      {nilaiOpsi && (
                        <div className="ml-8 px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm">
                          <div className={form.bahasa === 'ar' ? 'text-right' : 'text-left'} dir={form.bahasa === 'ar' ? 'rtl' : 'ltr'}>
                            {renderTeks(nilaiOpsi)}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                <div className="mt-6 pt-6 border-t border-slate-200">
                  <label className="text-xs font-bold text-indigo-600 uppercase">Kunci Jawaban Benar</label>
                  <select name="kunci" value={form.kunci} onChange={handleChange} className="w-full mt-2 p-3 bg-white border-2 border-indigo-200 rounded-xl font-bold text-indigo-700 outline-none">
                    <option value="">-- Pilih Kunci --</option>
                    <option value={form.opsiA}>Opsi أ</option>
                    <option value={form.opsiB}>Opsi ب</option>
                    <option value={form.opsiC}>Opsi ج</option>
                  </select>
                </div>
              </div>
            )}

            {/* KOTAK KETIK: ISIAN */}
            {form.tipe === 'isian' && (
              <div className="bg-green-50 p-5 rounded-2xl border border-green-100 space-y-2">
                <label className="text-xs font-bold text-green-700 uppercase">Kunci Jawaban Isian</label>
                <input 
                  type="text" name="kunci" value={form.kunci} onChange={handleChange} dir={form.bahasa === 'ar' ? 'rtl' : 'ltr'}
                  className="w-full p-3 bg-white border-2 border-green-200 rounded-xl outline-none text-xl font-medium"
                  placeholder="Ketik kunci jawaban pasti..."
                />
                {form.kunci && (
                   <div className="px-4 py-2 bg-white border border-green-100 rounded-lg shadow-sm mt-2">
                      <div className={form.bahasa === 'ar' ? 'text-right' : 'text-left'} dir={form.bahasa === 'ar' ? 'rtl' : 'ltr'}>
                        {renderTeks(form.kunci)}
                      </div>
                   </div>
                )}
              </div>
            )}

            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-lg transition-all transform active:scale-95 mt-4">
              💾 SIMPAN KE BANK SOAL
            </button>
          </form>
        </div>

        {/* --- PANEL BANK SOAL (Preview Akhir) --- */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-lg border-t-8 border-emerald-500 flex flex-col h-[850px]">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">📚 Bank Soal ({bankSoal.length})</h2>
          
          <div className="flex-grow overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {bankSoal.length === 0 ? (
              <div className="text-center text-slate-300 py-20 border-4 border-dashed rounded-3xl h-full flex flex-col items-center justify-center">
                <span className="text-6xl mb-4">📭</span>
                <p className="font-bold">Belum ada soal. Silakan buat di panel kiri!</p>
              </div>
            ) : (
              bankSoal.map((soal, idx) => (
                <div key={soal.id} className="relative bg-slate-50 border-2 border-slate-100 p-5 rounded-2xl shadow-sm hover:border-emerald-200 transition-colors">
                  <button onClick={() => hapusSoal(soal.id)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors">✕</button>
                  
                  <div className="flex gap-2 mb-4">
                    <span className="bg-emerald-500 text-white text-[10px] px-3 py-1 rounded-full font-bold">SOAL {idx + 1}</span>
                    <span className="bg-slate-200 text-slate-600 text-[10px] px-3 py-1 rounded-full uppercase font-bold">{soal.tipe.replace('_', ' ')}</span>
                  </div>
                  
                  <div className={`mb-4 ${soal.bahasa === 'ar' ? 'text-right' : 'text-left'}`} dir={soal.bahasa === 'ar' ? 'rtl' : 'ltr'}>
                    <p className="font-semibold text-slate-800 leading-loose">
                      {renderTeks(soal.teksSoal)}
                    </p>
                    
                    {soal.teksTambahanArab && (
                      <div className="mt-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                        <p className="teks-arab-besar text-right text-indigo-900 leading-loose" dir="rtl">
                          {soal.teksTambahanArab}
                        </p>
                      </div>
                    )}
                  </div>

                  {soal.tipe === 'pilihan_ganda' && (
                    <div className="grid grid-cols-1 gap-2 text-sm mt-4 border-t border-slate-200 pt-4">
                      {['A', 'B', 'C'].map((abjad, i) => {
                        const opsiKey = `opsi${abjad}`;
                        if (!soal[opsiKey]) return null;
                        const isKunci = soal.kunci === soal[opsiKey];
                        
                        return (
                          <div key={abjad} className={`p-3 rounded-xl flex items-center justify-between ${isKunci ? 'bg-green-100 font-bold border border-green-300 text-green-800' : 'bg-white border border-slate-200 text-slate-600'}`}>
                            <div className="flex items-center gap-3 w-full" dir={soal.bahasa === 'ar' ? 'rtl' : 'ltr'}>
                              <span className="text-slate-400 font-bold">{abjad === 'A' ? 'أ' : abjad === 'B' ? 'ب' : 'ج'}.</span>
                              <span className="flex-grow">{renderTeks(soal[opsiKey])}</span>
                            </div>
                            {isKunci && <span className="text-green-600 text-xs px-2 py-1 bg-green-200 rounded-md whitespace-nowrap">✅ Kunci</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {soal.tipe === 'isian' && (
                    <div className="mt-4 p-3 bg-green-50 rounded-xl border border-green-200 text-sm font-bold text-green-700 flex items-center gap-2">
                      <span>🔑 Kunci:</span>
                      <span dir={soal.bahasa === 'ar' ? 'rtl' : 'ltr'}>{renderTeks(soal.kunci)}</span>
                    </div>
                  )}
                  
                  {soal.tipe === 'suara' && (
                    <div className="mt-4 flex items-center gap-2 text-blue-600 text-sm font-bold bg-blue-50 p-3 rounded-xl border border-blue-200">
                      <span>🎙️ Tipe Soal Lisan (Menunggu Rekaman Murid)</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default LmsKuAdmin;