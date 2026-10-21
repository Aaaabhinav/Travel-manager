import React, { useEffect, useState } from 'react';
import { useAuth } from '../store/authContext';
import { apiClient } from '../api/client';
import { Check, Save } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [travelPreferences, setTravelPreferences] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const resp = await apiClient.get(`/users/${user.id}/profile`);
        const data = resp.data;
        setFullName(data.fullName || '');
        setPhone(data.phone || '');
        setHomeCity(data.homeCity || '');
        setTravelPreferences(data.travelPreferences || '');
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSavedSuccess(false);

    try {
      await apiClient.put(`/users/${user.id}`, {
        fullName,
        phone,
        homeCity,
        travelPreferences,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      alert('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-12 text-center text-zinc-500">Loading user profile...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">User Profile</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Account Details & Settings</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
        <div className="flex items-center space-x-4 pb-6 border-b border-zinc-100 dark:border-zinc-800">
          <div className="w-16 h-16 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold text-2xl shadow-md">
            {fullName ? fullName[0].toUpperCase() : 'U'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{fullName}</h2>
            <p className="text-sm text-zinc-500 font-mono">{user?.email}</p>
          </div>
        </div>

        {savedSuccess && (
          <div className="p-4 rounded-2xl bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 text-sm flex items-center space-x-2">
            <Check className="w-5 h-5 flex-shrink-0 text-emerald-500" />
            <span>Profile successfully updated!</span>
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-zinc-500 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-zinc-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-zinc-500 mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-zinc-500"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-zinc-500 mb-1">Home City</label>
              <input
                type="text"
                value={homeCity}
                onChange={(e) => setHomeCity(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-zinc-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-zinc-500 mb-1">Travel Preferences</label>
            <textarea
              rows={3}
              value={travelPreferences}
              onChange={(e) => setTravelPreferences(e.target.value)}
              placeholder="e.g. Heritage sites, luxury beach resorts..."
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 shadow-sm flex items-center justify-center space-x-2 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
