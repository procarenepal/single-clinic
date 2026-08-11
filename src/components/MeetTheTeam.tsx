import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, GraduationCap, Award, Stethoscope, ChevronRight } from "lucide-react";
import { clsx } from "clsx";

const team = [
  {
    name: "Dr. Ji-Yeon Park",
    title: "Lead Dermatologist & Founder",
    image: "/images/team_1.png",
    specializations: ["Glass Skin Protocols", "Laser Therapy", "Anti-Aging"],
    credentials: ["MD, Seoul National University", "K-Beauty Certified Specialist", "15+ Years Experience"],
    bio: "Dr. Park trained at Seoul's top aesthetic institutes and brings the most advanced Korean skincare science to our patients. She founded the clinic with a vision to make medical-grade aesthetics accessible.",
    badge: "Founder",
  },
  {
    name: "Dr. Min-Jae Kim",
    title: "Aesthetic & Laser Specialist",
    image: "/images/team_2.png",
    specializations: ["Pigmentation Treatment", "K-Laser Therapy", "Skin Rejuvenation"],
    credentials: ["MD, Yonsei University", "Laser Medicine Certified", "10+ Years Experience"],
    bio: "Dr. Kim specializes in precision laser treatments and has performed over 3,000 procedures. His evidence-based approach ensures safe, visible results tailored to each patient's unique skin profile.",
    badge: "Specialist",
  },
  {
    name: "Ms. Soo-Yeon Lee",
    title: "Senior Aesthetic Nurse",
    image: "/images/team_3.png",
    specializations: ["Hydration Facials", "Skin Analysis", "Post-Treatment Care"],
    credentials: ["BSN, Nursing & Aesthetics", "K-Skincare Protocol Certified", "7+ Years Experience"],
    bio: "Soo-Yeon is our patients' favourite — her gentle touch and thorough consultations make every visit a comfortable and results-driven experience. She leads our signature hydration facial program.",
    badge: "Nurse",
  },
];

const BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Founder: { bg: "rgba(var(--color-primary), 0.15)", text: "rgb(var(--color-primary))", border: "rgba(var(--color-primary), 0.3)" },
  Specialist: { bg: "rgba(59,130,246,0.15)", text: "rgb(59,130,246)", border: "rgba(59,130,246,0.3)" },
  Nurse: { bg: "rgba(16,185,129,0.15)", text: "rgb(16,185,129)", border: "rgba(16,185,129,0.3)" },
};

