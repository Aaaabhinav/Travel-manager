import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../store/authContext';
import { apiClient } from '../api/client';
import { Booking, SagaTimeline, Trip } from '../types';
import { BookmarkCheck, Plus, CheckCircle, Clock, XCircle, FileText, ArrowRight } from 'lucide-react';

export const Bookings: React.FC = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [bookingType, setBookingType] = useState<'HOTEL' | 'TRANSPORT' | 'ACTIVITY'>('HOTEL');
  const [title, setTitle] = useState('Taj Hotel Luxury Suite');
  const [totalPrice, setTotalPrice] = useState('12500');
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [simulateFailure, setSimulateFailure] = useState('');

  // Timeline Drawer State
  const [selectedSaga, setSelectedSaga] = useState<SagaTimeline | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchBookingsAndTrips = async () => {
    try {
      const [bookingsRes, tripsRes] = await Promise.allSettled([
        apiClient.get('/bookings'),
        apiClient.get('/trips'),
      ]);
      if (bookingsRes.status === 'fulfilled') {
        const raw = bookingsRes.value.data;
        setBookings(Array.isArray(raw) ? raw : (raw.bookings || []));
      }
      if (tripsRes.status === 'fulfilled') {
        const raw = tripsRes.value.data;
        setTrips(Array.isArray(raw) ? raw : []);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookingsAndTrips();
    const interval = setInterval(fetchBookingsAndTrips, 3000);
    return () => clearInterval(interval);
  }, [user]);

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const headers: Record<string, string> = {};
      if (simulateFailure) {
        headers['X-Simulate-Failure'] = simulateFailure;
      }

      const priceNum = parseFloat(totalPrice) || 0;
      await apiClient.post(
        '/bookings',
        {
          booking_type: bookingType,
          title,
          notes: title,
          total_price: priceNum,
          trip_id: selectedTripId ? parseInt(selectedTripId) : undefined,
          items: [
            {
              item_type: bookingType,
              name: title,
              price: priceNum,
              quantity: 1,
            },
          ],
        },
        { headers }
      );

      setShowCreateModal(false);
      setTitle('');
      setTotalPrice('10000');
      setSimulateFailure('');
      setSelectedTripId('');
      fetchBookingsAndTrips();
      setTimeout(fetchBookingsAndTrips, 1200);
      setTimeout(fetchBookingsAndTrips, 2500);
      setTimeout(fetchBookingsAndTrips, 4500);
    } catch (err: any) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Failed to create booking.');
    }
  };

  const handleCancelBooking = async (id: number) => {
    if (!window.confirm('Are you sure you want to cancel this reservation?')) return;
    try {
      await apiClient.put(`/bookings/${id}/cancel`);
      fetchBookingsAndTrips();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel booking.');
    }
  };

  const handleViewSagaTimeline = async (id: number) => {
    try {
      const resp = await apiClient.get(`/bookings/${id}/saga`);
      setSelectedSaga(resp.data);
      setDrawerOpen(true);
    } catch (err) {
      alert('Processing log not available yet.');
    }
  };

  const getTripTitle = (tripId?: number) => {
    if (!tripId) return 'General';
    const found = trips.find((t) => t.id === tripId);
    return found ? found.title : `Trip #${tripId}`;
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
            <span>Failed & Reverted</span>
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
            <BookmarkCheck className="w-6 h-6 text-zinc-500" />
            <span>Bookings & Reservations</span>
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            Trip accommodation, flights, and activities managed via Booking Service distributed Saga Orchestration
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold text-sm hover:opacity-90 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Reservation</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-500">Loading bookings...</div>
      ) : bookings.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 space-y-3">
          <BookmarkCheck className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto" />
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">No Reservations Found</h3>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Create a reservation for hotels, transport, or activities.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-700 dark:text-zinc-300">
              <thead className="bg-zinc-50 dark:bg-zinc-950/60 text-xs font-mono uppercase tracking-wider text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Item Title</th>
                  <th className="px-6 py-4">Associated Trip</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Price</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition">
                    <td className="px-6 py-4 font-mono text-xs text-zinc-400">#{b.id}</td>
                    <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">
                      {b.title || (typeof (b as any).notes === 'string' ? (b as any).notes : '') || `${b.booking_type} Reservation`}
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const tripId = typeof b.trip_id === 'object' && b.trip_id !== null ? (b.trip_id as any).Int64 : b.trip_id;
                        return tripId ? (
                          <Link
                            to={`/trips/${tripId}`}
                            className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 hover:underline inline-flex items-center space-x-1"
                          >
                            <span>{getTripTitle(tripId)}</span>
                            <ArrowRight className="w-3 h-3 text-zinc-400" />
                          </Link>
                        ) : (
                          <span className="text-xs text-zinc-400 font-mono">General</span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-mono border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                        {b.booking_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">${b.total_price?.toLocaleString('en-US')}</td>
                    <td className="px-6 py-4">{renderStatusBadge(b.status)}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleViewSagaTimeline(b.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition inline-flex items-center space-x-1"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Log</span>
                      </button>
                      {(b.status === 'CONFIRMED' || b.status === 'PENDING') && (
                        <button
                          onClick={() => handleCancelBooking(b.id)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
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
        </div>
      )}

      {/* New Reservation Modal */}
      {showCreateModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl max-w-md w-full border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-6">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">New Reservation</h3>

            <form onSubmit={handleCreateBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-zinc-500 mb-1">Associate with Trip (Optional)</label>
                <select
                  value={selectedTripId}
                  onChange={(e) => setSelectedTripId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm font-medium"
                >
                  <option value="">-- General Reservation --</option>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} (#{t.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-zinc-500 mb-1">Booking Type</label>
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
                <label className="block text-xs font-mono uppercase text-zinc-500 mb-1">Item Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-zinc-500 mb-1">Total Price ($)</label>
                <input
                  type="number"
                  required
                  value={totalPrice}
                  onChange={(e) => setTotalPrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm font-medium"
                />
              </div>

              {/* Simulation Mode for Exception Testing */}
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
                  onClick={() => setShowCreateModal(false)}
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
