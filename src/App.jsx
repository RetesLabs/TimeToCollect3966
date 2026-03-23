import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import MesActual from './pages/MesActual'
import Historico from './pages/Historico'
import Admin from './pages/Admin'

function App() {
  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<MesActual />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
