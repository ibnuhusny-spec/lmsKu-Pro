import React, { useState } from 'react';

const renderTeks = (text) => {
  if (!text) return null;
  const parts = text.split(/([\u0600-\u06FF\u064B-\u065F\u0670\s]+)/g);
  return parts.map((part, index) => (
    /[\u0600-\u06FF]/.test(part) ? <span key={index} className="teks-arab-besar inline-block px-1 align-middle text-indigo-900" dir="rtl">{part}</span> : <span key={index} className="align-middle">{part}</span>
  ));
};

const LmsKuAdmin = ({ bankSoal, setBankSoal, setoran }) => {
  const [tabAdmin, setTabAdmin] = useState('buat');
  const [form, setForm] = useState({
    tipe: 'pilihan_ganda', bahasa: 'id', jumlahOpsi: 5,
    teksSoal: '', teksTambahanArab: '',
    opsiA: '', opsiB: '', opsiC: '', opsiD: '', opsiE: '', 
    kunci: [] // Mengubah kunci menjadi array untuk mendukung multi-jawaban
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const toggleKunci = (nilai) => {
    let kunciBaru = [...form.kunci];
    if (kunciBaru.includes(nilai)) {
      kunciBaru = kunciBaru.filter(k => k !== nilai);
    } else {
      kunciBaru.push(nilai);
    }
    setForm({ ...form, kunci: kunciBaru });
  };

  const handleSimpanSoal = (e) => {
    e.preventDefault();
    if (!form.teksSoal) return alert('Soal tidak boleh kosong!');
    setBankSoal([...bankSoal, { ...form, id: Date.now() }]);
    setForm({ ...form, teksSoal: '', teksTambahanArab: '', opsiA: '', opsiB: '', opsiC: '', opsiD: '', opsiE: '', kunci: [] });
  };

  return (
    <div className="p-4 md:p-8 font-sans max-w-7xl mx-auto">
      <div className="flex gap-2 mb-6 border-b border-slate-200 pb-2">
        <button onClick={() => setTabAdmin('buat')} className={`px-4 py-2 font-bold rounded-lg text-sm ${tabAdmin === 'buat' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500'}`}>➕ Buat Soal</button>
        <button onClick={() => setTabAdmin('koreksi')} className={`px-4 py-2 font-bold rounded-lg text-sm ${tabAdmin === 'koreksi' ? 'bg-orange-100 text-orange-700' : 'text-slate-500'}`}>✅ Panel Koreksi ({setoran.length})</button>
      </div>

      {tabAdmin === 'buat' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <form onSubmit={handleSimpanSoal} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <select name="tipe" value={form.tipe} onChange={handleChange} className="p-2.5 bg-slate-50 rounded-xl font-semibold text-xs outline-none">
                  <option value="pilihan_ganda">Pilihan Ganda (1 Jawaban)</option>
                  <option value="pilihan_ganda_multi">Ganda (Wajib 2 Jawaban)</option>
                  <option value="isian">Isian Singkat</option>
                  <option value="suara">Audio / Lisan</option>
                  <option value="gambar">Gambar / Tulis Tangan</option>
                </select>
                <select name="bahasa" value={form.bahasa} onChange={handleChange} className="p-2.5 bg-slate-50 rounded-xl font-semibold text-xs outline-none">
                  <option value="id">🇮🇩 Indonesia</option>
                  <option value="ar">🇸🇦 Arab</option>
                  <option value="campuran">🔄 Campuran</option>
                </select>
              </div>

              <textarea name="teksSoal" value={form.teksSoal} onChange={handleChange} placeholder="Ketik Soal..." rows="2" className="w-full p-3 bg-slate-50 rounded-xl outline-none text-sm" />

              {form.tipe.startsWith('pilihan_ganda') && (
                <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                   {['A', 'B', 'C', 'D', 'E'].map((label) => (
                    <div key={label} className="flex items-center gap-2">
                      <button type="button" onClick={() => toggleKunci(form[`opsi${label}`])} className={`w-8 h-8 rounded-lg font-bold text-xs ${form.kunci.includes(form[`opsi${label}`]) && form[`opsi${label}`] ? 'bg-emerald-500 text-white' : 'bg-white text-slate-300 border'}`}>{label}</button>
                      <input type="text" name={`opsi${label}`} value={form[`opsi${label}`]} onChange={handleChange} className="flex-1 p-2 bg-white rounded-lg outline-none text-sm border border-slate-100" placeholder={`Opsi ${label}...`}/>
                    </div>
                  ))}
                  <p className="text-[10px] text-slate-400 font-bold">Klik huruf (A-E) untuk menandai kunci jawaban.</p>
                </div>
              )}

              <button type="submit" className="w-full py-3 bg-indigo-500 text-white font-black rounded-xl border-b-4 border-indigo-700 active:border-b-0 active:translate-y-1 transition-all">Simpan Soal</button>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-3 h-[600px] overflow-y-auto pr-2">
             {bankSoal.map((soal, idx) => (
                <div key={soal.id} className="bg-white p-4 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Soal {idx+1} • {soal.tipe}</span>
                  <p className="font-bold text-slate-700">{renderTeks(soal.teksSoal)}</p>
                  <div className="mt-2 text-xs text-emerald-600 font-bold">Kunci: {Array.isArray(soal.kunci) ? soal.kunci.join(', ') : soal.kunci}</div>
                </div>
             ))}
          </div>
        </div>
      )}

      {tabAdmin === 'koreksi' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h2 className="text-xl font-black text-slate-800 mb-6 tracking-tight">Hasil Setoran Murid</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {setoran.map((s) => (
              <div key={s.id} className="p-5 bg-slate-50 rounded-2xl border-2 border-slate-100">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-black text-slate-800 text-lg">{s.nama}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{s.tanggal}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-indigo-600">{s.nilaiSistem}</span>
                    <p className="text-[10px] font-bold text-slate-400">SKOR AKHIR</p>
                  </div>
                </div>
                <button className="w-full py-2 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-600 text-sm hover:bg-slate-100">Lihat Jawaban Detail</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LmsKuAdmin;