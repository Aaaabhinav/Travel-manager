import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../store/authContext';
import { Trip, Destination, Booking, SagaTimeline, RouteOptimizationResult } from '../types';
import { 
  MapPin, Calendar, DollarSign, Trash2, Navigation, Plus, CheckCircle, 
  Clock, XCircle, FileText, ArrowRight, ShieldAlert, Sparkles, Building, Car, Compass 
} from 'lucide-react';

export const TripDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [catalog, setCatalog] = useState<Destination[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDestId, setSelectedDestId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Reservation Modal State
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingType, setBookingType] = useState<'HOTEL' | 'TRANSPORT' | 'ACTIVITY'>('HOTEL');
  const [bookingTitle, setBookingTitle] = useState('Taj Palace Luxury Suite');
  const [bookingPrice, setBookingPrice] = useState('8500');
  const [simulateFailure, setSimulateFailure] = useState('');

  // Saga Timeline Drawer State
  const [selectedSaga, setSelectedSaga] = useState<SagaTimeline | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Embedded Route Optimizer State
  const [routeSource, setRouteSource] = useState('Ahmedabad');
  const [routeResult, setRouteResult] = useState<RouteOptimizationResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const fetchTripDetails = async () => {
    if (!id) return;
    try {
      const [tripRes, catalogRes, bookingsRes] = await Promise.allSettled([
        apiClient.get(`/trips/${id}`),
        apiClient.get('/destinations'),
        apiClient.get(`/bookings?trip_id=${id}`),
      ]);

      if (tripRes.status === 'fulfilled') {
        setTrip(tripRes.value.data);
      } else {
        console.error('Failed to fetch trip:', tripRes.reason);
      }

      if (catalogRes.status === 'fulfilled') {
        const raw = catalogRes.value.data;
        const list: Destination[] = raw.data || raw.destinations || (Array.isArray(raw) ? raw : []);
        setCatalog(list);
      }

      if (bookingsRes.status === 'fulfilled') {
        const rawBookings = bookingsRes.value.data;
        const allBookings: any[] = Array.isArray(rawBookings) ? rawBookings : (rawBookings.bookings || []);
        setBookings(allBookings.filter((b) => {
          const tripId = typeof b.trip_id === 'object' && b.trip_id !== null ? b.trip_id.Int64 : b.trip_id;
          return tripId === parseInt(id!) || (!tripId && allBookings.length === 1);
        }));
      } else {
        try {
          const fallbackRes = await apiClient.get('/bookings');
          const allB: any[] = Array.isArray(fallbackRes.data) ? fallbackRes.data : [];
          setBookings(allB.filter((b) => {
            const tripId = typeof b.trip_id === 'object' && b.trip_id !== null ? b.trip_id.Int64 : b.trip_id;
            return tripId === parseInt(id!);
          }));
        } catch {
          setBookings([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch trip details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTripDetails();
    const interval = setInterval(fetchTripDetails, 4000); // Polling for reservation status
    return () => clearInterval(interval);
  }, [id, user]);

  const handleAddDestination = async () => {
    if (!selectedDestId) return;
    try {
      await apiClient.post(`/trips/${id}/destinations`, {
        destination_id: parseInt(selectedDestId),
      });
      setSelectedDestId('');
      fetchTripDetails();
    } catch (err) {
      alert('Failed to add destination.');
    }
  };

  const handleRemoveDestination = async (tripDestId: number, destinationId: number, destName: string) => {
    if (!window.confirm(`Remove ${destName} from this trip?`)) return;
    try {
      await apiClient.delete(`/trips/${id}/destinations/${destinationId}`);
      fetchTripDetails();
    } catch (err: any) {
      // If the route using destinationId fails (404), fall back to the row id
      try {
        await apiClient.delete(`/trips/${id}/destinations/${tripDestId}`);
        fetchTripDetails();
      } catch (err2) {
        alert('Failed to remove destination.');
      }
    }
  };

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const headers: Record<string, string> = {};
      if (simulateFailure) {
        headers['X-Simulate-Failure'] = simulateFailure;
      }

      const priceNum = parseFloat(bookingPrice) || 0;
      await apiClient.post(
        '/bookings',
        {
          booking_type: bookingType,
          title: bookingTitle,
          notes: bookingTitle,
          total_price: priceNum,
          trip_id: parseInt(id!),
          items: [
            {
              item_type: bookingType,
              name: bookingTitle,
              price: priceNum,
              quantity: 1,
            },
          ],
        },
        { headers }
      );

      setShowBookingModal(false);
      setBookingTitle('');
      setBookingPrice('150');
      setSimulateFailure('');
      fetchTripDetails();
      setTimeout(fetchTripDetails, 1200);
      setTimeout(fetchTripDetails, 2500);
      setTimeout(fetchTripDetails, 4500);
    } catch (err: any) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Failed to create reservation.');
    }
  };

  const handleCancelReservation = async (bookingId: number) => {
    if (!window.confirm('Cancel this reservation? This will trigger the Booking Cancellation Saga.')) return;
    try {
      await apiClient.put(`/bookings/${bookingId}/cancel`);
      fetchTripDetails();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel reservation.');
    }
  };

  const handleViewSagaTimeline = async (bookingId: number) => {
    try {
      const resp = await apiClient.get(`/bookings/${bookingId}/saga`);
      setSelectedSaga(resp.data);
      setDrawerOpen(true);
    } catch (err) {
      alert('Processing log not available yet.');
    }
  };

  const handleCalculateRoute = async () => {
    if (!trip || !trip.destinations || trip.destinations.length === 0) return;
    setRouteLoading(true);
    const destNames = trip.destinations.map((d) => d.name);

    try {
      const resp = await apiClient.post('/routes/optimize', {
        source: routeSource,
        destinations: destNames,
      });
      setRouteResult(resp.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to optimize route.');
    } finally {
      setRouteLoading(false);
    }
  };

  const handleCancelTrip = async () => {
    if (!window.confirm('Are you sure you want to cancel this entire trip itinerary and all associated reservations?')) return;
    try {
      await apiClient.put(`/trips/${id}`, { status: 'CANCELLED' });
      // Cascade cancellation to all active bookings of this trip
      for (const b of bookings) {
        if (b.status === 'CONFIRMED' || b.status === 'PENDING') {
          try {
            await apiClient.put(`/bookings/${b.id}/cancel`);
          } catch (e) {
            console.error('Failed to cancel booking', b.id, e);
          }
        }
      }
      await fetchTripDetails();
    } catch (err) {
      alert('Failed to cancel trip.');
    }
  };

  const handleDeleteTrip = async () => {
    if (!window.confirm('Are you sure you want to delete this trip itinerary and its details?')) return;
    try {
      // Cancel active reservations before deleting trip
      for (const b of bookings) {
        if (b.status === 'CONFIRMED' || b.status === 'PENDING') {
          try {
            await apiClient.put(`/bookings/${b.id}/cancel`);
          } catch (e) {
            console.error('Failed to cancel booking', b.id, e);
          }
        }
      }
      await apiClient.delete(`/trips/${id}`);
      navigate('/trips');
    } catch (err) {
      alert('Failed to delete trip.');
    }
  };

  const isSuccessTag = (st: string) => {
    const s = (st || '').toUpperCase();
    return s === 'CONFIRMED' || s === 'COMPLETED' || s === 'SUCCEEDED' || s === 'ACTIVE' || s === 'PLANNED';
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center space-x-1.5 inline-flex">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            <span>Confirmed</span>
          </span>
        );
      case 'PENDING':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center space-x-1.5 inline-flex animate-pulse">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            <span>Processing</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center space-x-1.5 inline-flex">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Failed</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center space-x-1.5 inline-flex">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
            isSuccessTag(status)
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
          }`}>
            {status}
          </span>
        );
    }
  };

  if (loading) return <div className="py-12 text-center text-zinc-500">Loading trip details...</div>;
  if (!trip) return <div className="py-12 text-center text-rose-500 font-semibold">Trip not found.</div>;

  const totalReservationsSpend = bookings
    .filter((b) => b.status === 'CONFIRMED')
    .reduce((sum, b) => sum + (b.total_price || 0), 0);

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                {trip.status || 'PLANNED'}
              </span>
              <span className="text-xs text-zinc-400 font-mono">Trip ID #{trip.id}</span>
            </div>
            <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">{trip.title}</h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-2xl">{trip.description || 'No description provided.'}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowBookingModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold text-sm hover:opacity-90 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Reservation</span>
            </button>
            {trip.status !== 'CANCELLED' && (
              <button
                onClick={handleCancelTrip}
                className="px-3 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition"
              >
                Cancel Trip
              </button>
            )}
            <button
              onClick={handleDeleteTrip}
              className="p-2.5 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              title="Delete Trip"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center space-x-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
              <Calendar className="w-5 h-5 text-zinc-400 flex-shrink-0" />
              <div>
                <span className="text-[11px] font-mono text-zinc-400 block uppercase">Travel Dates</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200 text-xs">
                  {trip.start_date?.split('T')[0]} to {trip.end_date?.split('T')[0]}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
              <DollarSign className="w-5 h-5 text-zinc-400 flex-shrink-0" />
              <div>
                <span className="text-[11px] font-mono text-zinc-400 block uppercase">Budget Allocation</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200 text-xs">
                  ${trip.budget?.toLocaleString('en-US')} (${Math.max(0, trip.budget - totalReservationsSpend).toLocaleString('en-US')} remaining)
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
              <Building className="w-5 h-5 text-zinc-400 flex-shrink-0" />
              <div>
                <span className="text-[11px] font-mono text-zinc-400 block uppercase">Confirmed Reservations</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200 text-xs">
                  ${totalReservationsSpend.toLocaleString('en-US')} ({trip.budget ? ((totalReservationsSpend / trip.budget) * 100).toFixed(0) : 0}%)
                </span>
              </div>
            </div>
          </div>

          {/* Budget Utilization Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-mono text-zinc-500">
              <span>Budget Utilized</span>
              <span>${totalReservationsSpend.toLocaleString('en-US')} / ${trip.budget?.toLocaleString('en-US')}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                  totalReservationsSpend > trip.budget 
                    ? 'bg-rose-500' 
                    : totalReservationsSpend > trip.budget * 0.8 
                    ? 'bg-amber-500' 
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, trip.budget ? (totalReservationsSpend / trip.budget) * 100 : 0)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Destinations & Cities Section */}
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-zinc-500" />
              <span>Destinations & Cities ({trip.destinations?.length || 0})</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">Select cities to include in this itinerary</p>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={selectedDestId}
              onChange={(e) => setSelectedDestId(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 outline-none"
            >
              <option value="">-- Select Destination --</option>
              {catalog.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.country}) - ${d.daily_cost}/day
                </option>
              ))}
            </select>
            <button
              onClick={handleAddDestination}
              disabled={!selectedDestId}
              className="px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition"
            >
              Add City
            </button>
          </div>
        </div>

        {(!trip.destinations || trip.destinations.length === 0) ? (
          <div className="py-8 text-center text-zinc-500 dark:text-zinc-400 text-sm space-y-2">
            <Compass className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-700" />
            <p>No cities added to this trip yet.</p>
            <p className="text-xs text-zinc-400">Choose from the dropdown above to start building your itinerary.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trip.destinations.map((dest) => (
                <div
                  key={dest.id}
                  className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{dest.name}</h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{dest.category} • ${dest.avg_daily_cost ?? dest.daily_cost}/day</p>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => {
                        setBookingType('HOTEL');
                        setBookingTitle(`${dest.name} Hotel Stay`);
                        const price = dest.avg_daily_cost ?? dest.daily_cost;
                        setBookingPrice(price ? String(price) : '150');
                        setShowBookingModal(true);
                      }}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 transition inline-flex items-center space-x-1"
                      title={`Book hotel stay in ${dest.name}`}
                    >
                      <Building className="w-3.5 h-3.5" />
                      <span>Book Stay</span>
                    </button>
                    <button
                      onClick={() => handleRemoveDestination(dest.id, dest.destination_id ?? dest.id, dest.name)}
                      className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition"
                      title="Remove City"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Embedded Route Optimizer for these cities */}
            <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
                    <Navigation className="w-4 h-4 text-zinc-500" />
                    <span>Route Optimization for this Trip</span>
                  </h3>
                  <p className="text-xs text-zinc-500">Compute the shortest path order across these destinations</p>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={routeSource}
                    onChange={(e) => setRouteSource(e.target.value)}
                    placeholder="Source City (e.g. Ahmedabad)"
                    className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                  />
                  <button
                    onClick={handleCalculateRoute}
                    disabled={routeLoading}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold text-xs hover:opacity-90 transition shadow-sm"
                  >
                    {routeLoading ? 'Calculating...' : 'Calculate Optimal Order'}
                  </button>
                </div>
              </div>

              {routeResult && (
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {routeResult.optimizedRoute.map((city, idx) => (
                      <React.Fragment key={idx}>
                        <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-bold text-xs text-zinc-900 dark:text-zinc-100">
                          {idx + 1}. {city}
                        </span>
                        {idx < routeResult.optimizedRoute.length - 1 && (
                          <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="flex items-center space-x-6 text-xs text-zinc-500 font-mono pt-1">
                    <span>Total Distance: <strong className="text-zinc-900 dark:text-zinc-100">{routeResult.totalDistance} km</strong></span>
                    <span>Est. Travel Time: <strong className="text-zinc-900 dark:text-zinc-100">{routeResult.estimatedTravelTime} Hours</strong></span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Trip Reservations & Bookings Section */}
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
              <Building className="w-5 h-5 text-zinc-500" />
              <span>Trip Reservations & Hotels ({bookings.length})</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">Manage accommodation, flights, and activity reservations for this trip</p>
          </div>

          <button
            onClick={() => setShowBookingModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold text-sm hover:opacity-90 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Reservation</span>
          </button>
        </div>

        {bookings.length === 0 ? (
          <div className="py-8 text-center text-zinc-500 dark:text-zinc-400 text-sm space-y-2">
            <Building className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-700" />
            <p>No hotel or travel reservations created for this trip yet.</p>
            <button
              onClick={() => setShowBookingModal(true)}
              className="text-xs font-bold text-zinc-900 dark:text-zinc-100 hover:underline"
            >
              + Create your first reservation
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-700 dark:text-zinc-300">
              <thead className="bg-zinc-50 dark:bg-zinc-950/60 text-xs font-mono uppercase tracking-wider text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Item Title</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">#{b.id}</td>
                    <td className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100">
                      {b.title || (typeof (b as any).notes === 'string' ? (b as any).notes : '') || `${b.booking_type} Reservation`}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-lg text-xs font-mono border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                        {b.booking_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100">${b.total_price?.toLocaleString('en-US')}</td>
                    <td className="px-4 py-3">{renderStatusBadge(b.status)}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleViewSagaTimeline(b.id)}
                        className="px-3 py-1 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition inline-flex items-center space-x-1"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Log</span>
                      </button>
                      {(b.status === 'CONFIRMED' || b.status === 'PENDING') && (
                        <button
                          onClick={() => handleCancelReservation(b.id)}
                          className="px-3 py-1 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Reservation Modal */}
      {showBookingModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl max-w-md w-full border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-6">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Add Reservation to Trip</h3>

            <form onSubmit={handleCreateReservation} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-zinc-500 mb-1">Reservation Type</label>
                <select
                  value={bookingType}
                  onChange={(e: any) => setBookingType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm font-medium"
                >
                  <option value="HOTEL">HOTEL</option>
                  <option value="TRANSPORT">TRANSPORT</option>
                  <option value="ACTIVITY">ACTIVITY</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-zinc-500 mb-1">Title / Vendor</label>
                <input
                  type="text"
                  required
                  value={bookingTitle}
                  onChange={(e) => setBookingTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-zinc-500 mb-1">Price ($)</label>
                <input
                  type="number"
                  required
                  value={bookingPrice}
                  onChange={(e) => setBookingPrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm font-medium"
                />
              </div>

              {/* Simulation Mode for Exception Path */}
              <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-1">
                <label className="block text-xs font-mono uppercase font-bold text-zinc-700 dark:text-zinc-300">
                  Simulation Mode (Testing Exception Paths)
                </label>
                <select
                  value={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium"
                >
                  <option value="">Standard Mode (Confirm Reservation)</option>
                  <option value="payment">Simulate Payment Failure</option>
                  <option value="trip-reservation">Simulate Reservation Failure</option>
                </select>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 font-semibold text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold text-sm hover:opacity-90 shadow-sm transition"
                >
                  Confirm Reservation
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Timeline Drawer */}
      {drawerOpen && selectedSaga && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] bg-black/60 backdrop-blur-sm flex justify-end h-screen w-screen overflow-hidden" onClick={() => setDrawerOpen(false)}>
          <div
            className="bg-white dark:bg-zinc-900 w-full max-w-lg h-screen border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-8 py-5 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Processing Log</h3>
                <p className="text-xs font-mono text-zinc-500 mt-0.5">Reference ID: {selectedSaga.saga_id}</p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Overall Status:</span>
                  <span className={`font-bold px-2.5 py-0.5 rounded-lg border uppercase tracking-wider text-[11px] ${
                    isSuccessTag(selectedSaga.status)
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                  }`}>
                    {selectedSaga.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Current Step:</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{selectedSaga.current_step || '—'}</span>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-mono text-xs uppercase tracking-wider text-zinc-500 font-bold">Step Lifecycle & Resources</h4>
                <div className="space-y-3">
                  {selectedSaga.steps?.map((step, idx) => (
                    <div key={idx} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{step.step_name}</span>
                        <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                          isSuccessTag(step.status)
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                        }`}>
                          {step.status}
                        </span>
                      </div>
                      {step.error && <p className="text-xs text-rose-500 mt-1 font-mono">Notice: {step.error}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
