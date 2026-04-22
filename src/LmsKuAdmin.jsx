import React, { useState, useRef } from 'react';
import { db } from './firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';

const renderTeks = (text) => {
  if (!text) return null;
  const parts = text.split(/([\u0600-\u06FF\u064B-\u065F\u0670\s]+)/g);
  return parts.map((part, index) => (
    /[\u0600-\u06FF]/.test(part) ? <span key={index} className="teks-arab-besar inline-block px-1 align-middle text-indigo-900" dir="rtl">{part}</span> : <span key={index} className="align-middle">{part}</span>
  ));
};

const formatWaktuTampil = (detik) => {
  if (detik == null) return '-';
  return `${Math.floor(detik / 60)}m ${detik % 60}s`;
};

const generateKodeAcak = () => Math.random().toString(36).substring(2, 7).toUpperCase();

const LmsKuAdmin = ({ bankSoal, setoran, pengaturan, keLogin }) => {
  const [tabAdmin, setTabAdmin] = useState('buat'); 
  const [isSaving, setIsSaving] = useState(false);
  const [setoranTerpilih, setSetoranTerpilih] = useState(null);
  const [editId, setEditId] = useState(null);
  
  const [nilaiManual, setNilaiManual] = useState("");
  const [skorPerSoal, setSkorPerSoal] = useState({});

  const [form, setForm] = useState({
    tipe: 'pilihan_ganda', bahasa: 'id', jumlahOpsi: 4,
    teksSoal: '', teksTambahanArab: '', opsiA: '', opsiB: '', opsiC: '', opsiD: '', opsiE: '', 
    kunci: [], mediaSoalGambar: null, mediaSoalSuara: null,
    izinUraian: { teks: true, gambar: true, suara: true }
  });

  const [isRecordingAdmin, setIsRecordingAdmin] = useState(false);
  const adminMediaRecorder = useRef(null);
  const adminAudioChunks = useRef([]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleChangeTipe = (e) => {
    const tipeBaru = e.target.value;
    let opsi = form.jumlahOpsi;
    if (tipeBaru === 'pilihan_ganda') opsi = 4;
    if (tipeBaru === 'pilihan_ganda_kompleks') opsi = 5;
    setForm({ ...form, tipe: tipeBaru, jumlahOpsi: opsi, kunci: [] });
  };

  const toggleKunci = (nilai) => {
    if (!nilai) return;
    let kunciBaru = Array.isArray(form.kunci) ? [...form.kunci] : [];
    if (form.tipe === 'pilihan_ganda_kompleks') {
      kunciBaru.includes(nilai) ? kunciBaru = kunciBaru.filter(k => k !== nilai) : kunciBaru.push(nilai);
    } else {
      kunciBaru = [nilai]; 
    }
    setForm({ ...form, kunci: kunciBaru });
  };

  const handleCheckboxUraian = (jenis) => {
    setForm({ ...form, izinUraian: { ...form.izinUraian, [jenis]: !form.izinUraian[jenis] } });
  };

  const handleUploadGambarAdmin = (e) => {
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
        setForm({ ...form, mediaSoalGambar: canvas.toDataURL('image/jpeg', 0.5) });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const startRecordingAdmin = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      adminMediaRecorder.current = new MediaRecorder(stream);
      adminMediaRecorder.current.ondataavailable = (e) => { if (e.data.size > 0) adminAudioChunks.current.push(e.data); };
      adminMediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(adminAudioChunks.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => setForm({ ...form, mediaSoalSuara: reader.result });
        reader.readAsDataURL(audioBlob);
        adminAudioChunks.current = []; 
      };
      adminMediaRecorder.current.start();
      setIsRecordingAdmin(true);
    } catch (err) { alert("Akses Mikrofon ditolak komputer."); }
  };
  const stopRecordingAdmin = () => { if (adminMediaRecorder.current) { adminMediaRecorder.current.stop(); setIsRecordingAdmin(false); } };

  const handleSimpanSoal = async (e) => {
    e.preventDefault();
    if (!form.teksSoal && !form.mediaSoalGambar && !form.mediaSoalSuara) return alert('Soal tidak boleh kosong!');
    if (form.tipe === 'pilihan_ganda' && form.kunci.length !== 1) return alert('Pilih 1 kunci!');
    if (form.tipe === 'pilihan_ganda_kompleks' && form.kunci.length !== 2) return alert('Pilih tepat 2 kunci!');
    if (form.tipe === 'isian' && (!form.kunci || form.kunci.length === 0)) return alert('Kunci isian kosong!');
    if (form.tipe === 'uraian' && !form.izinUraian.teks && !form.izinUraian.gambar && !form.izinUraian.suara) return alert('Pilih minimal satu cara menjawab untuk siswa (Teks/Gambar/Suara)!');

    setIsSaving(true);
    try {
      if (editId) await updateDoc(doc(db, "soal", editId), { ...form });
      else await addDoc(collection(db, "soal"), { ...form, id: Date.now() });
      
      setForm({ tipe: 'pilihan_ganda', bahasa: 'id', jumlahOpsi: 4, teksSoal: '', teksTambahanArab: '', opsiA: '', opsiB: '', opsiC: '', opsiD: '', opsiE: '', kunci: [], mediaSoalGambar: null, mediaSoalSuara: null, izinUraian: { teks: true, gambar: true, suara: true } });
      setEditId(null);
    } catch (error) { alert("❌ Gagal Simpan: " + error.message); } 
    finally { setIsSaving(false); }
  };

  const editSoal = (soal) => { setForm(soal); setEditId(soal.docId); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const hapusSoal = async (docId) => { if(window.confirm("Hapus soal permanen?")) await deleteDoc(doc(db, "soal", docId)); };
  
  const simpanPengaturanUtama = async (e) => { 
    e.preventDefault(); 
    await setDoc(doc(db, "sistem", "pengaturan"), { ...pengaturan, judul: e.target.judulKuis.value, durasi: Number(e.target.durasiKuis.value) }); 
    alert("✅ Info Kuis Tersimpan!"); 
  };

  const tambahHalaqahBaru = async (e) => {
    e.preventDefault();
    const namaHalaqah = e.target.namaHalaqah.value.trim();
    if (!namaHalaqah) return;
    const kodeBaru = generateKodeAcak();
    const listBaru = [...(pengaturan.daftarHalaqah || []), { nama: namaHalaqah, kode: kodeBaru }];
    await setDoc(doc(db, "sistem", "pengaturan"), { ...pengaturan, daftarHalaqah: listBaru });
    e.target.reset();
  };

  const hapusHalaqah = async (kode) => {
    if(window.confirm("Hapus kode halaqah ini? Murid dengan kode ini tidak akan bisa login lagi.")) {
      const listBaru = (pengaturan.daftarHalaqah || []).filter(h => h.kode !== kode);
      await setDoc(doc(db, "sistem", "pengaturan"), { ...pengaturan, daftarHalaqah: listBaru });
    }
  };

  const salinKode = (kode) => {
     navigator.clipboard.writeText(kode);
     alert(`✅ Kode "${kode}" berhasil disalin! Silakan bagikan ke murid.`);
  };

  const bukaEvaluasi = (s) => { 
    const baseSkorAsli = s.nilaiSistemAsli !== undefined ? s.nilaiSistemAsli : s.nilaiSistem;
    setSetoranTerpilih({ ...s, nilaiSistemAsli: baseSkorAsli }); 
    setNilaiManual(s.nilaiSistem); 
    setSkorPerSoal(s.skorPerSoal || {});
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const ubahSkorPerSoal = (indexSoal, nilaiBaru) => {
     const updateSkor = { ...skorPerSoal, [indexSoal]: nilaiBaru };
     setSkorPerSoal(updateSkor);
     const base = setoranTerpilih.nilaiSistemAsli || 0;
     const totalTambahan = Object.values(updateSkor).reduce((acc, curr) => acc + Number(curr || 0), 0);
     setNilaiManual(base + totalTambahan); 
  };

  const simpanNilaiManual = async () => {
    if(!setoranTerpilih) return;
    try {
      await updateDoc(doc(db, "setoran", setoranTerpilih.docId), { 
         nilaiSistem: Number(nilaiManual),
         skorPerSoal: skorPerSoal, 
         nilaiSistemAsli: setoranTerpilih.nilaiSistemAsli 
      });
      setSetoranTerpilih({...setoranTerpilih, nilaiSistem: Number(nilaiManual), skorPerSoal});
      alert("✅ Nilai akhir beserta rinciannya berhasil disimpan!");
    } catch(e) { alert("Gagal update nilai: " + e.message); }
  };

  const hapusSetoran = async (docId) => { if(window.confirm("Hapus hasil ujian murid ini?")) { await deleteDoc(doc(db, "setoran", docId)); if(setoranTerpilih && setoranTerpilih.docId === docId) setSetoranTerpilih(null); } };
  const hapusSemuaSetoran = async () => { if(window.confirm("⚠️ Yakin ingin menghapus SELURUH data evaluasi murid?")) { for (const s of setoran) { await deleteDoc(doc(db, "setoran", s.docId)); } setSetoranTerpilih(null); alert("Bersih."); } };

  // PENGAMAN BUG LAYAR PUTIH: Memastikan array ada sebelum di-map
  const daftarHalaqahAman = Array.isArray(pengaturan?.daftarHalaqah) ? pengaturan.daftarHalaqah : [];

  return (
    <div className="p-4 md:p-8 font-sans max-w-7xl mx-auto pb-32">
      <div className="flex flex-wrap justify-between items-center mb-6 border-b border-slate-200 pb-4 gap-4">
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          <button onClick={() => {setTabAdmin('buat'); setSetoranTerpilih(null);}} className={`px-4 py-2 font-bold rounded-lg text-sm transition-all ${tabAdmin === 'buat' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}>➕ Buat Soal & Kelas</button>
          <button onClick={() => {setTabAdmin('koreksi'); setSetoranTerpilih(null);}} className={`px-4 py-2 font-bold rounded-lg text-sm transition-all ${tabAdmin === 'koreksi' ? 'bg-orange-100 text-orange-700' : 'text-slate-500 hover:bg-slate-100'}`}>✅ Evaluasi ({setoran.length})</button>
          <button onClick={() => {setTabAdmin('peringkat'); setSetoranTerpilih(null);}} className={`px-4 py-2 font-bold rounded-lg text-sm transition-all ${tabAdmin === 'peringkat' ? 'bg-yellow-100 text-yellow-700' : 'text-slate-500 hover:bg-slate-100'}`}>🏆 Peringkat</button>
        </div>
        <button onClick={keLogin} className="text-red-500 font-bold text-sm bg-red-50 px-4 py-2 rounded-lg hover:bg-red-100">Keluar</button>
      </div>

      {/* ===================== TAB BUAT SOAL ===================== */}
      {tabAdmin === 'buat' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-6">
            
            <div className="bg-slate-800 p-6 rounded-3xl shadow-sm space-y-6">
               <div>
                 <h2 className="text-lg font-black text-white mb-4">⚙️ Pengaturan Kuis</h2>
                 <form onSubmit={simpanPengaturanUtama} className="space-y-3">
                   <input name="judulKuis" defaultValue={pengaturan.judul} className="w-full p-3 bg-slate-700 text-white rounded-xl outline-none font-bold text-sm border border-slate-600 focus:border-indigo-400" placeholder="Nama Kuis" />
                   <div className="flex items-center gap-2">
                     <input type="number" name="durasiKuis" defaultValue={pengaturan.durasi} min="1" className="flex-1 p-3 bg-slate-700 text-white rounded-xl outline-none font-bold text-sm border border-slate-600 focus:border-indigo-400" placeholder="Durasi" />
                     <span className="text-white font-bold text-sm">Menit</span>
                   </div>
                   <button type="submit" className="w-full py-3 bg-indigo-500 text-white font-black rounded-xl hover:bg-indigo-400 text-sm">Simpan Pengaturan</button>
                 </form>
               </div>

               <div className="border-t border-slate-600 pt-6">
                 <h2 className="text-sm font-black text-white mb-2">Manajemen Kode Kelas</h2>
                 <p className="text-[10px] text-slate-400 mb-4 font-bold">Buat kelas/halaqah untuk mendapatkan kode masuk yang akan dibagikan ke murid.</p>
                 
                 <form onSubmit={tambahHalaqahBaru} className="flex gap-2 mb-4">
                    <input name="namaHalaqah" placeholder="Nama Kelas / Halaqah..." required className="flex-1 p-3 bg-slate-700 text-white rounded-xl outline-none font-bold text-sm border border-slate-600 focus:border-emerald-400" />
                    <button type="submit" className="bg-emerald-500 text-white font-black px-4 rounded-xl hover:bg-emerald-400">+</button>
                 </form>

                 <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {daftarHalaqahAman.length === 0 ? (
                       <div className="text-center p-4 border border-dashed border-slate-600 rounded-xl"><p className="text-xs text-slate-400 font-bold">Belum ada kode kelas.</p></div>
                    ) : (
                       daftarHalaqahAman.map((h, i) => (
                         <div key={i} className="flex flex-col bg-slate-700 p-3 rounded-xl border border-slate-600">
                            <div className="flex justify-between items-center mb-2">
                               <p className="text-white font-bold text-xs">{h.nama}</p>
                               <button onClick={() => hapusHalaqah(h.kode)} className="text-slate-400 hover:text-red-400 font-bold text-xs">✕ Hapus</button>
                            </div>
                            <div className="flex items-center gap-2">
                               <div className="bg-slate-900 text-emerald-400 font-mono text-lg tracking-widest font-black py-2 px-4 rounded-lg flex-1 text-center">{h.kode}</div>
                               <button onClick={() => salinKode(h.kode)} className="bg-blue-500 text-white text-xs font-bold px-3 py-3 rounded-lg hover:bg-blue-400">📋 Salin</button>
                            </div>
                         </div>
                       ))
                    )}
                 </div>
               </div>
            </div>

            <div className={`bg-white p-6 rounded-3xl shadow-sm border-2 h-fit ${editId ? 'border-orange-400 bg-orange-50' : 'border-slate-100'}`}>
              <div className="flex justify-between items-center mb-4">
                 <h2 className="text-lg font-black text-slate-800 tracking-tight">{editId ? '✏️ Mode Edit' : '➕ Arsitek Soal'}</h2>
                 {editId && <button onClick={() => {setEditId(null); setForm({...form, tipe: 'pilihan_ganda', teksSoal: ''})}} className="text-xs font-bold text-red-500 underline">Batal Edit</button>}
              </div>

              <form onSubmit={handleSimpanSoal} className="space-y-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <select name="tipe" value={form.tipe} onChange={handleChangeTipe} className="w-full p-2 bg-white rounded-lg font-bold text-xs outline-none text-indigo-700 border focus:border-indigo-400">
                    <option value="pilihan_ganda">1. Pilihan Ganda (1 Jawaban Benar)</option>
                    <option value="pilihan_ganda_kompleks">2. Ganda Kompleks (Wajib 2 Jawaban Benar)</option>
                    <option value="isian">3. Isian Singkat</option>
                    <option value="uraian">4. Uraian Bebas (Super-Soal)</option>
                  </select>
                </div>
                <select name="bahasa" value={form.bahasa} onChange={handleChange} className="w-full p-3 bg-white rounded-xl font-bold text-xs outline-none border focus:border-indigo-400">
                  <option value="id">🇮🇩 Latin</option><option value="ar">🇸🇦 Arab</option><option value="campuran">🔄 Campuran</option>
                </select>

                {form.tipe === 'uraian' && (
                   <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl space-y-3">
                     <p className="text-[10px] font-black text-purple-600 uppercase">Lampirkan Media Soal (Opsional):</p>
                     <div className="flex gap-2">
                        <label className="flex-1 text-center bg-purple-500 text-white py-2 rounded-lg font-bold text-xs cursor-pointer hover:bg-purple-600">📸 Foto <input type="file" accept="image/*" className="hidden" onChange={handleUploadGambarAdmin}/></label>
                        <button type="button" onClick={isRecordingAdmin ? stopRecordingAdmin : startRecordingAdmin} className={`flex-1 text-center py-2 rounded-lg font-bold text-xs transition-colors ${isRecordingAdmin ? 'bg-red-500 text-white animate-pulse' : 'bg-pink-500 text-white hover:bg-pink-600'}`}>
                           {isRecordingAdmin ? '⏹ Stop' : '🎤 Suara'}
                        </button>
                     </div>
                     {form.mediaSoalGambar && (
                        <div className="relative mt-2"><button type="button" onClick={() => setForm({...form, mediaSoalGambar: null})} className="absolute top-0 right-0 bg-red-500 text-white w-6 h-6 rounded-full font-bold text-xs">✕</button><img src={form.mediaSoalGambar} className="w-full max-h-32 object-contain rounded-lg border bg-white" /></div>
                     )}
                     {form.mediaSoalSuara && (
                        <div className="relative mt-2"><button type="button" onClick={() => setForm({...form, mediaSoalSuara: null})} className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full font-bold text-xs z-10">✕</button><audio controls src={form.mediaSoalSuara} className="w-full h-10" /></div>
                     )}
                   </div>
                )}

                <textarea name="teksSoal" value={form.teksSoal} onChange={handleChange} placeholder="Ketik Pertanyaan..." rows="3" dir={form.bahasa === 'ar' ? 'rtl' : 'ltr'} className="w-full p-4 bg-white rounded-2xl outline-none text-sm font-semibold border focus:border-indigo-400" />
                {(form.tipe === 'uraian' || form.bahasa === 'campuran') && (
                  <textarea name="teksTambahanArab" value={form.teksTambahanArab} onChange={handleChange} placeholder="Teks Arab Tambahan..." rows="2" dir="rtl" className="w-full p-4 bg-indigo-50 rounded-2xl outline-none teks-arab-besar border border-indigo-100" />
                )}

                {/* FILTER IZIN MENJAWAB MURID */}
                {form.tipe === 'uraian' && (
                   <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                      <p className="text-[10px] font-black text-indigo-600 uppercase mb-3">Siswa Boleh Menjawab Pakai:</p>
                      <div className="flex flex-wrap gap-4">
                         <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.izinUraian?.teks ?? true} onChange={() => handleCheckboxUraian('teks')} className="w-4 h-4 accent-indigo-600" /><span className="text-sm font-bold text-slate-700">Teks ⌨️</span></label>
                         <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.izinUraian?.gambar ?? true} onChange={() => handleCheckboxUraian('gambar')} className="w-4 h-4 accent-indigo-600" /><span className="text-sm font-bold text-slate-700">Gambar 📸</span></label>
                         <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.izinUraian?.suara ?? true} onChange={() => handleCheckboxUraian('suara')} className="w-4 h-4 accent-indigo-600" /><span className="text-sm font-bold text-slate-700">Audio 🎤</span></label>
                      </div>
                   </div>
                )}

                {form.tipe.startsWith('pilihan_ganda') && (
                  <div className="bg-slate-50 p-4 rounded-2xl space-y-3 border border-slate-100">
                    {form.tipe === 'pilihan_ganda' ? (
                       <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-black text-slate-400">JUMLAH OPSI</span>
                          <select name="jumlahOpsi" value={form.jumlahOpsi} onChange={handleChange} className="p-1 rounded bg-white text-xs font-bold border"><option value="3">3 Opsi</option><option value="4">4 Opsi</option></select>
                       </div>
                    ) : (<p className="text-[10px] font-black text-blue-500 uppercase mb-2">Wajib 5 Opsi (Ganda Kompleks)</p>)}

                    {['A', 'B', 'C', 'D', 'E'].slice(0, form.jumlahOpsi).map((label) => {
                      const isKunci = Array.isArray(form.kunci) ? form.kunci.includes(form[`opsi${label}`]) : form.kunci === form[`opsi${label}`];
                      return (
                        <div key={label} className="flex items-center gap-2">
                          <button type="button" onClick={() => toggleKunci(form[`opsi${label}`])} className={`w-10 h-10 rounded-lg font-black text-xs transition-all shadow-sm flex-shrink-0 ${isKunci && form[`opsi${label}`] ? 'bg-emerald-500 text-white border-b-4 border-emerald-700' : 'bg-white text-slate-300 border hover:border-indigo-300'}`}>{label}</button>
                          <input type="text" name={`opsi${label}`} value={form[`opsi${label}`]} onChange={handleChange} dir={form.bahasa === 'ar' ? 'rtl' : 'ltr'} className="flex-1 p-3 bg-white rounded-xl outline-none text-sm border focus:border-indigo-400" placeholder={`Opsi ${label}...`}/>
                        </div>
                      )
                    })}
                  </div>
                )}

                {form.tipe === 'isian' && (
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                    <label className="text-[10px] font-black text-emerald-600 uppercase mb-2 block">Kunci Jawaban Isian</label>
                    <input type="text" name="kunci" value={Array.isArray(form.kunci) ? '' : form.kunci} onChange={(e) => setForm({...form, kunci: e.target.value})} dir={form.bahasa === 'ar' ? 'rtl' : 'ltr'} className="w-full p-3 bg-white rounded-xl outline-none font-bold text-slate-700 border" placeholder="Ketik jawaban pasti..." />
                  </div>
                )}

                <button type="submit" disabled={isSaving} className={`w-full py-4 text-white font-black rounded-2xl border-b-4 transition-all shadow-lg ${isSaving ? 'bg-slate-400 border-slate-600' : (editId ? 'bg-orange-500 border-orange-700 hover:bg-orange-600' : 'bg-indigo-500 border-indigo-700 hover:bg-indigo-600')} active:border-b-0 active:translate-y-1`}>
                  {isSaving ? 'MENYIMPAN...' : (editId ? '🔄 UPDATE SOAL' : '💾 SIMPAN SOAL')}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
             <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest px-2">Bank Soal ({bankSoal.length})</h2>
             {bankSoal.length === 0 && <div className="bg-white p-10 rounded-3xl border-2 border-dashed border-slate-200 text-center text-slate-400 font-medium">Belum ada soal.</div>}
             {bankSoal.map((soal, idx) => (
                <div key={soal.docId} className={`p-5 rounded-3xl border relative shadow-sm group transition-all ${editId === soal.docId ? 'bg-orange-50 border-orange-300' : 'bg-white border-slate-100'}`}>
                  <div className="absolute top-4 right-4 flex gap-2">
                     <button onClick={() => editSoal(soal)} className="w-8 h-8 bg-orange-100 text-orange-600 rounded-lg font-bold text-sm hover:bg-orange-500 hover:text-white">✏️</button>
                     <button onClick={() => hapusSoal(soal.docId)} className="w-8 h-8 bg-red-100 text-red-600 rounded-lg font-bold text-sm hover:bg-red-500 hover:text-white">🗑️</button>
                  </div>
                  <span className="text-[10px] font-black text-indigo-400 uppercase bg-indigo-50 px-3 py-1 rounded-full">Soal {idx+1} • {soal.tipe.replace(/_/g, ' ')}</span>
                  
                  {soal.tipe === 'uraian' && (
                     <div className="mt-4 flex gap-2">
                        {soal.mediaSoalGambar && <img src={soal.mediaSoalGambar} className="h-16 rounded border" />}
                        {soal.mediaSoalSuara && <audio controls src={soal.mediaSoalSuara} className="h-10 mt-2" />}
                     </div>
                  )}

                  <div className={`mt-4 ${soal.bahasa === 'ar' ? 'text-right' : 'text-left'}`} dir={soal.bahasa === 'ar' ? 'rtl' : 'ltr'}>
                    <p className="font-bold text-slate-700 text-lg leading-relaxed">{renderTeks(soal.teksSoal)}</p>
                    {soal.teksTambahanArab && <p className="teks-arab-besar text-indigo-900 mt-2" dir="rtl">{soal.teksTambahanArab}</p>}
                  </div>
                  {soal.tipe.startsWith('pilihan') && (<div className="mt-4 pt-3 border-t text-xs text-emerald-600 font-bold"><span className="bg-emerald-50 px-2 py-1 rounded-md">🔑 Kunci: {Array.isArray(soal.kunci) ? soal.kunci.join(' | ') : soal.kunci}</span></div>)}
                  {soal.tipe === 'isian' && (<div className="mt-4 pt-3 border-t text-xs text-emerald-600 font-bold"><span className="bg-emerald-50 px-2 py-1 rounded-md" dir={soal.bahasa === 'ar' ? 'rtl' : 'ltr'}>🔑 Kunci: {soal.kunci}</span></div>)}
                </div>
             ))}
          </div>
        </div>
      )}

      {/* ===================== TAB EVALUASI ===================== */}
      {tabAdmin === 'koreksi' && (
        <div className="bg-white p-4 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[50vh]">
          {!setoranTerpilih ? (
             <>
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-100 pb-4">
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">Evaluasi Jawaban Murid</h2>
                  {setoran.length > 0 && (
                     <button onClick={hapusSemuaSetoran} className="text-xs font-bold bg-red-50 text-red-600 border border-red-100 px-4 py-2 rounded-xl hover:bg-red-500 hover:text-white transition-colors">🗑️ Bersihkan Semua Data</button>
                  )}
               </div>

               {setoran.length === 0 ? <div className="text-center py-20 text-slate-400 font-bold border-4 border-dashed rounded-3xl">Belum ada setoran masuk.</div> : (
                 <div className="flex flex-col gap-3">
                    {setoran.map((s) => (
                      <div key={s.docId} className="flex flex-col md:flex-row items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-indigo-300 transition-all shadow-sm gap-4">
                         <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="bg-white border-2 border-indigo-100 text-indigo-600 font-black text-2xl w-14 h-14 flex flex-col items-center justify-center rounded-2xl shadow-sm leading-none">
                              {s.nilaiSistem}<span className="text-[8px] text-slate-400 uppercase tracking-widest mt-1">Skor</span>
                            </div>
                            <div>
                               <h3 className="font-black text-slate-800 text-lg leading-tight">{s.nama}</h3>
                               {/* MENAMPILKAN TANGGAL/WAKTU SUBMIT LENGKAP */}
                               <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                                 Halaqah {s.halaqah} • ⏱️ {formatWaktuTampil(s.waktuPengerjaan)} <br/>
                                 <span className="text-emerald-600 inline-block mt-1">Disetor: {s.tanggal}</span>
                               </p>
                            </div>
                         </div>
                         <div className="flex gap-2 w-full md:w-auto">
                            <button onClick={() => bukaEvaluasi(s)} className="flex-1 md:flex-none bg-indigo-500 text-white font-bold text-xs px-6 py-3 rounded-xl hover:bg-indigo-600 transition-colors shadow-sm">Review & Beri Nilai</button>
                            <button onClick={() => hapusSetoran(s.docId)} className="bg-white border border-red-200 text-red-500 font-bold px-4 py-3 rounded-xl hover:bg-red-50 transition-colors">🗑️</button>
                         </div>
                      </div>
                    ))}
                 </div>
               )}
             </>
          ) : (
             <div>
               <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md p-4 border-b-2 border-slate-200 mb-6 flex flex-wrap justify-between items-center gap-4 rounded-b-2xl shadow-sm">
                 <div>
                   <button onClick={() => setSetoranTerpilih(null)} className="text-sm font-bold text-slate-400 hover:text-indigo-500 mb-1 block transition-colors">← Kembali ke Daftar</button>
                   <h2 className="text-xl font-black text-slate-800 leading-none">{setoranTerpilih.nama}</h2>
                   <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Halaqah {setoranTerpilih.halaqah}</p>
                 </div>
                 <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex items-center gap-3 shadow-inner">
                    <div>
                       <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1">Skor Total Akhir</span>
                       <input type="number" value={nilaiManual} onChange={(e) => setNilaiManual(e.target.value)} className="w-24 p-2 bg-white rounded-lg text-xl font-black text-center border border-emerald-200 outline-none focus:ring-2 ring-emerald-400" />
                    </div>
                    <button onClick={simpanNilaiManual} className="bg-emerald-500 text-white font-black text-xs px-4 py-3 rounded-xl hover:bg-emerald-600 shadow-md active:translate-y-1 transition-all">SIMPAN<br/>NILAI</button>
                 </div>
               </div>

               <div className="space-y-6">
                 {bankSoal.map((soal, index) => {
                   const jawabanMurid = setoranTerpilih.jawaban?.[index];
                   
                   if (soal.tipe === 'uraian') {
                      const jwb = jawabanMurid || {};
                      return (
                         <div key={index} className="p-5 rounded-2xl border-2 border-purple-100 bg-purple-50/30">
                            <div className="flex justify-between items-start mb-3">
                               <span className="text-[10px] font-black bg-purple-200 text-purple-700 px-2 py-1 rounded uppercase">Soal {index+1} (Uraian Bebas)</span>
                            </div>
                            
                            <div className="mb-4 bg-white p-4 rounded-xl border border-purple-100 shadow-sm">
                               <p className="font-bold text-slate-700 mb-3">{renderTeks(soal.teksSoal)}</p>
                               {soal.mediaSoalGambar && <img src={soal.mediaSoalGambar} className="h-20 rounded border mb-2" />}
                               {soal.mediaSoalSuara && <audio controls src={soal.mediaSoalSuara} className="h-8" />}
                            </div>
                            
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4">
                               <span className="text-[10px] font-black text-slate-400 uppercase block mb-2 border-b pb-1">Setoran Jawaban Siswa:</span>
                               {jwb.teks ? <p className="font-bold text-indigo-700 mb-2 whitespace-pre-wrap">{jwb.teks}</p> : <p className="text-xs text-slate-300 italic mb-2">Tidak ada teks</p>}
                               {jwb.gambar && <img src={jwb.gambar} className="max-w-xs rounded-xl border-2 border-slate-200 mb-2" />}
                               {jwb.suara && <audio controls src={jwb.suara} className="w-full h-10" />}
                               {!jwb.teks && !jwb.gambar && !jwb.suara && <p className="text-red-400 font-bold text-sm">Siswa tidak menjawab soal ini.</p>}
                            </div>

                            {/* KOTAK PENILAIAN KHUSUS PER SOAL URAIAN */}
                            <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between shadow-inner">
                               <div>
                                  <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Beri Poin / Nilai Soal Ini:</p>
                                  <p className="text-[9px] text-orange-500 font-bold">Otomatis dijumlahkan ke Skor Utama ⬆️</p>
                               </div>
                               <div className="flex items-center gap-2">
                                  <span className="text-xl font-black text-orange-500">+</span>
                                  <input 
                                     type="number" 
                                     value={skorPerSoal[index] || ''} 
                                     onChange={(e) => ubahSkorPerSoal(index, e.target.value)} 
                                     className="w-20 p-2 font-black text-center rounded-lg border border-orange-300 outline-none focus:ring-2 ring-orange-500 text-lg text-slate-700" 
                                     placeholder="0" 
                                  />
                               </div>
                            </div>
                         </div>
                      );
                   }

                   const kunciAsli = Array.isArray(soal.kunci) ? soal.kunci : [soal.kunci];
                   const jawabanMuridArray = Array.isArray(jawabanMurid) ? jawabanMurid : (jawabanMurid ? [jawabanMurid] : []);
                   let isBenar = false;
                   if (soal.tipe === 'isian') isBenar = jawabanMurid?.trim().toLowerCase() === soal.kunci?.trim().toLowerCase();
                   else isBenar = (jawabanMuridArray.length === kunciAsli.length) && jawabanMuridArray.every(j => kunciAsli.includes(j)); 

                   return (
                     <div key={index} className={`p-5 rounded-2xl border-2 ${isBenar ? 'border-emerald-100 bg-emerald-50/30' : 'border-red-100 bg-red-50/30'}`}>
                       <div className="flex justify-between items-start mb-3">
                         <span className="text-[10px] font-black bg-slate-200 text-slate-600 px-2 py-1 rounded uppercase">Soal {index + 1}</span>
                         {isBenar ? <span className="text-xl">✅</span> : <span className="text-xl">❌</span>}
                       </div>
                       <div className={soal.bahasa === 'ar' ? 'text-right' : 'text-left'} dir={soal.bahasa === 'ar' ? 'rtl' : 'ltr'}>
                         <p className="font-bold text-slate-700 text-base">{renderTeks(soal.teksSoal)}</p>
                       </div>
                       <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="bg-white p-3 rounded-xl border border-slate-200">
                           <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Jawaban Murid:</span>
                           <span className={`font-bold ${isBenar ? 'text-emerald-600' : 'text-red-500'}`} dir={soal.bahasa === 'ar' ? 'rtl' : 'ltr'}>
                              {jawabanMuridArray.length > 0 ? renderTeks(jawabanMuridArray.join(' | ')) : <i className="text-slate-300">Tidak dijawab</i>}
                           </span>
                         </div>
                         <div className="bg-white p-3 rounded-xl border border-slate-200">
                           <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Kunci Asli:</span>
                           <span className="font-bold text-indigo-600" dir={soal.bahasa === 'ar' ? 'rtl' : 'ltr'}>
                              {kunciAsli.length > 0 ? renderTeks(kunciAsli.join(' | ')) : <i className="text-slate-300">Kosong</i>}
                           </span>
                         </div>
                       </div>
                     </div>
                   );
                 })}
               </div>
             </div>
          )}
        </div>
      )}

      {/* ===================== TAB PERINGKAT ===================== */}
      {tabAdmin === 'peringkat' && (
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[50vh]">
          <h2 className="text-2xl font-black text-slate-800 mb-8 tracking-tight">Papan Peringkat Kelas</h2>
          
          {daftarHalaqahAman.length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold border-4 border-dashed rounded-3xl">Belum ada halaqah yang didaftarkan.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {daftarHalaqahAman.map((h, i) => {
                const peringkatHalaqah = setoran.filter(s => s.halaqah === h.nama && s.kuisJudul === pengaturan.judul).sort((a, b) => b.nilaiSistem - a.nilaiSistem || (a.waktuPengerjaan || 9999) - (b.waktuPengerjaan || 9999));
                return (
                  <div key={i} className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100">
                    <h3 className="text-lg font-black text-indigo-600 uppercase mb-1 tracking-widest">{h.nama}</h3>
                    <p className="text-[10px] font-bold text-slate-400 mb-4">Kode Kelas: {h.kode}</p>
                    
                    {peringkatHalaqah.length === 0 ? (
                       <p className="text-xs text-slate-400 italic">Belum ada murid yang selesai.</p>
                    ) : (
                       <div className="space-y-3">
                         {peringkatHalaqah.map((murid, idx) => (
                           <div key={idx} className="flex justify-between items-center bg-white p-4 rounded-2xl border shadow-sm hover:border-yellow-300 transition-all">
                              <div className="flex items-center gap-4">
                                 <span className="text-3xl drop-shadow-sm">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : <span className="bg-slate-200 text-slate-500 text-sm font-black w-8 h-8 flex items-center justify-center rounded-full">{idx+1}</span>}</span>
                                 <div>
                                    <p className="font-bold text-slate-800">{murid.nama}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Waktu: <span className="text-indigo-500">{formatWaktuTampil(murid.waktuPengerjaan)}</span></p>
                                 </div>
                              </div>
                              <span className="text-2xl font-black text-emerald-500">{murid.nilaiSistem}</span>
                           </div>
                         ))}
                       </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LmsKuAdmin;