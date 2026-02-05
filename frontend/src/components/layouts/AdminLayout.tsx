import { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/atoms/Logo';
import { NavItem } from '@/components/molecules/NavItem';
import { Button } from '@/components/ui/button';
import {
  Users,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Bell,
  Brain,
  Scale,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/admin/dashboard', icon: BarChart3, label: 'Dashboard' },
  { to: '/admin/candidates', icon: Users, label: 'Candidates' },
  { to: '/admin/psychometric', icon: Brain, label: 'Psychometric' },
  { to: '/admin/evaluation-criteria', icon: Scale, label: 'Evaluation Criteria' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

/**
 * Admin Layout - Full dashboard with sidebar navigation
 * For recruiters to manage candidates and view analytics
 */
export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    // Remove auth data from localStorage
    localStorage.removeItem('recruiter_token');
    localStorage.removeItem('recruiter_user');
    
    // Redirect to home page
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Sidebar */}
      <aside
        className={cn(
          'h-screen sticky top-0 border-r border-border/50 bg-sidebar flex flex-col transition-smooth',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-border/50">
          <Link to="/admin/dashboard">
            <Logo size="sm" showText={!collapsed} />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Collapse Toggle */}
        <div className="p-3 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full justify-center"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span className="text-sm">Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 border-b border-border/50 flex items-center justify-between px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-medium text-muted-foreground">
              HR Evaluation System
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-primary rounded-full" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
