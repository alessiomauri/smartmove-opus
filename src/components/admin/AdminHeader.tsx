'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, LogOut, MapPin, BookOpen, Building2, Users, HelpCircle, Boxes, Star, ClipboardList, LayoutDashboard, UserCog, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/actions/auth';

export default function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.push('/admin/login');
    router.refresh();
  };

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/leads', label: 'Leads', icon: Users },
    { href: '/admin/inventory', label: 'Inventory', icon: Boxes },
    { href: '/admin/listings', label: 'Listings', icon: ClipboardList },
    { href: '/admin/developments', label: 'Developments', icon: Building2 },
    { href: '/admin/curation', label: 'Featured / Top-20', icon: Star },
    { href: '/admin/quizzes', label: 'Quizzes', icon: HelpCircle },
    { href: '/admin/areas', label: 'Areas', icon: MapPin },
    { href: '/admin/blog', label: 'Blog', icon: BookOpen },
    { href: '/admin/team', label: 'Team', icon: UserCog },
    { href: '/admin#settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="bg-[#2E2E2E] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/admin" className="flex items-center gap-2">
            <span className="text-xl font-semibold">
              <span className="text-[#76b3a8]">Smartmove</span> Marbella
            </span>
            <span className="text-xs bg-[#0f6c74] px-2 py-0.5 rounded ml-2">
              Admin
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  (pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href)))
                    ? 'bg-white/10 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">View Site</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
