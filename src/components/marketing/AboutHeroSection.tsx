"use client";

import { useState, useEffect } from "react";

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1758873268745-dd2cf0d677b5?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1920&q=80",
];

export default function AboutHeroSection() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <section
        className="relative overflow-hidden"
        style={{
          minHeight: "560px",
          boxShadow: "inset 0 0 0 3px #388fa6",
        }}
      >
        {HERO_IMAGES.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0"
            style={{
              backgroundImage: `url('${src}')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: i === current ? 1 : 0,
              transition: "opacity 1200ms ease-in-out",
            }}
          />
        ))}

        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(160deg, rgba(28,94,112,0.80) 0%, rgba(43,64,68,0.76) 100%)",
          }}
        />

        <div
          className="relative flex flex-col items-center justify-center text-center px-4 sm:px-6 lg:px-8"
          style={{ minHeight: "560px", paddingTop: "80px", paddingBottom: "72px" }}
        >
          <h1
            style={{
              fontFamily: "var(--font-dm-serif)",
              fontSize: "clamp(36px, 5vw, 60px)",
              color: "#FFFFFF",
              lineHeight: 1.1,
              marginBottom: "16px",
              maxWidth: "700px",
            }}
          >
            Built by certification professionals
          </h1>
          <p
            style={{
              fontSize: "20px",
              fontWeight: 300,
              color: "rgba(255,255,255,0.72)",
              letterSpacing: "0.01em",
            }}
          >
            Building certification documents automated.
          </p>
        </div>
      </section>

      <div
        aria-hidden="true"
        style={{ height: "5px", background: "linear-gradient(90deg, #388fa6, #1c5e70)" }}
      />
    </>
  );
}
