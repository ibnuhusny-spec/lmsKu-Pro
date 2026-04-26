import React, { useState, useRef, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';

const renderTeks = (text) => {
  if (!text) return null;
  const parts = text.split(/([\u0600-\u06FF\u064B-\u065F\u0670\s]+)/g);
  return parts.map((part, index) => (
    /[\u0600-\u06FF]/.test(part) ? (
      <span key={index} className="teks-arab-besar inline-block px-1 align-middle text-indigo-900 dark:text-indigo-300" dir="rtl">
        {part}
      </span>
    ) : (
      <span key={index} className="align-middle">{part}</span>
    )
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
    if (part.match(urlRegex)) {
       return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-700 dark:text-blue-300 underline font-black break-all hover:opacity-80">
             {part}
          </a>
       );
    }
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
  
  const [qrHalaqah, setQrHalaqah] = useState(null);
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
     if (!kelasAktif && halaqahMilikGuru.length > 0) {
        setKelasAktif(halaqahMilikGuru[0].kode);
     }
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
      setTimeout(() => { 
         if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; 
      }, 100);
    });

    const unsubAnggota = onSnapshot(collection(db, "anggota"), (snap) => {
      let data = snap.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
      setSemuaAnggota(data.filter(d => d.kodeHalaqah === kelasAktif));
    });

    return () => { 
       unsubForum(); 
       unsubAnggota(); 
    };
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

  // MENGGUNAKAN CSV STANDAR AGAR AMAN DI HP
  const unduhExcel = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    let header = ["No", "Nama Siswa", "Email"];
    ujianKelasIni.forEach(u => header.push(u.judul));
    header.push("Total Skor");
    csvContent += header.join(";") + "\r\n";

    rekapRapor.forEach((s, idx) => {
      let row = [idx + 1, s.nama, s.email];
      ujianKelasIni.forEach(u => row.push(s.nilaiPerUjian[u.docId] || 0));
      row.push(s.totalSkor);
      csvContent += row.join(";") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rapor_Kelas_${kelasAktif}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 👈 FITUR BARU: TEMPLATE IMPORT SOAL CSV
  const unduhTemplateCSV = () => {
    const csv = "TipeSoal(1=PG; 2=Kompleks; 3=Isian; 4=Uraian);Pertanyaan;OpsiA;OpsiB;OpsiC;OpsiD;OpsiE;KunciJawaban(Gunakan pemisah | untuk Ganda Kompleks)\n1;Siapa penemu lampu pijar?;Thomas Edison;Nikola Tesla;Albert Einstein;Isaac Newton;;Thomas Edison\n2;Manakah yang termasuk benda padat?;Batu;Air;Kayu;Asap;;Batu | Kayu\n3;Apa nama ibukota negara Indonesia?;;;;;;Jakarta, DKI Jakarta, Kota Jakarta\n4;Jelaskan proses terjadinya hujan!;;;;;;";
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Template_Import_Soal.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 👈 FITUR BARU: PROSES BACA FILE IMPORT SOAL
  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!kelasAktif || !ujianAktifAdmin) {
       alert("Pilih Kelas & Jadwal Ujian terlebih dahulu di panel sebelah kiri!");
       e.target.value = null;
       return;
    }

    setIsSaving(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
       try {
          const text = event.target.result;
          const lines = text.split(/\r?\n/);
          
          // Deteksi pemisah otomatis (Koma, Titik Koma, atau Tab)
          const delimiter = lines[0].includes(';') ? ';' : (lines[0].includes('\t') ? '\t' : ',');
          let successCount = 0;

          for (let i = 1; i < lines.length; i++) {
             const line = lines[i].trim();
             if (!line) continue;
             
             // Pemisahan kolom sederhana
             const cols = line.split(delimiter);
             if (cols.length < 8) continue;
             
             const tipeCode = cols[0].trim();
             const teksSoal = cols[1].replace(/^"|"$/g, '').trim();
             const opsiA = cols[2].replace(/^"|"$/g, '').trim();
             const opsiB = cols[3].replace(/^"|"$/g, '').trim();
             const opsiC = cols[4].replace(/^"|"$/g, '').trim();
             const opsiD = cols[5].replace(/^"|"$/g, '').trim();
             const opsiE = cols[6].replace(/^"|"$/g, '').trim();
             const kunciRaw = cols[7].replace(/^"|"$/g, '').trim();

             let tipe = 'pilihan_ganda';
             let kunci = kunciRaw;
             
             const optionsArr = [opsiA, opsiB, opsiC, opsiD, opsiE].filter(Boolean);
             let jumlahOpsi = optionsArr.length > 0 ? optionsArr.length : 4;

             if (tipeCode === '1') { 
                tipe = 'pilihan_ganda'; 
                kunci = [kunciRaw]; 
             } else if (tipeCode === '2') { 
                tipe = 'pilihan_ganda_kompleks'; 
                kunci = kunciRaw.split('|').map(k => k.trim()); 
             } else if (tipeCode === '3') { 
                tipe = 'isian'; 
                kunci = kunciRaw; 
             } else if (tipeCode === '4') { 
                tipe = 'uraian'; 
                kunci = ''; 
             }

             const finalData = {
                kodeHalaqah: kelasAktif,
                idUjian: ujianAktifAdmin,
                tipe: tipe,
                bahasa: 'id', 
                jumlahOpsi: jumlahOpsi,
                teksSoal: teksSoal,
                teksTambahanArab: '',
                opsiA: opsiA, opsiB: opsiB, opsiC: opsiC, opsiD: opsiD, opsiE: opsiE,
                kunci: kunci,
                mediaSoalGambar: null, mediaSoalSuara: null,
                izinUraian: { teks: true, gambar: true, suara: true },
                id: Date.now() + i
             };

             await addDoc(collection(db, "soal"), finalData);
             successCount++;
          }
          alert(`✅ Import Berhasil! ${successCount} Soal telah ditambahkan ke ujian ini.`);
       } catch (error) {
          alert("❌ Terjadi kesalahan saat membaca file CSV.");
       } finally {
          setIsSaving(false);
          e.target.value = null; // Reset input file
       }
    };
    reader.readAsText(file);
  };

  const tambahSiswaManual = async (e) => {
     e.preventDefault();
     const namaInput = e.target.namaSiswa.value.trim();
     const emailInput = e.target.emailSiswa.value.trim().toLowerCase();
     
     if(!namaInput || !emailInput || !kelasAktif) return;

     try {
        await setDoc(doc(db, "anggota", `${kelasAktif}_${emailInput}`), {
           kodeHalaqah: kelasAktif,
           email: emailInput,
           nama: namaInput,
           waktuGabung: Date.now(),
           ditambahkanManual: true
        }, { merge: true });
        
        alert(`✅ Siswa atas nama ${namaInput} berhasil ditambahkan secara manual ke kelas ini!`);
        e.target.reset();
     } catch (err) {
        alert("Gagal menambahkan siswa manual.");
     }
  };

  const keluarkanSiswa = async (emailSiswa) => {
     if(window.confirm(`Keluarkan ${emailSiswa} dari kelas ini?\n\nSiswa tersebut masih bisa masuk kembali dengan mengetik Kode Kelas Anda.`)) {
        try {
           await deleteDoc(doc(db, "anggota", `${kelasAktif}_${emailSiswa.toLowerCase()}`));
           alert("✅ Siswa berhasil dikeluarkan dari absensi kelas.");
        } catch(e) { 
           alert("Gagal mengeluarkan siswa."); 
        }
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
           await updateDoc(doc(db, "ujian", editUjianId), {
              ...formUjian, 
              kodeHalaqah: kelasAktif, 
              emailGuru: emailAdmin
           });
           alert("✅ Jadwal Ujian Berhasil Diupdate!");
           setEditUjianId(null);
        } else {
           const docRef = await addDoc(collection(db, "ujian"), {
              ...formUjian, 
              kodeHalaqah: kelasAktif, 
              emailGuru: emailAdmin
           });
           setUjianAktifAdmin(docRef.id);
           alert("✅ Jadwal Ujian Berhasil Dibuat!");
        }
        setFormUjian({ judul: '', durasi: 60, waktuMulai: '', waktuSelesai: '', tipeTarget: 'semua', targetSiswa: '', kunciLayar: false, poinBenar: 10 });
     } catch(err) { 
        alert("❌ Gagal menyimpan ujian."); 
     }
  };

  const editUjian = (ujian) => {
     setFormUjian({
        judul: ujian.judul || '', 
        durasi: ujian.durasi || 60, 
        waktuMulai: ujian.waktuMulai || '', 
        waktuSelesai: ujian.waktuSelesai || '',
        tipeTarget: ujian.tipeTarget || 'semua', 
        targetSiswa: ujian.targetSiswa || '', 
        kunciLayar: ujian.kunciLayar || false, 
        poinBenar: ujian.poinBenar || 10
     });
     setEditUjianId(ujian.docId);
  };

  const hapusUjian = async (docId) => {
     if(window.confirm("⚠️ YAKIN HAPUS UJIAN INI?\nSemua soal di dalamnya akan terputus dari jadwal!")) {
        await deleteDoc(doc(db, "ujian", docId));
        if(editUjianId === docId) {
           setEditUjianId(null);
           setFormUjian({ judul: '', durasi: 60, waktuMulai: '', waktuSelesai: '', tipeTarget: 'semua', targetSiswa: '', kunciLayar: false, poinBenar: 10 });
        }
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

  const handleChange = (e) => {
     setForm({ ...form, [e.target.name]: e.target.value });
  };

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
        const scaleSize = 400 / img.width;
        canvas.width = 400; 
        canvas.height = img.height * scaleSize;
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
        canvas.width = 400; 
        canvas.height = img.height * scaleSize;
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
      adminMediaRecorder.current.ondataavailable = (e) => { 
         if (e.data.size > 0) adminAudioChunks.current.push(e.data); 
      };
      adminMediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(adminAudioChunks.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => setForm({ ...form, mediaSoalSuara: reader.result });
        reader.readAsDataURL(audioBlob);
        adminAudioChunks.current = []; 
      };
      adminMediaRecorder.current.start();
      setIsRecordingAdmin(true);
    } catch (err) { 
       alert("Akses Mikrofon ditolak."); 
    }
  };

  const stopRecordingAdmin = () => { 
     if (adminMediaRecorder.current) { 
        adminMediaRecorder.current.stop(); 
        setIsRecordingAdmin(false); 
     } 
  };

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
      if (editId) {
         await updateDoc(doc(db, "soal", editId), finalData);
      } else {
         await addDoc(collection(db, "soal"), { ...finalData, id: Date.now() });
      }
      
      setForm(prev => ({ 
         ...prev, 
         teksSoal: '', 
         teksTambahanArab: '', 
         opsiA: '', 
         opsiB: '', 
         opsiC: '', 
         opsiD: '', 
         opsiE: '', 
         kunci: prev.tipe.includes('pilihan_ganda') ? [] : '', 
         mediaSoalGambar: null, 
         mediaSoalSuara: null 
      }));
      setEditId(null);
    } catch (error) { 
       alert("❌ Gagal Simpan."); 
    } finally { 
       setIsSaving(false); 
    }
  };

  const editSoal = (soal) => { 
     setForm(soal); 
     setEditId(soal.docId); 
     window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };
  
  const salinSoal = (soal) => {
     setForm({
        tipe: soal.tipe, 
        bahasa: soal.bahasa, 
        jumlahOpsi: soal.jumlahOpsi,
        teksSoal: soal.teksSoal, 
        teksTambahanArab: soal.teksTambahanArab || '',
        opsiA: soal.opsiA || '', 
        opsiB: soal.opsiB || '', 
        opsiC: soal.opsiC || '', 
        opsiD: soal.opsiD || '', 
        opsiE: soal.opsiE || '',
        kunci: soal.kunci, 
        mediaSoalGambar: soal.mediaSoalGambar || null, 
        mediaSoalSuara: soal.mediaSoalSuara || null,
        izinUraian: soal.izinUraian || { teks: true, gambar: true, suara: true }
     });
     setEditId(null); 
     window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hapusSoal = async (docId) => { 
     if(window.confirm("Hapus soal permanen?")) {
        await deleteDoc(doc(db, "soal", docId)); 
     }
  };
  
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
    } catch(e) { 
       alert("Gagal update."); 
    }
  };

  const hapusSetoran = async (docId) => { 
     if(window.confirm("Hapus hasil ujian murid ini?")) { 
        await deleteDoc(doc(db, "setoran", docId)); 
        if(setoranTerpilih && setoranTerpilih.docId === docId) setSetoranTerpilih(null); 
     } 
  };

  const hapusSemuaSetoran = async () => { 
     if(window.confirm("⚠️ Hapus SELURUH data evaluasi di ujian ini?")) { 
        for (const s of setoranTampil) { 
           await deleteDoc(doc(db, "setoran", s.docId)); 
        } 
        setSetoranTerpilih(null); 
        alert("Bersih."); 
     } 
  };

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
        kodeHalaqah: kelasAktif, 
        nama: 'Guru Pengajar', 
        email: emailAdmin, 
        peran: 'guru',
        teks: pesanText, 
        gambar: gambarUploadForum, 
        waktu: Date.now(),
        waktuTampil: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      });
      setPesanText(''); 
      setGambarUploadForum(null);
    } catch (err) { 
       alert("Gagal mengirim."); 
    }
  };

  const hapusPesanForum = async (docId) => { 
     if(window.confirm("Hapus pesan ini?")) {
        await deleteDoc(doc(db, "forum", docId)); 
     }
  };

  const simpanEditForum = async (docId) => {
     if(!teksEditForum.trim()) return;
     try { 
        await updateDoc(doc(db, "forum", docId), { teks: teksEditForum }); 
        setEditForumId(null); 
     } catch(e) { 
        alert("Gagal mengedit."); 
     }
  };

  return (
    <div className="p-4 md:p-8 font-sans max-w-7xl mx-auto pb-32">
      
      {/* CSS KHUSUS UNTUK PRINT WORD */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .teks-arab-besar { font-size: 18pt !important; line-height: 2 !important; }
        }
      `}</style>

      {/* MODAL QR CODE HALAQAH */}
      {qrHalaqah && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full relative">
               <button onClick={() => setQrHalaqah(null)} className="absolute top-4 right-4 bg-red-100 text-red-600 hover:bg-red-500 hover:text-white w-8 h-8 rounded-full font-bold transition-colors">✕</button>
               <h3 className="text-xl font-black mb-1 text-slate-800 dark:text-white">QR Code Kelas</h3>
               <p className="text-sm font-bold text-slate-500 mb-6 text-center">{qrHalaqah.nama} ({qrHalaqah.kode})</p>
               <div className="bg-white p-4 rounded-2xl shadow-inner border-4 border-indigo-100 mb-6">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(window.location.origin + window.location.pathname + '?kelas=' + qrHalaqah.kode)}`} alt="QR Code" className="w-48 h-48 md:w-56 md:h-56" />
               </div>
               <p className="text-xs text-slate-400 text-center font-medium">Tampilkan ini di layar proyektor kelas atau bagikan gambarnya ke murid Anda.</p>
            </div>
         </div>
      )}

      {/* NAVBAR ADMIN */}
      <div className={`p-4 rounded-3xl mb-6 shadow-md flex flex-wrap justify-between items-center transition-colors no-print ${isSuperAdmin ? 'bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-900 dark:to-indigo-900' : 'bg-indigo-600 dark:bg-indigo-900'}`}>
         <div>
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">{isSuperAdmin ? '👑 PANEL SUPER ADMIN' : 'Ruang Kerja Eksklusif Guru'}</p>
            <p className="font-black text-lg text-white">{emailAdmin}</p>
         </div>
         <button onClick={keLogin} className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all">🚪 Log Out</button>
      </div>

      {/* MENU TAB ADMIN */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 border-b border-slate-200 dark:border-slate-700 no-print transition-colors">
          <button onClick={() => {setTabAdmin('buat'); setSetoranTerpilih(null);}} className={`px-4 py-2 font-bold rounded-lg text-sm shrink-0 transition-all ${tabAdmin === 'buat' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>➕ Buat Jadwal & Soal</button>
          <button onClick={() => {setTabAdmin('forum'); setSetoranTerpilih(null);}} className={`px-4 py-2 font-bold rounded-lg text-sm shrink-0 transition-all ${tabAdmin === 'forum' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>💬 Forum Kelas</button>
          <button onClick={() => {setTabAdmin('koreksi'); setSetoranTerpilih(null);}} className={`px-4 py-2 font-bold rounded-lg text-sm shrink-0 transition-all ${tabAdmin === 'koreksi' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>✅ Evaluasi ({setoranTampil.length})</button>
          <button onClick={() => {setTabAdmin('rapor'); setSetoranTerpilih(null);}} className={`px-4 py-2 font-bold rounded-lg text-sm shrink-0 transition-all ${tabAdmin === 'rapor' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>📊 Data Siswa & Rapor</button>
          <button onClick={() => {setTabAdmin('peringkat'); setSetoranTerpilih(null);}} className={`px-4 py-2 font-bold rounded-lg text-sm shrink-0 transition-all ${tabAdmin === 'peringkat' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>🏆 Peringkat</button>
          {isSuperAdmin && (
             <button onClick={() => {setTabAdmin('guru'); setSetoranTerpilih(null);}} className={`px-4 py-2 font-bold rounded-lg text-sm shrink-0 transition-all ${tabAdmin === 'guru' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>👥 Kelola Guru</button>
          )}
      </div>

      <div className="no-print">
         {/* PILIHAN KELAS UMUM */}
         {halaqahMilikGuru.length > 0 && tabAdmin !== 'guru' && (
            <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800 mb-6 flex flex-wrap gap-4 transition-colors">
               <div className="flex-1 min-w-[200px]">
                  <label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-1">1. Pilih Kelas / Halaqah:</label>
                  <select value={kelasAktif} onChange={(e) => setKelasAktif(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-700 text-indigo-800 dark:text-white font-bold text-sm rounded-xl outline-none focus:ring-2 ring-indigo-400 cursor-pointer shadow-sm border border-slate-200 dark:border-slate-600">
                     {halaqahMilikGuru.map(h => <option key={h.kode} value={h.kode}>{h.nama} ({h.kode})</option>)}
                  </select>
               </div>
               {tabAdmin !== 'forum' && tabAdmin !== 'rapor' && tabAdmin !== 'peringkat' && (
               <div className="flex-1 min-w-[200px]">
                  <label className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest block mb-1">2. Pilih Jadwal Ujian:</label>
                  <select value={ujianAktifAdmin} onChange={(e) => setUjianAktifAdmin(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-700 text-orange-800 dark:text-white font-bold text-sm rounded-xl outline-none focus:ring-2 ring-orange-400 cursor-pointer shadow-sm border border-slate-200 dark:border-slate-600">
                     {ujianKelasIni.length === 0 ? <option value="">-- Buat Jadwal Ujian Dulu --</option> : ujianKelasIni.map(u => <option key={u.docId} value={u.docId}>{u.judul}</option>)}
                  </select>
               </div>
               )}
            </div>
         )}

         {halaqahMilikGuru.length === 0 && tabAdmin !== 'buat' && tabAdmin !== 'guru' && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-8 text-center rounded-3xl font-bold border-2 border-dashed border-red-200 dark:border-red-800">
               🚨 Anda belum membuat Kelas (Halaqah) apapun. Silakan masuk ke tab "➕ Buat Jadwal & Kelas".
            </div>
         )}

         {/* -------------------- TAB PERINGKAT -------------------- */}
         {tabAdmin === 'peringkat' && halaqahMilikGuru.length > 0 && (
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 min-h-[50vh] transition-colors">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
                  <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">🏆 Papan Peringkat Kelas</h2>
               </div>
               
               {rekapRapor.length === 0 ? (
                  <p className="text-center text-slate-400 dark:text-slate-500 italic py-10 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
                     Belum ada data siswa di kelas ini.
                  </p>
               ) : (
                  <div className="space-y-3">
                     {rekapRapor.map((m, idx) => (
                        <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:border-yellow-300 dark:hover:border-yellow-500 transition-all">
                           <div className="flex items-center gap-4">
                              <span className="text-3xl drop-shadow-sm">
                                 {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : <span className="w-8 h-8 flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-full text-sm font-black">{idx+1}</span>}
                              </span>
                              <div>
                                 <p className="font-bold text-slate-800 dark:text-white">{m.nama}</p>
                                 <p className="text-[10px] text-slate-400">{m.email}</p>
                              </div>
                           </div>
                           <span className="text-2xl font-black text-emerald-500">{m.totalSkor}</span>
                        </div>
                     ))}
                  </div>
               )}
            </div>
         )}

         {/* -------------------- TAB KELOLA GURU -------------------- */}
         {tabAdmin === 'guru' && isSuperAdmin && (
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 min-h-[50vh] transition-colors">
               <div className="max-w-2xl mx-auto">
                  <div className="text-center mb-8">
                     <span className="text-5xl block mb-2">🔐</span>
                     <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Otorisasi Guru Admin</h2>
                     <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Daftarkan email guru di bawah ini agar mereka diizinkan masuk ke panel admin.</p>
                  </div>
                  <form onSubmit={tambahGuru} className="flex flex-col md:flex-row gap-3 mb-8">
                     <input name="emailGuru" type="email" placeholder="Contoh: guru1@gmail.com" required className="flex-1 p-4 bg-slate-50 dark:bg-slate-700 dark:text-white rounded-2xl outline-none font-bold text-sm border border-slate-200 dark:border-slate-600 focus:ring-2 ring-purple-400 transition-colors" />
                     <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-black px-6 py-4 rounded-2xl transition-colors shadow-lg active:scale-95 text-sm md:text-base">Daftarkan</button>
                  </form>
                  <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-3xl border border-slate-200 dark:border-slate-700">
                     <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 ml-2">Daftar Guru Terdaftar ({(pengaturan.daftarGuru || []).length})</p>
                     <div className="space-y-3">
                        {!(pengaturan.daftarGuru && pengaturan.daftarGuru.length > 0) ? (
                           <p className="text-center text-sm text-slate-400 font-medium py-4">Belum ada guru yang didaftarkan.</p>
                        ) : (
                           pengaturan.daftarGuru.map((email, idx) => (
                              <div key={idx} className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-slate-800 p-3 md:p-4 rounded-2xl border border-slate-100 dark:border-slate-600 shadow-sm transition-colors gap-3">
                                 <div className="flex items-center gap-3 overflow-hidden w-full md:w-auto">
                                    <div className="w-10 h-10 shrink-0 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center font-black text-lg">{email.charAt(0).toUpperCase()}</div>
                                    <p className="font-bold text-slate-700 dark:text-white truncate text-sm md:text-base">{email}</p>
                                 </div>
                                 <button onClick={() => hapusGuru(email)} className="text-xs font-bold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/30 px-4 py-2 rounded-lg transition-colors w-full md:w-auto">Cabut Akses</button>
                              </div>
                           ))
                        )}
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* -------------------- TAB RAPOR & DATA SISWA -------------------- */}
         {tabAdmin === 'rapor' && halaqahMilikGuru.length > 0 && (
            <div className="space-y-6">
               <div className="bg-teal-50 dark:bg-teal-900/20 p-6 rounded-[2rem] border border-teal-200 dark:border-teal-800 transition-colors">
                  <h3 className="text-teal-700 dark:text-teal-400 font-black mb-3">➕ Tambah Siswa Manual</h3>
                  <p className="text-xs text-teal-600 dark:text-teal-500 mb-4">Gunakan fitur ini jika ada murid yang kesulitan mendaftar mandiri. Masukkan namanya agar langsung masuk ke Buku Rapor & Daftar Target Ujian.</p>
                  <form onSubmit={tambahSiswaManual} className="flex flex-col md:flex-row gap-3">
                     <input name="namaSiswa" placeholder="Nama Lengkap Siswa" required className="flex-1 p-3 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl outline-none font-bold text-sm border border-teal-200 dark:border-teal-700 focus:ring-2 ring-teal-400" />
                     <input name="emailSiswa" type="email" placeholder="Email Google Siswa" required className="flex-1 p-3 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl outline-none font-bold text-sm border border-teal-200 dark:border-teal-700 focus:ring-2 ring-teal-400" />
                     <button type="submit" className="bg-teal-600 hover:bg-teal-500 text-white font-black px-6 py-3 rounded-xl transition-colors shadow-sm">Daftarkan</button>
                  </form>
               </div>

               <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                     <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white tracking-tight">📊 Buku Rapor & Daftar Siswa Aktif</h2>
                     <button onClick={unduhExcel} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-colors whitespace-nowrap w-full md:w-auto">📥 Unduh Data (CSV)</button>
                  </div>
                  
                  <div className="overflow-x-auto pb-4 custom-scrollbar">
                     <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
                        <thead>
                           <tr className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-xs uppercase tracking-widest border-b-2 border-slate-200 dark:border-slate-600">
                              <th className="p-4 font-black rounded-tl-xl">No</th>
                              <th className="p-4 font-black sticky left-0 bg-slate-100 dark:bg-slate-700 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Nama Siswa</th>
                              <th className="p-4 font-black border-r border-slate-200 dark:border-slate-600">Email (ID)</th>
                              {ujianKelasIni.map((u, i) => (
                                 <th key={i} className="p-4 font-black text-center text-indigo-600 dark:text-indigo-400">{u.judul}</th>
                              ))}
                              <th className="p-4 font-black text-center text-emerald-600 dark:text-emerald-400 border-l border-slate-200 dark:border-slate-600">Skor Total</th>
                              <th className="p-4 font-black text-center rounded-tr-xl text-red-500">Aksi</th>
                           </tr>
                        </thead>
                        <tbody>
                           {rekapRapor.length === 0 ? (
                              <tr>
                                 <td colSpan={5 + ujianKelasIni.length} className="p-8 text-center text-slate-400 italic">Belum ada murid yang bergabung di kelas ini.</td>
                              </tr>
                           ) : (
                              rekapRapor.map((siswa, idx) => (
                                 <tr key={idx} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                                    <td className="p-4 font-bold text-slate-400">{idx + 1}</td>
                                    <td className="p-4 font-black text-slate-800 dark:text-white sticky left-0 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                                       {siswa.nama} {idx===0 && <span className="text-lg ml-1">🥇</span>} {idx===1 && <span className="text-lg ml-1">🥈</span>} {idx===2 && <span className="text-lg ml-1">🥉</span>}
                                    </td>
                                    <td className="p-4 text-xs font-bold text-slate-500 border-r border-slate-100 dark:border-slate-700">{siswa.email}</td>
                                    {ujianKelasIni.map((u, i) => (
                                       <td key={i} className="p-4 font-bold text-center text-slate-700 dark:text-slate-300">{siswa.nilaiPerUjian[u.docId] > 0 ? siswa.nilaiPerUjian[u.docId] : '-'}</td>
                                    ))}
                                    <td className="p-4 font-black text-center text-emerald-500 text-lg border-l border-slate-100 dark:border-slate-700 bg-emerald-50/50 dark:bg-emerald-900/10">{siswa.totalSkor}</td>
                                    <td className="p-4 text-center">
                                       <div className="flex gap-2 justify-center">
                                          <button onClick={() => keluarkanSiswa(siswa.email)} className="bg-orange-100 text-orange-600 hover:bg-orange-500 hover:text-white text-[10px] font-bold px-3 py-2 rounded-lg transition-colors">Keluarkan</button>
                                          <button onClick={() => blokirAkun(siswa.email)} className="bg-red-100 text-red-600 hover:bg-red-500 hover:text-white text-[10px] font-bold px-3 py-2 rounded-lg transition-colors">Blokir Permanen</button>
                                       </div>
                                    </td>
                                 </tr>
                              ))
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>

               {daftarBlokirAman.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 p-6 rounded-3xl">
                     <h3 className="text-red-600 dark:text-red-400 font-black mb-3">⛔ Daftar Akun Murid yang Diblokir</h3>
                     <div className="flex flex-wrap gap-3">
                        {daftarBlokirAman.map((email, idx) => (
                           <div key={idx} className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/50 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm">
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{email}</span>
                              <button onClick={() => bukaBlokir(email)} className="text-[10px] font-black bg-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white px-2 py-1 rounded">Buka Blokir</button>
                           </div>
                        ))}
                     </div>
                  </div>
               )}
            </div>
         )}

         {/* -------------------- TAB FORUM -------------------- */}
         {tabAdmin === 'forum' && halaqahMilikGuru.length > 0 && (
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 h-[80vh] flex flex-col transition-colors">
               <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 p-4 md:p-6 rounded-2xl overflow-y-auto custom-scrollbar border border-slate-100 dark:border-slate-700 mb-4 flex flex-col gap-4" ref={scrollRef}>
                  {semuaPesan.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                        <span className="text-5xl mb-4 block">💬</span>
                        <p className="font-bold text-sm">Belum ada diskusi dari murid di kelas ini.</p>
                     </div>
                  ) : (
                     semuaPesan.map((pesan, idx) => {
                        const isGuru = pesan.peran === 'guru';
                        const isSaya = isGuru && pesan.email === emailAdmin;
                        let bubbleStyle = isGuru ? 'bg-gradient-to-br from-amber-100 to-yellow-300 dark:from-yellow-600 dark:to-amber-700 text-slate-900 dark:text-white font-medium rounded-tr-sm border-2 border-yellow-400 dark:border-yellow-500 shadow-md' : 'bg-white dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 rounded-tl-sm shadow-sm';

                        return (
                           <div key={idx} className={`flex flex-col max-w-[80%] ${isGuru ? 'self-end items-end ml-auto' : 'self-start items-start'}`}>
                              <div className="flex items-center gap-2 mb-1 mx-2">
                                 <div className="flex gap-1">
                                    {isSaya && <button onClick={() => {setEditForumId(pesan.docId); setTeksEditForum(pesan.teks);}} className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-yellow-200 px-1.5 py-0.5 rounded">✏️</button>}
                                    <button onClick={() => hapusPesanForum(pesan.docId)} className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 px-1.5 py-0.5 rounded">🗑️ Hapus</button>
                                 </div>
                                 <span className={`text-[10px] font-bold ${isGuru ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                                    {isGuru ? 'Anda (Guru)' : pesan.nama} • {pesan.waktuTampil}
                                 </span>
                              </div>

                              <div className={`p-3 md:p-4 rounded-3xl text-sm whitespace-pre-wrap break-words w-full ${bubbleStyle}`}>
                                 {pesan.gambar && <img src={pesan.gambar} className="max-w-[200px] w-full rounded-xl mb-3 border border-white/30 shadow-sm" alt="Lampiran" />}
                                 {editForumId === pesan.docId ? (
                                    <div className="flex flex-col gap-2 mt-1">
                                       <textarea value={teksEditForum} onChange={(e) => setTeksEditForum(e.target.value)} className="w-full text-slate-800 p-2 rounded-xl text-sm outline-none" rows="2" />
                                       <div className="flex justify-end gap-2">
                                          <button onClick={() => setEditForumId(null)} className="text-xs bg-slate-300 text-slate-700 px-3 py-1 rounded-lg font-bold">Batal</button>
                                          <button onClick={() => simpanEditForum(pesan.docId)} className="text-xs bg-emerald-500 text-white px-3 py-1 rounded-lg font-bold">Simpan</button>
                                       </div>
                                    </div>
                                 ) : ( formatTeksDenganLink(pesan.teks) )}
                              </div>
                           </div>
                        )
                     })
                  )}
               </div>
               <div className="shrink-0 relative">
                  {gambarUploadForum && (
                     <div className="mb-3 absolute bottom-full left-0 z-10 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg">
                        <button onClick={() => setGambarUploadForum(null)} className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full font-bold text-xs shadow-md">✕</button>
                        <img src={gambarUploadForum} className="h-20 rounded border border-slate-200" alt="Preview" />
                     </div>
                  )}
                  <form onSubmit={kirimPesanGuru} className="flex gap-2 items-center relative w-full">
                     <label className="shrink-0 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 w-12 h-12 md:w-14 md:h-14 rounded-2xl cursor-pointer transition-colors shadow-inner flex items-center justify-center text-xl">
                        📸<input type="file" accept="image/*" className="hidden" onChange={handleUploadGambarForum} />
                     </label>
                     <input type="text" value={pesanText} onChange={(e) => setPesanText(e.target.value)} placeholder="Tulis pengumuman atau paste Link di sini..." className="flex-1 min-w-0 p-3 md:p-4 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-white rounded-2xl outline-none font-bold border border-transparent dark:border-slate-700 focus:ring-2 ring-emerald-400 text-sm md:text-base" />
                     <button type="submit" className="shrink-0 bg-emerald-600 text-white w-12 h-12 md:w-14 md:h-14 rounded-2xl font-black shadow-lg hover:bg-emerald-500 active:scale-95 transition-all flex items-center justify-center text-xl">➤</button>
                  </form>
               </div>
            </div>
         )}

         {/* -------------------- TAB EVALUASI / KOREKSI -------------------- */}
         {tabAdmin === 'koreksi' && halaqahMilikGuru.length > 0 && (
            <div className="bg-white dark:bg-slate-800 p-4 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 min-h-[50vh] transition-colors">
               {!setoranTerpilih ? (
                  <>
                     <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-100 dark:border-slate-700 pb-4 transition-colors">
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Evaluasi Jawaban Murid</h2>
                        {setoranTampil.length > 0 && (
                           <button onClick={hapusSemuaSetoran} className="text-xs font-bold bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800 px-4 py-2 rounded-xl hover:bg-red-500 hover:text-white transition-colors">🗑️ Bersihkan Semua Data</button>
                        )}
                     </div>

                     {setoranTampil.length === 0 ? <div className="text-center py-20 text-slate-400 font-bold border-4 border-dashed dark:border-slate-700 rounded-3xl">Belum ada setoran di ujian ini.</div> : (
                        <div className="grid gap-3">
                           {setoranTampil.map((s) => (
                              <div key={s.docId} className="flex flex-col md:flex-row items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl hover:border-indigo-300 transition-all shadow-sm gap-4">
                                 <div className="flex items-center gap-4 w-full md:w-auto">
                                    <div className="bg-white dark:bg-slate-800 border-2 border-indigo-100 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 font-black text-2xl w-14 h-14 flex flex-col items-center justify-center rounded-2xl shadow-sm leading-none transition-colors">
                                       {s.nilaiSistem}<span className="text-[8px] text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Skor</span>
                                    </div>
                                    <div>
                                       <h3 className="font-black text-slate-800 dark:text-white text-lg leading-tight">{s.nama}</h3>
                                       <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-1">Email: {s.email.split('@')[0]} • ⏱️ {formatWaktuTampil(s.waktuPengerjaan)}</p>
                                    </div>
                                 </div>
                                 <div className="flex gap-2 w-full md:w-auto">
                                    <button onClick={() => bukaEvaluasi(s)} className="flex-1 md:flex-none bg-indigo-500 text-white font-bold text-xs px-6 py-3 rounded-xl hover:bg-indigo-600 transition-colors shadow-sm">Review & Beri Nilai</button>
                                    <button onClick={() => hapusSetoran(s.docId)} className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/50 text-red-500 dark:text-red-400 font-bold px-4 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">🗑️</button>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </>
               ) : (
                  <div>
                     <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md p-4 border-b-2 border-slate-200 dark:border-slate-700 mb-6 flex flex-wrap justify-between items-center gap-4 rounded-b-2xl shadow-sm transition-colors">
                        <div>
                           <button onClick={() => setSetoranTerpilih(null)} className="text-sm font-bold text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 mb-1 block transition-colors">← Kembali ke Daftar</button>
                           <h2 className="text-xl font-black text-slate-800 dark:text-white leading-none">{setoranTerpilih.nama}</h2>
                           <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Halaqah {setoranTerpilih.halaqah}</p>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 rounded-2xl flex items-center gap-3 shadow-inner transition-colors">
                           <div>
                              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block mb-1">Skor Total Akhir</span>
                              <input type="number" value={nilaiManual} onChange={(e) => setNilaiManual(e.target.value)} className="w-24 p-2 bg-white dark:bg-slate-700 dark:text-white rounded-lg text-xl font-black text-center border border-emerald-200 dark:border-emerald-700 outline-none focus:ring-2 ring-emerald-400 transition-colors" />
                           </div>
                           <button onClick={simpanNilaiManual} className="bg-emerald-500 text-white font-black text-xs px-4 py-3 rounded-xl hover:bg-emerald-600 shadow-md active:translate-y-1 transition-all">SIMPAN<br/>NILAI</button>
                        </div>
                     </div>

                     <div className="space-y-6">
                        {soalTampil.map((soal, index) => {
                           const jawabanMurid = setoranTerpilih.jawaban?.[index];
                           
                           if (soal.tipe === 'uraian') {
                              const jwb = jawabanMurid || {};
                              return (
                                 <div key={index} className="p-5 rounded-2xl border-2 border-purple-100 dark:border-purple-900/50 bg-purple-50/30 dark:bg-purple-900/10 transition-colors">
                                    <div className="flex justify-between items-start mb-3">
                                       <span className="text-[10px] font-black bg-purple-200 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400 px-2 py-1 rounded uppercase">Soal {index+1} (Uraian Bebas)</span>
                                    </div>
                                    
                                    <div className="mb-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-purple-100 dark:border-purple-900/50 shadow-sm transition-colors">
                                       <p className="font-bold text-slate-700 dark:text-white mb-3">{renderTeks(soal.teksSoal)}</p>
                                       {soal.teksTambahanArab && <p className="teks-arab-besar text-right text-indigo-900 dark:text-indigo-300 mb-3" dir="rtl">{soal.teksTambahanArab}</p>}
                                       {soal.mediaSoalGambar && <img src={soal.mediaSoalGambar} className="h-20 rounded border dark:border-slate-600 mb-2" />}
                                       {soal.mediaSoalSuara && <audio controls src={soal.mediaSoalSuara} className="h-8" />}
                                    </div>
                                    
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-4 transition-colors">
                                       <span className="text-[10px] font-black text-slate-400 uppercase block mb-2 border-b dark:border-slate-700 pb-1">Setoran Jawaban Siswa:</span>
                                       {jwb.teks ? <p className="font-bold text-indigo-700 dark:text-indigo-400 mb-2 whitespace-pre-wrap">{jwb.teks}</p> : <p className="text-xs text-slate-300 dark:text-slate-500 italic mb-2">Tidak ada teks</p>}
                                       {jwb.gambar && <img src={jwb.gambar} className="max-w-xs rounded-xl border-2 border-slate-200 dark:border-slate-600 mb-2" />}
                                       {jwb.suara && <audio controls src={jwb.suara} className="w-full h-10" />}
                                       {!jwb.teks && !jwb.gambar && !jwb.suara && <p className="text-red-400 font-bold text-sm">Siswa tidak menjawab soal ini.</p>}
                                    </div>

                                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl flex items-center justify-between shadow-inner transition-colors">
                                       <div>
                                          <p className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest">Beri Poin Soal Ini:</p>
                                       </div>
                                       <div className="flex items-center gap-2">
                                          <span className="text-xl font-black text-orange-500">+</span>
                                          <input type="number" value={skorPerSoal[index] || ''} onChange={(e) => ubahSkorPerSoal(index, e.target.value)} className="w-20 p-2 font-black text-center rounded-lg border border-orange-300 dark:border-orange-700 outline-none focus:ring-2 ring-orange-500 text-lg text-slate-700 dark:text-white dark:bg-slate-700 transition-colors" placeholder="0" />
                                       </div>
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
                              <div key={index} className={`p-5 rounded-2xl border-2 transition-colors ${isBenar ? 'border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-red-100 dark:border-red-900/50 bg-red-50/30 dark:bg-red-900/10'}`}>
                                 <div className="flex justify-between items-start mb-3">
                                    <span className="text-[10px] font-black bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded uppercase">Soal {index + 1}</span>
                                    {isBenar ? <span className="text-xl">✅</span> : <span className="text-xl">❌</span>}
                                 </div>
                                 
                                 <div className={soal.bahasa === 'ar' ? 'text-right' : 'text-left'} dir={soal.bahasa === 'ar' ? 'rtl' : 'ltr'}>
                                    <p className="font-bold text-slate-700 dark:text-white text-base">{renderTeks(soal.teksSoal)}</p>
                                    {soal.teksTambahanArab && <p className="teks-arab-besar text-right text-indigo-900 dark:text-indigo-300 mt-2" dir="rtl">{soal.teksTambahanArab}</p>}
                                    {soal.mediaSoalGambar && <img src={soal.mediaSoalGambar} className="h-20 mt-2 rounded border dark:border-slate-600" />}
                                    {soal.mediaSoalSuara && <audio controls src={soal.mediaSoalSuara} className="h-8 mt-2" />}
                                 </div>
                                 
                                 <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors">
                                       <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Jawaban Murid:</span>
                                       <span className={`font-bold ${isBenar ? 'text-emerald-600' : 'text-red-500'}`} dir={soal.bahasa === 'ar' ? 'rtl' : 'ltr'}>
                                          {jawabanMuridArray.length > 0 ? renderTeks(jawabanMuridArray.join(' | ')) : <i className="text-slate-300 dark:text-slate-600">Tidak dijawab</i>}
                                       </span>
                                    </div>
                                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors">
                                       <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Kunci Asli:</span>
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
               )}
            </div>
         )}

         {/* -------------------- TAB BUAT JADWAL & SOAL -------------------- */}
         {tabAdmin === 'buat' && (
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
             <div className="lg:col-span-5 space-y-6">
               
               <div className="bg-emerald-800 dark:bg-emerald-900 p-6 rounded-3xl shadow-lg border border-transparent dark:border-emerald-700 transition-colors">
                  <h2 className="text-sm font-black text-white mb-2">1. Buat Kelas (Halaqah) Baru</h2>
                  <form onSubmit={tambahHalaqahBaru} className="flex gap-2 mb-4">
                     <input name="namaHalaqah" placeholder="Ketik Nama Kelas..." required className="flex-1 p-3 bg-emerald-950 text-white rounded-xl outline-none font-bold text-sm border border-emerald-700 focus:border-emerald-400" />
                     <button type="submit" className="bg-emerald-500 text-white font-black px-4 rounded-xl hover:bg-emerald-400 transition-colors">+</button>
                  </form>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                     {halaqahMilikGuru.length === 0 ? (
                        <div className="text-center p-4 border border-dashed border-emerald-700 rounded-xl"><p className="text-xs text-emerald-400 font-bold">Belum ada kelas.</p></div>
                     ) : (
                        halaqahMilikGuru.map((h, i) => (
                          <div key={i} className="flex flex-col bg-emerald-950 p-3 rounded-xl border border-emerald-700">
                             <div className="flex justify-between items-center mb-2">
                                <p className="text-white font-bold text-xs">{h.nama}</p>
                                <button onClick={() => hapusHalaqah(h.kode)} className="text-emerald-400 hover:text-red-400 font-bold text-xs transition-colors">✕ Hapus</button>
                             </div>
                             <div className="flex items-center gap-2">
                                <div className="bg-emerald-900 text-emerald-400 font-mono tracking-widest font-black py-2 px-4 rounded-lg flex-1 text-center">{h.kode}</div>
                                <button onClick={() => setQrHalaqah(h)} className="bg-white/10 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-white/20 transition-colors" title="Tampilkan QR Code Kelas">📱 QR</button>
                                <button onClick={() => salinUndanganWA(h)} className="bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-blue-500 transition-colors">💬 Undangan</button>
                                <button onClick={() => salinKode(h.kode)} className="bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-emerald-400 transition-colors">📋 Salin</button>
                             </div>
                          </div>
                        ))
                     )}
                  </div>
               </div>

               <div className={`p-6 rounded-3xl shadow-lg border-2 transition-colors ${editUjianId ? 'bg-yellow-900 border-yellow-500' : 'bg-orange-800 dark:bg-orange-900 border-transparent dark:border-orange-700'}`}>
                  <div className="flex justify-between items-center mb-2">
                     <h2 className="text-sm font-black text-white">{editUjianId ? '✏️ Edit Jadwal Ujian' : '2. Jadwalkan Ujian untuk Kelas Aktif'}</h2>
                     {editUjianId && <button type="button" onClick={() => {setEditUjianId(null); setFormUjian({ judul: '', durasi: 60, waktuMulai: '', waktuSelesai: '', tipeTarget: 'semua', targetSiswa: '', kunciLayar: false, poinBenar: 10 });}} className="text-xs text-red-300 hover:text-red-100 underline">Batal Edit</button>}
                  </div>
                  
                  <form onSubmit={handleBuatUjian} className="space-y-3 mb-4">
                     <input type="text" value={formUjian.judul} onChange={e=>setFormUjian({...formUjian, judul: e.target.value})} placeholder="Judul Ujian (Cth: Ujian Akhir Semester)" required className={`w-full p-3 text-slate-900 dark:text-white rounded-xl outline-none font-bold text-sm border focus:ring-2 ${editUjianId ? 'bg-yellow-50 border-yellow-400 ring-yellow-500' : 'bg-orange-50 dark:bg-slate-700 border-orange-300 dark:border-slate-600 focus:border-orange-500'}`} />
                     
                     <div className="flex gap-2">
                        <div className="flex-1">
                           <label className={`text-[10px] font-bold uppercase mb-1 block ${editUjianId ? 'text-yellow-200' : 'text-orange-300'}`}>Waktu Mulai:</label>
                           <input type="datetime-local" value={formUjian.waktuMulai} onChange={e=>setFormUjian({...formUjian, waktuMulai: e.target.value})} required className={`w-full p-3 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl outline-none font-bold text-xs border cursor-pointer block dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:dark:invert ${editUjianId ? 'border-yellow-400 focus:ring-yellow-500' : 'border-orange-300 dark:border-slate-600 focus:ring-2 ring-orange-400'}`} />
                        </div>
                        <div className="flex-1">
                           <label className={`text-[10px] font-bold uppercase mb-1 block ${editUjianId ? 'text-yellow-200' : 'text-orange-300'}`}>Batas Selesai:</label>
                           <input type="datetime-local" value={formUjian.waktuSelesai} onChange={e=>setFormUjian({...formUjian, waktuSelesai: e.target.value})} required className={`w-full p-3 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl outline-none font-bold text-xs border cursor-pointer block dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:dark:invert ${editUjianId ? 'border-yellow-400 focus:ring-yellow-500' : 'border-orange-300 dark:border-slate-600 focus:ring-2 ring-orange-400'}`} />
                        </div>
                     </div>

                     <div className="flex gap-2 items-center pt-2">
                        <input type="number" value={formUjian.durasi} onChange={e=>setFormUjian({...formUjian, durasi: e.target.value})} min="1" required className={`w-16 md:w-20 p-3 text-slate-900 dark:text-white rounded-xl outline-none font-bold text-sm border text-center ${editUjianId ? 'bg-yellow-50 border-yellow-400' : 'bg-orange-50 dark:bg-slate-700 border-orange-300 dark:border-slate-600'}`} />
                        <span className={`text-[10px] md:text-xs font-bold ${editUjianId ? 'text-yellow-100' : 'text-orange-200'}`}>Menit</span>
                        <span className="text-white/50 px-1">|</span>
                        <input type="number" value={formUjian.poinBenar} onChange={e=>setFormUjian({...formUjian, poinBenar: e.target.value})} min="1" required className={`w-16 md:w-20 p-3 text-slate-900 dark:text-white rounded-xl outline-none font-bold text-sm border text-center ${editUjianId ? 'bg-yellow-50 border-yellow-400' : 'bg-orange-50 dark:bg-slate-700 border-orange-300 dark:border-slate-600'}`} />
                        <span className={`text-[10px] md:text-xs font-bold ${editUjianId ? 'text-yellow-100' : 'text-orange-200'}`}>Poin/Soal</span>
                     </div>

                     <div className={`p-4 rounded-xl border mt-2 ${editUjianId ? 'bg-yellow-950/50 border-yellow-600' : 'bg-orange-900/50 border-orange-700'}`}>
                        <label className={`text-[10px] font-bold uppercase mb-2 block ${editUjianId ? 'text-yellow-300' : 'text-orange-300'}`}>Target Murid (Kosongkan jika untuk semua):</label>
                        <select value={formUjian.tipeTarget} onChange={e => setFormUjian({...formUjian, tipeTarget: e.target.value, targetSiswa: ''})} className={`w-full p-3 mb-3 text-slate-900 dark:text-white rounded-xl outline-none font-bold text-sm border ${editUjianId ? 'bg-yellow-50 border-yellow-400' : 'bg-orange-50 dark:bg-slate-700 border-orange-300 dark:border-slate-600'}`}>
                           <option value="semua">Semua Murid di Kelas Ini</option>
                           <option value="khusus">Hanya Murid Tertentu (Pilih di bawah)</option>
                        </select>
                        
                        {formUjian.tipeTarget === 'khusus' && (
                           <div className="bg-black/20 p-3 rounded-xl border border-white/10 max-h-40 overflow-y-auto custom-scrollbar space-y-2">
                              {daftarSiswaUnik.length === 0 ? <p className="text-xs text-white/50 italic">Belum ada murid yang bergabung di kelas ini.</p> : daftarSiswaUnik.map(siswa => {
                                 const isChecked = formUjian.targetSiswa.includes(siswa.email);
                                 return (
                                    <label key={siswa.email} className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg cursor-pointer transition-colors">
                                       <input type="checkbox" checked={isChecked} onChange={(e) => {
                                          let arr = formUjian.targetSiswa ? formUjian.targetSiswa.split(',') : [];
                                          if (e.target.checked) arr.push(siswa.email);
                                          else arr = arr.filter(mail => mail !== siswa.email);
                                          setFormUjian({...formUjian, targetSiswa: arr.join(',')});
                                       }} className="w-4 h-4 accent-orange-500" />
                                       <div className="flex flex-col">
                                          <span className="text-sm font-bold text-white leading-tight">{siswa.nama}</span>
                                          <span className="text-[10px] text-white/60">{siswa.email}</span>
                                       </div>
                                    </label>
                                 )
                              })}
                           </div>
                        )}
                     </div>

                     <label className={`flex items-center gap-3 cursor-pointer mt-4 p-3 rounded-xl border border-dashed ${editUjianId ? 'bg-yellow-900/30 border-yellow-400' : 'bg-orange-900/30 border-orange-400'} hover:bg-black/20 transition-colors`}>
                        <input type="checkbox" checked={formUjian.kunciLayar || false} onChange={e=>setFormUjian({...formUjian, kunciLayar: e.target.checked})} className="w-5 h-5 accent-red-500 cursor-pointer" />
                        <div className="flex flex-col">
                           <span className={`text-xs font-black uppercase ${editUjianId ? 'text-yellow-100' : 'text-orange-100'}`}>🔒 Mode Ujian Ketat</span>
                           <span className={`text-[9px] font-medium ${editUjianId ? 'text-yellow-300' : 'text-orange-300'}`}>Kunci Fullscreen & Lacak Tab Keluar (Auto-Submit)</span>
                        </div>
                     </label>

                     <button type="submit" className={`w-full py-3 text-white font-black rounded-xl transition-colors text-sm shadow-md mt-4 ${editUjianId ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-orange-500 hover:bg-orange-400'}`}>
                        {editUjianId ? '🔄 Update Jadwal Ujian' : 'Buat Jadwal Ujian'}
                     </button>
                  </form>

                  <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                     {ujianKelasIni.length === 0 ? (
                        <div className="text-center p-3 border border-dashed border-orange-700 rounded-xl"><p className="text-xs text-orange-400 font-bold">Belum ada ujian di kelas ini.</p></div>
                     ) : (
                        ujianKelasIni.map((u, i) => (
                          <div key={i} className={`flex justify-between items-center p-3 rounded-xl border ${editUjianId === u.docId ? 'bg-yellow-950 border-yellow-400' : 'bg-orange-950 border-orange-700'}`}>
                             <div>
                                <div className="flex items-center gap-2">
                                   <p className="text-white font-bold text-xs">{u.judul}</p>
                                   {u.kunciLayar && <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Ketat</span>}
                                </div>
                                <p className={`text-[10px] ${editUjianId === u.docId ? 'text-yellow-400' : 'text-orange-400'}`}>{u.durasi} Mnt • Poin: {u.poinBenar || 10}</p>
                             </div>
                             <div className="flex gap-1 shrink-0">
                                <button onClick={() => editUjian(u)} className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500 hover:text-white font-bold text-[10px] px-2 py-1 rounded-lg transition-colors">Edit</button>
                                <button onClick={() => hapusUjian(u.docId)} className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white font-bold text-[10px] px-2 py-1 rounded-lg transition-colors">Hapus</button>
                             </div>
                          </div>
                        ))
                     )}
                  </div>
               </div>
             </div>

             <div className="lg:col-span-7 space-y-4">
               <div className={`bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border-2 h-fit transition-colors ${editId ? 'border-orange-400 dark:border-orange-500 bg-orange-50 dark:bg-orange-900/10' : 'border-slate-100 dark:border-slate-700'}`}>
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">{editId ? '✏️ Mode Edit' : '3. ➕ Masukkan Soal ke Ujian Aktif'}</h2>
                    {editId && (
                       <button onClick={() => {setEditId(null); setForm({...form, tipe: 'pilihan_ganda', teksSoal: ''})}} className="text-xs font-bold text-red-500 dark:text-red-400 underline">Batal Edit</button>
                    )}
                 </div>

                 {ujianKelasIni.length === 0 ? (
                    <div className="p-6 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 text-center rounded-2xl font-bold border-2 border-dashed border-orange-200 dark:border-orange-800">
                       Anda belum membuat Jadwal Ujian di kelas ini. Buat jadwal terlebih dahulu di panel sebelah kiri.
                    </div>
                 ) : (
                   <form onSubmit={handleSimpanSoal} className="space-y-4">
                     <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors">
                       <select name="tipe" value={form.tipe} onChange={handleChangeTipe} className="w-full p-2 bg-white dark:bg-slate-700 rounded-lg font-bold text-xs outline-none text-indigo-700 dark:text-indigo-300 border border-slate-200 dark:border-slate-600 focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors">
                         <option value="pilihan_ganda">1. Pilihan Ganda (1 Jawaban Benar)</option>
                         <option value="pilihan_ganda_kompleks">2. Ganda Kompleks (Bisa Lebih Dari 1 Benar)</option>
                         <option value="isian">3. Isian Singkat</option>
                         <option value="uraian">4. Uraian Bebas (Super-Soal)</option>
                       </select>
                     </div>
                     <select name="bahasa" value={form.bahasa} onChange={handleChange} className="w-full p-3 bg-white dark:bg-slate-700 dark:text-white rounded-xl font-bold text-xs outline-none border border-slate-200 dark:border-slate-700 focus:border-indigo-400 transition-colors">
                       <option value="id">🇮🇩 Latin</option><option value="ar">🇸🇦 Arab</option><option value="campuran">🔄 Campuran</option>
                     </select>

                     {/* 👈 FITUR IMPORT CSV DITAMBAHKAN DI SINI */}
                     {!editId && (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl transition-colors flex flex-col sm:flex-row gap-3 items-center justify-between shadow-sm">
                           <div>
                              <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">⚡ Import Soal Massal (Banyak Soal Sekaligus)</p>
                              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 font-medium">Download template, isi di Excel, lalu upload ke sini.</p>
                           </div>
                           <div className="flex gap-2 w-full sm:w-auto">
                              <button type="button" onClick={unduhTemplateCSV} className="flex-1 sm:flex-none text-[10px] bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 px-3 py-2 rounded-lg font-bold hover:bg-emerald-300 dark:hover:bg-emerald-700 transition-colors">📥 Download Template</button>
                              <label className="flex-1 sm:flex-none text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg font-bold cursor-pointer text-center shadow-md transition-colors">
                                 📤 Upload CSV <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
                              </label>
                           </div>
                        </div>
                     )}

                     <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-xl space-y-3 transition-colors">
                        <p className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase">Lampirkan Media Soal (Opsional):</p>
                        <div className="flex gap-2">
                           <label className="flex-1 text-center bg-purple-500 text-white py-2 rounded-lg font-bold text-xs cursor-pointer hover:bg-purple-600 shadow-sm transition-colors">📸 Foto <input type="file" accept="image/*" className="hidden" onChange={handleUploadGambarAdmin}/></label>
                           <button type="button" onClick={isRecordingAdmin ? stopRecordingAdmin : startRecordingAdmin} className={`flex-1 text-center py-2 rounded-lg font-bold text-xs transition-colors shadow-sm ${isRecordingAdmin ? 'bg-red-500 text-white animate-pulse' : 'bg-pink-500 text-white hover:bg-pink-600'}`}>
                              {isRecordingAdmin ? '⏹ Stop' : '🎤 Suara'}
                           </button>
                        </div>
                        {form.mediaSoalGambar && (
                           <div className="relative mt-2"><button type="button" onClick={() => setForm({...form, mediaSoalGambar: null})} className="absolute top-0 right-0 bg-red-500 text-white w-6 h-6 rounded-full font-bold text-xs shadow-md">✕</button><img src={form.mediaSoalGambar} className="w-full max-h-32 object-contain rounded-lg border bg-white dark:border-slate-700" /></div>
                        )}
                        {form.mediaSoalSuara && (
                           <div className="relative mt-2"><button type="button" onClick={() => setForm({...form, mediaSoalSuara: null})} className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full font-bold text-xs z-10 shadow-md">✕</button><audio controls src={form.mediaSoalSuara} className="w-full h-10 rounded-full shadow-sm" /></div>
                        )}
                     </div>

                     <textarea name="teksSoal" value={form.teksSoal} onChange={handleChange} placeholder="Ketik Pertanyaan..." rows="3" dir={form.bahasa === 'ar' ? 'rtl' : 'ltr'} className="w-full p-4 bg-white dark:bg-slate-700 dark:text-white rounded-2xl outline-none text-sm font-semibold border border-slate-200 dark:border-slate-700 focus:border-indigo-400 transition-colors" />
                     {(form.tipe === 'uraian' || form.bahasa === 'campuran') && (
                       <textarea name="teksTambahanArab" value={form.teksTambahanArab} onChange={handleChange} placeholder="Teks Arab Tambahan..." rows="2" dir="rtl" className="w-full p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl outline-none teks-arab-besar border border-indigo-100 dark:border-indigo-800 transition-colors" />
                     )}

                     {form.tipe === 'uraian' && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 transition-colors">
                           <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase mb-3">Siswa Boleh Menjawab Pakai:</p>
                           <div className="flex flex-wrap gap-4">
                              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.izinUraian?.teks ?? true} onChange={() => handleCheckboxUraian('teks')} className="w-4 h-4 accent-indigo-600" /><span className="text-sm font-bold text-slate-700 dark:text-slate-300">Teks ⌨️</span></label>
                              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.izinUraian?.gambar ?? true} onChange={() => handleCheckboxUraian('gambar')} className="w-4 h-4 accent-indigo-600" /><span className="text-sm font-bold text-slate-700 dark:text-slate-300">Gambar 📸</span></label>
                              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.izinUraian?.suara ?? true} onChange={() => handleCheckboxUraian('suara')} className="w-4 h-4 accent-indigo-600" /><span className="text-sm font-bold text-slate-700 dark:text-slate-300">Audio 🎤</span></label>
                           </div>
                        </div>
                     )}

                     {form.tipe.startsWith('pilihan_ganda') && (
                       <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl space-y-3 border border-slate-100 dark:border-slate-700 transition-colors">
                         <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500">JUMLAH OPSI</span>
                            <select name="jumlahOpsi" value={form.jumlahOpsi} onChange={handleChange} className="p-1 rounded bg-white dark:bg-slate-600 dark:text-white text-xs font-bold border dark:border-slate-600 outline-none"><option value="3">3 Opsi</option><option value="4">4 Opsi</option><option value="5">5 Opsi</option></select>
                         </div>

                         {['A', 'B', 'C', 'D', 'E'].slice(0, form.jumlahOpsi).map((label) => {
                           const isKunci = Array.isArray(form.kunci) ? form.kunci.includes(form[`opsi${label}`]) : form.kunci === form[`opsi${label}`];
                           return (
                             <div key={label} className="flex items-center gap-2">
                               <button type="button" onClick={() => toggleKunci(form[`opsi${label}`])} className={`w-10 h-10 rounded-lg font-black text-xs transition-all shadow-sm flex-shrink-0 ${isKunci && form[`opsi${label}`] ? 'bg-emerald-500 text-white border-b-4 border-emerald-700' : 'bg-white dark:bg-slate-600 text-slate-400 dark:text-slate-300 border border-slate-200 dark:border-slate-500 hover:border-indigo-300'}`}>{label}</button>
                               <input type="text" name={`opsi${label}`} value={form[`opsi${label}`]} onChange={handleChange} dir={form.bahasa === 'ar' ? 'rtl' : 'ltr'} className="flex-1 p-3 bg-white dark:bg-slate-600 dark:text-white rounded-xl outline-none text-sm border border-slate-100 dark:border-slate-600 font-medium focus:border-indigo-400 transition-colors" placeholder={`Opsi ${label}...`}/>
                             </div>
                           )
                         })}
                       </div>
                     )}

                     {form.tipe === 'isian' && (
                       <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800 transition-colors">
                         <label className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase mb-2 block">Kunci Jawaban Isian (Pisahkan dengan koma jika ada variasi jawaban)</label>
                         <input type="text" name="kunci" value={Array.isArray(form.kunci) ? '' : form.kunci} onChange={(e) => setForm({...form, kunci: e.target.value})} dir={form.bahasa === 'ar' ? 'rtl' : 'ltr'} className="w-full p-3 bg-white dark:bg-slate-700 dark:text-white rounded-xl outline-none font-bold text-slate-700 border border-emerald-200 dark:border-emerald-700 focus:ring-2 ring-emerald-400 transition-colors" placeholder="Contoh: 17 Agustus 1945, 17-8-1945, 17 agustus 45" />
                       </div>
                     )}

                     <button type="submit" disabled={isSaving} className={`w-full py-4 text-white font-black rounded-2xl border-b-4 transition-all shadow-lg ${isSaving ? 'bg-slate-400 border-slate-600' : (editId ? 'bg-orange-500 border-orange-700 hover:bg-orange-600' : 'bg-indigo-500 border-indigo-700 hover:bg-indigo-600')} active:border-b-0 active:translate-y-1`}>
                       {isSaving ? 'MENYIMPAN...' : (editId ? '🔄 UPDATE SOAL' : '💾 SIMPAN SOAL')}
                     </button>
                   </form>
                 )}
               </div>

               <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar space-y-4 mt-6">
                  <h2 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2">Bank Soal di Ujian Aktif ({soalTampil.length})</h2>
                  {soalTampil.length === 0 && <div className="bg-white dark:bg-slate-800 p-10 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center text-slate-400 font-medium transition-colors">Belum ada soal di ujian ini.</div>}
                  
                  {soalTampil.map((soal, idx) => (
                     <div key={soal.docId} className={`p-5 rounded-3xl border relative shadow-sm group transition-all ${editId === soal.docId ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-300 dark:border-orange-600' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                       <div className="absolute top-4 right-4 flex gap-2">
                          <button onClick={() => salinSoal(soal)} className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg font-bold text-sm hover:bg-blue-500 hover:text-white transition-colors" title="Salin Soal">📋</button>
                          <button onClick={() => editSoal(soal)} className="w-8 h-8 bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 rounded-lg font-bold text-sm hover:bg-orange-500 hover:text-white transition-colors">✏️</button>
                          <button onClick={() => hapusSoal(soal.docId)} className="w-8 h-8 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg font-bold text-sm hover:bg-red-50 hover:text-white transition-colors">🗑️</button>
                       </div>
                       <span className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase bg-indigo-50 dark:bg-indigo-900/40 px-3 py-1 rounded-full">Soal {idx+1} • {soal.tipe.replace(/_/g, ' ')}</span>
                       
                       {(soal.mediaSoalGambar || soal.mediaSoalSuara) && (
                          <div className="mt-4 flex gap-2">
                             {soal.mediaSoalGambar && <img src={soal.mediaSoalGambar} className="h-16 rounded border dark:border-slate-600" />}
                             {soal.mediaSoalSuara && <audio controls src={soal.mediaSoalSuara} className="h-10 mt-2" />}
                          </div>
                       )}

                       <div className={`mt-4 ${soal.bahasa === 'ar' ? 'text-right' : 'text-left'}`} dir={soal.bahasa === 'ar' ? 'rtl' : 'ltr'}>
                         <p className="font-bold text-slate-700 dark:text-white text-lg leading-relaxed">{renderTeks(soal.teksSoal)}</p>
                         {soal.teksTambahanArab && <p className="teks-arab-besar text-indigo-900 dark:text-indigo-300 mt-2" dir="rtl">{soal.teksTambahanArab}</p>}
                       </div>
                       {soal.tipe.startsWith('pilihan') && (<div className="mt-4 pt-3 border-t dark:border-slate-700 text-xs font-bold"><span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-md transition-colors">🔑 Kunci: {Array.isArray(soal.kunci) ? soal.kunci.join(' | ') : soal.kunci}</span></div>)}
                       {soal.tipe === 'isian' && (<div className="mt-4 pt-3 border-t dark:border-slate-700 text-xs font-bold"><span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-md transition-colors" dir={soal.bahasa === 'ar' ? 'rtl' : 'ltr'}>🔑 Kunci: {soal.kunci}</span></div>)}
                     </div>
                  ))}
               </div>
             </div>
           </div>
         )}
      </div>

    </div>
  );
};

export default LmsKuAdmin;