'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getClient } from '@/lib/supabase';

export interface UserProfile {
  id: string;
  name: string | null;
  phone: string | null;
  birth_year: number | null;
  gender: string | null;
  occupation: string | null;
  company_name: string | null;
  district: string | null;
  mbti: string | null;
  hobbies: string[] | null;
  date_styles: string[] | null;
  contact_freq: string | null;
  bio: string | null;
  profile_photo_url: string | null;
  verification_status: string | null;
  is_deposit_paid: boolean | null;
  is_active: boolean | null;
}

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getClient();

    const loadProfile = async (userId: string) => {
      const { data } = await supabase
        .from('users')
        .select('id, name, phone, birth_year, gender, occupation, company_name, district, mbti, hobbies, date_styles, contact_freq, bio, profile_photo_url, verification_status, is_deposit_paid, is_active')
        .eq('id', userId)
        .single();
      setProfile(data as UserProfile | null);
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) loadProfile(user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) loadProfile(u.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, profile, loading };
}
