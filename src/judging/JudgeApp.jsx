import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import './judging.css'
import { ToastProvider } from './components/ui'
import Landing from './pages/Landing'
import JudgeLogin from './pages/JudgeLogin'
import JudgeArea from './pages/JudgeArea'
import JudgeDashboard from './pages/JudgeDashboard'
import JudgeScore from './pages/JudgeScore'
import Results from './pages/Results'
import AdminApp from './admin/AdminApp'

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

// الروابط القديمة /judge/<slug>/login → /judge/<slug> (مع الإبقاء على ?code=)
function LoginRedirect() {
  const { slug } = useParams()
  const { search } = useLocation()
  return <Navigate to={`/judge/${slug}${search}`} replace />
}

export default function JudgeApp() {
  useEffect(() => {
    const prev = document.title
    document.title = 'منصة التحكيم — CUBEX'
    return () => { document.title = prev }
  }, [])
  return (
    <ToastProvider>
      <ScrollTop />
      <Routes>
        <Route index element={<Landing />} />
        <Route path="admin/*" element={<AdminApp />} />
        <Route path=":slug" element={<JudgeLogin />} />
        <Route path=":slug/login" element={<LoginRedirect />} />
        <Route path=":slug/judge" element={<JudgeArea />}>
          <Route index element={<JudgeDashboard />} />
          <Route path=":projectId" element={<JudgeScore />} />
        </Route>
        <Route path=":slug/results" element={<Results />} />
        <Route path="*" element={<Navigate to="/judge" replace />} />
      </Routes>
    </ToastProvider>
  )
}
