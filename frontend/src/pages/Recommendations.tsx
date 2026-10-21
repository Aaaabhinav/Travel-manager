import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/authContext';
import { apiClient } from '../api/client';
import { Recommendation, Trip } from '../types';
import { Sparkles, Plus } from 'lucide-react';

export const Recommendations: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const activeUserId = user?.id || parseInt(localStorage.getItem('user_id') || '1');
        const recRes = await apiClient.get(`/recommendations/${activeUserId}`);
        setRecommendations(recRes.data.recommendations || []);
      } catch (err) {
        console.error('Failed to fetch recommendations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const filteredRecs = categoryFilter === 'all'
    ? recommendations
    : recommendations.filter((r) => r.category.toLowerCase() === categoryFilter.toLowerCase());

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-zinc-500" />
            <span>Curated Recommendations</span>
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            Handpicked travel destinations tailored to your travel style and budget
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {['all', 'heritage', 'beach', 'adventure', 'nature'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                categoryFilter === cat
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-500">Curating recommendations...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecs.map((rec) => (
            <div
              key={rec.destination_id}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between hover:border-zinc-400 dark:hover:border-zinc-600 transition space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">{rec.destination_name}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{rec.country} • {rec.category}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    {rec.score.toFixed(0)}% Match
                  </span>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{rec.description}</p>

                <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300">
                  <span className="font-bold">Why recommended:</span> {rec.reason}
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">${rec.daily_cost?.toLocaleString('en-US')}/day</span>
                <button
                  onClick={() => navigate(`/trips/create?destId=${rec.destination_id}&destName=${encodeURIComponent(rec.destination_name)}`)}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold text-xs hover:opacity-90 transition shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Plan Trip</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

