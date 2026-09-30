import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AdminGuard } from './components/guards/AdminGuard'
import { HospitalGuard } from './components/guards/HospitalGuard'

// Pages
import { LandingPage } from './pages/LandingPage'

// Admin
import { AdminLogin } from './pages/admin/AdminLogin'
import { AdminLayout } from './layouts/AdminLayout'
import { AdminOverview } from './pages/admin/AdminOverview'
import { AdminHospitals } from './pages/admin/AdminHospitals'
import { AdminAuditLog } from './pages/admin/AdminAuditLog'

// Hospital
import { HospitalLogin } from './pages/hospital/HospitalLogin'
import { HospitalLayout } from './layouts/HospitalLayout'
import { HospitalDashboard } from './pages/hospital/HospitalDashboard'
import { PatientEnrollment } from './pages/hospital/PatientEnrollment'
import { RegisterUnidentified } from './pages/hospital/RegisterUnidentified'
import { IdentificationWorkspace } from './pages/hospital/IdentificationWorkspace'
import { PatientChart } from './pages/hospital/PatientChart'
import { HospitalAuditLedger } from './pages/hospital/HospitalAuditLedger'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Landing */}
          <Route path="/" element={<LandingPage />} />

          {/* Admin auth */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Admin portal */}
          <Route
            path="/admin"
            element={
              <AdminGuard>
                <AdminLayout />
              </AdminGuard>
            }
          >
            <Route index element={<Navigate to="/admin/overview" replace />} />
            <Route path="overview"  element={<AdminOverview />} />
            <Route path="hospitals" element={<AdminHospitals />} />
            <Route path="audit"     element={<AdminAuditLog />} />
          </Route>

          {/* Hospital auth */}
          <Route path="/hospital/login" element={<HospitalLogin />} />

          {/* Hospital portal */}
          <Route
            path="/hospital"
            element={
              <HospitalGuard>
                <HospitalLayout />
              </HospitalGuard>
            }
          >
            <Route index element={<Navigate to="/hospital/dashboard" replace />} />
            <Route path="dashboard"    element={<HospitalDashboard />} />
            <Route path="enroll"       element={<PatientEnrollment />} />
            <Route path="register"     element={<RegisterUnidentified />} />
            <Route path="identify/:id" element={<IdentificationWorkspace />} />
            <Route path="chart/:type/:id" element={<PatientChart />} />
            <Route path="audit"        element={<HospitalAuditLedger />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
