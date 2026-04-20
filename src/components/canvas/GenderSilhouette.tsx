import type { Gender } from "@/domain/types";

export function genderColor(gender?: Gender) {
  if (gender === "female") return "#e66f87";
  if (gender === "male") return "#4bbfd0";
  return "#8fa19a";
}

export default function GenderSilhouette({ gender }: { gender?: Gender }) {
  if (gender === "female") {
    return (
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="17" cy="11" r="7.2" fill="none" stroke="currentColor" strokeWidth="3.2" />
        <path d="M17 18.2v11M11.8 24.2h10.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3.2" />
      </svg>
    );
  }

  if (gender === "male") {
    return (
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="13.6" cy="20.4" r="7.2" fill="none" stroke="currentColor" strokeWidth="3.2" />
        <path d="M18.7 15.3 28 6m-7 .2h7.2v7.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.2" />
      </svg>
    );
  }

  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <circle cx="17" cy="13" r="7" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.72" />
      <path d="M17 20v8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3" opacity="0.72" />
    </svg>
  );
}
