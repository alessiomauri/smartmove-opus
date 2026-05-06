'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';

export interface FeatureOption {
  id: string;
  name: string;
  category: string;
  created_at: string;
}

export async function getFeatureOptions(): Promise<FeatureOption[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('feature_options')
    .select('*')
    .order('category')
    .order('name');

  if (error) {
    console.error('Error fetching features:', error);
    return [];
  }

  return data || [];
}

export async function addFeatureOption(
  name: string,
  category: string = 'Other'
): Promise<FeatureOption | null> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('feature_options')
    .insert({ name: name.trim(), category })
    .select()
    .single();

  if (error) {
    console.error('Error adding feature:', error);
    return null;
  }

  return data;
}
