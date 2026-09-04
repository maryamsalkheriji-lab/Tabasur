import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import CubeX from './pages/CubeX'
import Home from './pages/Home'
import Register from './pages/Register'
import Admin from './pages/Admin'
import SponsorRegister from './pages/SponsorRegister'

export default function App() {
  return (
    <Routes>
      {/* ─── صفحة كيوبكس: الصفحة الرئيسية للشركة ─── */}
      <Route path="/" element={<CubeX />} />

      {/* ─── صفحة التسجيل: لها ناف وفوتر خاصين ─── */}
      <Route path="/register" element={<Register />} />

      {/* ─── صفحة تسجيل الرعاة ─── */}
      <Route path="/sponsor-register" element={<SponsorRegister />} />

      {/* ─── صفحة الأدمن: مستقلة بالكامل ─── */}
      <Route path="/admin" element={<Admin />} />

      {/* ─── معسكر تَبصِّر: الموقع الحالي، صار تحت /tabsur ─── */}
      <Route
        path="/tabsur/*"
        element={
          <>
            <Navbar />
            <main>
              <Routes>
                <Route path="/" element={<Home />} />
              </Routes>
            </main>
            <Footer />
          </>
        }
      />
    </Routes>
  )
}
