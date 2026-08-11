import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Calendar, Clock, User, Phone, Mail, Sparkles } from "lucide-react";
import { clsx } from "clsx";
import toast from "react-hot-toast";
import { patientService } from "@/services/patientService";
import { appointmentService } from "@/services/appointmentService";
import { NotificationService } from "@/services/notificationService";
import { smsService } from "@/services/sendMessageService";

export default function BookPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const formData = new FormData(e.currentTarget);
      const email = formData.get("email") as string;
      const notes = formData.get("notes") as string;
      const dateStr = formData.get("date") as string;
      
      const appointmentDate = dateStr ? new Date(dateStr) : undefined;
      const combinedNotes = `Email: ${email}\nNotes: ${notes || "None"}`;

      const fullName = formData.get("fullName") as string;
      const phone = formData.get("phone") as string;

      // Fetch the next registration number so they aren't marked as #N/A
      const regNumber = await patientService.getNextRegistrationNumber("main-clinic");

      // 1. Create a Patient record with the exact fields the app expects
      const patientId = await patientService.createPatient({
        clinicId: "main-clinic",
        branchId: "main-branch",
        name: fullName,
        mobile: phone,
        email,
        regNumber,
        gender: "other", // Default fallback
        dob: new Date(),
        age: 0,
        doctorId: "unknown",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "website"
      });

      // 2. Create the Appointment
      await appointmentService.createAppointment({
        patientId,
        clinicId: "main-clinic",
        branchId: "main-branch",
        doctorId: "unknown",
        appointmentTypeId: "unknown",
        appointmentDate,
        appointmentType: "routine",
        status: "scheduled",
        notes: combinedNotes,
        createdBy: "website"
      });

      // 3. Send a real-time notification to the clinic staff
      await NotificationService.sendNotification("main-clinic", {
        branchId: "main-branch",
        title: "New Web Booking",
        message: `${fullName} just booked an appointment for ${dateStr}.`,
        type: "system"
      });

      // 4. Send SMS to the patient confirming receipt of their booking request
      if (phone) {
        try {
          await smsService.sendMessage(
            phone,
            `Hello ${fullName}, your appointment request for ${dateStr} at our clinic has been received and is pending confirmation.`
          );
        } catch (smsError) {
          console.warn("Failed to send booking SMS:", smsError);
        }
      }

      toast.success("Appointment booked successfully!");
      setIsSuccess(true);
    } catch (error) {
      console.error("Failed to submit booking:", error);
      toast.error("Failed to submit booking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[rgb(var(--color-bg))] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/50 backdrop-blur-xl border border-[rgba(var(--color-border))] rounded-3xl p-8 sm:p-10 text-center shadow-xl shadow-[rgba(var(--color-primary),0.03)] animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-[rgba(16,185,129,0.1)] rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-3xl font-extrabold text-[rgb(var(--color-text))] mb-4">Request Sent!</h2>
          <p className="text-[rgb(var(--color-text-muted))] mb-8 leading-relaxed">
            Thank you for booking with us. Our patient coordinator will contact you shortly to confirm your appointment time and details.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center w-full px-6 py-4 rounded-2xl font-bold text-white transition-all hover:opacity-90 shadow-lg shadow-[rgba(var(--color-primary),0.2)]"
            style={{ background: "rgb(var(--color-primary))" }}
          >
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--color-bg))] relative overflow-hidden flex flex-col">
      {/* Decorative Orbs */}
      <div 
        className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] opacity-[0.03] pointer-events-none" 
        style={{ background: "rgb(var(--color-primary))" }} 
      />
      <div 
        className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full blur-[100px] opacity-[0.03] pointer-events-none" 
        style={{ background: "rgb(var(--color-primary))" }} 
      />

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-24 relative z-10 flex flex-col">
        {/* Back Link */}
        <Link to="/" className="inline-flex items-center gap-2 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-primary))] transition-colors w-fit font-medium mb-8 sm:mb-12">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start flex-1">
          {/* Left Column: Info */}
          <div className="lg:col-span-5 lg:sticky lg:top-24">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="w-8 h-px bg-[rgb(var(--color-primary))]" />
              <p className="text-xs font-bold uppercase tracking-widest text-[rgb(var(--color-primary))]">
                Book Appointment
              </p>
            </div>
            
            <h1 className="text-4xl sm:text-5xl font-extrabold text-[rgb(var(--color-text))] tracking-tight mb-6 leading-[1.1]">
              Begin Your <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-[rgb(var(--color-primary))] to-purple-400">Glow Journey</span>
            </h1>
            
            <p className="text-lg text-[rgb(var(--color-text-muted))] leading-relaxed mb-10">
              Schedule your comprehensive consultation and experience the pinnacle of authentic Korean aesthetic science, tailored to your unique skin profile.
            </p>

            <div className="space-y-6">
              {[
                { icon: Sparkles, title: "Personalized Protocol", desc: "Every treatment plan is bespoke to your exact skin needs." },
                { icon: Clock, title: "Zero Wait Time", desc: "We respect your time. Your appointment starts exactly when scheduled." },
                { icon: CheckCircle2, title: "Korean Medical Grade", desc: "Using only premium, scientifically-backed products and lasers." }
              ].map((feature, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-12 h-12 shrink-0 rounded-2xl bg-[rgba(var(--color-primary),0.05)] flex items-center justify-center border border-[rgba(var(--color-primary),0.1)]">
                    <feature.icon className="w-5 h-5 text-[rgb(var(--color-primary))]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[rgb(var(--color-text))] mb-1">{feature.title}</h3>
                    <p className="text-sm text-[rgb(var(--color-text-muted))] leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Form */}
          <div className="lg:col-span-7 w-full">
            <div className="bg-white/60 backdrop-blur-2xl border border-[rgba(var(--color-border))] rounded-[2rem] p-6 sm:p-10 shadow-2xl shadow-[rgba(var(--color-primary),0.04)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[rgb(var(--color-primary))] to-transparent opacity-50" />
              
              <h2 className="text-2xl font-bold text-[rgb(var(--color-text))] mb-8">Appointment Details</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Name */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[rgb(var(--color-text))] flex items-center gap-2">
                      <User className="w-4 h-4 text-[rgb(var(--color-primary))]" />
                      Full Name
                    </label>
                    <input 
                      type="text" 
                      name="fullName"
                      required
                      placeholder="Jane Doe"
                      className="w-full px-4 py-3.5 rounded-xl border border-[rgba(var(--color-border))] bg-[rgb(var(--color-surface))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))] focus:border-transparent transition-all outline-none"
                    />
                  </div>
                  
                  {/* Phone */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[rgb(var(--color-text))] flex items-center gap-2">
                      <Phone className="w-4 h-4 text-[rgb(var(--color-primary))]" />
                      Phone Number
                    </label>
                    <input 
                      type="tel" 
                      name="phone"
                      required
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-4 py-3.5 rounded-xl border border-[rgba(var(--color-border))] bg-[rgb(var(--color-surface))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))] focus:border-transparent transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[rgb(var(--color-text))] flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[rgb(var(--color-primary))]" />
                    Email Address
                  </label>
                  <input 
                    type="email" 
                    name="email"
                    required
                    placeholder="jane@example.com"
                    className="w-full px-4 py-3.5 rounded-xl border border-[rgba(var(--color-border))] bg-[rgb(var(--color-surface))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))] focus:border-transparent transition-all outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Service */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[rgb(var(--color-text))] flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[rgb(var(--color-primary))]" />
                      Service of Interest
                    </label>
                    <div className="relative">
                      <select 
                        name="service"
                        required
                        className="w-full px-4 py-3.5 rounded-xl border border-[rgba(var(--color-border))] bg-[rgb(var(--color-surface))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))] focus:border-transparent transition-all outline-none appearance-none cursor-pointer"
                        defaultValue=""
                      >
                        <option value="" disabled>Select a service</option>
                        <option value="analysis">Digital Skin Analysis</option>
                        <option value="facial">Hydration Facial</option>
                        <option value="laser">K-Laser Therapy</option>
                        <option value="consultation">General Consultation</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[rgb(var(--color-text))] flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[rgb(var(--color-primary))]" />
                      Preferred Date
                    </label>
                    <input 
                      type="date" 
                      name="date"
                      required
                      className="w-full px-4 py-3.5 rounded-xl border border-[rgba(var(--color-border))] bg-[rgb(var(--color-surface))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))] focus:border-transparent transition-all outline-none text-[rgb(var(--color-text))]"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[rgb(var(--color-text))]">
                    Specific Concerns (Optional)
                  </label>
                  <textarea 
                    name="notes"
                    rows={4}
                    placeholder="Tell us a little about your skin goals..."
                    className="w-full px-4 py-3.5 rounded-xl border border-[rgba(var(--color-border))] bg-[rgb(var(--color-surface))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))] focus:border-transparent transition-all outline-none resize-none text-[rgb(var(--color-text))]"
                  ></textarea>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={clsx(
                      "group relative flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold text-white overflow-hidden transition-all w-full disabled:opacity-70 disabled:cursor-not-allowed",
                      !isSubmitting && "hover:shadow-lg hover:shadow-[rgba(var(--color-primary),0.3)]"
                    )}
                    style={{ background: "rgb(var(--color-primary))" }}
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      {isSubmitting ? "Submitting Request..." : "Request Appointment"}
                    </span>
                    {/* Shine effect */}
                    {!isSubmitting && <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />}
                  </button>
                  <p className="text-center text-xs text-[rgb(var(--color-text-muted))] mt-4">
                    By requesting an appointment, you agree to our cancellation policy.
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
