'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
    href: string;
    label: string;
    icon: string;
}

const navItems: NavItem[] = [
    { href: '/fact-sheet', label: 'Fact Sheet', icon: '📄' },
    { href: '/dashboard', label: 'Analysis', icon: '📊' },
    { href: '/finance', label: 'Finance Tool', icon: '💰' },
    { href: '/dd-tabs', label: 'DD View', icon: '📋' },
];

export default function MainNavigation() {
    const pathname = usePathname();

    const isActive = (href: string) => {
        // Handle exact match or path starting with href
        if (href === '/dashboard') {
            return pathname === '/dashboard';
        }
        return pathname?.startsWith(href);
    };

    return (
        <nav className="flex items-center bg-gray-100 rounded-full p-1">
            {navItems.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center px-4 py-2 text-sm font-medium rounded-full transition-all ${isActive(item.href)
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                        }`}
                >
                    <span className="mr-1.5">{item.icon}</span>
                    {item.label}
                </Link>
            ))}
        </nav>
    );
}
