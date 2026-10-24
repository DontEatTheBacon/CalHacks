import type { Locale } from "./strings";

const id = {
  title: "Program yang cocok untuk Anda",
  subtitle: "Diurutkan menurut jurusan, status akademik, anggaran, lalu cuaca. Tanpa persentase kecocokan; yang belum diketahui tetap terlihat.",
  editProfile: "Ubah preferensi", needsProfile: "Isi profil Anda dulu untuk melihat program.", startIntake: "Mulai isi profil",
  needsCountry: "Pilih minimal satu negara (Amerika Serikat atau Inggris) untuk melihat program.",
  unclassified: (n: number) => `${n} program disembunyikan karena lingkungan kampusnya belum terklasifikasi.`,
  count: (n: number, total: number) => `${n} dari ${total} program`,
  rate: (date: string, src: string) => `Kurs ${date}, ${src}.`,
  none: "Tidak ada program yang sesuai filter Anda.",
  bands: {
    major: { direct: "Jurusan sesuai", related: "Jurusan terkait", other: "Jurusan lain", unknown: "Jurusan belum diketahui" },
    academic: { meets: "Memenuhi syarat nilai", needs_confirmation: "Nilai: perlu konfirmasi", subject_gap: "Ada kekurangan mata pelajaran", below: "Di bawah syarat nilai" },
    budget: { within: "Dalam anggaran", within_incomplete: "Dalam anggaran (biaya belum lengkap)", unknown: "Anggaran: belum diketahui", slightly_over: "Sedikit di atas anggaran", over: "Di atas anggaran" },
    climate: { match: "Cuaca cocok", partial: "Cuaca agak berbeda", unknown: "Cuaca belum diketahui", mismatch: "Cuaca tidak sesuai" },
  },
  setting: { city: "Kota besar", countryside: "Kota kecil", unclassified: "Belum terklasifikasi" },
  climate: { warm: "hangat", mild: "sedang", cool: "sejuk", cold: "dingin" },
  joint: "Gabungan", perYear: "/tahun", tuition: "Biaya kuliah", knownPerYear: "Biaya diketahui per tahun",
  approx: "≈", conversionUnavailable: "konversi tidak tersedia", missing: "Belum dipublikasikan:",
  missingItems: { tuition: "biaya kuliah", fee: "biaya wajib", living: "biaya hidup", duration: "lama studi", rate: "kurs" } as Record<string, string>,
  details: "Lihat detail", official: "Halaman resmi",
  // Program page
  back: "← Kembali ke daftar", campus: "Kampus", settingFrom: "Lingkungan", climateFrom: "Cuaca",
  costs: "Biaya", requirements: "Persyaratan", deadlines: "Tanggal penting", unknowns: "Belum terverifikasi",
  unknownNames: { "international tuition": "biaya kuliah mahasiswa internasional", "living costs": "biaya hidup", "English language minimum": "nilai minimum bahasa Inggris", "application deadline": "batas waktu pendaftaran", "grade requirement for Indonesian students": "syarat nilai untuk lulusan SMA Indonesia" } as Record<string, string>,
  gradeTitle: "Nilai Anda", gradeNeeds: "Perlu konfirmasi universitas",
  gradeBody: "Universitas ini belum menerbitkan aturan konversi nilai Indonesia yang bisa kami verifikasi. Kami tidak menebak konversi. Anda tetap bisa menyimpan program ini dan meminta bantuan konselor.",
  source: "Sumber", retrieved: "diambil", via: { plain: "langsung", web_unlocker: "via Bright Data Web Unlocker", failed: "gagal" } as Record<string, string>,
  scholarship: "Beasiswa", scopeInstitution: "berlaku untuk seluruh universitas", scopeProgram: "khusus program ini",
  empty: "Belum ada data terverifikasi.", population: "penduduk",
};

const en: typeof id = {
  title: "Programs that fit you",
  subtitle: "Ranked by major, academic status, budget, then climate. No match percentage; unknowns stay visible.",
  editProfile: "Edit preferences", needsProfile: "Fill in your profile first to see programs.", startIntake: "Start your profile",
  needsCountry: "Choose at least one country (United States or United Kingdom) to see programs.",
  unclassified: (n) => `${n} programs hidden because their campus setting is not classified yet.`,
  count: (n, total) => `${n} of ${total} programs`,
  rate: (date, src) => `Rates of ${date}, ${src}.`,
  none: "No programs match your filters.",
  bands: {
    major: { direct: "Your major", related: "Related major", other: "Other major", unknown: "Major unknown" },
    academic: { meets: "Meets grade minimum", needs_confirmation: "Grades: needs confirmation", subject_gap: "Subject gap", below: "Below grade minimum" },
    budget: { within: "Within budget", within_incomplete: "Within budget (costs incomplete)", unknown: "Budget: unknown", slightly_over: "Slightly over budget", over: "Over budget" },
    climate: { match: "Climate match", partial: "Climate partly different", unknown: "Climate unknown", mismatch: "Climate mismatch" },
  },
  setting: { city: "City", countryside: "Small town", unclassified: "Not classified" },
  climate: { warm: "warm", mild: "mild", cool: "cool", cold: "cold" },
  joint: "Joint", perYear: "/year", tuition: "Tuition", knownPerYear: "Known cost per year",
  approx: "≈", conversionUnavailable: "conversion unavailable", missing: "Not published:",
  missingItems: { tuition: "tuition", fee: "mandatory fees", living: "living costs", duration: "duration", rate: "exchange rate" },
  details: "See details", official: "Official page",
  back: "← Back to list", campus: "Campus", settingFrom: "Setting", climateFrom: "Climate",
  costs: "Costs", requirements: "Requirements", deadlines: "Key dates", unknowns: "Not verified yet",
  unknownNames: { "international tuition": "international tuition", "living costs": "living costs", "English language minimum": "English language minimum", "application deadline": "application deadline", "grade requirement for Indonesian students": "grade requirement for Indonesian SMA graduates" },
  gradeTitle: "Your grades", gradeNeeds: "Needs university confirmation",
  gradeBody: "This university has not published an Indonesian grade conversion we can verify. We never guess a conversion. You can still save this program and ask a counselor for help.",
  source: "Source", retrieved: "retrieved", via: { plain: "direct", web_unlocker: "via Bright Data Web Unlocker", failed: "failed" },
  scholarship: "Scholarship", scopeInstitution: "applies to the whole university", scopeProgram: "this program only",
  empty: "No verified data yet.", population: "population",
};

export type DiscoverStrings = typeof id;
export const discoverStrings = (l: Locale): DiscoverStrings => (l === "en" ? en : id);
