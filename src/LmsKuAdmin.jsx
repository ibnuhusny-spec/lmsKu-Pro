import React, { useState, useRef, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';

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

const generateKodeAcak = () => Math.random().toString(36).substring(2, 7).toUpperCase();

const formatTeksDenganLink = (teks) => {
  if (!teks) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return teks.split(urlRegex).map((part, i) => {
    if (part.match(urlRegex)) { return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-700 dark:text-blue-300 underline font-black break-all hover:opacity-80">{part}</a>; }
    return <span key={i}>{part}</span>;
  });
};

const LmsKuAdmin = ({ bankSoal, setoran, pengaturan, daftarUjian, keLogin, emailAdmin, superAdmin }) => {
  const [tabAdmin, setTabAdmin] = useState('buat'); 
  const [isSaving, setIsSaving] = useState(false);
  const [setoranTerpilih, setSetoranTerpilih] = useState(null);
  const [editId, setEditId] = useState(null);
  
  const [nilaiManual, setNilaiManual] = useState("");
  const [skorPerSoal, setSkorPerSoal] = useState({});

  const [pesanText, setPesanText] = useState('');
  const [gambarUploadForum, setGambarUploadForum] = useState(null);
  const [semuaPesan, setSemuaPesan] = useState([]);
  const [semuaAnggota, setSemuaAnggota] = useState([]); 
  const [editForumId, setEditForumId] = useState(null);
  const [teksEditForum, setTeksEditForum] = useState('');
  const scrollRef = useRef(null);

  const isSuperAdmin = emailAdmin === superAdmin;
  const daftarHalaqahAman = Array.isArray(pengaturan?.daftarHalaqah) ? pengaturan.daftarHalaqah : [];
  const daftarBlokirAman = Array.isArray(pengaturan?.daftarBlokir) ? pengaturan.daftarBlokir : []; 
  
  const halaqahMilikGuru = daftarHalaqahAman.filter(h => h.emailGuru === emailAdmin);
  
  const [kelasAktif, setKelasAktif] = useState(halaqahMilikGuru.length > 0 ? halaqahMilikGuru[0].kode : '');
  const [ujianAktifAdmin, setUjianAktifAdmin] = useState('');

  const ujianKelasIni = daftarUjian.filter(u => u.kodeHalaqah === kelasAktif);
  ujianKelasIni.sort((a, b) => new Date(a.waktuMulai) - new Date(b.waktuMulai));

  const soalTampil = bankSoal.filter(s => s.kodeHalaqah === kelasAktif && s.idUjian === ujianAktifAdmin);
  const setoranTampil = setoran.filter(s => s.kodeHalaqah === kelasAktif && s.idUjian === ujianAktifAdmin);
  const setoranKelasIni = setoran.filter(s => s.kodeHalaqah === kelasAktif);

  useEffect(() => {
     if (!kelasAktif && halaqahMilikGuru.length > 0) setKelasAktif(halaqahMilikGuru[0].kode);
  }, [halaqahMilikGuru, kelasAktif]);

  useEffect(() => {
     if (ujianKelasIni.length > 0 && !ujianKelasIni.find(u => u.docId === ujianAktifAdmin)) {
        setUjianAktifAdmin(ujianKelasIni[0].docId);
     } else if (ujianKelasIni.length === 0) {
        setUjianAktifAdmin('');
     }
  }, [kelasAktif, ujianKelasIni]);

  useEffect(() => {
    if(!kelasAktif) return;
    const unsubForum = onSnapshot(collection(db, "forum"), (snap) => {
      let data = snap.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
      let pesanKelasIni = data.filter(d => d.kodeHalaqah === kelasAktif);
      pesanKelasIni.sort((a, b) => a.waktu - b.waktu);
      setSemuaPesan(pesanKelasIni);
      setTimeout(() => { if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 100);
    });

    const unsubAnggota = onSnapshot(collection(db, "anggota"), (snap) => {
      let data = snap.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
      setSemuaAnggota(data.filter(d => d.kodeHalaqah === kelasAktif));
    });

    return () => { unsubForum(); unsubAnggota(); };
  }, [kelasAktif]);

  const daftarSiswaUnikMap = new Map();
  semuaAnggota.forEach(a => daftarSiswaUnikMap.set(a.email, { email: a.email, nama: a.nama }));
  setoranKelasIni.forEach(s => daftarSiswaUnikMap.set(s.email, { email: s.email, nama: s.nama }));
  semuaPesan.filter(p => p.peran === 'siswa').forEach(p => daftarSiswaUnikMap.set(p.email, { email: p.email, nama: p.nama }));
  
  const daftarSiswaUnik = Array.from(daftarSiswaUnikMap.values());

  const rekapRapor = daftarSiswaUnik.map(siswa => {
     let totalSkor = 0;
     const nilaiPerUjian = {};
     ujianKelasIni.forEach(ujian => {
        const setoranSiswa = setoranKelasIni.find(s => s.email === siswa.email && s.idUjian === ujian.docId);
        const skor = setoranSiswa ? setoranSiswa.nilaiSistem : 0;
        nilaiPerUjian[ujian.docId] = skor;
        totalSkor += skor;
     });
     return { ...siswa, nilaiPerUjian, totalSkor };
  });
  rekapRapor.sort((a, b) => b.totalSkor - a.totalSkor);

  // FITUR EKSPOR EXCEL (CSV)
  const unduhExcel = () => {
    let csvContent = "data:text/csv;charset=utf-8,No;Nama;Email;";
    ujianKelasIni.forEach(u => csvContent += `${u.judul};`);
    csvContent += "Total Skor\n";
    rekapRapor.forEach((s, idx) => {
      let row = `${idx+1};${s.nama};${s.email};`;
      ujianKelasIni.forEach(u => row += `${s.nilaiPerUjian[u.docId] || 0};`);
      row += `${s.totalSkor}\n`;
      csvContent += row;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rapor_Kelas_${kelasAktif}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const tambahSiswaManual = async (e) => {
     e.preventDefault();
     const namaInput = e.target.namaSiswa.value.trim();
     const emailInput = e.target.emailSiswa.value.trim().toLowerCase();
     if(!namaInput || !emailInput || !kelasAktif) return;
     try {
        await setDoc(doc(db, "anggota", `${kelasAktif}_${emailInput}`), {
           kodeHalaqah: kelasAktif, email: emailInput, nama: namaInput, waktuGabung: Date.now(), ditambahkanManual: true
        }, { merge: true });
        alert(`✅ Siswa ${namaInput} ditambahkan manual!`); e.target.reset();
     } catch (err) { alert("Gagal."); }
  };

  const keluarkanSiswa = async (emailSiswa) => {
     if(window.confirm(`Keluarkan ${emailSiswa} dari kelas ini?\n\nSiswa tersebut masih bisa masuk kembali dengan mengetik Kode Kelas Anda.`)) {
        try {
           await deleteDoc(doc(db, "anggota", `${kelasAktif}_${emailSiswa.toLowerCase()}`));
           alert("✅ Siswa berhasil dikeluarkan dari absensi kelas.");
        } catch(e) { alert("Gagal mengeluarkan siswa."); }
     }
  };

  const blokirAkun = async (emailSiswa) => {
     if(window.confirm(`Yakin ingin memblokir permanen ${emailSiswa}?\nMurid ini tidak akan bisa masuk ke kelas Anda lagi.`)) {
        const listBaru = [...daftarBlokirAman, emailSiswa.toLowerCase()];
        await setDoc(doc(db, "sistem", "pengaturan"), { ...pengaturan, daftarBlokir: listBaru });
     }
  };

  const bukaBlokir = async (emailSiswa) => {
     if(window.confirm(`Buka blokir untuk ${emailSiswa}?`)) {
        const listBaru = daftarBlokirAman.filter(e => e !== emailSiswa.toLowerCase());
        await setDoc(doc(db, "sistem", "pengaturan"), { ...pengaturan, daftarBlokir: listBaru });
     }
  };

  const [editUjianId, setEditUjianId] = useState(null);
  const [formUjian, setFormUjian] = useState({
     judul: '', durasi: 60, waktuMulai: '', waktuSelesai: '', tipeTarget: 'semua', targetSiswa: '', kunciLayar: false, poinBenar: 10
  });

  const handleBuatUjian = async (e) => {
     e.preventDefault();
     if(!kelasAktif) return alert("Pilih kelas dulu!");
     try {
        if (editUjianId) {
           await updateDoc(doc(db, "ujian", editUjianId), { ...formUjian, kodeHalaqah: kelasAktif, emailGuru: emailAdmin });
           alert("✅ Jadwal Ujian Berhasil Diupdate!"); setEditUjianId(null);
        } else {
           const docRef = await addDoc(collection(db, "ujian"), { ...formUjian, kodeHalaqah: kelasAktif, emailGuru: emailAdmin });
           setUjianAktifAdmin(docRef.id); alert("✅ Jadwal Ujian Berhasil Dibuat!");
        }
        setFormUjian({ judul: '', durasi: 60, waktuMulai: '', waktuSelesai: '', tipeTarget: 'semua', targetSiswa: '', kunciLayar: false, poinBenar: 10 });
     } catch(err) { alert("❌ Gagal menyimpan ujian."); }
  };

  const editUjian = (ujian) => {
     setFormUjian({
        judul: ujian.judul || '', durasi: ujian.durasi || 60, waktuMulai: ujian.waktuMulai || '', waktuSelesai: ujian.waktuSelesai || '',
        tipeTarget: ujian.tipeTarget || 'semua', targetSiswa: ujian.targetSiswa || '', kunciLayar: ujian.kunciLayar || false, poinBenar: ujian.poinBenar || 10
     });
     setEditUjianId(ujian.docId);
  };

  const hapusUjian = async (docId) => {
     if(window.confirm("⚠️ YAKIN HAPUS UJIAN INI?\nSemua soal di dalamnya akan terputus dari jadwal!")) {
        await deleteDoc(doc(db, "ujian", docId));
        if(editUjianId === docId) { setEditUjianId(null); setFormUjian({ judul: '', durasi: 60, waktuMulai: '', waktuSelesai: '', tipeTarget: 'semua', targetSiswa: '', kunciLayar: false, poinBenar: 10 }); }
     }
  };

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
    } else { kunciBaru = [nilai]; }
    setForm({ ...form, kunci: kunciBaru });
  };
  const handleCheckboxUraian = (jenis) => setForm({ ...form, izinUraian: { ...form.izinUraian, [jenis]: !form.izinUraian[jenis] } });

  const handleUploadGambarAdmin = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scaleSize = 400 / img.width;
        canvas.width = 400; canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setForm({ ...form, mediaSoalGambar: canvas.toDataURL('image/jpeg', 0.5) });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleUploadGambarForum = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scaleSize = 400 / img.width;
        canvas.width = 400; canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setGambarUploadForum(canvas.toDataURL('image/jpeg', 0.5));
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
    } catch (err) { alert("Akses Mikrofon ditolak."); }
  };
  const stopRecordingAdmin = () => { if (adminMediaRecorder.current) { adminMediaRecorder.current.stop(); setIsRecordingAdmin(false); } };

  const handleSimpanSoal = async (e) => {
    e.preventDefault();
    if (!kelasAktif) return alert('Pilih Kelas terlebih dahulu!');
    if (!ujianAktifAdmin) return alert('Buat & Pilih Jadwal Ujian terlebih dahulu!');
    if (!form.teksSoal && !form.mediaSoalGambar && !form.mediaSoalSuara) return alert('Soal kosong!');
    if (form.tipe === 'pilihan_ganda' && form.kunci.length !== 1) return alert('Pilih 1 kunci!');
    if (form.tipe === 'pilihan_ganda_kompleks' && form.kunci.length < 2) return alert('Pilih minimal 2 kunci!');
    if (form.tipe === 'isian' && (!form.kunci || form.kunci.length === 0)) return alert('Kunci isian kosong!');
    
    setIsSaving(true);
    try {
      const finalData = { ...form, kodeHalaqah: kelasAktif, idUjian: ujianAktifAdmin }; 
      if (editId) await updateDoc(doc(db, "soal", editId), finalData);
      else await addDoc(collection(db, "soal"), { ...finalData, id: Date.now() });
      
      setForm(prev => ({ 
         ...prev, 
         teksSoal: '', teksTambahanArab: '', 
         opsiA: '', opsiB: '', opsiC: '', opsiD: '', opsiE: '', 
         kunci: prev.tipe.includes('pilihan_ganda') ? [] : '', 
         mediaSoalGambar: null, mediaSoalSuara: null 
      }));
      setEditId(null);
    } catch (error) { alert("❌ Gagal Simpan."); } 
    finally { setIsSaving(false); }
  };

  const editSoal = (soal) => { setForm(soal); setEditId(soal.docId); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  
  const salinSoal = (soal) => {
     setForm({
        tipe: soal.tipe, bahasa: soal.bahasa, jumlahOpsi: soal.jumlahOpsi,
        teksSoal: soal.teksSoal, teksTambahanArab: soal.teksTambahanArab || '',
        opsiA: soal.opsiA || '', opsiB: soal.opsiB || '', opsiC: soal.opsiC || '', opsiD: soal.opsiD || '', opsiE: soal.opsiE || '',
        kunci: soal.kunci, mediaSoalGambar: soal.mediaSoalGambar || null, mediaSoalSuara: soal.mediaSoalSuara || null,
        izinUraian: soal.izinUraian || { teks: true, gambar: true, suara: true }
     });
     setEditId(null); 
     window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hapusSoal = async (docId) => { if(window.confirm("Hapus soal permanen?")) await deleteDoc(doc(db, "soal", docId)); };
  
  const tambahHalaqahBaru = async (e) => {
    e.preventDefault();
    const namaHalaqah = e.target.namaHalaqah.value.trim();
    if (!namaHalaqah) return;
    const kodeBaru = generateKodeAcak();
    const listBaru = [...daftarHalaqahAman, { nama: namaHalaqah, kode: kodeBaru, emailGuru: emailAdmin }];
    await setDoc(doc(db, "sistem", "pengaturan"), { ...pengaturan, daftarHalaqah: listBaru });
    e.target.reset();
  };

  const hapusHalaqah = async (kode) => {
    if(window.confirm("Hapus kelas ini?")) {
      const listBaru = daftarHalaqahAman.filter(h => h.kode !== kode);
      await setDoc(doc(db, "sistem", "pengaturan"), { ...pengaturan, daftarHalaqah: listBaru });
      if (kelasAktif === kode) setKelasAktif('');
    }
  };

  const salinKode = (kode) => {
     navigator.clipboard.writeText(kode);
     alert(`✅ Kode Kelas "${kode}" berhasil disalin! Silakan bagikan ke murid.`);
  };

  const [qrHalaqah, setQrHalaqah] = useState(null);

  const salinUndanganWA = (halaqah) => {
     const urlAplikasi = window.location.origin + window.location.pathname; 
     const linkDirect = `${urlAplikasi}?kelas=${halaqah.kode}`;
     const teksWA = `🎓 *UNDANGAN KELAS VIRTUAL* 🎓\n\nHalo! Anda diundang untuk bergabung ke kelas *${halaqah.nama}* di portal pembelajaran kita.\n\n✨ *CARA CEPAT BERGABUNG:*\nKlik tautan otomatis di bawah ini, login dengan akun Google Anda, dan klik tombol "Masuk Kelas":\n👉 ${linkDirect}\n\n*(Atau masukkan kode kelas manual: ${halaqah.kode})*\n\nSelamat belajar dan sampai jumpa di kelas! 🚀`;
     
     navigator.clipboard.writeText(teksWA);
     alert(`✅ Teks undangan WhatsApp Pintar berhasil disalin!\nSilakan buka WA dan "Paste/Tempel" ke grup murid Anda.`);
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
      alert("✅ Nilai akhir diupdate!");
    } catch(e) { alert("Gagal update."); }
  };

  const hapusSetoran = async (docId) => { if(window.confirm("Hapus hasil ujian murid ini?")) { await deleteDoc(doc(db, "setoran", docId)); if(setoranTerpilih && setoranTerpilih.docId === docId) setSetoranTerpilih(null); } };
  const hapusSemuaSetoran = async () => { if(window.confirm("⚠️ Hapus SELURUH data evaluasi di ujian ini?")) { for (const s of setoranTampil) { await deleteDoc(doc(db, "setoran", s.docId)); } setSetoranTerpilih(null); alert("Bersih."); } };

  const tambahGuru = async (e) => {
    e.preventDefault();
    const emailBaru = e.target.emailGuru.value.trim().toLowerCase();
    if (!emailBaru) return;
    if ((pengaturan.daftarGuru || []).includes(emailBaru)) return alert("Email sudah ada!");
    const listBaru = [...(pengaturan.daftarGuru || []), emailBaru];
    await setDoc(doc(db, "sistem", "pengaturan"), { ...pengaturan, daftarGuru: listBaru });
    e.target.reset();
  };

  const hapusGuru = async (emailTarget) => {
    if(window.confirm(`Hapus hak akses untuk ${emailTarget}?`)) {
      const listBaru = (pengaturan.daftarGuru || []).filter(e => e !== emailTarget);
      await setDoc(doc(db, "sistem", "pengaturan"), { ...pengaturan, daftarGuru: listBaru });
    }
  };

  const kirimPesanGuru = async (e) => {
    e.preventDefault();
    if (!pesanText.trim() && !gambarUploadForum) return;
    try {
      await addDoc(collection(db, "forum"), {
        kodeHalaqah: kelasAktif, nama: 'Guru Pengajar', email: emailAdmin, peran: 'guru',
        teks: pesanText, gambar: gambarUploadForum, waktu: Date.now(),
        waktuTampil: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      });
      setPesanText(''); setGambarUploadForum(null);
    } catch (err) { alert("Gagal mengirim."); }
  };

  const hapusPesanForum = async (docId) => { if(window.confirm("Hapus pesan ini?")) await deleteDoc(doc(db, "forum", docId)); };
  const simpanEditForum = async (docId) => {
     if(!teksEditForum.trim()) return;
     try { await updateDoc(doc(db, "forum", docId), { teks: teksEditForum }); setEditForumId(null); } catch(e) { alert("Gagal mengedit."); }
  };

  return (
    <div className="p-4 md:p-8 font-sans max-w-7xl mx-auto pb-32">
      
      {qrHalaqah && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full relative">
               <button onClick={() => setQrHalaqah(null)} className="absolute top-4 right-4 bg-red-100 text-red-600 w-8 h-8 rounded-full font-bold">✕</button>
               <h3 className="text-xl font-black mb-1">QR Code Kelas</h3>
               <div className="bg-white p-4 rounded-2xl border-4 border-emerald-100 my-6">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(window.location.origin + window.location.pathname + '?kelas=' + qrHalaqah.kode)}`} alt="QR" className="w-48 h-48" />
               </div>
            </div>
         </div>
      )}

      <div className={`p-4 rounded-3xl mb-6 shadow-md flex flex-wrap justify-between items-center transition-colors ${isSuperAdmin ? 'bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-900 dark:to-indigo-900' : 'bg-indigo-600 dark:bg-indigo-900'}`}>
         <div>
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">{isSuperAdmin ? '👑 PANEL SUPER ADMIN' : 'Ruang Kerja Eksklusif Guru'}</p>
            <p className="font-black text-lg text-white">{emailAdmin}</p>
         </div>
         <button onClick={keLogin} className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all">🚪 Log Out</button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 border-b dark:border-slate-700">
          <button onClick={() => {setTabAdmin('buat'); setSetoranTerpilih(null);}} className={`px-4 py-2 font-bold rounded-lg text-sm ${tabAdmin === 'buat' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500'}`}>➕ Buat</button>
          <button onClick={() => {setTabAdmin('forum'); setSetoranTerpilih(null);}} className={`px-4 py-2 font-bold rounded-lg text-sm ${tabAdmin === 'forum' ? 'bg-sky-100 text-sky-700' : 'text-slate-500'}`}>💬 Forum</button>
          <button onClick={() => {setTabAdmin('koreksi'); setSetoranTerpilih(null);}} className={`px-4 py-2 font-bold rounded-lg text-sm ${tabAdmin === 'koreksi' ? 'bg-orange-100 text-orange-700' : 'text-slate-500'}`}>✅ Evaluasi</button>
          <button onClick={() => {setTabAdmin('rapor'); setSetoranTerpilih(null);}} className={`px-4 py-2 font-bold rounded-lg text-sm ${tabAdmin === 'rapor' ? 'bg-teal-100 text-teal-700' : 'text-slate-500'}`}>📊 Rapor</button>
          {isSuperAdmin && <button onClick={() => {setTabAdmin('guru'); setSetoranTerpilih(null);}} className={`px-4 py-2 font-bold rounded-lg text-sm ${tabAdmin === 'guru' ? 'bg-purple-100 text-purple-700' : 'text-slate-500'}`}>👥 Guru</button>}
      </div>

      {tabAdmin !== 'guru' && halaqahMilikGuru.length > 0 && (
         <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-2xl mb-6 flex flex-wrap gap-4">
            <select value={kelasAktif} onChange={(e) => setKelasAktif(e.target.value)} className="flex-1 p-3 bg-white dark:bg-slate-700 rounded-xl font-bold text-sm outline-none border dark:border-slate-600">
               {halaqahMilikGuru.map(h => <option key={h.kode} value={h.kode}>{h.nama} ({h.kode})</option>)}
            </select>
            {tabAdmin !== 'forum' && tabAdmin !== 'rapor' && (
               <select value={ujianAktifAdmin} onChange={(e) => setUjianAktifAdmin(e.target.value)} className="flex-1 p-3 bg-white dark:bg-slate-700 rounded-xl font-bold text-sm outline-none border dark:border-slate-600">
                  {ujianKelasIni.length === 0 ? <option value="">-- Buat Ujian Dulu --</option> : ujianKelasIni.map(u => <option key={u.docId} value={u.docId}>{u.judul}</option>)}
               </select>
            )}
         </div>
      )}

      {tabAdmin === 'rapor' && (
         <div className="space-y-6">
            <div className="bg-teal-50 dark:bg-teal-900/20 p-6 rounded-[2rem] border border-teal-200">
               <h3 className="text-teal-700 font-black mb-3">➕ Tambah Manual</h3>
               <form onSubmit={tambahSiswaManual} className="flex flex-col md:flex-row gap-3">
                  <input name="namaSiswa" placeholder="Nama" required className="flex-1 p-3 rounded-xl border outline-none" />
                  <input name="emailSiswa" type="email" placeholder="Email" required className="flex-1 p-3 rounded-xl border outline-none" />
                  <button type="submit" className="bg-teal-600 text-white font-black px-6 py-3 rounded-xl">Daftarkan</button>
               </form>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border overflow-hidden">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black">📊 Buku Rapor</h2>
                  <button onClick={unduhExcel} className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-xs">📥 Unduh Excel</button>
               </div>
               <div className="overflow-x-auto pb-4">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                     <thead>
                        <tr className="bg-slate-100 dark:bg-slate-700 text-xs uppercase border-b-2 border-slate-200">
                           <th className="p-4 font-black">No</th>
                           <th className="p-4 font-black sticky left-0 bg-slate-100 dark:bg-slate-700 z-10">Nama Siswa</th>
                           {ujianKelasIni.map((u, i) => (<th key={i} className="p-4 font-black text-center">{u.judul}</th>))}
                           <th className="p-4 font-black text-center border-l">Total</th>
                           <th className="p-4 font-black text-center">Aksi</th>
                        </tr>
                     </thead>
                     <tbody>
                        {rekapRapor.map((siswa, idx) => (
                           <tr key={idx} className="border-b hover:bg-slate-50 dark:hover:bg-slate-700/50">
                              <td className="p-4 font-bold">{idx + 1}</td>
                              <td className="p-4 font-black sticky left-0 bg-white dark:bg-slate-800">{siswa.nama}</td>
                              {ujianKelasIni.map((u, i) => (<td key={i} className="p-4 font-bold text-center">{siswa.nilaiPerUjian[u.docId] || 0}</td>))}
                              <td className="p-4 font-black text-center text-emerald-500 bg-emerald-50/20">{siswa.totalSkor}</td>
                              <td className="p-4 text-center">
                                 <button onClick={() => keluarkanSiswa(siswa.email)} className="bg-orange-100 text-orange-600 px-3 py-1 rounded-lg text-[10px] font-bold">Hapus</button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>
      )}

      {tabAdmin === 'buat' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-emerald-800 p-6 rounded-3xl text-white">
               <h2 className="text-sm font-black mb-2">1. Kelola Kelas</h2>
               <form onSubmit={tambahHalaqahBaru} className="flex gap-2 mb-4">
                  <input name="namaHalaqah" placeholder="Nama Kelas..." required className="flex-1 p-3 bg-emerald-950 rounded-xl outline-none border border-emerald-700 text-sm" />
                  <button type="submit" className="bg-emerald-500 font-black px-4 rounded-xl">+</button>
               </form>
               <div className="space-y-2 max-h-48 overflow-y-auto">
                  {halaqahMilikGuru.map((h, i) => (
                    <div key={i} className="bg-emerald-950 p-3 rounded-xl border border-emerald-700 flex flex-col gap-2">
                       <div className="flex justify-between items-center"><p className="font-bold text-xs">{h.nama}</p><button onClick={() => hapusHalaqah(h.kode)} className="text-emerald-400 text-xs">✕</button></div>
                       <div className="flex gap-1">
                          <div className="bg-emerald-900 text-emerald-400 font-mono py-2 rounded-lg flex-1 text-center font-black">{h.kode}</div>
                          <button onClick={() => setQrHalaqah(h)} className="bg-white/10 px-3 rounded-lg">📱 QR</button>
                          <button onClick={() => salinUndanganWA(h)} className="bg-blue-600 px-3 rounded-lg">💬</button>
                          <button onClick={() => salinKode(h.kode)} className="bg-emerald-500 px-3 rounded-lg">📋</button>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
            
            <div className={`p-6 rounded-3xl border-2 text-white ${editUjianId ? 'bg-yellow-900 border-yellow-500' : 'bg-orange-800 border-transparent'}`}>
               <h2 className="text-sm font-black mb-4">2. Jadwal Ujian</h2>
               <form onSubmit={handleBuatUjian} className="space-y-3">
                  <input value={formUjian.judul} onChange={e=>setFormUjian({...formUjian, judul: e.target.value})} placeholder="Judul Ujian" required className="w-full p-3 bg-white text-slate-900 rounded-xl outline-none" />
                  <div className="flex gap-2">
                     <input type="datetime-local" value={formUjian.waktuMulai} onChange={e=>setFormUjian({...formUjian, waktuMulai: e.target.value})} className="flex-1 p-3 bg-white text-slate-800 rounded-xl outline-none text-xs" />
                     <input type="datetime-local" value={formUjian.waktuSelesai} onChange={e=>setFormUjian({...formUjian, waktuSelesai: e.target.value})} className="flex-1 p-3 bg-white text-slate-800 rounded-xl outline-none text-xs" />
                  </div>
                  <div className="flex gap-2 items-center">
                     <input type="number" value={formUjian.durasi} onChange={e=>setFormUjian({...formUjian, durasi: e.target.value})} className="w-16 p-3 bg-white text-slate-900 rounded-xl text-center" />
                     <span className="text-xs">Mnt</span>
                     <input type="number" value={formUjian.poinBenar} onChange={e=>setFormUjian({...formUjian, poinBenar: e.target.value})} className="w-16 p-3 bg-white text-slate-900 rounded-xl text-center" />
                     <span className="text-xs">Poin/Soal</span>
                  </div>
                  <label className="flex items-center gap-2 text-xs bg-black/20 p-3 rounded-xl cursor-pointer">
                     <input type="checkbox" checked={formUjian.kunciLayar} onChange={e=>setFormUjian({...formUjian, kunciLayar: e.target.checked})} className="w-4 h-4" />
                     🔒 Mode Ujian Ketat (Fullscreen)
                  </label>
                  <button type="submit" className="w-full py-3 bg-orange-500 font-black rounded-xl">{editUjianId ? 'Update' : 'Simpan'}</button>
               </form>
               <div className="mt-4 space-y-2 max-h-32 overflow-y-auto">
                  {ujianKelasIni.map((u, i) => (
                    <div key={i} className="flex justify-between bg-orange-950 p-2 rounded-xl text-xs border border-orange-700">
                       <p className="font-bold">{u.judul} ({u.poinBenar} Poin)</p>
                       <div className="flex gap-2"><button onClick={() => editUjian(u)} className="text-yellow-400">Edit</button><button onClick={() => hapusUjian(u.docId)} className="text-red-400">✕</button></div>
                    </div>
                  ))}
               </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border-2">
              <div className="flex justify-between items-center mb-6">
                 <h2 className="text-lg font-black">{editId ? '✏️ Edit Soal' : '3. Tambah Soal'}</h2>
                 <button onClick={() => window.print()} className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200">📄 Cetak Soal / Word</button>
              </div>
              <form onSubmit={handleSimpanSoal} className="space-y-4">
                  <select name="tipe" value={form.tipe} onChange={handleChangeTipe} className="w-full p-3 rounded-xl border dark:bg-slate-700 font-bold text-xs outline-none">
                    <option value="pilihan_ganda">1. Pilihan Ganda (1 Benar)</option>
                    
                    {/* 👇 PERBAIKAN TEKS (MENGHINDARI SYMBOL >) */}
                    <option value="pilihan_ganda_kompleks">2. Ganda Kompleks (Lebih Dari 1 Benar)</option>
                    
                    <option value="isian">3. Isian Singkat</option>
                    <option value="uraian">4. Uraian Bebas</option>
                  </select>
                  <div className="p-4 bg-purple-50 dark:bg-slate-700 rounded-xl space-y-3">
                     <p className="text-[10px] font-black uppercase text-purple-600">Media Soal:</p>
                     <div className="flex gap-2">
                        <label className="flex-1 bg-purple-500 text-white py-2 rounded-lg text-center text-xs font-bold cursor-pointer">📸 Foto <input type="file" accept="image/*" className="hidden" onChange={handleUploadGambarAdmin}/></label>
                        <button type="button" onClick={isRecordingAdmin ? stopRecordingAdmin : startRecordingAdmin} className={`flex-1 py-2 rounded-lg text-xs font-bold ${isRecordingAdmin ? 'bg-red-500' : 'bg-pink-500'} text-white`}>{isRecordingAdmin ? '⏹ Stop' : '🎤 Suara'}</button>
                     </div>
                  </div>
                  <textarea name="teksSoal" value={form.teksSoal} onChange={handleChange} placeholder="Pertanyaan..." rows="3" className="w-full p-4 border rounded-2xl dark:bg-slate-700 outline-none" />
                  {form.tipe.startsWith('pilihan_ganda') && (
                    <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-2xl space-y-3 border">
                      {['A', 'B', 'C', 'D', 'E'].slice(0, form.jumlahOpsi).map((label) => {
                        const isKunci = Array.isArray(form.kunci) ? form.kunci.includes(form[`opsi${label}`]) : form.kunci === form[`opsi${label}`];
                        return (
                          <div key={label} className="flex gap-2">
                            <button type="button" onClick={() => toggleKunci(form[`opsi${label}`])} className={`w-10 h-10 rounded-lg font-black text-xs ${isKunci ? 'bg-emerald-500 text-white' : 'bg-white border'}`}>{label}</button>
                            <input type="text" name={`opsi${label}`} value={form[`opsi${label}`]} onChange={handleChange} className="flex-1 p-2 border rounded-xl dark:bg-slate-600 outline-none" />
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {form.tipe === 'isian' && <input name="kunci" value={form.kunci} onChange={e=>setForm({...form, kunci: e.target.value})} placeholder="Kunci (Pisah koma jika variasi)" className="w-full p-3 border rounded-xl dark:bg-slate-700 outline-none" />}
                  <button type="submit" className="w-full py-4 bg-indigo-500 text-white font-black rounded-2xl shadow-lg">{isSaving ? '⏳' : '💾 SIMPAN'}</button>
              </form>
            </div>
            
            <div className="mt-6 space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar no-print">
               {soalTampil.map((soal, idx) => (
                  <div key={idx} className="p-5 bg-white dark:bg-slate-800 rounded-3xl border relative group">
                    <div className="absolute top-4 right-4 flex gap-2">
                       <button onClick={() => salinSoal(soal)} className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg font-bold">📋</button>
                       <button onClick={() => editSoal(soal)} className="w-8 h-8 bg-orange-100 text-orange-600 rounded-lg font-bold">✏️</button>
                       <button onClick={() => hapusSoal(soal.docId)} className="w-8 h-8 bg-red-100 text-red-600 rounded-lg font-bold">🗑️</button>
                    </div>
                    <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full uppercase">No. {idx+1}</span>
                    <p className="mt-4 font-bold text-slate-700 dark:text-white">{renderTeks(soal.teksSoal)}</p>
                  </div>
               ))}
            </div>

            {/* 👇 WUJUD CETAK SOAL (HANYA MUNCUL SAAT DI-PRINT / DI-SAVE PDF) */}
            <div className="hidden print:block font-serif text-black space-y-4 mt-8">
               <h1 className="text-xl font-bold text-center mb-8 border-b-2 pb-4">NASKAH UJIAN</h1>
               {soalTampil.map((soal, idx) => (
                  <div key={idx} className="mb-4 break-inside-avoid">
                     <p className="font-bold text-base leading-snug">{idx + 1}. {renderTeks(soal.teksSoal)}</p>
                     {soal.teksTambahanArab && <p className="teks-arab-besar text-right mt-2" dir="rtl">{soal.teksTambahanArab}</p>}
                     {soal.mediaSoalGambar && <img src={soal.mediaSoalGambar} className="max-h-32 mt-2" />}
                     {soal.tipe.startsWith('pilihan_ganda') && (
                        <div className="ml-4 mt-2 space-y-1">
                           {['A', 'B', 'C', 'D', 'E'].slice(0, soal.jumlahOpsi).map(lbl => (
                              soal[`opsi${lbl}`] ? <p key={lbl} className="text-sm">{lbl}. {renderTeks(soal[`opsi${lbl}`])}</p> : null
                           ))}
                        </div>
                     )}
                  </div>
               ))}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default LmsKuAdmin;