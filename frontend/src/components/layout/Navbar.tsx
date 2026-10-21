import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../store/authContext';
import { Sun, Moon, LogOut, Compass, Layers, CheckCircle2, ChevronDown, X, Database, Network } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Navbar: React.FC = () => {
  const { user, logout, theme, toggleTheme } = useAuth();
  const [showServicesModal, setShowServicesModal] = useState(false);

  const services = [
    { name: 'User & Auth Service', lang: 'Java 17 (Spring Boot)', db: 'MySQL 8.0', role: 'Identity, JWT & Profiles', port: '8081' },
    { name: 'Trip Management Service', lang: 'Node.js (Express)', db: 'PostgreSQL 15', role: 'Itineraries & Destinations', port: '8082' },
    { name: 'Booking & Saga Service', lang: 'Go (Gin)', db: 'PostgreSQL 15', role: 'Distributed Saga Reservations', port: '8083' },
    { name: 'Recommendation Service', lang: 'Python 3.11 (FastAPI)', db: 'Apache Cassandra', role: 'Personalized ML Curation', port: '8084' },
    { name: 'Route Optimization Service', lang: 'C++ 20 (Crow)', db: 'Redis 7', role: 'TSP Shortest Route Solver', port: '8085' },
  ];

  return (
    <header className="h-16 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 flex items-center justify-between sticky top-0 z-40 shadow-sm transition-colors">
      <div className="flex items-center space-x-3">
        <Link to="/dashboard" className="flex items-center space-x-2.5 text-zinc-900 dark:text-zinc-100 font-bold text-xl tracking-tight">
          <div className="p-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <Compass className="w-5 h-5" />
          </div>
          <span className="font-extrabold tracking-wider text-lg uppercase">WAYFARE</span>
        </Link>
        
        {/* Microservices Architecture Status Badge */}
        <button
          onClick={() => setShowServicesModal(true)}
          className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
          title="View 5 Microservices Mesh Architecture"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>5 Polyglot Services Active</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </button>
      </div>

      <div className="flex items-center space-x-4">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-zinc-300" /> : <Moon className="w-4 h-4 text-zinc-600" />}
        </button>

        {user && (
          <div className="flex items-center space-x-3 border-l border-zinc-200 dark:border-zinc-800 pl-4">
            <Link to="/profile" className="flex items-center space-x-2.5 hover:opacity-80 transition">
              <div className="w-8 h-8 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold text-xs">
                {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
              </div>
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 hidden md:inline">
                {user.fullName}
              </span>
            </Link>

            <button
              onClick={logout}
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Polyglot Microservices Architecture Modal */}
      {showServicesModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full p-8 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="p-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                    <Layers className="w-4 h-4" />
                  </span>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Polyglot Microservices Mesh</h3>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  5 specialized distributed services connected through Kong API Gateway and RabbitMQ event streaming
                </p>
              </div>
              <button
                onClick={() => setShowServicesModal(false)}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {services.map((svc, idx) => (
                <div key={idx} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{svc.name}</h4>
                      <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">{svc.lang}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>Port {svc.port}</span>
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300">{svc.role}</p>
                  <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                    <span>Database: <strong className="text-zinc-700 dark:text-zinc-300">{svc.db}</strong></span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs flex items-center justify-between">
              <span className="font-medium">Orchestration: Kong API Gateway (Port 8000) • Event Bus: RabbitMQ (Topic)</span>
              <button
                onClick={() => setShowServicesModal(false)}
                className="px-3 py-1.5 rounded-xl bg-white/20 dark:bg-black/10 font-bold hover:opacity-80 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};
