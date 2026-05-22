import React from 'react'
import './App.css'
import SpeciesSearch from './components/SpeciesSearch'

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-900 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-slate-950">
              ET
            </div>
            <span className="text-xl font-bold tracking-tight">EcoTracker</span>
          </div>
          <nav className="hidden md:flex space-x-8 text-sm font-medium text-slate-400">
            <a href="#" className="hover:text-emerald-400 transition-colors">Explorer</a>
            <a href="#" className="hover:text-emerald-400 transition-colors">Conservation</a>
            <a href="#" className="hover:text-emerald-400 transition-colors">Data</a>
          </nav>
        </div>
      </header>

      <main className="flex-grow py-12">
        <SpeciesSearch />
      </main>

      <footer className="border-t border-slate-900 py-8 bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-4">
          <p className="text-slate-500 text-sm">
            Powered by GBIF.org - Global Biodiversity Information Facility
          </p>
          <div className="flex justify-center space-x-6 text-slate-400">
            <span className="text-xs">© 2026 EcoTracker Project</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
