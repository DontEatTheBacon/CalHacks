// UI strings. Indonesian is the default for students (spec 12.5).
export type Locale = "id" | "en";

const strings = {
  id: {
    appName: "Langkah",
    signIn: "Masuk", signUp: "Daftar", signOut: "Keluar",
    email: "Email", password: "Kata sandi", name: "Nama",
    haveAccount: "Sudah punya akun? Masuk", noAccount: "Belum punya akun? Daftar",
    signInFailed: "Gagal masuk. Periksa email dan kata sandi (minimal 8 karakter).",
    student: "Siswa", counselor: "Konselor",
    counseling: "Konseling", requestCounseling: "Minta konselor",
    counselingNone: "Belum meminta konseling. Konseling bersifat opsional.",
    counselingPending: "Permintaan diterima. Belum ada konselor aktif; Anda tetap bisa lanjut bekerja.",
    counselingAssigned: (name: string) => `Konselor Anda: ${name}`,
    messages: "Pesan", send: "Kirim", messagePlaceholder: "Tulis pesan…",
    files: "Berkas",
    fileRules: "PDF, Word (.doc/.docx), JPEG, PNG atau HEIC/HEIF. Maks. 10 MB per berkas, 50 berkas, 100 MB total.",
    upload: "Unggah", uploading: "Mengunggah…", download: "Unduh", remove: "Hapus",
    share: "Bagikan ke konselor", unshare: "Batalkan berbagi", shared: "Dibagikan",
    validating: "Memeriksa…", rejected: "Ditolak", notScanned: "Belum dipindai virus",
    wordWarning: "Berkas Word bisa berisi makro. Buka hanya jika Anda memercayai sumbernya.",
    noFiles: "Belum ada berkas.",
    assignedStudents: "Siswa yang ditugaskan", noStudents: "Belum ada siswa yang ditugaskan.",
    sharedFiles: "Berkas yang dibagikan", back: "Kembali",
    profile: "Profil dan preferensi", editProfile: "Ubah profil", seePrograms: "Lihat program",
  },
  en: {
    appName: "Langkah",
    signIn: "Sign in", signUp: "Sign up", signOut: "Sign out",
    email: "Email", password: "Password", name: "Name",
    haveAccount: "Have an account? Sign in", noAccount: "No account? Sign up",
    signInFailed: "Sign-in failed. Check your email and password (at least 8 characters).",
    student: "Student", counselor: "Counselor",
    counseling: "Counseling", requestCounseling: "Request a counselor",
    counselingNone: "No counseling requested. Counseling is optional.",
    counselingPending: "Request received. No counselor is active yet; you can keep working.",
    counselingAssigned: (name: string) => `Your counselor: ${name}`,
    messages: "Messages", send: "Send", messagePlaceholder: "Write a message…",
    files: "Files",
    fileRules: "PDF, Word (.doc/.docx), JPEG, PNG or HEIC/HEIF. Max 10 MB per file, 50 files, 100 MB total.",
    upload: "Upload", uploading: "Uploading…", download: "Download", remove: "Remove",
    share: "Share with counselor", unshare: "Stop sharing", shared: "Shared",
    validating: "Checking…", rejected: "Rejected", notScanned: "Not virus-scanned",
    wordWarning: "Word files can contain macros. Open only if you trust the source.",
    noFiles: "No files yet.",
    assignedStudents: "Assigned students", noStudents: "No students assigned yet.",
    sharedFiles: "Shared files", back: "Back",
    profile: "Profile and preferences", editProfile: "Edit profile", seePrograms: "See programs",
  },
};

export type Strings = (typeof strings)["id"];
export const t = (locale: Locale): Strings => strings[locale] ?? strings.id;
