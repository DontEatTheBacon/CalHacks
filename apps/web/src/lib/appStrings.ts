import type { Locale } from "./strings";

const id = {
  save: "Simpan program", saved: "Tersimpan ✓", savedPrograms: "Program tersimpan", noSaved: "Belum ada program tersimpan.",
  nextSteps: "Langkah berikutnya", noSteps: "Tidak ada langkah tertunda.", open: "Buka rencana",
  deadline: "Batas waktu resmi", noDeadline: "Batas waktu belum terverifikasi",
  risk: { on_track: "Sesuai jadwal", tight: "Mepet", at_risk: "Berisiko", closed: "Sudah lewat", unknown: "Risiko belum diketahui" } as Record<string, string>,
  dueType: { official: "Tanggal resmi", recommended: "Rekomendasi (asumsi perencanaan)", none: "Tanpa tanggal", student: "Tanggal Anda" } as Record<string, string>,
  status: { not_started: "Belum mulai", in_progress: "Sedang dikerjakan", waiting_on_someone: "Menunggu pihak lain", submitted: "Sudah dikirim", confirmed_complete: "Dikonfirmasi selesai", overdue: "Terlambat", not_applicable: "Tidak berlaku" } as Record<string, string>,
  correction: "Ini koreksi (kembali ke status sebelumnya)", why: "Asumsi", owner: { student: "Anda", school: "Sekolah", university: "Universitas" } as Record<string, string>,
  plan: "Rencana Anda", officialDates: "Tanggal resmi program", remove: "Hapus dari daftar", back: "← Dashboard",
  source: "Sumber", scholarship: "Beasiswa", myDate: "Tanggal saya", applyNote: "Anda mengirim aplikasi sendiri di portal resmi. Langkah tidak pernah dikirim otomatis.",
  agentQueued: "Riset tambahan oleh agen sedang antre.",
  recommendedPassed: "tanggal rekomendasi sudah lewat — kerjakan secepatnya",
  forwardOnly: "Status hanya bisa maju. Centang \"Ini koreksi\" untuk kembali ke status sebelumnya.",
};
const en: typeof id = {
  save: "Save program", saved: "Saved ✓", savedPrograms: "Saved programs", noSaved: "No saved programs yet.",
  nextSteps: "Next steps", noSteps: "Nothing pending.", open: "Open plan",
  deadline: "Official deadline", noDeadline: "Deadline not verified yet",
  risk: { on_track: "On track", tight: "Tight", at_risk: "At risk", closed: "Closed", unknown: "Risk unknown" },
  dueType: { official: "Official date", recommended: "Recommended (planning assumption)", none: "No date", student: "Your date" },
  status: { not_started: "Not started", in_progress: "In progress", waiting_on_someone: "Waiting on someone", submitted: "Submitted", confirmed_complete: "Confirmed complete", overdue: "Overdue", not_applicable: "Not applicable" },
  correction: "This is a correction (go back to an earlier status)", why: "Assumptions", owner: { student: "You", school: "School", university: "University" },
  plan: "Your plan", officialDates: "Program's official dates", remove: "Remove from list", back: "← Dashboard",
  source: "Source", scholarship: "Scholarship", myDate: "My date", applyNote: "You submit on the official portal yourself. Nothing is ever submitted for you.",
  agentQueued: "Extra research by the agent is queued.",
  recommendedPassed: "recommended date has passed — do it as soon as you can",
  forwardOnly: "Status can only move forward. Tick \"This is a correction\" to go back.",
};
export type AppStrings = typeof id;
export const appStrings = (l: Locale): AppStrings => (l === "en" ? en : id);

type P = Record<string, string | number>;
const titles: Record<Locale, Record<string, (p: P) => string>> = {
  id: {
    submit: (p) => `Kirim aplikasi ke ${p.institution} melalui ${p.via === "UCAS" ? "UCAS" : "portal universitas atau portal bersama"}`,
    find_deadline: (p) => `Cari batas waktu pendaftaran resmi untuk ${p.program}`,
    english_book: (p) => `Daftar tes ${p.test}`,
    english_test: (p) => `Ikuti tes ${p.test} (minimum ${p.min})`,
    english_retake: (p) => `Ulangi tes ${p.test} (nilai Anda ${p.score} di bawah ${p.min})`,
    english_results: (p) => `Hasil ${p.test} keluar`,
    english_send: (p) => `Kirim skor resmi ${p.test}${p.score ? ` (${p.score})` : ""} ke ${p.institution}`,
    grade_confirmation: (p) => `Pastikan cara ${p.institution} menilai nilai SMA Indonesia`,
  },
  en: {
    submit: (p) => `Submit your application to ${p.institution} via ${p.via}`,
    find_deadline: (p) => `Find the official application deadline for ${p.program}`,
    english_book: (p) => `Book your ${p.test} test`,
    english_test: (p) => `Take ${p.test} (minimum ${p.min})`,
    english_retake: (p) => `Retake ${p.test} (your ${p.score} is below ${p.min})`,
    english_results: (p) => `${p.test} results available`,
    english_send: (p) => `Send your official ${p.test} score${p.score ? ` (${p.score})` : ""} to ${p.institution}`,
    grade_confirmation: (p) => `Confirm how ${p.institution} assesses Indonesian SMA grades`,
  },
};

/** Task titles are written in the viewer's language from the plan step and its values. */
export function taskTitle(t: { planKey: string | null; params: P | null; title: string }, locale: Locale): string {
  const f = t.planKey && t.params ? titles[locale][t.planKey] : undefined;
  return f ? f(t.params!) : t.title;
}
