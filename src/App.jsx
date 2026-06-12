import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Register from './pages/Register'
import Admin from './pages/Admin'
import SponsorRegister from './pages/SponsorRegister'

export default function App() {
  return (
    <Routes>
      {/* ─── صفحة التسجيل: لها ناف وفوتر خاصين ─── */}
      <Route path="/register" element={<Register />} />

      {/* ─── صفحة تسجيل الرعاة ─── */}
      <Route path="/sponsor-register" element={<SponsorRegister />} />

      {/* ─── صفحة الأدمن: مستقلة بالكامل ─── */}
      <Route path="/admin" element={<Admin />} />

      {/* ─── الصفحة الرئيسية ─── */}
      <Route
        path="/*"
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
