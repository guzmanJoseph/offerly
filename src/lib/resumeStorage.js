
import { supabase } from "./supabaseClient";

const BUCKET = "resumes";
const MAX_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = {
  pdf: "application/pdf",
  docx:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

async function currentUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) {
    throw new Error("Please sign in to manage resumes.");
  }

  return data.user;
}

function fileExtension(filename) {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function validateUpload(file) {
  const extension = fileExtension(file.name);

  if (!ALLOWED_TYPES[extension]) {
    throw new Error("Only PDF and DOCX files are supported.");
  }

  if (file.size === 0 || file.size > MAX_SIZE) {
    throw new Error("Resume must be between 1 byte and 5 MB.");
  }

  return extension;
}

function validateStoredName(name) {
  if (
    typeof name !== "string" ||
    !name ||
    name.includes("/") ||
    name.includes("\\") ||
    name === "." ||
    name === ".."
  ) {
    throw new Error("Invalid resume filename.");
  }
  return name;
}

function resumePath(userId, storedName) {
  return `${userId}/${validateStoredName(storedName)}`;
}

export function resumeDisplayName(storedName) {
  return storedName.includes("__")
    ? storedName.split("__").slice(1).join("__")
    : storedName;
}

// --------------------------------------------------
// Upload
// --------------------------------------------------

export async function uploadResume(file) {
  const user = await currentUser();
  const extension = validateUpload(file);

  const safeName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-120);

  const storedName =
    `${crypto.randomUUID()}__${safeName || `resume.${extension}`}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(resumePath(user.id, storedName), file, {
      contentType: ALLOWED_TYPES[extension],
      upsert: false,
    });

  if (error) throw error;

  return data;
}

// --------------------------------------------------
// List
// --------------------------------------------------

export async function listResumes() {
  const user = await currentUser();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(user.id, {
      limit: 100,
      sortBy: {
        column: "created_at",
        order: "desc",
      },
    });

  if (error) throw error;

  return (data || [])
    .filter((item) => item.id)
    .map((item) => ({
      ...item,
      displayName: resumeDisplayName(item.name),
    }));
}

// --------------------------------------------------
// Retrieve original file (private download)
// --------------------------------------------------

export async function getResumeBlob(storedName) {
  const user = await currentUser();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(resumePath(user.id, storedName));

  if (error) throw error;
  return data;
}

// --------------------------------------------------
// Download to computer
// --------------------------------------------------

export async function downloadResume(storedName) {
  const blob = await getResumeBlob(storedName);
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = resumeDisplayName(storedName);

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --------------------------------------------------
// Delete
// --------------------------------------------------

export async function deleteResume(storedName) {
  const user = await currentUser();
  const path = resumePath(user.id, storedName);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .remove([path]);

  if (error) throw error;

  if (
    !data?.some(
      (item) =>
        item.name === path ||
        item.name === storedName
    )
  ) {
    throw new Error("Could not confirm resume deletion.");
  }
}

// --------------------------------------------------
// Default resume
// --------------------------------------------------

export async function getDefaultResume() {
  const user = await currentUser();

  const { data, error } = await supabase
    .from("resume_preferences")
    .select("default_resume_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  return data?.default_resume_name || null;
}

export async function setDefaultResume(storedName) {
  const user = await currentUser();

  if (storedName !== null) {
    validateStoredName(storedName);

    // Only permit selecting an existing file belonging
    // to the signed-in user.
    const files = await listResumes();

    if (!files.some((file) => file.name === storedName)) {
      throw new Error("This resume was not found in your account.");
    }
  }

  const { error } = await supabase
    .from("resume_preferences")
    .upsert(
      {
        user_id: user.id,
        default_resume_name: storedName,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

  if (error) throw error;
}
