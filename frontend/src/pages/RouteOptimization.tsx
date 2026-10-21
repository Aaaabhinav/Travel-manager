import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { RouteOptimizationResult, Trip } from '../types';
import { Navigation, MapPin, ArrowRight } from 'lucide-react';

export const RouteOptimization: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [source, setSource] = useState('Delhi');
  const [destinationsInput, setDestinationsInput] = useState('Agra, Jaipur, Udaipur, Mumbai');
  const [result, setResult] = useState<RouteOptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const resp = await apiClient.get('/trips');
        setTrips(resp.data || []);
      } catch (err) {
        console.error('Failed to fetch trips:', err);
      }
    };
    fetchTrips();
  }, []);

  const handleTripSelect = async (tripIdStr: string) => {
    setSelectedTripId(tripIdStr);
    if (!tripIdStr) return;

    try {
      const resp = await apiClient.get(`/trips/${tripIdStr}`);
      const tripData: Trip = resp.data;
      if (tripData.destinations && tripData.destinations.length > 0) {
        const destNames = tripData.destinations.map((d) => d.name).join(', ');
        setDestinationsInput(destNames);
      }
    } catch (err) {
      console.error('Could not load trip details:', err);
    }
  };

  const handleOptimize = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const destArray = destinationsInput.split(',').map((s) => s.trim()).filter(Boolean);

    try {
      const resp = await apiClient.post('/routes/optimize', {
        source,
        destinations: destArray,
      });
      setResult(resp.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Route calculation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
          <Navigation className="w-5 h-5 text-zinc-500" />
          <span>Smart Route Optimization</span>
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">
          Calculate the most efficient travel sequence and minimize distance across multi-city itineraries
        </p>
      </div>

      {/* Form Card */}
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
        {trips.length > 0 && (
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
            <label className="block text-xs font-mono uppercase font-bold text-zinc-500">
              Load Cities from Trip Itinerary
            </label>
            <select
              value={selectedTripId}
              onChange={(e) => handleTripSelect(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium"
            >
              <option value="">-- Select Trip to Auto-fill --</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} (#{t.id})
                </option>
              ))}
            </select>
          </div>
        )}

        <form onSubmit={handleOptimize} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-zinc-500 mb-1.5">
                Starting City
              </label>
              <input
                type="text"
                required
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-zinc-500"
                placeholder="Delhi"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-mono uppercase text-zinc-500 mb-1.5">
                Destinations (Comma Separated)
              </label>
              <input
                type="text"
                required
                value={destinationsInput}
                onChange={(e) => setDestinationsInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-zinc-500"
                placeholder="Agra, Jaipur, Udaipur, Mumbai"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 shadow-sm flex items-center justify-center space-x-2 transition disabled:opacity-50"
          >
            <span>{loading ? 'Calculating Sequence...' : 'Calculate Optimal Route'}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-lg space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Optimized Itinerary Sequence</h3>
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                {result.cached ? 'Instant Cache' : 'Real-time Optimized'}
              </span>
            </div>
          </div>

          {/* Stepper Timeline */}
          <div className="flex flex-wrap items-center gap-3">
            {result.optimizedRoute.map((city, idx) => (
              <React.Fragment key={idx}>
                <div className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-bold text-sm text-zinc-900 dark:text-zinc-100 shadow-sm">
                  <MapPin className="w-4 h-4 text-zinc-500" />
                  <span>{idx + 1}. {city}</span>
                </div>
                {idx < result.optimizedRoute.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
              <span className="text-xs uppercase font-mono font-bold block text-zinc-500">Total Distance</span>
              <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">{result.totalDistance} km</span>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
              <span className="text-xs uppercase font-mono font-bold block text-zinc-500">Est. Travel Time</span>
              <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">{result.estimatedTravelTime} Hours</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

