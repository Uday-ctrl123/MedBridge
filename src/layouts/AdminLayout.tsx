import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, ScrollText, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/admin/overview',  label: 'Overview',  icon: LayoutDashboard },
  { to: '/admin/hospitals', label: 'Hospitals', icon: Building2 },
  { to: '/admin/audit',     label: 'Audit Log', icon: ScrollText },
]

export function AdminLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen flex bg-ivory-100">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-teal-950 flex flex-col">
        {/* Logo */}
        <div className="px-7 py-8 border-b border-teal-800">
          <span className="font-serif text-xl text-white tracking-tight">MedBridge</span>
          <p className="text-teal-400 text-xs mt-0.5 font-sans">Platform Administration</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-teal-800 text-white'
                    : 'text-teal-300 hover:bg-teal-900 hover:text-white'
                }`
              }
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Sign out */}
        <div className="px-4 pb-6">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-teal-400
                       hover:bg-teal-900 hover:text-white transition-all duration-150 w-full"
          >
            <LogOut size={16} strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-8 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
