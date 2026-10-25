import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { isRecoveryHash } from './lib/adminAuth'
import TabsurLayout from './components/TabsurLayout'
import CubeX from './pages/CubeX'
import Home from './pages/Home'
import Register from './pages/Register'
import Admin from './pages/Admin'
import SponsorRegister from './pages/SponsorRegister'
import ScrollToTop from './components/ScrollToTop'
// منصة التحكيم تُحمَّل عند الطلب (chunk مستقل) حتى لا تثقل الصفحة الرئيسية
const JudgeApp = lazy(() => import('./judging/JudgeApp'))

// رابط إعادة تعيين كلمة المرور من Supabase قد يهبط على الصفحة الرئيسية
// (حسب Site URL في إعدادات Auth)، فنحوّله إلى لوحة الأدمن مع التوكن.
function recoveryTarget(location) {
  if (!isRecoveryHash(location.hash || '')) return null
  if (location.pathname === '/admin' || location.pathname.startsWith('/judge/admin')) return null
  return `/admin${location.hash}`
}

export default function App() {
  const location = useLocation()
  const recovery = recoveryTarget(location)
  if (recovery) return <Navigate to={recovery} replace />
  return (
    <>
    <ScrollToTop />
    <Routes>
      {/* ─── صفحة كيوبكس: الصفحة الرئيسية للشركة ─── */}
      <Route path="/" element={<CubeX />} />

      {/* ─── صفحة التسجيل: لها ناف وفوتر خاصين ─── */}
      <Route path="/register" element={<Register />} />

      {/* ─── صفحة تسجيل الرعاة ─── */}
      <Route path="/sponsor-register" element={<SponsorRegister />} />

      {/* ─── صفحة الأدمن: مستقلة بالكامل ─── */}
      <Route path="/admin" element={<Admin />} />

      {/* ─── منصة التحكيم: راوتر فرعي داخل src/judging ─── */}
      <Route path="/judge/*" element={<Suspense fallback={<div style={{ minHeight: '100svh', background: '#07040E' }} />}><JudgeApp /></Suspense>} />

      {/* ─── معسكر تَبصَّر: الموقع الحالي، صار تحت /tabsur ─── */}
      <Route
        path="/tabsur/*"
        element={
          <TabsurLayout>
              <Routes>
                <Route path="/" element={<Home />} />
                {/* كثيرون يكتبون /tabsur/admin — لوحة الإدارة على /admin */}
                <Route path="admin/*" element={<Navigate to="/admin" replace />} />
                <Route path="*" element={<Navigate to="/tabsur" replace />} />
              </Routes>
          </TabsurLayout>
        }
      />
    </Routes>
    </>
  )
}
