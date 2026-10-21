import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../store/authContext';
import { Destination, RouteOptimizationResult } from '../types';
import { 
  ArrowRight, MapPin, Building, Car, Navigation, Plus, X, GripVertical, Compass
} from 'lucide-react';

export const CreateTrip: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);

  // Trip Essentials
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('2026-11-01');
  const [endDate, setEndDate] = useState('2026-11-07');
  const [budget, setBudget] = useState('1500');

  // Destination Cities
  const [catalog, setCatalog] = useState<Destination[]>([]);
  const [selectedDests, setSelectedDests] = useState<Destination[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const [showStartDropdown, setShowStartDropdown] = useState(false);

  // Initial Stays & Travel
  const [includeHotel, setIncludeHotel] = useState(false);
  const [hotelTitle, setHotelTitle] = useState('Grand Heritage Hotel Suite');
  const [hotelPrice, setHotelPrice] = useState('350');

  const [includeTransport, setIncludeTransport] = useState(false);
  const [transportTitle, setTransportTitle] = useState('Express Intercity Train / Transport');
  const [transportPrice, setTransportPrice] = useState('120');

  // Optimized Route Preview
  const [startCity, setStartCity] = useState('');
  // Optimized Route Preview
  const [routeResult, setRouteResult] = useState<RouteOptimizationResult | null>(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false);

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoadingCatalog(true);
      try {
        const resp = await apiClient.get('/destinations');
        const list: Destination[] = resp.data.data || resp.data.destinations || resp.data || [];
        setCatalog(list);

        // Check for query params (e.g. from Recommendations)
        const params = new URLSearchParams(location.search);
        const destIdParam = params.get('destId');
        const destNameParam = params.get('destName');
        
        let targetDest: Destination | undefined;
        if (destIdParam) {
          targetDest = list.find(d => d.id === parseInt(destIdParam));
        }
        if (!targetDest && destNameParam) {
          targetDest = list.find(d => d.name.toLowerCase() === destNameParam.toLowerCase());
        }

        if (targetDest) {
          setSelectedDests([targetDest]);
          setTitle(`Trip to ${targetDest.name}`);
          setDescription(`Curated journey to explore ${targetDest.name} (${targetDest.country}).`);
          setHotelTitle(`${targetDest.name} Luxury Hotel`);
          setHotelPrice(`${targetDest.daily_cost || 150}`);
          if (!startCity) {
            setStartCity('Ahmedabad'); // sensible default origin
          }
        }
      } catch (err) {
        console.error('Failed to fetch destinations:', err);
      } finally {
        setLoadingCatalog(false);
      }
    };
    fetchCatalog();
  }, [location.search]);

  const addDestination = (dest: Destination) => {
    if (!selectedDests.find(d => d.id === dest.id) && dest.name !== startCity) {
      setSelectedDests([...selectedDests, dest]);
    }
    setShowDestDropdown(false);
    setRouteResult(null);
  };

  const removeDestination = (id: number) => {
    setSelectedDests(selectedDests.filter(d => d.id !== id));
    setRouteResult(null);
  };

  const calculateRoutePreview = async () => {
    if (!startCity.trim()) {
      alert("Please select a Starting Location first.");
      return;
    }
    if (selectedDests.length < 1) {
      alert("Please add at least one Destination Stop.");
      return;
    }

    setCalculatingRoute(true);
    try {
      const resp = await apiClient.post('/routes/optimize', {
        source: startCity,
        destinations: selectedDests.map((d) => d.name),
      });
      setRouteResult(resp.data);
    } catch (err) {
      console.error('Failed to optimize route preview:', err);
    } finally {
      setCalculatingRoute(false);
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a trip title.');
      return;
    }
    if (!startCity.trim()) {
      alert('Please select a starting city.');
      return;
    }
    if (selectedDests.length === 0) {
      alert('Please add at least one destination city.');
      return;
    }

    setLoading(true);
    try {
      const activeUserId = user?.id || parseInt(localStorage.getItem('user_id') || '1');

      // 1. Create Trip
      const tripResp = await apiClient.post('/trips', {
        title,
        description,
        start_date: startDate,
        end_date: endDate,
        budget: parseFloat(budget),
        user_id: activeUserId,
      });

      const newTripId = tripResp.data.id;

      // 2. Add Selected Destination Cities
      for (const dest of selectedDests) {
        try {
          await apiClient.post(`/trips/${newTripId}/destinations`, {
            destination_id: dest.id,
          });
        } catch (e) {
          console.warn(`Could not attach destination #${dest.id}:`, e);
        }
      }

      // 3. Add Selected Hotel Reservation
      if (includeHotel && hotelTitle) {
        try {
          const hPrice = parseFloat(hotelPrice) || 0;
          await apiClient.post('/bookings', {
            booking_type: 'HOTEL',
            title: hotelTitle,
            notes: hotelTitle,
            total_price: hPrice,
            trip_id: newTripId,
            items: [
              {
                item_type: 'HOTEL',
                name: hotelTitle,
                price: hPrice,
                quantity: 1,
              },
            ],
          });
        } catch (e) {
          console.warn('Could not add initial hotel reservation:', e);
        }
      }

      // 4. Add Selected Transport Reservation
      if (includeTransport && transportTitle) {
        try {
          const tPrice = parseFloat(transportPrice) || 0;
          await apiClient.post('/bookings', {
            booking_type: 'TRANSPORT',
            title: transportTitle,
            notes: transportTitle,
            total_price: tPrice,
            trip_id: newTripId,
            items: [
              {
                item_type: 'TRANSPORT',
                name: transportTitle,
                price: tPrice,
                quantity: 1,
              },
            ],
          });
        } catch (e) {
          console.warn('Could not add initial transport reservation:', e);
        }
      }

      navigate(`/trips/${newTripId}`);
    } catch (err: any) {
      alert(err.response?.data?.message || err.response?.data?.error || 'Failed to create trip.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
          <Compass className="w-6 h-6 text-zinc-500" />
          <span>Plan Your Itinerary</span>
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">
          Build your custom multi-city trip in a single flow
        </p>
      </div>

      <form onSubmit={handleFinalSubmit} className="space-y-6">
        {/* Section 1: Route Builder (MakeMyTrip Style) */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Where are you going?</h2>
          
          <div className="relative border-l-2 border-zinc-200 dark:border-zinc-800 ml-3 space-y-4 py-2">
            
            {/* Origin (Starting Point) */}
            <div className="relative pl-6 flex items-center">
              <div className="absolute -left-[9px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-zinc-900 dark:bg-zinc-100 border-4 border-white dark:border-zinc-900" />
              
              {!showStartDropdown ? (
                <div 
                  className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex items-center shadow-sm cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition"
                  onClick={() => setShowStartDropdown(true)}
                >
                  <span className={`text-sm font-bold ${startCity ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 font-normal'}`}>
                    {startCity || 'Select Starting Location...'}
                  </span>
                </div>
              ) : (
                <div className="flex-1 p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2 relative shadow-sm z-10">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Select Origin</span>
                    <button type="button" onClick={() => setShowStartDropdown(false)}><X className="w-4 h-4 text-zinc-400" /></button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {loadingCatalog ? (
                      <div className="text-xs text-zinc-500 p-2">Loading catalog...</div>
                    ) : catalog.map((dest) => (
                      <button
                        key={`start-${dest.id}`}
                        type="button"
                        onClick={() => {
                          setStartCity(dest.name);
                          setShowStartDropdown(false);
                          setRouteResult(null);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition flex items-center justify-between group"
                      >
                        <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{dest.name}</span>
                        <span className="text-xs text-zinc-400">{dest.country}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Destinations */}
            {selectedDests.map((dest) => (
              <div key={dest.id} className="relative pl-6 flex items-center">
                <div className="absolute -left-[9px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-sm bg-zinc-700 dark:bg-zinc-300 border-4 border-white dark:border-zinc-900" />
                
                <div className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex items-center justify-between group shadow-sm">
                  <div className="flex items-center space-x-3">
                    <GripVertical className="w-4 h-4 text-zinc-300 dark:text-zinc-700 cursor-move" />
                    <div>
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        {dest.name}
                      </h4>
                      <p className="text-xs text-zinc-500">{dest.country} • ${dest.daily_cost || 100}/day</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDestination(dest.id)}
                    className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            <div className="relative pl-6">
              <div className="absolute -left-[9px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-sm bg-zinc-200 dark:bg-zinc-800 border-4 border-white dark:border-zinc-900" />
              
              {!showDestDropdown ? (
                <button
                  type="button"
                  onClick={() => setShowDestDropdown(true)}
                  className="px-4 py-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-bold text-sm hover:border-zinc-400 hover:text-zinc-700 dark:hover:border-zinc-500 dark:hover:text-zinc-300 transition flex items-center space-x-2 w-full"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Destination Stop</span>
                </button>
              ) : (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2 relative shadow-sm">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Select a Stop</span>
                    <button type="button" onClick={() => setShowDestDropdown(false)}><X className="w-4 h-4 text-zinc-400" /></button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {loadingCatalog ? (
                      <div className="text-xs text-zinc-500 p-2">Loading catalog...</div>
                    ) : catalog.filter(d => !selectedDests.find(sd => sd.id === d.id) && d.name !== startCity).map((dest) => (
                      <button
                        key={dest.id}
                        type="button"
                        onClick={() => addDestination(dest)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition flex items-center justify-between group"
                      >
                        <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{dest.name}</span>
                        <span className="text-xs text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition"><Plus className="w-3.5 h-3.5" /></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedDests.length > 0 && startCity && (
            <div className="pt-2">
              <button
                type="button"
                onClick={calculateRoutePreview}
                className="text-xs font-bold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-3 py-1.5 rounded-lg hover:opacity-90 transition flex items-center space-x-1.5"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>{calculatingRoute ? 'Optimizing...' : 'Calculate Optimal Route'}</span>
              </button>

              {routeResult && !calculatingRoute && (
                <div className="mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs flex flex-col space-y-1">
                  <span className="font-bold text-emerald-800 dark:text-emerald-400">
                    Route Optimized: {routeResult.optimizedRoute.join(' → ')}
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-500">
                    Est. Travel Distance: {routeResult.totalDistance} km | Time: {routeResult.estimatedTravelTime} hrs
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 2: Trip Details */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Trip Details</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-mono uppercase text-zinc-500 mb-1.5">Trip Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. My Awesome Adventure"
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm outline-none focus:ring-2 focus:ring-zinc-500"
              />
            </div>
            
            <div className="sm:col-span-2">
              <label className="block text-xs font-mono uppercase text-zinc-500 mb-1.5">Description (Optional)</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of your trip goals..."
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-zinc-500 mb-1.5">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm outline-none focus:ring-2 focus:ring-zinc-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-zinc-500 mb-1.5">End Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm outline-none focus:ring-2 focus:ring-zinc-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-mono uppercase text-zinc-500 mb-1.5">Total Budget ($)</label>
              <input
                type="number"
                required
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm outline-none focus:ring-2 focus:ring-zinc-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Add-ons */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Optional Add-ons</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hotel Toggle */}
            <div className={`p-4 rounded-2xl border transition ${includeHotel ? 'border-zinc-900 bg-zinc-900/5 dark:border-zinc-100 dark:bg-zinc-100/5' : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Building className="w-4 h-4 text-zinc-500" />
                  <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Include Stays</span>
                </div>
                <input type="checkbox" checked={includeHotel} onChange={(e) => setIncludeHotel(e.target.checked)} className="w-4 h-4 accent-zinc-900 dark:accent-zinc-100" />
              </div>
              {includeHotel && (
                <div className="space-y-3 pt-2">
                  <input type="text" value={hotelTitle} onChange={(e) => setHotelTitle(e.target.value)} placeholder="Hotel Name" className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs font-medium" />
                  <input type="number" value={hotelPrice} onChange={(e) => setHotelPrice(e.target.value)} placeholder="Price ($)" className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs font-medium" />
                </div>
              )}
            </div>

            {/* Transport Toggle */}
            <div className={`p-4 rounded-2xl border transition ${includeTransport ? 'border-zinc-900 bg-zinc-900/5 dark:border-zinc-100 dark:bg-zinc-100/5' : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Car className="w-4 h-4 text-zinc-500" />
                  <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Include Travel</span>
                </div>
                <input type="checkbox" checked={includeTransport} onChange={(e) => setIncludeTransport(e.target.checked)} className="w-4 h-4 accent-zinc-900 dark:accent-zinc-100" />
              </div>
              {includeTransport && (
                <div className="space-y-3 pt-2">
                  <input type="text" value={transportTitle} onChange={(e) => setTransportTitle(e.target.value)} placeholder="Transport Details" className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs font-medium" />
                  <input type="number" value={transportPrice} onChange={(e) => setTransportPrice(e.target.value)} placeholder="Price ($)" className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs font-medium" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-sm hover:opacity-90 shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          <span>{loading ? 'Creating Trip...' : 'Create Trip Itinerary'}</span>
          {!loading && <ArrowRight className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
};

