import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../store/authContext';
import { apiClient } from '../api/client';
import { Trip, Booking, Recommendation } from '../types';
import { Map, BookmarkCheck, Sparkles, Navigation, PlusCircle, Compass, DollarSign, ArrowUpRight } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const [tripsRes, bookingsRes, recsRes] = await Promise.allSettled([
          apiClient.get(`/trips`),
          apiClient.get(`/bookings`),
          apiClient.get(`/recommendations/${user.id}`),
        ]);

        if (tripsRes.status === 'fulfilled') {
          const rawTrips = tripsRes.value.data;
          setTrips(Array.isArray(rawTrips) ? rawTrips : []);
        }
        if (bookingsRes.status === 'fulfilled') {
          const rawBookings = bookingsRes.value.data;
          setBookings(Array.isArray(rawBookings) ? rawBookings : (rawBookings.bookings || []));
        }
        if (recsRes.status === 'fulfilled') {
          setRecommendations(recsRes.value.data.recommendations || []);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const activeBookings = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'PENDING');
  const totalSpend = bookings.filter((b) => b.status === 'CONFIRMED').reduce((acc, b) => acc + (b.total_price || 0), 0);

  return (
    <div className="space-y-8">
      {/* Greeting Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 p-8 shadow-xl border border-zinc-800 dark:border-zinc-200">
        <div className="relative z-10 space-y-4">
          <div className="inline-block px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider bg-white/10 dark:bg-black/10 border border-white/20 dark:border-black/20">
            Wayfare Platform Overview
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Welcome back, {user?.fullName || 'Traveler'}.</h1>
          <p className="text-zinc-400 dark:text-zinc-600 max-w-xl text-sm leading-relaxed">
            Track your active itineraries, manage reservations, optimize multi-destination journeys, and explore handpicked destinations.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              to="/trips/create"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white font-semibold text-sm hover:opacity-90 transition shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create New Trip</span>
            </Link>
            <Link
              to="/routes"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-transparent border border-white/30 dark:border-black/30 hover:bg-white/10 dark:hover:bg-black/10 transition text-sm font-semibold"
            >
              <Navigation className="w-4 h-4" />
              <span>Optimize Route</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total Trips</p>
            <p className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1">{trips.length}</p>
          </div>
          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl">
            <Map className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Active Bookings</p>
            <p className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1">{activeBookings.length}</p>
          </div>
          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl">
            <BookmarkCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total Spend</p>
            <p className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1">${totalSpend.toLocaleString('en-US')}</p>
          </div>
          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Recommendations</p>
            <p className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1">{recommendations.length}</p>
          </div>
          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Trips List */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
              <Compass className="w-5 h-5 text-zinc-500" />
              <span>Upcoming & Recent Itineraries</span>
            </h2>
            <Link to="/trips" className="text-xs font-bold text-zinc-900 dark:text-zinc-100 hover:underline flex items-center space-x-0.5">
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {trips.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 dark:text-zinc-400 space-y-3">
              <Map className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-700" />
              <p className="text-sm">No travel itineraries created yet.</p>
              <Link to="/trips/create" className="text-xs font-bold text-zinc-900 dark:text-zinc-100 hover:underline inline-block">
                Create your first itinerary →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {trips.slice(0, 4).map((trip) => (
                <div
                  key={trip.id}
                  className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-center justify-between hover:border-zinc-400 dark:hover:border-zinc-600 transition"
                >
                  <div className="space-y-1">
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{trip.title}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {trip.start_date?.split('T')[0]} to {trip.end_date?.split('T')[0]} • Budget: ${trip.budget?.toLocaleString('en-US')}
                    </p>
                  </div>
                  <Link
                    to={`/trips/${trip.id}`}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 transition"
                  >
                    View Details
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Curated Recommendations Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-zinc-500" />
              <span>Tailored Picks</span>
            </h2>
            <Link to="/recommendations" className="text-xs font-bold text-zinc-900 dark:text-zinc-100 hover:underline flex items-center space-x-0.5">
              <span>Explore</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {recommendations.slice(0, 3).map((rec) => (
              <div key={rec.destination_id} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{rec.destination_name}</span>
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    {rec.score.toFixed(0)}% Match
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">{rec.reason}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
