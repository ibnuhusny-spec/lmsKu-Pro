import React, { useState } from 'react'
import LmsKuQuiz from './LmsKuQuiz'
import LmsKuAdmin from './LmsKuAdmin'

function App() {
  const [halamanAktif, setHalamanAktif] = useState('admin')
  
  // INI ADALAH MEMORI UTAMA YANG MENGHUBUNGKAN ADMIN & PESERTA
  const [bankSoalGlobal, setBankSoalGlobal] = useState([])

  return (
    <div className="min-h-screen bg-slate-200">
      <nav className="bg-slate-800 p-4 shadow-md flex justify-center gap-4">
        <button 
          onClick={() => setHalamanAktif('admin')}
          className={`px-6 py-2 rounded-full font-bold transition-all ${halamanAktif === 'admin' ? 'bg-indigo-500 text-white shadow-lg' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
        >
          ⚙️ Halaman Admin
        </button>
        <button 
          onClick={() => setHalamanAktif('ujian')}
          className={`px-6 py-2 rounded-full font-bold transition-all ${halamanAktif === 'ujian' ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
        >
          📝 Halaman Peserta (Ujian)
        </button>
      </nav>

      {/* Mengirimkan memori ke masing-masing halaman */}
      {halamanAktif === 'admin' ? (
        <LmsKuAdmin bankSoal={bankSoalGlobal} setBankSoal={setBankSoalGlobal} />
      ) : (
        <LmsKuQuiz bankSoal={bankSoalGlobal} />
      )}
    </div>
  )
}

export default App