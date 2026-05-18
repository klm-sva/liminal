import Navbar from "@/components/marketing/Navbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-certify-white">
      <Navbar />
      {children}
    </div>
  );
}
