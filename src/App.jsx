import React, { useState } from 'react'
import LmsKuQuiz from './LmsKuQuiz'
import LmsKuAdmin from './LmsKuAdmin'

function App() {
  const [halamanAktif, setHalamanAktif] = useState('admin')
  const [bankSoalGlobal, setBankSoalGlobal] = useState([])
  
  // STATE BARU: Brankas penyimpan setoran tugas murid
  const [setoranGlobal, setSetoranGlobal] = useState([])

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-indigo-100">
      {/* Navbar Minimalis 3D */}
      <nav className="bg-white border-b border-slate-200 p-3 md:p-4 flex justify-center gap-3 sticky top-0 z-50">
        <button 
          onClick={() => setHalamanAktif('admin')}
          className={`px-5 py-2 md:px-6 md:py-2.5 rounded-xl font-bold text-sm md:text-base transition-all ${
            halamanAktif === 'admin' 
              ? 'bg-indigo-500 text-white border-b-4 border-indigo-700 active:border-b-0 active:translate-y-1' 
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border-b-4 border-slate-300 active:border-b-0 active:translate-y-1'
          }`}
        >
          ⚙️ Ruang Guru
        </button>
        <button 
          onClick={() => setHalamanAktif('ujian')}
          className={`px-5 py-2 md:px-6 md:py-2.5 rounded-xl font-bold text-sm md:text-base transition-all ${
            halamanAktif === 'ujian' 
              ? 'bg-emerald-500 text-white border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1' 
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border-b-4 border-slate-300 active:border-b-0 active:translate-y-1'
          }`}
        >
          📝 Ruang Ujian
        </button>
      </nav>

      {/* Melempar data ke masing-masing halaman */}
      {halamanAktif === 'admin' ? (
        <LmsKuAdmin bankSoal={bankSoalGlobal} setBankSoal={setBankSoalGlobal} setoran={setoranGlobal} />
      ) : (
        <LmsKuQuiz 
          bankSoal={bankSoalGlobal} 
          kirimSetoran={(data) => setSetoranGlobal([...setoranGlobal, data])} 
          kembaliKeBeranda={() => setHalamanAktif('admin')}
        />
      )}
    </div>
  )
}

export default App