function TeamCard({ member, active, onSelect }: {
  member: typeof team[number];
  active: boolean;
  onSelect: () => void;
}) {
  const badge = BADGE_COLORS[member.badge] ?? BADGE_COLORS["Specialist"];

  return (
    <div
      className={clsx(
        "group relative flex flex-col rounded-3xl overflow-hidden cursor-pointer transition-all duration-500 ease-out outline-none",
        active ? "ring-2 ring-offset-4 ring-offset-[rgb(var(--color-bg))] scale-100" : "scale-[0.97] opacity-80 hover:opacity-100 hover:scale-100"
      )}
      style={{
        "--tw-ring-color": "rgb(var(--color-primary))",
      } as React.CSSProperties}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="relative aspect-[4/5] overflow-hidden w-full h-full rounded-3xl bg-gray-100">
        <img
          alt={member.name}
          className={clsx(
            "w-full h-full object-cover object-top transition-transform duration-700 ease-out",
            active ? "scale-105" : "group-hover:scale-105"
          )}
          src={member.image}
        />
        
        {/* Gradients */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/90 pointer-events-none transition-opacity duration-500" />
        
        {/* Active state subtle tint */}
        <div 
          className={clsx(
            "absolute inset-0 mix-blend-overlay pointer-events-none transition-opacity duration-500",
            active ? "opacity-40" : "opacity-0"
          )}
          style={{ backgroundColor: "rgb(var(--color-primary))" }}
        />

        {/* Top Badge */}
        <div className="absolute top-4 left-4 z-10">
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full backdrop-blur-md transition-all duration-300"
            style={{ 
              background: active ? badge.text : "rgba(0,0,0,0.5)", 
              color: active ? "#fff" : "#fff",
              border: `1px solid ${active ? "transparent" : "rgba(255,255,255,0.2)"}` 
            }}
          >
            {member.badge}
          </span>
        </div>

        {/* Bottom Info */}
        <div className={clsx(
          "absolute bottom-0 inset-x-0 p-5 z-10 transition-transform duration-500",
          active ? "translate-y-0" : "translate-y-2 group-hover:translate-y-0"
        )}>
          <p className="text-white font-bold text-lg sm:text-xl leading-tight mb-1">{member.name}</p>
          <p className="text-white/80 text-sm font-medium">{member.title}</p>
        </div>
      </div>
    </div>
  );
}

export default function MeetTheTeam() {
  const [active, setActive] = useState(0);
  const member = team[active];
  const badge = BADGE_COLORS[member.badge] ?? BADGE_COLORS["Specialist"];

  return (
    <section className="py-20 lg:py-32 relative overflow-hidden" id="team">
      {/* Background Decorative Elements */}
      <div 
        className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-10 pointer-events-none" 
        style={{ background: "rgb(var(--color-primary))", transform: "translate(30%, -30%)" }} 
      />
      <div 
        className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full blur-[150px] opacity-[0.07] pointer-events-none" 
        style={{ background: "rgb(var(--color-primary))", transform: "translate(-20%, 20%)" }} 
      />

      <div className="max-w-7xl mx-auto px-5 lg:px-8 relative z-10">
        {/* Header */}
        <div className="mb-14 lg:mb-20 text-center lg:text-left flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="w-8 h-px bg-[rgb(var(--color-primary))]" />
              <p className="text-xs font-bold uppercase tracking-widest text-[rgb(var(--color-primary))]">
                Our Specialists
              </p>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[rgb(var(--color-text))] mb-4">
              Meet the Team
            </h2>
            <p className="text-base sm:text-lg text-[rgb(var(--color-text-muted))]">
              Korean-trained medical professionals dedicated to your skin health and confidence.
            </p>
          </div>
          <div className="hidden lg:flex gap-3">
             <button 
                onClick={() => setActive((p) => (p === 0 ? team.length - 1 : p - 1))}
                className="w-12 h-12 rounded-full border border-[rgba(var(--color-border))] flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] hover:border-[rgb(var(--color-primary))] transition-colors"
             >
                <ChevronRight className="w-5 h-5 rotate-180" />
             </button>
             <button 
                onClick={() => setActive((p) => (p === team.length - 1 ? 0 : p + 1))}
                className="w-12 h-12 rounded-full border border-[rgba(var(--color-border))] flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] hover:border-[rgb(var(--color-primary))] transition-colors"
             >
                <ChevronRight className="w-5 h-5" />
             </button>
          </div>
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

          {/* Left Cards */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-5 lg:gap-6">
            {team.map((m, i) => (
              <TeamCard key={m.name} member={m} active={active === i} onSelect={() => setActive(i)} />
            ))}
          </div>

          {/* Right Detail Panel */}
          <div className="lg:col-span-5 relative">
            <div
              key={active} // Force re-render for simple animation
              className="rounded-[2rem] p-8 sm:p-10 border border-[rgba(var(--color-border))] bg-[rgb(var(--color-bg))]/80 backdrop-blur-xl shadow-xl shadow-[rgba(var(--color-primary),0.03)] animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              {/* Doctor name & badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-[rgb(var(--color-text))] mb-2">
                    {member.name}
                  </h3>
                  <p className="text-base text-[rgb(var(--color-text-muted))] font-medium">
                    {member.title}
                  </p>
                </div>
                <span
                  className="text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full flex-shrink-0"
                  style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}
                >
                  {member.badge}
                </span>
              </div>

              {/* Bio */}
              <p className="text-[15px] sm:text-base leading-relaxed text-[rgb(var(--color-text-muted))] mb-8">
                {member.bio}
              </p>

              <hr className="border-[rgba(var(--color-border))] mb-8" />

              {/* Credentials */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-lg bg-[rgba(var(--color-primary),0.1)] text-[rgb(var(--color-primary))]">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <p className="text-sm font-bold uppercase tracking-widest text-[rgb(var(--color-primary))]">
                    Credentials
                  </p>
                </div>
                <ul className="space-y-3">
                  {member.credentials.map((c) => (
                    <li key={c} className="flex items-start gap-3 text-sm sm:text-[15px] text-[rgb(var(--color-text))]">
                      <Award className="w-4 h-4 text-[rgb(var(--color-primary))] mt-0.5 flex-shrink-0" />
                      <span className="font-medium">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Specializations */}
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-lg bg-[rgba(var(--color-primary),0.1)] text-[rgb(var(--color-primary))]">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <p className="text-sm font-bold uppercase tracking-widest text-[rgb(var(--color-primary))]">
                    Specializations
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {member.specializations.map((s) => (
                    <span
                      key={s}
                      className="text-[13px] font-semibold px-4 py-2 rounded-xl transition-colors cursor-default hover:bg-[rgba(var(--color-primary),0.1)]"
                      style={{ 
                        color: "rgb(var(--color-primary))", 
                        background: "rgba(var(--color-primary),0.05)",
                        border: "1px solid rgba(var(--color-primary),0.15)"
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <Link
                to="/contact"
                className="group relative flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-white overflow-hidden transition-all hover:shadow-lg hover:shadow-[rgba(var(--color-primary),0.3)] w-full"
                style={{ background: "rgb(var(--color-primary))" }}
              >
                <span className="relative z-10 flex items-center gap-2">
                  Book with {member.name.split(" ")[1]} 
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
                {/* Shine effect */}
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
              </Link>
            </div>
            
            {/* Mobile navigation dots */}
            <div className="flex lg:hidden justify-center gap-3 mt-8">
              {team.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className="w-2.5 h-2.5 rounded-full transition-all duration-300 outline-none"
                  style={{
                    background: active === i ? "rgb(var(--color-primary))" : "rgb(var(--color-border))",
                    transform: active === i ? "scale(1.3)" : "scale(1)",
                  }}
                  aria-label={`View ${team[i].name}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
