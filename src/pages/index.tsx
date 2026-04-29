import { Link } from "react-router-dom";
import {
  MapPin,
  Building2,
  Users,
  Calendar,
  ClipboardList,
  Stethoscope,
  Pill,
  Building,
} from "lucide-react";

import { Carousel } from "@/components/ui/Carousel";

export default function IndexPage() {
  const testimonials = [
    <div className="p-8 text-center bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-md clarity-card h-full flex flex-col justify-center items-center transition-colors">
      <div className="w-16 h-16 bg-[rgb(var(--color-surface-2))] rounded-full mb-4 flex items-center justify-center border border-[rgb(var(--color-border))] text-xl overflow-hidden">
        <img
          alt="Dr"
          className="w-full h-full object-cover"
          src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80"
        />
      </div>
      <p className="text-lg italic text-[rgb(var(--color-text))] mb-6">
        "Procare Software transformed our clinic completely. You'll notice the
        difference on day one - we reduced paperwork by 80% and our patients
        love the digital prescriptions."
      </p>
      <h4 className="font-bold text-[rgb(var(--color-text))]">Dr. Rajesh Shrestha</h4>
      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        Medical Director, Shrestha Medical Center
      </p>
    </div>,
    <div className="p-8 text-center bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-md clarity-card h-full flex flex-col justify-center items-center transition-colors">
      <div className="w-16 h-16 bg-slate-100 rounded-full mb-4 flex items-center justify-center border border-slate-200 text-xl overflow-hidden">
        <img
          alt="Manager"
          className="w-full h-full object-cover"
          src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80"
        />
      </div>
      <p className="text-lg italic text-[rgb(var(--color-text))] mb-6">
        "Your staff will appreciate the appointment system. It revolutionized
        how we manage our schedule. SMS reminders in Nepali work perfectly,
        keeping our patients informed."
      </p>
      <h4 className="font-bold text-[rgb(var(--color-text))]">Sita Gurung</h4>
      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        Practice Manager, Pokhara Valley Hospital
      </p>
    </div>,
  ];

  return (
    <div className="bg-[rgb(var(--color-bg))] text-[rgb(var(--color-text))] font-sans min-h-screen transition-colors duration-300">
      {/* Hero Section */}
      <section className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16 px-4 py-16 lg:py-24 max-w-7xl mx-auto">
        <div className="flex-1 text-center lg:text-left max-w-2xl">
          <div className="flex flex-wrap gap-2 justify-center lg:justify-start mb-6">
            <span className="flex items-center gap-1.5 bg-[rgb(var(--color-primary-light))] text-[rgb(var(--color-primary))] px-3 py-1 rounded-md text-xs font-semibold tracking-wide uppercase border border-[rgb(var(--color-primary)/0.2)]">
              <MapPin className="w-4 h-4" /> Comprehensive Care in Nepal
            </span>
            <span className="flex items-center gap-1.5 bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] px-3 py-1 rounded-md text-xs font-semibold tracking-wide uppercase border border-[rgb(var(--color-border))]">
              <Building2 className="w-4 h-4" /> State-of-the-art Facility
            </span>
          </div>

          <h1 className="text-4xl lg:text-5xl lg:leading-[1.15] font-bold mb-6 text-[rgb(var(--color-text))] tracking-tight">
            Excellence in <span className="text-[rgb(var(--color-primary))]">Patient Care</span> &
            Personalized Medical Services
          </h1>

          <p className="mb-8 text-lg lg:text-xl text-[rgb(var(--color-text-muted))] leading-relaxed font-medium">
            Your health and comfort are our highest priorities. Experience compassionate healthcare
            delivered by our team of dedicated specialists using the latest medical technologies.
            We are here to support your journey to better health.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10">
            <Link
              className="bg-[rgb(var(--color-primary))] text-white font-medium px-8 py-3.5 text-sm hover:opacity-90 transition-colors rounded border border-[rgb(var(--color-primary))] text-center inline-block"
              to="/login"
            >
              Book An Appointment
            </Link>
            <Link
              className="bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))] font-medium px-8 py-3.5 text-sm hover:bg-[rgb(var(--color-surface-2))] transition-colors rounded border border-[rgb(var(--color-border))] text-center inline-block"
              to="/features"
            >
              Our Specialties
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-5 text-xs font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Open 24/7</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full" />
              <span>Certified Specialists</span>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full lg:w-auto relative group">
          <div className="absolute inset-0 bg-[rgb(var(--color-primary-light))] rounded-xl transform rotate-2 group-hover:rotate-3 transition-transform duration-500 border border-[rgb(var(--color-primary)/0.2)]" />
          <div className="clarity-card p-3 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl relative z-10 transition-transform duration-500 group-hover:-translate-y-1">
            <div className="rounded-lg border border-[rgb(var(--color-border)/0.5)] overflow-hidden bg-[rgb(var(--color-surface-2))]">
              <img
                alt="Doctor using modern dashboard"
                className="w-full h-auto object-cover"
                src="/images/hero_doctor_dashboard.png"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-12 border-y border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {[
            { number: "15+", label: "Specialist Doctors" },
            { number: "10k+", label: "Happy Patients" },
            { number: "20+", label: "Years of Excellence" },
            { number: "24/7", label: "Emergency Services" },
          ].map((stat, index) => (
            <div
              key={index}
              className={`p-4 ${index !== 3 ? "lg:border-r border-[rgb(var(--color-border)/0.5)]" : ""}`}
            >
              <p className="text-3xl font-bold text-[rgb(var(--color-primary))] mb-1">
                {stat.number}
              </p>
              <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] opacity-80">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features (Services) Section */}
      <section className="py-24 px-4 max-w-7xl mx-auto">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-[rgb(var(--color-text))] mb-4 tracking-tight">
            Comprehensive Medical Services
          </h2>
          <p className="text-lg text-[rgb(var(--color-text-muted))]">
            We offer a wide range of specialized healthcare services designed to meet
            the diverse needs of our community, ensuring every patient receives the
            highest standard of care.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: "General Medicine",
              description:
                "Comprehensive health checkups, chronic disease management, and primary care for patients of all ages by experienced clinicians.",
              icon: <Users className="w-5 h-5 text-[rgb(var(--color-text))]" />,
            },
            {
              title: "Pediatric Care",
              description:
                "Dedicated healthcare services for infants, children, and adolescents, including vaccinations and developmental screenings.",
              icon: <Calendar className="w-5 h-5 text-[rgb(var(--color-text))]" />,
            },
            {
              title: "Diagnostic Imaging",
              description:
                "Advanced imaging technologies including X-rays and Ultrasounds to provide accurate and timely diagnostic reports.",
              icon: <ClipboardList className="w-5 h-5 text-[rgb(var(--color-text))]" />,
            },
            {
              title: "Specialized Surgery",
              description:
                "Expert surgical teams performing both minor and major procedures with a focus on safety and quick recovery.",
              icon: <Stethoscope className="w-5 h-5 text-[rgb(var(--color-text))]" />,
            },
            {
              title: "Pharmacy Services",
              description:
                "On-site pharmacy with a comprehensive stock of genuine medicines, available 24/7 for patient convenience.",
              icon: <Pill className="w-5 h-5 text-[rgb(var(--color-text))]" />,
            },
            {
              title: "Pathology Lab",
              description:
                "Accredited laboratory services offering a full range of diagnostic tests with fast and reliable results.",
              icon: <Building className="w-5 h-5 text-[rgb(var(--color-text))]" />,
            },
          ].map((feature, index) => (
            <div
              key={index}
              className="p-6 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-md hover:border-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-surface-2))] transition-colors clarity-card group"
            >
              <div className="w-10 h-10 bg-[rgb(var(--color-surface-2))] rounded flex items-center justify-center text-xl border border-[rgb(var(--color-border))] mb-5 group-hover:bg-[rgb(var(--color-primary-light))] group-hover:border-[rgb(var(--color-primary)/0.3)] transition-colors">
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-[rgb(var(--color-text))] mb-3">
                {feature.title}
              </h3>
              <p className="text-[rgb(var(--color-text-muted))] text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Contextual & Tech Section */}
      <section className="py-24 bg-[rgb(var(--color-surface))] border-y border-[rgb(var(--color-border))] overflow-hidden transition-colors">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="relative group">
            <div className="absolute inset-0 bg-[rgb(var(--color-surface-2))] rounded-xl transform -rotate-2 group-hover:-rotate-3 transition-transform duration-500 border border-[rgb(var(--color-border))]" />
            <div className="p-3 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl relative z-10 transition-transform duration-500 group-hover:translate-y-1">
              <div className="rounded-lg border border-[rgb(var(--color-border)/0.5)] overflow-hidden bg-[rgb(var(--color-surface-2))]">
                <img
                  alt="Modern Nepali Healthcare Technology"
                  className="w-full h-auto object-cover"
                  src="/images/nepal_healthcare_tech.png"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="inline-block px-3 py-1 bg-[rgb(var(--color-primary-light))] border border-[rgb(var(--color-primary)/0.2)] text-[rgb(var(--color-primary))] text-xs font-bold uppercase tracking-widest rounded mb-6">
              Compassionate Care
            </div>
            <h2 className="text-3xl font-bold text-[rgb(var(--color-text))] mb-6 tracking-tight">
              A Healthcare Experience Designed For You
            </h2>
            <p className="text-lg text-[rgb(var(--color-text-muted))] mb-8 leading-relaxed">
              We prioritize your well-being with a patient-first approach. Our modern facility
              and expert staff are dedicated to providing you with a comfortable, efficient,
              and highly effective healthcare experience.
            </p>

            <div className="space-y-6">
              {[
                {
                  title: "Patient-First Approach",
                  desc: "Every clinical decision is made with your unique needs and comfort in mind.",
                },
                {
                  title: "Modern Diagnostics",
                  desc: "Equipped with the latest medical technology for rapid and precise results.",
                },
                {
                  title: "Seamless Experience",
                  desc: "From easy appointment booking to digital medical records, your journey is hassle-free.",
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-6 h-6 flex-shrink-0 rounded-full bg-[rgb(var(--color-primary-light))] border border-[rgb(var(--color-primary)/0.2)] flex items-center justify-center mt-1">
                    <svg
                      className="w-3 h-3 text-[rgb(var(--color-primary))]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-[rgb(var(--color-text))] mb-1">
                      {item.title}
                    </h4>
                    <p className="text-sm text-[rgb(var(--color-text-muted))]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-[rgb(var(--color-bg))] transition-colors">
        <div className="text-center mb-12 max-w-2xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-[rgb(var(--color-text))] mb-4 tracking-tight">
            What Our Patients Say
          </h2>
          <p className="text-[rgb(var(--color-text-muted))]">
            Experience the difference through the words of the people we serve every day.
          </p>
        </div>
        <div className="max-w-4xl mx-auto px-4 h-64">
          <Carousel autoPlayInterval={6000} items={testimonials} />
        </div>
      </section>

      {/* Contact & Location Section */}
      <section className="py-24 px-4 max-w-7xl mx-auto border-t border-[rgb(var(--color-border))]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div>
            <h2 className="text-3xl font-bold text-[rgb(var(--color-text))] mb-6 tracking-tight">
              Visit Us Today
            </h2>
            <p className="text-lg text-[rgb(var(--color-text-muted))] mb-10">
              We are located in the heart of the city, easily accessible by public transport.
              Our friendly staff is ready to welcome you.
            </p>

            <div className="space-y-8">
              <div className="flex gap-5">
                <div className="w-12 h-12 rounded-xl bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] flex items-center justify-center shrink-0">
                  <MapPin className="w-6 h-6 text-[rgb(var(--color-primary))]" />
                </div>
                <div>
                  <h4 className="font-bold text-[rgb(var(--color-text))] mb-1">Our Location</h4>
                  <p className="text-[rgb(var(--color-text-muted))]">
                    123 Medical Avenue, Pokhara-08,<br />
                    Gandaki, Nepal
                  </p>
                </div>
              </div>

              <div className="flex gap-5">
                <div className="w-12 h-12 rounded-xl bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] flex items-center justify-center shrink-0">
                  <Building2 className="w-6 h-6 text-[rgb(var(--color-primary))]" />
                </div>
                <div>
                  <h4 className="font-bold text-[rgb(var(--color-text))] mb-1">Clinic Hours</h4>
                  <p className="text-[rgb(var(--color-text-muted))]">
                    Sunday - Friday: 8:00 AM - 8:00 PM<br />
                    Saturday: 10:00 AM - 2:00 PM (Emergency Only)
                  </p>
                </div>
              </div>

              <div className="flex gap-5">
                <div className="w-12 h-12 rounded-xl bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] flex items-center justify-center shrink-0">
                  <Stethoscope className="w-6 h-6 text-[rgb(var(--color-primary))]" />
                </div>
                <div>
                  <h4 className="font-bold text-[rgb(var(--color-text))] mb-1">Contact Details</h4>
                  <p className="text-[rgb(var(--color-text-muted))]">
                    Phone: +977-61-123456<br />
                    Email: info@procareclinic.com.np
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full h-[450px] bg-[rgb(var(--color-surface-2))] rounded-2xl border border-[rgb(var(--color-border))] overflow-hidden relative shadow-sm">
            {/* Map Placeholder - In a real app, use an iframe or Map component */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-white dark:bg-zinc-800 rounded-full shadow-lg flex items-center justify-center mb-4">
                <MapPin className="w-8 h-8 text-[rgb(var(--color-primary))]" />
              </div>
              <h3 className="font-bold text-[rgb(var(--color-text))] mb-2">Interactive Map</h3>
              <p className="text-sm text-[rgb(var(--color-text-muted))] max-w-xs">
                We've integrated a custom map to help you find us easily.
                Our clinic is located right next to the Central Hospital.
              </p>
              <div className="mt-6 w-full h-32 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] border-dashed rounded-lg flex items-center justify-center">
                <p className="text-xs text-[rgb(var(--color-text-muted))]">Google Maps API Integration point</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Layer */}
      <section className="py-20 bg-[rgb(var(--color-primary))] dark:bg-[rgb(var(--color-surface-2))] border-y border-[rgb(var(--color-primary-hover)/0.5)] text-center text-white px-4 transition-colors overflow-hidden relative mesh-gradient">
        <div className="absolute inset-0 opacity-10 pointer-events-none dark:opacity-20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-[100px] -mr-48 -mt-48 dark:bg-[rgb(var(--color-primary-light))]" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full blur-[100px] -ml-48 -mb-48 dark:bg-[rgb(var(--color-primary-light))]" />
        </div>
        <div className="max-w-3xl mx-auto relative z-10">
          <h2 className="text-3xl font-bold mb-6 tracking-tight text-white">
            Ready to experience excellence in healthcare?
          </h2>
          <p className="text-white/80 text-lg mb-10 leading-relaxed font-medium">
            Your journey to better health begins with a single step. Book your appointment today
            and join the thousands of patients who trust us with their well-being.
          </p>
          <Link
            className="inline-block bg-white text-[rgb(var(--color-primary))] font-bold px-10 py-4 text-sm uppercase tracking-wide rounded hover:bg-white/90 transition-colors border-2 border-transparent focus:outline-none"
            to="/login"
          >
            Book Your Appointment Today
          </Link>
          <p className="mt-8 text-sm text-white/60 font-medium">
            Walk-ins available for emergencies • Experienced Specialists • 24/7 Dedicated Support
          </p>
        </div>
      </section>
    </div>
  );
}
