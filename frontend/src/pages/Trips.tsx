import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { Trip } from '../types';
import { Map, PlusCircle, Trash2, Calendar, DollarSign, Search, ArrowRight } from 'lucide-react';

export const Trips: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchTrips = async () => {
    try {
      const resp = await apiClient.get('/trips');
      setTrips(resp.data || []);
    } catch (err) {
      console.error('Failed to fetch trips:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this trip itinerary?')) return;
    try {
      await apiClient.delete(`/trips/${id}`);
      setTrips((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      alert('Failed to delete trip.');
    }
  };

  const filteredTrips = trips.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">My Trips</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Explore and manage your travel itineraries</p>
        </div>
        <Link
          to="/trips/create"
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold text-sm hover:opacity-90 shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create Trip</span>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-zinc-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search trips..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-zinc-500"
        />
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-500">Loading your trips...</div>
      ) : filteredTrips.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 space-y-3">
          <Map className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto" />
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">No Trips Found</h3>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Start by creating your first trip itinerary!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTrips.map((trip) => (
            <div
              key={trip.id}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between hover:border-zinc-400 dark:hover:border-zinc-600 transition"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">{trip.title}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${
                    trip.status === 'CANCELLED'
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  }`}>
                    {trip.status || 'PLANNED'}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{trip.description || 'No description provided.'}</p>

                <div className="pt-2 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-zinc-400" />
                    <span>{trip.start_date?.split('T')[0]} to {trip.end_date?.split('T')[0]}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-zinc-400" />
                    <span>Budget: ${trip.budget?.toLocaleString('en-US')}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <Link
                  to={`/trips/${trip.id}`}
                  className="text-xs font-bold text-zinc-900 dark:text-zinc-100 hover:underline inline-flex items-center space-x-1"
                >
                  <span>Details & Destinations</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={() => handleDelete(trip.id)}
                  className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition"
                  title="Delete Trip"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
