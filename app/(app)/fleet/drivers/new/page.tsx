import { DriverForm } from "@/components/fleet/driver-form";

export const dynamic = "force-dynamic";

export default function NewDriverPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <DriverForm initial={{ name: "", phone: "", licenseNumber: "" }} />
      </div>
    </div>
  );
}
