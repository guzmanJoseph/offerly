
import { supabase } from "./supabaseClient";

async function getAuthenticatedUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;

  if (!data.user) {
    throw new Error("Please sign in to save your profile.");
  }

  return data.user;
}

export async function loadAutofillProfile() {
  const user = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("autofill_profiles")
    .select("profile_data, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function saveAutofillProfile(profile) {
  const user = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("autofill_profiles")
    .upsert(
      {
        user_id: user.id,
        profile_data: profile,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    )
    .select("updated_at")
    .single();

  if (error) throw error;

  return data;
}


export async function clearResumeProfileData() {
  const user = await getAuthenticatedUser();

  // Read the latest saved profile so application answers
  // and other settings are preserved.
  const { data: record, error: readError } = await supabase
    .from("autofill_profiles")
    .select("profile_data")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) throw readError;

  const existing = record?.profile_data || {};

  // Clear fields that may have come from the resume.
  // Keep application questions and preferences intact.
  const updated = {
    ...existing,
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    github: "",
    website: "",
    education: [],
    experience: [],
    skills: "",
    projects: [],
  };

  const { data, error } = await supabase
    .from("autofill_profiles")
    .upsert(
      {
        user_id: user.id,
        profile_data: updated,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("profile_data, updated_at")
    .single();

  if (error) throw error;

  return data;
}
