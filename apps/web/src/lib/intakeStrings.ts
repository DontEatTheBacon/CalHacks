import type { Locale } from "./strings";

const id = {
  title: "Profil Anda",
  subtitle: "Mulai dari yang penting. Semua jawaban bisa diubah nanti, dan \"belum tahu\" selalu boleh.",
  steps: ["Preferensi studi", "Nilai sekolah", "Bahasa Inggris", "Tinjau"],
  stepOf: (n: number, total: number) => `Langkah ${n} dari ${total}`,
  next: "Simpan dan lanjut", back: "Kembali", finish: "Selesai dan lihat dashboard", saving: "Menyimpan…", saved: "Tersimpan",
  // Step 1
  majors: "Jurusan yang diminati", majorsHint: "Pilih satu atau lebih. Jurusan lain tetap ditampilkan, hanya diurutkan lebih rendah.",
  relatedOk: "Saya juga terbuka untuk bidang terkait",
  countries: "Negara tujuan", countriesHint: "Wajib pilih minimal satu untuk melihat program.",
  US: "Amerika Serikat", GB: "Inggris",
  settings: "Lingkungan kampus", settingsHint: "Tidak memilih apa pun berarti tidak ada preferensi.",
  city: "Kota besar", countryside: "Kota kecil / pedesaan",
  budget: "Anggaran", budgetUnknown: "Belum tahu", amount: "Jumlah", currency: "Mata uang",
  annual: "Per tahun", total: "Total seluruh studi", tuitionOnly: "Hanya biaya kuliah", allIn: "Biaya kuliah + biaya hidup",
  climate: "Preferensi cuaca", warm: "Hangat", mild: "Sedang", cool: "Sejuk", cold: "Dingin", no_preference: "Tidak ada preferensi", unknown: "Belum tahu",
  intake: "Rencana mulai kuliah", fall: "Fall / Autumn (Agustus–September)", spring: "Spring (Januari)", year: "Tahun",
  // Step 2
  schoolTitle: "Nilai sekolah Indonesia", schoolHint: "Masukkan nilai sesuai skala sekolah Anda. Kami tidak akan mengonversinya sendiri; setiap universitas dicek terpisah.",
  qualificationType: "Jenis sekolah", curriculum: "Kurikulum", school: "Nama sekolah (opsional)", gradeLevel: "Kelas saat ini", gradYear: "Tahun lulus",
  scale: "Skala nilai", scaleMin: "Minimum", scaleMax: "Maksimum", overall: "Nilai rata-rata (rapor)", overallUnknown: "Belum tahu",
  subjects: "Nilai per mata pelajaran", subject: "Mata pelajaran", grade: "Nilai", addSubject: "+ Tambah mata pelajaran", removeSubject: "Hapus",
  skipGrades: "Lewati dulu (isi nanti)",
  badScale: "Skala tidak valid: maksimum harus lebih besar dari minimum.",
  outOfScale: (what: string, min: string, max: string) => `${what}: nilai harus antara ${min} dan ${max}.`,
  notANumber: (what: string) => `${what}: masukkan angka.`,
  originalNote: "Nilai asli Anda disimpan apa adanya dan tidak pernah ditimpa. Perubahan dibuat sebagai catatan baru.",
  // Step 3
  languageTitle: "Tes bahasa Inggris", languageHint: "\"Belum tes\" sangat wajar. Kami akan membantu merencanakannya.",
  tests: { ielts_academic: "IELTS Academic", toefl_ibt: "TOEFL iBT", duolingo: "Duolingo English Test", other: "Tes lain" },
  taken: "Sudah tes", not_taken: "Belum tes", score: "Skor", takenOn: "Tanggal tes",
  // Step 4
  reviewTitle: "Tinjau jawaban Anda", edit: "Ubah", none: "—", notProvided: "Belum diisi",
  reviewNote: "Pencarian program akan memakai jawaban ini. Nilai yang belum diisi ditandai \"Perlu konfirmasi\", bukan ditebak.",
  // Counseling
  helpTitle: "Bingung mulai dari mana?", helpBody: "Anda bisa minta konselor sekarang. Kami tugaskan seseorang untuk membantu; Anda tetap bisa lanjut mengisi.",
  helpButton: "Minta konselor", helpAssigned: (n: string) => `Konselor Anda: ${n}`, helpPending: "Permintaan diterima. Konselor akan ditugaskan saat tersedia.",
};

const en: typeof id = {
  title: "Your profile",
  subtitle: "Start with what matters. You can change any answer later, and \"don't know yet\" is always fine.",
  steps: ["Study preferences", "School results", "English tests", "Review"],
  stepOf: (n, total) => `Step ${n} of ${total}`,
  next: "Save and continue", back: "Back", finish: "Finish and go to dashboard", saving: "Saving…", saved: "Saved",
  majors: "Intended majors", majorsHint: "Pick one or more. Other majors still appear, just ranked lower.",
  relatedOk: "I'm also open to related fields",
  countries: "Destination countries", countriesHint: "Choose at least one to see programs.",
  US: "United States", GB: "United Kingdom",
  settings: "Campus setting", settingsHint: "Choosing neither means no preference.",
  city: "City", countryside: "Small town / countryside",
  budget: "Budget", budgetUnknown: "Don't know yet", amount: "Amount", currency: "Currency",
  annual: "Per year", total: "Total for the whole degree", tuitionOnly: "Tuition only", allIn: "Tuition + living costs",
  climate: "Climate preference", warm: "Warm", mild: "Mild", cool: "Cool", cold: "Cold", no_preference: "No preference", unknown: "Don't know yet",
  intake: "Intended start", fall: "Fall / Autumn (August–September)", spring: "Spring (January)", year: "Year",
  schoolTitle: "Indonesian school results", schoolHint: "Enter grades on your school's own scale. We never convert them ourselves; each university is checked separately.",
  qualificationType: "School type", curriculum: "Curriculum", school: "School name (optional)", gradeLevel: "Current class", gradYear: "Graduation year",
  scale: "Grading scale", scaleMin: "Minimum", scaleMax: "Maximum", overall: "Overall result (report card)", overallUnknown: "Don't know yet",
  subjects: "Subject grades", subject: "Subject", grade: "Grade", addSubject: "+ Add subject", removeSubject: "Remove",
  skipGrades: "Skip for now (add later)",
  badScale: "Invalid scale: the maximum must be greater than the minimum.",
  outOfScale: (what, min, max) => `${what}: grade must be between ${min} and ${max}.`,
  notANumber: (what) => `${what}: enter a number.`,
  originalNote: "Your original grades are kept exactly as entered and never overwritten. Changes are saved as a new record.",
  languageTitle: "English tests", languageHint: "\"Not taken yet\" is completely normal. We'll help you plan it.",
  tests: { ielts_academic: "IELTS Academic", toefl_ibt: "TOEFL iBT", duolingo: "Duolingo English Test", other: "Other test" },
  taken: "Taken", not_taken: "Not taken yet", score: "Score", takenOn: "Test date",
  reviewTitle: "Review your answers", edit: "Edit", none: "—", notProvided: "Not provided",
  reviewNote: "Program search will use these answers. Anything missing is marked \"Needs confirmation\", never guessed.",
  helpTitle: "Unsure where to start?", helpBody: "You can ask for a counselor now. We'll assign someone to help; you can keep filling this in.",
  helpButton: "Request a counselor", helpAssigned: (n) => `Your counselor: ${n}`, helpPending: "Request received. A counselor will be assigned when available.",
};

export type IntakeStrings = typeof id;
export const intakeStrings = (l: Locale): IntakeStrings => (l === "en" ? en : id);
